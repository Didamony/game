// الرسم والحركة والتحكم. كل الرسومات مرسومة بالكود على Canvas.
(function (root) {
  'use strict';

  const COLORS = [
    { name: 'ياقوت', base: '#ff4f7b', light: '#ffd0dc', dark: '#9e1240' },
    { name: 'سما', base: '#3ec8ff', light: '#d2f4ff', dark: '#0a62a0' },
    { name: 'شمس', base: '#ffc93c', light: '#fff4c8', dark: '#a86f00' },
    { name: 'نعناع', base: '#2fe3a0', light: '#ccffeb', dark: '#077f55' },
    { name: 'قمر', base: '#a98bff', light: '#ebe3ff', dark: '#5130c4' },
    { name: 'جمرة', base: '#ff8a3d', light: '#ffe0c8', dark: '#b2420a' },
  ];

  const EASE = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    outBack: (t) => { const s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; },
  };

  // ---------- أشكال البلّورات ----------

  function polygon(cx, cy, R, n, rot, scaleX) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i * Math.PI * 2) / n;
      pts.push([cx + Math.cos(a) * R * (scaleX || 1), cy + Math.sin(a) * R]);
    }
    return pts;
  }

  function shapePoints(color, cx, cy, R) {
    switch (color) {
      case 0: return polygon(cx, cy, R * 0.95, 6, -Math.PI / 2);
      case 1: return polygon(cx, cy, R, 4, -Math.PI / 2, 0.78);
      case 2: {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? R * 0.5 : R * 1.02;
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        return pts;
      }
      case 3: return polygon(cx, cy + R * 0.14, R * 1.08, 3, -Math.PI / 2);
      case 5: return polygon(cx, cy, R * 0.98, 8, Math.PI / 8);
      default: return null; // 4 = دايرة
    }
  }

  function shapePath(ctx, color, cx, cy, R) {
    ctx.beginPath();
    const pts = shapePoints(color, cx, cy, R);
    if (!pts) {
      ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2);
    } else {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
  }

  function drawGem(ctx, color, cx, cy, R, glow) {
    const C = COLORS[color];
    ctx.save();
    if (glow !== false) {
      ctx.shadowColor = C.base;
      ctx.shadowBlur = R * 0.55;
    }
    shapePath(ctx, color, cx, cy, R);
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.05, cx, cy, R * 1.15);
    g.addColorStop(0, C.light);
    g.addColorStop(0.42, C.base);
    g.addColorStop(1, C.dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.clip();
    // أوجه البلّورة
    const pts = shapePoints(color, cx, cy, R);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(1, R * 0.045);
    if (pts) {
      ctx.beginPath();
      for (const [x, y] of pts) { ctx.moveTo(cx, cy); ctx.lineTo(x, y); }
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + R * 0.25, cy - R * 0.2, R * 0.55, Math.PI * 0.6, Math.PI * 1.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();
    }
    // لمعة
    const gl = ctx.createLinearGradient(cx, cy - R, cx, cy);
    gl.addColorStop(0, 'rgba(255,255,255,0.55)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.15, cy - R * 0.45, R * 0.55, R * 0.3, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // قلب صغير مضيء
    shapePath(ctx, color, cx, cy, R * 0.38);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
    shapePath(ctx, color, cx, cy, R);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, R * 0.07);
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawMixed(ctx, a, b, cx, cy, R) {
    const A = COLORS[a], B = COLORS[b];
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = R * 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.92, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    g.addColorStop(0, A.light);
    g.addColorStop(0.3, A.base);
    g.addColorStop(0.7, B.base);
    g.addColorStop(1, B.dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = R * 0.1;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    // دوامة في النص بين اللونين
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.92, -Math.PI * 0.75, Math.PI * 0.25);
    ctx.arc(cx + R * 0.33, cy - R * 0.33, R * 0.46, Math.PI * 0.25, Math.PI * 1.25, true);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.restore();
    drawGem(ctx, a, cx - R * 0.34, cy - R * 0.3, R * 0.4, false);
    drawGem(ctx, b, cx + R * 0.34, cy + R * 0.32, R * 0.4, false);
  }

  function drawStripe(ctx, dir, cx, cy, R) {
    ctx.save();
    ctx.translate(cx, cy);
    if (dir === 'v') ctx.rotate(Math.PI / 2);
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = R * 0.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineCap = 'round';
    ctx.lineWidth = R * 0.11;
    for (const o of [-0.3, 0, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(-R * 0.6, o * R);
      ctx.lineTo(R * 0.6, o * R);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * R * 1.08, 0);
      ctx.lineTo(s * R * 0.78, -R * 0.2);
      ctx.lineTo(s * R * 0.78, R * 0.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBombMark(ctx, cx, cy, R) {
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = R * 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = R * 0.08;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78, R * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPrism(ctx, cx, cy, R, t) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.0012);
    ctx.shadowColor = 'hsl(' + ((t / 8) % 360) + ',100%,70%)';
    ctx.shadowBlur = R * 0.8;
    let fill;
    if (ctx.createConicGradient) {
      fill = ctx.createConicGradient(0, 0, 0);
      for (let i = 0; i <= 6; i++) fill.addColorStop(i / 6, 'hsl(' + i * 60 + ',100%,65%)');
    } else {
      fill = ctx.createLinearGradient(-R, -R, R, R);
      for (let i = 0; i <= 6; i++) fill.addColorStop(i / 6, 'hsl(' + i * 60 + ',100%,65%)');
    }
    ctx.fillStyle = fill;
    for (const rot of [0, Math.PI]) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = rot - Math.PI / 2 + (i * Math.PI * 2) / 3;
        const x = Math.cos(a) * R * 1.05, y = Math.sin(a) * R * 1.05;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.55);
    core.addColorStop(0, '#fff');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPiece(ctx, colors, special, cx, cy, R) {
    if (colors.length > 1) drawMixed(ctx, colors[0], colors[1], cx, cy, R);
    else drawGem(ctx, colors[0], cx, cy, R);
    if (special === 'h' || special === 'v') drawStripe(ctx, special, cx, cy, R);
    else if (special === 'bomb') drawBombMark(ctx, cx, cy, R);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawIce(ctx, x, y, s, layers) {
    ctx.save();
    roundRect(ctx, x + 2, y + 2, s - 4, s - 4, s * 0.16);
    ctx.fillStyle = layers > 1 ? 'rgba(175,225,255,0.5)' : 'rgba(200,238,255,0.28)';
    ctx.fill();
    ctx.strokeStyle = layers > 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = layers > 1 ? 3 : 2;
    ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.15, y + s * 0.45);
    ctx.lineTo(x + s * 0.45, y + s * 0.15);
    ctx.moveTo(x + s * 0.2, y + s * 0.7);
    ctx.lineTo(x + s * 0.7, y + s * 0.2);
    if (layers > 1) {
      ctx.moveTo(x + s * 0.55, y + s * 0.9);
      ctx.lineTo(x + s * 0.9, y + s * 0.55);
    }
    ctx.stroke();
    ctx.restore();
  }

  // أيقونة صغيرة للأهداف (data URL)
  function goalIcon(goal, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (goal.type === 'color') drawGem(ctx, goal.color, size / 2, size / 2, size * 0.36);
    else if (goal.type === 'ice') drawIce(ctx, size * 0.1, size * 0.1, size * 0.8, 2);
    else {
      ctx.fillStyle = '#ffd54a';
      ctx.shadowColor = '#ffd54a';
      ctx.shadowBlur = size * 0.2;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? size * 0.17 : size * 0.38;
        pts.push([size / 2 + Math.cos(a) * rr, size / 2 + Math.sin(a) * rr]);
      }
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.fill();
    }
    return c.toDataURL();
  }

  // ---------- اللعبة ----------

  class Game {
    constructor(canvas, ui) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ui = ui;
      this.entries = new Map();
      this.tweens = [];
      this.particles = [];
      this.effects = [];
      this.texts = [];
      this.sprites = new Map();
      this.shake = 0;
      this.running = false;
      this.engine = null;
      this.cell = 40;
      this.ox = 0;
      this.oy = 0;
      this.lastBeatSeen = -1;
      this.beatFlash = 0;

      new ResizeObserver(() => this.layout()).observe(canvas.parentElement);
      this.bindInput();
      const loop = (now) => {
        this.frame(now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    load(levelIndex) {
      this.levelIndex = levelIndex;
      this.level = root.LEVELS[levelIndex];
      this.engine = new root.Engine(this.level);
      const e = this.engine;
      this.entries.clear();
      this.tweens = [];
      this.particles = [];
      this.effects = [];
      this.texts = [];
      for (let r = 0; r < e.rows; r++)
        for (let c = 0; c < e.cols; c++) {
          const p = e.grid[r][c];
          if (p) this.addEntry(p, c, r, 0);
        }
      // دخول البلّورات بشكل متتابع
      for (const en of this.entries.values()) {
        this.tween(en, { scale: 1 }, 380, 'outBack', (en.y * 8 + en.x) * 14);
      }
      this.view = {
        score: 0,
        moves: e.movesLeft,
        collected: [0, 0, 0, 0, 0, 0],
        ice: e.ice.map((row) => row.slice()),
      };
      this.busy = false;
      this.ended = false;
      this.paused = false;
      this.selected = null;
      this.hint = null;
      this.lastAction = performance.now();
      this.layout();
      this.pushHud();
    }

    addEntry(p, x, y, scale) {
      const en = { id: p.id, colors: p.colors.slice(), special: p.special, x, y, scale: scale == null ? 1 : scale, alpha: 1 };
      this.entries.set(p.id, en);
      return en;
    }

    layout() {
      const wrap = this.canvas.parentElement;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.w = w;
      this.h = h;
      const rows = this.engine ? this.engine.rows : 8, cols = this.engine ? this.engine.cols : 8;
      const pad = 10;
      const cell = Math.floor(Math.min((w - pad * 2) / cols, (h - pad * 2) / rows));
      if (cell !== this.cell) this.sprites.clear();
      this.cell = cell;
      this.ox = Math.round((w - cell * cols) / 2);
      this.oy = Math.round((h - cell * rows) * 0.3);
    }

    sprite(colors, special) {
      const k = colors.join('-') + '|' + special + '|' + this.cell;
      let s = this.sprites.get(k);
      if (s) return s;
      const size = Math.ceil(this.cell * 1.5 * this.dpr);
      s = document.createElement('canvas');
      s.width = s.height = size;
      const ctx = s.getContext('2d');
      drawPiece(ctx, colors, special, size / 2, size / 2, this.cell * 0.4 * this.dpr);
      this.sprites.set(k, s);
      return s;
    }

    // ---------- أنيميشن ----------

    tween(obj, to, dur, ease, delay) {
      return new Promise((resolve) => {
        this.tweens.push({ obj, to, dur, ease: EASE[ease || 'outQuad'], start: performance.now() + (delay || 0), from: null, resolve });
      });
    }

    wait(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    updateTweens(now) {
      const keep = [];
      for (const tw of this.tweens) {
        if (now < tw.start) { keep.push(tw); continue; }
        if (!tw.from) {
          tw.from = {};
          for (const k in tw.to) tw.from[k] = tw.obj[k];
        }
        const t = Math.min(1, (now - tw.start) / tw.dur);
        const e = tw.ease(t);
        for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
        if (t >= 1) tw.resolve();
        else keep.push(tw);
      }
      this.tweens = keep;
    }

    px(c) { return this.ox + (c + 0.5) * this.cell; }
    py(r) { return this.oy + (r + 0.5) * this.cell; }

    burst(r, c, colors, n) {
      if (this.particles.length > 500) return;
      const x = this.px(c), y = this.py(r);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = this.cell * (1.5 + Math.random() * 4);
        const col = colors.length ? COLORS[colors[i % colors.length]].base : '#ffffff';
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.cell * 2, life: 0, max: 450 + Math.random() * 350, color: col, size: this.cell * (0.05 + Math.random() * 0.07) });
      }
    }

    floatText(text, x, y, opts) {
      const o = opts || {};
      this.texts.push({ text, x, y, start: performance.now(), dur: o.dur || 1000, size: o.size || this.cell * 0.5, color: o.color || '#fff' });
    }

    // ---------- الإدخال ----------

    bindInput() {
      const cv = this.canvas;
      const cellAt = (ev) => {
        const rect = cv.getBoundingClientRect();
        const c = Math.floor((ev.clientX - rect.left - this.ox) / this.cell);
        const r = Math.floor((ev.clientY - rect.top - this.oy) / this.cell);
        if (!this.engine || !this.engine.inside(r, c)) return null;
        return [r, c];
      };
      cv.addEventListener('pointerdown', (ev) => {
        root.Sound.init();
        if (this.busy || this.ended || this.paused || !this.engine) return;
        const cell = cellAt(ev);
        if (!cell) { this.selected = null; return; }
        this.drag = { start: cell, x: ev.clientX, y: ev.clientY, moved: false };
        try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      });
      cv.addEventListener('pointermove', (ev) => {
        const d = this.drag;
        if (!d || d.moved) return;
        const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < this.cell * 0.35) return;
        d.moved = true;
        const t = Math.abs(dx) > Math.abs(dy) ? [d.start[0], d.start[1] + Math.sign(dx)] : [d.start[0] + Math.sign(dy), d.start[1]];
        this.selected = null;
        this.attempt(d.start, t);
      });
      const end = () => {
        const d = this.drag;
        this.drag = null;
        if (!d || d.moved) return;
        const s = this.selected;
        if (s && Math.abs(s[0] - d.start[0]) + Math.abs(s[1] - d.start[1]) === 1) {
          this.selected = null;
          this.attempt(s, d.start);
        } else if (s && s[0] === d.start[0] && s[1] === d.start[1]) {
          this.selected = null;
        } else {
          this.selected = d.start;
        }
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', () => (this.drag = null));
    }

    async attempt(a, b) {
      if (this.busy || this.ended || this.paused) return;
      const e = this.engine;
      if (!e.inside(b[0], b[1])) return;
      const now = performance.now();
      const onBeat = root.Rhythm.isOnBeat(now);
      const res = e.trySwap(a, b, { mult: onBeat ? 1.5 : 1 });
      this.lastAction = now;
      this.hint = null;
      if (!res.valid) {
        if (res.reason !== 'nomatch') return;
        this.busy = true;
        root.Sound.invalid();
        const ea = this.entries.get(res.step.ida), eb = this.entries.get(res.step.idb);
        await Promise.all([this.tween(ea, { x: b[1], y: b[0] }, 130), this.tween(eb, { x: a[1], y: a[0] }, 130)]);
        await Promise.all([this.tween(ea, { x: a[1], y: a[0] }, 160), this.tween(eb, { x: b[1], y: b[0] }, 160)]);
        this.busy = false;
        return;
      }
      this.busy = true;
      root.Sound.swap();
      if (onBeat) {
        root.Sound.onBeat();
        this.beatFlash = 1;
        this.floatText('على الإيقاع! ×١٫٥', this.w / 2, this.oy + this.cell * 0.9, { color: '#8ff7ff', size: this.cell * 0.5, dur: 900 });
      }
      this.view.moves = e.movesLeft;
      this.pushHud();
      await this.playSteps(res.steps);
      await this.checkEnd();
      this.busy = false;
      this.lastAction = performance.now();
    }

    async checkEnd() {
      const e = this.engine;
      if (e.goalsMet()) {
        this.ended = true;
        this.floatText('حفلة النغم!', this.w / 2, this.h / 2, { size: this.cell * 0.9, color: '#ffe27a', dur: 1400 });
        await this.wait(700);
        const steps = e.finale();
        this.view.moves = 0;
        this.pushHud();
        await this.playSteps(steps);
        await this.wait(400);
        const st = this.level.stars;
        const stars = e.score >= st[2] ? 3 : e.score >= st[1] ? 2 : 1;
        root.Sound.win();
        this.ui.onWin({ level: this.levelIndex, score: e.score, stars });
      } else if (e.movesLeft <= 0) {
        this.ended = true;
        await this.wait(400);
        root.Sound.lose();
        this.ui.onLose({ level: this.levelIndex, score: e.score, goals: this.viewGoals() });
      }
    }

    async playSteps(steps) {
      for (const step of steps) {
        if (step.type === 'swap') {
          const ea = this.entries.get(step.ida), eb = this.entries.get(step.idb);
          await Promise.all([
            this.tween(ea, { x: step.b[1], y: step.b[0] }, 150),
            this.tween(eb, { x: step.a[1], y: step.a[0] }, 150),
          ]);
        } else if (step.type === 'transform') {
          for (const t of step.pieces) {
            const en = this.entries.get(t.id);
            if (!en) continue;
            en.special = t.special;
            en.scale = 1.5;
            this.tween(en, { scale: 1 }, 260, 'outBack');
            if (step.finale) {
              this.burst(en.y, en.x, en.colors, 4);
              root.Sound.spawn(false);
              await this.wait(70);
            }
          }
          await this.wait(220);
        } else if (step.type === 'bonus') {
          this.floatText('+' + step.points.toLocaleString('ar-EG'), this.w / 2, this.h * 0.4, { color: '#ffe27a', size: this.cell * 0.7 });
          this.view.score += step.points;
          this.pushHud();
        } else if (step.type === 'clear') {
          await this.animClear(step);
        } else if (step.type === 'fall') {
          await this.animFall(step);
        } else if (step.type === 'shuffle') {
          this.floatText('خلط!', this.w / 2, this.h / 2, { size: this.cell * 0.9, color: '#c9b6ff' });
          await this.wait(300);
          const ps = [];
          for (const m of step.moves) {
            const en = this.entries.get(m.id);
            if (!en) continue;
            en.colors = m.colors;
            ps.push(this.tween(en, { x: m.c, y: m.r }, 450, 'inOutQuad'));
          }
          await Promise.all(ps);
        }
      }
    }

    async animClear(step) {
      const now = performance.now();
      root.Sound.match(step.colors, step.cascade);
      const types = new Set(step.beams.map((b) => b.type));
      types.forEach((t) => root.Sound.special(t));
      for (const b of step.beams) {
        this.effects.push(Object.assign({ start: now, dur: b.type === 'prism' ? 650 : 480 }, b));
        if (b.type === 'bomb') this.shake = Math.max(this.shake, b.rad > 1 ? 14 : 7);
        if (b.type === 'all') this.shake = 18;
      }
      let sx = 0, sy = 0;
      for (const c of step.cleared) {
        const en = this.entries.get(c.id);
        sx += c.c;
        sy += c.r;
        this.burst(c.r, c.c, c.colors, c.special ? 10 : 5);
        if (!en) continue;
        this.tween(en, { scale: 0, alpha: 0.2 }, 200, 'inQuad').then(() => {
          if (this.entries.get(c.id) === en) this.entries.delete(c.id);
        });
        for (const col of c.colors) this.view.collected[col]++;
      }
      for (const h of step.iceHits) {
        this.view.ice[h.r][h.c] = h.left;
        this.burst(h.r, h.c, [], 7);
      }
      if (step.cleared.length) {
        const n = step.cleared.length;
        this.floatText('+' + step.points.toLocaleString('ar-EG'), this.px(sx / n), this.py(sy / n), { color: step.mult > 1 ? '#8ff7ff' : '#ffffff', size: this.cell * (0.42 + Math.min(step.cascade, 4) * 0.06) });
      }
      const words = [null, null, 'حلو!', 'رائع!', 'مذهل!', 'سيمفونية!'];
      if (step.cascade >= 2) {
        this.floatText(words[Math.min(step.cascade, 5)], this.w / 2, this.h * 0.32, { size: this.cell * 0.85, color: '#ffe27a', dur: 1100 });
      }
      this.view.score += step.points;
      this.pushHud();
      await this.wait(210);
      if (step.spawns.length) {
        let mix = false;
        for (const s of step.spawns) {
          const en = this.addEntry(s.piece, s.c, s.r, 0);
          this.tween(en, { scale: 1 }, 300, 'outBack');
          if (s.mix) {
            mix = true;
            this.floatText('خلط ألوان!', this.px(s.c), this.py(s.r) - this.cell * 0.4, { size: this.cell * 0.4, color: '#ffffff', dur: 900 });
          }
        }
        root.Sound.spawn(mix);
        await this.wait(170);
      }
    }

    async animFall(step) {
      const ps = [];
      for (const m of step.moves) {
        const en = this.entries.get(m.id);
        if (!en) continue;
        const dist = m.toR - en.y;
        ps.push(this.tween(en, { y: m.toR }, 110 + Math.sqrt(Math.max(dist, 0)) * 90, 'inQuad'));
      }
      for (const s of step.spawned) {
        const en = this.addEntry(s.piece, s.c, s.fromR, 1);
        const dist = s.r - s.fromR;
        ps.push(this.tween(en, { y: s.r }, 110 + Math.sqrt(dist) * 90, 'inQuad'));
      }
      await Promise.all(ps);
    }

    viewGoals() {
      const v = this.view;
      let iceLeft = 0;
      for (const row of v.ice) for (const x of row) if (x > 0) iceLeft++;
      const iceTotal = this.engine.iceTotal;
      return this.level.goals.map((g) => {
        if (g.type === 'score') return { type: 'score', target: g.n, have: Math.min(v.score, g.n), done: v.score >= g.n };
        if (g.type === 'color') return { type: 'color', color: g.color, target: g.n, have: Math.min(v.collected[g.color], g.n), done: v.collected[g.color] >= g.n };
        return { type: 'ice', target: iceTotal, have: iceTotal - iceLeft, done: iceLeft === 0 };
      });
    }

    pushHud() {
      this.ui.onHud({
        level: this.levelIndex,
        moves: this.view.moves,
        score: this.view.score,
        stars: this.level.stars,
        goals: this.viewGoals(),
      });
    }

    // ---------- الرسم ----------

    frame(now) {
      const dt = Math.min(50, now - (this.lastFrame || now));
      this.lastFrame = now;
      this.updateTweens(now);
      if (this.ui.onBeatFrame) this.ui.onBeatFrame(root.Rhythm.phase(now), root.Rhythm.isOnBeat(now));
      if (!this.engine || !this.running) return;
      if (!this.busy && !this.ended && !this.paused && !this.hint && now - this.lastAction > 7000) {
        this.hint = this.engine.findHint();
      }
      this.draw(now, dt);
    }

    draw(now, dt) {
      const ctx = this.ctx;
      const e = this.engine;
      const cell = this.cell;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);

      if (this.shake > 0.3) {
        ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        this.shake *= 0.86;
      } else this.shake = 0;

      const phase = root.Rhythm.phase(now);
      const pulse = phase < 0.3 ? 1 - phase / 0.3 : 0;
      this.beatFlash *= 0.94;
      const bw = cell * e.cols, bh = cell * e.rows;

      // إطار اللوحة بينبض مع الإيقاع
      ctx.save();
      roundRect(ctx, this.ox - 8, this.oy - 8, bw + 16, bh + 16, 18);
      ctx.fillStyle = 'rgba(14,10,48,0.6)';
      ctx.fill();
      ctx.shadowColor = '#7fe8ff';
      ctx.shadowBlur = 10 + pulse * 22 + this.beatFlash * 30;
      ctx.strokeStyle = 'rgba(127,232,255,' + (0.25 + pulse * 0.5 + this.beatFlash * 0.3) + ')';
      ctx.lineWidth = 2 + pulse * 2;
      ctx.stroke();
      ctx.restore();

      for (let r = 0; r < e.rows; r++)
        for (let c = 0; c < e.cols; c++) {
          if (!e.mask[r][c]) continue;
          roundRect(ctx, this.ox + c * cell + 2, this.oy + r * cell + 2, cell - 4, cell - 4, cell * 0.16);
          ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.04)';
          ctx.fill();
        }

      const mark = (rc, color, alpha) => {
        roundRect(ctx, this.ox + rc[1] * cell + 2, this.oy + rc[0] * cell + 2, cell - 4, cell - 4, cell * 0.16);
        ctx.fillStyle = color.replace('A', alpha);
        ctx.fill();
      };
      if (this.selected) mark(this.selected, 'rgba(255,255,255,A)', 0.22);
      const hintIds = new Set();
      if (this.hint) {
        const a = 0.12 + 0.12 * Math.sin(now / 180);
        for (const rc of this.hint) {
          mark(rc, 'rgba(255,240,150,A)', a);
          const p = e.grid[rc[0]][rc[1]];
          if (p) hintIds.add(p.id);
        }
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(this.ox, this.oy, bw, bh);
      ctx.clip();
      const breathe = 1 + pulse * 0.045;
      for (const en of this.entries.values()) {
        if (en.scale <= 0.01) continue;
        let s = en.scale * breathe;
        if (hintIds.has(en.id)) s *= 1 + 0.08 * Math.sin(now / 120);
        const x = this.px(en.x), y = this.py(en.y);
        ctx.globalAlpha = en.alpha;
        if (en.special === 'prism') {
          drawPrism(ctx, x, y, cell * 0.4 * s, now);
        } else {
          const sp = this.sprite(en.colors, en.special);
          const size = cell * 1.5 * s;
          ctx.drawImage(sp, x - size / 2, y - size / 2, size, size);
          if (en.special === 'bomb') {
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 + 0.3 * Math.sin(now / 150) ** 2) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, cell * 0.46 * s, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      const ice = this.view.ice;
      for (let r = 0; r < e.rows; r++)
        for (let c = 0; c < e.cols; c++)
          if (ice[r][c] > 0) drawIce(ctx, this.ox + c * cell, this.oy + r * cell, cell, ice[r][c]);

      this.drawEffects(ctx, now);
      this.drawParticles(ctx, dt);
      this.drawTexts(ctx, now);
    }

    drawEffects(ctx, now) {
      const cell = this.cell;
      const e = this.engine;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.effects = this.effects.filter((fx) => {
        const t = (now - fx.start) / fx.dur;
        if (t >= 1) return false;
        const a = 1 - t;
        const col = fx.color != null ? COLORS[fx.color].base : '#ffffff';
        if (fx.type === 'h' || fx.type === 'v') {
          const th = cell * (0.85 * a + 0.1);
          ctx.fillStyle = col;
          ctx.globalAlpha = a * 0.7;
          if (fx.type === 'h') ctx.fillRect(this.ox, this.py(fx.r) - th / 2, cell * e.cols, th);
          else ctx.fillRect(this.px(fx.c) - th / 2, this.oy, th, cell * e.rows);
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = a;
          const core = th * 0.25;
          if (fx.type === 'h') ctx.fillRect(this.ox, this.py(fx.r) - core / 2, cell * e.cols, core);
          else ctx.fillRect(this.px(fx.c) - core / 2, this.oy, core, cell * e.rows);
        } else if (fx.type === 'bomb') {
          const R = cell * (fx.rad + 0.6) * (0.3 + t * 0.9);
          ctx.globalAlpha = a;
          ctx.strokeStyle = col;
          ctx.lineWidth = cell * 0.35 * a;
          ctx.beginPath();
          ctx.arc(this.px(fx.c), this.py(fx.r), R, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = a * 0.35;
          ctx.fill();
        } else if (fx.type === 'prism') {
          ctx.lineWidth = cell * 0.08;
          ctx.globalAlpha = a;
          const x0 = this.px(fx.c), y0 = this.py(fx.r);
          fx.targets.forEach(([r, c], i) => {
            ctx.strokeStyle = 'hsl(' + ((i * 40 + now / 4) % 360) + ',100%,70%)';
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(this.px(c), this.py(r));
            ctx.stroke();
          });
        } else if (fx.type === 'all') {
          ctx.globalAlpha = a * 0.8;
          ctx.fillStyle = '#fff';
          ctx.fillRect(this.ox, this.oy, cell * e.cols, cell * e.rows);
        }
        return true;
      });
      ctx.restore();
    }

    drawParticles(ctx, dt) {
      const s = dt / 1000;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.particles = this.particles.filter((p) => {
        p.life += dt;
        if (p.life >= p.max) return false;
        p.vy += this.cell * 9 * s;
        p.x += p.vx * s;
        p.y += p.vy * s;
        p.vx *= 0.98;
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.restore();
    }

    drawTexts(ctx, now) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.texts = this.texts.filter((t) => {
        const k = (now - t.start) / t.dur;
        if (k >= 1) return false;
        const pop = k < 0.15 ? EASE.outBack(k / 0.15) : 1;
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.direction = t.text[0] === '+' ? 'ltr' : 'rtl';
        ctx.font = '800 ' + Math.round(t.size * pop) + 'px Cairo, system-ui, sans-serif';
        ctx.lineWidth = Math.max(3, t.size * 0.14);
        ctx.strokeStyle = 'rgba(20,10,60,0.85)';
        const y = t.y - k * this.cell * 0.9;
        ctx.strokeText(t.text, t.x, y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, y);
        return true;
      });
      ctx.restore();
    }
  }

  Game.COLORS = COLORS;
  Game.goalIcon = goalIcon;
  Game.drawPiece = drawPiece;
  root.Game = Game;
})(window);
