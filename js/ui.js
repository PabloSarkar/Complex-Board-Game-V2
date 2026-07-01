"use strict";
/* ────────────────────────────────────────────────────────────
   UI — sidebar, deck builder, split/garrison/game-over modals.
   ──────────────────────────────────────────────────────────── */
function el(id){ return document.getElementById(id); }

function showScreen(name){
  for(const s of ["screen-title", "screen-deck", "screen-game"])
    el(s).classList.toggle("hidden", s !== "screen-" + name);
}

/* ── Sidebar ─────────────────────────────────────────────── */
function refreshSidebar(){
  if(G.phase === "title" || G.phase === "deck") return;
  const cur = G.players[G.current];
  const banner = el("turn-banner");
  banner.textContent = `${cur.name} TURN`;
  banner.style.background = cur.color;
  el("stat-round").textContent = G.round;

  for(const p of G.players){
    el(`p${p.id}-cp`).textContent = `${p.cp}/${WIN_CP}`;
    el(`p${p.id}-ap`).textContent = p.id === G.current ? p.ap : "–";
    el(`p${p.id}-power`).textContent = p.power;
    el(`p${p.id}-gold`).textContent = p.gold;
    el(`p${p.id}-units`).textContent = totalUnits(p.id);
    el(`pbox-${p.id}`).classList.toggle("current", p.id === G.current);
  }

  /* selected squadron panel */
  const sp = el("sel-panel");
  const sq = G.selected;
  if(!sq){
    sp.innerHTML = `<div class="dim">No squadron selected.<br>Click one of your squadrons.</div>`;
  } else {
    const mine = sq.owner === G.current;
    let html = `<div class="sel-head" style="color:${G.players[sq.owner].color}">` +
      `${G.players[sq.owner].name} SQUADRON — (${sq.x},${sq.y})</div>` +
      `<div class="sel-sub">SPD ${squadSpeed(sq)} · ${sq.units.length} units` +
      `${mine ? " · click a lit tile to move (1 AP)" : " · enemy (view only)"}</div>`;
    for(const u of sq.units){
      const pct = Math.round(100 * u.hp / u.maxHp);
      html += `<div class="sel-unit">${u.icon} ${u.name}${u.commander ? " ★" : ""}` +
        `<span class="bar"><span class="fill" style="width:${pct}%;background:${pct > 50 ? "#5fd45f" : pct > 25 ? "#ffd24a" : "#ff5a5a"}"></span></span>` +
        `<span class="hp-num">${u.hp}/${u.maxHp}</span></div>`;
    }
    const b = buildingAt(G.board, sq.x, sq.y);
    if(b) html += `<div class="sel-sub">On ${buildingLabel(b.type)} — ` +
      `${b.owner < 0 ? "unclaimed" : G.players[b.owner].name}` +
      `${b.garrison.length ? ` (garrison ${b.garrison.length})` : ""}</div>`;
    sp.innerHTML = html;
  }

  /* action buttons */
  const pl = G.players[G.current];
  const mine = sq && sq.owner === G.current && G.phase === "board";
  const b = sq ? buildingAt(G.board, sq.x, sq.y) : null;
  el("btn-split").disabled    = !(mine && sq.units.length >= 2 && pl.ap >= 1);
  el("btn-converge").disabled = !(mine && pl.ap >= 1 && convergeTargets(sq).size > 0);
  el("btn-garrison").disabled = !(mine && b && b.owner === sq.owner && sq.units.length >= 2);
  el("btn-collect").disabled  = !(mine && b && b.owner === sq.owner && b.garrison.length > 0);
  el("btn-endturn").disabled  = G.phase !== "board";

  el("mode-hint").textContent =
    G.mode === "split-dest"    ? "▶ Click a green tile for the new squadron (Esc cancels)" :
    G.mode === "converge-pick" ? "▶ Click a highlighted friendly squadron to merge (Esc cancels)" : "";

  el("game-log").innerHTML = G.log.slice(-8).map(l => `<div>${l}</div>`).join("");
  el("game-log").scrollTop = el("game-log").scrollHeight;
}

/* ── Deck builder ────────────────────────────────────────── */
const DECK = { player: 0, squads: null, decks: [null, null] };

function emptySquads(){ return [0, 1, 2, 3].map(() => [null, null, null, null, null]); }

function openDeckBuilder(player){
  DECK.player = player;
  DECK.squads = emptySquads();
  el("deck-title").textContent = `PLAYER ${player + 1} (${player === 0 ? "BLUE" : "RED"}) — BUILD YOUR DECK`;
  el("deck-title").style.color = player === 0 ? "#4aa3ff" : "#ff5a5a";
  el("btn-deck-copy").classList.toggle("hidden", player === 0);
  el("deck-msg").textContent = "";
  showScreen("deck");
  renderRoster();
  renderSquadGrid();
}

