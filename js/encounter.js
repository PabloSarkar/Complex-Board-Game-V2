"use strict";
/* ────────────────────────────────────────────────────────────
   ENCOUNTERS — Pokémon-style battles.
   Both teams predetermine every unit's move each round, then
   the moves resolve in agility order. Moves cost ⚡Power from
   the owning player's pool; with no power a unit simply cannot
   act that battle round. Encounters halt the board turn count.
   ──────────────────────────────────────────────────────────── */
const BATTLE_ROUND_REGEN = 6;   // power trickle per battle round so fights keep moving

const ENC = {
  active: false,
  teams: null,          // [{playerId, label, units:[{unit, from}], choices:{uid:{m,t}}}]
  context: null,        // { attackSq, defSq, building }
  phase: "select",      // select | over
  selTeam: 0,
  round: 1,
  result: null,         // winning team index
  logLines: [],
};

function startEncounter(attackSq, defense){
  G.phase = "encounter";
  G.mode = "idle"; G.moveRange = null; G.targets = null;
  ENC.active = true; ENC.round = 1; ENC.phase = "select"; ENC.selTeam = 0;
  ENC.result = null; ENC.logLines = [];

  let defUnits = [], defOwner, defSq = null, building = null;
  if(defense.type === "squadron"){
    defSq = defense.sq; defOwner = defSq.owner;
    defSq.units.forEach(u => defUnits.push({ unit: u, from: { sq: defSq } }));
    /* defenders standing on their own building fight alongside its garrison */
    const b = buildingAt(G.board, defSq.x, defSq.y);
    if(b && b.owner === defOwner && b.garrison.length){
      building = b;
      b.garrison.forEach(u => defUnits.push({ unit: u, from: { building: b } }));
    }
  } else {
    building = defense.building; defOwner = building.owner;
    building.garrison.forEach(u => defUnits.push({ unit: u, from: { building } }));
  }

  ENC.context = { attackSq, defSq, building };
  ENC.teams = [
    { playerId: attackSq.owner, label: `${G.players[attackSq.owner].name} (ATTACKER)`,
      units: attackSq.units.map(u => ({ unit: u, from: { sq: attackSq } })), choices: {} },
    { playerId: defOwner, label: `${G.players[defOwner].name} (DEFENDER${defSq ? "" : " GARRISON"})`,
      units: defUnits, choices: {} },
  ];
  encLog(`⚔ Encounter at (${attackSq.x},${attackSq.y})! Turn count is halted until it resolves.`);
  initChoices(0); initChoices(1);
  openEncounterModal();
}

function livingUnits(ti){ return ENC.teams[ti].units.filter(b => b.unit.hp > 0); }

function initChoices(ti){
  const team = ENC.teams[ti];
  team.choices = {};
  for(const bu of livingUnits(ti)){
    const move = bu.unit.moves[0];
    team.choices[bu.unit.uid] = { m: 0, t: defaultTarget(ti, move) };
  }
}

function defaultTarget(ti, move){
  const pool = move.heal != null ? livingUnits(ti) : livingUnits(1 - ti);
  return pool.length ? pool[0].unit.uid : null;
}

function encLog(msg){
  ENC.logLines.push(msg);
  const el = document.getElementById("enc-log");
  if(el){
    const d = document.createElement("div");
    d.textContent = msg;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }
}

function encLockIn(){
  if(ENC.phase !== "select") return;
  if(ENC.selTeam === 0){
    ENC.selTeam = 1;
    renderEncounter();
  } else {
    resolveBattleRound();
  }
}

