export const SYMBOLS = ["🍎","🍋","🍇","🍓","🔥","⭐","🎯","🍀"]

export const SPECIALS = [
  { type: 'REVERSE',       emoji: '🔄', name: 'Reverse'       },
  { type: 'FREEZE',        emoji: '🧊', name: 'Freeze'         },
  { type: 'RANDOM_SNATCH', emoji: '🎲', name: 'Random Snatch'  },
  { type: 'STUN_GRENADE',  emoji: '💥', name: 'Stun Grenade'   },
]

export const AVATAR_COLORS = [
  { bg:"#EEEDFE", fg:"#3C3489" },
  { bg:"#E1F5EE", fg:"#085041" },
  { bg:"#FAECE7", fg:"#712B13" },
  { bg:"#E6F1FB", fg:"#0C447C" },
  { bg:"#FAEEDA", fg:"#633806" },
]

export const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣"]
export const SEAT_COLORS = ['#E53935','#1E88E5','#43A047','#FFD600','#AA00FF']

// ── Helpers ───────────────────────────────────────────────────
export function isSpecial(chit) {
  return chit && typeof chit === 'object' && chit.special === true
}
export function isNormal(chit) {
  return chit && typeof chit === 'object' && !chit.special
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

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// mode: 'normal' = 4 normals only, 'special' = 4 normals + 2 specials
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
  return { id, name, color: colorIdx, score: 0, chits: [], isShow: false, frozen: false, stunned: false }
}

