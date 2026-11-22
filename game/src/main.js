// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, paused,
// floor clear, game over and win.
// ?seed=N fixes the guard/camera phase. ?shot=start|play|alarm|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_FLOOR, EVENT_HACK, EVENT_LASER, EVENT_PICKUP, EVENT_SMOKE, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_COIN, ACTION_CONFIRM, ACTION_GRAB, ACTION_PAUSE, ACTION_SMOKE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_FLOOR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

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
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let alarmWasOn = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing ${world.state.floorName}. Grab the loot and reach the exit.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.stopAlarm();
    alarmWasOn = false;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Busted. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    audio.stopAlarm();
    alarmWasOn = false;
    audio.win();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Clean getaway! Final score ${world.state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_FLOOR) {
      world.nextFloor();
      screen = SCREEN_PLAY;
      announce(`Playing ${world.state.floorName}.`);
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopAlarm();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    // Tool keys only matter while playing; the world consumes them in step().
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_COIN) world._pendingCoin = true;
      if (actions & ACTION_SMOKE) world._pendingSmoke = true;
      if (actions & ACTION_GRAB) world._pendingGrab = true;
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, 0, input.mouse(), true);
      return;
    }
    // Collect this frame's one-shot tool presses into the world's action flags.
    let actions = 0;
    if (world._pendingCoin) actions |= ACTION_COIN;
    if (world._pendingSmoke) actions |= ACTION_SMOKE;
    if (world._pendingGrab) actions |= ACTION_GRAB;
    world._pendingCoin = false;
    world._pendingSmoke = false;
    world._pendingGrab = false;
    const events = world.step(STEP, input.direction(), input.sneak(), actions, input.mouse(), false);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SMOKE) audio.smoke();
    if (events & EVENT_HACK) audio.hack();
    if (events & EVENT_LASER) audio.laser();
    if (events & EVENT_SPOTTED) announce('Spotted! Break line of sight!');
    if (world.state.spotted && !alarmWasOn) {
      audio.startAlarm();
      alarmWasOn = true;
    } else if (!world.state.spotted && alarmWasOn) {
      audio.stopAlarm();
      alarmWasOn = false;
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      audio.stopAlarm();
      alarmWasOn = false;
      if (world.state.lives <= 0) endGame();
      else announce('Caught! Back to the start.');
    } else if (events & EVENT_WIN) {
      winGame();
    } else if (events & EVENT_FLOOR) {
      screen = SCREEN_FLOOR;
      audio.stopAlarm();
      alarmWasOn = false;
      announce('Floor clear!');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopAlarm();
      announce('Paused.');
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
  });

  announce('Vaultlight. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
