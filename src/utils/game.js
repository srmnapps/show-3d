export const SYMBOLS = ["🍎","🍋","🍇","🍓","🔥","⭐","🎯","🍀"]

export const SPECIALS = [
  { type: 'REVERSE',       emoji: '🔄', name: 'Reverse'       },
  { type: 'FREEZE',        emoji: '🧊', name: 'Freeze'         },
  { type: 'GIVER_SNATCH',  emoji: '👁', name: 'Giver Snatch'  },
  { type: 'RANDOM_SNATCH', emoji: '🎲', name: 'Random Snatch'  },
]

export const AVATAR_COLORS = [
  { bg:"#EEEDFE", fg:"#3C3489" },
  { bg:"#E1F5EE", fg:"#085041" },
  { bg:"#FAECE7", fg:"#712B13" },
  { bg:"#E6F1FB", fg:"#0C447C" },
  { bg:"#FAEEDA", fg:"#633806" },
]

export const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣"]

// ── Helpers ───────────────────────────────────────────────────
export function isSpecial(chit) {
  return chit && typeof chit === 'object' && chit.special === true
}

export function isNormal(chit) {
  return chit && typeof chit === 'object' && !chit.special
}

// A chit is either { symbol, special:false } or { type, emoji, name, special:true, used:false }
export function makeNormalChit(symbol) {
  return { symbol, special: false }
}

export function makeSpecialChit(type) {
  const def = SPECIALS.find(s => s.type === type) ?? SPECIALS[0]
  return { type, emoji: def.emoji, name: def.name, special: true, used: false }
}

// Show = exactly 4 matching normal chits in hand, no more no less
export function isShowHand(chits = []) {
  const normals = chits.filter(c => !isSpecial(c))
  if (normals.length !== 4) return false
  const sym = normals[0].symbol
  return normals.every(c => c.symbol === sym)
}

// Display symbol for a chit
export function chitDisplay(chit) {
  if (!chit) return '?'
  if (isSpecial(chit)) return chit.emoji
  return chit.symbol
}

// ── Deck ─────────────────────────────────────────────────────
// Normal deck: playerCount symbols × 4 copies each
export function buildNormalDeck(playerCount) {
  const deck = []
  SYMBOLS.slice(0, playerCount).forEach(s => {
    for (let i = 0; i < 4; i++) deck.push(makeNormalChit(s))
  })
  return shuffle(deck)
}

