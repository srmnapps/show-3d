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

const GAME_PHASES = [
  'playing','showWindow','afterShow','roundEnd',
  'pendingSpecial','blindSnatchPicking','revealedSnatchPicking','nukePicking',
]

export default function App() {
  const [screen,     setScreen]     = useState('landing')
  const [playerName, setPlayerName] = useState('')
  const canvasRef = useRef(null)

  // ── In-game menu / modal state ──────────────────────────────
  const [menuOpen,        setMenuOpen]        = useState(false)
  const [showHowToPlay,   setShowHowToPlay]   = useState(false)
  const [leaveConfirm,    setLeaveConfirm]    = useState(false)
  const [restartConfirm,  setRestartConfirm]  = useState(false)

  // Track whether we're in-game for back-navigation guard
  const screenRef = useRef(screen)
  useEffect(() => { screenRef.current = screen }, [screen])

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

  // ── Screen routing ────────────────────────────────────────
  useEffect(() => {
    if (!phase) return
    if (phase === 'lobby') setScreen('lobby')
    if (GAME_PHASES.includes(phase)) setScreen('game')
    if (phase === 'ended') setScreen('end')
  }, [phase])

  useEffect(() => {
    if (initialRoomCode && screen === 'landing') {
      setScreen('join')
    }
  }, [initialRoomCode, screen])

  // ── Browser back-button guard ─────────────────────────────
  // We push a sentinel history entry when entering the game,
  // and intercept popstate to show a confirmation instead of navigating.
  useEffect(() => {
    // Push sentinel when entering game or lobby
    if (screen === 'game' || screen === 'lobby') {
      window.history.pushState({ show_sentinel: true }, '')
    }
  }, [screen])

  useEffect(() => {
    function handlePopState(e) {
      const s = screenRef.current
      if (s === 'game' || s === 'lobby') {
        // Re-push sentinel so further back presses keep triggering this
        window.history.pushState({ show_sentinel: true }, '')
        setLeaveConfirm(true)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // ── Navigation helpers ────────────────────────────────────
  function goHome() {
    leaveRoom()
    setScreen('landing')
    setMenuOpen(false)
    setLeaveConfirm(false)
  }

  function confirmLeaveRoom() {
    setLeaveConfirm(true)
    setMenuOpen(false)
  }

  function onPlay(name) { setPlayerName(name); setScreen('createjoin') }

  async function onCreate() {
    await createRoom(playerName, false)
  }

  async function onCreatePublic() {
    await createRoom(playerName, true)
  }

  function onBrowse() {
    connectForBrowsing(playerName)
    setScreen('browse')
  }

  function onGoJoin() { setScreen('join') }

  async function onJoin(code, nameOverride, done) {
    const effectiveName = nameOverride ?? playerName
    if (!effectiveName) { done?.(); return }
    if (nameOverride) setPlayerName(nameOverride)
    try { await joinRoom(effectiveName, code) }
    catch {} finally { done?.() }
  }

  function onLeave() { leaveRoom(); setScreen('landing') }
  function onBack()  { setScreen(screen === 'join' ? 'createjoin' : 'landing') }

  // ── Host restart (play again from in-game menu) ───────────
  function handleMenuRestart() {
    setRestartConfirm(true)
    setMenuOpen(false)
  }

  function confirmRestart() {
    playAgain()
    setRestartConfirm(false)
  }

  // ── Host end game from menu ───────────────────────────────
  function handleMenuEndGame() {
    endGame()
    setMenuOpen(false)
  }

  const inGame = screen === 'game'

  return (
    <>
      <canvas ref={canvasRef} id="three-canvas" style={{ display:'none' }} />

      {stunFlash && <div className="stun-flash" />}

      {loading && <LoadingOverlay message={
        screen === 'join'   ? 'Joining room…'
        : screen === 'lobby'  ? 'Starting game…'
        : screen === 'browse' ? 'Loading rooms…'
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

        {screen === 'landing' && <LandingPage onPlay={onPlay} />}

        {screen === 'createjoin' && (
          <CreateJoinScreen
            name={playerName}
            onCreate={onCreate}
            onCreatePublic={onCreatePublic}
            onGoJoin={onGoJoin}
            onBrowse={onBrowse}
            onBack={() => setScreen('landing')}
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
            onStart={startGame} onLeave={onLeave} onSetMode={setMode}
            setHandSetup={setHandSetup} setEnabledSpecials={setEnabledSpecials}
            isPublic={isPublic}
            onToggleVisibility={toggleVisibility}
            onAddBot={addBot}
            onRemoveBot={removeBot}
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
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="Game menu"
                >
                  ⋮
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
              <RoundEndControls isHost={isHost} onNextRound={nextRound} onEndGame={endGame} />
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
          <EndScreen room={room} onPlayAgain={playAgain} onLeave={onLeave} />
        )}

      </div>
    </>
  )
}