export function makeRoom(code, host) {
  return {
    code, phase: 'lobby', round: 1,
    currentTurn: 0, direction: 1,
    showCaller: -1, hostId: host.id,
    players: [host], showClicks: [],
    frozenPlayer: -1,
    stunnedPlayer: -1,
    pendingRandomSnatch: null,
    pendingStunGrenade: null,
    mode: 'special',
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

// ── Pure reducer ──────────────────────────────────────────────
export function applyAction(room, logs, action) {
  const r  = JSON.parse(JSON.stringify(room))
  const lg = [...logs]
  const log = m => lg.unshift(m)

  switch (action.type) {

    case 'SET_MODE': {
      r.mode = action.mode
      break
    }

    case 'START': {
      const hands = dealHands(r.players.length, r.mode)
      r.players = r.players.map((p, i) => ({
        ...p, chits: hands[i], isShow: false, frozen: false, stunned: false
      }))
      r.phase = 'playing'; r.round = 1; r.currentTurn = 0
      r.direction = 1; r.showCaller = -1; r.showClicks = []
      r.frozenPlayer = -1; r.stunnedPlayer = -1
      r.pendingRandomSnatch = null; r.pendingStunGrenade = null
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
        r.stunnedPlayer = -1
        r.players[pi].stunned = false
      }

      r.currentTurn = ni
      r.frozenPlayer = -1
      r.players.forEach(p => { p.frozen = false })
      log(`${r.players[pi].name} passed a chit to ${r.players[ni].name}.`)
      break
    }

    case 'USE_REVERSE': {
      const pi = action.playerIdx
      const idx = r.players[pi].chits.findIndex(c => isSpecial(c) && c.type === 'REVERSE')
      if (idx !== -1) r.players[pi].chits.splice(idx, 1)
      r.direction *= -1
      log(`🔄 ${r.players[pi].name} played Reverse! Direction flipped.`)
      break
    }

    case 'USE_FREEZE': {
      const pi = action.playerIdx
      const idx = r.players[pi].chits.findIndex(c => isSpecial(c) && c.type === 'FREEZE')
      if (idx !== -1) r.players[pi].chits.splice(idx, 1)
      const frozen = nextPlayer(r, pi)
      r.frozenPlayer = frozen
      r.players[frozen].frozen = true
      log(`🧊 ${r.players[pi].name} froze ${r.players[frozen].name}!`)
      break
    }

    // Random Snatch: user picks target, takes one random chit from them blind
    case 'USE_RANDOM_SNATCH': {
      const pi = action.playerIdx
      const idx = r.players[pi].chits.findIndex(c => isSpecial(c) && c.type === 'RANDOM_SNATCH')
      if (idx !== -1) r.players[pi].chits.splice(idx, 1)
      // Wait for user to pick target
      r.pendingRandomSnatch = { userIdx: pi, step: 'pickingPlayer' }
      r.phase = 'randomSnatching'
      log(`🎲 ${r.players[pi].name} plays Random Snatch!`)
      break
    }

    case 'RANDOM_SNATCH_PICK_PLAYER': {
      const rs = r.pendingRandomSnatch
      if (!rs) break
      const { userIdx } = rs
      const targetIdx = action.targetIdx
      // Take a random normal chit from target
      const targetNormals = r.players[targetIdx].chits
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => !isSpecial(c))
      if (targetNormals.length > 0) {
        const pick = targetNormals[Math.floor(Math.random() * targetNormals.length)]
        const [taken] = r.players[targetIdx].chits.splice(pick.i, 1)
        r.players[userIdx].chits.push(taken)
        log(`🎲 ${r.players[userIdx].name} snatched a chit from ${r.players[targetIdx].name}!`)
      }
      r.pendingRandomSnatch = null
      r.phase = 'playing'
      // User must still pass a normal chit (handled by mustPassNormal in useGame)
      break
    }

    // Stun Grenade: user picks target, target's chits go face-down immediately
    case 'USE_STUN_GRENADE': {
      const pi = action.playerIdx
      const idx = r.players[pi].chits.findIndex(c => isSpecial(c) && c.type === 'STUN_GRENADE')
      if (idx !== -1) r.players[pi].chits.splice(idx, 1)
      r.pendingStunGrenade = { userIdx: pi, step: 'pickingPlayer' }
      r.phase = 'stunGrenade'
      log(`💥 ${r.players[pi].name} throws a Stun Grenade!`)
      break
    }

    case 'STUN_GRENADE_PICK_PLAYER': {
      const sg = r.pendingStunGrenade
      if (!sg) break
      const targetIdx = action.targetIdx
      r.stunnedPlayer = targetIdx
      r.players[targetIdx].stunned = true
      r.pendingStunGrenade = null
      r.phase = 'playing'
      log(`💥 ${r.players[targetIdx].name} is stunned! Their chits are hidden!`)
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
      r.phase = 'afterShow'
      break
    }

    case 'ROUND_END': { r.phase = 'roundEnd'; break }

    case 'NEXT_ROUND': {
      const hands = dealHands(r.players.length, r.mode)
      r.players = r.players.map((p, i) => ({
        ...p, chits: hands[i], isShow: false, frozen: false, stunned: false
      }))
      r.phase = 'playing'; r.round += 1; r.currentTurn = 0
      r.direction = 1; r.showCaller = -1; r.showClicks = []
      r.frozenPlayer = -1; r.stunnedPlayer = -1
      r.pendingRandomSnatch = null; r.pendingStunGrenade = null
      log(`─── Round ${r.round} started! ${r.players[0].name}'s turn. ───`)
      break
    }

    case 'END_GAME': {
      r.phase = 'ended'
      const w = [...r.players].sort((a, b) => b.score - a.score)[0]
      log(`🏆 Game over! ${w.name} wins with ${w.score} pts!`)
      break
    }

    case 'PLAY_AGAIN': {
      r.players = r.players.map(p => ({
        ...p, score: 0, chits: [], isShow: false, frozen: false, stunned: false
      }))
      r.phase = 'lobby'; r.round = 1; r.currentTurn = 0
      r.direction = 1; r.showCaller = -1; r.showClicks = []
      r.frozenPlayer = -1; r.stunnedPlayer = -1
      r.pendingRandomSnatch = null; r.pendingStunGrenade = null
      break
    }
  }

  return { room: r, logs: lg.slice(0, 80) }
}