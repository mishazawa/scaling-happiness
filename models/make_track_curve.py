"""
Rebuilds the game's track path as a NURBS curve in Blender, so a track mesh can
be modelled/swept along exactly the line pawns walk.

Run it from Blender (Text Editor -> Run Script, or `blender -P models/make_track_curve.py`).
Outside Blender it still runs — it prints the points instead of creating a curve,
which is handy for eyeballing the numbers.

It reads `src/constants.ts` directly rather than hardcoding anything, evaluating
the simple numeric `const`s (TRACK_HALF_SIZE and friends are derived from grid
size, so the literals alone are not enough) and then replays the same three
steps `setup/track.ts` does:

  1. close the TRACK_CHECKPOINTS loop and slice out TRACK_START_T..TRACK_END_T,
  2. fillet the interior corners with TRACK_CORNER_RADIUS / TRACK_CORNER_SEGMENTS
     (quadratic Béziers, same as `utils/path.ts` `roundCorners`),
  3. reverse the result, because the modelled track runs against the direction
     of travel.

Coordinates are converted from Three.js (Y up) to Blender (Z up) by default,
which is the inverse of what the glTF exporter does, so exporting the swept mesh
lands it back on the game's path unchanged.
"""

import math
import os
import re

# --- knobs ----------------------------------------------------------------

CURVE_NAME = "Track"
# Leave empty to find src/constants.ts by walking up from this script; set it if
# Blender is launched somewhere the walk can't reach.
CONSTANTS_PATH = ""
# The checkpoints are authored in the direction pawns travel; the track mesh is
# wanted the other way round. Geometry is identical either way.
REVERSE = True
# Three.js (x, y, z) -> Blender (x, -z, y). Turn off to keep raw game coords.
CONVERT_TO_Z_UP = True
# NURBS order. 2 passes exactly through every point (the fillets are already
# sampled as line segments, so this reproduces the gameplay path exactly);
# 3+ smooths it further and pulls slightly off the corners.
ORDER_U = 2
CURVE_RESOLUTION = 12
# Extra Z (Blender up) offset for the curve, if the track mesh wants lifting.
HEIGHT_OFFSET = 0.0

# --- constants.ts parsing -------------------------------------------------

# `const NAME = <single-line expr>;`, exported or not.
CONST_RE = re.compile(
    r"^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(.+?);\s*$",
    re.MULTILINE,
)
NUMBER_TRIPLE_RE = re.compile(r"\[([^\[\]]+)\]")

# Enough of `Math` for constants.ts; anything else fails to evaluate and is
# simply skipped, which is fine — we only need the TRACK_* chain.
EVAL_GLOBALS = {
    "__builtins__": {},
    "Math": type(
        "Math",
        (),
        {
            "PI": math.pi,
            "hypot": staticmethod(math.hypot),
            "sqrt": staticmethod(math.sqrt),
            "ceil": staticmethod(math.ceil),
            "floor": staticmethod(math.floor),
            "min": staticmethod(min),
            "max": staticmethod(max),
            "abs": staticmethod(abs),
        },
    ),
}


def find_constants_file():
    """Locate src/constants.ts by walking up from wherever this script lives."""
    if CONSTANTS_PATH:
        if not os.path.isfile(CONSTANTS_PATH):
            raise FileNotFoundError("CONSTANTS_PATH does not exist: " + CONSTANTS_PATH)
        return CONSTANTS_PATH

    here = None

    if "__file__" in globals():
        here = os.path.dirname(os.path.abspath(__file__))

    if here is None:
        try:
            import bpy  # noqa: F401

            text = bpy.context.space_data.text
            if text and text.filepath:
                here = os.path.dirname(bpy.path.abspath(text.filepath))
        except Exception:
            pass

    if here is None:
        here = os.getcwd()

    directory = here
    for _ in range(6):
        candidate = os.path.join(directory, "src", "constants.ts")
        if os.path.isfile(candidate):
            return candidate
        parent = os.path.dirname(directory)
        if parent == directory:
            break
        directory = parent

    raise FileNotFoundError(
        "Could not find src/constants.ts near {}. Set CONSTANTS_PATH by hand.".format(here)
    )


