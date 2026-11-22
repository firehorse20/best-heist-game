// Keyboard and pointer input. Held keys give a steering vector; one-shot presses (start or
// restart, pause, crew pick, knockout) are queued as bit flags and taken once by the loop, so
// a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CREW_1 = 4;
export const ACTION_CREW_2 = 8;
export const ACTION_CREW_3 = 16;
export const ACTION_KO = 32;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CREW_KEYS = new Map([
  ['Digit1', ACTION_CREW_1],
  ['Digit2', ACTION_CREW_2],
  ['Digit3', ACTION_CREW_3],
]);
const KO = new Set(['KeyE']);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (CREW_KEYS.has(event.code)) {
      if (!event.repeat) actions |= CREW_KEYS.get(event.code);
    } else if (KO.has(event.code)) {
      if (!event.repeat) actions |= ACTION_KO;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The steering vector: -1..1 on each axis (0, 0 for neither or both). */
    direction() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
