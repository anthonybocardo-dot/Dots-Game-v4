
const DOT_DEFS = [
  { id: "skins", name: "Skins Won", value: 1, type: "special", def: "Award when a hole is won outright by one player. If nobody wins outright, the skin carries forward." },
  { id: "birdie", name: "Birdie", value: 1, type: "positive", def: "Make birdie on the hole." },
  { id: "eagle", name: "Eagle", value: 2, type: "positive", def: "Make eagle on the hole." },
  { id: "greenie", name: "Greenie", value: 1, type: "positive", def: "Hit the green in regulation on a par 3." },
  { id: "sandy", name: "Sandy", value: 1, type: "positive", def: "Make par or better after hitting from a greenside bunker." },
  { id: "barkie", name: "Barkie", value: 1, type: "positive", def: "Hit a tree and still make par or better." },
  { id: "arnie", name: "Arnie", value: 1, type: "positive", def: "Make par or better without hitting the fairway in regulation." },
  { id: "chipin", name: "Chip-In", value: 1, type: "positive", def: "Hole out from off the green." },
  { id: "poley", name: "Poley", value: 1, type: "positive", def: "Make a putt after hitting the flagstick." },
  { id: "pulley", name: "Pulley", value: 1, type: "positive", def: "Make your first putt from outside the length of the flagstick." },
  { id: "luigi", name: "Luigi", value: 1, type: "positive", def: "GIR finishes within the length of the flagstick from the hole." },
  { id: "double_luigi", name: "Double Luigi", value: 2, type: "positive", def: "GIR finishes inside the length of the putter from the hole." },
  { id: "updown", name: "Up-and-Down", value: 1, type: "positive", def: "Get up-and-down for par from off the green." },
  { id: "closest2", name: "Closest in Two", value: 1, type: "positive", def: "On a par 5, be closest to the hole in two shots." },
  { id: "noputt", name: "No Putt", value: 1, type: "positive", def: "Hole out from off the green without taking a putt." },
  { id: "holeout", name: "Hole-Out", value: 1, type: "positive", def: "Any hole-out from outside the green complex." },
  { id: "threeputt", name: "3-Putt", value: -1, type: "penalty", def: "Penalty dot for a 3-putt." },
  { id: "water", name: "Water Ball", value: -1, type: "penalty", def: "Penalty dot for a ball hit into the water." },
  { id: "ob", name: "Out of Bounds", value: -1, type: "penalty", def: "Penalty dot for a ball hit OB." },
  { id: "double", name: "Double Bogey+", value: -1, type: "penalty", def: "Penalty dot for double bogey or worse." }
];
const HOLES_FRONT = [1,2,3,4,5,6,7,8,9];
const HOLES_BACK = [10,11,12,13,14,15,16,17,18];
const ALL_HOLES = [...HOLES_FRONT, ...HOLES_BACK];
const STORAGE_KEY = "golf-dots-static-v3";

let state = loadState();
let ui = {
  tab: 'scorecard',
  currentHole: 1,
  dialogOpen: false,
  setupDraft: {
    roundName: state.roundName,
    courseName: state.courseName,
    valuePerDot: String(state.valuePerDot)
  },
  copied: false
};

