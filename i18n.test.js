import test from 'node:test';
import assert from 'node:assert/strict';
import { HU, detect } from './public/i18n.js';
import { KINDS, MODES } from './public/game.js';
import { ACHIEVEMENTS } from './public/achievements.js';

test('device language picks the first supported one, else English', () => {
  assert.equal(detect(['hu-HU', 'en-US']), 'hu');
  assert.equal(detect(['de-DE', 'hu']), 'hu');
  assert.equal(detect(['de-DE', 'en-GB', 'hu']), 'en');
  assert.equal(detect(['fr']), 'en');
  assert.equal(detect([]), 'en');
});

test('every plant, mode and achievement has a Hungarian text', () => {
  const names = [...Object.values(KINDS), ...Object.values(MODES)].map((k) => k.name);
  const ach = ACHIEVEMENTS.flatMap((a) => [a.name, a.desc]);
  const plant = Object.keys(KINDS).map((k) => `Plant the ${k}`);
  assert.deepEqual([...names, ...ach, ...plant].filter((en) => !HU[en]), []);
});

test('translations keep the same placeholders', () => {
  const vars = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  assert.deepEqual(Object.entries(HU).filter(([en, hu]) => vars(en) !== vars(hu)), []);
});
