"use strict";
/* ────────────────────────────────────────────────────────────
   MAIN — bootstrapping & input wiring.
   ──────────────────────────────────────────────────────────── */
function startGame(squadsP0, squadsP1){
  initGame(squadsP0, squadsP1);
  buildTerrainCache();
  showScreen("game");
  centerCameraOnPlayer(0);
  CAM.z = 12;
  refreshSidebar();
}

function onBoardClick(x, y){
  if(G.phase !== "board") return;
  if(x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return;
  const ti = tileIdx(x, y);

  if(G.mode === "split-dest"){
    if(G.targets && G.targets.has(ti) && G.pendingSplit){
      const idxs = G.pendingSplit;
      G.mode = "idle"; G.targets = null; G.pendingSplit = null;
      doSplit(G.selected, idxs, x, y);
    } else cancelMode();
    refreshSidebar();
    return;
  }
  if(G.mode === "converge-pick"){
    const t = squadronAt(x, y);
    if(t && G.targets && G.targets.has(ti) && t.owner === G.current){
      G.mode = "idle"; G.targets = null;
      doConverge(G.selected, t);
    } else cancelMode();
    refreshSidebar();
    return;
  }

  const sq = squadronAt(x, y);
  if(sq && sq.owner === G.current){
    G.selected = sq;
    refreshSelection();
  } else if(G.selected && G.selected.owner === G.current && G.moveRange && G.moveRange.has(ti)){
    tryMoveTo(x, y);
  } else if(sq){
    G.selected = sq;               // inspect enemy squadron
    G.moveRange = null;
  } else {
    G.selected = null;
    G.moveRange = null;
  }
  refreshSidebar();
}

window.addEventListener("DOMContentLoaded", () => {
  initRenderer();
  el("title-wincp").textContent = WIN_CP;

  /* title screen */
  el("btn-build").addEventListener("click", () => openDeckBuilder(0));
  el("btn-quick").addEventListener("click", () => startGame(randomSquads(), randomSquads()));

  /* deck builder */
  el("btn-deck-random").addEventListener("click", () => { DECK.squads = randomSquads(); renderSquadGrid(); });
  el("btn-deck-clear").addEventListener("click", () => { DECK.squads = emptySquads(); renderSquadGrid(); });
  el("btn-deck-copy").addEventListener("click", () => {
    if(DECK.decks[0]) { DECK.squads = DECK.decks[0].map(s => [...s]); renderSquadGrid(); }
  });
  el("btn-deck-confirm").addEventListener("click", confirmDeck);

  /* board interactions */
  const canvas = el("board-canvas");
  let dragging = false, dragMoved = false, lastX = 0, lastY = 0;
  canvas.addEventListener("mousedown", e => {
    dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener("mousemove", e => {
    if(!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if(Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
    if(dragMoved){
      CAM.x -= dx / CAM.z; CAM.y -= dy / CAM.z;
      lastX = e.clientX; lastY = e.clientY;
    }
  });
  window.addEventListener("mouseup", e => {
    if(!dragging) return;
    dragging = false;
    if(!dragMoved && e.target === canvas){
      const [x, y] = tileFromEvent(e);
      onBoardClick(x, y);
    }
  });
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
    const before = CAM.z;
    CAM.z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, CAM.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    /* keep the tile under the cursor fixed while zooming */
    CAM.x += mx / before - mx / CAM.z;
    CAM.y += my / before - my / CAM.z;
  }, { passive: false });

  el("minimap").addEventListener("mousedown", e => {
    const r = e.target.getBoundingClientRect();
    CAM.x = (e.clientX - r.left) / 1.5;
    CAM.y = (e.clientY - r.top) / 1.5;
  });

  window.addEventListener("keydown", e => {
    if(G.phase !== "board") return;
    const step = Math.max(1, Math.round(40 / CAM.z));
    if(e.key === "ArrowLeft"  || e.key === "a") CAM.x -= step;
    if(e.key === "ArrowRight" || e.key === "d") CAM.x += step;
    if(e.key === "ArrowUp"    || e.key === "w") CAM.y -= step;
    if(e.key === "ArrowDown"  || e.key === "s") CAM.y += step;
    if(e.key === "Escape") cancelMode();
  });

  /* sidebar buttons */
  el("btn-split").addEventListener("click", openSplitModal);
  el("btn-converge").addEventListener("click", startConverge);
  el("btn-garrison").addEventListener("click", openGarrisonModal);
  el("btn-collect").addEventListener("click", () => { collectGarrison(G.selected); refreshSidebar(); });
  el("btn-endturn").addEventListener("click", () => { endTurn(); refreshSidebar(); });

  /* modals */
  el("btn-split-ok").addEventListener("click", confirmSplitPick);
  el("btn-split-cancel").addEventListener("click", () => el("modal-split").classList.add("hidden"));
  el("btn-gar-ok").addEventListener("click", confirmGarrisonPick);
  el("btn-gar-cancel").addEventListener("click", () => el("modal-garrison").classList.add("hidden"));
  el("btn-enc-lock").addEventListener("click", () => { encLockIn(); refreshSidebar(); });
  el("btn-enc-close").addEventListener("click", finishEncounter);
  el("btn-restart").addEventListener("click", () => location.reload());
});
