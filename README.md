# ZONE COMMANDER

A retro-styled, deck-building tactical board game. HTML/JS prototype (a Godot port is planned once the design settles).

## How to run

Open `index.html` in any modern browser — no build step, no server needed. The whole game (HTML, CSS, JS) is self-contained in that single file, so it works even in previews/hosts that don't fetch sibling files.

## How to play

**Goal:** be the first to **25 Control Points (◈)**, or wipe out every enemy unit.

- The board is a fixed **100×100** tile map (same map every game).
- **Zones** (gold, 3×3) sit along the equator near the centre. At the end of each round, every zone that contains *only your* squadrons gives **+1 ◈**.
- Both players are controlled from the same seat for now (testing mode).

### Decks & squadrons
Before the game, each player builds a deck of **20 units** arranged into **4 squadrons of 5**. Every squadron's first slot (★) must be a **Commander**. All characters are unlocked. Use **RANDOMIZE** or the title-screen **QUICK START** to skip ahead.

### Board turns
Each turn a player gets **20 Action Points (AP)**. Each of these costs **1 AP**:

| Action | Effect |
|---|---|
| **Move** | Select a squadron, click a highlighted tile. Range = speed of its *slowest* member. |
| **Split** | Choose units to break off; they form a new squadron on an adjacent tile. |
| **Converge** | Merge with an adjacent friendly squadron — the merged squadron stands on the tile of whichever had more troops. |

**END / SKIP TURN** passes play. Garrisoning/collecting units at a building you own is free.

### Buildings (2×2, denser near the centre)
- 🏘 **Village** — trains a weak Militia into its garrison every 3 rounds.
- ⚡ **Energy Well** — +3 Power per round.
- ⛏ **Mine** — +3 Gold per round.

Move onto an unguarded building to claim it. When you move on, you can leave a **garrison** behind; an enemy squadron must beat the garrison in an encounter to capture the building.

### Encounters
Landing on a tile with an enemy squadron (or a garrisoned enemy building) starts a Pokémon-style battle — **the round counter halts** until it's resolved.

1. Each battle round, both sides secretly pick a move + target for every unit.
2. Moves resolve in **Agility** order.
3. Damage taken is reduced by the target's **Defence** (minimum 1).
4. Every move costs **⚡ Power** from the owner's shared pool — with no power a unit simply can't act that round. Power regenerates +5 per board round (+3 per owned well) and trickles +6 per battle round.

The battle continues until one side is wiped out. Survivors keep their remaining HP.

### Controls
- **Pan:** drag the map, or WASD / arrow keys. **Zoom:** mouse wheel. **Minimap:** click to jump.
- **Esc:** cancel split/converge targeting.

## Code layout

Everything lives in `index.html`, split into clearly commented `<style>` and `<script>` blocks in this order:

```
<style>            retro pixel styling
<script> data      character roster & unit factory
<script> board     seeded 100×100 board generation (zones, buildings)
<script> game      game state, movement, AP, rounds, win conditions
<script> encounter battle system + battle UI
<script> render    canvas renderer + minimap
<script> ui        sidebar, deck builder, modals
<script> main      input wiring & bootstrap
```

Character sprites are emoji placeholders for now — real sprites can be dropped in later.
