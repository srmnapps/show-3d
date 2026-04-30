import { useState, useRef, useCallback } from 'react'
import { useWebSocket } from './useWebSocket.js'
import { applyAction, makeRoom, makePlayer, isShowHand, isSpecial } from '../utils/game.js'
import { uid, generateRoomCode } from '../utils/helpers.js'

export function useGame() {
  const [me,             setMe]            = useState({ id: '', name: '' })
  const [room,           setRoom]          = useState(null)
  const [logs,           setLogs]          = useState([])
  const [myIdx,          setMyIdx]         = useState(-1)
  const [selectedChit,   setSelectedChit]  = useState(-1)
  const [errorMsg,       setErrorMsg]      = useState('')
  const [loading,        setLoading]       = useState(false)
  const [wsStatus,       setWsStatus]      = useState('disconnected')
  const [myRevealed,     setMyRevealed]    = useState([])
  const [countdown,      setCountdown]     = useState(0)
  const [mustPassNormal, setMustPassNormal]= useState(false)
  const [stunFlash,      setStunFlash]     = useState(false)
  const [isStunned,      setIsStunned]     = useState(false)

  // vitalsResult: null | { type: 'vitals'|'superVitals', data: [...] }
  const [vitalsResult,   setVitalsResult]  = useState(null)

  // specialAction drives all modals
  // null
  // { type:'USE_OR_PASS', chitIdx, special }
  // { type:'PICK_TARGET', actionType, exclude:[] }  — generic target picker
  // { type:'REVEALED_SNATCH_PICK', options:[{c,i}], targetIdx }
  // { type:'NUKE_PICK_CARD', targetIdx, specials:[{c,i}] }
  // { type:'VITALS_RESULT', data }
  // { type:'SUPER_VITALS_RESULT', data }
  const [specialAction, setSpecialAction]  = useState(null)

  const roomRef           = useRef(null)
  const logsRef           = useRef([])
  const myIdxRef          = useRef(-1)
  const meRef             = useRef({ id: '', name: '' })
  const myRevealedRef     = useRef([])
  const resolveTimerRef   = useRef(null)
  const countdownTimer    = useRef(null)
  const nextPlayerIdxRef  = useRef(-1)
  const revealTimersRef   = useRef([])

  const { connect, send, disconnect } = useWebSocket()

  const updateRoom      = r => { roomRef.current = r;       setRoom(r) }
  const updateLogs      = l => { logsRef.current = l;       setLogs(l) }
  const updateMyIdx     = i => { myIdxRef.current = i;      setMyIdx(i) }
  const updateMe        = m => { meRef.current = m;         setMe(m) }
  const updateMyRevealed= r => { myRevealedRef.current = r; setMyRevealed(r) }

  // ── Derived ──────────────────────────────────────────────
  const isHost        = room?.hostId === me.id
  const myPlayer      = room?.players[myIdx]
  const myPuppetInfo  = room?.puppeteerInfo
  // Am I the puppeteer controlling someone?
  const amIPuppeteer  = myPuppetInfo?.puppeteerIdx === myIdx
  // Am I being puppeteered?
  const amIPuppeted   = myPuppetInfo?.targetIdx === myIdx
  // The target I'm controlling (if puppeteering)
  const puppetTarget  = amIPuppeteer ? room?.players[myPuppetInfo.targetIdx] : null

  // Effective "acting player" — if I'm puppeteering, I act as the target
  const actingIdx     = amIPuppeteer ? myPuppetInfo.targetIdx : myIdx
  const actingPlayer  = room?.players[actingIdx]

  const isMyTurn      = room?.currentTurn === myIdx || (amIPuppeteer && room?.currentTurn === myPuppetInfo.targetIdx)
  const turnPlayer    = room?.players[room?.currentTurn]
  const showAll       = ['afterShow','roundEnd','ended'].includes(room?.phase)
  const hasJoinedShow = room?.showClicks?.some(c => c.playerIdx === myIdx) ?? false
  const canJoinShow   = room?.phase === 'showWindow' && !hasJoinedShow
  const canCallShow   = room?.phase === 'playing'
    && !mustPassNormal && !isStunned
    && isShowHand(myPlayer?.chits ?? [])
  const amIStunned    = room?.stunnedPlayer === myIdx

  // Next player (for puppeteer exclusion)
  const nextPlayerIdx = room ? ((room.currentTurn + room.direction + room.players.length) % room.players.length) : -1
  nextPlayerIdxRef.current = nextPlayerIdx

  // ── syncRevealed ─────────────────────────────────────────
  const syncRevealed = useCallback((prevCount) => {
    const newCount = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
    const cur = myRevealedRef.current
    if (newCount > cur.length) {
      updateMyRevealed([...cur, ...Array(newCount - cur.length).fill(false)])
    } else if (newCount < cur.length) {
      updateMyRevealed(cur.slice(0, newCount))
    }
  }, [])

  // ── Countdown ────────────────────────────────────────────
  const clearCountdown = useCallback(() => {
    if (countdownTimer.current)  { clearInterval(countdownTimer.current);  countdownTimer.current  = null }
    if (resolveTimerRef.current) { clearTimeout(resolveTimerRef.current);  resolveTimerRef.current = null }
    setCountdown(0)
  }, [])

  const startCountdown = useCallback((endTs) => {
    clearCountdown()
    const tick = () => setCountdown(Math.max(0, Math.ceil((endTs - Date.now()) / 1000)))
    tick(); countdownTimer.current = setInterval(tick, 250)
  }, [clearCountdown])

  // ── Stun flash ────────────────────────────────────────────
  const triggerStunFlash = useCallback(() => {
    setStunFlash(true)
    setTimeout(() => setStunFlash(false), 600)
    const count = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
    updateMyRevealed(Array(count).fill(false))
    setIsStunned(true)
  }, [])

  // ── Vitals computation (client-side) ─────────────────────
  function computeVitals(players, myI) {
    return players.map((p, i) => {
      if (i === myI) return null
      const normals = p.chits.filter(c => !isSpecial(c))
      const total   = normals.length
      if (total === 0) return { name: p.name, idx: i, level: 'unknown', desc: 'No normal chits' }
      // Group by symbol
      const counts = {}
      normals.forEach(c => { counts[c.symbol] = (counts[c.symbol] || 0) + 1 })
      const maxSame = Math.max(...Object.values(counts))
      const pct = maxSame / total
      const level = pct >= 1 ? 'SHOW!' : pct >= .75 ? 'danger' : pct >= .5 ? 'high' : pct >= .25 ? 'medium' : 'low'
      const desc  = pct >= 1 ? 'All 4 match — can SHOW!' : pct >= .75 ? '3/4 match — very close!' : pct >= .5 ? '2/4 match — halfway there' : 'Unlikely to show soon'
      return { name: p.name, idx: i, level, desc, maxSame, total }
    }).filter(Boolean)
  }

  function computeSuperVitals(players, myI) {
    return players.map((p, i) => {
      if (i === myI) return null
      const normals = p.chits.filter(c => !isSpecial(c))
      if (normals.length < 4) return null
      const counts = {}
      normals.forEach(c => { counts[c.symbol] = (counts[c.symbol] || 0) + 1 })
      const maxSame = Math.max(...Object.values(counts))
      return maxSame >= 4 ? { name: p.name, idx: i } : null
    }).filter(Boolean)
  }

  // ── processAction (host) ──────────────────────────────────
  const processAction = useCallback((action) => {
    const prevPhase = roomRef.current?.phase
    const { room: r, logs: l } = applyAction(roomRef.current, logsRef.current, action)
    updateRoom(r); updateLogs(l)

    if (action.type === 'SHOW') {
      send({ type:'STATE_SYNC', payload:r, logs:l })
      startCountdown(r.showWindowEnd)
      resolveTimerRef.current = setTimeout(() => processAction({ type:'SHOW_RESOLVE' }), 5000)
      return
    }
    if (action.type === 'SHOW_RESOLVE') {
      send({ type:'STATE_SYNC', payload:r, logs:l })
      clearCountdown()
      setTimeout(() => {
        const { room:r2, logs:l2 } = applyAction(roomRef.current, logsRef.current, { type:'ROUND_END' })
        updateRoom(r2); updateLogs(l2)
        send({ type:'STATE_SYNC', payload:r2, logs:l2 })
      }, 1800)
      return
    }

    const myI = myIdxRef.current
    const np  = r.phase
    if (np === 'playing' && (prevPhase === 'roundEnd' || prevPhase === 'lobby')) {
      const count = r.players[myI]?.chits?.length ?? 0
      updateMyRevealed(Array(count).fill(false))
      setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    }
    if (np === 'playing' && prevPhase !== 'playing') setSpecialAction(null)
    if (action.type === 'STUN_GRENADE_PICK' && action.targetIdx === myI) triggerStunFlash()

    // Show target pickers for host
    if (np === 'pendingSpecial') {
      const pa = r.pendingAction
      if (pa?.userIdx === myI) {
        if (pa.type === 'BLIND_SNATCH')    setSpecialAction({ type:'PICK_TARGET', actionType:'BLIND_SNATCH_PICK',    exclude:[] })
        if (pa.type === 'REVEALED_SNATCH') setSpecialAction({ type:'PICK_TARGET', actionType:'REVEALED_SNATCH_PICK_TARGET', exclude:[] })
        if (pa.type === 'STUN_GRENADE')    setSpecialAction({ type:'PICK_TARGET', actionType:'STUN_GRENADE_PICK',    exclude:[] })
        if (pa.type === 'NUKE')            setSpecialAction({ type:'PICK_TARGET', actionType:'NUKE_PICK_TARGET',     exclude:[] })
        if (pa.type === 'PUPPETEER')       setSpecialAction({ type:'PICK_TARGET', actionType:'PUPPETEER_PICK',       exclude:[] })
        if (pa.type === 'POSITION_SWAP')   setSpecialAction({ type:'PICK_TARGET', actionType:'POSITION_SWAP_PICK',  exclude:[] })
      }
    }
    if (np === 'blindSnatchPicking' && r.pendingAction?.userIdx === myI) {
      setSpecialAction({ type:'BLIND_SNATCH_PICK_CARD', targetIdx: r.pendingAction.targetIdx })
      setLoading(false)
    }
    if (np === 'revealedSnatchPicking' && r.pendingAction?.userIdx === myI) {
      setSpecialAction({ type:'REVEALED_SNATCH_PICK', options: r.pendingAction.revealedOptions, targetIdx: r.pendingAction.targetIdx })
      setLoading(false)
    }
    if (np === 'nukePicking' && r.pendingAction?.userIdx === myI) {
      const ti = r.pendingAction.targetIdx
      const specials = r.players[ti].chits.map((c, i) => ({ c, i })).filter(({ c }) => isSpecial(c))
      setSpecialAction({ type:'NUKE_PICK_CARD', targetIdx: ti, specials })
      setLoading(false)
    }
    if (np === 'playing' && prevPhase === 'lobby') {
      setTimeout(() => setLoading(false), 0)
    }
    // Freeze: reset my revealed cards when I get frozen
    if (action.type === 'USE_FREEZE' && r.frozenPlayer === myI) {
      const count = r.players[myI]?.chits?.length ?? 0
      updateMyRevealed(Array(count).fill(false))
    }

    send({ type:'STATE_SYNC', payload:r, logs:l })
  }, [send, startCountdown, clearCountdown, triggerStunFlash, nextPlayerIdx])

  const sendAction = useCallback((action) => {
    if (roomRef.current?.hostId === meRef.current?.id) processAction(action)
    else send({ type:'ACTION', action })
  }, [processAction, send])

  // ── onMessage ─────────────────────────────────────────────
  const onMessage = useCallback((data) => {
    switch (data.type) {
      case 'REQUEST_STATE': {
        if (roomRef.current?.hostId !== meRef.current?.id) return
        const r = roomRef.current
        const exists = r.players.find(p => p.id === data.fromId)
        if (!exists && r.players.length < 5 && r.phase === 'lobby') {
          const np = makePlayer(data.fromId, data.fromName, r.players.length)
          const newRoom = { ...r, players:[...r.players, np] }
          const newLogs = [`${data.fromName} joined!`, ...logsRef.current]
          updateRoom(newRoom); updateLogs(newLogs)
          send({ type:'STATE_SYNC', payload:newRoom, logs:newLogs })
        } else {
          send({ type:'STATE_SYNC', payload:r, logs:logsRef.current })
        }
        break
      }
      case 'STATE_SYNC': {
        const prevPhase   = roomRef.current?.phase
        const prevStunned = roomRef.current?.stunnedPlayer
        const prevFrozen  = roomRef.current?.frozenPlayer
        const prevCount   = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
        updateRoom(data.payload); updateLogs(data.logs ?? [])
        const idx = data.payload.players.findIndex(p => p.id === meRef.current.id)
        updateMyIdx(idx); setLoading(false)
        syncRevealed(prevCount)

        const np  = data.payload.phase
        const myI = idx

        if (np === 'playing' && (prevPhase === 'roundEnd' || prevPhase === 'lobby')) {
          const count = data.payload.players[myI]?.chits?.length ?? 0
          updateMyRevealed(Array(count).fill(false))
          setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
        }
        if (np === 'playing' && prevPhase !== 'playing') setSpecialAction(null)
        if (np === 'showWindow' && prevPhase !== 'showWindow') startCountdown(data.payload.showWindowEnd)
        if (prevPhase === 'showWindow' && np !== 'showWindow') clearCountdown()
        if (data.payload.stunnedPlayer === myI && prevStunned !== myI) triggerStunFlash()
        if (prevStunned === myI && data.payload.stunnedPlayer !== myI) setIsStunned(false)

        // Non-host target pickers
        if (np === 'pendingSpecial') {
          const pa = data.payload.pendingAction
          if (pa?.userIdx === myI) {
            if (pa.type === 'BLIND_SNATCH')    setSpecialAction({ type:'PICK_TARGET', actionType:'BLIND_SNATCH_PICK',    exclude:[] })
            if (pa.type === 'REVEALED_SNATCH') setSpecialAction({ type:'PICK_TARGET', actionType:'REVEALED_SNATCH_PICK_TARGET', exclude:[] })
            if (pa.type === 'STUN_GRENADE')    setSpecialAction({ type:'PICK_TARGET', actionType:'STUN_GRENADE_PICK',    exclude:[] })
            if (pa.type === 'NUKE')            setSpecialAction({ type:'PICK_TARGET', actionType:'NUKE_PICK_TARGET',     exclude:[] })
            if (pa.type === 'PUPPETEER')       setSpecialAction({ type:'PICK_TARGET', actionType:'PUPPETEER_PICK',       exclude:[] })
            if (pa.type === 'POSITION_SWAP')   setSpecialAction({ type:'PICK_TARGET', actionType:'POSITION_SWAP_PICK',  exclude:[] })
          }
        }
        if (np === 'blindSnatchPicking' && data.payload.pendingAction?.userIdx === myI) {
          setSpecialAction({ type:'BLIND_SNATCH_PICK_CARD', targetIdx: data.payload.pendingAction.targetIdx })
          setLoading(false)
        }
        if (np === 'revealedSnatchPicking' && data.payload.pendingAction?.userIdx === myI) {
          setSpecialAction({ type:'REVEALED_SNATCH_PICK', options: data.payload.pendingAction.revealedOptions, targetIdx: data.payload.pendingAction.targetIdx })
          setLoading(false)
        }
        if (np === 'nukePicking' && data.payload.pendingAction?.userIdx === myI) {
          const ti = data.payload.pendingAction.targetIdx
          const specials = data.payload.players[ti].chits.map((c, i) => ({ c, i })).filter(({ c }) => isSpecial(c))
          setSpecialAction({ type:'NUKE_PICK_CARD', targetIdx:ti, specials })
          setLoading(false)
        }
        // Freeze: reset my revealed cards when I get frozen
        if (data.payload.frozenPlayer === myI && prevFrozen !== myI) {
          const count = data.payload.players[myI]?.chits?.length ?? 0
          updateMyRevealed(Array(count).fill(false))
        }
        break
      }
      case 'ACTION': {
        if (roomRef.current?.hostId !== meRef.current?.id) return
        processAction(data.action)
        break
      }
    }
  }, [send, syncRevealed, startCountdown, clearCountdown, processAction, triggerStunFlash])

  // ── Room management ───────────────────────────────────────
  const createRoom = useCallback(async (name) => {
    const newMe = { id:uid(), name }
    updateMe(newMe); meRef.current = newMe
    const code = generateRoomCode()
    const host = makePlayer(newMe.id, name, 0)
    const r    = makeRoom(code, host)
    updateRoom(r); updateLogs(['Room created! Share the code.'])
    updateMyIdx(0); updateMyRevealed([])
    connect(code, onMessage, setWsStatus)
    return code
  }, [connect, onMessage])

  const joinRoom = useCallback(async (name, code) => {
    setErrorMsg(''); setLoading(true)
    const newMe = { id:uid(), name }
    updateMe(newMe); meRef.current = newMe
    updateRoom({ code, phase:'lobby', players:[], hostId:null, round:1, currentTurn:0, direction:1, showCaller:-1, showClicks:[], frozenPlayer:-1, stunnedPlayer:-1, puppeteerInfo:null, positionSwaps:[], pendingAction:null, mode:'special' })
    updateLogs([])
    connect(code, onMessage, setWsStatus)
    await delay(600)
    send({ type:'REQUEST_STATE', fromId:newMe.id, fromName:name })
    let retries = 0
    const retry = setInterval(() => {
      if (myIdxRef.current >= 0 || retries++ > 10) { clearInterval(retry); return }
      send({ type:'REQUEST_STATE', fromId:newMe.id, fromName:name })
    }, 800)
    await waitFor(() => myIdxRef.current >= 0, 10000, 'Room not found or host is offline.')
    clearInterval(retry)
  }, [connect, send, onMessage])

  // ── Mode ─────────────────────────────────────────────────
  const setMode = useCallback((mode) => sendAction({ type:'SET_MODE', mode }), [sendAction])

  const setHandSetup = useCallback((normalCount, specialCount) => {
    sendAction({ type:'SET_HAND_SETUP', normalCount, specialCount })
  }, [sendAction])

  const setEnabledSpecials = useCallback((enabledSpecials) => {
    sendAction({ type:'SET_ENABLED_SPECIALS', enabledSpecials })
  }, [sendAction])

  // ── Start ────────────────────────────────────────────────
  const startGame = useCallback(() => {
    setLoading(true)
    const normalCount = room?.settings?.normalCount ?? 4
    const specialCount = room?.mode === 'normal' ? 0 : (room?.settings?.specialCount ?? 2)
    updateMyRevealed(Array(normalCount + specialCount).fill(false))
    setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    sendAction({ type:'START' })
  }, [sendAction, room])

  // ── Reveal ───────────────────────────────────────────────
  const revealAllMyCardsWithAnimation = useCallback(() => {
    const count = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
    if (!count) return

    revealTimersRef.current.forEach(clearTimeout)
    revealTimersRef.current = []

    for (let i = 0; i < count; i++) {
      const timer = setTimeout(() => {
        const next = [...myRevealedRef.current]
        next[i] = true
        updateMyRevealed(next)
      }, i * 80)

      revealTimersRef.current.push(timer)
    }
  }, [])

  const revealChit = useCallback((i) => {
    if (!['playing','pendingSpecial','revealedSnatchPicking','nukePicking'].includes(roomRef.current?.phase)) return
    if (!myRevealedRef.current[i]) revealAllMyCardsWithAnimation()
  }, [revealAllMyCardsWithAnimation])

  // ── Chit click ────────────────────────────────────────────
  const onChitClick = useCallback((i, forActingPlayer = false) => {
    const r     = roomRef.current
    // forActingPlayer: true when puppeteer clicks target's chit
    const pidx  = forActingPlayer ? r?.puppeteerInfo?.targetIdx : myIdxRef.current
    const chits = r?.players[pidx]?.chits ?? []
    const chit  = chits[i]
    if (!chit) return

    const myRev = forActingPlayer ? Array(chits.length).fill(true) : myRevealedRef.current

    if (!forActingPlayer && (amIStunned || isStunned)) {
      if (!myRev[i]) {
        revealAllMyCardsWithAnimation()
        return
      }

      if (r?.phase === 'playing' && isMyTurn) {
        setSelectedChit(prev => prev === i ? -1 : i)
      }
      return
    }

    if (!forActingPlayer && !myRev[i]) { revealChit(i); return }

    // Special card tap
    const canAct = forActingPlayer ? true : isMyTurn
    if (isSpecial(chit) && canAct && r?.phase === 'playing' && !mustPassNormal) {
      setSpecialAction({ type:'USE_OR_PASS', chitIdx:i, special:chit, forActing:forActingPlayer })
      setSelectedChit(i)
      return
    }
    if (r?.phase === 'playing' && (canAct || mustPassNormal)) {
      setSelectedChit(prev => prev === i ? -1 : i)
    }
  }, [isMyTurn, mustPassNormal, revealChit, revealAllMyCardsWithAnimation, amIStunned, isStunned])

  // ── Pass ─────────────────────────────────────────────────
  const passChit = useCallback((chitIdx, forActingPlayer = false) => {
    if (chitIdx === -1) { setErrorMsg('Select a chit to pass!'); return }
    const pidx = forActingPlayer
      ? roomRef.current?.puppeteerInfo?.targetIdx
      : myIdxRef.current

    if (!forActingPlayer) {
      const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
    }
    setSelectedChit(-1); setErrorMsg(''); setSpecialAction(null)
    if (mustPassNormal) setMustPassNormal(false)
    if (amIStunned || isStunned) setIsStunned(false)
    sendAction({ type:'PASS', playerIdx:pidx, chitIdx })
  }, [sendAction, mustPassNormal, amIStunned, isStunned])

  // ── Use special ───────────────────────────────────────────
  const useSpecial = useCallback((chitIdx, special, forActing = false) => {
    setSelectedChit(-1)
    const pidx = forActing
      ? roomRef.current?.puppeteerInfo?.targetIdx
      : myIdxRef.current

    const actionMap = {
      REVERSE: () => {
        sendAction({ type:'USE_REVERSE', playerIdx:pidx, chitIdx })
        setMustPassNormal(true); setSpecialAction(null)
      },
      FREEZE: () => {
        sendAction({ type:'USE_FREEZE', playerIdx:pidx, chitIdx })
        setMustPassNormal(true); setSpecialAction(null)
      },
      // Multi-step specials: set PICK_TARGET immediately so the modal renders without
      // waiting for processAction (host) or a STATE_SYNC round-trip (non-host).
      BLIND_SNATCH: () => {
        sendAction({ type:'USE_BLIND_SNATCH', playerIdx:pidx, chitIdx })
        setSpecialAction({ type:'PICK_TARGET', actionType:'BLIND_SNATCH_PICK', exclude:[] })
      },
      REVEALED_SNATCH: () => {
        sendAction({ type:'USE_REVEALED_SNATCH', playerIdx:pidx, chitIdx })
        setSpecialAction({ type:'PICK_TARGET', actionType:'REVEALED_SNATCH_PICK_TARGET', exclude:[] })
      },
      STUN_GRENADE: () => {
        sendAction({ type:'USE_STUN_GRENADE', playerIdx:pidx, chitIdx })
        setSpecialAction({ type:'PICK_TARGET', actionType:'STUN_GRENADE_PICK', exclude:[] })
      },
      NUKE: () => {
        sendAction({ type:'USE_NUKE', playerIdx:pidx, chitIdx })
        setSpecialAction({ type:'PICK_TARGET', actionType:'NUKE_PICK_TARGET', exclude:[] })
      },
      PUPPETEER: () => {
        sendAction({ type:'USE_PUPPETEER', playerIdx:pidx, chitIdx })
        setSpecialAction({ type:'PICK_TARGET', actionType:'PUPPETEER_PICK', exclude:[] })
      },
      POSITION_SWAP: () => {
        sendAction({ type:'USE_POSITION_SWAP', playerIdx:pidx, chitIdx })
        setSpecialAction({ type:'PICK_TARGET', actionType:'POSITION_SWAP_PICK', exclude:[] })
      },
      VITALS: () => {
        const r = roomRef.current
        const data = computeVitals(r.players, myIdxRef.current)
        setSpecialAction({ type:'VITALS_RESULT', data })
        sendAction({ type:'USE_VITALS', playerIdx:pidx, chitIdx })
        setMustPassNormal(true)
      },
      SUPER_VITALS: () => {
        const r = roomRef.current
        const data = computeSuperVitals(r.players, myIdxRef.current)
        setSpecialAction({ type:'SUPER_VITALS_RESULT', data })
        sendAction({ type:'USE_SUPER_VITALS', playerIdx:pidx, chitIdx })
        setMustPassNormal(true)
      },
    }

    actionMap[special.type]?.()
  }, [sendAction])

  // For VITALS and SUPER_VITALS we need dedicated actions in game.js
  // But since they're client-side, we consume the card locally via a dedicated action
  const consumeVitals = useCallback((chitIdx, type) => {
    sendAction({ type: type === 'VITALS' ? 'USE_VITALS' : 'USE_SUPER_VITALS', playerIdx: myIdxRef.current, chitIdx })
    setMustPassNormal(true)
  }, [sendAction])

  // ── Generic target pick result ────────────────────────────
  const pickTarget = useCallback((targetIdx, actionType) => {
    setSpecialAction(null)
    const actionMap = {
      'BLIND_SNATCH_PICK':           () => { setLoading(true); sendAction({ type:'BLIND_SNATCH_PICK',          targetIdx }) },
      'REVEALED_SNATCH_PICK_TARGET': () => { setLoading(true); sendAction({ type:'REVEALED_SNATCH_PICK_TARGET',targetIdx }) },
      'STUN_GRENADE_PICK':           () => { sendAction({ type:'STUN_GRENADE_PICK',          targetIdx }); setMustPassNormal(true) },
      'NUKE_PICK_TARGET':            () => { setLoading(true); sendAction({ type:'NUKE_PICK_TARGET',            targetIdx }) },
      'PUPPETEER_PICK':              () => sendAction({ type:'PUPPETEER_PICK',               targetIdx }),
      'POSITION_SWAP_PICK':          () => { sendAction({ type:'POSITION_SWAP_PICK',         targetIdx }); setMustPassNormal(true) },
    }
    actionMap[actionType]?.()
  }, [sendAction])

  const blindSnatchPickCard = useCallback((chitIdx) => {
    setSpecialAction(null)
    sendAction({ type:'BLIND_SNATCH_PICK_CARD', chitIdx })
    setMustPassNormal(true)
  }, [sendAction])

  const revealedSnatchPick = useCallback((chitIdx) => {
    setSpecialAction(null)
    sendAction({ type:'REVEALED_SNATCH_PICK_CHIT', chitIdx })
    setMustPassNormal(true)
  }, [sendAction])

  const nukePickCard = useCallback((chitIdx) => {
    setSpecialAction(null)
    sendAction({ type:'NUKE_PICK_CARD', chitIdx })
    setMustPassNormal(true)
  }, [sendAction])

  const cancelSpecial = useCallback(() => {
    setSpecialAction(null); setSelectedChit(-1)
  }, [])

  const dismissVitals = useCallback(() => setSpecialAction(null), [])

  const callShow = useCallback(() => {
    if (!canCallShow) { setErrorMsg("Your 4 normals don't all match!"); return }
    setErrorMsg(''); sendAction({ type:'SHOW', playerIdx:myIdxRef.current, timestamp:Date.now() })
  }, [canCallShow, sendAction])

  const joinShow = useCallback(() => {
    if (!canJoinShow) return
    sendAction({ type:'SHOW_JOIN', playerIdx:myIdxRef.current, timestamp:Date.now() })
  }, [canJoinShow, sendAction])

  const nextRound = useCallback(() => {
    const currentRoom = roomRef.current
    const normalCount = currentRoom?.settings?.normalCount ?? 4
    const specialCount = currentRoom?.mode === 'normal' ? 0 : (currentRoom?.settings?.specialCount ?? 2)
    updateMyRevealed(Array(normalCount + specialCount).fill(false))
    setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    sendAction({ type:'NEXT_ROUND' })
  }, [sendAction])

  const endGame   = useCallback(() => sendAction({ type:'END_GAME' }), [sendAction])
  const playAgain = useCallback(() => {
    updateMyRevealed([]); setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    sendAction({ type:'PLAY_AGAIN' })
  }, [sendAction])

  const leaveRoom = useCallback(() => {
    revealTimersRef.current.forEach(clearTimeout)
    revealTimersRef.current = []
    clearCountdown(); disconnect()
    updateRoom(null); updateMyIdx(-1); setSelectedChit(-1)
    updateLogs([]); setErrorMsg(''); updateMyRevealed([])
    setSpecialAction(null); setMustPassNormal(false); setIsStunned(false); setStunFlash(false)
  }, [clearCountdown, disconnect])

  return {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    specialAction, mustPassNormal, stunFlash, isStunned, amIStunned,
    amIPuppeteer, amIPuppeted, puppetTarget, actingIdx, actingPlayer,
    createRoom, joinRoom, startGame, setMode, setHandSetup, setEnabledSpecials,
    revealChit, onChitClick, passChit, useSpecial, cancelSpecial,
    pickTarget, blindSnatchPickCard, revealedSnatchPick, nukePickCard, dismissVitals, consumeVitals,
    callShow, joinShow,
    nextRound, endGame, playAgain, leaveRoom,
  }
}

