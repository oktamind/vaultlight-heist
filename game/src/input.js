// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (confirm, pause, coin, smoke, grab) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.
// Mouse position is tracked in playfield coordinates for the coin toss.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_COIN = 4;
export const ACTION_SMOKE = 8;
export const ACTION_GRAB = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas, toField) {
  const keys = new Set();
  let actions = 0;
  let mouse = { x: 640, y: 360 };
  let mouseDown = false;

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = toField(event.clientX - rect.left, event.clientY - rect.top);
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      keys.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyQ') {
      if (!event.repeat) actions |= ACTION_COIN;
    } else if (event.code === 'KeyF') {
      if (!event.repeat) actions |= ACTION_SMOKE;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_GRAB;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', updateMouse);
  canvas.addEventListener('pointerdown', (event) => {
    updateMouse(event);
    mouseDown = true;
    // Left click confirms on menu screens; in play it is unused (coin is Q
    // or right-click). Right click throws a coin toward the cursor.
    if (event.button === 0) actions |= ACTION_CONFIRM;
    if (event.button === 2) actions |= ACTION_COIN;
  });
  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalized {x, y} steering direction, or {0, 0} when idle. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        if (LEFT.has(code)) x -= 1;
        if (RIGHT.has(code)) x += 1;
        if (UP.has(code)) y -= 1;
        if (DOWN.has(code)) y += 1;
      }
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    sneak() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    mouse() {
      return mouse;
    },
    mouseHeld() {
      return mouseDown;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
