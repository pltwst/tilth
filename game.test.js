import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, play, undo, groupAt, scoreGroup, goal, HARVEST } from './game.js';

const plant = (kind, extra = {}) => ({ kind, age: 0, bee: false, ...extra });

// Empty board on soil 0 with a fixed queue, so tests control every move.
function board({ soil = Array(16).fill(0), plants = {}, queue = ['clover', 'clover', 'clover', HARVEST] } = {}) {
  const s = newGame(1);
  s.soil = [...soil];
  s.plants = Array(16).fill(null);
  for (const [i, p] of Object.entries(plants)) s.plants[i] = p;
  s.queue = queue.map((k) => (k === HARVEST ? { kind: HARVEST } : { kind: k, bee: false }));
  return s;
}

test('score is value × (n(n+1)/2 + n·bees)', () => {
  assert.equal(scoreGroup('clover', 3, 0), 6);
  assert.equal(scoreGroup('clover', 3, 1), 9);
  assert.equal(scoreGroup('redwood', 4, 0), 150);
  assert.equal(scoreGroup('clover', 1, 0), 1);
});

test('season goals follow the curve', () => {
  assert.deepEqual([1, 2, 3, 10].map(goal), [9, 64, 119, 545]);
});

test('new game: 4×4, 6 plants, queue is plant plant plant harvest', () => {
  const s = newGame(42);
  assert.equal(s.soil.length, 16);
  assert.equal(s.plants.filter(Boolean).length, 6);
  assert.deepEqual(s.queue.map((t) => t.kind === HARVEST), [false, false, false, true]);
  assert.deepEqual(newGame(42), s, 'same seed gives same game');
});

test('group: same kind, same soil, orthogonal only', () => {
  const soil = Array(16).fill(0);
  soil[2] = 1;
  const s = board({
    soil,
    plants: { 0: plant('clover'), 1: plant('clover'), 2: plant('clover'), 4: plant('poppy'), 5: plant('clover') },
  });
  assert.deepEqual(groupAt(s, 0).sort((a, b) => a - b), [0, 1, 5]); // 2 is other soil, 4 other kind
  const d = board({ plants: { 0: plant('clover'), 5: plant('clover') } });
  assert.deepEqual(groupAt(d, 0), [0], 'diagonal does not connect');
  assert.deepEqual(groupAt(d, 3), [], 'empty tile has no group');
});

test('young plants are not harvestable', () => {
  const s = board({ plants: { 0: plant('birch', { age: 2 }), 1: plant('birch', { age: 3 }) } });
  assert.deepEqual(groupAt(s, 0), []);
  assert.deepEqual(groupAt(s, 1), [1]);
});

test('placing plants follows the queue; invalid moves are refused', () => {
  let s = board({ plants: { 5: plant('poppy') } });
  assert.equal(play(s, 5), null, 'cannot plant on an occupied tile');
  s = play(s, 0).state;
  assert.equal(s.plants[0].kind, 'clover');
  s = play(play(s, 1).state, 2).state;
  assert.equal(s.queue[0].kind, HARVEST);
  assert.equal(play(s, 3), null, 'cannot harvest an empty tile');
  assert.equal(s.queue.length, 4);
});

test('harvest: removes group, cycles soil, scores, ages the rest', () => {
  const soil = Array(16).fill(0);
  soil[1] = 2;
  const s = board({
    soil,
    plants: { 0: plant('clover', { bee: true }), 1: plant('clover'), 8: plant('sunflower', { age: 1 }) },
    queue: [HARVEST, 'clover', 'clover', 'clover'],
  });
  const { state, event } = play(s, 0);
  assert.deepEqual(event.harvested, [0]);
  assert.equal(state.plants[0], null);
  assert.equal(state.soil[0], 1);
  assert.equal(state.soil[1], 2, 'tile outside the group keeps its soil');
  assert.equal(state.score, 1 * (1 + 1));
  assert.equal(state.plants[8].age, 2);
  assert.deepEqual(event.matured, [8]);
  assert.equal(state.plants[1].age, 1);
});

test('soil level 2 cycles back to 0', () => {
  const s = board({ soil: Array(16).fill(2), plants: { 0: plant('clover') }, queue: [HARVEST, 'clover', 'clover', 'clover'] });
  assert.equal(play(s, 0).state.soil[0], 0);
});

test('puffball decays after 3 harvests, with no points', () => {
  let s = board({ plants: { 15: plant('puffball'), 0: plant('clover'), 1: plant('poppy'), 2: plant('clover') } });
  for (const i of [0, 1, 2]) {
    s.queue = [{ kind: HARVEST }, { kind: 'clover', bee: false }, { kind: 'clover', bee: false }, { kind: 'clover', bee: false }];
    const r = play(s, i);
    s = r.state;
    if (i < 2) assert.ok(s.plants[15], 'still there');
    else assert.deepEqual(r.event.decayed, [15]);
  }
  assert.equal(s.plants[15], null);
  assert.equal(s.soil[15], 0, 'decay does not change soil');
  assert.equal(s.score, 3);
});

test('game over: next is a plant and the board is full', () => {
  const plants = {};
  for (let i = 0; i < 15; i++) plants[i] = plant(i % 2 ? 'poppy' : 'clover');
  const s = board({ plants, queue: ['bluebell', 'clover', HARVEST, 'clover'] });
  assert.equal(play(s, 15).state.over, true);
});

test('game over: next is harvest and nothing is ripe', () => {
  const s = board({ plants: { 0: plant('redwood') }, queue: ['clover', HARVEST, 'clover', 'clover'] });
  assert.equal(play(s, 5).state.over, false, 'the new clover is ripe');
  const t = board({ plants: { 0: plant('redwood') }, queue: ['birch', HARVEST, 'clover', 'clover'] });
  assert.equal(play(t, 5).state.over, true);
});

test('season goes up when score reaches the goal', () => {
  const plants = {};
  for (let i = 0; i < 4; i++) plants[i] = plant('clover');
  const s = board({ plants, queue: [HARVEST, 'clover', 'clover', 'clover'] });
  const r = play(s, 0).state; // 10 points ≥ goal(1) = 9
  assert.equal(r.score, 10);
  assert.equal(r.season, 2);
});

test('undo restores the previous state, including the random roll', () => {
  const s0 = newGame(7);
  const empty = s0.plants.indexOf(null);
  const s1 = play(s0, empty).state;
  const back = undo(s1);
  assert.deepEqual({ ...back, prev: null }, { ...s0, prev: null });
  assert.equal(undo(back), null, 'only one level of undo');
  assert.deepEqual(play(back, empty).state.queue, s1.queue, 'same roll after undo');
});
