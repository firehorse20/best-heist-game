// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title (with the crew pick), play, paused, game over and win.
//
// ?seed=N fixes the loot values. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, SPAWN, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_CAUGHT, EVENT_CRACK, EVENT_KO, EVENT_LOOT, EVENT_OVER, EVENT_WIN,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_CREW_1, ACTION_CREW_2, ACTION_CREW_3, ACTION_KO, ACTION_PAUSE,
  createInput,
} from './input.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const world = createWorld(createRandom(seed), 0);
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.state.crew);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let crew = 0;
  let world = createWorld(createRandom(seed), crew);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each catch.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world = createWorld(createRandom(seed), crew);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Crack the vault, take $500, reach the getaway.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `Clean getaway. Take $${world.state.score}. Best $${best}.`
      : `Busted. Take $${world.state.score}. Best $${best}.`);
  }

  function handleCaught() {
    world.state.lives -= 1;
    if (world.state.lives <= 0) {
      endGame(false);
      return;
    }
    world.state.alarm = 0;
    world.state.player.x = SPAWN.x;
    world.state.player.y = SPAWN.y;
    for (const guard of world.state.guards) {
      guard.x = guard.waypoints[0].x;
      guard.y = guard.waypoints[0].y;
      guard.wp = 1;
      guard.chasing = false;
      guard.ko = 0;
      guard.lost = 0;
    }
    announce(`Caught. ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left. Back to the entrance.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CREW_1) crew = 0;
      else if (actions & ACTION_CREW_2) crew = 1;
      else if (actions & ACTION_CREW_3) crew = 2;
      if (actions & ACTION_CONFIRM) startGame();
      return actions;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(knockout) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    const events = world.step(STEP, input.direction(), knockout, false);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_CAUGHT) handleCaught();
    else if (events & EVENT_CRACK) announce('Vault cracked. Grab the gold.');
    else if (events & EVENT_KO) announce('Guard down.');
    else if (events & EVENT_LOOT) announce(`Take $${world.state.score}.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    let knockout = Boolean(actions & ACTION_KO);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(knockout);
        knockout = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, crew);
  }

  // Leaving the tab pauses a running game rather than letting the clock run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Midnight Vault. Pick a crew with 1, 2 or 3, then press Space to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
