"use strict";
/* ────────────────────────────────────────────────────────────
   CANVAS RENDERER — chunky pixels for a retro feel.
   Terrain is pre-baked to a 100×100 offscreen canvas (1px per
   tile) and blown up with image smoothing off.
   ──────────────────────────────────────────────────────────── */
const CAM = { x: 50, y: 50, z: 12 };   // z = pixels per tile
const ZOOM_MIN = 4, ZOOM_MAX = 28;

const TERRAIN_COLORS = ["#3e6e34", "#457a3a", "#37622e", "#2c5226"];
const BUILDING_COLORS = { village: "#c9824e", well: "#3fb8c9", mine: "#8f8f9c" };
const BUILDING_ICONS  = { village: "🏘", well: "⚡", mine: "⛏" };

let boardCanvas, bctx, miniCanvas, mctx, terrainCache = null;

function initRenderer(){
  boardCanvas = document.getElementById("board-canvas");
  bctx = boardCanvas.getContext("2d");
  miniCanvas = document.getElementById("minimap");
  mctx = miniCanvas.getContext("2d");
  requestAnimationFrame(drawFrame);
}

function buildTerrainCache(){
  terrainCache = document.createElement("canvas");
  terrainCache.width = BOARD_SIZE; terrainCache.height = BOARD_SIZE;
  const c = terrainCache.getContext("2d");
  for(let y = 0; y < BOARD_SIZE; y++)
    for(let x = 0; x < BOARD_SIZE; x++){
      c.fillStyle = TERRAIN_COLORS[G.board.terrain[tileIdx(x, y)]];
      c.fillRect(x, y, 1, 1);
    }
}

function centerCameraOnPlayer(pid){
  const sq = G.squadrons.find(s => s.owner === pid);
  if(sq){ CAM.x = sq.x + 0.5; CAM.y = sq.y + 0.5; }
}

function tileFromEvent(e){
  const r = boardCanvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  return [
    Math.floor(CAM.x + (px - r.width / 2) / CAM.z),
    Math.floor(CAM.y + (py - r.height / 2) / CAM.z),
  ];
}

