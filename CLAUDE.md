# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite, default http://localhost:5173)
npm run build      # Production build
npm run preview    # Preview production build locally
```

No linter or test suite is configured.

## Environment

Create a `.env` file with:
```
VITE_WS_URL=ws://your-websocket-server:3001
```

Falls back to `ws://localhost:3001` if unset. The WebSocket server is a separate relay service **not in this repo** — it only brokers messages between players in the same room code.

## Architecture

**"SHOW"** is a Telugu chit-matching card game (2–5 players). The goal is to collect 4 normal chits with the same symbol to call SHOW.

### Networking model (critical)

There is **no backend game logic**. One player — the **host** — acts as the authoritative server entirely in the browser:

- Host applies actions locally via `applyAction()`, then broadcasts `STATE_SYNC` to all peers through the WebSocket relay.
- Non-host players send `ACTION` messages to the relay; the host receives them, applies them, and re-broadcasts state.
- `useWebSocket.js` handles auto-reconnect (2 s) and room-scoped message filtering.

### Game state machine

All game state lives in a single `room` object. The `applyAction` pure reducer in `src/utils/game.js` is the single source of truth — it never mutates, always deep-clones with `JSON.parse(JSON.stringify(room))`.

**Game phases:**
- `lobby` → `playing` → `showWindow` → `afterShow` → `roundEnd` → back to `playing` or `ended`
- Sub-phases during special cards: `pendingSpecial` → `revealedSnatchPicking` or `nukePicking` → `playing`

### Data flow

```
App.jsx
  └─ useGame.js          ← orchestrates all game state
       ├─ useWebSocket.js ← WS connect/send/reconnect
       └─ applyAction()   ← pure reducer (src/utils/game.js)
```

`useGame` exposes derived booleans (`isMyTurn`, `amIPuppeteer`, `amIPuppeted`, `canCallShow`, etc.) computed from `room` + `myIdx` that drive all UI conditionals.

### Special card flow

Multi-step specials use `pendingAction` on the room and a `specialAction` local state in `useGame`:

1. Player taps special → `useSpecial()` sends `USE_*` action → `applyAction` sets `phase:'pendingSpecial'` + `pendingAction`
2. `useGame` reads `pendingAction.type` and sets `specialAction` (e.g. `{type:'PICK_TARGET', actionType:'BLIND_SNATCH_PICK'}`)
3. `SpecialModalManager` renders the appropriate modal
4. Player picks target/chit → sends follow-up action → resolves back to `playing`

### Puppeteer mechanic

When Puppeteer is active (`room.puppeteerInfo = { puppeteerIdx, targetIdx }`):
- The puppeteer's `isMyTurn` is true when it's the *target's* turn
- `amIPuppeteer` / `amIPuppeted` booleans gate which UI is shown
- `onChitClick(i, true)` / `handlePass(idx, true)` pass `forActingPlayer=true` to act on the target's hand

### 3D scene

`src/3d/GameScene.js` is a Three.js class (casino-style table, card meshes with flip/pass animations). `src/hooks/useScene.js` is its React bridge. The canvas is currently rendered with `display:none` in `App.jsx` — the 3D layer is initialized but not wired into the active UI.

### Component map

| File | Contents |
|---|---|
| `src/components/Screens.jsx` | `LandingPage`, `CreateJoinScreen`, `JoinScreen`, `LobbyScreen` |
| `src/components/UI.jsx` | `HandHud`, `HandCard`, `PlayerSeat`, `GameLog`, `WsStatus`, `StatusPill`, `ShowWindowOverlay`, `RoundEndControls`, `EndScreen` |
| `src/components/SpecialModals.jsx` | `SpecialModalManager` + one modal per special type |
| `src/utils/game.js` | `applyAction`, `dealHands`, `buildNormalDeck`, `buildSpecialPool`, `makeRoom`, `makePlayer`, `isShowHand`, `isSpecial`, constants |
| `src/utils/helpers.js` | `uid`, `generateRoomCode`, `initials`, `copyToClipboard` |

### Modes

- **Special mode** (default): players start with 4 normal + 2 special chits
- **Normal mode**: 4 normal chits only, no specials
