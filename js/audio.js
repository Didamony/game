// الصوت كله متولّد بالكود (Web Audio) — مفيش ملفات صوت.
// كل لون له نغمة من سلّم خماسي، فأي سلسلة تطابقات بتطلع لحن حلو.
(function (root) {
  'use strict';

  const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
  // تتابع الكوردات للموسيقى الخلفية: C - G - Am - F
  const CHORDS = [[48, 55, 64], [43, 55, 62], [45, 52, 60], [41, 53, 60]];
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const Rhythm = {
    bpm: 100,
    t0: performance.now(),
    get period() { return 60000 / this.bpm; },
    // 0 بالظبط على النبضة، وبيزيد لحد 1 قبل النبضة اللي بعدها
    phase(now) {
      const p = this.period;
      return (((now || performance.now()) - this.t0) % p + p) % p / p;
    },
    offsetMs(now) {
      const ph = this.phase(now);
      return Math.min(ph, 1 - ph) * this.period;
    },
    isOnBeat(now) { return this.offsetMs(now) <= 100; },
    beatIndex(now) { return Math.floor(((now || performance.now()) - this.t0) / this.period); },
  };

  const Sound = {
    ctx: null,
    master: null,
    muted: false,
    lastBeat: -1,

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(ctx.destination);
      // صدى خفيف يدّي إحساس "فضاء"
      this.fx = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.3;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      this.fx.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(wet);
      wet.connect(this.master);
      setInterval(() => this.scheduler(), 25);
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
    },

    // تحويل وقت performance.now لوقت الصوت
    at(perfMs) {
      return this.ctx.currentTime + Math.max(0, (perfMs - performance.now()) / 1000);
    },

    tone(f, t, dur, opts) {
      const o = opts || {};
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = o.type || 'triangle';
      osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      const vol = o.vol == null ? 0.18 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      if (o.fx !== false) g.connect(this.fx);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },

    bell(midi, t, vol) {
      const f = freq(midi);
      this.tone(f, t, 0.9, { type: 'triangle', vol: vol || 0.16 });
      this.tone(f * 2, t, 0.5, { type: 'sine', vol: (vol || 0.16) * 0.35 });
      this.tone(f * 3.01, t, 0.25, { type: 'sine', vol: (vol || 0.16) * 0.12 });
    },

    noise(t, dur, vol, cutoff) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff || 800;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
    },

    ok() { return this.ctx && !this.muted; },

    // نغمات التطابق: كل خطوة في السلسلة بتطلع درجتين في السلّم
    match(colors, cascade) {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      const uniq = [];
      for (const c of colors) if (uniq.indexOf(c) < 0) uniq.push(c);
      uniq.slice(0, 3).forEach((c, i) => {
        const idx = Math.min(c + cascade * 2, SCALE.length - 1);
        this.bell(SCALE[idx], t + i * 0.07);
      });
    },

    special(type) {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      if (type === 'h' || type === 'v') {
        this.tone(320, t, 0.3, { type: 'sawtooth', to: 1800, vol: 0.05 });
        this.tone(640, t, 0.3, { type: 'sine', to: 2400, vol: 0.06 });
      } else if (type === 'bomb') {
        this.tone(140, t, 0.5, { type: 'sine', to: 40, vol: 0.4, fx: false });
        this.noise(t, 0.35, 0.25, 900);
        [60, 64, 67].forEach((m) => this.bell(m, t + 0.02, 0.08));
      } else if (type === 'prism' || type === 'all') {
        for (let i = 0; i < 10; i++) this.bell(SCALE[i + 3], t + i * 0.04, 0.09);
      }
    },

    spawn(mix) {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      this.bell(mix ? 84 : 79, t, 0.1);
      this.bell(mix ? 88 : 84, t + 0.08, 0.1);
    },

    swap() {
      if (!this.ok()) return;
      this.tone(880, this.ctx.currentTime, 0.06, { type: 'sine', vol: 0.05, fx: false });
    },

    invalid() {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      this.tone(196, t, 0.12, { type: 'square', vol: 0.04, fx: false });
      this.tone(165, t + 0.1, 0.16, { type: 'square', vol: 0.04, fx: false });
    },

    onBeat() {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      this.bell(96, t, 0.07);
    },

    win() {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      [72, 76, 79, 84, 88, 91].forEach((m, i) => this.bell(m, t + i * 0.11, 0.14));
    },

    lose() {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      [69, 64, 60, 57].forEach((m, i) => this.tone(freq(m), t + i * 0.18, 0.5, { type: 'triangle', vol: 0.12 }));
    },

    // الإيقاع الخلفي: نبضة هادية + كورد كل 4 نبضات
    scheduler() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = performance.now();
      const next = Rhythm.beatIndex(now) + 1;
      if (next === this.lastBeat) return;
      const when = Rhythm.t0 + next * Rhythm.period;
      if (when - now > 120) return;
      this.lastBeat = next;
      if (!this.musicOn || this.muted) return;
      const t = this.at(when);
      const down = next % 4 === 0;
      this.tone(down ? 92 : 78, t, 0.18, { type: 'sine', to: 45, vol: down ? 0.22 : 0.12, fx: false });
      if (down) {
        const chord = CHORDS[Math.floor(next / 4) % CHORDS.length];
        const bar = (Rhythm.period * 4) / 1000;
        for (const m of chord) {
          this.tone(freq(m), t, bar * 0.95, { type: 'sine', vol: 0.035, attack: 0.25 });
          this.tone(freq(m + 12), t, bar * 0.6, { type: 'triangle', vol: 0.012, attack: 0.3 });
        }
      }
    },

    musicOn: false,
  };

  root.Sound = Sound;
  root.Rhythm = Rhythm;
})(window);
