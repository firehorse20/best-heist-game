// The game's rules and state, with no drawing and no browser in it: the thief, the guards and
// cameras, the loot, the vault to crack, the alarm, the clock and the getaway. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after createWorld returns.
import {
  ALARM, CAMERA, CAMERAS, EXIT, FIELD, GUARD, LIVES, LOOT_SPOTS, PATROLS, PLAYER, SPAWN, TARGET,
  TIME_LIMIT, VAULT, WALLS,
} from './config.js';

export const EVENT_LOOT = 1;
export const EVENT_CRACK = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_KO = 32;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle. */
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function blocked(x1, y1, x2, y2) {
  for (let index = 0; index < WALLS.length; index += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, WALLS[index])) return true;
  }
  return false;
}

/** True when a viewer at (vx, vy) facing `angle` can see the point (px, py). */
function canSee(vx, vy, angle, range, halfAngle, px, py) {
  const d = dist(vx, vy, px, py);
  if (d > range) return false;
  let diff = Math.atan2(py - vy, px - vx) - angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > halfAngle) return false;
  return !blocked(vx, vy, px, py);
}

/** Does the circle at (x, y) with radius r overlap any wall? */
function hitsWall(x, y, r) {
  for (let index = 0; index < WALLS.length; index += 1) {
    const wall = WALLS[index];
    const nearX = clamp(x, wall.x, wall.x + wall.w);
    const nearY = clamp(y, wall.y, wall.y + wall.h);
    if ((x - nearX) * (x - nearX) + (y - nearY) * (y - nearY) < r * r) return true;
  }
  return false;
}

