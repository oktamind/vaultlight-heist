// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Canvas shapes and text only — every sprite is drawn,
// nothing is loaded, so the game makes no network request. The alarm meter, the
// loot list, the tools and the floor name sit in the HUD bar; the room, guards
// with their vision cones, cameras, loot and exit are all in the one frame.
import { ALARM, CAMERA, FIELD, FONT, GUARD, LIVES, PALETTE, TOOLS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_FLOOR = 'floor';

const PANEL = { width: 640, top: 150, line: 32, bottom: 64 };
const TAU = Math.PI * 2;

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
  const scoreLabel = cachedLabel('SCORE $');
  const timeLabel = cachedLabel('');

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

  /** Convert CSS pixels on the canvas to playfield coordinates. */
  function toField(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (clientX * ratio - view.x) / view.scale,
      y: (clientY * ratio - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, TAU);
    context.fill();
  }

  function cone(x, y, angle, range, halfAngle, color) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fill();
  }

  function drawFloor(state) {
    // Marble checker.
    const tile = 64;
    for (let ty = 0; ty < FIELD.height / tile; ty += 1) {
      for (let tx = 0; tx < FIELD.width / tile; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * tile, ty * tile, tile, tile);
      }
    }
    // Rugs mark the side-gallery route.
    context.fillStyle = PALETTE.rug;
    context.fillRect(880, 440, 300, 170);
    context.strokeStyle = PALETTE.rugEdge;
    context.lineWidth = 4;
    context.strokeRect(888, 448, 284, 154);
    context.fillRect(120, 440, 220, 170);
    context.strokeRect(128, 448, 204, 154);

    // Exit door: green pad with a label, glowing once all loot is taken.
    const exit = state.exit;
    const open = state.lootTaken >= state.lootTotal;
    context.fillStyle = open ? PALETTE.exit : PALETTE.door;
    context.fillRect(exit.x - 34, exit.y - 26, 68, 52);
    context.strokeStyle = open ? '#b8ffce' : '#5c4a26';
    context.lineWidth = 3;
    context.strokeRect(exit.x - 34, exit.y - 26, 68, 52);
    text(open ? 'EXIT OPEN' : 'EXIT', exit.x, exit.y - 34, 15, open ? PALETTE.exit : PALETTE.muted, 'center', 'bold');
    text(exit.label, exit.x, exit.y + 46, 12, PALETTE.muted, 'center');

    // Terminals.
    for (const t of state.terminals) {
      context.fillStyle = PALETTE.terminal;
      context.fillRect(t.x - 16, t.y - 12, 32, 24);
      context.strokeStyle = '#bfe9ff';
      context.lineWidth = 2;
      context.strokeRect(t.x - 16, t.y - 12, 32, 24);
      text('HACK', t.x, t.y - 18, 12, PALETTE.terminal, 'center', 'bold');
    }

    // Lasers.
    for (const l of state.lasers) {
      if (!l.on) continue;
      context.strokeStyle = PALETTE.laser;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(l.x1, l.y1);
      context.lineTo(l.x2, l.y2);
      context.stroke();
      circle(l.x1, l.y1, 5, PALETTE.laser);
      circle(l.x2, l.y2, 5, PALETTE.laser);
    }

    // Walls with a lit top edge.
    for (const w of state.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(w.x, w.y, w.w, w.h);
      context.fillStyle = PALETTE.wallTop;
      if (w.h <= 20) context.fillRect(w.x, w.y, w.w, 4);
      else context.fillRect(w.x, w.y, w.w, 4);
    }

    // Loot: pedestal + glowing item, dimmed once taken.
    for (const l of state.loot) {
      context.fillStyle = '#39415a';
      context.fillRect(l.x - 18, l.y - 14, 36, 28);
      if (l.taken) {
        context.fillStyle = PALETTE.lootTaken;
        context.fillRect(l.x - 10, l.y - 8, 20, 16);
        continue;
      }
      // Glow ring so loot reads at a glance.
      context.strokeStyle = 'rgba(255, 217, 77, 0.55)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(l.x, l.y, 24 + Math.sin(state.totalTime * 3) * 2, 0, TAU);
      context.stroke();
      if (l.kind === 'gem') {
        context.fillStyle = PALETTE.loot;
        context.beginPath();
        context.moveTo(l.x, l.y - 13);
        context.lineTo(l.x + 11, l.y);
        context.lineTo(l.x, l.y + 13);
        context.lineTo(l.x - 11, l.y);
        context.closePath();
        context.fill();
      } else if (l.kind === 'painting') {
        context.fillStyle = '#c96a3b';
        context.fillRect(l.x - 13, l.y - 10, 26, 20);
        context.strokeStyle = '#ffd94d';
        context.lineWidth = 2;
        context.strokeRect(l.x - 13, l.y - 10, 26, 20);
      } else if (l.kind === 'gold') {
        context.fillStyle = PALETTE.loot;
        context.fillRect(l.x - 12, l.y - 7, 24, 14);
        context.fillStyle = '#b8860b';
        context.fillRect(l.x - 12, l.y - 7, 24, 4);
      } else {
        // statue
        context.fillStyle = '#d8dee9';
        context.beginPath();
        context.arc(l.x, l.y - 4, 8, 0, TAU);
        context.fill();
        context.fillRect(l.x - 9, l.y + 2, 18, 10);
      }
      text(l.label, l.x, l.y - 30, 12, PALETTE.text, 'center');
    }

    // Thrown coins.
    for (const c of state.coins) {
      circle(c.x, c.y, 7, PALETTE.loot);
      context.strokeStyle = '#fff3c4';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(c.x, c.y, 11, 0, TAU);
      context.stroke();
    }
  }

  function drawCones(state) {
    // Cameras first (dimmer), then guards, so an alerted guard reads loudest.
    for (const c of state.cameras) {
      if (state.camerasDisabled > 0) continue;
      cone(c.x, c.y, c.angle, CAMERA.coneRange, CAMERA.coneHalfAngle, PALETTE.coneCamera);
    }
    for (const g of state.guards) {
      cone(g.x, g.y, g.angle, GUARD.coneRange, GUARD.coneHalfAngle, g.alerted ? PALETTE.coneAlert : PALETTE.cone);
    }
  }

  function drawActors(state) {
    // Cameras: wall mount + lens.
    for (const c of state.cameras) {
      const dead = state.camerasDisabled > 0;
      circle(c.x, c.y, 10, dead ? '#5c6478' : PALETTE.camera);
      context.strokeStyle = dead ? '#5c6478' : PALETTE.camera;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(c.x, c.y);
      context.lineTo(c.x + Math.cos(c.angle) * 20, c.y + Math.sin(c.angle) * 20);
      context.stroke();
      if (dead) text('OFF', c.x, c.y - 16, 11, PALETTE.muted, 'center', 'bold');
    }

    // Guards: red body, facing tick, "!" when alerted.
    for (const g of state.guards) {
      circle(g.x, g.y, 16, g.alerted ? PALETTE.guardAlert : PALETTE.guard);
      context.strokeStyle = '#ffd9dc';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(g.x, g.y);
      context.lineTo(g.x + Math.cos(g.angle) * 22, g.y + Math.sin(g.angle) * 22);
      context.stroke();
      circle(g.x, g.y, 5, '#7a1214');
      if (g.alerted) text('!', g.x, g.y - 24, 22, PALETTE.guardAlert, 'center', 'bold');
      else if (g.mode === 'investigate') text('?', g.x, g.y - 24, 20, '#ffd94d', 'center', 'bold');
    }

    // Smoke cloud.
    if (state.smokeTimer > 0) {
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(state.player.x, state.player.y, TOOLS.smokeRadius, 0, TAU);
      context.fill();
    }

    // The thief: gold hooded figure, smaller and dimmer while sneaking.
    const p = state.player;
    const blink = p.moving && state.caughtFlash === 0;
    void blink;
    if (state.caughtFlash === 0 || Math.floor(state.caughtFlash * 10) % 2 === 0) {
      circle(p.x, p.y, 14, p.sneak ? PALETTE.playerSneak : PALETTE.player);
      context.strokeStyle = '#3a2f10';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x + Math.cos(p.facing) * 20, p.y + Math.sin(p.facing) * 20);
      context.stroke();
      circle(p.x, p.y, 4, '#1c2433');
    }
    if (state.hacking) {
      text(`HACKING ${Math.round((state.hackProgress / 2) * 100)}%`, p.x, p.y - 26, 13, PALETTE.terminal, 'center', 'bold');
    }
  }

  function drawHud(state, best) {
    // Top bar.
    context.fillStyle = 'rgba(11, 13, 18, 0.88)';
    context.fillRect(0, 0, FIELD.width, 56);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, 56, FIELD.width, 2);

    text('VAULTLIGHT', 16, 36, 22, PALETTE.text, 'left', 'bold');
    text(state.floorName, 190, 35, 16, PALETTE.muted, 'left');
    text(scoreLabel(state.score), 470, 36, 20, PALETTE.loot, 'left', 'bold');

    // Alarm meter: the game's heartbeat, centre-top where the eye lands.
    const ax = 760;
    const aw = 220;
    const ratio = state.alarm / ALARM.caughtAt;
    const alarmColor = ratio < 0.4 ? PALETTE.alarmLow : ratio < 0.75 ? PALETTE.alarmMid : PALETTE.alarmHigh;
    text('ALARM', ax - 8, 36, 15, state.spotted ? PALETTE.alarmHigh : PALETTE.muted, 'right', 'bold');
    context.fillStyle = '#2a2f3d';
    context.fillRect(ax, 20, aw, 18);
    context.fillStyle = alarmColor;
    context.fillRect(ax, 20, aw * ratio, 18);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(ax, 20, aw, 18);
    text(`${Math.round(state.alarm)}%`, ax + aw + 10, 36, 16, alarmColor, 'left', 'bold');

    // Lives.
    for (let i = 0; i < LIVES; i += 1) {
      context.fillStyle = i < state.lives ? PALETTE.guard : '#2a2f3d';
      context.beginPath();
      context.arc(1032 + i * 26, 29, 8, 0, TAU);
      context.fill();
    }
    // Tools + timer.
    text(`COINS ${state.coinsLeft}  SMOKE ${state.smokeLeft}`, 1090, 26, 13, PALETTE.muted, 'left');
    const mins = Math.floor(state.floorTime / 60);
    const secs = Math.floor(state.floorTime % 60);
    text(`${mins}:${String(secs).padStart(2, '0')}`, 1090, 46, 13, PALETTE.muted, 'left');

    // Loot checklist, bottom-left, so the objective is always visible.
    context.fillStyle = 'rgba(11, 13, 18, 0.75)';
    context.fillRect(12, FIELD.height - 34 - state.lootTotal * 0, 300, 30);
    let lootText = 'LOOT  ';
    for (const l of state.loot) lootText += l.taken ? '◆ ' : '◇ ';
    lootText += `  ${state.lootTaken}/${state.lootTotal}   $${state.lootValue.toLocaleString('en-US')}`;
    text(lootText, 20, FIELD.height - 12, 15, PALETTE.text, 'left');

    if (state.camerasDisabled > 0) {
      text(`CAMERAS OFF ${Math.ceil(state.camerasDisabled)}s`, FIELD.width - 16, FIELD.height - 12, 14, PALETTE.terminal, 'right', 'bold');
    }

    // Context hint: what E does right here.
    const loot = state.loot.find((l) => !l.taken && Math.hypot(l.x - state.player.x, l.y - state.player.y) <= 52);
    if (loot) text('[E] Grab ' + loot.label, FIELD.width / 2, FIELD.height - 52, 16, PALETTE.loot, 'center', 'bold');
    else if (state.camerasDisabled <= 0 && state.terminals.some((t) => Math.hypot(t.x - state.player.x, t.y - state.player.y) <= 52)) {
      text('[E] Hack cameras (tap 3x)', FIELD.width / 2, FIELD.height - 52, 16, PALETTE.terminal, 'center', 'bold');
    }

    // Floating message.
    if (state.messageTimer > 0 && state.message) {
      context.fillStyle = 'rgba(11, 13, 18, 0.8)';
      const w = context.measureText(state.message).width + 28;
      context.fillRect(FIELD.width / 2 - w / 2, 68, w, 30);
      text(state.message, FIELD.width / 2, 89, 15, state.spotted ? PALETTE.alarmHigh : PALETTE.text, 'center', 'bold');
    }

    // Caught flash.
    if (state.caughtFlash > 0) {
      context.fillStyle = `rgba(255, 45, 85, ${state.caughtFlash * 0.25})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    void timeLabel;
    void best;
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center', 'bold');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, PALETTE.loot, 'center');
  }

  /** Paint one frame: the room, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawCones(state);
    drawActors(state);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'VAULTLIGHT',
        [
          'A quiet heist in three nights. Grab every loot, dodge the cones,',
          'and slip out before the alarm hits 100%.',
          'Move WASD / arrows · Sneak Shift · Grab / hack E',
          'Coin toss Q or right-click · Smoke bomb F · Pause P · Mute M',
          '',
          `Best score $${best.toLocaleString('en-US')}`,
        ],
        'Press Space or click to start',
      );
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'Busted',
        [`Score $${state.score.toLocaleString('en-US')} — loot $${state.lootValue.toLocaleString('en-US')}`, `Best $${best.toLocaleString('en-US')}`, 'The alarm won this time. Read the cones,', 'sneak the gaps, and try the other route.'],
        'Press Space or click to try again',
        PALETTE.alarmHigh,
      );
    } else if (screen === SCREEN_FLOOR) {
      drawPanel(
        'Floor Clear!',
        [`${state.floorName} — loot $${state.lootValue.toLocaleString('en-US')}`, `Score $${state.score.toLocaleString('en-US')}`, 'The getaway is waiting. One more floor to go.'],
        'Press Space or click for the next floor',
        PALETTE.exit,
      );
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'Clean Getaway!',
        [`All three nights cleared. Loot $${state.lootValue.toLocaleString('en-US')}`, `Final score $${state.score.toLocaleString('en-US')}  ·  Best $${best.toLocaleString('en-US')}`, 'Not a single alarm raised that mattered.'],
        'Press Space or click to play again',
        PALETTE.exit,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