function drawFrame(){
  requestAnimationFrame(drawFrame);
  if(!boardCanvas) return;
  const holder = boardCanvas.parentElement;
  if(boardCanvas.width !== holder.clientWidth - 260 || boardCanvas.height !== holder.clientHeight){
    boardCanvas.width  = Math.max(100, holder.clientWidth - 260);
    boardCanvas.height = Math.max(100, holder.clientHeight);
  }
  const w = boardCanvas.width, h = boardCanvas.height;
  bctx.fillStyle = "#0e0b16";
  bctx.fillRect(0, 0, w, h);
  if(!G.board || (G.phase !== "board" && G.phase !== "encounter" && G.phase !== "gameover")) return;

  CAM.x = Math.max(0, Math.min(BOARD_SIZE, CAM.x));
  CAM.y = Math.max(0, Math.min(BOARD_SIZE, CAM.y));
  const z = CAM.z;
  const ox = w / 2 - CAM.x * z, oy = h / 2 - CAM.y * z;
  const px = (x) => Math.round(ox + x * z);
  const py = (y) => Math.round(oy + y * z);

  /* terrain */
  bctx.imageSmoothingEnabled = false;
  if(terrainCache) bctx.drawImage(terrainCache, ox, oy, BOARD_SIZE * z, BOARD_SIZE * z);
  /* board border */
  bctx.strokeStyle = "#000";
  bctx.lineWidth = 3;
  bctx.strokeRect(px(0), py(0), BOARD_SIZE * z, BOARD_SIZE * z);

  /* zones */
  for(const zone of G.board.zones){
    const owners = new Set();
    for(let dy = 0; dy < 3; dy++)
      for(let dx = 0; dx < 3; dx++){
        const s = squadronAt(zone.x + dx, zone.y + dy);
        if(s) owners.add(s.owner);
      }
    let col = "255,210,74";
    if(owners.size === 1) col = [...owners][0] === 0 ? "74,163,255" : "255,90,90";
    bctx.fillStyle = `rgba(${col},0.25)`;
    bctx.fillRect(px(zone.x), py(zone.y), 3 * z, 3 * z);
    bctx.strokeStyle = `rgba(${col},0.9)`;
    bctx.lineWidth = 2;
    bctx.strokeRect(px(zone.x) + 1, py(zone.y) + 1, 3 * z - 2, 3 * z - 2);
  }

  /* buildings (2×2) */
  for(const b of G.board.buildings){
    bctx.fillStyle = BUILDING_COLORS[b.type];
    bctx.fillRect(px(b.x), py(b.y), 2 * z, 2 * z);
    bctx.strokeStyle = b.owner < 0 ? "rgba(0,0,0,0.55)" : G.players[b.owner].color;
    bctx.lineWidth = b.owner < 0 ? 1 : 3;
    bctx.strokeRect(px(b.x) + 1, py(b.y) + 1, 2 * z - 2, 2 * z - 2);
    if(z >= 7){
      bctx.font = `${Math.floor(z * 1.1)}px sans-serif`;
      bctx.textAlign = "center"; bctx.textBaseline = "middle";
      bctx.fillText(BUILDING_ICONS[b.type], px(b.x) + z, py(b.y) + z);
      if(b.garrison.length && z >= 9){
        bctx.font = `bold ${Math.floor(z * 0.7)}px monospace`;
        bctx.fillStyle = "#fff";
        bctx.fillText("g" + b.garrison.length, px(b.x) + 2 * z - z * 0.5, py(b.y) + 2 * z - z * 0.45);
      }
    }
  }

  /* move range */
  if(G.moveRange && G.phase === "board"){
    bctx.fillStyle = "rgba(255,255,255,0.28)";
    for(const ti of G.moveRange){
      const x = ti % BOARD_SIZE, y = Math.floor(ti / BOARD_SIZE);
      bctx.fillRect(px(x), py(y), z, z);
    }
  }
  /* split / converge targets */
  if(G.targets && G.phase === "board"){
    bctx.fillStyle = "rgba(95,212,95,0.45)";
    for(const ti of G.targets){
      const x = ti % BOARD_SIZE, y = Math.floor(ti / BOARD_SIZE);
      bctx.fillRect(px(x), py(y), z, z);
    }
  }

  /* squadrons */
  for(const sq of G.squadrons){
    const inset = Math.max(1, Math.round(z * 0.12));
    const sx = px(sq.x) + inset, sy = py(sq.y) + inset, sz = z - inset * 2;
    bctx.fillStyle = G.players[sq.owner].color;
    bctx.fillRect(sx, sy, sz, sz);
    bctx.strokeStyle = sq === G.selected ? "#ffffff" : "#0d0a14";
    bctx.lineWidth = sq === G.selected ? 3 : 2;
    bctx.strokeRect(sx, sy, sz, sz);
    if(z >= 8){
      const cmd = sq.units.find(u => u.commander);
      bctx.textAlign = "center"; bctx.textBaseline = "middle";
      if(z >= 16 && cmd){
        bctx.font = `${Math.floor(z * 0.62)}px sans-serif`;
        bctx.fillText(cmd.icon, px(sq.x) + z / 2, py(sq.y) + z * 0.38);
        bctx.font = `bold ${Math.floor(z * 0.42)}px monospace`;
        bctx.fillStyle = "#fff";
        bctx.fillText(String(sq.units.length), px(sq.x) + z / 2, py(sq.y) + z * 0.78);
      } else {
        bctx.font = `bold ${Math.floor(z * 0.55)}px monospace`;
        bctx.fillStyle = "#fff";
        bctx.fillText(String(sq.units.length), px(sq.x) + z / 2, py(sq.y) + z / 2);
      }
    }
  }

  drawMinimap();
}

function drawMinimap(){
  if(!G.board) return;
  const s = 1.5;
  mctx.imageSmoothingEnabled = false;
  mctx.fillStyle = "#0e0b16";
  mctx.fillRect(0, 0, 150, 150);
  if(terrainCache) mctx.drawImage(terrainCache, 0, 0, 150, 150);
  for(const zone of G.board.zones){
    mctx.fillStyle = "#ffd24a";
    mctx.fillRect(zone.x * s, zone.y * s, 3 * s, 3 * s);
  }
  for(const b of G.board.buildings){
    mctx.fillStyle = b.owner < 0 ? "#e8e0d0" : G.players[b.owner].color;
    mctx.fillRect(b.x * s, b.y * s, 2 * s, 2 * s);
  }
  for(const sq of G.squadrons){
    mctx.fillStyle = G.players[sq.owner].color;
    mctx.fillRect(sq.x * s - 1, sq.y * s - 1, 4, 4);
  }
  /* viewport rectangle */
  const vw = boardCanvas.width / CAM.z, vh = boardCanvas.height / CAM.z;
  mctx.strokeStyle = "#ffffff";
  mctx.lineWidth = 1;
  mctx.strokeRect((CAM.x - vw / 2) * s, (CAM.y - vh / 2) * s, vw * s, vh * s);
}
