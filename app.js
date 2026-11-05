import { newGame, play, undo, groupAt, scoreGroup, goal, ripe, KINDS, HARVEST } from './game.js';
import { plantArt, sickleArt, beeArt } from './art.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: play without saving */ } },
};
const KEY = 'tilth.v1.game', BEST = 'tilth.v1.best', SEEN = 'tilth.v1.help';
const SOIL = ['clay', 'ochre', 'lilac'];

let state = store.get(KEY);
if (!state || state.over || !Array.isArray(state.plants)) state = newGame();
let best = store.get(BEST) || 0;
let bestBefore = best; // a reload mid-game can hide a "new best"; fine for v1
const drawn = []; // last plant markup per tile, so unchanged tiles keep their animation state

const board = $('board');
const tiles = Array.from({ length: 16 }, (_, i) => {
  const t = document.createElement('button');
  t.className = 'tile';
  t.setAttribute('role', 'gridcell');
  t.innerHTML = '<span class="edge"></span><span class="top"></span>'
    + '<span class="notch tl"></span><span class="notch tr"></span><span class="notch bl"></span><span class="notch br"></span>'
    + '<span class="plant"></span><span class="pips"></span>';
  t.addEventListener('click', () => tap(i));
  t.addEventListener('pointerenter', () => preview(i));
  t.addEventListener('pointerleave', () => { clearPreview(); hint(); });
  board.append(t);
  return t;
});

function plantMarkup(p) {
  if (!p) return '';
  return plantArt(p, ripe(p)) + (p.bee ? beeArt() : '');
}

// Pips count harvests left: until ripe for trees, until rotten for puffballs.
function pips(p) {
  if (!p) return '';
  const k = KINDS[p.kind];
  const total = !ripe(p) ? k.grow : k.decay;
  if (!total) return '';
  const start = !ripe(p) ? 0 : k.grow ?? 0;
  return Array.from({ length: total }, (_, n) => `<i class="${n < p.age - start ? 'done' : ''}"></i>`).join('');
}

// Tiles of the same soil join into one field: no gap and no rounded corner on a joined side.
// The "next soil" edge shows only where the field ends at the bottom.
function fieldShape(i) {
  const s = state.soil[i], x = i % 4, y = Math.floor(i / 4);
  const same = (dx, dy) => x + dx >= 0 && x + dx < 4 && y + dy >= 0 && y + dy < 4 && state.soil[i + dx + 4 * dy] === s;
  const up = same(0, -1), down = same(0, 1), left = same(-1, 0), right = same(1, 0);
  // Inner corner: both sides join, but the diagonal cell is another field. Cut a notch there,
  // or this cell fills a corner that its neighbors leave open.
  const notches = [
    up && left && !same(-1, -1) && 'tl', up && right && !same(1, -1) && 'tr',
    down && left && !same(-1, 1) && 'bl', down && right && !same(1, 1) && 'br',
  ].filter(Boolean);
  const g = (joined) => (joined ? '0px' : 'calc(var(--gap) + 1px)');
  const r = (a, b) => (a || b ? '0px' : 'var(--radius)');
  const sides = `${g(up)} ${g(right)}`, lip = down ? '0px' : 'var(--lip)';
  const radii = `${r(up, left)} ${r(up, right)} ${r(down, right)} ${r(down, left)}`;
  return {
    top: `inset(${sides} calc(${g(down)} + ${lip}) ${g(left)} round ${radii})`,
    edge: `inset(${sides} ${g(down)} ${g(left)} round ${radii})`,
    notches,
  };
}

function render() {
  state.plants.forEach((p, i) => {
    const t = tiles[i], s = state.soil[i];
    const shape = fieldShape(i);
    t.className = `tile s${s} n${(s + 1) % 3}${(i + Math.floor(i / 4)) % 2 ? ' odd' : ''}${shape.notches.map((c) => ` c-${c}`).join('')}`;
    t.style.setProperty('--clip-top', shape.top);
    t.style.setProperty('--clip-edge', shape.edge);
    const html = plantMarkup(p);
    if (drawn[i] !== html) {
      t.querySelector('.plant').innerHTML = html;
      drawn[i] = html;
    }
    t.querySelector('.pips').innerHTML = pips(p);
    t.setAttribute('aria-label', `${p ? KINDS[p.kind].name + (ripe(p) ? '' : ', growing') + (p.bee ? ', with bee' : '') : 'Empty'}, ${SOIL[s]} soil, next ${SOIL[(s + 1) % 3]}`);
  });

  $('queue').innerHTML = state.queue
    .map((t) => `<li aria-label="${t.kind === HARVEST ? 'Sickle' : KINDS[t.kind].name}">${t.kind === HARVEST ? sickleArt() : plantArt({ kind: t.kind, age: 0 }, true) + (t.bee ? beeArt() : '')}</li>`)
    .join('');

  $('score').value = state.score;
  $('best').value = best;
  const lo = goal(state.season - 1), hi = goal(state.season);
  $('season-label').textContent = `Season ${state.season}`;
  $('season-bar').style.width = `${Math.min(100, ((state.score - lo) / (hi - lo)) * 100)}%`;
  $('season-goal').textContent = `${state.score} / ${hi}`;
  $('undo').disabled = !state.prev || state.over;
  hint();
}

