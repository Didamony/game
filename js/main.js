// الشاشات، الخريطة، النوافذ، وحفظ التقدّم.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const LEVELS = window.LEVELS;
  const COLORS = window.Game.COLORS;

  // ---------- الحفظ ----------
  const KEY = 'nagham.v1';
  let save = { unlocked: 1, stars: {}, muted: false };
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s.unlocked === 'number') save = Object.assign(save, s);
  } catch (e) { /* تخزين مش متاح */ }
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* تجاهل */ }
  };

  // ---------- السما الخلفية ----------
  const sky = $('sky');
  const sctx = sky.getContext('2d');
  let stars = [];
  function resizeSky() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    sky.width = innerWidth * dpr;
    sky.height = innerHeight * dpr;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round((innerWidth * innerHeight) / 6000) }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: Math.random() * 1.4 + 0.3,
      s: Math.random() * 0.003 + 0.001,
      o: Math.random() * Math.PI * 2,
    }));
  }
  resizeSky();
  addEventListener('resize', resizeSky);
  (function drawSky(t) {
    sctx.clearRect(0, 0, innerWidth, innerHeight);
    const pulse = window.Rhythm.phase(t) < 0.2 ? 1 - window.Rhythm.phase(t) / 0.2 : 0;
    for (const s of stars) {
      sctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(t * s.s + s.o)) + pulse * 0.15;
      sctx.fillStyle = '#fff';
      sctx.beginPath();
      sctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      sctx.fill();
    }
    requestAnimationFrame(drawSky);
  })(0);

  // ---------- الشاشات ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    game.running = id === 'play';
    window.Sound.musicOn = id === 'play';
    if (id === 'play') requestAnimationFrame(() => game.layout());
  }

  // بلّورات الصفحة الرئيسية
  COLORS.forEach((_, i) => {
    const c = document.createElement('canvas');
    c.width = c.height = 92;
    window.Game.drawPiece(c.getContext('2d'), [i], null, 46, 46, 30);
    c.style.animationDelay = i * 0.2 + 's';
    $('homeGems').appendChild(c);
  });

  function soundLabel() {
    $('homeSound').textContent = save.muted ? '🔇 الصوت مقفول' : '🔊 الصوت شغّال';
  }
  window.Sound.setMuted(save.muted);
  soundLabel();
  function toggleSound() {
    save.muted = !save.muted;
    window.Sound.init();
    window.Sound.setMuted(save.muted);
    persist();
    soundLabel();
  }

  $('playBtn').onclick = () => {
    window.Sound.init();
    buildMap();
    show('map');
  };
  $('homeSound').onclick = toggleSound;
  $('mapBack').onclick = () => show('home');

  // ---------- الخريطة ----------
  function buildMap() {
    const box = $('mapScroll');
    box.innerHTML = '';
    let total = 0;
    LEVELS.forEach((lvl, i) => {
      const n = i + 1;
      const st = save.stars[n] || 0;
      total += st;
      const b = document.createElement('button');
      b.className = 'node' + (n > save.unlocked ? ' locked' : st ? ' done' : '') + (n === save.unlocked && !st ? ' current' : '');
      b.textContent = n > save.unlocked ? '🔒' : n.toLocaleString('ar-EG');
      b.style.marginInlineStart = Math.round(Math.sin(i * 0.9) * 110) + 'px';
      const stars = document.createElement('span');
      stars.className = 'stars';
      stars.innerHTML = n > save.unlocked ? '' : '<b>' + '★'.repeat(st) + '</b>' + '★'.repeat(3 - st);
      b.appendChild(stars);
      if (n <= save.unlocked) b.onclick = () => openLevel(i);
      box.appendChild(b);
      if (n === save.unlocked) setTimeout(() => b.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    });
    $('totalStars').textContent = total.toLocaleString('ar-EG');
  }

  // ---------- النوافذ ----------
  function modal(html, actions) {
    const box = $('modalBox');
    box.innerHTML = html + '<div class="actions"></div>';
    const act = box.querySelector('.actions');
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.text;
      b.onclick = () => {
        closeModal();
        a.fn();
      };
      act.appendChild(b);
    }
    $('modal').classList.add('show');
    // بدون ما نعيد بناء العنصر عشان الأنيميشن يشتغل كل مرة
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = '';
  }
  function closeModal() {
    $('modal').classList.remove('show');
  }

  function goalText(g) {
    if (g.type === 'score') return 'اجمع ' + g.n.toLocaleString('ar-EG') + ' نقطة';
    if (g.type === 'color') return 'اجمع ' + g.n.toLocaleString('ar-EG') + ' ' + COLORS[g.color].name;
    return 'اكسر كل الجليد';
  }

  const iconCache = new Map();
  function icon(g) {
    const k = g.type + (g.color == null ? '' : g.color);
    if (!iconCache.has(k)) iconCache.set(k, window.Game.goalIcon(g, 64));
    return iconCache.get(k);
  }

  function openLevel(i) {
    const lvl = LEVELS[i];
    const goals = lvl.goals.map((g) => '<div><img alt="" src="' + icon(g) + '">' + goalText(g) + '</div>').join('');
    modal(
      '<h3>المرحلة ' + (i + 1).toLocaleString('ar-EG') + '</h3>' +
        '<p>عندك ' + lvl.moves.toLocaleString('ar-EG') + ' حركة</p>' +
        '<div class="modal-goals">' + goals + '</div>' +
        (lvl.tip ? '<p class="tip">💡 ' + lvl.tip + '</p>' : ''),
      [
        { text: 'يلا نلعب', cls: 'big', fn: () => startLevel(i) },
        { text: 'رجوع', cls: 'ghost', fn: () => {} },
      ]
    );
  }

  function startLevel(i) {
    show('play');
    window.Sound.init();
    game.load(i);
  }

  // ---------- الـ HUD ----------
  const hud = {
    onHud(s) {
      $('hudLevel').textContent = 'المرحلة ' + (s.level + 1).toLocaleString('ar-EG');
      $('hudMoves').textContent = s.moves.toLocaleString('ar-EG');
      $('hudMoves').parentElement.classList.toggle('low', s.moves <= 3);
      $('hudScore').textContent = s.score.toLocaleString('ar-EG');
      const max = s.stars[2];
      $('scoreFill').style.width = Math.min(100, (s.score / max) * 100) + '%';
      s.stars.forEach((v, k) => {
        const el = $('star' + (k + 1));
        el.style.right = (v / max) * 100 + '%';
        el.classList.toggle('lit', s.score >= v);
      });
      const goals = $('hudGoals');
      goals.innerHTML = '';
      for (const g of s.goals) {
        if (g.type === 'score') continue;
        const d = document.createElement('div');
        d.className = 'goal' + (g.done ? ' done' : '');
        d.innerHTML = '<img alt="" src="' + icon(g) + '"><span>' + (g.done ? '✓' : (g.target - g.have).toLocaleString('ar-EG')) + '</span>';
        goals.appendChild(d);
      }
      const scoreGoal = s.goals.find((g) => g.type === 'score');
      if (scoreGoal) {
        const d = document.createElement('div');
        d.className = 'goal' + (scoreGoal.done ? ' done' : '');
        d.innerHTML = '<img alt="" src="' + icon(scoreGoal) + '"><span>' + (scoreGoal.done ? '✓' : scoreGoal.target.toLocaleString('ar-EG')) + '</span>';
        goals.appendChild(d);
      }
    },
    onBeatFrame(phase, on) {
      if (!game || !game.running) return;
      beatRing.style.transform = 'scale(' + (1 + (1 - phase) * 1.1) + ')';
      beatRing.style.opacity = 0.3 + phase * 0.7;
      beatEl.classList.toggle('on', on);
    },
    onWin(r) {
      const n = r.level + 1;
      save.stars[n] = Math.max(save.stars[n] || 0, r.stars);
      if (save.unlocked === n && n < LEVELS.length) save.unlocked = n + 1;
      persist();
      const last = n >= LEVELS.length;
      modal(
        '<h3>' + (r.stars === 3 ? 'أسطوري!' : r.stars === 2 ? 'عظيم!' : 'كسبت!') + '</h3>' +
          '<div class="big-stars">' + '<b>★</b>'.repeat(r.stars) + '★'.repeat(3 - r.stars) + '</div>' +
          '<div class="final-score">' + r.score.toLocaleString('ar-EG') + '</div>' +
          (last ? '<p>خلّصت كل المراحل! فصول جديدة جاية قريب ✨</p>' : ''),
        (last ? [] : [{ text: 'المرحلة الجاية', cls: 'gold big', fn: () => openLevel(r.level + 1) }]).concat([
          { text: 'العب تاني', fn: () => startLevel(r.level) },
          { text: 'الخريطة', cls: 'ghost', fn: () => { buildMap(); show('map'); } },
        ])
      );
    },
    onLose(r) {
      const left = r.goals.filter((g) => !g.done).map((g) => '<div><img alt="" src="' + icon(g) + '">فاضل ' + (g.target - g.have).toLocaleString('ar-EG') + '</div>').join('');
      modal(
        '<h3>خلصت الحركات</h3><p>كنت قريب! 💫</p><div class="modal-goals">' + left + '</div>',
        [
          { text: 'حاول تاني', cls: 'big', fn: () => startLevel(r.level) },
          { text: 'الخريطة', cls: 'ghost', fn: () => { buildMap(); show('map'); } },
        ]
      );
    },
  };

  const beatEl = $('beat');
  const beatRing = beatEl.querySelector('.beat-ring');
  const game = new window.Game($('board'), hud);
  window.__game = game;

  $('pauseBtn').onclick = () => {
    if (game.ended) return;
    game.paused = true;
    const resume = () => { game.paused = false; game.lastAction = performance.now(); };
    modal('<h3>استراحة</h3>', [
      { text: 'كمّل', cls: 'big', fn: resume },
      { text: 'ابدأ المرحلة من الأول', fn: () => startLevel(game.levelIndex) },
      { text: save.muted ? '🔊 شغّل الصوت' : '🔇 اقفل الصوت', cls: 'ghost', fn: () => { toggleSound(); resume(); } },
      { text: 'الخريطة', cls: 'ghost', fn: () => { buildMap(); show('map'); } },
    ]);
  };
})();
