# Midnight Vault

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/firehorse20/best-heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/firehorse20/best-heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

A top-down stealth heist game for the [make.fun best-heist-game-20261122-0559 bounty](https://make.fun/bounty/best-heist-game-20261122-0559). One thief, one vault, three guards, two cameras, and two minutes on the clock.

## The job

1. **Plan the crew** — pick one specialist on the title screen:
   - **1 · Ghost the Hacker** — security cameras are offline and the alarm rises 30% slower.
   - **2 · Eagle the Lookout** — moves 15% faster and sees the guards' patrol routes drawn on the floor.
   - **3 · Bull the Muscle** — press **E** near a guard to knock them out for 8 seconds (2 charges).
2. **Crack the vault** — stand in the gold vault room (top-right) for 3 seconds to open it and grab the $400 gold.
3. **Grab the loot** — cash and gems scattered through the gallery are worth $50–$125 each.
4. **Escape clean** — reach the getaway van (bottom-right) with at least **$500** before the 2-minute clock runs out. Escaping early adds a time bonus to the score.

## The heat

- Guards patrol fixed routes with red vision cones; cameras sweep orange cones. Being seen raises the **alarm** — at 100 the crew is caught, loses a life, and is dumped back at the entrance. Three lives.
- A guard that spots you gives chase. Break line of sight (walls block vision) and the alarm falls again.
- Walls are cover: cones stop at them, and the vault room can only be entered through its door.

## Controls

- **WASD / arrow keys** — move
- **1 / 2 / 3** — pick your crew on the title screen
- **E** — knock out a nearby guard (Muscle only)
- **Space / click** — start, restart
- **P / Esc** — pause

## How it is built

- Plain static files, no libraries and no network requests: `game/index.html` and its ES modules, served locally with `node serve.ts` (http://localhost:8080).
- Fixed 1/60 s simulation steps, seeded randomness (`?seed=N` repeats a game), and deterministic screenshot scenes (`?shot=start|play|end&seed=1`) staged by an autopilot that plays the real rules.
- `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library. It clears its own previous output first, so a stale screenshot can never be handed in twice. Two runs produce byte-identical output.

## Tests

- Headless Chromium: 0 console errors, 0 page errors, 0 non-local requests.
- Two end-to-end `main.ts` runs: outputs byte-identical, dossier 208,235 bytes.
- Screenshots are real frames of the running game: title (1-start.jpg), mid-play with $438 taken (2-play.jpg), and the busted end screen (3-end.jpg).
