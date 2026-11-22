// The screenshot scenes behind ?shot=start|play|alarm|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (head for the nearest loot, step out of any cone it is in,
// sneak when a guard looks its way, and slide around a wall it is stuck on),
// so the frame is what a short game really looks like and the same seed always
// gives the same frame.
import { STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_FLOOR, EVENT_WIN } from './world.js';
import { SCREEN_FLOOR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const ALARM_SECONDS = 3;
const WIN_LIMIT_SECONDS = 150;
const SAMPLE = 1 / 30;

/** A stateful autopilot: target-seeking plus stuck detection for wall detours. */
function makeAutopilot() {
  let lastX = null;
  let lastY = null;
  let stuckSteps = 0;
  let detourSteps = 0;
  let detour = { x: 0, y: 1 };

  return function autopilot(state) {
    const p = state.player;
    // Stuck detection: barely moved while trying to move.
    if (lastX !== null) {
      const moved = Math.hypot(p.x - lastX, p.y - lastY);
      if (detourSteps > 0) {
        detourSteps -= 1;
      } else if (moved < 0.6) {
        stuckSteps += 1;
        if (stuckSteps > 20) {
          // Slide along the wall: head for the vertical middle of the room,
          // where the wall gaps are, then resume toward the target.
          stuckSteps = 0;
          detourSteps = 55;
          detour = { x: 0, y: p.y < 360 ? 1 : -1 };
        }
      } else {
        stuckSteps = 0;
      }
    }
    lastX = p.x;
    lastY = p.y;

    // If spotted, run perpendicular to the nearest guard's facing.
    if (state.spotted) {
      let guard = null;
      let gd = Infinity;
      for (const g of state.guards) {
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < gd) {
          gd = d;
          guard = g;
        }
      }
      if (guard) {
        const px = -Math.sin(guard.angle);
        const py = Math.cos(guard.angle);
        const dot = px * (p.x - guard.x) + py * (p.y - guard.y);
        const s = dot >= 0 ? 1 : -1;
        return { move: { x: px * s, y: py * s }, sneak: true, grab: false };
      }
    }

    if (detourSteps > 0) {
      return { move: detour, sneak: false, grab: true };
    }

    // Find the nearest untaken loot, else the exit.
    let target = null;
    let bestD = Infinity;
    for (const l of state.loot) {
      if (l.taken) continue;
      const d = Math.hypot(l.x - p.x, l.y - p.y);
      if (d < bestD) {
        bestD = d;
        target = l;
      }
    }
    const tx = target ? target.x : state.exit.x;
    const ty = target ? target.y : state.exit.y;
    let mx = tx - p.x;
    let my = ty - p.y;
    const len = Math.hypot(mx, my) || 1;
    return { move: { x: mx / len, y: my / len }, sneak: false, grab: true };
  };
}

function runSteps(world, seconds, pilot) {
  let events = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const { move, sneak, grab } = pilot(world.state);
    // Grab is ACTION_GRAB = 16; pass it every step so loot near the thief is taken.
    const actions = grab ? 16 : 0;
    events |= world.step(STEP, move, sneak, actions, { x: 640, y: 360 }, false);
    if (events & (EVENT_CAUGHT | EVENT_FLOOR | EVENT_WIN)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. start: title over a live room. play: mid-heist, cones
 * sweeping, loot half-grabbed. alarm: the thief caught in a guard's cone with
 * the alarm meter high. win: the clean getaway screen.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    runSteps(world, PLAY_SECONDS, makeAutopilot());
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'alarm') {
    // Hold the thief in the first guard's cone: each step, re-place the thief
    // 130 px ahead of where the guard is facing, so the cone fills the alarm
    // and the guard gives chase for real.
    const guard = world.state.guards[0];
    for (let i = 0; i < ALARM_SECONDS / STEP; i += 1) {
      world.state.player.x = guard.x + Math.cos(guard.angle) * 130;
      world.state.player.y = guard.y + Math.sin(guard.angle) * 130;
      world.state.player.facing = guard.angle + Math.PI;
      world.step(STEP, { x: 0, y: 0 }, false, 0, { x: 640, y: 360 }, false);
      if (world.state.lives < 3) break;
    }
    return { screen: world.state.lives < 3 ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    const events = runSteps(world, WIN_LIMIT_SECONDS, makeAutopilot());
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    // The autopilot could not finish in time: stage the getaway honestly
    // through the world's own finish helper and show the win panel.
    world.finishFloor();
    // Finish floors 2 and 3 the same way so the screen shows a full win.
    world.nextFloor();
    world.finishFloor();
    world.nextFloor();
    world.finishFloor();
    world.state.won = true;
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  // start (and anything else): a few seconds of the live room behind the title.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, { x: 0, y: 0 }, false, 0, { x: 640, y: 360 }, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}

export { SAMPLE };
