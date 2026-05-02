// show-3d/src/hooks/useGame.js
// Server-authoritative + public/private rooms + localStorage reconnect

import { useState, useRef, useCallback } from 'react'
import { useWebSocket, saveSession, clearSession, loadSession } from './useWebSocket.js'
import { isShowHand, isSpecial, SPECIAL_CONFIG } from '../utils/game.js'
import { uid } from '../utils/helpers.js'

export function useGame() {
  const [me,             setMe]            = useState(() => {
    // On mount — restore me from localStorage if session exists
    const session = loadSession()
    return session?.me ?? { id: '', name: '' }
  })
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
  const [vitalsResult,   setVitalsResult]  = useState(null)
  const [specialAction,  setSpecialAction] = useState(null)

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
  const isHost        = room?.hostId === me.id
  const myPlayer      = room?.players[myIdx]
  const myPuppetInfo  = room?.puppeteerInfo
  const amIPuppeteer  = myPuppetInfo?.puppeteerIdx === myIdx && myPuppetInfo?.active === true
  const amIPuppeted   = myPuppetInfo?.targetIdx === myIdx    && myPuppetInfo?.active === true
  const puppetTarget  = amIPuppeteer ? room?.players[myPuppetInfo.targetIdx] : null
  const actingIdx     = amIPuppeteer ? myPuppetInfo.targetIdx : myIdx
  const actingPlayer  = room?.players[actingIdx]
  const isMyTurn      = room?.currentTurn === myIdx || (amIPuppeteer && room?.currentTurn === myPuppetInfo.targetIdx)
  const turnPlayer    = room?.players[room?.currentTurn]
  const showAll       = ['afterShow','roundEnd','ended'].includes(room?.phase)
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
    if (r.currentTurn === myI) return true
    return !!(r.effects?.find(e => e.type === 'PUPPETEER' && e.ownerIdx === myI && e.targetIdx === r.currentTurn))
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

  // ── sendAction ───────────────────────────────────────────
  const sendAction = useCallback((action) => {
    const r = roomRef.current
    const m = meRef.current
    if (!r?.code || !m?.id) return
    send({ type: 'ACTION', roomCode: r.code, playerId: m.id, action })
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

    if (np === 'pendingSpecial') {
      const pa = payload.pendingAction
      if (pa?.userIdx === myI) {
        const excl    = [pa.handOwnerIdx ?? myI]
        const nextIdx = (payload.currentTurn + payload.direction + payload.players.length) % payload.players.length
        if (pa.type === 'FREEZE')          setSpecialAction({ type:'PICK_TARGET', actionType:'FREEZE_PICK',                 exclude:excl })
        if (pa.type === 'BLIND_SNATCH')    setSpecialAction({ type:'PICK_TARGET', actionType:'BLIND_SNATCH_PICK',           exclude:excl })
        if (pa.type === 'REVEALED_SNATCH') setSpecialAction({ type:'PICK_TARGET', actionType:'REVEALED_SNATCH_PICK_TARGET', exclude:excl })
        if (pa.type === 'STUN_GRENADE')    setSpecialAction({ type:'PICK_TARGET', actionType:'STUN_GRENADE_PICK',           exclude:excl })
        if (pa.type === 'NUKE')            setSpecialAction({ type:'PICK_TARGET', actionType:'NUKE_PICK_TARGET',            exclude:excl })
        if (pa.type === 'PUPPETEER')       setSpecialAction({ type:'PICK_TARGET', actionType:'PUPPETEER_PICK',              exclude:[...excl, nextIdx] })
        if (pa.type === 'POSITION_SWAP')   setSpecialAction({ type:'PICK_TARGET', actionType:'POSITION_SWAP_PICK',          exclude:excl })
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
        // Save session so we can rejoin after disconnect
        saveSession(meRef.current, data.roomCode)
        updateRoom(data.room)
        updateLogs(data.logs ?? [])
        updateMyIdx(0)
        updateMyRevealed([])
        setIsPublic(data.isPublic ?? false)
        setLoading(false)
        break
      }

      case 'JOINED_ROOM': {
        // Save/update session on every successful join (including auto-rejoin)
        saveSession(meRef.current, data.roomCode)
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
        setErrorMsg(data.message ?? 'Unknown error')
        setLoading(false)
        break
      }

      default:
        break
    }
  }, [applySyncSideEffects])

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
    // Session saved in ROOM_CREATED handler when we get the roomCode back
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
    // Session saved in JOINED_ROOM handler
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

    // Clear localStorage — intentional leave, don't rejoin
    clearSession()

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
  const onChitClick = useCallback((i, forActingPlayer = false) => {
    const r     = roomRef.current
    const pidx  = forActingPlayer ? r?.puppeteerInfo?.targetIdx : myIdxRef.current
    const chits = r?.players[pidx]?.chits ?? []
    const chit  = chits[i]
    if (!chit) return

    const myRev = forActingPlayer ? Array(chits.length).fill(true) : myRevealedRef.current

    if (!forActingPlayer && (amIStunned || isStunned)) {
      if (r?.phase === 'playing' && isMyTurn) setSelectedChit(prev => prev === i ? -1 : i)
      return
    }

    if (!forActingPlayer && !myRev[i]) { revealAllMyCardsWithAnimation(); return }

    const isAnytime     = isSpecial(chit) && SPECIAL_CONFIG[chit.type]?.timing === 'ANYTIME'
    const canActSpecial = forActingPlayer ? true : (isMyTurn || isAnytime)

    if (isSpecial(chit) && canActSpecial && r?.phase === 'playing' && !mustPassNormal) {
      setSpecialAction({ type:'USE_OR_PASS', chitIdx:i, special:chit, forActing:forActingPlayer })
      setSelectedChit(i)
      return
    }
    if (r?.phase === 'playing' && (isMyTurn || mustPassNormal)) {
      setSelectedChit(prev => prev === i ? -1 : i)
    }
  }, [isMyTurn, mustPassNormal, revealAllMyCardsWithAnimation, amIStunned, isStunned])

  // ── Pass ──────────────────────────────────────────────────
  const passChit = useCallback((chitIdx, forActingPlayer = false) => {
    if (chitIdx === -1) { setErrorMsg('Select a chit to pass!'); return }
    const pidx     = forActingPlayer ? roomRef.current?.puppeteerInfo?.targetIdx : myIdxRef.current
    const actorIdx = myIdxRef.current
    if (!forActingPlayer) {
      const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
    }
    setSelectedChit(-1); setErrorMsg(''); setSpecialAction(null)
    if (mustPassNormal) setMustPassNormal(false)
    if (amIStunned || isStunned) setIsStunned(false)
    sendAction({ type:'PASS', actorIdx, handOwnerIdx: pidx, playerIdx: pidx, chitIdx })
  }, [sendAction, mustPassNormal, amIStunned, isStunned])

  // ── Use special ───────────────────────────────────────────
  const useSpecial = useCallback((chitIdx, special, forActing = false) => {
    setSelectedChit(-1)
    if (!forActing) {
      const rev = [...myRevealedRef.current]; rev.splice(chitIdx, 1); updateMyRevealed(rev)
    }
    const pidx        = forActing ? roomRef.current?.puppeteerInfo?.targetIdx : myIdxRef.current
    const actorIdx    = myIdxRef.current
    const handOwnerIdx = pidx
    const setMustPassIfTurn = () => { if (isTurnNow()) setMustPassNormal(true) }
    const base = { actorIdx, handOwnerIdx, playerIdx: handOwnerIdx, chitIdx }

    const actionMap = {
      REVERSE:        () => { sendAction({ type:'USE_REVERSE',        ...base }); setMustPassNormal(true); setSpecialAction(null) },
      FREEZE:         () => { sendAction({ type:'USE_FREEZE',         ...base }); setSpecialAction({ type:'PICK_TARGET', actionType:'FREEZE_PICK',                 exclude:[handOwnerIdx] }) },
      BLIND_SNATCH:   () => { sendAction({ type:'USE_BLIND_SNATCH',   ...base }); setSpecialAction({ type:'PICK_TARGET', actionType:'BLIND_SNATCH_PICK',           exclude:[handOwnerIdx] }) },
      REVEALED_SNATCH:() => { sendAction({ type:'USE_REVEALED_SNATCH',...base }); setSpecialAction({ type:'PICK_TARGET', actionType:'REVEALED_SNATCH_PICK_TARGET', exclude:[handOwnerIdx] }) },
      STUN_GRENADE:   () => { sendAction({ type:'USE_STUN_GRENADE',   ...base }); setSpecialAction({ type:'PICK_TARGET', actionType:'STUN_GRENADE_PICK',           exclude:[handOwnerIdx] }) },
      NUKE:           () => { sendAction({ type:'USE_NUKE',           ...base }); setSpecialAction({ type:'PICK_TARGET', actionType:'NUKE_PICK_TARGET',            exclude:[handOwnerIdx] }) },
      PUPPETEER:      () => { sendAction({ type:'USE_PUPPETEER',      ...base }); setSpecialAction({ type:'PICK_TARGET', actionType:'PUPPETEER_PICK',              exclude:[handOwnerIdx, nextPlayerIdxRef.current] }) },
      POSITION_SWAP:  () => { sendAction({ type:'USE_POSITION_SWAP',  ...base }); setSpecialAction({ type:'PICK_TARGET', actionType:'POSITION_SWAP_PICK',          exclude:[handOwnerIdx] }) },
      VITALS: () => {
        const r = roomRef.current
        setSpecialAction({ type:'VITALS_RESULT', data: computeVitals(r.players, myIdxRef.current) })
        sendAction({ type:'USE_VITALS', ...base }); setMustPassIfTurn()
      },
      SUPER_VITALS: () => {
        const r       = roomRef.current
        const reqSets = r.settings?.normalCount === 8 ? 2 : 1
        setSpecialAction({ type:'SUPER_VITALS_RESULT', data: computeSuperVitals(r.players, myIdxRef.current, reqSets) })
        sendAction({ type:'USE_SUPER_VITALS', ...base }); setMustPassIfTurn()
      },
    }
    actionMap[special.type]?.()
  }, [sendAction])

  // ── Generic target pick ───────────────────────────────────
  const pickTarget = useCallback((targetIdx, actionType) => {
    setSpecialAction(null)
    const actionMap = {
      'BLIND_SNATCH_PICK':           () => { setLoading(true); sendAction({ type:'BLIND_SNATCH_PICK',          targetIdx }) },
      'REVEALED_SNATCH_PICK_TARGET': () => { setLoading(true); sendAction({ type:'REVEALED_SNATCH_PICK_TARGET',targetIdx }) },
      'FREEZE_PICK':                 () => { sendAction({ type:'FREEZE_PICK',           targetIdx }); if (isTurnNow()) setMustPassNormal(true) },
      'STUN_GRENADE_PICK':           () => { sendAction({ type:'STUN_GRENADE_PICK',     targetIdx }); if (isTurnNow()) setMustPassNormal(true) },
      'NUKE_PICK_TARGET':            () => { setLoading(true); sendAction({ type:'NUKE_PICK_TARGET', targetIdx }) },
      'PUPPETEER_PICK':              () => sendAction({ type:'PUPPETEER_PICK',           targetIdx }),
      'POSITION_SWAP_PICK':          () => { sendAction({ type:'POSITION_SWAP_PICK',    targetIdx }); setMustPassNormal(true) },
    }
    actionMap[actionType]?.()
  }, [sendAction])

  const blindSnatchPickCard = useCallback((targetCardIdx, ownCardIdx) => {
    setSpecialAction(null); sendAction({ type:'BLIND_SNATCH_PICK_CARD', targetCardIdx, ownCardIdx }); setMustPassNormal(true)
  }, [sendAction])

  const revealedSnatchPick = useCallback((targetCardIdx, ownCardIdx) => {
    setSpecialAction(null); sendAction({ type:'REVEALED_SNATCH_PICK_CHIT', targetCardIdx, ownCardIdx }); setMustPassNormal(true)
  }, [sendAction])

  const nukePickCard = useCallback((chitIdx) => {
    setSpecialAction(null); sendAction({ type:'NUKE_PICK_CARD', chitIdx })
    if (isTurnNow()) setMustPassNormal(true)
  }, [sendAction])

  const cancelSpecial = useCallback(() => { setSpecialAction(null); setSelectedChit(-1) }, [])
  const dismissVitals = useCallback(() => setSpecialAction(null), [])

  const consumeVitals = useCallback((chitIdx, type) => {
    sendAction({ type: type === 'VITALS' ? 'USE_VITALS' : 'USE_SUPER_VITALS', playerIdx: myIdxRef.current, chitIdx })
    setMustPassNormal(true)
  }, [sendAction])

  const callShow = useCallback(() => {
    if (!canCallShow) { setErrorMsg("Your 4 normals don't all match!"); return }
    setErrorMsg(''); sendAction({ type:'SHOW', playerIdx: myIdxRef.current, timestamp: Date.now() })
  }, [canCallShow, sendAction])

  const joinShow = useCallback(() => {
    if (!canJoinShow) return
    sendAction({ type:'SHOW_JOIN', playerIdx: myIdxRef.current, timestamp: Date.now() })
  }, [canJoinShow, sendAction])

  const nextRound = useCallback(() => {
    const r = roomRef.current; const s = r?.settings
    const nc = s?.normalCount ?? 4; const sc = r?.mode === 'normal' ? 0 : (s?.specialCount ?? 2)
    updateMyRevealed(Array(nc + sc).fill(false))
    setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    sendAction({ type:'NEXT_ROUND' })
  }, [sendAction])

  const endGame   = useCallback(() => sendAction({ type:'END_GAME' }), [sendAction])

  const playAgain = useCallback(() => {
    updateMyRevealed([]); setMustPassNormal(false); setSpecialAction(null); setIsStunned(false)
    sendAction({ type:'PLAY_AGAIN' })
  }, [sendAction])

  return {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    specialAction, mustPassNormal, stunFlash, isStunned, amIStunned,
    amIPuppeteer, amIPuppeted, puppetTarget, actingIdx, actingPlayer,
    isSpecialUsableNow,
    // Public lobby
    publicRooms, isPublic, toggleVisibility, listRooms, connectForBrowsing,
    createRoom, joinRoom, startGame, setMode, setHandSetup, setEnabledSpecials,
    revealChit, onChitClick, passChit, useSpecial, cancelSpecial,
    pickTarget, blindSnatchPickCard, revealedSnatchPick, nukePickCard, dismissVitals, consumeVitals,
    callShow, joinShow,
    nextRound, endGame, playAgain, leaveRoom,
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