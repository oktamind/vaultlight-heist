// The three floors of the Meridian Museum, hardest last. Each floor is one room
// the thief crosses, with several routes through it: a main corridor, a side
// gallery past the rugs, and a narrow vent crawl (the low ceiling strip along
// the top wall, where guards never patrol). Walls are rectangles; gaps between
// wall segments are the doors. Loot, guards, cameras, terminals and lasers are
// placed so every floor can be cleared by reading the cones first, never by luck.
//
// Coordinates are in the 1280x720 playfield. HUD occupies the top ~56 px, so
// nothing gameplay-critical sits above y=70.
export const LEVELS = [
  {
    name: 'Night 1 — The Gallery',
    parSeconds: 75,
    start: { x: 84, y: 130 },
    exit: { x: 84, y: 636, label: 'GETAWAY VAN' },
    walls: [
      // Central pillar block, split so the thief can pass either side.
      { x: 420, y: 110, w: 18, h: 170 },
      { x: 420, y: 400, w: 18, h: 170 },
      // Long gallery divider with a door gap in the middle.
      { x: 620, y: 380, w: 180, h: 18 },
      { x: 900, y: 380, w: 160, h: 18 },
      // Right-hand alcove wall, short enough to leave a second way out of
      // the corner (a loot pocket with one exit is a trap, not a challenge).
      { x: 1060, y: 110, w: 18, h: 140 },
    ],
    loot: [
      { id: 'painting', kind: 'painting', x: 980, y: 150, value: 1200, label: 'Sunset Canvas' },
      { id: 'gem', kind: 'gem', x: 1060, y: 600, value: 2500, label: 'Meridian Gem' },
      { id: 'statue', kind: 'statue', x: 700, y: 150, value: 1800, label: 'Gold Ibis' },
    ],
    guards: [
      { waypoints: [[300, 220], [300, 540]], pause: 1.0 },
      { waypoints: [[880, 220], [1120, 220], [1120, 540]], pause: 0.8 },
    ],
    cameras: [
      { x: 640, y: 72, baseAngle: Math.PI / 2, arc: 1.1 },
      { x: 1240, y: 380, baseAngle: Math.PI, arc: 0.9 },
    ],
    terminals: [{ x: 480, y: 636, label: 'CAMERA TERMINAL' }],
    lasers: [],
  },
  {
    name: 'Night 2 — The Vault',
    parSeconds: 95,
    start: { x: 84, y: 130 },
    exit: { x: 1196, y: 636, label: 'SERVICE LIFT' },
    walls: [
      { x: 300, y: 110, w: 18, h: 200 },
      { x: 300, y: 430, w: 18, h: 140 },
      { x: 640, y: 200, w: 18, h: 180 },
      { x: 640, y: 500, w: 18, h: 120 },
      { x: 900, y: 110, w: 18, h: 170 },
      { x: 900, y: 400, w: 18, h: 170 },
      { x: 480, y: 470, w: 220, h: 18 },
      { x: 820, y: 470, w: 120, h: 18 },
    ],
    loot: [
      { id: 'crown', kind: 'gem', x: 1120, y: 150, value: 3200, label: 'Duchess Crown' },
      { id: 'vault-gold', kind: 'gold', x: 760, y: 600, value: 4000, label: 'Vault Gold' },
      { id: 'scroll', kind: 'painting', x: 480, y: 150, value: 1500, label: 'Silk Scroll' },
      { id: 'mask', kind: 'statue', x: 180, y: 600, value: 2200, label: 'Jade Mask' },
    ],
    guards: [
      { waypoints: [[200, 300], [200, 560], [520, 560]], pause: 0.9 },
      { waypoints: [[760, 180], [760, 420]], pause: 1.1 },
      { waypoints: [[1040, 300], [1040, 580], [760, 580]], pause: 0.8 },
    ],
    cameras: [
      { x: 480, y: 72, baseAngle: Math.PI / 2, arc: 1.2 },
      { x: 800, y: 72, baseAngle: Math.PI / 2, arc: 1.0 },
      { x: 1240, y: 300, baseAngle: Math.PI, arc: 1.0 },
    ],
    terminals: [{ x: 640, y: 636, label: 'CAMERA TERMINAL' }],
    lasers: [
      // Vault corridor beam, blinking on a 3-second cycle.
      { x1: 940, y1: 300, x2: 940, y2: 460, period: 3.0, onFraction: 0.6, phase: 0 },
    ],
  },
  {
    name: 'Night 3 — The Penthouse',
    parSeconds: 115,
    start: { x: 640, y: 640 },
    exit: { x: 84, y: 130, label: 'ROOFTOP ZIPLINE' },
    walls: [
      { x: 260, y: 110, w: 18, h: 180 },
      { x: 260, y: 410, w: 18, h: 160 },
      { x: 560, y: 110, w: 18, h: 140 },
      { x: 560, y: 370, w: 18, h: 200 },
      { x: 860, y: 110, w: 18, h: 180 },
      { x: 860, y: 410, w: 18, h: 160 },
      { x: 1120, y: 300, w: 18, h: 200 },
      { x: 380, y: 300, w: 200, h: 18 },
      { x: 700, y: 520, w: 220, h: 18 },
    ],
    loot: [
      { id: 'diamond', kind: 'gem', x: 1200, y: 150, value: 5000, label: 'Star Diamond' },
      { id: 'ledger', kind: 'gold', x: 1200, y: 600, value: 3500, label: 'Gold Ledger' },
      { id: 'portrait', kind: 'painting', x: 420, y: 150, value: 2000, label: 'Heir Portrait' },
      { id: 'chalice', kind: 'statue', x: 180, y: 420, value: 2800, label: 'Silver Chalice' },
      { id: 'pearls', kind: 'gem', x: 700, y: 640, value: 2600, label: 'Black Pearls' },
    ],
    guards: [
      { waypoints: [[180, 200], [180, 540]], pause: 0.8 },
      { waypoints: [[420, 200], [700, 200], [700, 460]], pause: 0.9 },
      { waypoints: [[1000, 200], [1000, 540], [760, 540]], pause: 0.7 },
      { waypoints: [[1180, 400], [980, 400], [980, 620]], pause: 1.0 },
    ],
    cameras: [
      { x: 420, y: 72, baseAngle: Math.PI / 2, arc: 1.2 },
      { x: 760, y: 72, baseAngle: Math.PI / 2, arc: 1.0 },
      { x: 1100, y: 72, baseAngle: Math.PI / 2, arc: 1.1 },
      { x: 40, y: 380, baseAngle: 0, arc: 0.9 },
    ],
    terminals: [
      { x: 640, y: 130, label: 'CAMERA TERMINAL' },
      { x: 1180, y: 300, label: 'CAMERA TERMINAL' },
    ],
    lasers: [
      { x1: 640, y1: 250, x2: 800, y2: 250, period: 2.4, onFraction: 0.55, phase: 0.5 },
      { x1: 980, y1: 460, x2: 980, y2: 620, period: 2.4, onFraction: 0.55, phase: 0 },
    ],
  },
];
