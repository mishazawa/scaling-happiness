# Game Rules

## Overview

A grid of colored blocks sits in the center of the play field. A track loops
around the outside perimeter of the grid. The player has a limited number of
lives and wins by clearing every block from the grid before running out of
lives.

## Components

- **Grid**: a rectangular field of cells, each either empty or holding a
  colored block. The grid is static — destroyed blocks simply become empty
  cells; nothing shifts or refills.
- **Track**: a closed loop that runs around the grid's outer perimeter. Every
  position on the track faces a specific row or column (a "lane") of the
  grid.
- **Pawn**: a token with a single color and a fixed amount of ammo (a fixed
  number of shots). Pawns move along the track.
- **Queue**: an ordered line of pawns waiting to be released onto the track.
- **Lives**: the player starts with **L = 5** lives.

## Turn-by-turn flow

1. The player looks at the upcoming pawns in the queue and manually releases
   the next pawn onto the track whenever they choose.
2. Multiple pawns may be moving along the track at the same time — releasing
   a new pawn does not require the previous one to have finished its lap.
3. Each pawn continuously moves along the track loop.
4. At any point where a pawn is facing a lane (row or column) whose nearest
   non-empty block — found by looking from the track inward along that lane,
   through any empty cells — matches the pawn's own color, the pawn fires and
   destroys that block, consuming one unit of ammo.
   - Because the grid never shifts, a block is only reachable once every
     block in front of it in that lane (closer to the track) has already
     been destroyed.
5. A pawn keeps moving and firing along the track until either:
   - **It runs out of ammo** (used all of its shots): the pawn is removed
     from the track successfully.
   - **It completes a full lap of the track and returns to its starting
     point while still holding unused ammo**: this is a failed pawn. It is
     removed from the track.

## Lives accounting

- **Spawning a pawn** onto the track immediately **decrements** the life
  counter by 1 (a life is "spent" the moment a pawn is released, not when it
  fails).
- **Successful pawn** (depletes all its ammo before completing a lap): the
  spent life is **refunded** — the life counter **increments** by 1 when the
  pawn disappears.
- **Failed pawn** (completes a full lap still holding unused ammo): the
  spent life is **not refunded** — the life counter **stays the same** when
  the pawn disappears (the life spent at spawn time is permanently lost).

Net effect: every pawn costs 1 life at spawn time; that life comes back only
if the pawn succeeds. A failed pawn's cost is never returned.

## Win / lose conditions

- **Win**: every block on the grid has been destroyed (grid fully cleared).
- **Lose**: lives reach 0 and there are no lives available to spawn another
  pawn while blocks remain on the grid.
- A pawn can only be spawned if the player has at least 1 life available to
  spend.

## Strategy implications

- The player should release pawns whose color still has reachable blocks
  (i.e. blocks that are currently the frontmost block in some lane, viewed
  from the track), so the pawn can deplete its ammo before completing a lap
  and get its spent life refunded.
- Releasing a pawn of a color with no currently reachable blocks guarantees
  that pawn will lap the track with leftover ammo, permanently losing the
  life spent to spawn it.
- Timing and order of release matters: as other pawns clear blocks, new
  blocks become reachable in their lanes, which can make a previously
  "doomed" pawn viable if it hasn't completed its lap yet.
- Because spawning itself costs a life, the player must also manage how many
  pawns are in flight at once — spawning too many simultaneously risks
  running out of lives to spend even before any of them fail.
