# Crownfall

A small browser parkour platformer. You play Rashan, the last heir of a house
that no longer exists, moving alone through the fortress that outlived it. There are no enemies and no weapons — the
entire game is movement: running, jumping, catching ledges, climbing, vaulting
and wall-jumping your way to the gate.

Three hand-designed chapters, roughly one to three minutes each once you know
the route.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default <http://localhost:5173>).

---

## Controls

| Key | Action |
| --- | --- |
| `A` / `D` or `←` / `→` | Move |
| `SHIFT` | Run |
| `SPACE` | Jump |
| `S` | Crouch / drop through a thin ledge |
| `W` or `E` | Pull up from a hang / interact |
| `R` | Restart the chapter |
| `ESC` | Pause |

Things the game never spells out but rewards:

- **Ledge grab** — jump at a lip that is too high to land on and Rashan catches
  it. `W` pulls him up, `S` lets go.
- **Wall jump** — in mid-air, press *into* a wall to slide down it, then jump
  again to kick off. Alternate sides to scale a shaft.
- **Vault** — run at a waist-high wall and he goes over it without slowing
  down. Walk into the same wall and he simply steps up.
- **Running jump** — `SHIFT` roughly doubles your air distance. Several gaps
  cannot be cleared from a standing start.

## The three chapters

1. **Courtyard of Dawn** — the teaching level. Each mechanic gets one clean,
   unpunishing introduction in the order you will need it, ending at the palace
   door.
2. **The Broken Span** — colder and mostly vertical. A collapsed bridge of
   pillar hops, a run of crumbling slabs, a wall-jump chimney, moving platforms
   over a void, and a ladder of narrow ledges that can only be taken by grabbing.
3. **Fortress of Ashes** — everything at once, finishing as a long rooftop run
   to the outer gate.

Braziers are checkpoints; falling costs you only the climb back. Progress, best
times and settings are stored in `localStorage`.

---

## How it is built

- **Phaser 3** on a WebGL canvas, 480 × 270 internal resolution scaled to fit,
  `pixelArt: true` so nothing is ever filtered.
- **Arcade physics** with a tilemap collision layer. The player controller does
  its own sensor queries (ledges, walls, vaultable blocks) against a plain
  collision grid rather than against physics bodies, which is what makes ledge
  detection reliable.
- **No asset files at all.** Every tile, sprite, parallax layer, particle and UI
  glyph is drawn into a canvas at boot. The whole game is JavaScript plus one
  dependency.

```
src/
  main.js              game config + scene list
  config.js            all movement tuning and the three colour palettes
  audio/               Web Audio synthesiser: sound effects + generative score
  entities/Player.js   the movement controller
  gfx/                 procedural art: tileset, hero sprite sheet, bitmap font
  levels/              the three levels, authored as code against LevelBuilder
  scenes/              boot, menus, the game scene, pause, results
  systems/             particles, moving/falling platforms, save data, UI kit
  world/LevelBuilder.js tile authoring API + collision grid generation
```

### Level authoring

Levels are functions, not ASCII maps, so distances stay explicit and readable:

```js
b.ground(0, 26, 29);              // walkable floor at row 26, 29 tiles wide
b.plat(86, 17, 3);                // one-way platform you can drop through
b.ledge(96, 14, 12, 4, T.ROOF);   // floating slab, 12 wide and 4 thick
b.mover(75, 44, 82, 44, 34);      // platform that slides between two points
b.faller(45, 62);                 // slab that crumbles under you
b.checkpoint(41, 61);
b.door(161, 20);
```

The jump budget every level is laid out against, measured from the tuning in
`config.js`:

| Move | Reach |
| --- | --- |
| Standing/walking jump | 2.2 tiles up |
| Running jump, level ground | 4 tiles across |
| Running jump, 1 row up | 4 tiles across |
| Running jump, 2 rows up | 4 tiles across (landing on the lip) |
| Running jump, 3 rows up | 3 tiles across (caught as a ledge grab) |
| 4 rows up | not possible - use a wall, a platform or a lower step |
| Wall jump (48 px shaft) | ~2 tiles of height per kick |

`LevelBuilder` refuses to let decorative tiles (columns, friezes) overwrite
collision geometry, so dressing a wall can never open a hole in a floor you walk
on.

### Checking a level is actually playable

```bash
npm run audit
```

`tools/audit-levels.mjs` turns each level into a graph of standing positions and
walks it from the spawn using the jump budget above — including ledge grabs,
platform rides and wall-jump shafts. It fails if the exit or any checkpoint
cannot be reached, and lists footing whose only way onward is a drop. Run it
after editing a level; it catches "that gap is one tile too high" before you do.

### Replacing the placeholder art

Everything is generated in `src/gfx/ArtFactory.js` and
`src/gfx/HeroFactory.js` under fixed texture keys. To swap in hand-drawn pixel
art, load a PNG under the same key in `BootScene` before generation runs — the
generator skips any key that already exists.

| Key | Contents |
| --- | --- |
| `tiles-<palette>` | 16 tiles of 16 × 16, in the order of the `T` enum |
| `hero` | 24 × 32 frames, 12 per row (see `HERO_FRAMES` for the layout) |
| `torch-<palette>` | 3 frames of 12 × 24 |
| `brazier-<palette>` | 2 frames of 20 × 28 |
| `sky/far/mid-<palette>` | parallax layers |
| `arch/window/banner/curtain/cloth/rug/door/mover/faller-<palette>` | props |

`<palette>` is one of `sand`, `ruin`, `fortress`.

### Audio

`src/audio/AudioManager.js` synthesises everything with the Web Audio API — the
sound effects are short oscillator/noise bursts, and the score is a generative
piece in a double-harmonic mode scheduled a bar ahead. Nothing is sampled, so
there is no licensing question and no download. Browsers require a gesture
before audio starts, so the first key press or click unlocks it.

---

## Performance

Steady 60 FPS on integrated graphics. The things that keep it there:

- One tilemap layer, culled to the camera, instead of thousands of sprites.
- Six pooled particle emitters reused for every effect; ambient motes and torch
  sparks are throttled and round-robin over only the torches on screen.
- Parallax is three tileSprites, not large images.
- The backing store is capped at 5× the internal resolution, so a 4K display
  does not pay for pixels nobody can see.

## Deploying

The build is static and uses relative paths (`base: './'`), so it drops onto any
host unchanged.

```bash
npm run build      # -> dist/
npm run preview    # serve the production build locally
```

- **GitHub Pages** — `.github/workflows/deploy.yml` builds and publishes on every
  push to `main`. Enable Pages with the "GitHub Actions" source.
- **Netlify** — `netlify.toml` is included; no dashboard configuration needed.
- **Vercel** — `vercel.json` is included.

## Note on inspiration

The movement philosophy and atmosphere are a nod to the cinematic platformers of
the late eighties and early nineties. All characters, names, level layouts,
artwork, music and code here are original and generated for this project.
