/**
 * LEVEL 1 - COURTYARD OF DAWN
 *
 * A teaching level. Every mechanic gets one clean, unpunishing introduction in
 * the order the player will need it: walk, run, gap, stairs, vault, ledge grab,
 * climb, rooftop descent, and finally the palace door.
 *
 * Jump budget used while laying this out (see README):
 *   flat gap        <= 4 tiles
 *   up 1 row        <= 4 tiles
 *   up 2 rows       <= 3 tiles
 *   ledge grab      reaches 3 rows above the take-off surface
 */
export default {
  key: 'level1',
  name: 'COURTYARD OF DAWN',
  subtitle: 'THE PALACE WAKES EMPTY',
  palette: 'sand',
  width: 168,
  height: 34,
  deathY: 34,
  teaches: ['RUN', 'JUMP', 'GRAB', 'CLIMB'],

  build(b, T) {
    const GROUND = 26;

    /* ---------------------------------------------- 1. the waking plaza */
    b.at(4, GROUND - 1);
    b.ground(0, GROUND, 29);
    b.box(0, GROUND - 10, 1, 10, T.BRICK);          // left wall of the courtyard

    b.arch(8, GROUND);
    b.arch(20, GROUND);
    b.window(14, GROUND - 3);
    b.banner(5, GROUND - 8);
    b.banner(24, GROUND - 8);
    b.rug(12, GROUND);
    b.trim(2, GROUND - 8, 26);
    b.column(3, GROUND - 8, 8);
    b.column(27, GROUND - 8, 8);
    b.torch(6, GROUND - 4);
    b.torch(18, GROUND - 4);
    b.hint(8, GROUND - 4, 'A / D  -  MOVE\nSHIFT  -  RUN');

    /* ------------------------------------------- 2. the first open gap */
    b.ground(32, GROUND, 14);                       // 3-tile gap at 29-31
    b.hint(30, GROUND - 4, 'SPACE  -  JUMP');
    b.rubble(30, GROUND + 1);
    b.arch(38, GROUND);
    b.banner(35, GROUND - 8);
    b.torch(43, GROUND - 4);

    /* --------------------------------------- 3. stairs to the terrace */
    b.stairs(46, GROUND - 1, 4, 1);                 // 46..49 climbing to row 22
    b.ground(50, GROUND - 4, 12);                   // terrace at row 22, x50..61
    b.column(52, GROUND - 11, 7);
    b.column(60, GROUND - 11, 7);
    b.trim(50, GROUND - 11, 12);
    b.window(56, GROUND - 7);
    b.torch(51, GROUND - 8);

    /* ------------------------------- 4. a crate-high block: vault over */
    b.box(56, GROUND - 5, 1, 1, T.BLOCK);
    b.hint(54, GROUND - 8, 'RUN AT LOW WALLS\nTO VAULT THEM');

    /* ------------------------------------------ 5. gap, then a landing */
    b.ground(65, GROUND - 4, 8);                    // 3-tile gap at 62-64
    b.rubble(63, GROUND + 1);
    b.checkpoint(67, GROUND - 5);

    /* ------------------------------------ 6. the ledge-grab wall (+3) */
    b.ground(73, GROUND - 7, 12, T.BRICK);          // top row 19, x73..84
    b.hint(70, GROUND - 8, 'JUMP AT HIGH LEDGES\nTO CATCH THEM\nW  -  PULL UP');
    b.trim(73, GROUND - 14, 12);
    b.banner(76, GROUND - 13);
    b.torch(81, GROUND - 9);
    b.window(79, GROUND - 10);

    /* ----------------------------------------- 7. rooftops going up */
    b.plat(86, GROUND - 9, 3);                      // row 17
    b.plat(91, GROUND - 11, 3);                     // row 15
    b.ledge(96, GROUND - 12, 12, 4, T.ROOF);        // roof, top row 14, x96..107
    b.torch(98, GROUND - 13);
    b.banner(105, GROUND - 16);
    b.checkpoint(99, GROUND - 13);
    b.hint(97, GROUND - 16, 'S  -  DROP THROUGH\nTHIN LEDGES');

    /* ----------------------------------- 8. controlled descent back down */
    b.plat(110, GROUND - 9, 3);                     // row 17
    b.plat(115, GROUND - 6, 3);                     // row 20
    b.ledge(120, GROUND - 3, 4, 2, T.BLOCK);        // row 23
    b.ground(126, GROUND, 24);                      // lower courtyard x126..149
    b.arch(132, GROUND);
    b.arch(144, GROUND);
    b.rug(138, GROUND);
    b.column(128, GROUND - 8, 8);
    b.column(148, GROUND - 8, 8);
    b.trim(126, GROUND - 8, 24);
    b.banner(135, GROUND - 8);
    b.banner(142, GROUND - 8);
    b.torch(130, GROUND - 4);
    b.torch(146, GROUND - 4);
    b.checkpoint(128, GROUND - 1);

    /* ------------------------------------------- 9. the final stairway */
    b.stairs(150, GROUND - 1, 5, 1);                // up to row 21
    b.ground(155, GROUND - 5, 13);                  // terrace row 21, x155..167
    b.trim(155, GROUND - 11, 13);
    b.column(156, GROUND - 10, 5);
    b.column(166, GROUND - 10, 5);
    b.curtain(158, GROUND - 10);
    b.curtain(164, GROUND - 10);
    b.torch(157, GROUND - 9);
    b.torch(165, GROUND - 9);
    b.rug(161, GROUND - 5);

    b.door(161, GROUND - 6);
  }
};
