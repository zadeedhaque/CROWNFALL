/**
 * LEVEL 2 - THE BROKEN SPAN
 *
 * Colder, darker, and mostly vertical. The level asks the player to combine
 * things level 1 taught one at a time: a collapsed bridge of pillar hops, a run
 * of crumbling slabs that punishes hesitation, a wall-jump chimney, a pair of
 * moving platforms over a void, and a final ladder of narrow ledges that can
 * only be taken by grabbing.
 */
export default {
  key: 'level2',
  name: 'THE BROKEN SPAN',
  subtitle: 'WHAT THE SAND TOOK BACK',
  palette: 'ruin',
  width: 100,
  height: 76,
  deathY: 76,
  teaches: ['WALL JUMP', 'CRUMBLING STONE', 'MOVING PLATFORMS'],

  build(b, T) {
    /* --------------------------------------------- 1. the fallen hall */
    b.at(3, 67);
    b.ground(0, 68, 20, T.RUBBLE);
    b.box(0, 54, 1, 14, T.BRICK);
    b.box(1, 60, 19, 1, T.TRIM);
    b.column(4, 60, 8);
    b.column(16, 60, 8);
    b.window(10, 62);
    b.cloth(7, 60);
    b.cloth(14, 60);
    b.rubble(12, 69);
    b.rubble(5, 69);
    b.torch(3, 64);
    b.torch(18, 64);
    b.hint(4, 64, 'HOLD SHIFT FOR\nA LONGER JUMP');

    /* ------------------------------------------ 2. the collapsed span */
    b.ledge(23, 66, 3, 10, T.CRACK);
    b.ledge(29, 64, 3, 12, T.CRACK);
    b.ledge(35, 64, 2, 12, T.CRACK);
    b.ledge(40, 62, 3, 14, T.CRACK);
    b.cloth(24, 66);
    b.cloth(30, 64);
    b.cloth(41, 62);
    b.torch(29, 63);
    b.checkpoint(41, 61);
    b.hint(24, 62, 'FALLING COSTS YOU\nONLY THE CLIMB BACK');

    /* -------------------------------------------- 3. crumbling slabs
       The run climbs one row per slab and ends two rows below the walkway, so
       every hop stays inside the jump budget even while the stone is dropping
       out from under you. */
    b.faller(45, 62);
    b.faller(50, 61);
    b.faller(55, 60);
    b.ledge(59, 58, 7, 18, T.BRICK);
    b.hint(47, 57, 'CRACKED STONE\nWILL NOT HOLD YOU');

    /* ------------------------------------------ 4. the chimney climb */
    // Walkway continues at row 58 straight into the shaft floor.
    b.box(66, 58, 2, 18, T.BRICK);
    b.box(68, 58, 3, 18, T.BRICK);
    // Left face of the shaft: hangs above the entrance so the player can walk in,
    // and is wide enough at the top to be a real landing after the last jump.
    b.box(64, 44, 4, 12, T.BRICK);
    // Right face: unbroken from the floor to the top, so it can be hugged at once.
    b.box(71, 42, 3, 34, T.BRICK);
    b.checkpoint(69, 57);
    b.torch(69, 56);
    b.cloth(67, 44);
    b.hint(68, 54, 'PRESS INTO A WALL\nIN MID-AIR, THEN JUMP\nAGAIN TO SCALE IT');

    /* ------------------------------------- 5. movers across the void */
    b.mover(75, 44, 82, 44, 34);
    b.mover(85, 46, 85, 34, 26);
    b.cloth(74, 42);

    /* -------------------------------------- 6. the ladder of ledges */
    b.ledge(89, 32, 8, 44, T.BRICK);
    b.checkpoint(90, 31);
    b.torch(96, 31);
    b.ledge(94, 29, 3, 3, T.CRACK);
    b.ledge(90, 26, 3, 2, T.CRACK);
    b.ledge(94, 23, 3, 2, T.CRACK);
    b.cloth(95, 29);
    b.cloth(91, 26);
    // final terrace, one tile clear of the last perch
    b.ledge(84, 20, 9, 2, T.BRICK);
    b.box(84, 19, 9, 1, T.TRIM);
    b.torch(85, 19);
    b.banner(90, 12);
    b.hint(90, 26, 'GRAB THE LIP,\nTHEN W TO PULL UP');

    b.door(88, 19);
  }
};
