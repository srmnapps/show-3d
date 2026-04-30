export const SYMBOLS = ["🍎","🍋","🍇","🍓","🔥","⭐","🎯","🍀"]

export const SPECIALS = [
  { type: 'REVERSE',        emoji: '🔄', name: 'Reverse'        },
  { type: 'FREEZE',         emoji: '🧊', name: 'Freeze'          },
  { type: 'BLIND_SNATCH',   emoji: '🎲', name: 'Blind Snatch'    },
  { type: 'REVEALED_SNATCH',emoji: '👁', name: 'Revealed Snatch' },
  { type: 'STUN_GRENADE',   emoji: '💥', name: 'Stun Grenade'    },
  { type: 'VITALS',         emoji: '📊', name: 'Vitals'          },
  { type: 'SUPER_VITALS',   emoji: '⚡', name: 'Super Vitals'    },
  { type: 'NUKE',           emoji: '💣', name: 'Nuke'            },
  { type: 'PUPPETEER',      emoji: '🎭', name: 'Puppeteer'       },
  { type: 'POSITION_SWAP',  emoji: '🔀', name: 'Position Swap'   },
]

export const AVATAR_COLORS = [
  { bg:"#EEEDFE", fg:"#3C3489" },
  { bg:"#E1F5EE", fg:"#085041" },
  { bg:"#FAECE7", fg:"#712B13" },
  { bg:"#E6F1FB", fg:"#0C447C" },
  { bg:"#FAEEDA", fg:"#633806" },
]

export const MEDALS    = ["🥇","🥈","🥉","4️⃣","5️⃣"]
export const SEAT_COLORS = ['#E53935','#1E88E5','#43A047','#FFD600','#AA00FF']

// ── Helpers ───────────────────────────────────────────────────
export function isSpecial(chit) {
  return chit && typeof chit === 'object' && chit.special === true
}
export function makeNormalChit(symbol) {
  return { symbol, special: false }
}
export function makeSpecialChit(type) {
  const def = SPECIALS.find(s => s.type === type) ?? SPECIALS[0]
  return { type, emoji: def.emoji, name: def.name, special: true }
}
export function isShowHand(chits = []) {
  const normals = chits.filter(c => !isSpecial(c))
  if (normals.length !== 4) return false
  const sym = normals[0]?.symbol
  return normals.every(c => c.symbol === sym)
}
export function chitDisplay(chit) {
  if (!chit) return '?'
  if (isSpecial(chit)) return chit.emoji
  return chit.symbol
}

// ── Deck ─────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildNormalDeck(playerCount) {
  const deck = []
  SYMBOLS.slice(0, playerCount).forEach(s => {
    for (let i = 0; i < 4; i++) deck.push(makeNormalChit(s))
  })
  return shuffle(deck)
}

export function buildSpecialPool(playerCount) {
  const pool = []
  for (let i = 0; i < playerCount * 2; i++) {
    const type = SPECIALS[Math.floor(Math.random() * SPECIALS.length)].type
    pool.push(makeSpecialChit(type))
  }
  return shuffle(pool)
}

export function dealHands(playerCount, mode = 'special') {
  const normalDeck = buildNormalDeck(playerCount)
  if (mode === 'normal') {
    return Array.from({ length: playerCount }, () => [
      normalDeck.pop(), normalDeck.pop(),
      normalDeck.pop(), normalDeck.pop(),
    ])
  }
  const specialPool = buildSpecialPool(playerCount)
  return Array.from({ length: playerCount }, () => [
    normalDeck.pop(), normalDeck.pop(),
    normalDeck.pop(), normalDeck.pop(),
    specialPool.pop(), specialPool.pop(),
  ])
}

// ── Factories ─────────────────────────────────────────────────
export function makePlayer(id, name, colorIdx) {
  return {
    id, name, color: colorIdx, score: 0,
    chits: [], isShow: false, frozen: false, stunned: false,
    originalIdx: colorIdx, // for position swap restore
  }
}

export function makeRoom(code, host) {
  return {
    code, phase: 'lobby', round: 1,
    currentTurn: 0, direction: 1,
    showCaller: -1, hostId: host.id,
    players: [host], showClicks: [],
    frozenPlayer: -1,
    stunnedPlayer: -1,
    puppeteerInfo: null,      // { puppeteerIdx, targetIdx }
    positionSwaps: [],        // [{ from, to }] reset each round
    pendingPositionSwap: null,// { from, to } — applied on next PASS
    pendingAction: null,      // generic pending for multi-step specials
    mode: 'special',
    superVitalsUsed: false,
  }
}

function nextPlayer(room, fromIdx, skipFrozen = false) {
  const n = room.players.length
  let next = (fromIdx + room.direction + n) % n
  if (skipFrozen && next === room.frozenPlayer) {
    next = (next + room.direction + n) % n
  }
  return next
}

