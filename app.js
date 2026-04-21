const DOT_DEFS = [
  { id: "skins", name: "Skins Won", value: 1, type: "special", def: "Award a skins dot when a hole is won outright by a single player. If no single player wins the hole, the skin carries to the next hole until won." },
  { id: "birdie", name: "Birdie", value: 1, type: "positive", def: "Make birdie on the hole." },
  { id: "eagle", name: "Eagle", value: 2, type: "positive", def: "Make eagle on the hole." },
  { id: "greenie", name: "Greenie", value: 1, type: "positive", def: "Hit the green in regulation on a par 3. Some groups require par or better to keep it." },
  { id: "sandy", name: "Sandy", value: 1, type: "positive", def: "Make par or better after hitting from a greenside bunker." },
  { id: "barkie", name: "Barkie", value: 1, type: "positive", def: "Hit a tree and still make par or better." },
  { id: "arnie", name: "Arnie", value: 1, type: "positive", def: "Make par or better without hitting the fairway in regulation." },
  { id: "chipin", name: "Chip-In", value: 1, type: "positive", def: "Hole out from off the green." },
  { id: "poley", name: "Poley", value: 1, type: "positive", def: "Make a putt after hitting the flagstick." },
  { id: "pulley", name: "Pulley", value: 1, type: "positive", def: "Make your first putt from outside the length of the flagstick." },
  { id: "luigi", name: "Luigi", value: 1, type: "positive", def: "Your GIR finishes within the length of the flagstick from the hole." },
  { id: "double_luigi", name: "Double Luigi", value: 2, type: "positive", def: "Your GIR finishes inside the length of the putter from the hole." },
  { id: "updown", name: "Up-and-Down", value: 1, type: "positive", def: "Get up-and-down for par from off the green." },
  { id: "closest2", name: "Closest in Two", value: 1, type: "positive", def: "On a par 5, be closest to the hole in two shots." },
  { id: "noputt", name: "No Putt", value: 1, type: "positive", def: "Hole out from off the green without taking a putt." },
  { id: "holeout", name: "Hole-Out", value: 1, type: "positive", def: "Any hole-out from outside the green complex." },
  { id: "threeputt", name: "3-Putt", value: -1, type: "penalty", def: "Penalty dot for a 3-putt." },
  { id: "water", name: "Water Ball", value: -1, type: "penalty", def: "Penalty dot for a ball hit into the water." },
  { id: "ob", name: "Out of Bounds", value: -1, type: "penalty", def: "Penalty dot for a ball hit out of bounds." },
  { id: "double", name: "Double Bogey+", value: -1, type: "penalty", def: "Penalty dot for double bogey or worse." },
];

const HOLES_FRONT = [1,2,3,4,5,6,7,8,9];
const HOLES_BACK = [10,11,12,13,14,15,16,17,18];
const ALL_HOLES = [...HOLES_FRONT, ...HOLES_BACK];
const STORAGE_KEY = 'golf-dots-final-v1';

const defaultState = {
  activeTab: 'scorecard',
  roundName: 'Saturday Dots',
  courseName: '',
  valuePerDot: 1,
  players: ['Tony', 'Player 2', 'Player 3', 'Player 4'],
  settings: {
    doubleLuigiOverridesLuigi: true,
    allowStacking: true,
    colorMode: 'frontBack',
  },
  scores: {
    'Tony': {},
    'Player 2': {},
    'Player 3': {},
    'Player 4': {},
  },
  modal: { open: false, player: '', hole: null },
  currentHole: 1,
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const saved = JSON.parse(raw);
    return mergeState(saved);
  } catch (e) {
    return structuredClone(defaultState);
  }
}

function mergeState(saved) {
  const next = structuredClone(defaultState);
  Object.assign(next, saved || {});
  next.settings = { ...defaultState.settings, ...(saved.settings || {}) };
  next.scores = saved.scores || next.scores;
  next.players = Array.isArray(saved.players) && saved.players.length ? saved.players : next.players;
  next.modal = { open: false, player: '', hole: null };
  next.players.forEach((player) => {
    if (!next.scores[player]) next.scores[player] = {};
  });
  return next;
}

function persist() {
  const clean = { ...state, modal: { open: false, player: '', hole: null } };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
}

function getDotById(id) {
  return DOT_DEFS.find((d) => d.id === id);
}

function playerHoleDots(player, hole) {
  return state.scores[player]?.[hole] || [];
}

