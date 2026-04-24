export const SYMBOLS = ["🍎","🍋","🍇","🍓","🔥","⭐","🎯","🍀"]

export const AVATAR_COLORS = [
  { bg:"#EEEDFE", fg:"#3C3489" },
  { bg:"#E1F5EE", fg:"#085041" },
  { bg:"#FAECE7", fg:"#712B13" },
  { bg:"#E6F1FB", fg:"#0C447C" },
  { bg:"#FAEEDA", fg:"#633806" },
]

export const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣"]

export function buildDeck(playerCount) {
  const deck = []
  SYMBOLS.slice(0, playerCount).forEach(s => {
    for (let i = 0; i < 3; i++) deck.push(s)
  })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function dealHands(count) {
  const deck = buildDeck(count)
  return Array.from({ length: count }, () => [deck.pop(), deck.pop(), deck.pop()])
}

export function isShowHand(chits = []) {
  return chits.length === 3 && chits[0] === chits[1] && chits[1] === chits[2]
}

export function makePlayer(id, name, colorIdx) {
  return { id, name, color: colorIdx, score: 0, chits: [], isShow: false }
}

export function makeRoom(code, host) {
  return {
    code, phase: "lobby", round: 1, currentTurn: 0,
    showCaller: -1, hostId: host.id, players: [host], showClicks: []
  }
}

export function applyAction(room, logs, action) {
  const r  = JSON.parse(JSON.stringify(room))
  const lg = [...logs]
  const log = m => lg.unshift(m)

  switch (action.type) {
    case "START": {
      const hands = dealHands(r.players.length)
      r.players = r.players.map((p, i) => ({ ...p, chits: hands[i], isShow: false }))
      r.phase = "playing"; r.round = 1; r.currentTurn = 0; r.showCaller = -1; r.showClicks = []
      log(`Round 1 started! ${r.players[0].name}'s turn.`)
      break
    }
    case "PASS": {
      const pi = action.playerIdx
      const ni = (pi + 1) % r.players.length
      const [chit] = r.players[pi].chits.splice(action.chitIdx, 1)
      r.players[ni].chits.push(chit)
      r.currentTurn = ni
      log(`${r.players[pi].name} passed a chit to ${r.players[ni].name}.`)
      break
    }
    case "SHOW": {
      const ci = action.playerIdx
      r.showCaller = ci; r.phase = "showWindow"
      r.showClicks = [{ playerIdx: ci, timestamp: action.timestamp }]
      r.showWindowEnd = action.timestamp + 5000
      log(`🎉 ${r.players[ci].name} called SHOW! Others have 5 seconds!`)
      break
    }
    case "SHOW_JOIN": {
      if (r.phase !== "showWindow") break
      if (r.showClicks.find(c => c.playerIdx === action.playerIdx)) break
      r.showClicks.push({ playerIdx: action.playerIdx, timestamp: action.timestamp })
      log(`${r.players[action.playerIdx].name} joined the show!`)
      break
    }
    case "SHOW_RESOLVE": {
      const n = r.players.length
      const base = (n + 2) * 10
      const sorted = [...r.showClicks].sort((a, b) => a.timestamp - b.timestamp)
      const clickedIdxs = sorted.map(c => c.playerIdx)
      r.players = r.players.map((p, i) => {
        const pos = clickedIdxs.indexOf(i)
        const pts = pos >= 0 ? Math.max(0, base - pos * 10) : 0
        if (pts !== 0) log(`${p.name}: +${pts} pts`)
        else log(`${p.name}: 0 pts`)
        return { ...p, score: p.score + pts, isShow: isShowHand(p.chits) }
      })
      r.phase = "afterShow"
      break
    }
    case "ROUND_END": {
      r.phase = "roundEnd"
      break
    }
    case "NEXT_ROUND": {
      const hands = dealHands(r.players.length)
      r.players = r.players.map((p, i) => ({ ...p, chits: hands[i], isShow: false }))
      r.phase = "playing"; r.round += 1; r.currentTurn = 0; r.showCaller = -1; r.showClicks = []
      log(`─── Round ${r.round} started! ${r.players[0].name}'s turn. ───`)
      break
    }
    case "END_GAME": {
      r.phase = "ended"
      const w = [...r.players].sort((a, b) => b.score - a.score)[0]
      log(`🏆 Game over! ${w.name} wins with ${w.score} pts!`)
      break
    }
    case "PLAY_AGAIN": {
      r.players = r.players.map(p => ({ ...p, score: 0, chits: [], isShow: false }))
      r.phase = "lobby"; r.round = 1; r.currentTurn = 0; r.showCaller = -1; r.showClicks = []
      break
    }
  }
  return { room: r, logs: lg.slice(0, 60) }
}