function hint(extra) {
  const t = state.queue[0];
  if (t.kind === HARVEST) {
    $('hint').innerHTML = extra ?? 'Harvest a group<small>Tap a ripe plant</small>';
  } else {
    const left = state.queue.findIndex((q) => q.kind === HARVEST);
    $('hint').innerHTML = `Plant the ${KINDS[t.kind].name.toLowerCase()}<small>${left === 1 ? 'Harvest next' : `Harvest in ${left}`}</small>`;
  }
}

function preview(i) {
  clearPreview();
  if (state.over || state.queue[0].kind !== HARVEST) return;
  const g = groupAt(state, i);
  if (!g.length) return;
  g.forEach((n) => tiles[n].classList.add('hl'));
  const bees = g.filter((n) => state.plants[n].bee).length;
  const pts = scoreGroup(state.plants[i].kind, g.length, bees);
  hint(`+${pts} points<small>${g.length} × ${KINDS[state.plants[i].kind].name.toLowerCase()}${bees ? `, ${bees} bee${bees > 1 ? 's' : ''}` : ''}</small>`);
}
const clearPreview = () => tiles.forEach((t) => t.classList.remove('hl'));

function ghost(i, cls = '') {
  const fx = $('fx').getBoundingClientRect();
  const r = tiles[i].querySelector('.plant').getBoundingClientRect();
  const g = document.createElement('div');
  g.className = `ghost ${cls}`;
  Object.assign(g.style, { left: `${r.left - fx.left}px`, top: `${r.top - fx.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  g.innerHTML = drawn[i];
  $('fx').append(g);
  g.addEventListener('animationend', () => g.remove());
}

function popup(i, text) {
  const fx = $('fx').getBoundingClientRect(), r = tiles[i].getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'points';
  p.textContent = text;
  Object.assign(p.style, { left: `${r.left + r.width / 2 - fx.left}px`, top: `${r.top + r.height / 3 - fx.top}px` });
  $('fx').append(p);
  p.addEventListener('animationend', () => p.remove());
}

let toastTimer;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

function restart(t, cls) {
  t.classList.remove(cls);
  void t.offsetWidth; // restart the CSS animation
  t.classList.add(cls);
}

function tap(i) {
  const r = play(state, i);
  if (!r) {
    if (!state.over) restart(tiles[i], 'shake');
    return;
  }
  const { event } = r;
  clearPreview();
  if (event.type === 'harvest') {
    event.harvested.forEach((n) => ghost(n));
    event.decayed.forEach((n) => ghost(n, 'rot'));
    popup(i, `+${event.points}`);
  }
  state = r.state;
  if (state.score > best) best = state.score;
  store.set(KEY, state);
  store.set(BEST, best);
  render();

  if (event.type === 'plant') {
    restart(tiles[i].querySelector('.plant'), 'pop');
    navigator.vibrate?.(8);
  } else {
    event.matured.forEach((n) => restart(tiles[n].querySelector('.plant'), 'grow'));
    if (event.seasonUp) setTimeout(() => toast(`Season ${state.season}`), 350);
  }
  document.querySelector('.queue li:last-child')?.classList.add('enter');
  if (state.over) setTimeout(showOver, 900);
}

function showOver() {
  $('final-score').value = state.score;
  $('final-best').textContent = state.score > bestBefore ? 'New best!' : `Best ${best}`;
  $('over').showModal();
}

function startNew() {
  bestBefore = best;
  state = newGame();
  drawn.length = 0;
  store.set(KEY, state);
  render();
}

$('undo').addEventListener('click', () => {
  const s = undo(state);
  if (s) { state = s; store.set(KEY, state); render(); }
});
$('new-btn').addEventListener('click', () => (state.over ? startNew() : $('confirm').showModal()));
$('confirm').addEventListener('close', () => $('confirm').returnValue === 'new' && startNew());
$('over').addEventListener('close', startNew);
$('help-btn').addEventListener('click', () => $('help').showModal());

// Theme: follows the system until the player taps the toggle; then the choice is saved.
const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>';
const systemDark = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#1e1916' : '#f8f3ea';
  const next = theme === 'dark' ? 'light' : 'dark';
  $('theme-btn').innerHTML = theme === 'dark' ? SUN : MOON;
  $('theme-btn').setAttribute('aria-label', `Switch to ${next} theme`);
}
applyTheme(document.documentElement.dataset.theme);
$('theme-btn').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('tilth.theme', theme); } catch { /* not saved; still switches */ }
  applyTheme(theme);
});
systemDark.addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem('tilth.theme'); } catch { /* ignore */ }
  if (!saved) applyTheme(e.matches ? 'dark' : 'light');
});

$('legend').innerHTML = Object.entries(KINDS)
  .map(([kind, k]) => `<tr><td>${plantArt({ kind, age: 0 }, true)}</td><td>${k.name}</td><td>${k.value} pt${k.value > 1 ? 's' : ''}${k.grow ? ` · grows in ${k.grow}` : ''}${k.decay ? ` · rots after ${k.decay}` : ''}</td></tr>`)
  .join('');

render();
if (!store.get(SEEN)) { store.set(SEEN, true); $('help').showModal(); }
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js');
// Ask the browser not to clear saved games and scores when the device runs low on space.
navigator.storage?.persist?.().catch(() => {});
