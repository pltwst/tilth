// Pure game rules: no DOM. State is plain JSON so it can be saved and cloned.
export const SIZE = 4;
export const HARVEST = 'harvest';

// grow = harvests until ripe; decay = harvests until it rots away.
export const KINDS = {
  clover: { name: 'Clover', value: 1, bee: 0.04 },
  poppy: { name: 'Poppy', value: 1, bee: 0.04 },
  bluebell: { name: 'Bluebell', value: 1, bee: 0.05 },
  puffball: { name: 'Puffball', value: 2, decay: 3, bee: 0.08 },
  sunflower: { name: 'Sunflower', value: 3, grow: 2, bee: 0.08 },
  birch: { name: 'Birch', value: 6, grow: 3, bee: 0.1 },
  redwood: { name: 'Redwood', value: 15, grow: 5, bee: 0.12 },
};
const BASICS = ['clover', 'poppy', 'bluebell'];

export const MODES = {
  easy: { name: 'Easy', plants: 2, start: 4, bees: 1.5 },
  normal: { name: 'Normal', plants: 3, start: 6, bees: 1 },
  hard: { name: 'Hard', plants: 4, start: 6, bees: 0.5 },
};
// Games saved before modes existed have no mode: they are normal games.
const mode = (s) => MODES[s.mode] ?? MODES.normal;

export function goal(season) {
  return season <= 0 ? 0 : Math.floor(-64 + 50 * season + 20 * 1.185 ** season);
}

export function scoreGroup(kind, n, bees) {
  return KINDS[kind].value * (n * (n + 1) / 2 + n * bees);
}

export function weights(season) {
  const w = { clover: season <= 3 ? 1.4 : 1, poppy: 1, bluebell: 1 };
  // From season 9 one basic plant rests in turn and puffballs fill the gap.
  if (season >= 9) {
    delete w[BASICS[Math.floor((season - 9) / 4) % 3]];
    w.puffball = 1;
  }
  if (season >= 2) w.sunflower = Math.min(1, 0.3 + 0.06 * (season - 2));
  if (season >= 3) w.birch = Math.min(0.7, 0.15 + 0.03 * (season - 3));
  if (season >= 6) w.redwood = Math.min(0.45, 0.1 + 0.02 * (season - 6));
  return w;
}

// Park–Miller; the state lives in the game state so undo replays the same rolls.
function rand(s) {
  s.rng = (s.rng * 16807) % 2147483647;
  return (s.rng - 1) / 2147483646;
}

function rollKind(s) {
  const w = Object.entries(weights(s.season));
  let r = rand(s) * w.reduce((t, [, v]) => t + v, 0);
  for (const [k, v] of w) if ((r -= v) < 0) return k;
  return w[w.length - 1][0];
}

export function nextToken(s) {
  s.generated += 1;
  if (s.generated % (mode(s).plants + 1) === 0) return { kind: HARVEST };
  const kind = rollKind(s);
  return { kind, bee: rand(s) < KINDS[kind].bee * mode(s).bees };
}

// Plants to place before the next sickle (0 = harvest now). The queue only shows 4 items,
// so on hard the sickle can be out of view.
export function untilHarvest(s) {
  const period = mode(s).plants + 1, front = s.generated - s.queue.length + 1;
  return (period - (front % period)) % period;
}

export function neighbors(i) {
  const x = i % SIZE, y = Math.floor(i / SIZE), out = [];
  if (y > 0) out.push(i - SIZE);
  if (y < SIZE - 1) out.push(i + SIZE);
  if (x > 0) out.push(i - 1);
  if (x < SIZE - 1) out.push(i + 1);
  return out;
}

export const ripe = (p) => !!p && p.age >= (KINDS[p.kind].grow ?? 0);

export function groupAt(s, i) {
  const p = s.plants[i];
  if (!ripe(p)) return [];
  const seen = new Set([i]), stack = [i];
  while (stack.length) {
    for (const n of neighbors(stack.pop())) {
      const q = s.plants[n];
      if (!seen.has(n) && s.soil[n] === s.soil[i] && ripe(q) && q.kind === p.kind) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return [...seen];
}

export function newGame(seed = Date.now(), modeName = 'normal') {
  const s = {
    mode: modeName,
    rng: (Math.abs(Math.floor(seed)) % 2147483646) + 1,
    soil: [], plants: Array(SIZE * SIZE).fill(null), queue: [],
    score: 0, season: 1, generated: 0, over: false, prev: null,
  };
  s.soil = Array(SIZE * SIZE).fill(Math.floor(rand(s) * 3));
  // Two short random walks raise the soil, so the garden starts with a few patches.
  for (let w = 0; w < 2; w++) {
    let i = Math.floor(rand(s) * 16);
    const raised = new Set();
    for (let step = 0; step < 4; step++) {
      if (!raised.has(i)) s.soil[i] = (s.soil[i] + 1) % 3;
      raised.add(i);
      const n = neighbors(i);
      i = n[Math.floor(rand(s) * n.length)];
    }
  }
  for (let placed = 0; placed < mode(s).start;) {
    const i = Math.floor(rand(s) * 16);
    if (s.plants[i]) continue;
    const kind = rollKind(s);
    s.plants[i] = { kind, age: 0, bee: rand(s) < KINDS[kind].bee * mode(s).bees };
    placed++;
  }
  while (s.queue.length < 4) s.queue.push(nextToken(s));
  return s;
}

function isOver(s) {
  if (s.queue[0].kind === HARVEST) return !s.plants.some(ripe);
  return s.plants.every(Boolean);
}

// Returns { state, event } or null when the move is not allowed.
export function play(state, i) {
  if (state.over) return null;
  const token = state.queue[0];
  const s = structuredClone({ ...state, prev: null });
  let event;

  if (token.kind !== HARVEST) {
    if (s.plants[i]) return null;
    s.plants[i] = { kind: token.kind, age: 0, bee: token.bee };
    event = { type: 'plant', index: i };
  } else {
    const group = groupAt(s, i);
    if (!group.length) return null;
    const kind = s.plants[i].kind;
    const bees = group.filter((g) => s.plants[g].bee).length;
    const points = scoreGroup(kind, group.length, bees);
    for (const g of group) {
      s.plants[g] = null;
      s.soil[g] = (s.soil[g] + 1) % 3;
    }
    s.score += points;
    const before = s.season;
    while (s.score >= goal(s.season)) s.season++;

    const matured = [], decayed = [];
    s.plants.forEach((p, n) => {
      if (!p) return;
      p.age++;
      const k = KINDS[p.kind];
      if (k.grow && p.age === k.grow) matured.push(n);
      if (k.decay && p.age >= (k.grow ?? 0) + k.decay) {
        s.plants[n] = null;
        decayed.push(n);
      }
    });
    event = { type: 'harvest', harvested: group, kind, points, bees, matured, decayed, seasonUp: s.season > before };
  }

  s.queue.shift();
  s.queue.push(nextToken(s));
  s.over = isOver(s);
  s.prev = { ...state, prev: null };
  return { state: s, event };
}

export function undo(state) {
  return state.prev ? { ...structuredClone(state.prev), prev: null } : null;
}
