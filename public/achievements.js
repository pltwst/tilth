// Achievements: each test looks at the state after a move and the move's event.
const SCORE = { easy: [1000, 2500, 5000], normal: [300, 750, 1500], hard: [150, 400, 800] };
const target = (s, level) => (SCORE[s.mode] ?? SCORE.normal)[level];
const fmt = (n) => n.toLocaleString('en-US');
const scoreDesc = (level) =>
  `score ${fmt(SCORE.normal[level])} in one garden (Easy ${fmt(SCORE.easy[level])}, Hard ${fmt(SCORE.hard[level])})`;

const harvested = (e) => e.type === 'harvest';
const finished = (s) => s.over;
const grew = (kind) => (s, e) => harvested(e) && e.matured.some((n) => s.plants[n]?.kind === kind);

export const ACHIEVEMENTS = [
  { id: 'first-furrow', name: 'First Furrow', desc: 'finish your first garden', test: finished },
  { id: 'gentle-hands', name: 'Gentle Hands', desc: 'finish a garden on Easy', test: (s) => finished(s) && s.mode === 'easy' },
  { id: 'green-thumb', name: 'Green Thumb', desc: 'finish a garden on Normal', test: (s) => finished(s) && (s.mode ?? 'normal') === 'normal' },
  { id: 'iron-trowel', name: 'Iron Trowel', desc: 'finish a garden on Hard', test: (s) => finished(s) && s.mode === 'hard' },
  { id: 'good-yield', name: 'Good Yield', desc: scoreDesc(0), test: (s) => s.score >= target(s, 0) },
  { id: 'rich-harvest', name: 'Rich Harvest', desc: scoreDesc(1), test: (s) => s.score >= target(s, 1) },
  { id: 'bumper-crop', name: 'Bumper Crop', desc: scoreDesc(2), test: (s) => s.score >= target(s, 2) },
  { id: 'second-spring', name: 'Second Spring', desc: 'reach season 3', test: (s) => s.season >= 3 },
  { id: 'old-almanac', name: 'Old Almanac', desc: 'reach season 10', test: (s) => s.season >= 10 },
  { id: 'bouquet', name: 'Bouquet', desc: 'harvest a group of 6', test: (s, e) => harvested(e) && e.harvested.length >= 6 },
  { id: 'meadow', name: 'Meadow', desc: 'harvest a group of 10', test: (s, e) => harvested(e) && e.harvested.length >= 10 },
  { id: 'prairie', name: 'Prairie', desc: 'harvest a group of 14', test: (s, e) => harvested(e) && e.harvested.length >= 14 },
  { id: 'full-basket', name: 'Full Basket', desc: 'score 100 points with one harvest', test: (s, e) => harvested(e) && e.points >= 100 },
  { id: 'patience', name: 'Patience', desc: 'grow a sunflower', test: grew('sunflower') },
  { id: 'giant', name: 'Giant', desc: 'grow a redwood', test: grew('redwood') },
  { id: 'forager', name: 'Forager', desc: 'harvest a puffball', test: (s, e) => harvested(e) && e.kind === 'puffball' },
  { id: 'compost', name: 'Compost', desc: 'let a puffball rot', test: (s, e) => harvested(e) && e.decayed.length > 0 },
  { id: 'buzzing', name: 'Buzzing', desc: 'harvest a group with a bee', test: (s, e) => harvested(e) && e.bees > 0 },
  { id: 'monoculture', name: 'Monoculture', desc: 'turn the whole garden into one soil', test: (s) => s.soil.every((v) => v === s.soil[0]) },
  { id: 'clean-slate', name: 'Clean Slate', desc: 'harvest until the garden is empty', test: (s, e) => harvested(e) && s.plants.every((p) => !p) },
  { id: 'no-regrets', name: 'No Regrets', desc: 'finish a garden without undo', test: (s) => finished(s) && !s.undone },
];

// Ids of every achievement that this move satisfies (already-unlocked ones included).
export function unlocked(state, event) {
  return ACHIEVEMENTS.filter((a) => a.test(state, event)).map((a) => a.id);
}
