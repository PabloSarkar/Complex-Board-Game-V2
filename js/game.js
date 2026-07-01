"use strict";
/* ────────────────────────────────────────────────────────────
   CORE GAME STATE & BOARD-PHASE RULES
   ──────────────────────────────────────────────────────────── */
const WIN_CP        = 25;   // control points needed to win
const START_AP      = 20;   // action points granted each turn
const START_POWER   = 30;
const POWER_CAP     = 99;
const POWER_REGEN   = 5;    // base power regen per round
const WELL_POWER    = 3;    // extra power per owned energy well per round
const MINE_GOLD     = 3;    // gold per owned mine per round
const VILLAGE_EVERY = 3;    // villages spawn a militia every N rounds
const GARRISON_CAP  = 5;

const G = {
  phase: "title",           // title | deck | board | encounter | gameover
  board: null,
  players: [],
  squadrons: [],
  current: 0,               // whose turn (0 = BLUE, 1 = RED)
  round: 1,
  selected: null,           // selected squadron
  mode: "idle",             // idle | split-dest | converge-pick
  moveRange: null,          // Set<tileIdx> reachable this move
  targets: null,            // Set<tileIdx> highlighted for split/converge
  pendingSplit: null,       // unit indices chosen in the split modal
  log: [],
  winner: null,
};
let SQ_SEQ = 1;

function mkPlayer(id, name, color){
  return { id, name, color, ap: START_AP, power: START_POWER, gold: 0, cp: 0 };
}

function initGame(squadsP0, squadsP1){
  G.board = generateBoard();
  G.players = [mkPlayer(0, "BLUE", "#4aa3ff"), mkPlayer(1, "RED", "#ff5a5a")];
  G.squadrons = [];
  G.current = 0; G.round = 1; G.winner = null;
  G.selected = null; G.mode = "idle"; G.moveRange = null; G.targets = null;
  G.log = [];
  const xs = [41, 47, 53, 59];                     // opposite ends of the map
  squadsP0.forEach((ids, i) => spawnSquadron(0, xs[i], 2, ids));
  squadsP1.forEach((ids, i) => spawnSquadron(1, xs[i], BOARD_SIZE - 3, ids));
  G.phase = "board";
  addLog(`Round 1 — BLUE moves first. First to ${WIN_CP} ◈ wins!`);
}

function spawnSquadron(owner, x, y, charIds){
  G.squadrons.push({ id: SQ_SEQ++, owner, x, y, units: charIds.map(makeUnit) });
}

function squadronAt(x, y, excl){
  return G.squadrons.find(s => s !== excl && s.x === x && s.y === y) || null;
}

/* Squadron speed = speed of its slowest member. */
function squadSpeed(sq){
  return Math.max(1, Math.min(...sq.units.map(u => u.speed)));
}

function totalUnits(pid){
  let n = G.squadrons.filter(s => s.owner === pid).reduce((a, s) => a + s.units.length, 0);
  for(const b of G.board.buildings) if(b.owner === pid) n += b.garrison.length;
  return n;
}

function addLog(msg){
  G.log.push(msg);
  if(G.log.length > 40) G.log.shift();
}

/* ── Movement ─────────────────────────────────────────────── */
/* BFS out to the squadron's speed. Friendly squadrons block;
   enemy squadrons are valid end-points (→ encounter) but can't
   be moved through. */