function renderRoster(){
  const grid = el("roster-grid");
  grid.innerHTML = "";
  const sorted = [...CHARACTERS].sort((a, b) => (b.commander ? 1 : 0) - (a.commander ? 1 : 0));
  for(const c of sorted){
    const card = document.createElement("div");
    card.className = "char-card" + (c.commander ? " cmd" : "");
    card.innerHTML =
      `<div class="cc-icon">${c.icon}</div>` +
      `<div class="cc-name">${c.name}${c.commander ? " ★" : ""}</div>` +
      `<div class="cc-stats">HP${c.hp} SPD${c.speed} AGI${c.agility} DEF${c.def}</div>` +
      `<div class="cc-moves">${c.moves.map(m => `${m.name} ⚡${m.cost} ${m.dmg != null ? "×" + m.dmg : "+`" + m.heal + "`hp"}`).join("<br>").replaceAll("`", "")}</div>`;
    card.addEventListener("click", () => addToDeck(c));
    grid.appendChild(card);
  }
}

function addToDeck(c){
  for(const squad of DECK.squads){
    if(c.commander){
      if(squad[0] === null){ squad[0] = c.id; renderSquadGrid(); return; }
    } else {
      for(let i = 1; i < 5; i++)
        if(squad[i] === null){ squad[i] = c.id; renderSquadGrid(); return; }
    }
  }
  flashDeckMsg(c.commander ? "All 4 commander slots are full." : "All regular slots are full.");
}

function renderSquadGrid(){
  const grid = el("squad-grid");
  grid.innerHTML = "";
  DECK.squads.forEach((squad, si) => {
    const col = document.createElement("div");
    col.className = "squad-col";
    col.innerHTML = `<div class="squad-label">SQUADRON ${si + 1}</div>`;
    squad.forEach((id, i) => {
      const slot = document.createElement("div");
      slot.className = "deck-slot" + (i === 0 ? " cmd-slot" : "");
      if(id){
        const c = CHAR_BY_ID[id];
        slot.innerHTML = `<div class="cc-icon">${c.icon}</div><div class="cc-name">${c.name}</div>`;
        slot.title = "Click to remove";
        slot.addEventListener("click", () => { squad[i] = null; renderSquadGrid(); });
      } else {
        slot.innerHTML = `<div class="slot-empty">${i === 0 ? "★" : "+"}</div>`;
      }
      col.appendChild(slot);
    });
    grid.appendChild(col);
  });
}

function flashDeckMsg(msg){
  el("deck-msg").textContent = msg;
  setTimeout(() => { if(el("deck-msg").textContent === msg) el("deck-msg").textContent = ""; }, 2500);
}

function confirmDeck(){
  for(const squad of DECK.squads)
    if(squad.some(s => s === null))
      return flashDeckMsg("Every squadron needs 5 units (★ slot = commander).");
  DECK.decks[DECK.player] = DECK.squads.map(s => [...s]);
  if(DECK.player === 0) openDeckBuilder(1);
  else startGame(DECK.decks[0], DECK.decks[1]);
}

/* ── Split & garrison modals ─────────────────────────────── */
function openUnitPicker(modalId, listId, sq){
  const list = el(listId);
  list.innerHTML = "";
  sq.units.forEach((u, i) => {
    const row = document.createElement("label");
    row.className = "check-row";
    row.innerHTML = `<input type="checkbox" data-i="${i}"> ${u.icon} ${u.name}${u.commander ? " ★" : ""} <span class="dim">(${u.hp}/${u.maxHp}hp SPD${u.speed})</span>`;
    list.appendChild(row);
  });
  el(modalId).classList.remove("hidden");
}
function pickedIndices(listId){
  return [...el(listId).querySelectorAll("input:checked")].map(c => +c.dataset.i);
}

function openSplitModal(){
  if(!G.selected) return;
  openUnitPicker("modal-split", "split-list", G.selected);
}
function confirmSplitPick(){
  const idxs = pickedIndices("split-list");
  const sq = G.selected;
  if(idxs.length < 1) return;
  if(idxs.length >= sq.units.length) return;
  el("modal-split").classList.add("hidden");
  G.pendingSplit = idxs;
  G.mode = "split-dest";
  G.targets = splitTargets(sq);
  G.moveRange = null;
  refreshSidebar();
}

function openGarrisonModal(){
  if(!G.selected) return;
  openUnitPicker("modal-garrison", "gar-list", G.selected);
}
function confirmGarrisonPick(){
  const idxs = pickedIndices("gar-list");
  const sq = G.selected;
  if(idxs.length < 1 || idxs.length >= sq.units.length) return;
  el("modal-garrison").classList.add("hidden");
  doGarrison(sq, idxs);
  refreshSidebar();
}

function startConverge(){
  if(!G.selected) return;
  G.targets = convergeTargets(G.selected);
  if(!G.targets.size){ G.targets = null; return; }
  G.mode = "converge-pick";
  G.moveRange = null;
  refreshSidebar();
}

function cancelMode(){
  G.mode = "idle";
  G.targets = null;
  G.pendingSplit = null;
  refreshSelection();
  refreshSidebar();
}

/* ── Game over ───────────────────────────────────────────── */
function showGameOver(pid, why){
  el("go-title").textContent = `${G.players[pid].name} WINS!`;
  el("go-title").style.color = G.players[pid].color;
  el("go-sub").textContent = `${G.players[pid].name} ${why} after ${G.round - 1} round(s).`;
  el("modal-gameover").classList.remove("hidden");
  refreshSidebar();
}
