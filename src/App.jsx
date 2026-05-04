import { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from './hooks/useGame.js'
import {
  WsStatus, HandHud, PlayerSeat, GameLog,
  StatusPill, ShowWindowOverlay, RoundEndControls, EndScreen,
  LoadingOverlay, RoundResultModal,
} from './components/UI.jsx'
import { SpecialModalManager } from './components/SpecialModals.jsx'
import {
  LandingPage, CreateJoinScreen, JoinScreen, LobbyScreen, PublicLobbyScreen,
} from './components/Screens.jsx'
import { InGameMenu, ConfirmModal, HowToPlayModal } from './components/ingamemenu.jsx'
import {
  initAudio, playSound, getSoundEnabled, setSoundEnabled,
  getAmbienceEnabled, setAmbienceEnabled,
  playAmbience, stopAmbience, chooseGameLoop, resetGameLoop,
  withButtonSound,
} from './utils/sounds.js'

const GAME_PHASES = [
  'playing','showWindow','afterShow','roundEnd',
  'pendingSpecial','blindSnatchPicking','revealedSnatchPicking','nukePicking',
]

// ── Path helpers (mirrors useWebSocket.js, no import needed here) ──
function getRoomCodeFromPath() {
  const m = window.location.pathname.match(/^\/room\/([^/]+)/)
  return m ? m[1].toUpperCase() : null
}

// ── Derive initial screen from current URL ─────────────────────
function getInitialScreen() {
  const path = window.location.pathname
  if (path === '/join') return 'createjoin'
  if (getRoomCodeFromPath()) return 'room-loading' // resolved after mount
  return 'landing'
}

export default function App() {
  const [screen,     setScreen]     = useState(getInitialScreen)
  const [playerName, setPlayerName] = useState('')
  const canvasRef = useRef(null)

  // ── Sound state ─────────────────────────────────────────────
  const [soundOn,    setSoundOn]    = useState(() => getSoundEnabled())
  const [ambienceOn, setAmbienceOn] = useState(() => getAmbienceEnabled())

  useEffect(() => { initAudio() }, [])

  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
  }

  function toggleAmbience() {
    const next = !ambienceOn
    setAmbienceOn(next)
    setAmbienceEnabled(next)
  }

  // ── In-game menu / modal state ──────────────────────────────
  const [menuOpen,        setMenuOpen]        = useState(false)
  const [showHowToPlay,   setShowHowToPlay]   = useState(false)
  const [leaveConfirm,    setLeaveConfirm]    = useState(false)
  const [restartConfirm,  setRestartConfirm]  = useState(false)

  // Track screen in ref for use inside event listeners
  const screenRef = useRef(screen)
  useEffect(() => { screenRef.current = screen }, [screen])

  // Ensure we never push duplicate sentinel entries
  const sentinelPushedRef = useRef(false)

  const {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    specialAction, mustPassNormal, stunFlash, isStunned, amIStunned,
    initialRoomCode,
    // Public/private
    publicRooms, isPublic, toggleVisibility, listRooms, connectForBrowsing,
    createRoom, joinRoom, startGame, setMode, setHandSetup, setEnabledSpecials,
    revealChit, onChitClick, passChit, useSpecial, cancelSpecial,
    pickTarget, revealedSnatchPick, nukePickCard, dismissVitals, blindSnatchPickCard,
    callShow, joinShow,
    nextRound, endGame, playAgain, leaveRoom,
    addBot, removeBot,
  } = useGame()

  const phase = room?.phase

  // ── Ambience by screen / phase ────────────────────────────
  useEffect(() => {
    const lobbyScreens = ['landing', 'room-loading', 'createjoin', 'join', 'browse', 'lobby']
    const resultPhases = ['afterShow', 'roundEnd', 'ended']
    const gameActivePhases = [
      'playing','showWindow','pendingSpecial',
      'blindSnatchPicking','revealedSnatchPicking','nukePicking',
    ]

    if (lobbyScreens.includes(screen)) {
      playAmbience('lobby')
      resetGameLoop()
    } else if (screen === 'end') {
      playAmbience('result')
    } else if (screen === 'game') {
      if (phase && resultPhases.includes(phase)) {
        playAmbience('result')
      } else if (phase && gameActivePhases.includes(phase)) {
        playAmbience(chooseGameLoop())
      }
    }
  }, [screen, phase])

  // ── Inject SPA history on first load at /room/:code ────────
  // If the user opened /room/XYZ directly, browser history has no /
  // as a prior entry. We fix this once by replacing + re-pushing.
  useEffect(() => {
    const roomCode = getRoomCodeFromPath()
    if (!roomCode) return
    // Only inject if there's no app marker in current history state
    if (window.history.state?.showAppEntry) return

    // 1. Replace current entry with home
    window.history.replaceState(
      { showScreen: 'home', showAppEntry: true },
      '',
      '/',
    )
    // 2. Push the room entry back
    window.history.pushState(
      { showScreen: 'room', roomCode, showRoomEntry: true },
      '',
      `/room/${roomCode}`,
    )
  }, []) // mount only

  // ── Screen routing from server phase ─────────────────────────
  useEffect(() => {
    if (!phase) return
    if (phase === 'lobby') setScreen('lobby')
    if (GAME_PHASES.includes(phase)) setScreen('game')
    if (phase === 'ended') setScreen('end')
  }, [phase])

  // ── When initialRoomCode is set (no session, direct link) ────
  useEffect(() => {
    if (initialRoomCode && (screen === 'landing' || screen === 'room-loading')) {
      setScreen('join')
    }
  }, [initialRoomCode, screen])

  // ── If room-loading screen never resolved (no session, no code) ─
  useEffect(() => {
    if (screen === 'room-loading' && !initialRoomCode && !room) {
      // Give the mount effect a tick to set initialRoomCode
      const t = setTimeout(() => {
        if (screenRef.current === 'room-loading') setScreen('landing')
      }, 500)
      return () => clearTimeout(t)
    }
  }, [screen, initialRoomCode, room])

  // ── Push sentinel when entering game/lobby ──────────────────
  useEffect(() => {
    if (screen === 'game' || screen === 'lobby') {
      if (!sentinelPushedRef.current) {
        window.history.pushState({ show_sentinel: true }, '')
        sentinelPushedRef.current = true
      }
    } else {
      sentinelPushedRef.current = false
    }
  }, [screen])

  // ── popstate: intercept back in game/lobby ──────────────────
  useEffect(() => {
    function handlePopState(e) {
      const s = screenRef.current

      // If we're in game or lobby, block navigation and confirm
      if (s === 'game' || s === 'lobby') {
        // Re-push sentinel so next back press also triggers this
        window.history.pushState({ show_sentinel: true }, '')
        setLeaveConfirm(true)
        return
      }

      // For other screens, let the path decide which screen to show
      const path = window.location.pathname
      if (path === '/' || path === '') {
        setScreen('landing')
      } else if (path === '/join') {
        setScreen('createjoin')
      } else if (getRoomCodeFromPath()) {
        // Navigated back/forward to a room URL — handled by room load
        // If we have no room, treat as landing
        if (!roomRef.current) setScreen('landing')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Keep a ref to room for use in popstate (avoids stale closure)
  const roomRef = useRef(room)
  useEffect(() => { roomRef.current = room }, [room])

  // ── Navigation helpers ────────────────────────────────────────
  function goHome() {
    leaveRoom()
    setScreen('landing')
    setMenuOpen(false)
    setLeaveConfirm(false)
    sentinelPushedRef.current = false
    // leaveRoom() calls navigateHome() internally
  }

  function confirmLeaveRoom() {
    setLeaveConfirm(true)
    setMenuOpen(false)
  }

  function onPlay(name) {
    playSound('button')
    setPlayerName(name)
    setScreen('createjoin')
    window.history.pushState({ showScreen: 'createjoin' }, '', '/join')
  }

  async function onCreate() {
    playSound('loadingStart')
    await createRoom(playerName, false)
    // navigateToRoom called inside useGame on ROOM_CREATED
  }

  async function onCreatePublic() {
    playSound('loadingStart')
    await createRoom(playerName, true)
  }

  function onBrowse() {
    playSound('button')
    connectForBrowsing(playerName)
    setScreen('browse')
  }

  function onGoJoin() { playSound('button'); setScreen('join') }

  async function onJoin(code, nameOverride, done) {
    playSound('loadingStart')
    const effectiveName = nameOverride ?? playerName
    if (!effectiveName) { done?.(); return }
    if (nameOverride) setPlayerName(nameOverride)
    try { await joinRoom(effectiveName, code) }
    catch {} finally { done?.() }
    // navigateToRoom called inside useGame on JOINED_ROOM
  }

  function onLeave() {
    playSound('button')
    leaveRoom()
    setScreen('landing')
    sentinelPushedRef.current = false
  }

  function onBack() {
    const prev = screen === 'join' ? 'createjoin' : 'landing'
    setScreen(prev)
    if (prev === 'landing') {
      window.history.pushState({ showScreen: 'home' }, '', '/')
    }
  }

  // ── Host restart ──────────────────────────────────────────────
  function handleMenuRestart() {
    playSound('button')
    setRestartConfirm(true)
    setMenuOpen(false)
  }

  function confirmRestart() {
    playSound('button')
    playAgain()
    setRestartConfirm(false)
  }

  // ── Host end game from menu ───────────────────────────────────
  function handleMenuEndGame() {
    playSound('button')
    endGame()
    setMenuOpen(false)
  }

  const inGame = screen === 'game'

  return (
    <>
      <canvas ref={canvasRef} id="three-canvas" style={{ display:'none' }} />

      {stunFlash && <div className="stun-flash" />}

      {loading && <LoadingOverlay message={
        screen === 'join'         ? 'Joining room…'
        : screen === 'lobby'      ? 'Starting game…'
        : screen === 'browse'     ? 'Loading rooms…'
        : screen === 'room-loading' ? 'Loading room…'
        : 'Please wait…'
      } />}

      {/* Leave room confirmation — triggered by browser back or menu */}
      {leaveConfirm && (
        <ConfirmModal
          title="Leave game?"
          message="You'll be removed from the room. Your progress will be lost."
          confirmLabel="Leave Room"
          cancelLabel="Stay"
          onConfirm={goHome}
          onCancel={() => setLeaveConfirm(false)}
          danger
        />
      )}

      {/* Host restart confirmation */}
      {restartConfirm && (
        <ConfirmModal
          title="Restart game?"
          message="This will restart the game for everyone in the room."
          confirmLabel="Restart"
          cancelLabel="Cancel"
          onConfirm={confirmRestart}
          onCancel={() => setRestartConfirm(false)}
        />
      )}

      {/* How to play modal */}
      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}

      <div id="ui-root">

        {(screen === 'landing' || screen === 'room-loading') && <LandingPage onPlay={onPlay} />}

        {screen === 'createjoin' && (
          <CreateJoinScreen
            name={playerName}
            onCreate={onCreate}
            onCreatePublic={onCreatePublic}
            onGoJoin={onGoJoin}
            onBrowse={onBrowse}
            onBack={() => {
              setScreen('landing')
              window.history.pushState({ showScreen: 'home' }, '', '/')
            }}
          />
        )}

        {screen === 'join' && (
          <JoinScreen
            name={playerName}
            onJoin={onJoin}
            onBack={onBack}
            errorMsg={errorMsg}
            initialCode={initialRoomCode}
          />
        )}

        {screen === 'browse' && (
          <PublicLobbyScreen
            name={playerName}
            publicRooms={publicRooms}
            onJoin={(code) => onJoin(code, undefined, () => {})}
            onRefresh={listRooms}
            onBack={() => setScreen('createjoin')}
            loading={loading}
          />
        )}

        {screen === 'lobby' && room && (
          <LobbyScreen
            room={room} me={me} isHost={isHost} wsStatus={wsStatus}
            onStart={() => { playSound('loadingStart'); startGame() }} onLeave={onLeave} onSetMode={setMode}
            setHandSetup={setHandSetup} setEnabledSpecials={setEnabledSpecials}
            isPublic={isPublic}
            onToggleVisibility={withButtonSound(toggleVisibility)}
            onAddBot={withButtonSound(addBot)}
            onRemoveBot={(i) => { playSound('button'); removeBot(i) }}
          />
        )}

        {screen === 'game' && room && (
          <>
            {/* Top bar */}
            <div className="top-bar">
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <span style={{ fontSize:9, color:'rgba(255,255,255,.45)', fontWeight:900, letterSpacing:1, textTransform:'uppercase' }}>
                  Round {room.round} · {room.mode==='special'?'✨ Special':'🎯 Normal'}
                </span>
                <span style={{
                  fontFamily:"'Fredoka One',cursive", fontSize:16, letterSpacing:3,
                  background:'linear-gradient(135deg,#E53935,#FFD600,#1E88E5,#43A047)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                }}>
                  {room.code}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <WsStatus status={wsStatus} />
                {/* ── Settings / menu button ── */}
                <button
                  className="ingame-menu-btn"
                  onClick={() => { playSound('button'); setMenuOpen(o => !o) }}
                  aria-label="Game menu"
                >
                  ⋮
                </button>
                {/* ── Sound toggle ── */}
                <button
                  className="ingame-menu-btn"
                  onClick={toggleSound}
                  aria-label={soundOn ? 'Mute SFX' : 'Unmute SFX'}
                  title={soundOn ? 'SFX: On' : 'SFX: Off'}
                  style={{ fontSize: 14 }}
                >
                  {soundOn ? '🔊' : '🔇'}
                </button>
                {/* ── Ambience toggle ── */}
                <button
                  className="ingame-menu-btn"
                  onClick={toggleAmbience}
                  aria-label={ambienceOn ? 'Mute music' : 'Unmute music'}
                  title={ambienceOn ? 'Music: On' : 'Music: Off'}
                  style={{ fontSize: 14 }}
                >
                  {ambienceOn ? '🎵' : '🎵' /* same icon, dimmed via title */}
                </button>
              </div>
            </div>

            {/* In-game dropdown menu */}
            {menuOpen && (
              <InGameMenu
                isHost={isHost}
                onHowToPlay={() => { setShowHowToPlay(true); setMenuOpen(false) }}
                onLeave={confirmLeaveRoom}
                onRestart={handleMenuRestart}
                onEndGame={handleMenuEndGame}
                onClose={() => setMenuOpen(false)}
              />
            )}

            <StatusPill
              room={room} isMyTurn={isMyTurn}
              turnPlayer={turnPlayer} mustPassNormal={mustPassNormal}
              amIStunned={amIStunned}
            />

            {phase === 'playing' && (
              <div style={{
                position:'fixed', top:54, left:'50%', transform:'translateX(-50%)',
                marginTop:36, fontSize:11, color:'rgba(255,255,255,.3)',
                fontWeight:900, letterSpacing:.5, pointerEvents:'none', zIndex:20,
              }}>
                {room.direction===1 ? '→ Clockwise' : '← Counter-clockwise'}
              </div>
            )}

            {room.players.map((player, i) => (
              <PlayerSeat
                key={player.id}
                player={player} idx={i}
                myIdx={myIdx} totalPlayers={room.players.length}
                isActive={room.currentTurn===i && phase==='playing'}
                isFrozen={room.frozenPlayer===i}
                isStunned={room.stunnedPlayer===i}
                isMe={i===myIdx}
              />
            ))}

            <GameLog logs={logs} />

            {phase==='showWindow' && (
              <ShowWindowOverlay
                countdown={countdown} canJoinShow={canJoinShow}
                hasJoinedShow={hasJoinedShow} onJoinShow={joinShow}
              />
            )}

            {(phase==='afterShow' || phase==='roundEnd') && room.roundResults && (
              <RoundResultModal room={room} />
            )}

            {phase==='roundEnd' && (
              <RoundEndControls isHost={isHost}
                onNextRound={withButtonSound(nextRound)}
                onEndGame={withButtonSound(endGame)} />
            )}

            {!['showWindow','afterShow'].includes(phase) && (
              <HandHud
                myPlayer={myPlayer} myRevealed={myRevealed}
                selectedChit={selectedChit} isMyTurn={isMyTurn}
                phase={phase} canCallShow={canCallShow}
                mustPassNormal={mustPassNormal}
                specialAction={specialAction}
                amIStunned={amIStunned}
                onChitClick={onChitClick}
                onPass={passChit}
                onCallShow={callShow}
              />
            )}

            <SpecialModalManager
              specialAction={specialAction}
              room={room} myIdx={myIdx}
              myPlayer={myPlayer}
              myRevealed={myRevealed}
              onUse={useSpecial}
              onPass={passChit}
              onCancel={cancelSpecial}
              onPickTarget={pickTarget}
              onRevealedSnatchPick={revealedSnatchPick}
              onNukePickCard={nukePickCard}
              onDismissVitals={dismissVitals}
              onBlindSnatchPickCard={blindSnatchPickCard}
            />

            {errorMsg && (
              <div style={{
                position:'fixed', bottom:200, left:'50%', transform:'translateX(-50%)',
                zIndex:60, padding:'10px 20px', borderRadius:30,
                background:'rgba(229,57,53,.88)', backdropFilter:'blur(10px)',
                border:'1px solid rgba(229,57,53,.6)',
                color:'#fff', fontSize:14, fontWeight:900,
                whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(229,57,53,.4)',
                animation:'popIn .3s cubic-bezier(.34,1.56,.64,1)',
              }}>
                ⚠️ {errorMsg}
              </div>
            )}
          </>
        )}

        {screen === 'end' && room && (
          <EndScreen room={room}
            onPlayAgain={withButtonSound(playAgain)}
            onLeave={onLeave} />
        )}

      </div>
    </>
  )
}