/* Resolve one battle round: all chosen moves, in agility order. */
function resolveBattleRound(){
  encLog(`── Battle round ${ENC.round} ──`);
  const acts = [];
  ENC.teams.forEach((team, ti) => {
    for(const bu of team.units){
      if(bu.unit.hp <= 0) continue;
      const ch = team.choices[bu.unit.uid];
      if(ch) acts.push({ bu, team, ti, ch });
    }
  });
  acts.sort((a, b) => (b.bu.unit.agility - a.bu.unit.agility) || (Math.random() - 0.5));

  for(const a of acts){
    const u = a.bu.unit;
    if(u.hp <= 0) continue;                              // KO'd earlier this round
    const move = u.moves[a.ch.m];
    const pl = G.players[a.team.playerId];
    if(pl.power < move.cost){
      encLog(`${u.icon} ${u.name} has no power — cannot move!`);
      continue;
    }
    pl.power -= move.cost;
    if(move.dmg != null){
      const foes = ENC.teams[1 - a.ti].units;
      let tgt = foes.find(b => b.unit.uid === a.ch.t && b.unit.hp > 0)
             || foes.find(b => b.unit.hp > 0);
      if(!tgt){ encLog(`${u.icon} ${u.name} finds no target.`); continue; }
      const dmg = Math.max(1, move.dmg - tgt.unit.def);
      tgt.unit.hp = Math.max(0, tgt.unit.hp - dmg);
      encLog(`${u.icon} ${u.name} used ${move.name} on ${tgt.unit.icon} ${tgt.unit.name} — ${dmg} dmg${tgt.unit.hp <= 0 ? "  ✖ KO!" : ""}`);
    } else {
      const allies = a.team.units;
      let tgt = allies.find(b => b.unit.uid === a.ch.t && b.unit.hp > 0) || a.bu;
      const amt = Math.min(move.heal, tgt.unit.maxHp - tgt.unit.hp);
      tgt.unit.hp += amt;
      encLog(`${u.icon} ${u.name} used ${move.name} — ${tgt.unit.icon} ${tgt.unit.name} +${amt} HP`);
    }
  }

  const dead0 = livingUnits(0).length === 0;
  const dead1 = livingUnits(1).length === 0;
  if(dead0 || dead1){
    ENC.phase = "over";
    ENC.result = dead0 && dead1 ? -1 : dead0 ? 1 : 0;
    encLog(ENC.result === -1 ? "☠ Both sides were wiped out!"
         : `🏆 ${ENC.teams[ENC.result].label} wins the encounter!`);
  } else {
    ENC.round++;
    for(const t of ENC.teams){
      const p = G.players[t.playerId];
      p.power = Math.min(POWER_CAP, p.power + BATTLE_ROUND_REGEN);
    }
    ENC.selTeam = 0;
    initChoices(0); initChoices(1);
  }
  renderEncounter();
}

/* Apply the battle outcome back to the board. */
function finishEncounter(){
  const { attackSq, defSq, building } = ENC.context;
  for(const team of ENC.teams){
    for(const bu of team.units){
      if(bu.unit.hp > 0) continue;
      if(bu.from.sq) bu.from.sq.units = bu.from.sq.units.filter(u => u !== bu.unit);
      else bu.from.building.garrison = bu.from.building.garrison.filter(u => u !== bu.unit);
    }
  }
  const atkAlive = livingUnits(0).length > 0;
  const defAlive = livingUnits(1).length > 0;
  G.squadrons = G.squadrons.filter(s => s.units.length > 0);
  if(atkAlive && !defAlive){
    if(building){
      building.owner = attackSq.owner;
      building.garrison = [];
      addLog(`${G.players[attackSq.owner].name} captured the ${buildingLabel(building.type)}!`);
    }
    addLog(`${G.players[attackSq.owner].name} won the encounter.`);
  } else if(!atkAlive && defAlive){
    addLog(`The attacking squadron was wiped out.`);
  } else if(!atkAlive && !defAlive){
    addLog(`Both squadrons were destroyed in the encounter.`);
  }
  ENC.active = false;
  G.phase = "board";
  closeEncounterModal();
  G.selected = atkAlive && G.squadrons.includes(attackSq) ? attackSq : null;
  refreshSelection();
  checkWin();
  refreshSidebar();
}

/* ── Encounter modal DOM ─────────────────────────────────── */
function openEncounterModal(){
  document.getElementById("enc-log").innerHTML = "";
  for(const line of ENC.logLines) encLog2(line);
  document.getElementById("modal-encounter").classList.remove("hidden");
  renderEncounter();
}
function encLog2(msg){ /* replay without re-pushing */
  const el = document.getElementById("enc-log");
  const d = document.createElement("div");
  d.textContent = msg; el.appendChild(d);
}
function closeEncounterModal(){
  document.getElementById("modal-encounter").classList.add("hidden");
}

