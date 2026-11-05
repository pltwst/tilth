import { newGame, play, undo, groupAt, scoreGroup, goal, ripe, untilHarvest, KINDS, MODES, HARVEST } from './game.js';
import { plantArt, sickleArt, beeArt } from './art.js';
import { sfx, setSound } from './sound.js';
import { icon } from './icons.js';
import { ACHIEVEMENTS, unlocked } from './achievements.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: play without saving */ } },
};
const ACH = 'tilth.achievements';
const KEY = 'tilth.v1.game', BEST = 'tilth.v1.best', SEEN = 'tilth.v1.help', SOUND = 'tilth.sound', PREF = 'tilth.mode';
const SOIL = ['clay', 'ochre', 'lilac'];

let state = store.get(KEY);
if (!state || state.over || !Array.isArray(state.plants)) state = newGame();
const modeOf = (s) => (MODES[s.mode] ? s.mode : 'normal');
// Each mode keeps its own best. Normal keeps the old key, so earlier scores stay.
const bestKey = (m) => (m === 'normal' ? BEST : `${BEST}.${m}`);
let best = store.get(bestKey(modeOf(state))) || 0;
// The mode for the next new garden: set in settings or in the New garden sheet.
let preferred = MODES[store.get(PREF)] ? store.get(PREF) : modeOf(state);
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
  $('season-label').textContent = `Season ${state.season} · ${MODES[modeOf(state)].name}`;
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
    const left = untilHarvest(state);
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

// Toasts wait in line, so a season toast and an achievement toast do not hide each other.
const toasts = [];
function toast(html) {
  toasts.push(html);
  if (toasts.length === 1) showToast();
}
function showToast() {
  if (!toasts.length) return;
  const el = $('toast');
  el.innerHTML = toasts[0];
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { toasts.shift(); showToast(); }, 250);
  }, 1400);
}

const achieved = store.get(ACH) || {}; // id -> time unlocked
let newThisGame = [];
const achName = (id) => ACHIEVEMENTS.find((a) => a.id === id).name;

function checkAchievements(event) {
  const fresh = unlocked(state, event).filter((id) => !achieved[id]);
  if (!fresh.length) return;
  fresh.forEach((id) => { achieved[id] = Date.now(); });
  store.set(ACH, achieved);
  newThisGame.push(...fresh);
  if (state.over) return; // the game-over sheet lists them
  setTimeout(() => {
    fresh.forEach((id) => toast(`${icon('trophy')}<span>${achName(id)}</span>`));
    sfx('achieve');
  }, 500);
}

function renderAchievements() {
  const done = ACHIEVEMENTS.filter((a) => achieved[a.id]).length;
  $('ach-count').textContent = `${done} of ${ACHIEVEMENTS.length}`;
  $('ach-list').innerHTML = ACHIEVEMENTS
    .map((a) => `<li class="${achieved[a.id] ? 'done' : ''}">${achieved[a.id] ? icon('check') : '<i></i>'}<b>${a.name}</b><span>${a.desc}</span></li>`)
    .join('');
}

function restart(t, cls) {
  t.classList.remove(cls);
  void t.offsetWidth; // restart the CSS animation
  t.classList.add(cls);
}

function tap(i) {
  const r = play(state, i);
  if (!r) {
    if (!state.over) { restart(tiles[i], 'shake'); sfx('invalid'); }
    return;
  }
  const { event } = r;
  clearPreview();
  if (event.type === 'harvest') {
    event.harvested.forEach((n) => ghost(n));
    event.decayed.forEach((n) => ghost(n, 'rot'));
    popup(i, `+${event.points}`);
    sfx('harvest', event.harvested.length);
    if (event.decayed.length) setTimeout(() => sfx('rot'), 200);
  }
  state = r.state;
  if (state.score > best) best = state.score;
  store.set(KEY, state);
  store.set(bestKey(modeOf(state)), best);
  render();
  checkAchievements(event);

  if (event.type === 'plant') {
    restart(tiles[i].querySelector('.plant'), 'pop');
    sfx('place');
    navigator.vibrate?.(8);
  } else {
    event.matured.forEach((n) => restart(tiles[n].querySelector('.plant'), 'grow'));
    if (event.matured.length) setTimeout(() => sfx('grow'), 300);
    if (event.seasonUp) setTimeout(() => { toast(`Season ${state.season}`); sfx('season'); }, 350);
  }
  document.querySelector('.queue li:last-child')?.classList.add('enter');
  if (state.over) setTimeout(showOver, 900);
}

function showOver() {
  $('final-score').value = state.score;
  $('final-best').textContent = state.score > bestBefore ? 'New best!' : `Best ${best}`;
  $('final-new').hidden = !newThisGame.length;
  $('final-new').innerHTML = `${icon('trophy')}<span>Unlocked: ${newThisGame.map(achName).join(', ')}</span>`;
  $('over').showModal();
  sfx('over');
}