function sanitizeHoleDots(dotIds) {
  let next = [...dotIds];
  if (state.settings.doubleLuigiOverridesLuigi && next.includes('double_luigi') && next.includes('luigi')) {
    next = next.filter((id) => id !== 'luigi');
  }
  return next;
}

function baseHoleTotal(dotIds) {
  return dotIds
    .filter((id) => id !== 'skins')
    .reduce((sum, id) => sum + (getDotById(id)?.value || 0), 0);
}

function getSkinCarryValue(player, hole) {
  const holeNumber = Number(hole);
  const holeIndex = ALL_HOLES.indexOf(holeNumber);
  if (holeIndex === -1) return 0;

  let carry = 1;
  for (let i = 0; i <= holeIndex; i++) {
    const currentHole = ALL_HOLES[i];
    const winners = state.players.filter((p) => playerHoleDots(p, currentHole).includes('skins'));

    if (currentHole === holeNumber) {
      return winners.length === 1 && winners[0] === player ? carry : 0;
    }

    if (winners.length === 1) {
      carry = 1;
    } else {
      carry += 1;
    }
  }
  return 0;
}

function displayHoleTotal(player, hole) {
  const dotIds = playerHoleDots(player, hole);
  const base = baseHoleTotal(dotIds);
  const skins = dotIds.includes('skins') ? getSkinCarryValue(player, hole) : 0;
  return base + skins;
}

function rangeTotal(player, holes) {
  return holes.reduce((sum, hole) => sum + displayHoleTotal(player, hole), 0);
}

function playerTotal(player) {
  return rangeTotal(player, ALL_HOLES);
}

function moneySummary() {
  return state.players
    .map((name) => ({ name, dots: playerTotal(name), money: playerTotal(name) * Number(state.valuePerDot || 0) }))
    .sort((a, b) => b.money - a.money);
}

function moneyClass(num) {
  return num >= 0 ? 'money-pos' : 'money-neg';
}

function totalClass(num) {
  if (num > 0) return 'pos';
  if (num < 0) return 'neg';
  return '';
}

function showSigned(num) {
  return num > 0 ? `+${num}` : `${num}`;
}

function holeColorClass(hole) {
  const mode = state.settings.colorMode;
  if (mode === 'alternating') return hole % 2 === 1 ? 'hole-odd' : 'hole-even';
  if (mode === 'neutral') return 'hole-neutral';
  return hole <= 9 ? 'hole-front' : 'hole-back';
}

function openModal(player, hole) {
  state.modal = { open: true, player, hole };
  render();
}

function closeModal() {
  state.modal = { open: false, player: '', hole: null };
  render();
}

function updateField(key, value, rerender = true) {
  state[key] = value;
  persist();
  if (rerender) render();
}

function updateSetting(key, value) {
  state.settings[key] = value;
  persist();
  render();
}

function addPlayer() {
  const input = document.getElementById('new-player');
  const name = (input.value || '').trim();
  if (!name || state.players.includes(name)) return;
  state.players.push(name);
  state.scores[name] = {};
  input.value = '';
  persist();
  render();
}

function removePlayer(name) {
  state.players = state.players.filter((p) => p !== name);
  delete state.scores[name];
  persist();
  render();
}

function toggleDot(dotId) {
  const { player, hole } = state.modal;
  if (!player || !hole) return;
  const current = playerHoleDots(player, hole);
  let next;
  if (state.settings.allowStacking) {
    next = current.includes(dotId) ? current.filter((id) => id !== dotId) : [...current, dotId];
  } else {
    next = current.includes(dotId) ? [] : [dotId];
  }
  next = sanitizeHoleDots(next);
  state.scores[player][hole] = next;
  persist();
  render();
}

function clearHole() {
  const { player, hole } = state.modal;
  if (!player || !hole) return;
  state.scores[player][hole] = [];
  persist();
  render();
}

function resetRound() {
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultState);
  render();
}

function setTab(tab) {
  state.activeTab = tab;
  render();
}

