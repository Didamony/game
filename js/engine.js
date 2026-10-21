// منطق اللعبة الصافي: اللوحة، التطابق، السقوط، القطع الخاصة وخلط الألوان.
// مفيش أي رسم هنا — المحرك بيرجّع "خطوات" والرسّام هو اللي بيحرّكها.
(function (root) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const key = (r, c) => r * 100 + c;
  const unkey = (k) => [Math.floor(k / 100), k % 100];

  // القطعة بتحمل لون معيّن؟ البلّورة المخلوطة بتحمل لونين، والمنشور مالوش لون.
  function has(p, color) {
    return !!p && p.special !== 'prism' && p.colors.indexOf(color) >= 0;
  }

  function snap(p) {
    return { id: p.id, colors: p.colors.slice(), special: p.special };
  }

  const SPAWN_BONUS = { h: 60, v: 60, bomb: 90, prism: 150, mix: 80 };

  class Engine {
    constructor(level, seed) {
      this.level = level;
      const layout = level.layout || null;
      this.rows = layout ? layout.length : 8;
      this.cols = layout ? layout[0].length : 8;
      this.ncolors = level.colors;
      this.rng = mulberry32(seed == null ? (Math.random() * 4294967296) >>> 0 : seed);
      this.mask = [];
      this.ice = [];
      this.grid = [];
      this.iceLeft = 0;
      for (let r = 0; r < this.rows; r++) {
        this.mask.push([]);
        this.ice.push([]);
        this.grid.push([]);
        for (let c = 0; c < this.cols; c++) {
          const ch = layout ? layout[r][c] : '.';
          this.mask[r].push(ch !== '#');
          const ice = ch === 'i' ? 1 : ch === 'I' ? 2 : 0;
          this.ice[r].push(ice);
          if (ice) this.iceLeft++;
          this.grid[r].push(null);
        }
      }
      this.iceTotal = this.iceLeft;
      this.movesLeft = level.moves;
      this.score = 0;
      this.collected = [0, 0, 0, 0, 0, 0];
      this.nextId = 1;
      this.fillInitial();
    }

    newPiece(colors, special) {
      return { id: this.nextId++, colors: colors, special: special || null };
    }

    randColor() {
      return Math.floor(this.rng() * this.ncolors);
    }

    inside(r, c) {
      return r >= 0 && c >= 0 && r < this.rows && c < this.cols && this.mask[r][c];
    }

    fillInitial() {
      for (let attempt = 0; attempt < 200; attempt++) {
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (!this.mask[r][c]) continue;
            const banned = [];
            const g = this.grid;
            if (c >= 2 && g[r][c - 1] && g[r][c - 2] && g[r][c - 1].colors[0] === g[r][c - 2].colors[0]) banned.push(g[r][c - 1].colors[0]);
            if (r >= 2 && g[r - 1][c] && g[r - 2][c] && g[r - 1][c].colors[0] === g[r - 2][c].colors[0]) banned.push(g[r - 1][c].colors[0]);
            let color;
            do { color = this.randColor(); } while (banned.indexOf(color) >= 0);
            g[r][c] = this.newPiece([color]);
          }
        }
        if (this.findHint()) return;
      }
    }

    // كل الصفوف/الأعمدة اللي فيها 3 أو أكتر من نفس اللون، مجمّعة في أشكال (L / T).
    findGroups() {
      const runs = [];
      const g = this.grid;
      for (let color = 0; color < this.ncolors; color++) {
        for (let r = 0; r < this.rows; r++) {
          let c = 0;
          while (c < this.cols) {
            if (has(g[r][c], color)) {
              let e = c;
              while (e + 1 < this.cols && has(g[r][e + 1], color)) e++;
              if (e - c + 1 >= 3) {
                const cells = [];
                for (let i = c; i <= e; i++) cells.push(key(r, i));
                runs.push({ color, dir: 'h', cells });
              }
              c = e + 1;
            } else c++;
          }
        }
        for (let c = 0; c < this.cols; c++) {
          let r = 0;
          while (r < this.rows) {
            if (has(g[r][c], color)) {
              let e = r;
              while (e + 1 < this.rows && has(g[e + 1][c], color)) e++;
              if (e - r + 1 >= 3) {
                const cells = [];
                for (let i = r; i <= e; i++) cells.push(key(i, c));
                runs.push({ color, dir: 'v', cells });
              }
              r = e + 1;
            } else r++;
          }
        }
      }
      if (!runs.length) return [];

      const parent = runs.map((_, i) => i);
      const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      for (let i = 0; i < runs.length; i++) {
        for (let j = i + 1; j < runs.length; j++) {
          if (runs[i].color !== runs[j].color) continue;
          if (runs[i].cells.some((k) => runs[j].cells.indexOf(k) >= 0)) parent[find(i)] = find(j);
        }
      }
      const byRoot = new Map();
      runs.forEach((run, i) => {
        const root = find(i);
        if (!byRoot.has(root)) byRoot.set(root, []);
        byRoot.get(root).push(run);
      });
      const groups = [];
      for (const list of byRoot.values()) {
        const count = new Map();
        let maxLen = 0, longDir = 'h', hasH = false, hasV = false;
        for (const run of list) {
          if (run.dir === 'h') hasH = true; else hasV = true;
          if (run.cells.length > maxLen) { maxLen = run.cells.length; longDir = run.dir; }
          for (const k of run.cells) count.set(k, (count.get(k) || 0) + 1);
        }
        const cells = Array.from(count.keys());
        const cross = cells.filter((k) => count.get(k) > 1);
        groups.push({ color: list[0].color, cells, keys: new Set(cells), cross, hasH, hasV, maxLen, longDir });
      }
      return groups;
    }

    // بيحوّل المجموعات لخلايا تتمسح + قطع خاصة تتولد مكانها.
    groupsToClear(groups, swapKeys, allowMix) {
      const seeds = new Set();
      const spawns = [];
      const used = new Set();
      const pickPos = (g, preferred) => {
        for (const k of swapKeys) if (g.keys.has(k) && !used.has(k)) return k;
        for (const k of preferred) if (!used.has(k)) return k;
        const mid = g.cells[Math.floor(g.cells.length / 2)];
        if (!used.has(mid)) return mid;
        return g.cells.find((k) => !used.has(k));
      };
      for (const g of groups) {
        g.cells.forEach((k) => seeds.add(k));
        let type = null;
        if (g.maxLen >= 5) type = 'prism';
        else if (g.hasH && g.hasV) type = 'bomb';
        else if (g.maxLen === 4) type = g.longDir === 'h' ? 'v' : 'h';
        if (!type) continue;
        const pos = pickPos(g, type === 'bomb' ? g.cross : []);
        if (pos == null) continue;
        used.add(pos);
        const [r, c] = unkey(pos);
        spawns.push({ r, c, piece: this.newPiece(type === 'prism' ? [] : [g.color], type), bonus: SPAWN_BONUS[type] });
      }
      if (allowMix) {
        const colors = [];
        for (const g of groups) if (colors.indexOf(g.color) < 0) colors.push(g.color);
        if (colors.length >= 2) {
          const candidates = swapKeys.filter((k) => seeds.has(k)).concat(Array.from(seeds));
          const pos = candidates.find((k) => !used.has(k));
          if (pos != null) {
            used.add(pos);
            const [r, c] = unkey(pos);
            spawns.push({ r, c, piece: this.newPiece([colors[0], colors[1]], null), bonus: SPAWN_BONUS.mix, mix: true });
          }
        }
      }
      return { seeds, spawns, colors: groups.map((g) => g.color) };
    }

    mostCommonColor(exclude) {
      const count = new Array(this.ncolors).fill(0);
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          const p = this.grid[r][c];
          if (!p || p.special === 'prism' || exclude.has(key(r, c))) continue;
          for (const col of p.colors) count[col]++;
        }
      let best = 0;
      for (let i = 1; i < count.length; i++) if (count[i] > count[best]) best = i;
      return best;
    }

    cellsWithColors(colors) {
      const out = [];
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          const p = this.grid[r][c];
          if (p && colors.some((col) => has(p, col))) out.push(key(r, c));
        }
      return out;
    }

    // بيمسح الخلايا ويفجّر أي قطعة خاصة جواها (وأي قطعة خاصة توصلها الانفجارات).
    clearStep(seeds, opts) {
      const cascade = opts.cascade || 0;
      const mult = opts.mult || 1;
      const spawns = opts.spawns || [];
      const triggered = opts.triggered || new Set();
      const beams = opts.beams || [];
      const toClear = new Set();
      for (const k of seeds) {
        const [r, c] = unkey(k);
        if (this.inside(r, c)) toClear.add(k);
      }
      const queue = Array.from(toClear);
      const addArea = (cells) => {
        for (const k of cells) {
          const [r, c] = unkey(k);
          if (!this.inside(r, c) || toClear.has(k)) continue;
          toClear.add(k);
          queue.push(k);
        }
      };
      while (queue.length) {
        const k = queue.shift();
        const [r, c] = unkey(k);
        const p = this.grid[r][c];
        if (!p || !p.special || triggered.has(p.id)) continue;
        triggered.add(p.id);
        const area = [];
        if (p.special === 'h') {
          for (let i = 0; i < this.cols; i++) area.push(key(r, i));
          beams.push({ type: 'h', r, c, color: p.colors[0] });
        } else if (p.special === 'v') {
          for (let i = 0; i < this.rows; i++) area.push(key(i, c));
          beams.push({ type: 'v', r, c, color: p.colors[0] });
        } else if (p.special === 'bomb') {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) area.push(key(r + dr, c + dc));
          beams.push({ type: 'bomb', r, c, rad: 1, color: p.colors[0] });
        } else if (p.special === 'prism') {
          const color = this.mostCommonColor(toClear);
          const targets = this.cellsWithColors([color]);
          area.push(...targets);
          beams.push({ type: 'prism', r, c, color, targets: targets.map(unkey) });
        }
        addArea(area);
      }

      const cleared = [];
      const iceHits = [];
      const colorsHit = [];
      for (const k of toClear) {
        const [r, c] = unkey(k);
        if (this.ice[r][c] > 0) {
          this.ice[r][c]--;
          if (this.ice[r][c] === 0) this.iceLeft--;
          iceHits.push({ r, c, left: this.ice[r][c] });
        }
        const p = this.grid[r][c];
        if (!p) continue;
        cleared.push({ id: p.id, r, c, colors: p.colors.slice(), special: p.special });
        for (const col of p.colors) { this.collected[col]++; colorsHit.push(col); }
        this.grid[r][c] = null;
      }
      let points = cleared.length * 10 * (cascade + 1);
      for (const s of spawns) {
        this.grid[s.r][s.c] = s.piece;
        points += s.bonus || 0;
      }
      points += beams.length * 30;
      points = Math.round(points * mult);
      this.score += points;
      return {
        type: 'clear',
        cleared,
        spawns: spawns.map((s) => ({ r: s.r, c: s.c, piece: snap(s.piece), mix: !!s.mix })),
        beams,
        iceHits,
        points,
        cascade,
        mult,
        colors: opts.colors || colorsHit.slice(0, 3),
      };
    }

    fall() {
      const moves = [];
      const spawned = [];
      for (let c = 0; c < this.cols; c++) {
        const rowsP = [];
        for (let r = 0; r < this.rows; r++) if (this.mask[r][c]) rowsP.push(r);
        let write = rowsP.length - 1;
        for (let i = rowsP.length - 1; i >= 0; i--) {
          const r = rowsP[i];
          const p = this.grid[r][c];
          if (!p) continue;
          const tr = rowsP[write];
          if (tr !== r) {
            this.grid[tr][c] = p;
            this.grid[r][c] = null;
            moves.push({ id: p.id, fromR: r, toR: tr, c });
          }
          write--;
        }
        const n = write + 1;
        for (let i = write; i >= 0; i--) {
          const tr = rowsP[i];
          const p = this.newPiece([this.randColor()]);
          this.grid[tr][c] = p;
          spawned.push({ piece: snap(p), r: tr, c, fromR: i - n });
        }
      }
      return { type: 'fall', moves, spawned };
    }

    swapCells(a, b) {
      const g = this.grid;
      const t = g[a[0]][a[1]];
      g[a[0]][a[1]] = g[b[0]][b[1]];
      g[b[0]][b[1]] = t;
    }

    findHint() {
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          for (const [dr, dc] of [[0, 1], [1, 0]]) {
            const r2 = r + dr, c2 = c + dc;
            if (!this.inside(r, c) || !this.inside(r2, c2)) continue;
            const p1 = this.grid[r][c], p2 = this.grid[r2][c2];
            if (!p1 || !p2) continue;
            if (p1.special === 'prism' || p2.special === 'prism' || (p1.special && p2.special)) return [[r, c], [r2, c2]];
            this.swapCells([r, c], [r2, c2]);
            const ok = this.findGroups().length > 0;
            this.swapCells([r, c], [r2, c2]);
            if (ok) return [[r, c], [r2, c2]];
          }
        }
      return null;
    }

    // تبديل قطعتين خاصتين مع بعض = تأثير مضاعف.
    comboSeeds(a, b) {
      const moved = this.grid[b[0]][b[1]];
      const other = this.grid[a[0]][a[1]];
      const seeds = new Set([key(a[0], a[1]), key(b[0], b[1])]);
      const triggered = new Set([moved.id, other.id]);
      const beams = [];
      const transforms = [];
      const [r, c] = b;
      const prism = moved.special === 'prism' ? moved : other.special === 'prism' ? other : null;
      if (prism) {
        const target = prism === moved ? other : moved;
        const pr = prism === moved ? b : a;
        if (target.special === 'prism') {
          for (let i = 0; i < this.rows; i++) for (let j = 0; j < this.cols; j++) seeds.add(key(i, j));
          beams.push({ type: 'all', r, c });
        } else if (target.special) {
          const color = target.colors[0];
          const cells = this.cellsWithColors([color]);
          for (const k of cells) {
            const [rr, cc] = unkey(k);
            const p = this.grid[rr][cc];
            if (!p.special) {
              p.special = target.special === 'bomb' ? 'bomb' : this.rng() < 0.5 ? 'h' : 'v';
              transforms.push({ id: p.id, special: p.special });
            }
            seeds.add(k);
          }
          triggered.delete(target.id);
          beams.push({ type: 'prism', r: pr[0], c: pr[1], color, targets: cells.map(unkey) });
        } else {
          const cells = this.cellsWithColors(target.colors);
          cells.forEach((k) => seeds.add(k));
          beams.push({ type: 'prism', r: pr[0], c: pr[1], color: target.colors[0], targets: cells.map(unkey) });
        }
      } else {
        const kinds = [moved.special, other.special];
        const stripes = kinds.filter((s) => s === 'h' || s === 'v').length;
        if (stripes === 2) {
          for (let i = 0; i < this.cols; i++) seeds.add(key(r, i));
          for (let i = 0; i < this.rows; i++) seeds.add(key(i, c));
          beams.push({ type: 'h', r, c, color: moved.colors[0] }, { type: 'v', r, c, color: other.colors[0] });
        } else if (stripes === 1) {
          for (let d = -1; d <= 1; d++) {
            for (let i = 0; i < this.cols; i++) seeds.add(key(r + d, i));
            for (let i = 0; i < this.rows; i++) seeds.add(key(i, c + d));
            beams.push({ type: 'h', r: r + d, c, color: moved.colors[0] }, { type: 'v', r, c: c + d, color: other.colors[0] });
          }
        } else {
          for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) seeds.add(key(r + dr, c + dc));
          beams.push({ type: 'bomb', r, c, rad: 2, color: moved.colors[0] });
        }
      }
      return { seeds, triggered, beams, transforms };
    }

    // الحركة الأساسية. بترجع {valid, steps} والخطوات دي بالترتيب اللي الرسّام يعرضها بيه.
    trySwap(a, b, opts) {
      const mult = (opts && opts.mult) || 1;
      if (this.movesLeft <= 0) return { valid: false, reason: 'moves' };
      if (!this.inside(a[0], a[1]) || !this.inside(b[0], b[1])) return { valid: false, reason: 'cell' };
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return { valid: false, reason: 'adjacent' };
      const pa = this.grid[a[0]][a[1]], pb = this.grid[b[0]][b[1]];
      if (!pa || !pb) return { valid: false, reason: 'cell' };
      const steps = [];
      const swapStep = { type: 'swap', a, b, ida: pa.id, idb: pb.id };
      this.swapCells(a, b);
      if (pa.special === 'prism' || pb.special === 'prism' || (pa.special && pb.special)) {
        this.movesLeft--;
        steps.push(swapStep);
        const combo = this.comboSeeds(a, b);
        if (combo.transforms.length) steps.push({ type: 'transform', pieces: combo.transforms });
        const step = this.clearStep(combo.seeds, { cascade: 0, mult, triggered: combo.triggered, beams: combo.beams });
        step.combo = true;
        steps.push(step);
      } else {
        const groups = this.findGroups();
        if (!groups.length) {
          this.swapCells(a, b);
          return { valid: false, reason: 'nomatch', step: swapStep };
        }
        this.movesLeft--;
        steps.push(swapStep);
        const plan = this.groupsToClear(groups, [key(b[0], b[1]), key(a[0], a[1])], true);
        steps.push(this.clearStep(plan.seeds, { cascade: 0, mult, spawns: plan.spawns, colors: plan.colors }));
      }
      this.settle(steps, 1, mult);
      return { valid: true, steps };
    }

    settle(steps, cascade, mult) {
      let k = cascade;
      for (let guard = 0; guard < 60; guard++) {
        steps.push(this.fall());
        const groups = this.findGroups();
        if (!groups.length) break;
        const plan = this.groupsToClear(groups, [], false);
        steps.push(this.clearStep(plan.seeds, { cascade: k, mult, spawns: plan.spawns, colors: plan.colors }));
        k++;
      }
      if (!this.findHint()) steps.push(this.shuffle());
      return k;
    }

    shuffle() {
      const cells = [];
      const pieces = [];
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++)
          if (this.grid[r][c]) { cells.push([r, c]); pieces.push(this.grid[r][c]); }
      for (let attempt = 0; attempt < 300; attempt++) {
        for (let i = pieces.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
        }
        if (attempt > 150) for (const p of pieces) if (!p.special) p.colors = [this.randColor()];
        cells.forEach(([r, c], i) => (this.grid[r][c] = pieces[i]));
        if (!this.findGroups().length && this.findHint()) break;
      }
      return {
        type: 'shuffle',
        moves: cells.map(([r, c]) => ({ id: this.grid[r][c].id, r, c, colors: this.grid[r][c].colors.slice() })),
      };
    }

    goals() {
      return this.level.goals.map((g) => {
        if (g.type === 'score') return { type: g.type, target: g.n, have: Math.min(this.score, g.n), done: this.score >= g.n };
        if (g.type === 'color') return { type: g.type, color: g.color, target: g.n, have: Math.min(this.collected[g.color], g.n), done: this.collected[g.color] >= g.n };
        if (g.type === 'ice') return { type: g.type, target: this.iceTotal, have: this.iceTotal - this.iceLeft, done: this.iceLeft === 0 };
        return { type: g.type, done: true };
      });
    }

    goalsMet() {
      return this.goals().every((g) => g.done);
    }

    // "حفلة النغم": الحركات اللي فاضلة بتتحوّل لأوتار وتنفجر.
    finale() {
      const steps = [];
      const cands = [];
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          const p = this.grid[r][c];
          if (p && !p.special) cands.push(p);
        }
      for (let i = cands.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [cands[i], cands[j]] = [cands[j], cands[i]];
      }
      const n = Math.min(this.movesLeft, cands.length, 15);
      const extra = this.movesLeft - n;
      this.movesLeft = 0;
      const transforms = [];
      for (let i = 0; i < n; i++) {
        cands[i].special = this.rng() < 0.5 ? 'h' : 'v';
        transforms.push({ id: cands[i].id, special: cands[i].special });
      }
      if (transforms.length) steps.push({ type: 'transform', pieces: transforms, finale: true });
      if (extra > 0) {
        this.score += extra * 150;
        steps.push({ type: 'bonus', points: extra * 150 });
      }
      let cascade = 0;
      for (let round = 0; round < 10; round++) {
        const seeds = new Set();
        for (let r = 0; r < this.rows; r++)
          for (let c = 0; c < this.cols; c++) {
            const p = this.grid[r][c];
            if (p && p.special) seeds.add(key(r, c));
          }
        if (!seeds.size) break;
        steps.push(this.clearStep(seeds, { cascade }));
        cascade = this.settle(steps, cascade + 1, 1);
      }
      return steps;
    }
  }

  Engine.key = key;
  Engine.unkey = unkey;
  Engine.has = has;
  root.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
