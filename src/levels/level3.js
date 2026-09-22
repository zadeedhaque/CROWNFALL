/**
 * LEVEL 3 - FORTRESS OF ASHES
 *
 * The showcase. It opens inside a torch-lit hall, turns vertical up a tower,
 * crosses a great hall of crumbling stone and swinging slabs, and finishes as a
 * long rooftop run to the outer gate - everything the player has learned, in
 * one continuous line.
 */
export default {
  key: 'level3',
  name: 'FORTRESS OF ASHES',
  subtitle: 'THE LAST GATE BEFORE MORNING',
  palette: 'fortress',
  width: 194,
  height: 64,
  deathY: 64,
  teaches: ['EVERYTHING'],

  build(b, T) {
    const HALL = 50;

    /* ------------------------------------------- 1. the pillared hall */
    b.at(3, HALL - 1);
    b.ground(0, HALL, 26, T.BLOCK);
    b.box(0, HALL - 16, 1, 16, T.BRICK);
    b.box(1, HALL - 8, 25, 1, T.TRIM);
    b.column(4, HALL - 8, 8);
    b.column(11, HALL - 8, 8);
    b.column(18, HALL - 8, 8);
    b.curtain(7, HALL - 8);
    b.curtain(21, HALL - 8);
    b.window(14, HALL - 4);
    b.rug(8, HALL);
    b.rug(20, HALL);
    b.torch(6, HALL - 4);
    b.torch(16, HALL - 4);
    b.torch(24, HALL - 4);
    b.banner(2, HALL - 8);
    b.banner(25, HALL - 8);
    b.hint(7, HALL - 5, 'THE GATE LIES EAST\nAND HIGH');

    // a low balustrade to vault
    b.box(14, HALL - 1, 1, 1, T.BLOCK);

    b.ground(29, HALL, 10, T.BLOCK);          // 3-tile gap at 26-28
    b.checkpoint(30, HALL - 1);
    b.arch(34, HALL);
    b.torch(37, HALL - 4);

    /* ------------------------------------------ 2. up into the tower */
    b.stairs(39, HALL - 1, 4, 1);             // to row 46
    b.ground(43, HALL - 4, 8, T.BLOCK);       // x43..50, row 46
    b.window(46, HALL - 8);
    b.torch(44, HALL - 8);

    b.ground(51, HALL - 7, 6, T.BRICK);       // x51..56, row 43  (ledge grab, +3)
    b.hint(49, HALL - 8, 'JUMP AT THE LIP\nTO CATCH IT');
    b.banner(54, HALL - 13);

    b.plat(58, HALL - 9, 3);                  // row 41
    b.plat(63, HALL - 11, 3);                 // row 39
    b.ledge(67, HALL - 13, 5, 3, T.BRICK);    // row 37, x67..71
    b.checkpoint(68, HALL - 14);
    b.torch(71, HALL - 14);

    /* -------------------------------------- 3. the wall-jump chimney */
    // Floor continues from the ledge straight into the shaft.
    b.box(72, 37, 5, 3, T.BRICK);             // x72..76, row 37 walkway
    b.box(70, 24, 4, 11, T.BRICK);            // left face, hangs above the way in
    b.box(77, 22, 3, 18, T.BRICK);            // right face, solid to the floor
    b.curtain(71, 24);
    b.torch(75, 36);
    b.hint(74, 34, 'PUSH INTO THE WALL\nAND JUMP AGAIN');

    /* --------------------------------------- 4. the great hall roofs */
    b.ledge(83, 24, 5, 3, T.ROOF);            // from the right face top (row 22)
    b.faller(90, 24);
    b.faller(96, 24);
    b.faller(102, 24);
    b.ledge(107, 24, 6, 4, T.ROOF);
    b.checkpoint(108, 23);
    b.banner(111, 25);
    b.torch(112, 23);

    b.mover(115, 26, 125, 26, 42);
    b.ledge(129, 26, 6, 4, T.ROOF);
    b.cloth(130, 26);

    /* ------------------------------------------ 5. the rooftop escape */
    b.ledge(137, 30, 8, 4, T.ROOF);
    b.banner(140, 31);
    b.ledge(148, 28, 7, 4, T.ROOF);
    b.checkpoint(149, 27);
    b.torch(154, 27);

    b.mover(157, 30, 157, 21, 30);
    b.ledge(162, 24, 8, 4, T.ROOF);
    b.cloth(163, 24);
    b.ledge(172, 21, 7, 4, T.ROOF);           // +3, taken with a grab
    b.hint(163, 21, 'ONE LAST REACH');

    /* --------------------------------------------- 6. the outer gate */
    b.ground(179, 21, 15, T.BLOCK);
    b.box(179, 20, 15, 1, T.TRIM);
    b.column(181, 14, 7);
    b.column(191, 14, 7);
    b.curtain(183, 14);
    b.curtain(189, 14);
    b.banner(186, 13);
    b.torch(181, 17);
    b.torch(191, 17);
    b.rug(186, 21);
    b.checkpoint(180, 20);
    b.door(186, 20);
  }
};