function renderEncounter(){
  document.getElementById("enc-title").textContent =
    `⚔ ENCOUNTER — Battle Round ${ENC.round}`;
  const p0 = G.players[ENC.teams[0].playerId], p1 = G.players[ENC.teams[1].playerId];
  document.getElementById("enc-power").innerHTML =
    `<span style="color:${p0.color}">${p0.name} ⚡${p0.power}</span> &nbsp;·&nbsp; ` +
    `<span style="color:${p1.color}">${p1.name} ⚡${p1.power}</span>`;

  ENC.teams.forEach((team, ti) => {
    const pl = G.players[team.playerId];
    const head = document.getElementById(`enc-h-${ti}`);
    head.textContent = team.label +
      (ENC.phase === "select" ? (ENC.selTeam === ti ? " — PICK MOVES" : (ti < ENC.selTeam ? " — LOCKED ✓" : " — WAITING")) : "");
    head.style.color = pl.color;
    document.getElementById(`enc-team-${ti}`).classList.toggle("active-team",
      ENC.phase === "select" && ENC.selTeam === ti);

    const box = document.getElementById(`enc-units-${ti}`);
    box.innerHTML = "";
    for(const bu of team.units){
      const u = bu.unit;
      const row = document.createElement("div");
      row.className = "enc-row" + (u.hp <= 0 ? " dead" : "");
      const pct = Math.round(100 * u.hp / u.maxHp);
      row.innerHTML =
        `<span class="enc-icon">${u.icon}</span>` +
        `<span class="enc-name">${u.name}${u.commander ? " ★" : ""}` +
        `<span class="bar"><span class="fill" style="width:${pct}%;background:${pct > 50 ? "#5fd45f" : pct > 25 ? "#ffd24a" : "#ff5a5a"}"></span></span>` +
        `<span class="hp-num">${u.hp}/${u.maxHp} · AGI ${u.agility} · DEF ${u.def}</span></span>`;
      if(u.hp > 0 && ENC.phase === "select" && ENC.selTeam === ti){
        const ch = team.choices[u.uid];
        const mv = document.createElement("select");
        u.moves.forEach((m, i) => {
          const o = document.createElement("option");
          o.value = i;
          o.textContent = `${m.name} (⚡${m.cost} ${m.dmg != null ? "DMG " + m.dmg : "HEAL " + m.heal})`;
          mv.appendChild(o);
        });
        mv.value = ch.m;
        const tg = document.createElement("select");
        const fillTargets = () => {
          tg.innerHTML = "";
          const move = u.moves[+mv.value];
          const pool = move.heal != null ? livingUnits(ti) : livingUnits(1 - ti);
          for(const p of pool){
            const o = document.createElement("option");
            o.value = p.unit.uid;
            o.textContent = `${p.unit.icon} ${p.unit.name} (${p.unit.hp}hp)`;
            tg.appendChild(o);
          }
          if(pool.some(p => p.unit.uid === ch.t)) tg.value = ch.t;
          else if(pool.length){ tg.value = pool[0].unit.uid; ch.t = pool[0].unit.uid; }
        };
        fillTargets();
        mv.addEventListener("change", () => { ch.m = +mv.value; ch.t = defaultTarget(ti, u.moves[ch.m]); fillTargets(); });
        tg.addEventListener("change", () => { ch.t = +tg.value; });
        row.appendChild(mv);
        row.appendChild(tg);
      } else if(u.hp > 0 && ENC.phase === "select" && ti < ENC.selTeam){
        const lock = document.createElement("span");
        lock.className = "dim"; lock.textContent = "locked ✓";
        row.appendChild(lock);
      }
      box.appendChild(row);
    }
  });

  document.getElementById("btn-enc-lock").classList.toggle("hidden", ENC.phase !== "select");
  document.getElementById("btn-enc-lock").textContent =
    ENC.selTeam === 0 ? "LOCK IN MOVES ▶ (then defender picks)" : "FIGHT!";
  document.getElementById("btn-enc-close").classList.toggle("hidden", ENC.phase !== "over");
}
