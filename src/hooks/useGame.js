// show-3d/src/hooks/useGame.js
// Server-authoritative + per-room sessions + URL routing + bot UI + offline safety

import { useState, useRef, useCallback, useEffect } from 'react'
import { useWebSocket, saveSession, clearSession, loadSession, setRoomUrl, getRoomFromUrl } from './useWebSocket.js'
import { isShowHand, isSpecial, SPECIAL_CONFIG } from '../utils/game.js'
import { uid } from '../utils/helpers.js'

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
  const [specialAction,  setSpecialAction] = useState(null)
  const [initialRoomCode,setInitialRoomCode] = useState('')

  // ── Public lobby state ────────────────────────────────────
  const [publicRooms, setPublicRooms] = useState([])
  const [isPublic,    setIsPublic]    = useState(false)

  const roomRef            = useRef(null)
  const logsRef            = useRef([])
  const myIdxRef           = useRef(-1)
  const meRef              = useRef(me)
  const myRevealedRef      = useRef([])
  const countdownTimer     = useRef(null)
  const nextPlayerIdxRef   = useRef(-1)
  const autoRevealTimerRef = useRef([])

  const { connect, send, disconnect } = useWebSocket()

  const updateRoom       = r => { roomRef.current = r;       setRoom(r)  }
  const updateLogs       = l => { logsRef.current = l;       setLogs(l)  }
  const updateMyIdx      = i => { myIdxRef.current = i;      setMyIdx(i) }
  const updateMe         = m => { meRef.current = m;         setMe(m)    }
  const updateMyRevealed = r => { myRevealedRef.current = r; setMyRevealed(r) }

  // ── Derived ──────────────────────────────────────────────
  const isHost     = room?.hostId === me.id
  const myPlayer   = room?.players[myIdx]
  const isMyTurn   = room?.currentTurn === myIdx
  const turnPlayer = room?.players[room?.currentTurn]
  const showAll    = ['afterShow','roundEnd','ended'].includes(room?.phase)
  const hasJoinedShow = room?.showClicks?.some(c => c.playerIdx === myIdx) ?? false
  const canJoinShow   = room?.phase === 'showWindow' && !hasJoinedShow
  const requiredShowSets = room?.settings?.normalCount === 8 ? 2 : 1
  const canCallShow   = room?.phase === 'playing'
    && !mustPassNormal && !isStunned
    && isShowHand(myPlayer?.chits ?? [], requiredShowSets)
  const amIStunned    = room?.stunnedPlayer === myIdx

  const nextPlayerIdx = room
    ? ((room.currentTurn + room.direction + room.players.length) % room.players.length)
    : -1
  nextPlayerIdxRef.current = nextPlayerIdx

  // ── isSpecialUsableNow ───────────────────────────────────
  const isSpecialUsableNow = useCallback((special) => {
    const cfg = SPECIAL_CONFIG[special?.type]
    if (!cfg) return false
    if (cfg.timing === 'ANYTIME') return true
    return isMyTurn
  }, [isMyTurn])

  // ── isTurnNow ────────────────────────────────────────────
  const isTurnNow = () => {
    const r   = roomRef.current
    const myI = myIdxRef.current
    if (!r) return false
    return r.currentTurn === myI
  }

  // ── Auto-reveal ──────────────────────────────────────────
  const revealAllMyCardsWithAnimation = useCallback(() => {
    autoRevealTimerRef.current.forEach(clearTimeout)
    autoRevealTimerRef.current = []
    const count = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
    updateMyRevealed(Array(count).fill(true))
  }, [])

  // ── syncRevealed ─────────────────────────────────────────
  const syncRevealed = useCallback((prevCount) => {
    const newCount = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
    const cur      = myRevealedRef.current
    if (newCount > cur.length) {
      updateMyRevealed([...cur, ...Array(newCount - cur.length).fill(false)])
    } else if (newCount < cur.length) {
      updateMyRevealed(cur.slice(0, newCount))
    }
  }, [])

  // ── Countdown ────────────────────────────────────────────
  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null }
    setCountdown(0)
  }, [])

  const startCountdown = useCallback((endTs) => {
    clearCountdown()
    const tick = () => setCountdown(Math.max(0, Math.ceil((endTs - Date.now()) / 1000)))
    tick(); countdownTimer.current = setInterval(tick, 250)
  }, [clearCountdown])

  // ── Stun flash ───────────────────────────────────────────
  const triggerStunFlash = useCallback(() => {
    setStunFlash(true)
    setTimeout(() => setStunFlash(false), 600)
    const count = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
    updateMyRevealed(Array(count).fill(false))
    setIsStunned(true)
  }, [])

  // ── Super Vitals alert ───────────────────────────────────
  const fireSuperVitalsAlert = useCallback((room, playerIdx) => {
    if (room.superVitalsAlert?.ownerIdx !== myIdxRef.current) return
    const p = room.players[playerIdx]
    if (!p) return
    setSpecialAction(prev => prev ?? {
      type: 'SUPER_VITALS_RESULT',
      data: [{ name: p.name, idx: playerIdx }],
    })
  }, [])

  // ── sendAction — returns true if sent, false if offline ──
  const sendAction = useCallback((action) => {
    const r = roomRef.current
    const m = meRef.current
    if (!r?.code || !m?.id) return false
    const ok = send({ type: 'ACTION', roomCode: r.code, playerId: m.id, action })
    if (!ok) setErrorMsg('Disconnected. Reconnecting…')
    return ok
  }, [send])

  // ── toggleVisibility (host only) ─────────────────────────
  const toggleVisibility = useCallback(() => {
    const r = roomRef.current
    const m = meRef.current
    if (!r?.code || !m?.id) return
    send({ type: 'TOGGLE_VISIBILITY', roomCode: r.code, playerId: m.id })
  }, [send])

  // ── listRooms ────────────────────────────────────────────
  const listRooms = useCallback(() => {
    send({ type: 'LIST_ROOMS' })
  }, [send])

  // ── Shared STATE_SYNC side-effects ────────────────────────
  const applySyncSideEffects = useCallback((payload, logs, prevPhase, prevStunned, prevFrozen, prevAlertId, prevCount, myI) => {
    updateRoom(payload); updateLogs(logs ?? [])
    updateMyIdx(myI); setLoading(false)
    syncRevealed(prevCount)

    const np = payload.phase

    if (np === 'playing' && (prevPhase === 'roundEnd' || prevPhase === 'lobby')) {
      const count = payload.players[myI]?.chits?.length ?? 0
      updateMyRevealed(Array(count).fill(false))
      setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    }
    if (np === 'playing' && prevPhase !== 'playing') setSpecialAction(null)
    if (np === 'showWindow' && prevPhase !== 'showWindow') startCountdown(payload.showWindowEnd)
    if (prevPhase === 'showWindow' && np !== 'showWindow') clearCountdown()
    if (payload.stunnedPlayer === myI && prevStunned !== myI) triggerStunFlash()
    if (prevStunned === myI && payload.stunnedPlayer !== myI) setIsStunned(false)

    // Sync mustPassNormal from server if field is present
    if (payload.mustPassNormalPlayerIdx !== undefined) {
      setMustPassNormal(payload.mustPassNormalPlayerIdx === myI)
    }

    if (np === 'pendingSpecial') {
      const pa = payload.pendingAction
      if (pa?.userIdx === myI) {
        const excl = [pa.handOwnerIdx ?? myI]
        if (pa.type === 'FREEZE')          setSpecialAction({ type:'PICK_TARGET', actionType:'FREEZE_PICK',                 exclude:excl })
        if (pa.type === 'BLIND_SNATCH')    setSpecialAction({ type:'PICK_TARGET', actionType:'BLIND_SNATCH_PICK',           exclude:excl })
        if (pa.type === 'REVEALED_SNATCH') setSpecialAction({ type:'PICK_TARGET', actionType:'REVEALED_SNATCH_PICK_TARGET', exclude:excl })
        if (pa.type === 'STUN_GRENADE')    setSpecialAction({ type:'PICK_TARGET', actionType:'STUN_GRENADE_PICK',           exclude:excl })
        if (pa.type === 'NUKE')            setSpecialAction({ type:'PICK_TARGET', actionType:'NUKE_PICK_TARGET',            exclude:excl })
      }
    }
    if (np === 'blindSnatchPicking' && payload.pendingAction?.userIdx === myI) {
      setSpecialAction({ type:'BLIND_SNATCH_PICK_CARD', targetIdx: payload.pendingAction.targetIdx, handOwnerIdx: payload.pendingAction.handOwnerIdx ?? myI })
      setLoading(false)
    }
    if (np === 'revealedSnatchPicking' && payload.pendingAction?.userIdx === myI) {
      setSpecialAction({ type:'REVEALED_SNATCH_PICK', options: payload.pendingAction.revealedOptions, targetIdx: payload.pendingAction.targetIdx, handOwnerIdx: payload.pendingAction.handOwnerIdx ?? myI })
      setLoading(false)
    }
    if (np === 'nukePicking' && payload.pendingAction?.userIdx === myI) {
      const ti       = payload.pendingAction.targetIdx
      const specials = payload.players[ti].chits.map((c, i) => ({ c, i })).filter(({ c }) => isSpecial(c))
      setSpecialAction({ type:'NUKE_PICK_CARD', targetIdx: ti, specials })
      setLoading(false)
    }
    if (payload.frozenPlayer === myI && prevFrozen !== myI) {
      const count = payload.players[myI]?.chits?.length ?? 0
      updateMyRevealed(Array(count).fill(false))
    }
    if (payload.superVitalsAlert?.id && payload.superVitalsAlert.id !== prevAlertId) {
      fireSuperVitalsAlert(payload, payload.superVitalsAlert.matchingPlayerIdx)
    }
  }, [syncRevealed, startCountdown, clearCountdown, triggerStunFlash, fireSuperVitalsAlert])

  // ── onMessage ─────────────────────────────────────────────
  const onMessage = useCallback((data) => {
    switch (data.type) {

      case 'ROOM_CREATED': {
        saveSession(meRef.current, data.roomCode)
        setRoomUrl(data.roomCode)
        updateRoom(data.room)
        updateLogs(data.logs ?? [])
        updateMyIdx(0)
        updateMyRevealed([])
        setIsPublic(data.isPublic ?? false)
        setLoading(false)
        break
      }

      case 'JOINED_ROOM': {
        saveSession(meRef.current, data.roomCode)
        setRoomUrl(data.roomCode)
        const prevPhase   = roomRef.current?.phase
        const prevStunned = roomRef.current?.stunnedPlayer
        const prevFrozen  = roomRef.current?.frozenPlayer
        const prevAlertId = roomRef.current?.superVitalsAlert?.id
        const prevCount   = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
        const myI         = data.room.players.findIndex(p => p.id === meRef.current.id)
        setIsPublic(data.isPublic ?? false)
        applySyncSideEffects(data.room, data.logs, prevPhase, prevStunned, prevFrozen, prevAlertId, prevCount, myI)
        break
      }

      case 'STATE_SYNC': {
        const prevPhase   = roomRef.current?.phase
        const prevStunned = roomRef.current?.stunnedPlayer
        const prevFrozen  = roomRef.current?.frozenPlayer
        const prevAlertId = roomRef.current?.superVitalsAlert?.id
        const prevCount   = roomRef.current?.players[myIdxRef.current]?.chits?.length ?? 0
        const myI         = data.payload.players.findIndex(p => p.id === meRef.current.id)
        applySyncSideEffects(data.payload, data.logs, prevPhase, prevStunned, prevFrozen, prevAlertId, prevCount, myI)
        break
      }

      case 'ROOMS_LIST': {
        setPublicRooms(data.rooms ?? [])
        break
      }

      case 'VISIBILITY_CHANGED': {
        setIsPublic(data.isPublic)
        break
      }

      case 'ERROR': {
        const msg = data.message ?? 'Unknown error'
        setErrorMsg(msg)
        setLoading(false)
        // Room no longer exists after reconnect — clear stale session + URL
        if (msg.toLowerCase().includes('not found')) {
          const urlRoom = getRoomFromUrl()
          if (!roomRef.current && urlRoom) {
            clearSession(urlRoom)
            setRoomUrl(null)
          }
        }
        break
      }

      default:
        break
    }
  }, [applySyncSideEffects])

  // ── Mount: auto-resume from URL or last session ───────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const urlRoom = getRoomFromUrl()
    const session = loadSession(urlRoom || undefined)
    if (session?.me?.id && session?.roomCode) {
      updateMe(session.me)
      meRef.current = session.me
      connect(onMessage, setWsStatus, {
        type:     'JOIN_ROOM',
        roomCode: session.roomCode,
        player:   session.me,
      })
    } else if (urlRoom) {
      // URL has room code but no saved session — prefill join screen
      setInitialRoomCode(urlRoom)
    }
  }, []) // mount only

  // ── Room management ───────────────────────────────────────

  const createRoom = useCallback(async (name, isPublicRoom = false) => {
    const newMe = { id: uid(), name }
    updateMe(newMe); meRef.current = newMe
    setLoading(true)
    connect(
      onMessage,
      setWsStatus,
      { type: 'CREATE_ROOM', player: { id: newMe.id, name }, isPublic: isPublicRoom },
    )
  }, [connect, onMessage])

  const joinRoom = useCallback(async (name, code) => {
    setErrorMsg(''); setLoading(true)
    const newMe = { id: uid(), name }
    updateMe(newMe); meRef.current = newMe
    connect(
      onMessage,
      setWsStatus,
      { type: 'JOIN_ROOM', roomCode: code, player: { id: newMe.id, name } },
    )
  }, [connect, onMessage])

  // Connect just for browsing public rooms — no room join
  const connectForBrowsing = useCallback((name) => {
    const newMe = { id: uid(), name }
    updateMe(newMe); meRef.current = newMe
    connect(onMessage, setWsStatus, null)
    setTimeout(() => send({ type: 'LIST_ROOMS' }), 300)
  }, [connect, onMessage, send])

  const leaveRoom = useCallback(() => {
    clearCountdown()
    autoRevealTimerRef.current.forEach(clearTimeout)
    autoRevealTimerRef.current = []

    const r = roomRef.current
    const m = meRef.current
    if (r?.code && m?.id) {
      send({ type: 'LEAVE_ROOM', roomCode: r.code, playerId: m.id })
    }

    // Clear per-room session and URL — intentional leave
    clearSession(r?.code)
    setRoomUrl(null)

    disconnect()
    updateRoom(null); updateMyIdx(-1); setSelectedChit(-1)
    updateLogs([]); setErrorMsg(''); updateMyRevealed([])
    setSpecialAction(null); setMustPassNormal(false)
    setIsStunned(false); setStunFlash(false)
    setPublicRooms([]); setIsPublic(false)
    updateMe({ id: '', name: '' })
  }, [clearCountdown, disconnect, send])

  // ── Mode / Settings ───────────────────────────────────────
  const setMode = useCallback((mode) => sendAction({ type:'SET_MODE', mode }), [sendAction])

  const setHandSetup = useCallback((normalCount, specialCount) => {
    sendAction({ type:'SET_HAND_SETUP', normalCount, specialCount })
  }, [sendAction])

  const setEnabledSpecials = useCallback((enabledSpecials) => {
    sendAction({ type:'SET_ENABLED_SPECIALS', enabledSpecials })
  }, [sendAction])

  // ── Start ─────────────────────────────────────────────────
  const startGame = useCallback(() => {
    setLoading(true)
    const s  = room?.settings
    const nc = s?.normalCount ?? 4
    const sc = room?.mode === 'normal' ? 0 : (s?.specialCount ?? 2)
    updateMyRevealed(Array(nc + sc).fill(false))
    setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    sendAction({ type:'START' })
  }, [sendAction, room])

  // ── Reveal ────────────────────────────────────────────────
  const revealChit = useCallback((i) => {
    if (isStunned || amIStunned) return
    if (!['playing','pendingSpecial','revealedSnatchPicking','nukePicking'].includes(roomRef.current?.phase)) return
    if (!myRevealedRef.current[i]) revealAllMyCardsWithAnimation()
  }, [isStunned, amIStunned, revealAllMyCardsWithAnimation])

  // ── Chit click ────────────────────────────────────────────
  const onChitClick = useCallback((i) => {
    const r     = roomRef.current
    const chits = r?.players[myIdxRef.current]?.chits ?? []
    const chit  = chits[i]
    if (!chit) return

    if (amIStunned || isStunned) {
      if (r?.phase === 'playing' && isMyTurn) setSelectedChit(prev => prev === i ? -1 : i)
      return
    }

    if (!myRevealedRef.current[i]) { revealAllMyCardsWithAnimation(); return }

    const isAnytime = isSpecial(chit) && SPECIAL_CONFIG[chit.type]?.timing === 'ANYTIME'
    const canAct    = isMyTurn || isAnytime

    if (isSpecial(chit) && canAct && r?.phase === 'playing' && !mustPassNormal) {
      setSpecialAction({ type:'USE_OR_PASS', chitIdx:i, special:chit })
      setSelectedChit(i)
      return
    }
    if (r?.phase === 'playing' && (isMyTurn || mustPassNormal)) {
      setSelectedChit(prev => prev === i ? -1 : i)
    }
  }, [isMyTurn, mustPassNormal, revealAllMyCardsWithAnimation, amIStunned, isStunned])

  // ── Pass ──────────────────────────────────────────────────
  const passChit = useCallback((chitIdx) => {
    if (chitIdx === -1) { setErrorMsg('Select a chit to pass!'); return }
    const pidx = myIdxRef.current
    const ok   = sendAction({ type:'PASS', actorIdx: pidx, handOwnerIdx: pidx, playerIdx: pidx, chitIdx })
    if (!ok) return

    const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
    setSelectedChit(-1); setErrorMsg(''); setSpecialAction(null)
    if (mustPassNormal) setMustPassNormal(false)
    if (amIStunned || isStunned) setIsStunned(false)
  }, [sendAction, mustPassNormal, amIStunned, isStunned])

  // ── Use special ───────────────────────────────────────────
  const useSpecial = useCallback((chitIdx, special) => {
    setSelectedChit(-1)
    const pidx = myIdxRef.current
    const base = { actorIdx: pidx, handOwnerIdx: pidx, playerIdx: pidx, chitIdx }
    const setMustPassIfTurn = () => { if (isTurnNow()) setMustPassNormal(true) }

    const actionMap = {
      REVERSE: () => {
        const ok = sendAction({ type:'USE_REVERSE', ...base })
        if (!ok) return
        const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
        setMustPassNormal(true); setSpecialAction(null)
      },
      FREEZE: () => {
        const ok = sendAction({ type:'USE_FREEZE', ...base })
        if (!ok) return
        const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
        setSpecialAction({ type:'PICK_TARGET', actionType:'FREEZE_PICK', exclude:[pidx] })
      },
      BLIND_SNATCH: () => {
        const ok = sendAction({ type:'USE_BLIND_SNATCH', ...base })
        if (!ok) return
        const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
        setSpecialAction({ type:'PICK_TARGET', actionType:'BLIND_SNATCH_PICK', exclude:[pidx] })
      },
      REVEALED_SNATCH: () => {
        const ok = sendAction({ type:'USE_REVEALED_SNATCH', ...base })
        if (!ok) return
        const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
        setSpecialAction({ type:'PICK_TARGET', actionType:'REVEALED_SNATCH_PICK_TARGET', exclude:[pidx] })
      },
      STUN_GRENADE: () => {
        const ok = sendAction({ type:'USE_STUN_GRENADE', ...base })
        if (!ok) return
        const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
        setSpecialAction({ type:'PICK_TARGET', actionType:'STUN_GRENADE_PICK', exclude:[pidx] })
      },
      NUKE: () => {
        const ok = sendAction({ type:'USE_NUKE', ...base })
        if (!ok) return
        const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
        setSpecialAction({ type:'PICK_TARGET', actionType:'NUKE_PICK_TARGET', exclude:[pidx] })
      },
      VITALS: () => {
        const r = roomRef.current
        const ok = sendAction({ type:'USE_VITALS', ...base })
        if (!ok) return
        const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
        setSpecialAction({ type:'VITALS_RESULT', data: computeVitals(r.players, myIdxRef.current) })
        setMustPassIfTurn()
      },
      SUPER_VITALS: () => {
        const r       = roomRef.current
        const reqSets = r.settings?.normalCount === 8 ? 2 : 1
        const ok = sendAction({ type:'USE_SUPER_VITALS', ...base })
        if (!ok) return
        const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
        setSpecialAction({ type:'SUPER_VITALS_RESULT', data: computeSuperVitals(r.players, myIdxRef.current, reqSets) })
        setMustPassIfTurn()
      },
    }
    actionMap[special.type]?.()
  }, [sendAction])

  // ── Generic target pick ───────────────────────────────────
  const pickTarget = useCallback((targetIdx, actionType) => {
    const actionMap = {
      'BLIND_SNATCH_PICK': () => {
        const ok = sendAction({ type:'BLIND_SNATCH_PICK', targetIdx })
        if (ok) { setLoading(true); setSpecialAction(null) }
      },
      'REVEALED_SNATCH_PICK_TARGET': () => {
        const ok = sendAction({ type:'REVEALED_SNATCH_PICK_TARGET', targetIdx })
        if (ok) { setLoading(true); setSpecialAction(null) }
      },
      'FREEZE_PICK': () => {
        const ok = sendAction({ type:'FREEZE_PICK', targetIdx })
        if (ok) { setSpecialAction(null); if (isTurnNow()) setMustPassNormal(true) }
      },
      'STUN_GRENADE_PICK': () => {
        const ok = sendAction({ type:'STUN_GRENADE_PICK', targetIdx })
        if (ok) { setSpecialAction(null); if (isTurnNow()) setMustPassNormal(true) }
      },
      'NUKE_PICK_TARGET': () => {
        const ok = sendAction({ type:'NUKE_PICK_TARGET', targetIdx })
        if (ok) { setLoading(true); setSpecialAction(null) }
      },
    }
    actionMap[actionType]?.()
  }, [sendAction])

  const blindSnatchPickCard = useCallback((targetCardIdx, ownCardIdx) => {
    const ok = sendAction({ type:'BLIND_SNATCH_PICK_CARD', targetCardIdx, ownCardIdx })
    if (ok) { setSpecialAction(null); setMustPassNormal(true) }
  }, [sendAction])

  const revealedSnatchPick = useCallback((targetCardIdx, ownCardIdx) => {
    const ok = sendAction({ type:'REVEALED_SNATCH_PICK_CHIT', targetCardIdx, ownCardIdx })
    if (ok) { setSpecialAction(null); setMustPassNormal(true) }
  }, [sendAction])

  const nukePickCard = useCallback((chitIdx) => {
    const ok = sendAction({ type:'NUKE_PICK_CARD', chitIdx })
    if (ok) { setSpecialAction(null); if (isTurnNow()) setMustPassNormal(true) }
  }, [sendAction])

  const cancelSpecial = useCallback(() => { setSpecialAction(null); setSelectedChit(-1) }, [])
  const dismissVitals = useCallback(() => setSpecialAction(null), [])

  const callShow = useCallback(() => {
    if (!canCallShow) { setErrorMsg("Your 4 normals don't all match!"); return }
    setErrorMsg('')
    sendAction({ type:'SHOW', playerIdx: myIdxRef.current, timestamp: Date.now() })
  }, [canCallShow, sendAction])

  const joinShow = useCallback(() => {
    if (!canJoinShow) return
    sendAction({ type:'SHOW_JOIN', playerIdx: myIdxRef.current, timestamp: Date.now() })
  }, [canJoinShow, sendAction])

  const nextRound = useCallback(() => {
    const r  = roomRef.current; const s = r?.settings
    const nc = s?.normalCount ?? 4; const sc = r?.mode === 'normal' ? 0 : (s?.specialCount ?? 2)
    const ok = sendAction({ type:'NEXT_ROUND' })
    if (ok) {
      updateMyRevealed(Array(nc + sc).fill(false))
      setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    }
  }, [sendAction])

  const endGame   = useCallback(() => sendAction({ type:'END_GAME' }), [sendAction])

  const playAgain = useCallback(() => {
    const ok = sendAction({ type:'PLAY_AGAIN' })
    if (ok) {
      updateMyRevealed([]); setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    }
  }, [sendAction])

  // ── Bot management ────────────────────────────────────────
  // These are lobby-only actions — sent as top-level WS messages (not ACTION).
  const addBot = useCallback(() => {
    const r = roomRef.current; const m = meRef.current
    if (!r?.code || !m?.id) return
    const ok = send({ type: 'ADD_BOT', roomCode: r.code, playerId: m.id })
    if (!ok) setErrorMsg('Disconnected. Reconnecting…')
  }, [send])

  const removeBot = useCallback((targetIdx) => {
    const r = roomRef.current; const m = meRef.current
    if (!r?.code || !m?.id) return
    const ok = send({ type: 'REMOVE_BOT', roomCode: r.code, playerId: m.id, targetIdx })
    if (!ok) setErrorMsg('Disconnected. Reconnecting…')
  }, [send])

  return {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    specialAction, mustPassNormal, stunFlash, isStunned, amIStunned,
    isSpecialUsableNow,
    initialRoomCode,
    // Public lobby
    publicRooms, isPublic, toggleVisibility, listRooms, connectForBrowsing,
    createRoom, joinRoom, startGame, setMode, setHandSetup, setEnabledSpecials,
    revealChit, onChitClick, passChit, useSpecial, cancelSpecial,
    pickTarget, blindSnatchPickCard, revealedSnatchPick, nukePickCard, dismissVitals,
    callShow, joinShow,
    nextRound, endGame, playAgain, leaveRoom,
    addBot, removeBot,
  }
}

// ── Vitals helpers ─────────────────────────────────────────────────
function computeVitals(players, myI) {
  return players.map((p, i) => {
    if (i === myI) return null
    const normals = p.chits.filter(c => !isSpecial(c))
    if (!normals.length) return { name:p.name, idx:i, level:'unknown', desc:'No normals' }
    const counts  = {}
    normals.forEach(c => { counts[c.symbol] = (counts[c.symbol]||0)+1 })
    const maxSame = Math.max(...Object.values(counts))
    const pct     = maxSame / normals.length
    const level   = pct>=1?'SHOW!':pct>=.75?'danger':pct>=.5?'high':pct>=.25?'medium':'low'
    const desc    = pct>=1?'All 4 match!':pct>=.75?'3 of 4 match — very dangerous!':pct>=.5?'2 of 4 match':pct>=.25?'Warming up':'Unlikely to show soon'
    return { name:p.name, idx:i, level, desc, maxSame, total:normals.length }
  }).filter(Boolean)
}

function computeSuperVitals(players, myI, requiredSets = 1) {
  return players.map((p, i) => {
    if (i === myI) return null
    return isShowHand(p.chits, requiredSets) ? { name:p.name, idx:i } : null
  }).filter(Boolean)
}