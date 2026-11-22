// The game's rules and state, with no drawing and no browser in it: the thief,
// guards, cameras, lasers, loot, terminals, alarm and tools. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react
// (sounds, announcements) without the world knowing about screens or sound.
// Detection is a vision cone plus line of sight: a guard or camera only sees
// the thief when the thief is inside its cone range and angle AND no wall sits
// between them. Nothing here allocates after createWorld returns.
import { ALARM, CAMERA, FLOORS, GUARD, PLAYER, TOOLS } from './config.js';
import { LEVELS as LEVEL_DEFS } from './levels.js';

export const EVENT_COIN = 1;
export const EVENT_PICKUP = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_FLOOR = 8;
export const EVENT_WIN = 16;
export const EVENT_SMOKE = 32;
export const EVENT_HACK = 64;
export const EVENT_LASER = 128;
export const EVENT_SPOTTED = 256;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** True when segment (x1,y1)-(x2,y2) hits rectangle r. */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Circle (x,y,r) pushed out of every wall rect; returns corrected position. */
function collideWalls(x, y, r, walls) {
  for (const w of walls) {
    const cx = clamp(x, w.x, w.x + w.w);
    const cy = clamp(y, w.y, w.y + w.h);
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 === 0) {
      // Centre inside the wall: push out along the smallest penetration.
      const left = x - w.x;
      const right = w.x + w.w - x;
      const top = y - w.y;
      const bottom = w.y + w.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = w.x - r;
      else if (m === right) x = w.x + w.w + r;
      else if (m === top) y = w.y - r;
      else y = w.y + w.h + r;
      continue;
    }
    const d = Math.sqrt(d2);
    x = cx + (dx / d) * r;
    y = cy + (dy / d) * r;
  }
  return { x, y };
}

