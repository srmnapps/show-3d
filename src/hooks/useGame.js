import { useState, useRef, useCallback, useEffect } from 'react'
import { useWebSocket } from './useWebSocket.js'
import { applyAction, makeRoom, makePlayer, isShowHand } from '../utils/game.js'
import { uid, generateRoomCode } from '../utils/helpers.js'

export function useGame() {
  const [me,           setMe]           = useState({ id: '', name: '' })
  const [room,         setRoom]         = useState(null)
  const [logs,         setLogs]         = useState([])
  const [myIdx,        setMyIdx]        = useState(-1)
  const [selectedChit, setSelectedChit] = useState(-1)
  const [errorMsg,     setErrorMsg]     = useState('')
  const [loading,      setLoading]      = useState(false)
  const [wsStatus,     setWsStatus]     = useState('disconnected')
  const [myRevealed,   setMyRevealed]   = useState([])
  const [countdown,    setCountdown]    = useState(0)

  // Refs for values needed inside callbacks without stale closure issues
  const roomRef        = useRef(null)
  const logsRef        = useRef([])
  const myIdxRef       = useRef(-1)
  const meRef          = useRef({ id: '', name: '' })
  const myRevealedRef  = useRef([])
  const showTimerRef   = useRef(null)
  const resolveTimerRef= useRef(null)
  const countdownTimer = useRef(null)

  const { connect, send, disconnect } = useWebSocket()

  // Keep refs in sync with state
  const updateRoom = (r) => { roomRef.current = r; setRoom(r) }
  const updateLogs = (l) => { logsRef.current = l; setLogs(l) }
  const updateMyIdx = (i) => { myIdxRef.current = i; setMyIdx(i) }
  const updateMe = (m) => { meRef.current = m; setMe(m) }
  const updateMyRevealed = (r) => { myRevealedRef.current = r; setMyRevealed(r) }

  const isHost     = room?.hostId === me.id
  const myPlayer   = room?.players[myIdx]
  const isMyTurn   = room?.currentTurn === myIdx
  const turnPlayer = room?.players[room?.currentTurn]
  const showAll    = ['afterShow','roundEnd','ended'].includes(room?.phase)
  const hasJoinedShow = room?.showClicks?.some(c => c.playerIdx === myIdx) ?? false
  const canJoinShow   = room?.phase === 'showWindow' && !hasJoinedShow
  const canCallShow   = room?.phase === 'playing' && (myPlayer?.chits?.length ?? 0) === 3

  // Sync myRevealed length with chit count (preserving existing reveals)
  const syncRevealed = useCallback((prevCount) => {
    const newCount = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
    const cur = myRevealedRef.current
    if (newCount > cur.length) {
      const added = newCount - cur.length
      updateMyRevealed([...cur, ...Array(added).fill(false)])
    } else if (newCount < cur.length) {
      updateMyRevealed(cur.slice(0, newCount))
    }
  }, [])

  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null }
    if (resolveTimerRef.current){ clearTimeout(resolveTimerRef.current); resolveTimerRef.current = null }
    setCountdown(0)
  }, [])

  const startCountdown = useCallback((windowEndTs) => {
    clearCountdown()
    const tick = () => setCountdown(Math.max(0, Math.ceil((windowEndTs - Date.now()) / 1000)))
    tick()
    countdownTimer.current = setInterval(tick, 250)
  }, [clearCountdown])

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
        if (data.payload.phase === 'showWindow' && prevPhase !== 'showWindow') {
          startCountdown(data.payload.showWindowEnd)
        }
        if (prevPhase === 'showWindow' && data.payload.phase !== 'showWindow') {
          clearCountdown()
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

  const createRoom = useCallback(async (name) => {
    const newMe = { id: uid(), name }
    updateMe(newMe)
    meRef.current = newMe
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
    updateRoom({ code, phase:'lobby', players:[], hostId:null, round:1, currentTurn:0, showCaller:-1, showClicks:[] })
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

  const startGame    = useCallback(() => { updateMyRevealed([false,false,false]); sendAction({ type:'START' }) }, [sendAction])
  const revealChit   = useCallback((i) => { if (roomRef.current?.phase !== 'playing') return; const r=[...myRevealedRef.current]; r[i]=true; updateMyRevealed(r) }, [])
  const selectChit   = useCallback((i) => {
    if (!isMyTurn || roomRef.current?.phase !== 'playing') return
    if (!myRevealedRef.current[i]) return
    setSelectedChit(prev => prev === i ? -1 : i)
  }, [isMyTurn])

  const passChit = useCallback((chitIdx) => {
    if (chitIdx === -1) { setErrorMsg('Select a chit to pass first!'); return }
    const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
    setSelectedChit(-1); setErrorMsg('')
    sendAction({ type:'PASS', playerIdx: myIdxRef.current, chitIdx })
  }, [sendAction])

  const callShow  = useCallback(() => {
    if (!canCallShow) { setErrorMsg('You need 3 chits to call Show!'); return }
    setErrorMsg(''); sendAction({ type:'SHOW', playerIdx: myIdxRef.current, timestamp: Date.now() })
  }, [canCallShow, sendAction])

  const joinShow  = useCallback(() => {
    if (!canJoinShow) return
    sendAction({ type:'SHOW_JOIN', playerIdx: myIdxRef.current, timestamp: Date.now() })
  }, [canJoinShow, sendAction])

  const nextRound = useCallback(() => { updateMyRevealed([false,false,false]); sendAction({ type:'NEXT_ROUND' }) }, [sendAction])
  const endGame   = useCallback(() => sendAction({ type:'END_GAME' }), [sendAction])
  const playAgain = useCallback(() => { updateMyRevealed([]); sendAction({ type:'PLAY_AGAIN' }) }, [sendAction])

  const leaveRoom = useCallback(() => {
    clearCountdown(); disconnect()
    updateRoom(null); updateMyIdx(-1); setSelectedChit(-1)
    updateLogs([]); setErrorMsg(''); updateMyRevealed([])
  }, [clearCountdown, disconnect])

  return {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    createRoom, joinRoom, startGame,
    revealChit, selectChit, passChit, callShow, joinShow,
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
