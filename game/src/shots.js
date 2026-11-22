// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward from
// a fresh world for a fixed number of steps, steered by an autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { EXIT, FIELD, PLAYER, SPAWN, STEP, VAULT, WALLS } from './config.js';
import { EVENT_CAUGHT, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
const END_RECKLESS_SECONDS = 45;
const SAMPLE = 0.35;
const DIRECTIONS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

function clearAt(x, y, r) {
  if (x < r || x > FIELD.width - r || y < r || y > FIELD.height - r) return false;
  for (const wall of WALLS) {
    const nearX = Math.min(wall.x + wall.w, Math.max(wall.x, x));
    const nearY = Math.min(wall.y + wall.h, Math.max(wall.y, y));
    if ((x - nearX) * (x - nearX) + (y - nearY) * (y - nearY) < r * r) return false;
  }
  return true;
}

/** The next thing worth walking to: the nearest loot, the vault, then the getaway. */
function objective(state) {
  let best = null;
  let bestDist = Infinity;
  for (const item of state.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (d < bestDist) { bestDist = d; best = { x: item.x, y: item.y }; }
  }
  if (state.vaultLoot.spawned && !state.vaultLoot.taken) {
    const d = Math.hypot(state.vaultLoot.x - state.player.x, state.vaultLoot.y - state.player.y);
    if (d < bestDist) { bestDist = d; best = { x: state.vaultLoot.x, y: state.vaultLoot.y }; }
  }
  if (best !== null) return best;
  if (!state.vaultCracked) {
    // The vault door is the gap in the vault room's left wall.
    if (state.player.x < 950) return { x: 940, y: 155 };
    return { x: VAULT.x, y: VAULT.y };
  }
  return { x: EXIT.x + EXIT.width / 2, y: EXIT.y + EXIT.height / 2 };
}

/** Of the ways to move, the one toward the objective that stays out of sight; else stand still.
 * When the thief is seen or chased, flee instead: the way that stays out of sight and gets
 * furthest from the nearest guard. */
function autopilot(world, reckless) {
  const state = world.state;
  const player = state.player;
  const target = objective(state);
  const speed = PLAYER.speed;
  const seen = world.visibleAt(player.x, player.y);
  const chased = state.guards.some((guard) => guard.chasing);
  let best = null;
  let bestScore = Infinity;
  let fallback = null;
  let fallbackScore = Infinity;
  for (const dir of DIRECTIONS) {
    const length = Math.hypot(dir.x, dir.y);
    const stepX = (dir.x / length) * speed * SAMPLE;
    const stepY = (dir.y / length) * speed * SAMPLE;
    const x = player.x + stepX;
    const y = player.y + stepY;
    if (!clearAt(x, y, PLAYER.radius)) continue;
    // Two steps ahead: a cone that is swinging this way, or a guard walking this way, may
    // cover the next step even when this one is clear.
    const aheadX = x + stepX;
    const aheadY = y + stepY;
    const d = Math.hypot(target.x - x, target.y - y);
    if (d < fallbackScore) { fallbackScore = d; fallback = dir; }
    if (reckless) continue;
    if (world.visibleAt(x, y) || world.visibleAt(aheadX, aheadY)) continue;
    let nearestGuard = Infinity;
    for (const guard of state.guards) {
      nearestGuard = Math.min(nearestGuard, Math.hypot(guard.x - x, guard.y - y));
    }
    if (seen || chased) {
      // Flee: furthest from the nearest guard wins, distance to the objective ignored.
      if (-nearestGuard < bestScore) { bestScore = -nearestGuard; best = dir; }
    } else {
      // A guard about to walk into the next step is as bad as a cone already there.
      if (nearestGuard < 110) continue;
      if (d < bestScore) { bestScore = d; best = dir; }
    }
  }
  if (reckless) return fallback ?? { x: 0, y: 0 };
  // Cornered with nowhere unseen: keep moving toward the job rather than freezing in a cone.
  return best ?? fallback ?? { x: 0, y: 0 };
}

/** The nearest guard: what a hurried player blunders into when the end scene needs a bust. */
function nearestGuard(state) {
  let best = null;
  let bestDist = Infinity;
  for (const guard of state.guards) {
    const d = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
    if (d < bestDist) { bestDist = d; best = guard; }
  }
  return best;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
/** The screen the staged state is on: won, busted (lives gone or clock out), or still playing. */
function shotScreen(state) {
  if (state.won) return SCREEN_WIN;
  if (state.lives === 0 || state.over) return SCREEN_OVER;
  return SCREEN_PLAY;
}

  if (name === 'play') {
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world, false), false, false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      if (events & EVENT_CAUGHT) {
        // The main loop's catch handling, restated for the shot: lose a life, back to the door.
        world.state.lives -= 1;
        if (world.state.lives <= 0) break;
        world.state.alarm = 0;
        world.state.player.x = SPAWN.x;
        world.state.player.y = SPAWN.y;
      }
    }
    return { screen: shotScreen(world.state), best: world.state.score };
  }
  // End: a reckless run that collects what it can and gets caught, then blunders straight at
  // the nearest guard until the crew is busted.
  let seconds = 0;
  for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
    seconds += STEP;
    let move;
    if (seconds < END_RECKLESS_SECONDS) {
      move = autopilot(world, true);
    } else {
      const guard = nearestGuard(world.state);
      const dx = guard.x - world.state.player.x;
      const dy = guard.y - world.state.player.y;
      const length = Math.hypot(dx, dy) || 1;
      move = { x: dx / length, y: dy / length };
    }
    const events = world.step(STEP, move, false, false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
    if (events & EVENT_CAUGHT) {
      world.state.lives -= 1;
      if (world.state.lives <= 0) break;
      world.state.alarm = 0;
      world.state.player.x = SPAWN.x;
      world.state.player.y = SPAWN.y;
    }
  }
  return { screen: shotScreen(world.state), best: world.state.score };
}