def parse_numeric_constants(source):
    """Evaluate every `const` in `source` that reduces to a plain number.

    Declaration order matters (later constants are derived from earlier ones),
    and `CONST_RE` yields them in file order, so a single pass suffices.
    """
    values = {}

    for name, expr in CONST_RE.findall(source):
        cleaned = expr.strip()
        if not cleaned or cleaned.startswith(("[", "{", "Object", "(")):
            continue
        try:
            value = eval(cleaned, EVAL_GLOBALS, values)  # noqa: S307 - our own source
        except Exception:
            continue
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            values[name] = value

    return values


def parse_checkpoints(source, values):
    """Pull the `[x, y, z]` triples out of the TRACK_CHECKPOINTS literal."""
    # Anchored on the declaration, not the name: the doc comment above it
    # mentions both TRACK_CHECKPOINTS and an `[x, y, z]` triple.
    declaration = re.search(
        r"const\s+TRACK_CHECKPOINTS\b[^=]*=\s*", source
    )
    if declaration is None:
        raise ValueError("No TRACK_CHECKPOINTS declaration found")

    open_bracket = source.index("[", declaration.end() - 1)

    depth = 0
    for i in range(open_bracket, len(source)):
        if source[i] == "[":
            depth += 1
        elif source[i] == "]":
            depth -= 1
            if depth == 0:
                body = source[open_bracket + 1 : i]
                break
    else:
        raise ValueError("Unterminated TRACK_CHECKPOINTS array")

    points = []
    for triple in NUMBER_TRIPLE_RE.findall(body):
        coords = [eval(part.strip(), EVAL_GLOBALS, values) for part in triple.split(",")]
        if len(coords) != 3:
            raise ValueError("TRACK_CHECKPOINTS entry is not a triple: " + triple)
        points.append(tuple(float(c) for c in coords))

    if len(points) < 2:
        raise ValueError("TRACK_CHECKPOINTS needs at least two points")

    return points


def read_track_config(path):
    with open(path, "r", encoding="utf-8") as handle:
        source = handle.read()

    values = parse_numeric_constants(source)

    missing = [
        name
        for name in (
            "TRACK_START_T",
            "TRACK_END_T",
            "TRACK_CORNER_RADIUS",
            "TRACK_CORNER_SEGMENTS",
        )
        if name not in values
    ]
    if missing:
        raise ValueError("Could not evaluate: " + ", ".join(missing))

    return {
        "checkpoints": parse_checkpoints(source, values),
        "start_t": values["TRACK_START_T"],
        "end_t": values["TRACK_END_T"],
        "corner_radius": values["TRACK_CORNER_RADIUS"],
        "corner_segments": int(values["TRACK_CORNER_SEGMENTS"]),
    }


# --- path math (mirrors utils/path.ts + setup/track.ts) -------------------


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def add_scaled(a, direction, scale):
    return (
        a[0] + direction[0] * scale,
        a[1] + direction[1] * scale,
        a[2] + direction[2] * scale,
    )


def length(v):
    return math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])


def distance(a, b):
    return length(sub(a, b))


def lerp(a, b, alpha):
    return (
        a[0] + (b[0] - a[0]) * alpha,
        a[1] + (b[1] - a[1]) * alpha,
        a[2] + (b[2] - a[2]) * alpha,
    )


def quadratic_at(start, control, end, t):
    u = 1.0 - t
    return tuple(
        u * u * start[i] + 2 * u * t * control[i] + t * t * end[i] for i in range(3)
    )


def closed_perimeter_metrics(points):
    seg_lengths = [
        distance(points[i], points[(i + 1) % len(points)]) for i in range(len(points))
    ]
    return seg_lengths, sum(seg_lengths)


def locate_segment(seg_lengths, total, t):
    remaining = min(max(t, 0.0), 1.0) * total

    for i, seg_length in enumerate(seg_lengths):
        is_last = i == len(seg_lengths) - 1
        if remaining <= seg_length or is_last:
            alpha = min(remaining / seg_length, 1.0) if seg_length > 0 else 0.0
            return i, alpha
        remaining -= seg_length

    return 0, 0.0


def locate_on_closed_perimeter(points, seg_lengths, total, t):
    index, alpha = locate_segment(seg_lengths, total, t)
    start = points[index]
    end = points[(index + 1) % len(points)]
    return lerp(start, end, alpha), index


