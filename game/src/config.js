// Vaultlight — a quiet heist. Every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 215,
  sneakSpeed: 95,
  grabRange: 52,
  coinRange: 340,
};

export const LIVES = 3;

export const ALARM = {
  guardRate: 50, // per second while a guard sees the thief
  cameraRate: 36, // per second while a camera sees the thief
  laserHit: 20, // instant jump when a laser beam is crossed
  grabSeenBonus: 1.5, // multiplier while grabbing loot in sight
  decay: 9, // per second while unseen
  caughtAt: 100,
  respawnAt: 38, // alarm left after being caught
};

export const GUARD = {
  patrolSpeed: 78,
  chaseSpeed: 205, // slower than the thief's run (215), faster than a sneak (95):
  // a spotted thief can outrun the guard in the open, but must still break
  // line of sight — the chase only lasts a few seconds.
  investigateSpeed: 130,
  coneRange: 245,
  coneHalfAngle: 0.56, // ~32 degrees each side
  touchRadius: 22,
  alertSeconds: 3.2,
  investigateSeconds: 3.0,
};

export const CAMERA = {
  coneRange: 305,
  coneHalfAngle: 0.5,
  sweepSpeed: 0.55, // radians per second
  sweepArc: 1.15,
  disabledSeconds: 15,
};

export const TOOLS = {
  coins: 3, // coin tosses per floor
  smoke: 2, // smoke bombs per floor
  smokeRadius: 270,
  smokeSeconds: 4,
  hackSeconds: 2.0, // hold E at a terminal to kill the cameras
};

export const FLOORS = 3;

export const PALETTE = {
  backdrop: '#0b0d12',
  floorA: '#232733',
  floorB: '#1e222c',
  rug: '#3a2430',
  rugEdge: '#6b3a4a',
  wall: '#4a5068',
  wallTop: '#7d86a8',
  door: '#8a6d3b',
  exit: '#37d67a',
  player: '#e8c15a',
  playerSneak: '#c9a13b',
  guard: '#e5534b',
  guardAlert: '#ff2d55',
  camera: '#ff9f43',
  cone: 'rgba(255, 214, 90, 0.20)',
  coneAlert: 'rgba(255, 45, 85, 0.30)',
  coneCamera: 'rgba(255, 159, 67, 0.16)',
  loot: '#ffd94d',
  lootTaken: '#5c6478',
  terminal: '#4fc3f7',
  laser: '#ff3b5c',
  smoke: 'rgba(200, 205, 215, 0.35)',
  panel: '#171a23',
  panelEdge: '#3a4157',
  text: '#eef1f5',
  muted: '#9aa1b5',
  alarmLow: '#37d67a',
  alarmMid: '#ffb020',
  alarmHigh: '#ff2d55',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'vaultlight.best';