function setPreferred(mode) {
  preferred = mode;
  store.set(PREF, mode);
  renderDifficulty();
}

function startNew(mode = preferred) {
  newThisGame = [];
  setPreferred(mode);
  best = bestBefore = store.get(bestKey(mode)) || 0;
  state = newGame(Date.now(), mode);
  drawn.length = 0;
  store.set(KEY, state);
  render();
  renderDifficulty();
}

$('undo').addEventListener('click', () => {
  const s = undo(state);
  if (s) { state = s; store.set(KEY, state); render(); sfx('undo'); }
});
function pickMode() {
  $('new-warning').hidden = state.over;
  $('modes').innerHTML = Object.entries(MODES)
    .map(([key, m]) => `<button class="mode${key === preferred ? ' current' : ''}" value="${key}"><b>${m.name}</b><span>${m.plants} plants per harvest${m.bees > 1 ? ', more bees' : m.bees < 1 ? ', fewer bees' : ''}</span></button>`)
    .join('');
  $('confirm').returnValue = '';
  $('confirm').showModal();
}
$('new-btn').addEventListener('click', pickMode);
$('confirm').addEventListener('close', () => MODES[$('confirm').returnValue] && startNew($('confirm').returnValue));
$('over').addEventListener('close', () => ($('over').returnValue === 'pick' ? pickMode() : startNew()));

// Difficulty in settings. A fresh garden switches at once; a garden in progress keeps
// its mode, and the note offers to start the new mode now.
$('difficulty').innerHTML = '<legend>Difficulty</legend>' + Object.entries(MODES)
  .map(([key, m]) => `<label><input type="radio" name="mode" value="${key}"><span>${m.name}</span></label>`)
  .join('');
function renderDifficulty() {
  $('difficulty').querySelector(`input[value="${preferred}"]`).checked = true;
  const pending = preferred !== modeOf(state) && !state.over;
  $('mode-note').hidden = !pending;
  if (pending) $('mode-note-text').textContent = `Your next garden will be ${MODES[preferred].name}. Start it now? You lose the current garden.`;
}
$('difficulty').addEventListener('change', (e) => {
  setPreferred(e.target.value);
  if (!state.prev && state.score === 0) startNew(); // nothing to lose yet
});
$('mode-now').addEventListener('click', () => { $('settings').close(); startNew(); });
renderDifficulty();

// Settings. Theme follows the system until the player picks one; then the choice is saved.
// The theme is stored as a raw string because the inline script in index.html reads it.
const systemDark = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#1e1916' : '#f8f3ea';
  const dark = theme === 'dark';
  $('theme-toggle').setAttribute('aria-pressed', dark);
  $('theme-toggle').innerHTML = `${icon(dark ? 'moon' : 'sun')}<span>${dark ? 'Dark' : 'Light'} theme</span>`;
}
applyTheme(document.documentElement.dataset.theme);
$('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('tilth.theme', theme); } catch { /* not saved; still switches */ }
  applyTheme(theme);
});
systemDark.addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem('tilth.theme'); } catch { /* ignore */ }
  if (!saved) applyTheme(e.matches ? 'dark' : 'light');
});

let soundOn = store.get(SOUND) ?? true;
function applySound() {
  setSound(soundOn);
  $('sound-toggle').setAttribute('aria-pressed', soundOn);
  $('sound-toggle').innerHTML = `${icon(soundOn ? 'soundOn' : 'soundOff')}<span>Sound ${soundOn ? 'on' : 'off'}</span>`;
}
applySound();
$('sound-toggle').addEventListener('click', () => {
  soundOn = !soundOn;
  store.set(SOUND, soundOn);
  applySound();
  sfx('place'); // a sample, so the player hears that sound is on
});
$('settings-btn').innerHTML = icon('gear');
$('settings-btn').addEventListener('click', () => {
  $('ach-btn').textContent = `Achievements · ${ACHIEVEMENTS.filter((a) => achieved[a.id]).length}/${ACHIEVEMENTS.length}`;
  $('settings').returnValue = '';
  $('settings').showModal();
});
$('settings').addEventListener('close', () => {
  if ($('settings').returnValue === 'help') $('help').showModal();
  if ($('settings').returnValue === 'achievements') { renderAchievements(); $('achievements').showModal(); }
});

$('legend').innerHTML = Object.entries(KINDS)
  .map(([kind, k]) => `<tr><td>${plantArt({ kind, age: 0 }, true)}</td><td>${k.name}</td><td>${k.value} pt${k.value > 1 ? 's' : ''}${k.grow ? ` · grows in ${k.grow}` : ''}${k.decay ? ` · rots after ${k.decay}` : ''}</td></tr>`)
  .join('');

render();
if (!store.get(SEEN)) { store.set(SEEN, true); $('help').showModal(); }
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js');
// Ask the browser not to clear saved games and scores when the device runs low on space.
navigator.storage?.persist?.().catch(() => {});
