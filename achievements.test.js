import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, unlocked } from './public/achievements.js';
import { newGame, play, undo } from './public/game.js';

const P = (kind, age = 0) => ({ kind, age, bee: false });
const state = (over = {}) => ({ ...newGame(1), soil: [0, 1, ...Array(14).fill(2)], plants: Array(16).fill(null), score: 0, season: 1, ...over });
const harvest = (over = {}) => ({ type: 'harvest', harvested: [0], kind: 'clover', points: 1, bees: 0, matured: [], decayed: [], seasonUp: false, ...over });
const ids = (s, e) => unlocked(s, e).sort();

test('there are 21 achievements with unique ids', () => {
  assert.equal(ACHIEVEMENTS.length, 21);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 21);
});

test('a plain placement unlocks nothing', () => {
  const s = state({ plants: [P('clover'), ...Array(15).fill(null)] });
  assert.deepEqual(ids(s, { type: 'plant', index: 0 }), []);
});

test('group sizes, big harvests, bees and puffballs', () => {
  const s = state({ plants: [P('clover'), ...Array(15).fill(null)] });
  assert.deepEqual(ids(s, harvest({ harvested: [1, 2, 3, 4, 5, 6] })), ['bouquet']);
  assert.deepEqual(ids(s, harvest({ harvested: Array(14).fill(0) })), ['bouquet', 'meadow', 'prairie']);
  assert.deepEqual(ids(s, harvest({ points: 100 })), ['full-basket']);
  assert.deepEqual(ids(s, harvest({ bees: 1 })), ['buzzing']);
  assert.deepEqual(ids(s, harvest({ kind: 'puffball' })), ['forager']);
  assert.deepEqual(ids(s, harvest({ decayed: [7] })), ['compost']);
});

test('trees that grow up', () => {
  const plants = Array(16).fill(null);
  plants[3] = P('sunflower', 2);
  plants[4] = P('redwood', 5);
  plants[5] = P('clover');
  const s = state({ plants });
  assert.deepEqual(ids(s, harvest({ matured: [3, 4] })), ['giant', 'patience']);
});

test('soil: one color everywhere, and a cleared garden', () => {
  const plants = [P('clover'), ...Array(15).fill(null)];
  assert.deepEqual(ids(state({ soil: Array(16).fill(1), plants }), harvest()), ['monoculture']);
  assert.deepEqual(ids(state(), harvest()), ['clean-slate']);
});

test('score targets depend on the mode', () => {
  const plants = [P('clover'), ...Array(15).fill(null)];
  assert.deepEqual(ids(state({ plants, score: 300 }), harvest()), ['good-yield']);
  assert.deepEqual(ids(state({ plants, score: 300, mode: 'easy' }), harvest()), []);
  assert.deepEqual(ids(state({ plants, score: 150, mode: 'hard' }), harvest()), ['good-yield']);
  assert.deepEqual(ids(state({ plants, score: 1500 }), harvest()), ['bumper-crop', 'good-yield', 'rich-harvest']);
});

test('seasons', () => {
  const plants = [P('clover'), ...Array(15).fill(null)];
  assert.deepEqual(ids(state({ plants, season: 3 }), harvest()), ['second-spring']);
  assert.deepEqual(ids(state({ plants, season: 10 }), harvest()), ['old-almanac', 'second-spring']);
});

test('finishing a garden, per mode, and without undo', () => {
  const plants = [P('clover'), ...Array(15).fill(null)];
  const place = { type: 'plant', index: 0 };
  assert.deepEqual(ids(state({ plants, over: true, mode: 'hard' }), place), ['first-furrow', 'iron-trowel', 'no-regrets']);
  assert.deepEqual(ids(state({ plants, over: true, mode: 'easy', undone: true }), place), ['first-furrow', 'gentle-hands']);
  assert.deepEqual(ids(state({ plants, over: true }), place), ['first-furrow', 'green-thumb', 'no-regrets']);
});

test('undo marks the garden as undone, and the mark stays', () => {
  const s0 = newGame(7);
  const back = undo(play(s0, s0.plants.indexOf(null)).state);
  assert.equal(back.undone, true);
  assert.equal(play(back, back.plants.indexOf(null)).state.undone, true);
});