// Specials pool: 2 per player, randomly assigned from the 4 types
export function buildSpecialPool(playerCount) {
  const pool = []
  const count = playerCount * 2
  for (let i = 0; i < count; i++) {
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

// Deal 4 normal + 2 special per player
export function dealHands(playerCount) {
  const normalDeck  = buildNormalDeck(playerCount)
  const specialPool = buildSpecialPool(playerCount)
  return Array.from({ length: playerCount }, (_, i) => {
    const normals  = [normalDeck.pop(), normalDeck.pop(), normalDeck.pop(), normalDeck.pop()]
    const specials = [specialPool.pop(), specialPool.pop()]
    return [...normals, ...specials]
  })
}

// ── Factories ─────────────────────────────────────────────────
export function makePlayer(id, name, colorIdx) {
  return { id, name, color: colorIdx, score: 0, chits: [], isShow: false, frozen: false }
}

export function makeRoom(code, host) {
  return {
    code, phase: 'lobby', round: 1,
    currentTurn: 0, direction: 1,   // 1 = clockwise, -1 = counter-clockwise
    showCaller: -1, hostId: host.id,
    players: [host], showClicks: [],
    frozenPlayer: -1,               // index of frozen player this turn
    pendingGiverSnatch: null,       // { giverIdx, receiverIdx, giverChitIdx } when waiting for response
    pendingRandomSnatch: null,      // { userIdx, targetIdx, mode } when waiting for pick
  }
}

// ── Next player index (respects direction and frozen) ─────────
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

    case 'START': {
      const hands = dealHands(r.players.length)
      r.players = r.players.map((p, i) => ({
        ...p, chits: hands[i], isShow: false, frozen: false
      }))
      r.phase         = 'playing'
      r.round         = 1
      r.currentTurn   = 0
      r.direction     = 1
      r.showCaller    = -1
      r.showClicks    = []
      r.frozenPlayer  = -1
      r.pendingGiverSnatch  = null
      r.pendingRandomSnatch = null
      log(`Round 1 started! ${r.players[0].name}'s turn.`)
      break
    }

    // ── Normal pass ───────────────────────────────────────────
    case 'PASS': {
      const pi  = action.playerIdx
      const ni  = nextPlayer(r, pi)
      const [chit] = r.players[pi].chits.splice(action.chitIdx, 1)
      r.players[ni].chits.push(chit)

      // Check if receiver has Giver Snatch — set pending state
      const receiverHasGS = r.players[ni].chits.some(
        c => isSpecial(c) && c.type === 'GIVER_SNATCH' && !c.used
      )
      if (receiverHasGS) {
        // Pause turn — wait for receiver's GIVER_SNATCH_RESPOND
        r.pendingGiverSnatch = {
          giverIdx:    pi,
          receiverIdx: ni,
          passedChitIdx: r.players[ni].chits.length - 1, // just pushed to end
        }
        r.phase = 'giverSnatching'
        log(`${r.players[ni].name} can use Giver Snatch!`)
      } else {
        r.currentTurn  = ni
        r.frozenPlayer = -1
        log(`${r.players[pi].name} passed a chit to ${r.players[ni].name}.`)
      }
      break
    }

    // ── Giver Snatch response ──────────────────────────────────
    case 'GIVER_SNATCH_RESPOND': {
      const gs = r.pendingGiverSnatch
      if (!gs) break
      const { giverIdx, receiverIdx, passedChitIdx } = gs

      if (!action.use) {
        // Declined — just continue normal turn
        r.pendingGiverSnatch = null
        r.phase        = 'playing'
        r.currentTurn  = receiverIdx
        r.frozenPlayer = -1
        log(`${r.players[receiverIdx].name} received a chit.`)
        break
      }

      // Used — remove the passed chit from receiver, give back to giver
      const returnedChit = r.players[receiverIdx].chits.splice(passedChitIdx, 1)[0]
      r.players[giverIdx].chits.push(returnedChit)

      // Mark the Giver Snatch card as used and remove it
      const gsIdx = r.players[receiverIdx].chits.findIndex(
        c => isSpecial(c) && c.type === 'GIVER_SNATCH' && !c.used
      )
      if (gsIdx !== -1) r.players[receiverIdx].chits.splice(gsIdx, 1)

      // Randomiser: see or blind
      const mode = Math.random() < 0.5 ? 'see' : 'blind'

      if (mode === 'blind') {
        // Pick random normal chit from giver
        const giverNormals = r.players[giverIdx].chits
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !isSpecial(c))
        if (giverNormals.length > 0) {
          const pick = giverNormals[Math.floor(Math.random() * giverNormals.length)]
          const [taken] = r.players[giverIdx].chits.splice(pick.i, 1)
          r.players[receiverIdx].chits.push(taken)
          log(`🎲 Blind! ${r.players[receiverIdx].name} grabbed a random chit from ${r.players[giverIdx].name}.`)
        }
        r.pendingGiverSnatch = null
        r.phase        = 'playing'
        r.currentTurn  = receiverIdx
        r.frozenPlayer = -1
      } else {
        // See mode — receiver picks which chit to take
        r.pendingGiverSnatch = { ...gs, mode: 'see', step: 'picking' }
        r.phase = 'giverSnatchPicking'
        log(`👁 ${r.players[receiverIdx].name} can see ${r.players[giverIdx].name}'s chits!`)
      }
      break
    }

    // ── Giver Snatch: receiver picks a specific chit ───────────
    case 'GIVER_SNATCH_PICK': {
      const gs = r.pendingGiverSnatch
      if (!gs) break
      const { giverIdx, receiverIdx } = gs
      const [taken] = r.players[giverIdx].chits.splice(action.chitIdx, 1)
      r.players[receiverIdx].chits.push(taken)
      log(`${r.players[receiverIdx].name} snatched a chit from ${r.players[giverIdx].name}!`)
      r.pendingGiverSnatch = null
      r.phase        = 'playing'
      r.currentTurn  = receiverIdx
      r.frozenPlayer = -1
      break
    }

    // ── Use Reverse ───────────────────────────────────────────
    case 'USE_REVERSE': {
      const pi = action.playerIdx
      // Remove the Reverse card from hand
      const rIdx = r.players[pi].chits.findIndex(c => isSpecial(c) && c.type === 'REVERSE' && !c.used)
      if (rIdx !== -1) r.players[pi].chits.splice(rIdx, 1)
      r.direction = r.direction * -1
      log(`🔄 ${r.players[pi].name} played Reverse! Direction flipped.`)
      // Player must now pass a normal chit — stay on their turn
      // (useGame will call PASS after)
      break
    }

    // ── Use Freeze ────────────────────────────────────────────
    case 'USE_FREEZE': {
      const pi = action.playerIdx
      const fIdx = r.players[pi].chits.findIndex(c => isSpecial(c) && c.type === 'FREEZE' && !c.used)
      if (fIdx !== -1) r.players[pi].chits.splice(fIdx, 1)
      const frozen = nextPlayer(r, pi)
      r.frozenPlayer = frozen
      r.players[frozen].frozen = true
      log(`🧊 ${r.players[pi].name} froze ${r.players[frozen].name}!`)
      // Player passes to the player AFTER frozen — handled in PASS by skipFrozen
      break
    }

    // ── Use Random Snatch ─────────────────────────────────────
    case 'USE_RANDOM_SNATCH': {
      const pi = action.playerIdx
      const rsIdx = r.players[pi].chits.findIndex(c => isSpecial(c) && c.type === 'RANDOM_SNATCH' && !c.used)
      if (rsIdx !== -1) r.players[pi].chits.splice(rsIdx, 1)

      // Step 1: randomiser decides player selection
      const playerMode = Math.random() < 0.5 ? 'random' : 'choice'
      let targetIdx = -1
      if (playerMode === 'random') {
        const others = r.players.map((_, i) => i).filter(i => i !== pi)
        targetIdx = others[Math.floor(Math.random() * others.length)]
      }

      // Step 2: randomiser decides see or blind
      const viewMode = Math.random() < 0.5 ? 'see' : 'blind'

      r.pendingRandomSnatch = {
        userIdx:    pi,
        targetIdx,       // -1 means user must choose
        playerMode,
        viewMode,
        step: playerMode === 'random' ? 'swapping' : 'pickingPlayer',
      }
      r.phase = 'randomSnatching'
      log(`🎲 ${r.players[pi].name} plays Random Snatch! (${playerMode} player, ${viewMode})`)

      // If random player AND blind — auto resolve immediately
      if (playerMode === 'random' && viewMode === 'blind') {
        const userNormals   = r.players[pi].chits.map((c,i)=>({c,i})).filter(({c})=>!isSpecial(c))
        const targetNormals = r.players[targetIdx].chits.map((c,i)=>({c,i})).filter(({c})=>!isSpecial(c))
        if (userNormals.length > 0 && targetNormals.length > 0) {
          const uPick = userNormals[Math.floor(Math.random() * userNormals.length)]
          const tPick = targetNormals[Math.floor(Math.random() * targetNormals.length)]
          const uChit = r.players[pi].chits[uPick.i]
          const tChit = r.players[targetIdx].chits[tPick.i]
          r.players[pi].chits[uPick.i]         = tChit
          r.players[targetIdx].chits[tPick.i]  = uChit
          log(`🎲 Blind swap between ${r.players[pi].name} and ${r.players[targetIdx].name}!`)
        }
        r.pendingRandomSnatch = null
        r.phase = 'playing'
        // stay on pi's turn so they pass a normal chit
      }
      break
    }

    // ── Random Snatch: user picks target player ───────────────
    case 'RANDOM_SNATCH_PICK_PLAYER': {
      const rs = r.pendingRandomSnatch
      if (!rs) break
      rs.targetIdx = action.targetIdx
      rs.step = 'swapping'
      if (rs.viewMode === 'blind') {
        // Auto-resolve blind swap
        const pi = rs.userIdx; const ti = rs.targetIdx
        const uN = r.players[pi].chits.map((c,i)=>({c,i})).filter(({c})=>!isSpecial(c))
        const tN = r.players[ti].chits.map((c,i)=>({c,i})).filter(({c})=>!isSpecial(c))
        if (uN.length > 0 && tN.length > 0) {
          const uP = uN[Math.floor(Math.random()*uN.length)]
          const tP = tN[Math.floor(Math.random()*tN.length)]
          const uC = r.players[pi].chits[uP.i]
          const tC = r.players[ti].chits[tP.i]
          r.players[pi].chits[uP.i] = tC
          r.players[ti].chits[tP.i] = uC
          log(`🎲 Blind swap between ${r.players[pi].name} and ${r.players[ti].name}!`)
        }
        r.pendingRandomSnatch = null
        r.phase = 'playing'
      }
      // else see mode — wait for RANDOM_SNATCH_PICK_CHIT
      break
    }

    // ── Random Snatch: user picks which chit to swap ──────────
    case 'RANDOM_SNATCH_PICK_CHIT': {
      const rs = r.pendingRandomSnatch
      if (!rs) break
      const { userIdx, targetIdx } = rs
      // action.userChitIdx = chit from user, action.targetChitIdx = chit from target
      const uChit = r.players[userIdx].chits[action.userChitIdx]
      const tChit = r.players[targetIdx].chits[action.targetChitIdx]
      r.players[userIdx].chits[action.userChitIdx]   = tChit
      r.players[targetIdx].chits[action.targetChitIdx] = uChit
      log(`${r.players[userIdx].name} snatched from ${r.players[targetIdx].name}!`)
      r.pendingRandomSnatch = null
      r.phase = 'playing'
      break
    }

    // ── Show ──────────────────────────────────────────────────
    case 'SHOW': {
      const ci = action.playerIdx
      r.showCaller    = ci
      r.phase         = 'showWindow'
      r.showClicks    = [{ playerIdx: ci, timestamp: action.timestamp }]
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
      const n    = r.players.length
      const base = (n + 2) * 10
      const sorted      = [...r.showClicks].sort((a,b) => a.timestamp - b.timestamp)
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

    case 'ROUND_END': {
      r.phase = 'roundEnd'
      break
    }

    case 'NEXT_ROUND': {
      const hands = dealHands(r.players.length)
      r.players = r.players.map((p, i) => ({
        ...p, chits: hands[i], isShow: false, frozen: false
      }))
      r.phase         = 'playing'
      r.round        += 1
      r.currentTurn   = 0
      r.direction     = 1
      r.showCaller    = -1
      r.showClicks    = []
      r.frozenPlayer  = -1
      r.pendingGiverSnatch  = null
      r.pendingRandomSnatch = null
      log(`─── Round ${r.round} started! ${r.players[0].name}'s turn. ───`)
      break
    }

    case 'END_GAME': {
      r.phase = 'ended'
      const w = [...r.players].sort((a,b) => b.score - a.score)[0]
      log(`🏆 Game over! ${w.name} wins with ${w.score} pts!`)
      break
    }

    case 'PLAY_AGAIN': {
      r.players = r.players.map(p => ({
        ...p, score: 0, chits: [], isShow: false, frozen: false
      }))
      r.phase         = 'lobby'
      r.round         = 1
      r.currentTurn   = 0
      r.direction     = 1
      r.showCaller    = -1
      r.showClicks    = []
      r.frozenPlayer  = -1
      r.pendingGiverSnatch  = null
      r.pendingRandomSnatch = null
      break
    }
  }

  return { room: r, logs: lg.slice(0, 80) }
}