export function createWorld(random) {
  const state = {
    floorIndex: 0,
    floorName: '',
    player: { x: 0, y: 0, facing: 0, sneak: false, moving: false },
    guards: [],
    cameras: [],
    loot: [],
    terminals: [],
    lasers: [],
    walls: [],
    exit: { x: 0, y: 0, label: '' },
    coins: [],
    alarm: 0,
    lives: 3,
    score: 0,
    lootValue: 0,
    lootTaken: 0,
    lootTotal: 0,
    floorTime: 0,
    totalTime: 0,
    coinsLeft: TOOLS.coins,
    smokeLeft: TOOLS.smoke,
    smokeTimer: 0,
    camerasDisabled: 0,
    hackProgress: 0,
    hacking: false,
    spotted: false,
    message: '',
    messageTimer: 0,
    caughtFlash: 0,
    floorClear: false,
    won: false,
  };

  function loadFloor(index) {
    const def = LEVEL_DEFS[index];
    state.floorIndex = index;
    state.floorName = def.name;
    state.walls = def.walls;
    state.exit = { ...def.exit };
    state.player.x = def.start.x;
    state.player.y = def.start.y;
    state.player.facing = 0;
    state.guards = def.guards.map((g) => ({
      waypoints: g.waypoints,
      pause: g.pause,
      x: g.waypoints[0][0],
      y: g.waypoints[0][1],
      angle: 0,
      target: 1,
      wait: 0,
      mode: 'patrol', // patrol | chase | investigate
      modeTimer: 0,
      investigate: { x: 0, y: 0 },
      alerted: false,
    }));
    state.cameras = def.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.baseAngle,
      arc: c.arc,
      phase: random() * TAU,
      angle: c.baseAngle,
    }));
    state.loot = def.loot.map((l) => ({ ...l, taken: false }));
    state.lootTotal = def.loot.length;
    state.lootTaken = 0;
    state.terminals = def.terminals.map((t) => ({ ...t }));
    state.lasers = def.lasers.map((l) => ({ ...l }));
    state.coins = [];
    state.alarm = 0;
    state.floorTime = 0;
    state.coinsLeft = TOOLS.coins;
    state.smokeLeft = TOOLS.smoke;
    state.smokeTimer = 0;
    state.camerasDisabled = 0;
    state.hackProgress = 0;
    state.hacking = false;
    state.spotted = false;
    state.floorClear = false;
    state.message = '';
    state.messageTimer = 0;
  }

  function reset() {
    state.lives = 3;
    state.score = 0;
    state.lootValue = 0;
    state.totalTime = 0;
    state.won = false;
    loadFloor(0);
  }

  function say(text, seconds = 2.2) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function seesThief(ox, oy, angle, range, halfAngle) {
    const p = state.player;
    const d = dist(ox, oy, p.x, p.y);
    if (d > range) return false;
    if (Math.abs(angleDiff(Math.atan2(p.y - oy, p.x - ox), angle)) > halfAngle) return false;
    for (const w of state.walls) {
      if (segmentHitsRect(ox, oy, p.x, p.y, w)) return false;
    }
    return true;
  }

  function nearestLoot() {
    let best = null;
    let bestD = Infinity;
    for (const l of state.loot) {
      if (l.taken) continue;
      const d = dist(state.player.x, state.player.y, l.x, l.y);
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best && bestD <= PLAYER.grabRange ? best : null;
  }

  function nearestTerminal() {
    let best = null;
    let bestD = Infinity;
    for (const t of state.terminals) {
      const d = dist(state.player.x, state.player.y, t.x, t.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best && bestD <= PLAYER.grabRange ? best : null;
  }

  function allLootTaken() {
    return state.lootTaken >= state.lootTotal;
  }

  function caught(byTouch) {
    state.lives -= 1;
    state.lastCaughtBy = byTouch ? 'touch' : 'alarm';
    state.alarm = ALARM.respawnAt;
    state.caughtFlash = 1;
    state.smokeTimer = 0;
    for (const g of state.guards) {
      g.mode = 'patrol';
      g.alerted = false;
      g.modeTimer = 0;
    }
    state.player.x = LEVEL_DEFS[state.floorIndex].start.x;
    state.player.y = LEVEL_DEFS[state.floorIndex].start.y;
    if (state.lives <= 0) return EVENT_CAUGHT;
    say('CAUGHT! The guards drag you back to the start.', 2.6);
    return EVENT_CAUGHT;
  }

  /**
   * One fixed step.
   * move: {x, y} normalized direction. sneak: boolean. actions: bit flags
   * (ACTION_COIN / ACTION_SMOKE / ACTION_GRAB from input.js). mouse: playfield
   * point for the coin toss. harmless: title-screen backdrop (nothing scores,
   * nothing catches).
   */
  function step(dt, move, sneak, actions, mouse, harmless) {
    let events = 0;
    const p = state.player;
    state.totalTime += dt;
    if (!state.floorClear) state.floorTime += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.caughtFlash > 0) state.caughtFlash = Math.max(0, state.caughtFlash - dt * 1.4);
    if (state.smokeTimer > 0) state.smokeTimer -= dt;
    if (state.camerasDisabled > 0) state.camerasDisabled -= dt;

    // --- Player movement (walls + bounds, sneak is slower but quieter). ---
    const speed = sneak ? PLAYER.sneakSpeed : PLAYER.speed;
    p.sneak = sneak;
    p.moving = move.x !== 0 || move.y !== 0;
    if (p.moving) {
      p.facing = Math.atan2(move.y, move.x);
      const nx = clamp(p.x + move.x * speed * dt, 24, 1256);
      const ny = clamp(p.y + move.y * speed * dt, 80, 696);
      const fixed = collideWalls(nx, ny, PLAYER.radius, state.walls);
      p.x = fixed.x;
      p.y = fixed.y;
    }

    // --- Tools. ---
    if (!harmless && actions & 4 && state.coinsLeft > 0) {
      // ACTION_COIN = 4. Toss toward the mouse, capped at coin range.
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const r = Math.min(d, PLAYER.coinRange);
      const cx = p.x + (dx / d) * r;
      const cy = p.y + (dy / d) * r;
      state.coins.push({ x: cx, y: cy, timer: 3.2 });
      state.coinsLeft -= 1;
      events |= EVENT_COIN;
      say('Coin tossed — the guards go to look.', 1.6);
      for (const g of state.guards) {
        if (dist(g.x, g.y, cx, cy) < 260) {
          g.mode = 'investigate';
          g.investigate = { x: cx, y: cy };
          g.modeTimer = GUARD.investigateSeconds;
          g.alerted = false;
        }
      }
    }
    if (!harmless && actions & 8 && state.smokeLeft > 0) {
      // ACTION_SMOKE = 8.
      state.smokeLeft -= 1;
      state.smokeTimer = TOOLS.smokeSeconds;
      events |= EVENT_SMOKE;
      say('Smoke! Guards and cameras are blind for a moment.', 1.8);
      for (const g of state.guards) {
        g.mode = 'patrol';
        g.alerted = false;
        g.modeTimer = 0;
      }
    }

    // --- Loot grab / terminal hack (hold E near it; hack needs a full channel). ---
    const loot = nearestLoot();
    const term = state.camerasDisabled <= 0 ? nearestTerminal() : null;
    state.hacking = false;
    if (!harmless && actions & 16 && loot) {
      // ACTION_GRAB = 16.
      loot.taken = true;
      state.lootTaken += 1;
      state.lootValue += loot.value;
      state.score += loot.value;
      events |= EVENT_PICKUP;
      say(`${loot.label} pocketed — $${loot.value.toLocaleString('en-US')}.`, 2.0);
      if (allLootTaken()) say('All loot grabbed! Get to the exit!', 2.6);
    }
    if (!harmless && actions & 16 && !loot && term) {
      // Three taps of E at a terminal kill the cameras (a channel in presses,
      // so the player must stand exposed at the terminal to do it).
      state.hackProgress += 0.7;
      state.hacking = true;
      if (state.hackProgress >= TOOLS.hackSeconds) {
        state.hackProgress = 0;
        state.camerasDisabled = CAMERA.disabledSeconds;
        events |= EVENT_HACK;
        say(`Cameras down for ${CAMERA.disabledSeconds}s!`, 2.2);
      }
    } else if (!term) {
      state.hackProgress = Math.max(0, state.hackProgress - dt * 2);
    }

    // --- Coins fade. ---
    for (let i = state.coins.length - 1; i >= 0; i -= 1) {
      state.coins[i].timer -= dt;
      if (state.coins[i].timer <= 0) state.coins.splice(i, 1);
    }

    // --- Cameras sweep. ---
    for (const c of state.cameras) {
      c.phase += dt * CAMERA.sweepSpeed;
      c.angle = c.baseAngle + Math.sin(c.phase) * c.arc;
    }

    // --- Guards patrol / chase / investigate. ---
    for (const g of state.guards) {
      if (g.modeTimer > 0) g.modeTimer -= dt;
      let tx;
      let ty;
      let spd = GUARD.patrolSpeed;
      if (g.mode === 'chase') {
        tx = p.x;
        ty = p.y;
        spd = GUARD.chaseSpeed;
        if (g.modeTimer <= 0) {
          g.mode = 'patrol';
          g.alerted = false;
        }
      } else if (g.mode === 'investigate') {
        tx = g.investigate.x;
        ty = g.investigate.y;
        spd = GUARD.investigateSpeed;
        if (g.modeTimer <= 0 || dist(g.x, g.y, tx, ty) < 12) {
          g.mode = 'patrol';
          g.modeTimer = 0;
        }
      } else {
        const wp = g.waypoints[g.target];
        tx = wp[0];
        ty = wp[1];
        if (g.wait > 0) {
          g.wait -= dt;
        } else if (dist(g.x, g.y, tx, ty) < 10) {
          g.target = (g.target + 1) % g.waypoints.length;
          g.wait = g.pause;
        }
      }
      if (g.wait <= 0) {
        const d = dist(g.x, g.y, tx, ty);
        if (d > 1) {
          const stepLen = Math.min(d, spd * dt);
          g.x += ((tx - g.x) / d) * stepLen;
          g.y += ((ty - g.y) / d) * stepLen;
          g.angle = Math.atan2(ty - g.y, tx - g.x);
        }
      }
    }

    // --- Lasers blink; crossing a live beam spikes the alarm. ---
    for (const l of state.lasers) {
      const cycle = (state.floorTime + l.phase) % l.period;
      l.on = cycle < l.period * l.onFraction;
      if (!l.on || harmless) continue;
      // Distance from player centre to the beam segment.
      const dx = l.x2 - l.x1;
      const dy = l.y2 - l.y1;
      const len2 = dx * dx + dy * dy;
      const t = clamp(((p.x - l.x1) * dx + (p.y - l.y1) * dy) / len2, 0, 1);
      const bx = l.x1 + dx * t;
      const by = l.y1 + dy * t;
      if (dist(p.x, p.y, bx, by) < PLAYER.radius + 4) {
        state.alarm = Math.min(ALARM.caughtAt, state.alarm + ALARM.laserHit);
        l.on = false; // beam trips once, then re-arms next cycle
        events |= EVENT_LASER;
        say('Laser tripped! Alarm spiking!', 1.8);
      }
    }

    // --- Detection: guards and cameras fill the alarm while they see the thief. ---
    let seen = false;
    let seenRate = 0;
    const blinded = state.smokeTimer > 0;
    if (!harmless && !blinded) {
      for (const g of state.guards) {
        if (seesThief(g.x, g.y, g.angle, GUARD.coneRange, GUARD.coneHalfAngle)) {
          seen = true;
          seenRate += ALARM.guardRate * (sneak ? 0.5 : 1);
          if (!g.alerted) {
            g.alerted = true;
            g.mode = 'chase';
            g.modeTimer = GUARD.alertSeconds;
            events |= EVENT_SPOTTED;
            say('SPOTTED! Break line of sight!', 1.6);
          } else if (g.mode !== 'chase') {
            g.mode = 'chase';
            g.modeTimer = GUARD.alertSeconds;
          }
        }
      }
      if (state.camerasDisabled <= 0) {
        for (const c of state.cameras) {
          if (seesThief(c.x, c.y, c.angle, CAMERA.coneRange, CAMERA.coneHalfAngle)) {
            seen = true;
            seenRate += ALARM.cameraRate * (sneak ? 0.5 : 1);
          }
        }
      }
    }
    state.spotted = seen;
    if (seen) {
      const mult = loot ? ALARM.grabSeenBonus : 1;
      state.alarm = Math.min(ALARM.caughtAt, state.alarm + seenRate * mult * dt);
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    }

    // --- Caught: alarm maxed, or a guard touches the thief. ---
    if (!harmless) {
      let touched = false;
      for (const g of state.guards) {
        if (dist(g.x, g.y, p.x, p.y) < GUARD.touchRadius + PLAYER.radius) touched = true;
      }
      if (state.alarm >= ALARM.caughtAt || touched) {
        events |= caught(touched);
        if (state.lives <= 0) return events;
      }
    }

    // --- Exit: only open once every loot on the floor is taken. ---
    if (!harmless && !state.floorClear && allLootTaken()) {
      if (dist(p.x, p.y, state.exit.x, state.exit.y) < 46) {
        const par = LEVEL_DEFS[state.floorIndex].parSeconds;
        const bonus = Math.max(0, Math.round((par - state.floorTime) * 10));
        state.score += bonus;
        state.floorClear = true;
        if (state.floorIndex + 1 >= FLOORS) {
          state.won = true;
          events |= EVENT_WIN;
        } else {
          events |= EVENT_FLOOR;
          say(`Floor clear! Time bonus +$${bonus}.`, 2.4);
        }
      }
    }
    return events;
  }

  function nextFloor() {
    if (state.floorIndex + 1 < FLOORS) loadFloor(state.floorIndex + 1);
  }

  /** Shot helper: finish the current floor as if the player just escaped. */
  function finishFloor() {
    for (const l of state.loot) {
      if (!l.taken) {
        l.taken = true;
        state.lootTaken += 1;
        state.lootValue += l.value;
        state.score += l.value;
      }
    }
    state.player.x = state.exit.x;
    state.player.y = state.exit.y;
    state.floorClear = true;
  }

  reset();
  return { state, reset, step, loadFloor, nextFloor, finishFloor, nearestLoot, nearestTerminal, allLootTaken };
}