// ── Vitals helpers (standalone so processAction can import if needed) ──
function computeVitals(players, myI) {
  return players.map((p, i) => {
    if (i === myI) return null
    const normals = p.chits.filter(c => !isSpecial(c))
    if (!normals.length) return { name:p.name, idx:i, level:'unknown', desc:'No normals' }
    const counts = {}
    normals.forEach(c => { counts[c.symbol] = (counts[c.symbol]||0)+1 })
    const maxSame = Math.max(...Object.values(counts))
    const pct = maxSame / normals.length
    const level = pct>=1?'SHOW!':pct>=.75?'danger':pct>=.5?'high':pct>=.25?'medium':'low'
    const desc  = pct>=1?'All 4 match!':pct>=.75?'3 of 4 match — very dangerous!':pct>=.5?'2 of 4 match':pct>=.25?'Warming up':'Unlikely to show soon'
    return { name:p.name, idx:i, level, desc, maxSame, total:normals.length }
  }).filter(Boolean)
}

function computeSuperVitals(players, myI) {
  return players.map((p, i) => {
    if (i === myI) return null
    const normals = p.chits.filter(c => !isSpecial(c))
    if (normals.length < 4) return null
    const counts = {}
    normals.forEach(c => { counts[c.symbol] = (counts[c.symbol] || 0) + 1 })
    const maxSame = Math.max(...Object.values(counts))
    return maxSame >= 4 ? { name:p.name, idx:i } : null
  }).filter(Boolean)
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
function waitFor(cond, timeout, errMsg) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { clearInterval(p); reject(new Error(errMsg)) }, timeout)
    const p = setInterval(() => { if (cond()) { clearTimeout(t); clearInterval(p); resolve() } }, 80)
  })
}