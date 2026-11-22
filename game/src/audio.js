// Tiny synthesized sound: no audio files, everything is Web Audio oscillators.
// The context is created on the first user gesture, so autoplay rules never block
// it; M toggles mute. Every effect is one short function, so the game can call
// audio.pickup() etc. without knowing about the Web Audio API.
export function createAudio() {
  let context = null;
  let muted = false;
  let alarmOsc = null;
  let alarmGain = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return context;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, seconds, type, volume, when = 0, slideTo = null) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + seconds);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopAlarm();
      return muted;
    },
    isMuted() {
      return muted;
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.16);
      tone(1318, 0.18, 'sine', 0.12, 0.07);
    },
    coin() {
      tone(1568, 0.07, 'triangle', 0.12);
      tone(2093, 0.1, 'triangle', 0.1, 0.05);
    },
    smoke() {
      tone(320, 0.35, 'sawtooth', 0.08, 0, 90);
    },
    hack() {
      tone(660, 0.08, 'square', 0.07);
      tone(990, 0.08, 'square', 0.07, 0.09);
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.16, 0, 55);
      tone(110, 0.6, 'square', 0.1, 0.1, 40);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.11));
    },
    laser() {
      tone(1800, 0.12, 'square', 0.06, 0, 900);
    },
    startAlarm() {
      const ctx = ensure();
      if (!ctx || muted || alarmOsc) return;
      alarmOsc = ctx.createOscillator();
      alarmGain = ctx.createGain();
      alarmOsc.type = 'square';
      alarmOsc.frequency.value = 620;
      alarmGain.gain.value = 0.035;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 2.2;
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain).connect(alarmGain.gain);
      alarmOsc.connect(alarmGain).connect(ctx.destination);
      alarmOsc.start();
      lfo.start();
      alarmOsc._lfo = lfo;
    },
    stopAlarm() {
      if (!alarmOsc) return;
      try {
        alarmOsc.stop();
        alarmOsc._lfo.stop();
      } catch {
        // Already stopped.
      }
      alarmOsc = null;
      alarmGain = null;
    },
  };
}
