"use strict";
/* ────────────────────────────────────────────────────────────
   CHARACTER ROSTER
   Every character is unlocked from the start.
   Stats: HP · Moves · Speed (board tiles per move action) ·
          Agility (battle turn order) · Defence (flat dmg reduction)
   Moves: { name, cost (⚡power), dmg } or { name, cost, heal }
   ──────────────────────────────────────────────────────────── */
const CHARACTERS = [
  /* ── Commanders — one leads each squadron ── */
  { id:"captain",    name:"Captain",     icon:"⚔️", commander:true, hp:60, speed:4, agility:7, def:4,
    moves:[{name:"Slash",cost:2,dmg:12},{name:"Rallying Strike",cost:4,dmg:18},{name:"Field Mend",cost:3,heal:10}]},
  { id:"warlord",    name:"Warlord",     icon:"🪓", commander:true, hp:75, speed:3, agility:5, def:6,
    moves:[{name:"Cleave",cost:2,dmg:11},{name:"Executioner",cost:5,dmg:22},{name:"War Cry",cost:3,heal:12}]},
  { id:"huntmaster", name:"Huntmaster",  icon:"🏹", commander:true, hp:50, speed:6, agility:9, def:3,
    moves:[{name:"Snap Shot",cost:1,dmg:8},{name:"Piercing Arrow",cost:3,dmg:14},{name:"Double Shot",cost:4,dmg:18}]},
  { id:"archmage",   name:"Archmage",    icon:"🔮", commander:true, hp:45, speed:4, agility:8, def:2,
    moves:[{name:"Spark",cost:1,dmg:9},{name:"Fireball",cost:4,dmg:19},{name:"Arcane Mend",cost:3,heal:14}]},

  /* ── Regulars ── */
  { id:"swordsman",  name:"Swordsman",   icon:"🗡️", hp:45, speed:4, agility:6, def:4,
    moves:[{name:"Slash",cost:2,dmg:10},{name:"Guard Break",cost:4,dmg:16}]},
  { id:"shieldbearer",name:"Shieldbearer",icon:"🛡️", hp:70, speed:3, agility:3, def:8,
    moves:[{name:"Bash",cost:2,dmg:8},{name:"Shield Slam",cost:3,dmg:12}]},
  { id:"archer",     name:"Archer",      icon:"🎯", hp:35, speed:5, agility:8, def:2,
    moves:[{name:"Quick Shot",cost:1,dmg:7},{name:"Long Shot",cost:3,dmg:13}]},
  { id:"knight",     name:"Knight",      icon:"🐴", hp:60, speed:6, agility:5, def:6,
    moves:[{name:"Lance",cost:2,dmg:11},{name:"Cavalry Charge",cost:4,dmg:18}]},
  { id:"mage",       name:"Mage",        icon:"🧙", hp:30, speed:4, agility:7, def:1,
    moves:[{name:"Zap",cost:1,dmg:8},{name:"Firebolt",cost:3,dmg:15}]},
  { id:"healer",     name:"Healer",      icon:"✨", hp:35, speed:4, agility:6, def:2,
    moves:[{name:"Smite",cost:2,dmg:6},{name:"Mend",cost:3,heal:15}]},
  { id:"scout",      name:"Scout",       icon:"🧭", hp:30, speed:8, agility:10, def:1,
    moves:[{name:"Dagger",cost:1,dmg:6},{name:"Ambush",cost:3,dmg:13}]},
  { id:"berserker",  name:"Berserker",   icon:"😤", hp:55, speed:5, agility:6, def:2,
    moves:[{name:"Frenzy",cost:3,dmg:15},{name:"Reckless Blow",cost:5,dmg:23}]},
  { id:"spearman",   name:"Spearman",    icon:"🔱", hp:50, speed:4, agility:5, def:5,
    moves:[{name:"Thrust",cost:2,dmg:10},{name:"Skewer",cost:3,dmg:13}]},
  { id:"crossbowman",name:"Crossbowman", icon:"🏹", hp:40, speed:4, agility:4, def:3,
    moves:[{name:"Bolt",cost:2,dmg:12},{name:"Heavy Bolt",cost:4,dmg:17}]},
  { id:"monk",       name:"Monk",        icon:"👊", hp:45, speed:5, agility:9, def:3,
    moves:[{name:"Jab",cost:1,dmg:7},{name:"Flurry",cost:3,dmg:12},{name:"Chi Mend",cost:3,heal:10}]},
  { id:"golem",      name:"Golem",       icon:"🗿", hp:90, speed:2, agility:1, def:9,
    moves:[{name:"Smash",cost:3,dmg:14},{name:"Quake",cost:5,dmg:20}]},

  /* ── Spawned by villages (also freely usable in decks) ── */
  { id:"militia",    name:"Militia",     icon:"👨‍🌾", hp:20, speed:3, agility:3, def:1,
    moves:[{name:"Pitchfork",cost:1,dmg:5}]},
];

const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

let UNIT_SEQ = 1;
/* Create a live unit instance from a character template. */
function makeUnit(charId){
  const c = CHAR_BY_ID[charId];
  return {
    uid: UNIT_SEQ++, charId,
    name: c.name, icon: c.icon, commander: !!c.commander,
    hp: c.hp, maxHp: c.hp,
    speed: c.speed, agility: c.agility, def: c.def,
    moves: c.moves,
  };
}

function commanderChars(){ return CHARACTERS.filter(c => c.commander); }
function regularChars(){ return CHARACTERS.filter(c => !c.commander && c.id !== "militia"); }

/* Build 4 random squadrons of 5 char ids (index 0 = commander). */
function randomSquads(rnd){
  rnd = rnd || Math.random;
  const squads = [];
  const cs = commanderChars(), rs = regularChars();
  for(let s = 0; s < 4; s++){
    const squad = [cs[Math.floor(rnd() * cs.length)].id];
    for(let i = 0; i < 4; i++) squad.push(rs[Math.floor(rnd() * rs.length)].id);
    squads.push(squad);
  }
  return squads;
}