function getSubject(r) {
  if (r.puppeteerInfo && r.currentTurn === r.puppeteerInfo.targetIdx) {
    return r.puppeteerInfo.targetIdx
  }
  return r.currentTurn
}

function removeSpecial(player, type, chitIdx) {
  // Use the exact slot when caller knows which card was tapped
  if (chitIdx != null && player.chits[chitIdx] && isSpecial(player.chits[chitIdx]) && player.chits[chitIdx].type === type) {
    player.chits.splice(chitIdx, 1)
    return
  }
  const idx = player.chits.findIndex(c => isSpecial(c) && c.type === type)
  if (idx !== -1) player.chits.splice(idx, 1)
}

// ── Pure reducer ──────────────────────────────────────────────
export function applyAction(room, logs, action) {
  const r  = JSON.parse(JSON.stringify(room))
  const lg = [...logs]
  const log = m => lg.unshift(m)

  switch (action.type) {

    case 'SET_MODE': { r.mode = action.mode; break }

    case 'START': {
      const hands = dealHands(r.players.length, r.mode)
      r.players = r.players.map((p, i) => ({
        ...p, chits: hands[i], isShow: false,
        frozen: false, stunned: false, originalIdx: i,
      }))
      r.phase = 'playing'; r.round = 1; r.currentTurn = 0
      r.direction = 1; r.showCaller = -1; r.showClicks = []
      r.frozenPlayer = -1; r.stunnedPlayer = -1
      r.puppeteerInfo = null; r.positionSwaps = []; r.pendingAction = null
      r.pendingPositionSwap = null; r.superVitalsUsed = false
      log(`Round 1 started! ${r.players[0].name}'s turn.`)
      break
    }

    case 'PASS': {
      const pi = action.playerIdx
      const ni = nextPlayer(r, pi, r.frozenPlayer !== -1)
      const [chit] = r.players[pi].chits.splice(action.chitIdx, 1)
      r.players[ni].chits.push(chit)

      // Lift stun after passing
      if (pi === r.stunnedPlayer) {
        r.stunnedPlayer = -1; r.players[pi].stunned = false
      }
      // End puppeteer control
      if (r.puppeteerInfo?.targetIdx === pi) {
        r.puppeteerInfo = null
      }

      r.currentTurn = ni
      r.frozenPlayer = -1
      r.players.forEach(p => { p.frozen = false })
      log(`${r.players[pi].name} passed a chit to ${r.players[ni].name}.`)

      // Apply deferred position swap after the pass
      if (r.pendingPositionSwap) {
        const { from, to } = r.pendingPositionSwap
        const fromName = r.players[from].name
        const toName   = r.players[to].name
        const tmp = r.players[from]
        r.players[from] = r.players[to]
        r.players[to] = tmp
        r.positionSwaps.push({ from, to })
        if (r.currentTurn === from) r.currentTurn = to
        else if (r.currentTurn === to) r.currentTurn = from
        r.pendingPositionSwap = null
        log(`🔀 Positions swapped! ${fromName} ↔ ${toName}`)
      }
      break
    }

    case 'USE_REVERSE': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi) break
      removeSpecial(r.players[pi], 'REVERSE', action.chitIdx)
      r.direction *= -1
      log(`🔄 ${r.players[pi].name} played Reverse! Direction flipped.`)
      break
    }

    case 'USE_FREEZE': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi) break
      removeSpecial(r.players[pi], 'FREEZE', action.chitIdx)
      const frozen = nextPlayer(r, pi)
      r.frozenPlayer = frozen; r.players[frozen].frozen = true
      log(`🧊 ${r.players[pi].name} froze ${r.players[frozen].name}!`)
      break
    }

    // Blind Snatch: pick target → see masked cards → pick one blind
    case 'USE_BLIND_SNATCH': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi) break
      removeSpecial(r.players[pi], 'BLIND_SNATCH', action.chitIdx)
      r.pendingAction = { type: 'BLIND_SNATCH', userIdx: pi }
      r.phase = 'pendingSpecial'
      log(`🎲 ${r.players[pi].name} plays Blind Snatch!`)
      break
    }
    case 'BLIND_SNATCH_PICK': {
      const { userIdx } = r.pendingAction
      const targetIdx = action.targetIdx
      r.pendingAction = { ...r.pendingAction, targetIdx }
      r.phase = 'blindSnatchPicking'
      log(`🎲 ${r.players[userIdx].name} picks from ${r.players[targetIdx].name}…`)
      break
    }
    case 'BLIND_SNATCH_PICK_CARD': {
      const { userIdx, targetIdx } = r.pendingAction
      const [taken] = r.players[targetIdx].chits.splice(action.chitIdx, 1)
      r.players[userIdx].chits.push(taken)
      log(`🎲 ${r.players[userIdx].name} blind-snatched from ${r.players[targetIdx].name}!`)
      r.pendingAction = null; r.phase = 'playing'
      break
    }

    // Revealed Snatch: pick target → 2 of their chits revealed → user picks one
    case 'USE_REVEALED_SNATCH': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi) break
      removeSpecial(r.players[pi], 'REVEALED_SNATCH', action.chitIdx)
      r.pendingAction = { type: 'REVEALED_SNATCH', userIdx: pi }
      r.phase = 'pendingSpecial'
      log(`👁 ${r.players[pi].name} plays Revealed Snatch!`)
      break
    }
    case 'REVEALED_SNATCH_PICK_TARGET': {
      const { userIdx } = r.pendingAction
      const targetIdx = action.targetIdx
      const normals = r.players[targetIdx].chits
        .map((c, i) => ({ c, i })).filter(({ c }) => !isSpecial(c))
      // Randomly pick 2 to reveal
      const shuffled = shuffle([...normals])
      const revealed2 = shuffled.slice(0, 2)
      r.pendingAction = {
        ...r.pendingAction, targetIdx,
        revealedOptions: revealed2, // [{ c, i }]
        step: 'picking',
      }
      r.phase = 'revealedSnatchPicking'
      log(`👁 ${r.players[userIdx].name} sees 2 of ${r.players[targetIdx].name}'s chits!`)
      break
    }
    case 'REVEALED_SNATCH_PICK_CHIT': {
      const { userIdx, targetIdx } = r.pendingAction
      const [taken] = r.players[targetIdx].chits.splice(action.chitIdx, 1)
      r.players[userIdx].chits.push(taken)
      log(`👁 ${r.players[userIdx].name} snatched a revealed chit from ${r.players[targetIdx].name}!`)
      r.pendingAction = null; r.phase = 'playing'
      break
    }

    // Stun Grenade
    case 'USE_STUN_GRENADE': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi) break
      removeSpecial(r.players[pi], 'STUN_GRENADE', action.chitIdx)
      r.pendingAction = { type: 'STUN_GRENADE', userIdx: pi }
      r.phase = 'pendingSpecial'
      log(`💥 ${r.players[pi].name} throws a Stun Grenade!`)
      break
    }
    case 'STUN_GRENADE_PICK': {
      const targetIdx = action.targetIdx
      r.stunnedPlayer = targetIdx; r.players[targetIdx].stunned = true
      r.pendingAction = null; r.phase = 'playing'
      log(`💥 ${r.players[targetIdx].name} is stunned! Chits hidden!`)
      break
    }

    // Vitals — client-side only, no state change needed
    // (handled purely in UI)

    // Super Vitals — client-side only
    // (handled purely in UI)

    // Nuke: destroy one of target's specials
    case 'USE_NUKE': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi) break
      removeSpecial(r.players[pi], 'NUKE', action.chitIdx)
      r.pendingAction = { type: 'NUKE', userIdx: pi }
      r.phase = 'pendingSpecial'
      log(`💣 ${r.players[pi].name} launches a Nuke!`)
      break
    }
    case 'NUKE_PICK_TARGET': {
      const targetIdx = action.targetIdx
      r.pendingAction = { ...r.pendingAction, targetIdx, step: 'pickingCard' }
      r.phase = 'nukePicking'
      break
    }
    case 'NUKE_PICK_CARD': {
      const { userIdx, targetIdx } = r.pendingAction
      r.players[targetIdx].chits.splice(action.chitIdx, 1)
      log(`💣 ${r.players[userIdx].name} nuked a special from ${r.players[targetIdx].name}!`)
      r.pendingAction = null; r.phase = 'playing'
      break
    }

    // Puppeteer: control target's turn
    case 'USE_PUPPETEER': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi) break
      removeSpecial(r.players[pi], 'PUPPETEER', action.chitIdx)
      r.pendingAction = { type: 'PUPPETEER', userIdx: pi }
      r.phase = 'pendingSpecial'
      log(`🎭 ${r.players[pi].name} plays Puppeteer!`)
      break
    }
    case 'PUPPETEER_PICK': {
      const { userIdx } = r.pendingAction
      const targetIdx = action.targetIdx
      r.puppeteerInfo = { puppeteerIdx: userIdx, targetIdx }
      r.pendingAction = null; r.phase = 'playing'
      // Do NOT force currentTurn — puppeteer activates on target's natural turn
      log(`🎭 ${r.players[userIdx].name} will control ${r.players[targetIdx].name} on their next turn!`)
      break
    }

    // Position Swap: swap turn-order positions
    case 'USE_POSITION_SWAP': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi) break
      removeSpecial(r.players[pi], 'POSITION_SWAP', action.chitIdx)
      r.pendingAction = { type: 'POSITION_SWAP', userIdx: pi }
      r.phase = 'pendingSpecial'
      log(`🔀 ${r.players[pi].name} plays Position Swap!`)
      break
    }
    case 'POSITION_SWAP_PICK': {
      const { userIdx } = r.pendingAction
      const targetIdx = action.targetIdx
      // Defer the actual swap until after the user passes a normal chit
      r.pendingPositionSwap = { from: userIdx, to: targetIdx }
      r.pendingAction = null; r.phase = 'playing'
      log(`🔀 ${r.players[userIdx].name} set up a position swap with ${r.players[targetIdx].name} — pass a chit to trigger!`)
      break
    }

    case 'SHOW': {
      const ci = action.playerIdx
      r.showCaller = ci; r.phase = 'showWindow'
      r.showClicks = [{ playerIdx: ci, timestamp: action.timestamp }]
      r.showWindowEnd = action.timestamp + 5000
      log(`🎉 ${r.players[ci].name} called SHOW!`)
      break
    }
    case 'SHOW_JOIN': {
      if (r.phase !== 'showWindow') break
      if (r.showClicks.find(c => c.playerIdx === action.playerIdx)) break
      r.showClicks.push({ playerIdx: action.playerIdx, timestamp: action.timestamp })
      log(`${r.players[action.playerIdx].name} joined the show!`)
      break
    }
    case 'SHOW_RESOLVE': {
      const n = r.players.length
      const base = (n + 2) * 10
      const sorted = [...r.showClicks].sort((a, b) => a.timestamp - b.timestamp)
      const clickedIdxs = sorted.map(c => c.playerIdx)
      r.players = r.players.map((p, i) => {
        const pos = clickedIdxs.indexOf(i)
        const pts = pos >= 0 ? Math.max(0, base - pos * 10) : 0
        log(`${p.name}: ${pts > 0 ? '+' : ''}${pts} pts`)
        return { ...p, score: p.score + pts, isShow: isShowHand(p.chits) }
      })
      r.phase = 'afterShow'; break
    }
    // Vitals & Super Vitals — client-side display only, just consume the card
    case 'USE_VITALS': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi) break
      removeSpecial(r.players[pi], 'VITALS', action.chitIdx)
      log('📊 ' + r.players[pi].name + ' used Vitals!')
      break
    }
    case 'USE_SUPER_VITALS': {
      const pi = getSubject(r)
      if (action.playerIdx !== pi || r.superVitalsUsed) break
      removeSpecial(r.players[pi], 'SUPER_VITALS', action.chitIdx)
      r.superVitalsUsed = true
      log('⚡ ' + r.players[pi].name + ' used Super Vitals!')
      break
    }

        case 'ROUND_END': {
      // Restore position swaps
      if (r.positionSwaps.length > 0) {
        ;[...r.positionSwaps].reverse().forEach(({ from, to }) => {
          const tmp = r.players[from]
          r.players[from] = r.players[to]
          r.players[to] = tmp
        })
      }
      r.pendingPositionSwap = null
      r.phase = 'roundEnd'; break
    }
    case 'NEXT_ROUND': {
      const hands = dealHands(r.players.length, r.mode)
      r.players = r.players.map((p, i) => ({
        ...p, chits: hands[i], isShow: false, frozen: false, stunned: false,
      }))
      r.phase = 'playing'; r.round += 1; r.currentTurn = 0
      r.direction = 1; r.showCaller = -1; r.showClicks = []
      r.frozenPlayer = -1; r.stunnedPlayer = -1
      r.puppeteerInfo = null; r.positionSwaps = []; r.pendingAction = null
      r.pendingPositionSwap = null; r.superVitalsUsed = false
log('─── Round ' + r.round + ' started! ' + r.players[0].name + "'s turn. ───")
      break
    }
    case 'END_GAME': {
      r.phase = 'ended'
      const w = [...r.players].sort((a, b) => b.score - a.score)[0]
      log('🏆 Game over! ' + w.name + ' wins with ' + w.score + ' pts!')
      break
    }
    case 'PLAY_AGAIN': {
      r.players = r.players.map(p => ({
        ...p, score: 0, chits: [], isShow: false, frozen: false, stunned: false,
      }))
      r.phase = 'lobby'; r.round = 1; r.currentTurn = 0
      r.direction = 1; r.showCaller = -1; r.showClicks = []
      r.frozenPlayer = -1; r.stunnedPlayer = -1
      r.puppeteerInfo = null; r.positionSwaps = []; r.pendingAction = null
      r.pendingPositionSwap = null; r.superVitalsUsed = false
      break
    }
  }

  return { room: r, logs: lg.slice(0, 80) }
}