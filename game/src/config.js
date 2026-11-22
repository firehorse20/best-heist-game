// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.
// Top-down stealth heist: sneak past guards and cameras, crack the vault, grab the loot,
// reach the getaway van with at least TARGET dollars before the clock runs out.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 260,
  speedLookout: 300,
};

export const LIVES = 3;

/** Seconds on the clock for the whole job. */
export const TIME_LIMIT = 120;

/** Dollars of loot needed before the getaway counts as a clean escape. */
export const TARGET = 500;

/** Alarm 0..100: seen it rises, hidden it falls; at 100 the crew is caught. */
export const ALARM = { rise: 60, fall: 25, hackerRise: 0.7 };

export const VAULT = {
  x: 1120,
  y: 130,
  radius: 46,
  crackRadius: 78,
  crackSeconds: 3,
  goldValue: 400,
};

/** The getaway zone, bottom-right: stand in it with TARGET dollars to win. */
export const EXIT = { x: 1120, y: 620, width: 150, height: 80 };

export const SPAWN = { x: 90, y: 620 };

export const GUARD = {
  radius: 15,
  patrolSpeed: 92,
  chaseSpeed: 145,
  viewRange: 230,
  viewHalfAngle: (35 * Math.PI) / 180,
  loseSight: 1.5,
  koSeconds: 8,
};

export const CAMERA = {
  range: 260,
  halfAngle: (30 * Math.PI) / 180,
  sweep: (55 * Math.PI) / 180,
  period: 4,
};

/** Walls are solid rectangles (x, y, width, height). The vault room is the box top-right
 * with a door gap in its left wall (y 130..180); the rest are gallery cover. */
export const WALLS = [
  // Vault room: top, bottom, right, left wall in two parts leaving the door gap.
  { x: 960, y: 40, w: 280, h: 16 },
  { x: 960, y: 244, w: 280, h: 16 },
  { x: 1224, y: 40, w: 16, h: 220 },
  { x: 960, y: 40, w: 16, h: 90 },
  { x: 960, y: 180, w: 16, h: 80 },
  // Gallery cover.
  { x: 300, y: 200, w: 180, h: 24 },
  { x: 300, y: 480, w: 180, h: 24 },
  { x: 700, y: 420, w: 24, h: 160 },
  { x: 520, y: 110, w: 24, h: 140 },
  { x: 760, y: 90, w: 150, h: 24 },
];

/** Gallery loot spots (values are jittered by the seed). */
export const LOOT_SPOTS = [
  { x: 200, y: 150, value: 50, kind: 'cash' },
  { x: 420, y: 330, value: 75, kind: 'gem' },
  { x: 620, y: 250, value: 50, kind: 'cash' },
  { x: 380, y: 560, value: 100, kind: 'gem' },
  { x: 640, y: 560, value: 75, kind: 'cash' },
  { x: 860, y: 330, value: 100, kind: 'gem' },
];

/** Guard patrol loops; every leg is clear of walls. */
export const PATROLS = [
  [
    { x: 250, y: 350 },
    { x: 680, y: 350 },
  ],
  [
    { x: 860, y: 320 },
    { x: 860, y: 600 },
  ],
  [
    { x: 620, y: 150 },
    { x: 920, y: 150 },
  ],
];

/** Fixed security cameras: position, the angle they face at rest, sweep and phase. */
export const CAMERAS = [
  { x: 640, y: 76, base: Math.PI / 2, phase: 0 },
  { x: 1100, y: 470, base: -Math.PI / 2, phase: 2.1 },
];

/** The crew pick on the title screen: one perk each, chosen before the job starts. */
export const CREW = [
  { key: '1', name: 'Ghost the Hacker', perk: 'Cameras offline, alarm rises 30% slower' },
  { key: '2', name: 'Eagle the Lookout', perk: 'Moves 15% faster, sees patrol routes' },
  { key: '3', name: 'Bull the Muscle', perk: 'Press E near a guard to knock them out (2 charges)' },
];

export const PALETTE = {
  backdrop: '#0d0f14',
  floor: '#171a21',
  floorAlt: '#1b1f29',
  wall: '#3a4152',
  wallTop: '#4d566e',
  vault: '#8a6d1f',
  vaultDoor: '#c9a227',
  exit: '#1d5c33',
  exitEdge: '#37c978',
  lootCash: '#7ee787',
  lootGem: '#58a6ff',
  lootGold: '#f2c94c',
  player: '#4fc3f7',
  guard: '#e5534b',
  guardKo: '#7a828e',
  cone: 'rgba(229, 83, 75, 0.20)',
  coneBright: 'rgba(229, 83, 75, 0.30)',
  camera: '#f0883e',
  cameraCone: 'rgba(240, 136, 62, 0.18)',
  panel: '#252b38',
  text: '#eef1f5',
  muted: '#8b93a3',
  alarm: '#e5534b',
  alarmOk: '#37c978',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-vault.best';