export function createWorld(random, crew) {
  const hacker = crew === 0;
  const lookout = crew === 1;
  const muscle = crew === 2;

  const player = { x: SPAWN.x, y: SPAWN.y };
  const guards = PATROLS.map((waypoints, index) => ({
    x: waypoints[0].x,
    y: waypoints[0].y,
    wp: 1,
    angle: 0,
    ko: 0,
    lost: 0,
    chasing: false,
    waypoints,
    speedJitter: 0.9 + random() * 0.2,
    index,
  }));
  const cameras = CAMERAS.map((camera) => ({ ...camera, angle: camera.base }));
  const loot = LOOT_SPOTS.map((spot) => ({
    x: spot.x,
    y: spot.y,
    value: spot.value + Math.floor(random() * 25),
    kind: spot.kind,
    taken: false,
  }));
  const vaultLoot = { x: VAULT.x, y: VAULT.y, value: VAULT.goldValue, kind: 'gold', taken: false, spawned: false };

  const state = {
    player, guards, cameras, loot, vaultLoot,
    score: 0, lives: LIVES, alarm: 0, timeLeft: TIME_LIMIT,
    vaultCracked: false, crackProgress: 0,
    koCharges: muscle ? 2 : 0,
    message: '', messageTimer: 0,
    elapsed: 0, won: false, over: false,
    crew,
  };

  function reset() {
    player.x = SPAWN.x;
    player.y = SPAWN.y;
    for (const guard of guards) {
      guard.x = guard.waypoints[0].x;
      guard.y = guard.waypoints[0].y;
      guard.wp = 1;
      guard.angle = 0;
      guard.ko = 0;
      guard.lost = 0;
      guard.chasing = false;
    }
    for (const item of loot) item.taken = false;
    vaultLoot.taken = false;
    vaultLoot.spawned = false;
    state.score = 0;
    state.lives = LIVES;
    state.alarm = 0;
    state.timeLeft = TIME_LIMIT;
    state.vaultCracked = false;
    state.crackProgress = 0;
    state.koCharges = muscle ? 2 : 0;
    state.message = '';
    state.messageTimer = 0;
    state.elapsed = 0;
    state.won = false;
    state.over = false;
  }

  function moveCircle(entity, dx, dy, r) {
    const nextX = clamp(entity.x + dx, r, FIELD.width - r);
    if (!hitsWall(nextX, entity.y, r)) entity.x = nextX;
    const nextY = clamp(entity.y + dy, r, FIELD.height - r);
    if (!hitsWall(entity.x, nextY, r)) entity.y = nextY;
  }

  function guardSees(guard, px, py) {
    if (guard.ko > 0) return false;
    return canSee(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, px, py);
  }

  function cameraSees(camera, px, py) {
    if (hacker) return false;
    return canSee(camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, px, py);
  }

  /** Would any guard or camera see a thief standing at (x, y) right now? (For the autopilot.) */
  function visibleAt(x, y) {
    for (const guard of guards) if (guardSees(guard, x, y)) return true;
    for (const camera of cameras) if (cameraSees(camera, x, y)) return true;
    return false;
  }

  function stepGuard(guard, dt) {
    if (guard.ko > 0) {
      guard.ko = Math.max(0, guard.ko - dt);
      return;
    }
    const sees = guardSees(guard, player.x, player.y);
    if (sees) {
      guard.chasing = true;
      guard.lost = 0;
    } else if (guard.chasing) {
      guard.lost += dt;
      if (guard.lost > GUARD.loseSight) guard.chasing = false;
    }
    let targetX;
    let targetY;
    let speed;
    if (guard.chasing) {
      targetX = player.x;
      targetY = player.y;
      speed = GUARD.chaseSpeed * guard.speedJitter;
    } else {
      const point = guard.waypoints[guard.wp];
      targetX = point.x;
      targetY = point.y;
      speed = GUARD.patrolSpeed * guard.speedJitter;
      if (dist(guard.x, guard.y, targetX, targetY) < 6) {
        guard.wp = (guard.wp + 1) % guard.waypoints.length;
      }
    }
    const dx = targetX - guard.x;
    const dy = targetY - guard.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      const step = Math.min(d, speed * dt);
      const nx = guard.x + (dx / d) * step;
      const ny = guard.y + (dy / d) * step;
      guard.angle = Math.atan2(dy, dx);
      // Guards walk their patrol lanes, which are clear of walls; chase steps are
      // axis-separated so a wall never traps a guard inside it.
      if (!hitsWall(nx, guard.y, GUARD.radius)) guard.x = nx;
      if (!hitsWall(guard.x, ny, GUARD.radius)) guard.y = ny;
    }
  }

  /**
   * One fixed step. `move` is {x, y} (-1..1 each), `knockout` requests the Muscle perk.
   * With `harmless` set (the title screen's backdrop) the clock and the alarm do not run.
   */
  function step(dt, move, knockout, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer = Math.max(0, state.messageTimer - dt);

    for (const camera of cameras) {
      camera.angle = camera.base + CAMERA.sweep * Math.sin((2 * Math.PI * (state.elapsed + camera.phase)) / CAMERA.period);
    }

    if (!harmless) {
      const speed = lookout ? PLAYER.speedLookout : PLAYER.speed;
      const length = Math.hypot(move.x, move.y);
      if (length > 0) {
        moveCircle(player, (move.x / length) * speed * dt, (move.y / length) * speed * dt, PLAYER.radius);
      }
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.over = true;
        return events | EVENT_OVER;
      }
    }

    // Muscle: knock out a nearby guard.
    if (knockout && muscle && state.koCharges > 0) {
      for (const guard of guards) {
        if (guard.ko === 0 && dist(guard.x, guard.y, player.x, player.y) < 64) {
          guard.ko = GUARD.koSeconds;
          guard.chasing = false;
          state.koCharges -= 1;
          events |= EVENT_KO;
          break;
        }
      }
    }

    for (const guard of guards) stepGuard(guard, dt);

    // Alarm: rises while anyone can see the thief, falls while hidden.
    let seen = false;
    if (!harmless) {
      for (const guard of guards) if (guardSees(guard, player.x, player.y)) { seen = true; break; }
      if (!seen) for (const camera of cameras) if (cameraSees(camera, player.x, player.y)) { seen = true; break; }
      if (seen) {
        state.alarm += ALARM.rise * (hacker ? ALARM.hackerRise : 1) * dt;
        // A guard close enough to touch is worse than a distant glance.
        for (const guard of guards) {
          if (guard.ko === 0 && dist(guard.x, guard.y, player.x, player.y) < 40) state.alarm += 40 * dt;
        }
      } else {
        state.alarm -= ALARM.fall * dt;
      }
      state.alarm = clamp(state.alarm, 0, 100);
      if (state.alarm >= 100) {
        state.alarm = 100;
        return events | EVENT_CAUGHT;
      }
    }

    // Loot: walk over it to pocket it (not on the title screen's backdrop).
    if (!harmless) {
      for (const item of loot) {
        if (!item.taken && dist(item.x, item.y, player.x, player.y) < 30) {
          item.taken = true;
          state.score += item.value;
          events |= EVENT_LOOT;
        }
      }
      if (vaultLoot.spawned && !vaultLoot.taken && dist(vaultLoot.x, vaultLoot.y, player.x, player.y) < 34) {
        vaultLoot.taken = true;
        state.score += vaultLoot.value;
        events |= EVENT_LOOT;
      }
    }

    // The vault: stand in the crack zone and hold still enough to work it.
    if (!harmless && !state.vaultCracked && dist(player.x, player.y, VAULT.x, VAULT.y) < VAULT.crackRadius) {
      state.crackProgress += dt;
      if (state.crackProgress >= VAULT.crackSeconds) {
        state.vaultCracked = true;
        vaultLoot.spawned = true;
        events |= EVENT_CRACK;
      }
    }

    // The getaway: only counts once the take is worth it.
    if (
      player.x > EXIT.x && player.x < EXIT.x + EXIT.width &&
      player.y > EXIT.y && player.y < EXIT.y + EXIT.height
    ) {
      if (state.score >= TARGET) {
        state.won = true;
        state.score += Math.round(state.timeLeft) * 2;
        return events | EVENT_WIN;
      }
      if (state.messageTimer === 0) {
        state.message = `Need $${TARGET} to make it worth it — $${state.score} so far.`;
        state.messageTimer = 2;
      }
    }

    return events;
  }

  return { state, reset, step, visibleAt, guardSees, cameraSees };
}
