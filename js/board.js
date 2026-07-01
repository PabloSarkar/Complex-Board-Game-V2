"use strict";
/* ────────────────────────────────────────────────────────────
   BOARD GENERATION
   100×100 tile board. One fixed seed → the same board is used
   for every game. Zones (3×3) sit along the equator near the
   centre; buildings (2×2) are scattered with a higher
   concentration near the centre of the map.
   ──────────────────────────────────────────────────────────── */
const BOARD_SIZE = 100;
const BOARD_SEED = 20260701;
const BUILDING_COUNT = 48;

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function tileIdx(x, y){ return y * BOARD_SIZE + x; }

function generateBoard(seed = BOARD_SEED){
  const rnd = mulberry32(seed);

  /* terrain variants: 0-2 grass shades, 3 = trees (visual only, all passable) */
  const terrain = new Uint8Array(BOARD_SIZE * BOARD_SIZE);
  for(let i = 0; i < terrain.length; i++){
    const r = rnd();
    terrain[i] = r < 0.60 ? 0 : r < 0.80 ? 1 : r < 0.92 ? 2 : 3;
  }

  /* ── Zones: 3×3, spread along the equator, close to centre rows ── */
  const zones = [];
  const zoneXs = [14, 26, 38, 50, 62, 74, 86];
  for(const cx of zoneXs){
    const cy = 50 + (Math.floor(rnd() * 7) - 3);      // jitter ±3 around equator
    zones.push({ x: cx - 1, y: cy - 1 });             // top-left of 3×3
  }

  /* ── Buildings: 2×2, gaussian-clustered around the map centre ── */
  const blocked = new Set();
  const block = (x, y, w, h, margin) => {
    for(let dy = -margin; dy < h + margin; dy++)
      for(let dx = -margin; dx < w + margin; dx++)
        blocked.add(tileIdx(x + dx, y + dy));
  };
  for(const z of zones) block(z.x, z.y, 3, 3, 2);

  const buildings = [];
  const buildingMap = new Map();                       // tileIdx → building
  const types = ["village", "well", "mine"];
  for(let tries = 0; tries < 6000 && buildings.length < BUILDING_COUNT; tries++){
    /* sum of uniforms ≈ gaussian → denser near the centre */
    const gx = (rnd() + rnd() + rnd() + rnd() - 2) / 2;
    const gy = (rnd() + rnd() + rnd() + rnd() - 2) / 2;
    const x = Math.round(50 + gx * 46);
    const y = Math.round(50 + gy * 42);
    if(x < 2 || x > BOARD_SIZE - 4 || y < 8 || y > BOARD_SIZE - 10) continue;   // keep spawn rows clear
    let free = true;
    for(let dy = 0; dy < 2 && free; dy++)
      for(let dx = 0; dx < 2 && free; dx++)
        if(blocked.has(tileIdx(x + dx, y + dy))) free = false;
    if(!free) continue;
    const r = rnd();
    const type = r < 0.4 ? "village" : r < 0.7 ? "well" : "mine";
    const b = { id: buildings.length, type, x, y, owner: -1, garrison: [] };
    buildings.push(b);
    block(x, y, 2, 2, 1);
    for(let dy = 0; dy < 2; dy++)
      for(let dx = 0; dx < 2; dx++)
        buildingMap.set(tileIdx(x + dx, y + dy), b);
  }

  return { size: BOARD_SIZE, terrain, zones, buildings, buildingMap };
}

function buildingAt(board, x, y){
  return board.buildingMap.get(tileIdx(x, y)) || null;
}

function zoneAt(board, x, y){
  for(const z of board.zones)
    if(x >= z.x && x < z.x + 3 && y >= z.y && y < z.y + 3) return z;
  return null;
}
