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
  const [stunFlash,      setStunFlash]     = useState(false)  // white flash overlay
  const [isStunned,      setIsStunned]     = useState(false)  // my chits are hidden

  // specialAction drives modals
  // null | { type:'USE_OR_PASS', chitIdx, special }
  //       | { type:'RANDOM_SNATCH_PICK_PLAYER' }
  //       | { type:'STUN_GRENADE_PICK_PLAYER' }
  const [specialAction, setSpecialAction] = useState(null)

  const roomRef        = useRef(null)
  const logsRef        = useRef([])
  const myIdxRef       = useRef(-1)
  const meRef          = useRef({ id: '', name: '' })
  const myRevealedRef  = useRef([])
  const resolveTimerRef= useRef(null)
  const countdownTimer = useRef(null)

  const { connect, send, disconnect } = useWebSocket()

  const updateRoom      = r => { roomRef.current = r;       setRoom(r) }
  const updateLogs      = l => { logsRef.current = l;       setLogs(l) }
  const updateMyIdx     = i => { myIdxRef.current = i;      setMyIdx(i) }
  const updateMe        = m => { meRef.current = m;         setMe(m) }
  const updateMyRevealed= r => { myRevealedRef.current = r; setMyRevealed(r) }

  // ── Derived ──────────────────────────────────────────────
  const isHost        = room?.hostId === me.id
  const myPlayer      = room?.players[myIdx]
  const isMyTurn      = room?.currentTurn === myIdx
  const turnPlayer    = room?.players[room?.currentTurn]
  const showAll       = ['afterShow','roundEnd','ended'].includes(room?.phase)
  const hasJoinedShow = room?.showClicks?.some(c => c.playerIdx === myIdx) ?? false
  const canJoinShow   = room?.phase === 'showWindow' && !hasJoinedShow
  const canCallShow   = room?.phase === 'playing' && !mustPassNormal && !isStunned && isShowHand(myPlayer?.chits ?? [])
  const amIStunned    = room?.stunnedPlayer === myIdx

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

  const startCountdown = useCallback((windowEndTs) => {
    clearCountdown()
    const tick = () => setCountdown(Math.max(0, Math.ceil((windowEndTs - Date.now()) / 1000)))
    tick()
    countdownTimer.current = setInterval(tick, 250)
  }, [clearCountdown])

  // ── Stun flash effect ────────────────────────────────────
  const triggerStunFlash = useCallback(() => {
    setStunFlash(true)
    setTimeout(() => setStunFlash(false), 600)
    // Reset all revealed
    const count = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
    updateMyRevealed(Array(count).fill(false))
    setIsStunned(true)
  }, [])

  // ── processAction (host) ──────────────────────────────────
  const processAction = useCallback((action) => {
    const prevPhase = roomRef.current?.phase
    const { room: r, logs: l } = applyAction(roomRef.current, logsRef.current, action)
    updateRoom(r); updateLogs(l)

    if (action.type === 'SHOW') {
      send({ type: 'STATE_SYNC', payload: r, logs: l })
      startCountdown(r.showWindowEnd)
      resolveTimerRef.current = setTimeout(() => processAction({ type: 'SHOW_RESOLVE' }), 5000)
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

    // Mirror UI for host
    const myI = myIdxRef.current
    const np  = r.phase
    if (np === 'playing' && prevPhase !== 'playing') setSpecialAction(null)
    if (np === 'randomSnatching' && r.pendingRandomSnatch?.userIdx === myI) {
      setSpecialAction({ type: 'RANDOM_SNATCH_PICK_PLAYER' })
    }
    if (np === 'stunGrenade' && r.pendingStunGrenade?.userIdx === myI) {
      setSpecialAction({ type: 'STUN_GRENADE_PICK_PLAYER' })
    }
    // Host is stunned
    if (action.type === 'STUN_GRENADE_PICK_PLAYER' && action.targetIdx === myI) {
      triggerStunFlash()
    }
    if (np === 'playing' && (prevPhase === 'roundEnd' || prevPhase === 'lobby')) {
      const count = r.players[myI]?.chits?.length ?? 0
      updateMyRevealed(Array(count).fill(false))
      setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    }

    send({ type: 'STATE_SYNC', payload: r, logs: l })
  }, [send, startCountdown, clearCountdown, triggerStunFlash])

  const sendAction = useCallback((action) => {
    if (roomRef.current?.hostId === meRef.current?.id) processAction(action)
    else send({ type: 'ACTION', action })
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
        const prevStunned   = roomRef.current?.stunnedPlayer
        const prevChitCount = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
        updateRoom(data.payload); updateLogs(data.logs ?? [])
        const idx = data.payload.players.findIndex(p => p.id === meRef.current.id)
        updateMyIdx(idx); setLoading(false)
        syncRevealed(prevChitCount)

        const np = data.payload.phase

        // New round / game start — reset everything
        if (np === 'playing' && (prevPhase === 'roundEnd' || prevPhase === 'lobby')) {
          const count = data.payload.players[idx]?.chits?.length ?? 0
          updateMyRevealed(Array(count).fill(false))
          setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
        }
        if (np === 'playing' && prevPhase !== 'playing') setSpecialAction(null)

        // Countdown
        if (np === 'showWindow' && prevPhase !== 'showWindow') startCountdown(data.payload.showWindowEnd)
        if (prevPhase === 'showWindow' && np !== 'showWindow') clearCountdown()

        // Stun flash — triggered when I become the stunned player
        if (data.payload.stunnedPlayer === idx && prevStunned !== idx) {
          triggerStunFlash()
        }
        // Lift stun if stunnedPlayer changed away from me
        if (prevStunned === idx && data.payload.stunnedPlayer !== idx) {
          setIsStunned(false)
        }

        // Random snatch — show player picker to user
        if (np === 'randomSnatching') {
          const rs = data.payload.pendingRandomSnatch
          if (rs?.userIdx === idx) setSpecialAction({ type: 'RANDOM_SNATCH_PICK_PLAYER' })
        }

        // Stun grenade — show player picker to user
        if (np === 'stunGrenade') {
          const sg = data.payload.pendingStunGrenade
          if (sg?.userIdx === idx) setSpecialAction({ type: 'STUN_GRENADE_PICK_PLAYER' })
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
      frozenPlayer:-1, stunnedPlayer:-1,
      pendingRandomSnatch:null, pendingStunGrenade:null,
      mode:'special',
    })
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

  // ── Mode ──────────────────────────────────────────────────
  const setMode = useCallback((mode) => {
    sendAction({ type:'SET_MODE', mode })
  }, [sendAction])

  // ── Game actions ──────────────────────────────────────────
  const startGame = useCallback(() => {
    const count = room?.mode === 'special' ? 6 : 4
    updateMyRevealed(Array(count).fill(false))
    setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    sendAction({ type:'START' })
  }, [sendAction, room])

  const revealChit = useCallback((i) => {
    // Blocked if stunned
    if (isStunned || amIStunned) return
    if (!['playing','randomSnatching','stunGrenade'].includes(roomRef.current?.phase)) return
    const r = [...myRevealedRef.current]; r[i] = true; updateMyRevealed(r)
  }, [isStunned, amIStunned])

  const onChitClick = useCallback((i) => {
    const room  = roomRef.current
    const chits = room?.players[myIdxRef.current]?.chits ?? []
    const chit  = chits[i]
    if (!chit) return

    // Stunned: can only select (blind), cannot reveal
    if (amIStunned || isStunned) {
      if (room?.phase === 'playing' && isMyTurn) {
        setSelectedChit(prev => prev === i ? -1 : i)
      }
      return
    }

    if (!myRevealedRef.current[i]) { revealChit(i); return }

    if (isSpecial(chit) && isMyTurn && room?.phase === 'playing' && !mustPassNormal) {
      setSpecialAction({ type:'USE_OR_PASS', chitIdx:i, special:chit })
      setSelectedChit(i)
      return
    }
    if (room?.phase === 'playing' && (isMyTurn || mustPassNormal)) {
      setSelectedChit(prev => prev === i ? -1 : i)
    }
  }, [isMyTurn, mustPassNormal, revealChit, amIStunned, isStunned])

  const passChit = useCallback((chitIdx) => {
    if (chitIdx === -1) { setErrorMsg('Select a chit to pass!'); return }
    const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
    setSelectedChit(-1); setErrorMsg(''); setSpecialAction(null)
    if (mustPassNormal) setMustPassNormal(false)
    // Lift stun after passing
    if (amIStunned || isStunned) setIsStunned(false)
    sendAction({ type:'PASS', playerIdx:myIdxRef.current, chitIdx })
  }, [sendAction, mustPassNormal, amIStunned, isStunned])

  const useSpecial = useCallback((chitIdx, special) => {
    setSpecialAction(null); setSelectedChit(-1)
    if (special.type === 'REVERSE') {
      sendAction({ type:'USE_REVERSE', playerIdx:myIdxRef.current, chitIdx })
      setMustPassNormal(true)
    } else if (special.type === 'FREEZE') {
      sendAction({ type:'USE_FREEZE', playerIdx:myIdxRef.current, chitIdx })
      setMustPassNormal(true)
    } else if (special.type === 'RANDOM_SNATCH') {
      sendAction({ type:'USE_RANDOM_SNATCH', playerIdx:myIdxRef.current, chitIdx })
      // Modal will show via STATE_SYNC
    } else if (special.type === 'STUN_GRENADE') {
      sendAction({ type:'USE_STUN_GRENADE', playerIdx:myIdxRef.current, chitIdx })
      // Modal will show via STATE_SYNC
    }
  }, [sendAction])

  const randomSnatchPickPlayer = useCallback((targetIdx) => {
    setSpecialAction(null)
    sendAction({ type:'RANDOM_SNATCH_PICK_PLAYER', targetIdx })
    setMustPassNormal(true)
  }, [sendAction])

  const stunGrenadePickPlayer = useCallback((targetIdx) => {
    setSpecialAction(null)
    sendAction({ type:'STUN_GRENADE_PICK_PLAYER', targetIdx })
    setMustPassNormal(true)
  }, [sendAction])

  const cancelSpecial = useCallback(() => {
    setSpecialAction(null); setSelectedChit(-1)
  }, [])

  const callShow = useCallback(() => {
    if (!canCallShow) { setErrorMsg("Your 4 normals don't all match!"); return }
    setErrorMsg('')
    sendAction({ type:'SHOW', playerIdx:myIdxRef.current, timestamp:Date.now() })
  }, [canCallShow, sendAction])

  const joinShow = useCallback(() => {
    if (!canJoinShow) return
    sendAction({ type:'SHOW_JOIN', playerIdx:myIdxRef.current, timestamp:Date.now() })
  }, [canJoinShow, sendAction])

  const nextRound = useCallback(() => {
    const count = roomRef.current?.mode === 'special' ? 6 : 4
    updateMyRevealed(Array(count).fill(false))
    setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    sendAction({ type:'NEXT_ROUND' })
  }, [sendAction])

  const endGame   = useCallback(() => sendAction({ type:'END_GAME' }), [sendAction])

  const playAgain = useCallback(() => {
    updateMyRevealed([]); setMustPassNormal(false)
    setSpecialAction(null); setIsStunned(false)
    sendAction({ type:'PLAY_AGAIN' })
  }, [sendAction])

  const leaveRoom = useCallback(() => {
    clearCountdown(); disconnect()
    updateRoom(null); updateMyIdx(-1); setSelectedChit(-1)
    updateLogs([]); setErrorMsg(''); updateMyRevealed([])
    setSpecialAction(null); setMustPassNormal(false)
    setIsStunned(false); setStunFlash(false)
  }, [clearCountdown, disconnect])

  return {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    specialAction, mustPassNormal, stunFlash, isStunned, amIStunned,
    createRoom, joinRoom, startGame, setMode,
    revealChit, onChitClick, passChit, useSpecial, cancelSpecial,
    randomSnatchPickPlayer, stunGrenadePickPlayer,
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