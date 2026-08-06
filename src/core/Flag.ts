/**
 * An entity's gameplay identity for matching purposes.
 *
 * `shootingSystem` fires only when a pawn's flag equals a block's flag. It is
 * deliberately *not* a colour or a palette name: how an entity is drawn
 * (`ModelData.palette`) is chosen explicitly at each spawn site, so visuals can
 * change without touching what matches what.
 */
export type Flag = string;
