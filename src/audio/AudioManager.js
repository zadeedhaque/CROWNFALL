/**
 * All audio is synthesised with the Web Audio API - no sample files, nothing
 * copyrighted, a few kilobytes of code instead of megabytes of assets.
 *
 * The music is a slow generative piece built from a double-harmonic scale
 * (the "hijaz"-flavoured mode that reads as ancient/desert to Western ears),
 * scheduled a bar ahead so it never glitches under load.
 */

const SCALE = [0, 1, 4, 5, 7, 8, 11];   // double harmonic, semitone offsets

export default class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuf = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.playing = false;
    this._timer = null;
    this._nextTime = 0;
    this._step = 0;
    this._root = 55;      // A1
    this._mood = 'sand';
    this._lastStep = 0;
  }

  /* --------------------------------------------------------------- setup */

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.5 : 0;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.75 : 0;
    this.sfxGain.connect(this.master);

    // 2 seconds of white noise, reused by every percussive sound
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMusicEnabled(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.5 : 0;
  }

  setSfxEnabled(on) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.75 : 0;
  }

  /* ---------------------------------------------------------- primitives */

  _tone({ freq, type = 'sine', dur = 0.2, gain = 0.2, attack = 0.005, slide = 0, dest = null, detune = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.12, gain = 0.2, freq = 1200, q = 1, type = 'lowpass', sweep = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.02);
  }

  /* --------------------------------------------------------------- sfx */

  play(name, opt = {}) {
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'jump':
        this._tone({ freq: 250, type: 'square', dur: 0.14, gain: 0.1, slide: 1.9 });
        this._noise({ dur: 0.09, gain: 0.08, freq: 900, sweep: 2.2, type: 'bandpass', q: 1.2 });
        break;
      case 'land': {
        const hard = opt.hard ? 1 : 0.55;
        this._tone({ freq: 96, type: 'sine', dur: 0.16 * hard + 0.06, gain: 0.22 * hard, slide: 0.45 });
        this._noise({ dur: 0.12, gain: 0.16 * hard, freq: 700, sweep: 0.25 });
        break;
      }
      case 'step':
        this._noise({ dur: 0.045, gain: 0.05 + Math.random() * 0.02, freq: 1500 + Math.random() * 900, sweep: 0.3, type: 'bandpass', q: 0.9 });
        break;
      case 'grab':
        this._noise({ dur: 0.13, gain: 0.14, freq: 2600, sweep: 0.2, type: 'bandpass', q: 0.7 });
        this._tone({ freq: 180, type: 'triangle', dur: 0.08, gain: 0.08, slide: 0.7 });
        break;
      case 'climb':
        this._noise({ dur: 0.26, gain: 0.1, freq: 900, sweep: 1.9, type: 'bandpass', q: 0.6 });
        this._tone({ freq: 140, type: 'triangle', dur: 0.2, gain: 0.07, slide: 1.5 });
        break;
      case 'vault':
        this._noise({ dur: 0.2, gain: 0.13, freq: 500, sweep: 3.4, type: 'bandpass', q: 0.8 });
        break;
      case 'walljump':
        this._tone({ freq: 190, type: 'square', dur: 0.13, gain: 0.1, slide: 2.1 });
        this._noise({ dur: 0.1, gain: 0.13, freq: 1400, sweep: 0.4 });
        break;
      case 'slide':
        this._noise({ dur: 0.1, gain: 0.05, freq: 2200, sweep: 0.8, type: 'bandpass', q: 1.4 });
        break;
      case 'fall':
        this._tone({ freq: 400, type: 'sine', dur: 0.9, gain: 0.1, slide: 0.16 });
        this._noise({ dur: 0.9, gain: 0.05, freq: 500, sweep: 0.3 });
        break;
      case 'death':
        this._tone({ freq: 220, type: 'triangle', dur: 0.7, gain: 0.18, slide: 0.25 });
        this._tone({ freq: 110, type: 'sine', dur: 0.9, gain: 0.14, slide: 0.4 });
        break;
      case 'checkpoint':
        [523.25, 659.25, 783.99].forEach((f, i) => {
          setTimeout(() => this._tone({ freq: f, type: 'triangle', dur: 0.45, gain: 0.12 }), i * 70);
        });
        break;
      case 'crumble':
        this._noise({ dur: 0.35, gain: 0.12, freq: 420, sweep: 0.5, type: 'lowpass', q: 2 });
        break;
      case 'menu':
        this._tone({ freq: 660, type: 'square', dur: 0.05, gain: 0.05 });
        break;
      case 'select':
        this._tone({ freq: 523, type: 'square', dur: 0.07, gain: 0.07 });
        setTimeout(() => this._tone({ freq: 784, type: 'square', dur: 0.1, gain: 0.07 }), 55);
        break;
      case 'complete':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          setTimeout(() => {
            this._tone({ freq: f, type: 'triangle', dur: 0.6, gain: 0.14 });
            this._tone({ freq: f * 2, type: 'sine', dur: 0.4, gain: 0.05 });
          }, i * 110);
        });
        break;
      default:
        break;
    }
  }

  /** Footsteps are rate-limited here so callers can spam them freely. */
  footstep(now, interval) {
    if (now - this._lastStep < interval) return;
    this._lastStep = now;
    this.play('step');
  }

  /* -------------------------------------------------------------- music */

  startMusic(mood = 'sand') {
    this.unlock();
    if (!this.ctx) return;
    this._mood = mood;
    this._root = mood === 'ruin' ? 49 : mood === 'fortress' ? 44 : 55;
    if (this.playing) return;
    this.playing = true;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.1;
    this._pad();
    this._timer = setInterval(() => this._schedule(), 90);
  }

  stopMusic() {
    this.playing = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._padNodes) {
      const t = this.ctx.currentTime;
      this._padNodes.gain.gain.cancelScheduledValues(t);
      this._padNodes.gain.gain.setTargetAtTime(0.0001, t, 0.5);
      const nodes = this._padNodes;
      setTimeout(() => nodes.oscs.forEach((o) => { try { o.stop(); } catch (e) { /* already stopped */ } }), 2500);
      this._padNodes = null;
    }
  }

  _pad() {
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 620;
    const oscs = [];
    [1, 1.5, 2.005, 3].forEach((mult, i) => {
      const o = this.ctx.createOscillator();
      o.type = i === 3 ? 'triangle' : 'sawtooth';
      o.frequency.value = this._root * mult;
      o.detune.value = (i - 1.5) * 7;
      const og = this.ctx.createGain();
      og.gain.value = [0.5, 0.26, 0.2, 0.1][i];
      o.connect(og).connect(f);
      o.start(t);
      oscs.push(o);
    });
    // slow filter breathing keeps the drone from feeling static
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(f.frequency);
    lfo.start(t);
    oscs.push(lfo);
    f.connect(g).connect(this.musicGain);
    this._padNodes = { gain: g, oscs };
  }

  _note(freq, time, dur, gain, type) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g).connect(this.musicGain);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  _schedule() {
    if (!this.playing || !this.ctx) return;
    const beat = this._mood === 'fortress' ? 0.30 : 0.36;
    while (this._nextTime < this.ctx.currentTime + 0.35) {
      const s = this._step;
      const bar = Math.floor(s / 16);
      const inBar = s % 16;

      // plucked melody, meandering up and down the mode
      if (inBar % 2 === 0 || (inBar % 8 === 3)) {
        const shape = [0, 2, 4, 3, 5, 4, 2, 1, 0, 2, 6, 5, 4, 2, 1, 0];
        let deg = shape[inBar] + (bar % 4 === 3 ? 2 : 0);
        const oct = Math.floor(deg / 7);
        const semi = SCALE[deg % 7] + oct * 12;
        const f = this._root * 4 * Math.pow(2, semi / 12);
        this._note(f, this._nextTime, 0.5, 0.055, 'triangle');
        if (inBar % 8 === 0) this._note(f * 0.5, this._nextTime, 0.8, 0.03, 'sine');
      }

      // sparse frame-drum pulse
      if (inBar === 0 || inBar === 6 || inBar === 10) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(140, this._nextTime);
        o.frequency.exponentialRampToValueAtTime(52, this._nextTime + 0.16);
        g.gain.setValueAtTime(0.11, this._nextTime);
        g.gain.exponentialRampToValueAtTime(0.0001, this._nextTime + 0.2);
        o.connect(g).connect(this.musicGain);
        o.start(this._nextTime);
        o.stop(this._nextTime + 0.25);
      }

      this._nextTime += beat / 2;
      this._step++;
    }
  }
}

/** One manager for the whole app; scenes reach it through the Phaser registry. */
export function getAudio(scene) {
  let a = scene.registry.get('audio');
  if (!a) {
    a = new AudioManager();
    scene.registry.set('audio', a);
  }
  return a;
}
