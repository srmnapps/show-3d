import { useState, useRef, useCallback } from 'react'
import { useWebSocket } from './useWebSocket.js'
import { applyAction, makeRoom, makePlayer, isShowHand, isSpecial, chitDisplay } from '../utils/game.js'
import { uid, generateRoomCode } from '../utils/helpers.js'

export function useGame() {
  const [me,            setMe]            = useState({ id: '', name: '' })
  const [room,          setRoom]          = useState(null)
  const [logs,          setLogs]          = useState([])
  const [myIdx,         setMyIdx]         = useState(-1)
  const [selectedChit,  setSelectedChit]  = useState(-1)
  const [errorMsg,      setErrorMsg]      = useState('')
  const [loading,       setLoading]       = useState(false)
  const [wsStatus,      setWsStatus]      = useState('disconnected')
  const [myRevealed,    setMyRevealed]    = useState([])
  const [countdown,     setCountdown]     = useState(0)

  // Special interaction UI state
  const [specialAction, setSpecialAction] = useState(null)
  // null | { type:'USE_OR_PASS', chitIdx, special }
  //       | { type:'GIVER_SNATCH_PROMPT' }
  //       | { type:'GIVER_SNATCH_PICK', giverChits }
  //       | { type:'RANDOM_SNATCH_PICK_PLAYER' }
  //       | { type:'RANDOM_SNATCH_PICK_CHIT', targetIdx, targetChits, userChits }

  // After using a special, player must pass a normal chit
  const [mustPassNormal, setMustPassNormal] = useState(false)

  const roomRef         = useRef(null)
  const logsRef         = useRef([])
  const myIdxRef        = useRef(-1)
  const meRef           = useRef({ id: '', name: '' })
  const myRevealedRef   = useRef([])
  const resolveTimerRef = useRef(null)
  const countdownTimer  = useRef(null)

  const { connect, send, disconnect } = useWebSocket()

  const updateRoom = (r) => { roomRef.current = r; setRoom(r) }
  const updateLogs = (l) => { logsRef.current = l; setLogs(l) }
  const updateMyIdx = (i) => { myIdxRef.current = i; setMyIdx(i) }
  const updateMe = (m) => { meRef.current = m; setMe(m) }
  const updateMyRevealed = (r) => { myRevealedRef.current = r; setMyRevealed(r) }

  // ── Derived state ──────────────────────────────────────────
  const isHost       = room?.hostId === me.id
  const myPlayer     = room?.players[myIdx]
  const isMyTurn     = room?.currentTurn === myIdx
  const turnPlayer   = room?.players[room?.currentTurn]
  const showAll      = ['afterShow','roundEnd','ended'].includes(room?.phase)
  const hasJoinedShow = room?.showClicks?.some(c => c.playerIdx === myIdx) ?? false
  const canJoinShow   = room?.phase === 'showWindow' && !hasJoinedShow
  const canCallShow   = room?.phase === 'playing'
    && !mustPassNormal
    && isShowHand(myPlayer?.chits ?? [])

  // Is it MY turn to respond to giver snatch
  const isMyGiverSnatch = room?.phase === 'giverSnatching'
    && room?.pendingGiverSnatch?.receiverIdx === myIdx

  // Is it MY turn for random snatch
  const isMyRandomSnatch = ['randomSnatching','giverSnatchPicking'].includes(room?.phase)
    && room?.pendingRandomSnatch?.userIdx === myIdx

  // ── Sync revealed ──────────────────────────────────────────
  const syncRevealed = useCallback((prevCount) => {
    const newCount = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
    const cur = myRevealedRef.current
    if (newCount > cur.length) {
      updateMyRevealed([...cur, ...Array(newCount - cur.length).fill(false)])
    } else if (newCount < cur.length) {
      updateMyRevealed(cur.slice(0, newCount))
    }
  }, [])

  // ── Countdown ─────────────────────────────────────────────
  const clearCountdown = useCallback(() => {
    if (countdownTimer.current)  { clearInterval(countdownTimer.current);  countdownTimer.current  = null }
    if (resolveTimerRef.current) { clearTimeout(resolveTimerRef.current);  resolveTimerRef.current = null }
    setCountdown(0)
  }, [])

  const startCountdown = useCallback((windowEndTs) => {
    clearCountdown()
    const tick = () => setCountdown(Math.max(0, Math.ceil((windowEndTs - Date.now()) / 1000)))
    tick()
    countdownTimer.current = setInterval(tick, 250)
  }, [clearCountdown])

  // ── processAction (host only) ──────────────────────────────
  const processAction = useCallback((action) => {
    const { room: r, logs: l } = applyAction(roomRef.current, logsRef.current, action)
    updateRoom(r)
    updateLogs(l)

    if (action.type === 'SHOW') {
      send({ type: 'STATE_SYNC', payload: r, logs: l })
      startCountdown(r.showWindowEnd)
      resolveTimerRef.current = setTimeout(() => {
        processAction({ type: 'SHOW_RESOLVE' })
      }, 5000)
      return
    }
    if (action.type === 'SHOW_RESOLVE') {
      send({ type: 'STATE_SYNC', payload: r, logs: l })
      clearCountdown()
      setTimeout(() => {
        const { room: r2, logs: l2 } = applyAction(roomRef.current, logsRef.current, { type: 'ROUND_END' })
        updateRoom(r2); updateLogs(l2)
        send({ type: 'STATE_SYNC', payload: r2, logs: l2 })
      }, 1800)
      return
    }
    send({ type: 'STATE_SYNC', payload: r, logs: l })
  }, [send, startCountdown, clearCountdown])

  const sendAction = useCallback((action) => {
    if (roomRef.current?.hostId === meRef.current?.id) {
      processAction(action)
    } else {
      send({ type: 'ACTION', action })
    }
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
          const newRoom = { ...r, players: [...r.players, np] }
          const newLogs = [`${data.fromName} joined!`, ...logsRef.current]
          updateRoom(newRoom); updateLogs(newLogs)
          send({ type: 'STATE_SYNC', payload: newRoom, logs: newLogs })
        } else {
          send({ type: 'STATE_SYNC', payload: r, logs: logsRef.current })
        }
        break
      }
      case 'STATE_SYNC': {
        const prevPhase     = roomRef.current?.phase
        const prevChitCount = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
        updateRoom(data.payload)
        updateLogs(data.logs ?? [])
        const idx = data.payload.players.findIndex(p => p.id === meRef.current.id)
        updateMyIdx(idx)
        setLoading(false)
        syncRevealed(prevChitCount)

        // Handle phase-specific UI triggers
        const newPhase = data.payload.phase
        if (newPhase === 'showWindow' && prevPhase !== 'showWindow') {
          startCountdown(data.payload.showWindowEnd)
        }
        if (prevPhase === 'showWindow' && newPhase !== 'showWindow') {
          clearCountdown()
        }

        // Giver snatch prompt for the receiver
        if (newPhase === 'giverSnatching') {
          const gs = data.payload.pendingGiverSnatch
          if (gs?.receiverIdx === idx) {
            setSpecialAction({ type: 'GIVER_SNATCH_PROMPT' })
          }
        }

        // Random snatch - pick player
        if (newPhase === 'randomSnatching') {
          const rs = data.payload.pendingRandomSnatch
          if (rs?.userIdx === idx) {
            if (rs.step === 'pickingPlayer') {
              setSpecialAction({ type: 'RANDOM_SNATCH_PICK_PLAYER', viewMode: rs.viewMode })
            } else if (rs.step === 'swapping' && rs.viewMode === 'see') {
              setSpecialAction({
                type: 'RANDOM_SNATCH_PICK_CHIT',
                targetIdx: rs.targetIdx,
                targetChits: data.payload.players[rs.targetIdx]?.chits ?? [],
                userChits: data.payload.players[rs.userIdx]?.chits ?? [],
              })
            }
          }
        }

        // Giver snatch picking
        if (newPhase === 'giverSnatchPicking') {
          const gs = data.payload.pendingGiverSnatch
          if (gs?.receiverIdx === idx) {
            setSpecialAction({
              type: 'GIVER_SNATCH_PICK',
              giverChits: data.payload.players[gs.giverIdx]?.chits ?? [],
              giverIdx: gs.giverIdx,
            })
          }
        }

        // Clear special action UI when back to playing
        if (newPhase === 'playing' && prevPhase !== 'playing') {
          setSpecialAction(null)
        }
        break
      }
      case 'ACTION': {
        if (roomRef.current?.hostId !== meRef.current?.id) return
        processAction(data.action)
        break
      }
    }
  }, [send, syncRevealed, startCountdown, clearCountdown, processAction])

  // ── Room management ───────────────────────────────────────
  const createRoom = useCallback(async (name) => {
    const newMe = { id: uid(), name }
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
    const newMe = { id: uid(), name }
    updateMe(newMe); meRef.current = newMe
    updateRoom({
      code, phase:'lobby', players:[], hostId:null,
      round:1, currentTurn:0, direction:1,
      showCaller:-1, showClicks:[],
      frozenPlayer:-1, pendingGiverSnatch:null, pendingRandomSnatch:null
    })
    updateLogs([])
    connect(code, onMessage, setWsStatus)
    await delay(600)
    send({ type: 'REQUEST_STATE', fromId: newMe.id, fromName: name })
    let retries = 0
    const retry = setInterval(() => {
      if (myIdxRef.current >= 0 || retries++ > 10) { clearInterval(retry); return }
      send({ type: 'REQUEST_STATE', fromId: newMe.id, fromName: name })
    }, 800)
    await waitFor(() => myIdxRef.current >= 0, 10000, 'Room not found or host is offline.')
    clearInterval(retry)
  }, [connect, send, onMessage])

  // ── Game actions ──────────────────────────────────────────
  const startGame = useCallback(() => {
    updateMyRevealed(Array(6).fill(false))
    sendAction({ type: 'START' })
  }, [sendAction])

  // Reveal is local only
  const revealChit = useCallback((i) => {
    if (!['playing','giverSnatching','randomSnatching','giverSnatchPicking'].includes(roomRef.current?.phase)) return
    const r = [...myRevealedRef.current]
    r[i] = true
    updateMyRevealed(r)
  }, [])

  // Click on a chit in HUD
  const onChitClick = useCallback((i) => {
    const room = roomRef.current
    const chits = room?.players[myIdxRef.current]?.chits ?? []
    const chit  = chits[i]
    if (!chit) return

    if (!myRevealedRef.current[i]) {
      // Reveal it first
      revealChit(i)
      return
    }

    if (isSpecial(chit) && isMyTurn && room?.phase === 'playing' && !mustPassNormal) {
      // Show use/pass choice
      setSpecialAction({ type: 'USE_OR_PASS', chitIdx: i, special: chit })
      setSelectedChit(i)
      return
    }

    // Normal select
    if (room?.phase === 'playing' && (isMyTurn || mustPassNormal)) {
      setSelectedChit(prev => prev === i ? -1 : i)
    }
  }, [isMyTurn, mustPassNormal, revealChit])

  // Pass a chit (normal or special-as-pass)
  const passChit = useCallback((chitIdx) => {
    if (chitIdx === -1) { setErrorMsg('Select a chit to pass!'); return }
    const rev = [...myRevealedRef.current]
    rev.splice(chitIdx, 1)
    updateMyRevealed(rev)
    setSelectedChit(-1)
    setErrorMsg('')
    setSpecialAction(null)
    if (mustPassNormal) setMustPassNormal(false)
    sendAction({ type: 'PASS', playerIdx: myIdxRef.current, chitIdx })
  }, [sendAction, mustPassNormal])

  // Use a special card
  const useSpecial = useCallback((chitIdx, special) => {
    setSpecialAction(null)
    setSelectedChit(-1)

    if (special.type === 'REVERSE') {
      sendAction({ type: 'USE_REVERSE', playerIdx: myIdxRef.current, chitIdx })
      setMustPassNormal(true)
    } else if (special.type === 'FREEZE') {
      sendAction({ type: 'USE_FREEZE', playerIdx: myIdxRef.current, chitIdx })
      setMustPassNormal(true)
    } else if (special.type === 'RANDOM_SNATCH') {
      sendAction({ type: 'USE_RANDOM_SNATCH', playerIdx: myIdxRef.current, chitIdx })
      // UI will be set by STATE_SYNC handler
    }
    // GIVER_SNATCH is a reaction — no "use" from hand
  }, [sendAction])

  // Giver Snatch respond (receiver says yes/no)
  const giverSnatchRespond = useCallback((use) => {
    setSpecialAction(null)
    sendAction({ type: 'GIVER_SNATCH_RESPOND', use })
    if (use) {
      // UI will be updated via STATE_SYNC
    } else {
      setMustPassNormal(true)
    }
  }, [sendAction])

  // Giver Snatch pick a specific chit from giver
  const giverSnatchPick = useCallback((chitIdx) => {
    setSpecialAction(null)
    sendAction({ type: 'GIVER_SNATCH_PICK', chitIdx })
    setMustPassNormal(true)
  }, [sendAction])

  // Random Snatch pick target player
  const randomSnatchPickPlayer = useCallback((targetIdx) => {
    sendAction({ type: 'RANDOM_SNATCH_PICK_PLAYER', targetIdx })
    // STATE_SYNC will update specialAction
  }, [sendAction])

  // Random Snatch pick which chits to swap
  const randomSnatchPickChit = useCallback((userChitIdx, targetChitIdx) => {
    setSpecialAction(null)
    sendAction({ type: 'RANDOM_SNATCH_PICK_CHIT', userChitIdx, targetChitIdx })
    setMustPassNormal(true)
  }, [sendAction])

  const callShow = useCallback(() => {
    if (!canCallShow) { setErrorMsg("Your 4 normals don't all match!"); return }
    setErrorMsg('')
    sendAction({ type: 'SHOW', playerIdx: myIdxRef.current, timestamp: Date.now() })
  }, [canCallShow, sendAction])

  const joinShow = useCallback(() => {
    if (!canJoinShow) return
    sendAction({ type: 'SHOW_JOIN', playerIdx: myIdxRef.current, timestamp: Date.now() })
  }, [canJoinShow, sendAction])

  const nextRound = useCallback(() => {
    updateMyRevealed(Array(6).fill(false))
    setMustPassNormal(false)
    setSpecialAction(null)
    sendAction({ type: 'NEXT_ROUND' })
  }, [sendAction])

  const endGame   = useCallback(() => sendAction({ type: 'END_GAME' }), [sendAction])

  const playAgain = useCallback(() => {
    updateMyRevealed([])
    setMustPassNormal(false)
    setSpecialAction(null)
    sendAction({ type: 'PLAY_AGAIN' })
  }, [sendAction])

  const leaveRoom = useCallback(() => {
    clearCountdown(); disconnect()
    updateRoom(null); updateMyIdx(-1); setSelectedChit(-1)
    updateLogs([]); setErrorMsg(''); updateMyRevealed([])
    setSpecialAction(null); setMustPassNormal(false)
  }, [clearCountdown, disconnect])

  return {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    specialAction, mustPassNormal,
    isMyGiverSnatch, isMyRandomSnatch,
    createRoom, joinRoom, startGame,
    revealChit, onChitClick, passChit, useSpecial,
    giverSnatchRespond, giverSnatchPick,
    randomSnatchPickPlayer, randomSnatchPickChit,
    callShow, joinShow,
    nextRound, endGame, playAgain, leaveRoom,
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
function waitFor(cond, timeout, errMsg) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { clearInterval(p); reject(new Error(errMsg)) }, timeout)
    const p = setInterval(() => { if (cond()) { clearTimeout(t); clearInterval(p); resolve() } }, 80)
  })
}