function computeMoveRange(sq){
  const speed = squadSpeed(sq);
  const range = new Set();
  const seen = new Set([tileIdx(sq.x, sq.y)]);
  let frontier = [[sq.x, sq.y]];
  for(let d = 1; d <= speed; d++){
    const next = [];
    for(const [x, y] of frontier){
      for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x + dx, ny = y + dy;
        if(nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) continue;
        const ti = tileIdx(nx, ny);
        if(seen.has(ti)) continue;
        seen.add(ti);
        const occ = squadronAt(nx, ny);
        if(occ && occ.owner === sq.owner) continue;         // friendly: blocked
        range.add(ti);
        if(occ) continue;                                    // enemy: stop here
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return range;
}

function refreshSelection(){
  const sq = G.selected;
  G.moveRange = null;
  if(sq && sq.owner === G.current && G.players[G.current].ap > 0 && G.phase === "board")
    G.moveRange = computeMoveRange(sq);
}

function tryMoveTo(x, y){
  const sq = G.selected;
  const pl = G.players[G.current];
  if(!sq || sq.owner !== G.current || !G.moveRange) return false;
  if(!G.moveRange.has(tileIdx(x, y)) || pl.ap < 1) return false;
  pl.ap -= 1;
  sq.x = x; sq.y = y;
  addLog(`${pl.name} squadron moved to (${x},${y}).`);
  G.moveRange = null;
  resolveArrival(sq);
  if(G.phase === "board") refreshSelection();
  return true;
}

/* What happens when a squadron lands on a tile. */
function resolveArrival(sq){
  const enemy = squadronAt(sq.x, sq.y, sq);
  if(enemy && enemy.owner !== sq.owner){
    startEncounter(sq, { type: "squadron", sq: enemy });
    return;
  }
  const b = buildingAt(G.board, sq.x, sq.y);
  if(!b) return;
  if(b.owner === sq.owner) return;                          // already ours
  if(b.owner >= 0 && b.garrison.length > 0){
    startEncounter(sq, { type: "garrison", building: b }); // fight the garrison
    return;
  }
  b.owner = sq.owner;                                       // unguarded → capture
  addLog(`${G.players[sq.owner].name} occupied a ${buildingLabel(b.type)}!`);
}

function buildingLabel(type){
  return type === "village" ? "Village 🏘" : type === "well" ? "Energy Well ⚡" : "Mine ⛏";
}

/* ── Split ────────────────────────────────────────────────── */
function splitTargets(sq){
  const t = new Set();
  for(let dy = -1; dy <= 1; dy++)
    for(let dx = -1; dx <= 1; dx++){
      if(!dx && !dy) continue;
      const nx = sq.x + dx, ny = sq.y + dy;
      if(nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) continue;
      if(squadronAt(nx, ny)) continue;
      t.add(tileIdx(nx, ny));
    }
  return t;
}

function doSplit(sq, unitIdxs, x, y){
  const pl = G.players[G.current];
  if(pl.ap < 1) return false;
  if(unitIdxs.length < 1 || unitIdxs.length >= sq.units.length) return false;
  pl.ap -= 1;
  const moving = unitIdxs.map(i => sq.units[i]);
  sq.units = sq.units.filter((u, i) => !unitIdxs.includes(i));
  const nsq = { id: SQ_SEQ++, owner: sq.owner, x, y, units: moving };
  G.squadrons.push(nsq);
  addLog(`${pl.name} split off a squadron of ${moving.length}.`);
  G.selected = nsq;
  resolveArrival(nsq);
  if(G.phase === "board") refreshSelection();
  return true;
}

/* ── Converge ─────────────────────────────────────────────── */
function convergeTargets(sq){
  const t = new Set();
  for(const o of G.squadrons){
    if(o === sq || o.owner !== sq.owner) continue;
    if(Math.abs(o.x - sq.x) <= 1 && Math.abs(o.y - sq.y) <= 1)
      t.add(tileIdx(o.x, o.y));
  }
  return t;
}

/* Merged squadron sits on the tile of whichever had more troops. */
function doConverge(a, b){
  const pl = G.players[G.current];
  if(pl.ap < 1) return false;
  const big = b.units.length > a.units.length ? b : a;
  const small = big === a ? b : a;
  big.units = big.units.concat(small.units);
  G.squadrons = G.squadrons.filter(s => s !== small);
  pl.ap -= 1;
  addLog(`${pl.name} squadrons converged (${big.units.length} units).`);
  G.selected = big;
  refreshSelection();
  return true;
}

/* ── Garrison ─────────────────────────────────────────────── */
function doGarrison(sq, unitIdxs){
  const b = buildingAt(G.board, sq.x, sq.y);
  if(!b || b.owner !== sq.owner) return false;
  if(unitIdxs.length < 1 || unitIdxs.length >= sq.units.length) return false;
  const staying = unitIdxs.map(i => sq.units[i]);
  sq.units = sq.units.filter((u, i) => !unitIdxs.includes(i));
  b.garrison = b.garrison.concat(staying);
  addLog(`${G.players[sq.owner].name} left ${staying.length} unit(s) garrisoning the ${buildingLabel(b.type)}.`);
  refreshSelection();
  return true;
}

function collectGarrison(sq){
  const b = buildingAt(G.board, sq.x, sq.y);
  if(!b || b.owner !== sq.owner || !b.garrison.length) return false;
  sq.units = sq.units.concat(b.garrison);
  addLog(`${G.players[sq.owner].name} collected ${b.garrison.length} garrisoned unit(s).`);
  b.garrison = [];
  refreshSelection();
  return true;
}

/* ── Turn flow ────────────────────────────────────────────── */
function endTurn(){
  if(G.phase !== "board") return;
  G.selected = null; G.mode = "idle"; G.moveRange = null; G.targets = null;
  if(G.current === 0){
    G.current = 1;
    G.players[1].ap = START_AP;
    addLog(`— RED's turn —`);
  } else {
    endRound();
    if(G.phase !== "gameover"){
      G.current = 0;
      G.players[0].ap = START_AP;
      addLog(`— Round ${G.round}: BLUE's turn —`);
    }
  }
  centerCameraOnPlayer(G.current);
}

/* Round upkeep: control points, resources, village spawns.
   (Encounters halt this — the round only advances between turns.) */
function endRound(){
  for(const z of G.board.zones){
    const owners = new Set();
    for(let dy = 0; dy < 3; dy++)
      for(let dx = 0; dx < 3; dx++){
        const s = squadronAt(z.x + dx, z.y + dy);
        if(s) owners.add(s.owner);
      }
    if(owners.size === 1){
      const o = [...owners][0];
      G.players[o].cp++;
      addLog(`${G.players[o].name} holds a zone: +1 ◈ (${G.players[o].cp}).`);
    }
  }
  for(const p of G.players)
    p.power = Math.min(POWER_CAP, p.power + POWER_REGEN);
  for(const b of G.board.buildings){
    if(b.owner < 0) continue;
    const p = G.players[b.owner];
    if(b.type === "well") p.power = Math.min(POWER_CAP, p.power + WELL_POWER);
    else if(b.type === "mine") p.gold += MINE_GOLD;
    else if(b.type === "village" && G.round % VILLAGE_EVERY === 0 && b.garrison.length < GARRISON_CAP){
      b.garrison.push(makeUnit("militia"));
      addLog(`${p.name}'s village trained a Militia 👨‍🌾.`);
    }
  }
  G.round++;
  checkWin();
}

function checkWin(){
  if(G.phase === "gameover") return;
  for(const p of G.players)
    if(p.cp >= WIN_CP) return gameOver(p.id, `reached ${WIN_CP} Control Points`);
  const a0 = totalUnits(0), a1 = totalUnits(1);
  if(a0 === 0 && a1 > 0) return gameOver(1, "destroyed every enemy unit");
  if(a1 === 0 && a0 > 0) return gameOver(0, "destroyed every enemy unit");
}

function gameOver(pid, why){
  G.phase = "gameover";
  G.winner = pid;
  addLog(`${G.players[pid].name} WINS — ${why}!`);
  showGameOver(pid, why);
}
