// تشغيل: node tests/engine.test.js
'use strict';
const assert = require('assert');
const Engine = require('../js/engine.js');
const LEVELS = require('../js/levels.js');

function noMatchesAfterSettle(e) {
  assert.strictEqual(e.findGroups().length, 0, 'board should be stable');
  for (let r = 0; r < e.rows; r++)
    for (let c = 0; c < e.cols; c++)
      if (e.mask[r][c]) assert.ok(e.grid[r][c], `cell ${r},${c} should be filled`);
      else assert.strictEqual(e.grid[r][c], null, `void ${r},${c} must stay empty`);
}

function allValidMoves(e) {
  const moves = [];
  for (let r = 0; r < e.rows; r++)
    for (let c = 0; c < e.cols; c++)
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const a = [r, c], b = [r + dr, c + dc];
        if (!e.inside(...a) || !e.inside(...b)) continue;
        const p1 = e.grid[r][c], p2 = e.grid[b[0]][b[1]];
        if (p1.special === 'prism' || p2.special === 'prism' || (p1.special && p2.special)) { moves.push([a, b]); continue; }
        e.swapCells(a, b);
        const ok = e.findGroups().length > 0;
        e.swapCells(a, b);
        if (ok) moves.push([a, b]);
      }
  return moves;
}

function blankLevel(colors) {
  return { moves: 30, colors, goals: [{ type: 'score', n: 1 }] };
}

// 1) لوحة البداية ما فيهاش تطابق وفيها حركة ممكنة
for (let s = 1; s <= 50; s++) {
  const e = new Engine(blankLevel(5), s);
  assert.strictEqual(e.findGroups().length, 0);
  assert.ok(e.findHint());
}

// 2) صف من 4 بيولّد وتر، و5 بيولّد منشور، و L بيولّد نجمة
function rig(rowsSpec) {
  const e = new Engine(blankLevel(5), 7);
  rowsSpec.forEach((row, r) => [...row].forEach((ch, c) => {
    e.grid[r][c] = e.newPiece([Number(ch)]);
  }));
  return e;
}
{
  const e = rig([
    '00100234',
    '23412341',
    '34123412',
    '41234123',
    '12341234',
    '23412341',
    '34123412',
    '41234123',
  ]);
  // تبديل (0,2) مع (1,2): لون 1 ينزل ولون 4... نخلي (1,2)=0
  e.grid[1][2] = e.newPiece([0]);
  const res = e.trySwap([1, 2], [0, 2]);
  assert.ok(res.valid);
  const clear = res.steps.find((s) => s.type === 'clear');
  assert.ok(clear.spawns.some((s) => s.piece.special === 'prism'), 'five in a row makes a prism');
}
{
  const e = rig([
    '00102234',
    '23412341',
    '34123412',
    '41234123',
    '12341234',
    '23412341',
    '34123412',
    '41234123',
  ]);
  e.grid[1][2] = e.newPiece([0]);
  const res = e.trySwap([1, 2], [0, 2]);
  assert.ok(res.valid);
  const clear = res.steps.find((s) => s.type === 'clear');
  assert.ok(clear.spawns.some((s) => s.piece.special === 'v'), 'four in a row makes a stripe');
}
{
  const e = rig([
    '01123412',
    '02341234',
    '13412341',
    '04123412',
    '41234123',
    '12341234',
    '23412341',
    '34123412',
  ]);
  // L: (0,0),(1,0),(2,0 بعد التبديل),(2,1)?? نبني L واضح
  e.grid[2][0] = e.newPiece([1]);
  e.grid[2][1] = e.newPiece([0]);
  e.grid[2][2] = e.newPiece([0]);
  e.grid[3][0] = e.newPiece([0]);
  // تبديل (3,0) مع (2,0) => عمود 0..2 و صف 2 كلهم لون 0
  const res = e.trySwap([3, 0], [2, 0]);
  assert.ok(res.valid);
  const clear = res.steps.find((s) => s.type === 'clear');
  assert.ok(clear.spawns.some((s) => s.piece.special === 'bomb'), 'L shape makes a bomb');
}

// 3) خلط الألوان: تطابقين بلونين مختلفين في نفس الحركة => بلورة مخلوطة
{
  const e = rig([
    '00234123',
    '11023412',
    '34123412',
    '41234123',
    '12341234',
    '23412341',
    '34123412',
    '41234123',
  ]);
  // تبديل (0,2) و (1,2): صف 0 = 0 0 0 ، صف 1 = 1 1 2 ... نخلي (0,2)=1
  e.grid[0][2] = e.newPiece([1]);
  e.grid[1][2] = e.newPiece([0]);
  const res = e.trySwap([0, 2], [1, 2]);
  assert.ok(res.valid);
  const clear = res.steps.find((s) => s.type === 'clear');
  const mix = clear.spawns.find((s) => s.mix);
  assert.ok(mix, 'double-colour move creates a mixed crystal');
  assert.deepStrictEqual(mix.piece.colors.slice().sort(), [0, 1]);
  assert.ok(Engine.has(mix.piece, 0) && Engine.has(mix.piece, 1));
}

// 4) لعب عشوائي طويل على كل المراحل: اللوحة تفضل سليمة دايماً
let totalMoves = 0;
LEVELS.forEach((lvl, i) => {
  for (let s = 0; s < 3; s++) {
    const e = new Engine(Object.assign({}, lvl, { moves: 60 }), 1000 + i * 10 + s);
    while (e.movesLeft > 0) {
      const moves = allValidMoves(e);
      assert.ok(moves.length > 0, `level ${i + 1}: there must always be a move`);
      const [a, b] = moves[Math.floor(e.rng() * moves.length)];
      const res = e.trySwap(a, b);
      assert.ok(res.valid);
      noMatchesAfterSettle(e);
      totalMoves++;
    }
    e.movesLeft = 5;
    e.finale();
    noMatchesAfterSettle(e);
  }
});

// 5) حركة غلط ما بتغيّرش اللوحة وما بتخصمش حركة
{
  const e = new Engine(blankLevel(5), 3);
  const before = JSON.stringify(e.grid);
  let found = false;
  for (let r = 0; r < 8 && !found; r++)
    for (let c = 0; c < 7 && !found; c++) {
      const p1 = e.grid[r][c], p2 = e.grid[r][c + 1];
      if (p1.special || p2.special) continue;
      e.swapCells([r, c], [r, c + 1]);
      const ok = e.findGroups().length;
      e.swapCells([r, c], [r, c + 1]);
      if (!ok) {
        const res = e.trySwap([r, c], [r, c + 1]);
        assert.ok(!res.valid);
        assert.strictEqual(JSON.stringify(e.grid), before);
        assert.strictEqual(e.movesLeft, 30);
        found = true;
      }
    }
  assert.ok(found);
}

console.log(`all engine tests passed (${totalMoves} random moves played)`);
