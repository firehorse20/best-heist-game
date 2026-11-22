// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Flat
// shapes and canvas text for the HUD and the panels. Text that holds a number is rebuilt only
// when the number changes, so a frame allocates nothing.
import {
  CAMERA, CREW, EXIT, FIELD, FONT, GUARD, LIVES, PALETTE, PLAYER, TARGET, VAULT, WALLS,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 640, top: 118, line: 32, bottom: 66 };
const LIFE_SIZE = 20;
const LIFE_GAP = 8;

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Take $');
  const targetLabel = cachedLabel('');
  const timerLabel = cachedLabel('');
  const finalLabel = cachedLabel('Take $');
  const bestLabel = cachedLabel('Best $');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawCone(x, y, angle, range, halfAngle, color) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fill();
  }

  function drawField(state, lookout) {
    // Checkerboard floor.
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 16; col += 1) {
        context.fillStyle = (row + col) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
        context.fillRect(col * 80, row * 80, 80, 80);
      }
    }

    // The getaway zone, bottom-right.
    context.fillStyle = PALETTE.exit;
    context.fillRect(EXIT.x, EXIT.y, EXIT.width, EXIT.height);
    context.strokeStyle = PALETTE.exitEdge;
    context.lineWidth = 3;
    context.strokeRect(EXIT.x + 2, EXIT.y + 2, EXIT.width - 4, EXIT.height - 4);
    text('GETAWAY', EXIT.x + EXIT.width / 2, EXIT.y + 34, 20, PALETTE.exitEdge, 'center');
    text('VAN', EXIT.x + EXIT.width / 2, EXIT.y + 60, 20, PALETTE.exitEdge, 'center');

    // Vault room floor and the vault itself.
    context.fillStyle = PALETTE.vault;
    context.fillRect(976, 56, 248, 188);
    context.fillStyle = state.vaultCracked ? PALETTE.lootGold : PALETTE.vaultDoor;
    context.beginPath();
    context.arc(VAULT.x, VAULT.y, VAULT.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#171a21';
    context.beginPath();
    context.arc(VAULT.x, VAULT.y, VAULT.radius - 12, 0, Math.PI * 2);
    context.fill();
    text('VAULT', VAULT.x, VAULT.y - 56, 18, PALETTE.lootGold, 'center');
    if (!state.vaultCracked) {
      const progress = state.crackProgress / 3;
      if (progress > 0) {
        context.fillStyle = PALETTE.panel;
        context.fillRect(VAULT.x - 50, VAULT.y + 56, 100, 10);
        context.fillStyle = PALETTE.lootGold;
        context.fillRect(VAULT.x - 50, VAULT.y + 56, 100 * progress, 10);
      }
      text('CRACK IT: STAND CLOSE', VAULT.x, VAULT.y + 84, 14, PALETTE.muted, 'center');
    }

    // Walls, with a lighter top edge.
    for (const wall of WALLS) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, 4);
    }

    // Loot.
    for (const item of state.loot) {
      if (item.taken) continue;
      context.fillStyle = item.kind === 'gem' ? PALETTE.lootGem : PALETTE.lootCash;
      if (item.kind === 'gem') {
        context.beginPath();
        context.moveTo(item.x, item.y - 12);
        context.lineTo(item.x + 10, item.y);
        context.lineTo(item.x, item.y + 12);
        context.lineTo(item.x - 10, item.y);
        context.closePath();
        context.fill();
      } else {
        context.fillRect(item.x - 11, item.y - 7, 22, 14);
        context.fillStyle = '#171a21';
        context.fillRect(item.x - 4, item.y - 4, 8, 8);
      }
      text(`$${item.value}`, item.x, item.y + 26, 13, PALETTE.text, 'center');
    }
    if (state.vaultLoot.spawned && !state.vaultLoot.taken) {
      context.fillStyle = PALETTE.lootGold;
      context.fillRect(state.vaultLoot.x - 14, state.vaultLoot.y - 10, 28, 20);
      context.fillStyle = '#171a21';
      context.fillRect(state.vaultLoot.x - 7, state.vaultLoot.y - 5, 14, 10);
      text(`$${state.vaultLoot.value}`, state.vaultLoot.x, state.vaultLoot.y + 30, 14, PALETTE.lootGold, 'center');
    }

    // Vision cones first (under the figures), then cameras, then guards.
    for (const camera of state.cameras) {
      if (state.crew !== 0) {
        drawCone(camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, PALETTE.cameraCone);
      }
    }
    for (const guard of state.guards) {
      if (guard.ko === 0) {
        drawCone(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, lookout ? PALETTE.coneBright : PALETTE.cone);
      }
    }
    for (const camera of state.cameras) {
      context.fillStyle = state.crew === 0 ? PALETTE.guardKo : PALETTE.camera;
      context.beginPath();
      context.arc(camera.x, camera.y, 9, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(camera.x, camera.y);
      context.lineTo(camera.x + Math.cos(camera.angle) * 16, camera.y + Math.sin(camera.angle) * 16);
      context.stroke();
    }

    // Guards: red figures with a facing tick; knocked-out ones lie grey with a ring.
    for (const guard of state.guards) {
      if (guard.ko > 0) {
        context.fillStyle = PALETTE.guardKo;
        context.beginPath();
        context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = PALETTE.text;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(guard.x, guard.y, GUARD.radius + 4, 0, Math.PI * 2);
        context.stroke();
        text(`${Math.ceil(guard.ko)}s`, guard.x, guard.y - 22, 13, PALETTE.text, 'center');
        continue;
      }
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 6), guard.y + Math.sin(guard.angle) * (GUARD.radius + 6));
      context.stroke();
      if (guard.chasing) {
        text('!', guard.x, guard.y - 22, 20, PALETTE.alarm, 'center');
      }
    }

    // The Lookout's perk: patrol routes drawn on the floor.
    if (lookout) {
      context.strokeStyle = 'rgba(238, 241, 245, 0.25)';
      context.lineWidth = 2;
      context.setLineDash([6, 6]);
      for (const guard of state.guards) {
        const points = guard.waypoints;
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y);
        context.closePath();
        context.stroke();
      }
      context.setLineDash([]);
    }

    // The thief: a hooded figure, drawn as a circle with a mask band.
    const player = state.player;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0d0f14';
    context.fillRect(player.x - 9, player.y - 4, 18, 7);
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left');
    text(targetLabel(`of $${TARGET} to escape`), 24, 50, 16, PALETTE.muted, 'left');
    const seconds = Math.max(0, Math.ceil(state.timeLeft));
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    text(timerLabel(clock), FIELD.width / 2, 18, 26, seconds <= 20 ? PALETTE.alarm : PALETTE.text, 'center');
    // Alarm bar, top-right.
    const barX = FIELD.width - 264;
    context.fillStyle = PALETTE.panel;
    context.fillRect(barX, 22, 200, 18);
    context.fillStyle = state.alarm > 60 ? PALETTE.alarm : PALETTE.alarmOk;
    context.fillRect(barX, 22, 200 * (state.alarm / 100), 18);
    text('ALARM', barX - 10, 20, 20, PALETTE.text, 'right');
    // Lives, bottom-left.
    for (let life = 0; life < LIVES; life += 1) {
      context.fillStyle = life < state.lives ? PALETTE.player : PALETTE.wall;
      context.beginPath();
      context.arc(36 + life * 30, FIELD.height - 28, 10, 0, Math.PI * 2);
      context.fill();
    }
    if (state.crew === 2) {
      text(`Knockouts: ${state.koCharges}`, 110, FIELD.height - 38, 18, PALETTE.text, 'left');
    }
    if (state.messageTimer > 0) {
      text(state.message, FIELD.width / 2, FIELD.height - 64, 20, PALETTE.lootGold, 'center');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.startsWith('> ')) {
        text(line, FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.lootGold, 'center');
      } else {
        text(line, FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
      }
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.lootGold, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, crew) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state, crew === 1);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Sneak in, crack the vault, get out with the loot.',
        'Move with WASD or arrows. Avoid the red cones.',
        'Guards and cameras raise the alarm. At 100, you are caught.',
        '',
        'Pick your crew:',
      ];
      for (let index = 0; index < CREW.length; index += 1) {
        const picked = index === crew;
        lines.push(`${picked ? '> ' : ''}${CREW[index].key}. ${CREW[index].name} — ${CREW[index].perk}`);
      }
      lines.push('');
      lines.push(bestLabel(best));
      drawPanel('Midnight Vault', lines, 'Press 1 / 2 / 3 for crew, Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'Busted',
        ['', finalLabel(state.score), bestLabel(best)],
        'Press Space or click to try again',
      );
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'Clean Getaway',
        [`The vault is empty and the van is gone.`, '', finalLabel(state.score), bestLabel(best)],
        'Press Space or click to run it again',
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
