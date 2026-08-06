/**
 * Uniform scale multiplier applied to an entity when it is drawn.
 *
 * Uniform, not a `Vector3`: models are normalized to a bounding radius at
 * registration (see `PAWN_MODEL_RADIUS`), so an entity's authored size is
 * already settled and the only thing left to vary is how much of it shows —
 * which is what the death animation shrinks. A non-uniform scale would also
 * skew the palette shader's breathing lift, which assumes object +Y is up.
 *
 * Absent means `DEFAULT_SCALE`. Only entities that actually animate their size
 * carry the component; nothing sets it at spawn.
 */
export const DEFAULT_SCALE = 1;