function renderTabs() {
  const tabs = [
    ['scorecard', 'Scorecard'],
    ['setup', 'Setup'],
    ['legend', 'Legend'],
    ['summary', 'Summary'],
  ];
  return tabs.map(([id, label]) => `<button class="tab ${state.activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('');
}

function renderPlayerSummary() {
  return state.players.map((player) => `
    <div class="player-summary">
      <div><strong>${escapeHtml(player)}</strong></div>
      <div class="muted">Out: ${rangeTotal(player, HOLES_FRONT)}</div>
      <div class="muted">In: ${rangeTotal(player, HOLES_BACK)}</div>
      <div class="big">Total: ${playerTotal(player)}</div>
    </div>
  `).join('');
}


function renderCurrentHolePlayerCard(player, hole) {
  const dots = playerHoleDots(player, hole);
  const total = displayHoleTotal(player, hole);
  const skinCarry = dots.includes('skins') ? getSkinCarryValue(player, hole) : 0;
  const tags = dots.length === 0
    ? '<span class="muted">No dots recorded yet.</span>'
    : dots.map((id) => {
        const label = id === 'skins' && skinCarry > 1 ? `Skins x${skinCarry}` : getDotById(id)?.name;
        return `<span class="tag">${escapeHtml(label || id)}</span>`;
      }).join('');

  return `
    <div class="card hole-player-card">
      <div class="card-title hole-player-head">
        <span>${escapeHtml(player)}</span>
        <span class="badge">${showSigned(total)}</span>
      </div>
      <div class="card-desc">Out: ${rangeTotal(player, HOLES_FRONT)} · In: ${rangeTotal(player, HOLES_BACK)} · Total: ${playerTotal(player)}</div>
      <div class="tags hole-player-tags">${tags}</div>
      <div class="spacer"></div>
      <button class="action-btn hole-edit-btn" data-edit-player="${escapeHtml(player)}" data-edit-hole="${hole}">Edit dots for ${escapeHtml(player)}</button>
    </div>
  `;
}

function renderHoleNavigator() {
  return `
    <div class="card">
      <div class="hole-nav-head">
        <div>
          <div class="card-title">Hole-by-hole scoring</div>
          <div class="card-desc">Update all players on one hole, then move to the next.</div>
        </div>
        <div class="hole-nav-controls">
          <button class="small-btn" id="prev-hole" ${state.currentHole === 1 ? 'disabled' : ''}>Previous</button>
          <div class="current-hole-pill ${holeColorClass(state.currentHole)}">
            <div class="muted">Current hole</div>
            <div class="current-hole-num">${state.currentHole}</div>
          </div>
          <button class="small-btn" id="next-hole" ${state.currentHole === 18 ? 'disabled' : ''}>Next</button>
        </div>
      </div>
      <div class="hole-jump-grid">
        ${ALL_HOLES.map((hole) => `
          <button class="hole-jump-btn ${hole === state.currentHole ? 'active' : holeColorClass(hole)}" data-jump-hole="${hole}">${hole}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderLegend() {
  return `
    <div class="card">
      <div class="card-title">Dots legend</div>
      <div class="card-desc">House rules and scoring reference.</div>
      <div class="legend-grid">
        <div>
          <div class="card-title" style="font-size:18px;">Scoring dots</div>
          ${renderLegendItems('score')}
        </div>
        <div>
          <div class="card-title" style="font-size:18px;">Penalty dots</div>
          ${renderLegendItems('penalty')}
          <div class="legend-item house-notes">
            <strong>Suggested house notes</strong>
            <ul>
              <li>Agree before the round which dots are active.</li>
              <li>Decide whether Greenies must be converted to par or better.</li>
              <li>Decide whether Double Luigi replaces Luigi or stacks with it.</li>
              <li>Set the dollar value per dot before teeing off.</li>
              <li>For skins, decide whether each carry adds one extra dot or one extra dollar value to the eventual winner.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderModal() {
  const modal = state.modal;
  if (!modal.open) return '';
  const dots = playerHoleDots(modal.player, modal.hole);
  const total = displayHoleTotal(modal.player, modal.hole);
  const dotButtons = DOT_DEFS.map((dot) => {
    const active = dots.includes(dot.id);
    const skinCarry = dot.id === 'skins' && active ? getSkinCarryValue(modal.player, modal.hole) : 0;
    const def = dot.id === 'skins' && active && skinCarry > 1
      ? `${dot.def} Current value: ${skinCarry} dots.`
      : dot.def;
    return `
      <button class="dot-btn ${active ? 'active' : ''}" data-dot-id="${dot.id}">
        <div class="dot-name-row">
          <strong>${escapeHtml(dot.name)}</strong>
          <span class="value-badge ${dot.value < 0 ? 'penalty' : 'positive'}">${showSigned(dot.value)}</span>
        </div>
        <div class="${active ? '' : 'muted'}">${escapeHtml(def)}</div>
      </button>
    `;
  }).join('');

  return `
    <div class="modal open" id="modal-overlay">
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-head">
          <div>
            <div class="card-title">${escapeHtml(modal.player)} · Hole ${modal.hole}</div>
            <div class="card-desc">Tap any dot to add or remove it from this hole. Skins automatically carry until a single player wins one.</div>
          </div>
          <button class="close-btn" id="close-modal">×</button>
        </div>
        <div class="modal-total">
          <div>
            <div class="muted">Hole total</div>
            <div class="big ${totalClass(total)}">${showSigned(total)}</div>
          </div>
          <button class="small-btn" id="clear-hole">Clear hole</button>
        </div>
        <div class="dot-grid">${dotButtons}</div>
      </div>
    </div>
  `;
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="container">
      <div class="header">
        <div>
          <div class="pill">⛳ Golf Dots Tracker</div>
          <div class="title">Live side game scorecard</div>
          <div class="subtitle">Track dots by hole, total the front and back, and settle up fast.</div>
        </div>
        <button class="action-btn" id="reset-round">Reset demo round</button>
      </div>

      <div class="tabs-wrap">
        <div class="tabs">${renderTabs()}</div>
      </div>

      <section class="section ${state.activeTab === 'scorecard' ? 'active' : ''}">${renderScorecard()}</section>
      <section class="section ${state.activeTab === 'setup' ? 'active' : ''}">${renderSetup()}</section>
      <section class="section ${state.activeTab === 'legend' ? 'active' : ''}">${renderLegend()}</section>
      <section class="section ${state.activeTab === 'summary' ? 'active' : ''}">${renderSummary()}</section>
    </div>
    ${renderModal()}
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  const resetBtn = document.getElementById('reset-round');
  if (resetBtn) resetBtn.addEventListener('click', resetRound);

  document.querySelectorAll('[data-edit-player]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.editPlayer, Number(btn.dataset.editHole)));
  });
  document.querySelectorAll('[data-jump-hole]').forEach((btn) => {
    btn.addEventListener('click', () => { state.currentHole = Number(btn.dataset.jumpHole); persist(); render(); });
  });
  const prevHole = document.getElementById('prev-hole');
  if (prevHole) prevHole.addEventListener('click', () => { state.currentHole = Math.max(1, Number(state.currentHole || 1) - 1); persist(); render(); });
  const nextHole = document.getElementById('next-hole');
  if (nextHole) nextHole.addEventListener('click', () => { state.currentHole = Math.min(18, Number(state.currentHole || 1) + 1); persist(); render(); });

  const roundName = document.getElementById('round-name');
  if (roundName) {
    roundName.addEventListener('input', (e) => updateField('roundName', e.target.value, false));
    roundName.addEventListener('change', (e) => updateField('roundName', e.target.value, true));
    roundName.addEventListener('blur', (e) => updateField('roundName', e.target.value, true));
  }
  const courseName = document.getElementById('course-name');
  if (courseName) {
    courseName.addEventListener('input', (e) => updateField('courseName', e.target.value, false));
    courseName.addEventListener('change', (e) => updateField('courseName', e.target.value, true));
    courseName.addEventListener('blur', (e) => updateField('courseName', e.target.value, true));
  }
  const valuePerDot = document.getElementById('value-per-dot');
  if (valuePerDot) {
    valuePerDot.addEventListener('input', (e) => updateField('valuePerDot', Number(e.target.value || 0), false));
    valuePerDot.addEventListener('change', (e) => updateField('valuePerDot', Number(e.target.value || 0), true));
    valuePerDot.addEventListener('blur', (e) => updateField('valuePerDot', Number(e.target.value || 0), true));
  }

  const addBtn = document.getElementById('add-player-btn');
  if (addBtn) addBtn.addEventListener('click', addPlayer);
  const newPlayer = document.getElementById('new-player');
  if (newPlayer) newPlayer.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPlayer(); });

  document.querySelectorAll('[data-remove-player]').forEach((btn) => btn.addEventListener('click', () => removePlayer(btn.dataset.removePlayer)));
  document.querySelectorAll('[data-color-mode]').forEach((btn) => btn.addEventListener('click', () => updateSetting('colorMode', btn.dataset.colorMode)));

  const dl = document.getElementById('setting-double-luigi');
  if (dl) dl.addEventListener('change', (e) => updateSetting('doubleLuigiOverridesLuigi', e.target.checked));
  const stacking = document.getElementById('setting-stacking');
  if (stacking) stacking.addEventListener('change', (e) => updateSetting('allowStacking', e.target.checked));

  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
  const closeBtn = document.getElementById('close-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  const clearBtn = document.getElementById('clear-hole');
  if (clearBtn) clearBtn.addEventListener('click', clearHole);
  document.querySelectorAll('[data-dot-id]').forEach((btn) => btn.addEventListener('click', () => toggleDot(btn.dataset.dotId)));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

render();