def slice_track(points, seg_lengths, total, start_t, end_t):
    """Cut the open span start_t..end_t out of the closed perimeter."""
    start_point, start_index = locate_on_closed_perimeter(
        points, seg_lengths, total, start_t
    )
    end_point, end_index = locate_on_closed_perimeter(points, seg_lengths, total, end_t)

    track = [start_point]
    track.extend(points[i] for i in range(start_index + 1, end_index + 1))
    track.append(end_point)

    return track


def round_corners(points, radius, segments):
    """Replace interior corners with sampled quadratic-Bézier fillets."""
    if radius <= 0 or segments <= 0 or len(points) < 3:
        return list(points)

    rounded = [points[0]]

    for i in range(1, len(points) - 1):
        corner = points[i]
        to_prev = sub(points[i - 1], corner)
        to_next = sub(points[i + 1], corner)
        prev_length = length(to_prev)
        next_length = length(to_next)

        if prev_length == 0 or next_length == 0:
            rounded.append(corner)
            continue

        # Never eat more than half of either neighbouring segment.
        r = min(radius, prev_length / 2, next_length / 2)

        start = add_scaled(corner, [c / prev_length for c in to_prev], r)
        end = add_scaled(corner, [c / next_length for c in to_next], r)

        for s in range(segments + 1):
            rounded.append(quadratic_at(start, corner, end, s / segments))

    rounded.append(points[-1])

    return rounded


def build_track_points(config):
    perimeter = config["checkpoints"]
    seg_lengths, total = closed_perimeter_metrics(perimeter)

    sliced = slice_track(
        perimeter, seg_lengths, total, config["start_t"], config["end_t"]
    )
    # Rounding runs after the slice, so the trim points stay exactly put.
    points = round_corners(sliced, config["corner_radius"], config["corner_segments"])

    if REVERSE:
        points.reverse()

    return points


def to_blender(point):
    x, y, z = point
    if CONVERT_TO_Z_UP:
        return (x, -z, y + HEIGHT_OFFSET)
    return (x, y + HEIGHT_OFFSET, z)


# --- Blender ---------------------------------------------------------------


def create_curve(points, name=CURVE_NAME):
    import bpy

    existing = bpy.data.objects.get(name)
    if existing is not None:
        data = existing.data
        bpy.data.objects.remove(existing, do_unlink=True)
        if isinstance(data, bpy.types.Curve) and data.users == 0:
            bpy.data.curves.remove(data)

    curve = bpy.data.curves.new(name, type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = CURVE_RESOLUTION

    spline = curve.splines.new("NURBS")
    spline.points.add(len(points) - 1)  # a new spline starts with one point
    for spline_point, point in zip(spline.points, points):
        x, y, z = to_blender(point)
        spline_point.co = (x, y, z, 1.0)

    spline.use_cyclic_u = False
    spline.use_endpoint_u = True
    spline.order_u = min(ORDER_U, len(points))

    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)

    # No `select_all` op here — its poll fails outside Object Mode, which would
    # error out after the curve has already been created.
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    return obj


def main():
    constants_path = find_constants_file()
    config = read_track_config(constants_path)
    points = build_track_points(config)

    total = sum(distance(points[i], points[i + 1]) for i in range(len(points) - 1))
    print("track: {} from {}".format(os.path.basename(constants_path), constants_path))
    print(
        "  checkpoints={} trim={:.3f}..{:.3f} radius={} segments={}".format(
            len(config["checkpoints"]),
            config["start_t"],
            config["end_t"],
            config["corner_radius"],
            config["corner_segments"],
        )
    )
    print(
        "  {} points, length {:.4f}, reversed={}, z_up={}".format(
            len(points), total, REVERSE, CONVERT_TO_Z_UP
        )
    )

    try:
        import bpy  # noqa: F401
    except ImportError:
        print("  (not running in Blender — printing points instead)")
        for point in points:
            print("    {:.4f} {:.4f} {:.4f}".format(*to_blender(point)))
        return

    obj = create_curve(points)
    print("  created NURBS curve '{}' (order {})".format(obj.name, ORDER_U))


if __name__ == "__main__":
    # Plain call, not sys.exit(): from Blender's Text Editor a SystemExit would
    # escape the script and take the session with it.
    main()