function createEmptyState(){
  const players = ["Tony","Player 2","Player 3","Player 4"];
  const scores = {};
  players.forEach(p=>scores[p]={});
  return {
    roundName: "Saturday Dots",
    courseName: "",
    valuePerDot: 1,
    players,
    scores,
    settings: {
      doubleLuigiOverridesLuigi: true,
      allowStacking: true,
      colorMode: "frontBack"
    }
  };
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return createEmptyState();
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function getDot(id){ return DOT_DEFS.find(d=>d.id===id); }
function playerHoleDots(player,hole){ return state.scores[player]?.[hole] || []; }
function sanitizeDots(dotIds){
  let next = [...dotIds];
  if(state.settings.doubleLuigiOverridesLuigi && next.includes("double_luigi") && next.includes("luigi")){
    next = next.filter(d=>d!=="luigi");
  }
  return next;
}
function skinsWinnerMap(){
  const result = {};
  let carry = 1;
  for(const hole of ALL_HOLES){
    const winners = state.players.filter(p=>playerHoleDots(p,hole).includes("skins"));
    if(winners.length===1){
      result[hole]={winner:winners[0], value:carry};
      carry=1;
    }else{
      result[hole]={winner:null, value:0};
      carry+=1;
    }
  }
  return result;
}
function displayHoleTotal(player,hole){
  const skinMap = skinsWinnerMap();
  return playerHoleDots(player,hole).reduce((sum,id)=>{
    if(id==="skins"){
      const info = skinMap[hole];
      return sum + (info && info.winner===player ? info.value : 0);
    }
    const dot = getDot(id);
    return sum + (dot ? dot.value : 0);
  },0);
}
function playerRangeTotal(player,holes){
  return holes.reduce((sum,hole)=>sum+displayHoleTotal(player,hole),0);
}
function playerTotal(player){ return playerRangeTotal(player, ALL_HOLES); }
function moneySummary(){
  return state.players.map(name=>{
    const dots = playerTotal(name);
    const money = +(dots * Number(state.valuePerDot || 0)).toFixed(2);
    return {name,dots,money};
  }).sort((a,b)=>b.money-a.money);
}
function computeSettlements(items){
  const creditors = items.filter(i=>i.money>0).map(i=>({...i, remaining:i.money}));
  const debtors = items.filter(i=>i.money<0).map(i=>({...i, remaining:Math.abs(i.money)}));
  const payments = [];
  let d=0,c=0;
  while(d<debtors.length && c<creditors.length){
    const amount = Math.min(debtors[d].remaining, creditors[c].remaining);
    if(amount>0) payments.push({from:debtors[d].name,to:creditors[c].name,amount:+amount.toFixed(2)});
    debtors[d].remaining = +(debtors[d].remaining - amount).toFixed(2);
    creditors[c].remaining = +(creditors[c].remaining - amount).toFixed(2);
    if(debtors[d].remaining <= .009) d++;
    if(creditors[c].remaining <= .009) c++;
  }
  return payments;
}
function buildPayoutMessage(totals, settlements){
  return [
    `${state.roundName || "Golf Dots"} payout summary`,
    `${state.courseName ? state.courseName + " · " : ""}$${Number(state.valuePerDot || 0).toFixed(2)} per dot`,
    ``,
    `Totals:`,
    ...totals.map(item => `${item.name}: ${item.dots > 0 ? '+' : ''}${item.dots} dots (${item.money >= 0 ? '+' : '-'}$${Math.abs(item.money).toFixed(2)})`),
    ``,
    `Settle up:`,
    ...(settlements.length ? settlements.map(item => `${item.from} pays ${item.to} $${item.amount.toFixed(2)}`) : [`No payouts needed.`])
  ].join('\n');
}
function holeClass(hole){
  if(state.settings.colorMode === 'alternating') return hole % 2 ? 'odd' : 'even';
  if(state.settings.colorMode === 'neutral') return '';
  return hole <= 9 ? 'front' : 'back';
}
function setTab(tab){ ui.tab = tab; render(); }
function toggleDot(player,hole,dotId){
  const current = playerHoleDots(player,hole);
  let next;
  if(state.settings.allowStacking){
    next = current.includes(dotId) ? current.filter(d=>d!==dotId) : [...current, dotId];
  }else{
    next = current.includes(dotId) ? [] : [dotId];
  }
  next = sanitizeDots(next);
  state.scores[player] = state.scores[player] || {};
  state.scores[player][hole] = next;
  saveState(); render();
}
function clearHole(player,hole){
  state.scores[player] = state.scores[player] || {};
  state.scores[player][hole] = [];
  saveState(); render();
}
function addPlayer(){
  const input = document.getElementById('newPlayer');
  const name = (input?.value || '').trim();
  if(!name || state.players.includes(name)) return;
  state.players.push(name);
  state.scores[name] = {};
  input.value = '';
  saveState(); render();
}
function removePlayer(name){
  state.players = state.players.filter(p=>p!==name);
  delete state.scores[name];
  saveState(); render();
}
function commitSetupField(field, value){
  if(field === 'valuePerDot'){
    state.valuePerDot = Number(value || 0);
  }else{
    state[field] = value;
  }
  saveState(); render();
}
function resetRound(){
  state = createEmptyState();
  ui.setupDraft = {roundName: state.roundName, courseName: state.courseName, valuePerDot: String(state.valuePerDot)};
  ui.currentHole = 1;
  ui.dialogOpen = false;
  saveState(); render();
}
async function copyPayout(){
  const totals = moneySummary();
  const msg = buildPayoutMessage(totals, computeSettlements(totals));
  try{
    await navigator.clipboard.writeText(msg);
    ui.copied = true;
    render();
    setTimeout(()=>{ ui.copied = false; render(); }, 1400);
  }catch(e){}
}
async function sharePayout(){
  const totals = moneySummary();
  const msg = buildPayoutMessage(totals, computeSettlements(totals));
  try{
    if(navigator.share){
      await navigator.share({title: `${state.roundName || 'Golf Dots'} payouts`, text: msg});
    }else{
      await copyPayout();
    }
  }catch(e){}
}
function renderTabs(){
  return `
  <div class="tabs-wrap">
    <div class="tabs">
      ${['scorecard','setup','legend','summary'].map(tab=>`
        <button class="tab ${ui.tab===tab?'active':''}" data-tab="${tab}">${tab[0].toUpperCase()+tab.slice(1)}</button>
      `).join('')}
    </div>
  </div>`;
}
function renderScorecard(){
  const skinMap = skinsWinnerMap();
  return `
  <div class="space-y">
    <div class="card">
      <div class="card-h">
        <div class="header">
          <div>
            <div style="font-weight:700;font-size:20px;">Hole-by-hole scoring</div>
            <div class="muted">See all players on one hole and edit that hole in one popup.</div>
          </div>
          <div class="row">
            <button class="btn" ${ui.currentHole===1?'disabled':''} data-prev-hole="1">Previous</button>
            <div class="badge ${holeClass(ui.currentHole)}" style="padding:10px 16px;border-radius:16px;">
              <div><div class="muted" style="font-size:12px;">Current hole</div><div class="big" style="font-size:30px;">${ui.currentHole}</div></div>
            </div>
            <button class="btn" ${ui.currentHole===18?'disabled':''} data-next-hole="1">Next</button>
            <button class="btn primary" data-open-dialog="1">Edit all players</button>
          </div>
        </div>
      </div>
      <div class="card-b">
        <div class="holes-nav">
          ${ALL_HOLES.map(h=>`<button class="hole-btn ${ui.currentHole===h?'active':''} ${ui.currentHole===h?'':holeClass(h)}" data-hole="${h}">${h}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="grid grid-players">
      ${state.players.map(player=>{
        const dots = playerHoleDots(player, ui.currentHole);
        const total = displayHoleTotal(player, ui.currentHole);
        return `
          <div class="card">
            <div class="card-h">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                <div style="font-size:20px;font-weight:700;">${player}</div>
                <div class="badge dark">${total>0?`+${total}`:total}</div>
              </div>
              <div class="muted" style="font-size:14px;">Out: ${playerRangeTotal(player, HOLES_FRONT)} · In: ${playerRangeTotal(player, HOLES_BACK)} · Total: ${playerTotal(player)}</div>
            </div>
            <div class="card-b">
              <div class="row">
                ${dots.length ? dots.map(id => {
                  const skin = skinMap[ui.currentHole];
                  const label = id === 'skins' && skin && skin.winner===player && skin.value>1 ? `Skins x${skin.value}` : getDot(id).name;
                  return `<span class="badge">${label}</span>`;
                }).join('') : `<span class="muted" style="font-size:14px;">No dots recorded yet.</span>`}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>
  </div>`;
}
function renderSetup(){
  return `
  <div class="card">
    <div class="card-h">
      <div style="font-size:20px;font-weight:700;">Round setup</div>
      <div class="muted">Adjust names, values, and display options.</div>
    </div>
    <div class="card-b space-y">
      <div class="grid grid-3">
        <div>
          <label class="label">Round name</label>
          <input class="input" id="roundNameInput" value="${escapeHtml(ui.setupDraft.roundName)}" />
        </div>
        <div>
          <label class="label">Course</label>
          <input class="input" id="courseNameInput" value="${escapeHtml(ui.setupDraft.courseName)}" />
        </div>
        <div>
          <label class="label">Dollar value per dot</label>
          <input class="number" type="number" id="valuePerDotInput" value="${escapeHtml(ui.setupDraft.valuePerDot)}" />
        </div>
      </div>

      <div>
        <label class="label">Players</label>
        <div class="row">
          <input class="input" id="newPlayer" placeholder="Add a player" />
          <button class="btn primary" data-add-player="1">Add</button>
        </div>
        <div class="row" style="margin-top:10px;">
          ${state.players.map(player=>`
            <div class="player-chip">
              <span>${player}</span>
              <button data-remove-player="${escapeAttr(player)}">✕</button>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <label class="label">Scorecard color mode</label>
        <div class="grid grid-3">
          ${[
            ['frontBack','Front / Back','Front 9 and back 9 use different colors.'],
            ['alternating','Alternating holes','Odd and even holes alternate for easier scanning.'],
            ['neutral','Neutral','Clean white cards with no color coding.']
          ].map(([value,title,desc])=>`
            <button class="btn ${state.settings.colorMode===value?'primary':''}" data-color-mode="${value}" style="text-align:left;">
              <div style="font-weight:700;">${title}</div>
              <div style="font-size:14px;${state.settings.colorMode===value?'color:#cbd5e1;':'color:#64748b;'}">${desc}</div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card" style="padding:14px;">
          <div style="display:flex;justify-content:space-between;gap:14px;align-items:center;">
            <div>
              <div style="font-weight:700;">Double Luigi overrides Luigi</div>
              <div class="muted" style="font-size:14px;">Prevents both from counting on the same GIR.</div>
            </div>
            <input type="checkbox" ${state.settings.doubleLuigiOverridesLuigi?'checked':''} data-setting-toggle="doubleLuigiOverridesLuigi" />
          </div>
        </div>
        <div class="card" style="padding:14px;">
          <div style="display:flex;justify-content:space-between;gap:14px;align-items:center;">
            <div>
              <div style="font-weight:700;">Allow stacking on a hole</div>
              <div class="muted" style="font-size:14px;">Turn off if your group wants one dot type max per hole.</div>
            </div>
            <input type="checkbox" ${state.settings.allowStacking?'checked':''} data-setting-toggle="allowStacking" />
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
function renderLegend(){
  const scoring = DOT_DEFS.filter(d=>d.type!=='penalty');
  const penalty = DOT_DEFS.filter(d=>d.type==='penalty');
  return `
  <div class="card">
    <div class="card-h">
      <div style="font-size:20px;font-weight:700;">Dots legend</div>
      <div class="muted">Scoring dots, skins, and penalties.</div>
    </div>
    <div class="card-b">
      <div class="grid grid-2">
        <div class="space-y">
          <div style="font-size:18px;font-weight:700;">Scoring dots</div>
          ${scoring.map(dot=>`
            <div class="legend-item">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
                <div style="font-weight:700;">${dot.name}</div>
                <span class="badge">+${dot.value}</span>
              </div>
              <div class="muted" style="margin-top:6px;font-size:14px;">${dot.def}</div>
            </div>
          `).join('')}
        </div>
        <div class="space-y">
          <div style="font-size:18px;font-weight:700;">Penalty dots</div>
          ${penalty.map(dot=>`
            <div class="legend-item">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
                <div style="font-weight:700;">${dot.name}</div>
                <span class="badge red">${dot.value}</span>
              </div>
              <div class="muted" style="margin-top:6px;font-size:14px;">${dot.def}</div>
            </div>
          `).join('')}
          <div class="legend-item" style="background:#f8fafc;">
            <div style="font-weight:700;">Suggested house notes</div>
            <ul class="note-list">
              <li>Agree before the round which dots are active.</li>
              <li>Decide whether greenies require par or better.</li>
              <li>Only one player should get Skins Won on a winning hole.</li>
              <li>If nobody wins outright, skins carry automatically.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
function renderSummary(){
  const totals = moneySummary();
  const settlements = computeSettlements(totals);
  const message = buildPayoutMessage(totals, settlements);
  return `
  <div class="grid grid-2">
    <div class="card">
      <div class="card-h">
        <div style="font-size:20px;font-weight:700;">Leaderboard</div>
        <div class="muted">Total dots and cash value.</div>
      </div>
      <div class="card-b space-y">
        ${totals.map((item, idx)=>`
          <div class="leader-item" style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div>
              <div class="muted" style="font-size:12px;">#${idx+1}</div>
              <div style="font-weight:700;font-size:20px;">${item.name}</div>
            </div>
            <div style="text-align:right;">
              <div class="big ${item.dots>0?'pos':item.dots<0?'neg':''}" style="font-size:24px;">${item.dots>0?`+${item.dots}`:item.dots} dots</div>
              <div class="muted">$${item.money.toFixed(2)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-h">
        <div style="font-size:20px;font-weight:700;">Settle up</div>
        <div class="muted">Exact player-to-player payouts plus a shareable message.</div>
      </div>
      <div class="card-b space-y">
        <div class="row">
          <button class="btn" data-copy-payout="1">${ui.copied ? 'Copied' : 'Copy payout text'}</button>
          <button class="btn" data-share-payout="1">Share payout text</button>
        </div>
        <div class="legend-item" style="background:#f8fafc;">
          <div style="font-weight:700;margin-bottom:10px;">Player-to-player payouts</div>
          <div class="space-y">
            ${settlements.length ? settlements.map(item=>`
              <div class="settle-item" style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                <span>${item.from} → ${item.to}</span>
                <strong>$${item.amount.toFixed(2)}</strong>
              </div>
            `).join('') : `<div class="muted">No payouts needed.</div>`}
          </div>
        </div>
        <div>
          <div style="font-weight:700;margin-bottom:8px;">Shareable payout message</div>
          <pre class="share">${escapeHtml(message)}</pre>
        </div>
      </div>
    </div>
  </div>`;
}
function renderDialog(){
  if(!ui.dialogOpen) return '';
  const skinMap = skinsWinnerMap();
  return `
  <div class="dialog-backdrop open" id="dialogBackdrop">
    <div class="dialog">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap;">
        <div>
          <div style="font-size:24px;font-weight:800;">Hole ${ui.currentHole} · all players</div>
          <div class="muted">Update every player from one popup. If exactly one player has Skins Won on this hole, carryover is applied automatically.</div>
        </div>
        <button class="btn" data-close-dialog="1">Close</button>
      </div>
      <div class="grid grid-players" style="margin-top:14px;">
        ${state.players.map(player=>{
          const dots = playerHoleDots(player, ui.currentHole);
          const total = displayHoleTotal(player, ui.currentHole);
          const skinInfo = skinMap[ui.currentHole];
          return `
            <div class="card">
              <div class="card-b space-y">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                  <div>
                    <div style="font-size:20px;font-weight:700;">${player}</div>
                    <div class="muted">${total > 0 ? '+'+total : total} on hole ${ui.currentHole}</div>
                  </div>
                  <button class="btn small" data-clear-hole="${escapeAttr(player)}">Clear</button>
                </div>
                <div class="row">
                  ${dots.length ? dots.map(id=>{
                    const label = id === 'skins' && skinInfo && skinInfo.winner===player && skinInfo.value>1 ? `Skins x${skinInfo.value}` : getDot(id).name;
                    return `<span class="badge">${label}</span>`;
                  }).join('') : `<span class="muted" style="font-size:14px;">No dots yet.</span>`}
                </div>
                <div class="dot-grid">
                  ${DOT_DEFS.map(dot=>{
                    const active = dots.includes(dot.id);
                    return `
                      <button class="dot-btn ${active?'active':''}" data-toggle-dot="${escapeAttr(player)}|${ui.currentHole}|${dot.id}">
                        <div class="dot-name">
                          <span>${dot.name}</span>
                          <span class="badge ${active?'dark':dot.type==='penalty'?'red':''}">${dot.value > 0 ? '+'+dot.value : dot.value}</span>
                        </div>
                        <div style="font-size:12px; margin-top:5px; ${active?'color:#cbd5e1;':'color:#64748b;'}">${dot.def}</div>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}
function render(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="container space-y">
      <div class="header">
        <div>
          <div class="title-pill">⛳ Golf Dots Tracker</div>
          <h1>Live side game scorecard</h1>
          <p class="sub">Hole-by-hole tracking, skins carryover, payouts, and shareable settlement text.</p>
        </div>
        <button class="btn" data-reset-round="1">Reset round</button>
      </div>

      ${renderTabs()}

      <div class="${ui.tab==='scorecard'?'':'hidden'}">${renderScorecard()}</div>
      <div class="${ui.tab==='setup'?'':'hidden'}">${renderSetup()}</div>
      <div class="${ui.tab==='legend'?'':'hidden'}">${renderLegend()}</div>
      <div class="${ui.tab==='summary'?'':'hidden'}">${renderSummary()}</div>

      ${renderDialog()}

      <div class="footer-note">Version 3 · Static GitHub Pages build</div>
    </div>
  `;
  bindEvents();
}
function bindEvents(){
  document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>setTab(el.dataset.tab));
  document.querySelector('[data-reset-round]')?.addEventListener('click', resetRound);
  document.querySelector('[data-prev-hole]')?.addEventListener('click', ()=>{ if(ui.currentHole>1){ ui.currentHole--; render(); }});
  document.querySelector('[data-next-hole]')?.addEventListener('click', ()=>{ if(ui.currentHole<18){ ui.currentHole++; render(); }});
  document.querySelectorAll('[data-hole]').forEach(el=>el.onclick=()=>{ ui.currentHole = Number(el.dataset.hole); render(); });
  document.querySelector('[data-open-dialog]')?.addEventListener('click', ()=>{ ui.dialogOpen = true; render(); });
  document.querySelector('[data-close-dialog]')?.addEventListener('click', ()=>{ ui.dialogOpen = false; render(); });
  document.getElementById('dialogBackdrop')?.addEventListener('click', (e)=>{ if(e.target.id==='dialogBackdrop'){ ui.dialogOpen=false; render(); }});
  document.querySelectorAll('[data-toggle-dot]').forEach(el=>el.onclick=()=>{
    const [player,hole,id] = el.dataset.toggleDot.split('|');
    toggleDot(player, Number(hole), id);
  });
  document.querySelectorAll('[data-clear-hole]').forEach(el=>el.onclick=()=>clearHole(el.dataset.clearHole, ui.currentHole));
  document.querySelector('[data-add-player]')?.addEventListener('click', addPlayer);
  document.getElementById('newPlayer')?.addEventListener('keydown', (e)=>{ if(e.key==='Enter') addPlayer(); });
  document.querySelectorAll('[data-remove-player]').forEach(el=>el.onclick=()=>removePlayer(el.dataset.removePlayer));
  document.querySelectorAll('[data-color-mode]').forEach(el=>el.onclick=()=>{ state.settings.colorMode = el.dataset.colorMode; saveState(); render(); });
  document.querySelectorAll('[data-setting-toggle]').forEach(el=>el.addEventListener('change', ()=>{
    state.settings[el.dataset.settingToggle] = el.checked; saveState(); render();
  }));
  const rn = document.getElementById('roundNameInput');
  if(rn){
    rn.addEventListener('input', e=>ui.setupDraft.roundName = e.target.value);
    rn.addEventListener('blur', e=>commitSetupField('roundName', e.target.value));
  }
  const cn = document.getElementById('courseNameInput');
  if(cn){
    cn.addEventListener('input', e=>ui.setupDraft.courseName = e.target.value);
    cn.addEventListener('blur', e=>commitSetupField('courseName', e.target.value));
  }
  const vd = document.getElementById('valuePerDotInput');
  if(vd){
    vd.addEventListener('input', e=>ui.setupDraft.valuePerDot = e.target.value);
    vd.addEventListener('blur', e=>commitSetupField('valuePerDot', e.target.value));
  }
  document.querySelector('[data-copy-payout]')?.addEventListener('click', copyPayout);
  document.querySelector('[data-share-payout]')?.addEventListener('click', sharePayout);
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(str){ return escapeHtml(str); }

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
render();
