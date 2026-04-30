import { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from './hooks/useGame.js'
import {
  WsStatus, HandHud, PlayerSeat, GameLog,
  StatusPill, ShowWindowOverlay, RoundEndControls, EndScreen,
  LoadingOverlay, RoundResultModal,
} from './components/UI.jsx'
import { SpecialModalManager } from './components/SpecialModals.jsx'
import { LandingPage, CreateJoinScreen, JoinScreen, LobbyScreen } from './components/Screens.jsx'

const GAME_PHASES = [
  'playing','showWindow','afterShow','roundEnd',
  'pendingSpecial','blindSnatchPicking','revealedSnatchPicking','nukePicking',
]

export default function App() {
  const [screen,     setScreen]     = useState('landing')
  const [playerName, setPlayerName] = useState('')
  const canvasRef = useRef(null)

  const {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    specialAction, mustPassNormal, stunFlash, isStunned, amIStunned,
    amIPuppeteer, amIPuppeted, puppetTarget,
    createRoom, joinRoom, startGame, setMode, setHandSetup, setEnabledSpecials,
    revealChit, onChitClick, passChit, useSpecial, cancelSpecial,
    pickTarget, revealedSnatchPick, nukePickCard, dismissVitals, blindSnatchPickCard,
    callShow, joinShow,
    nextRound, endGame, playAgain, leaveRoom,
  } = useGame()

  const phase = room?.phase

  // Screen routing
  useEffect(() => {
    if (!phase) return
    if (phase === 'lobby') setScreen('lobby')
    if (GAME_PHASES.includes(phase)) setScreen('game')
    if (phase === 'ended') setScreen('end')
  }, [phase])

  // Who is puppeteering me?
  const puppeteerName = amIPuppeted
    ? room?.players[room?.puppeteerInfo?.puppeteerIdx]?.name ?? 'Someone'
    : ''

  // ── Navigation handlers ─────────────────────────────────
  function onPlay(name) { setPlayerName(name); setScreen('createjoin') }

  async function onCreate() {
    await createRoom(playerName)
    setScreen('lobby')
  }

  function onGoJoin() { setScreen('join') }

  async function onJoin(code, done) {
    try { await joinRoom(playerName, code); setScreen('lobby') }
    catch {} finally { done?.() }
  }

  function onLeave() { leaveRoom(); setScreen('landing') }
  function onBack()  { setScreen(screen === 'join' ? 'createjoin' : 'landing') }

  // ── Pass handler ────────────────────────────────────────
  const handlePass = useCallback((chitIdx, forActing = false) => {
    passChit(chitIdx, forActing)
  }, [passChit])

  // ── Puppeteer chit click (on target's hand) ─────────────
  const handlePuppetChitClick = useCallback((i) => {
    onChitClick(i, true)
  }, [onChitClick])

  const inGame = screen === 'game'

  return (
    <>
      {/* Hidden canvas */}
      <canvas ref={canvasRef} id="three-canvas" style={{ display:'none' }} />

      {/* Stun flash */}
      {stunFlash && <div className="stun-flash" />}

      {/* Global loading overlay */}
      {loading && <LoadingOverlay message={
        screen === 'join' ? 'Joining room…'
        : screen === 'lobby' ? 'Starting game…'
        : 'Please wait…'
      } />}

      <div id="ui-root">

        {/* ── Landing ── */}
        {screen === 'landing' && <LandingPage onPlay={onPlay} />}

        {/* ── Create / Join choice ── */}
        {screen === 'createjoin' && (
          <CreateJoinScreen
            name={playerName}
            onCreate={onCreate}
            onGoJoin={onGoJoin}
            onBack={() => setScreen('landing')}
          />
        )}

        {/* ── Join ── */}
        {screen === 'join' && (
          <JoinScreen
            name={playerName}
            onJoin={onJoin}
            onBack={onBack}
            errorMsg={errorMsg}
          />
        )}

        {/* ── Lobby ── */}
        {screen === 'lobby' && room && (
          <LobbyScreen
            room={room} me={me} isHost={isHost} wsStatus={wsStatus}
            onStart={startGame} onLeave={onLeave} onSetMode={setMode}
            setHandSetup={setHandSetup} setEnabledSpecials={setEnabledSpecials}
          />
        )}

        {/* ── Game ── */}
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
              <WsStatus status={wsStatus} />
            </div>

            {/* Status pill */}
            <StatusPill
              room={room} isMyTurn={isMyTurn}
              turnPlayer={turnPlayer} mustPassNormal={mustPassNormal}
              amIStunned={amIStunned} amIPuppeteer={amIPuppeteer} amIPuppeted={amIPuppeted}
            />

            {/* Direction indicator */}
            {phase === 'playing' && (
              <div style={{
                position:'fixed', top:54, left:'50%', transform:'translateX(-50%)',
                marginTop:36, fontSize:11, color:'rgba(255,255,255,.3)',
                fontWeight:900, letterSpacing:.5, pointerEvents:'none', zIndex:20,
              }}>
                {room.direction===1 ? '→ Clockwise' : '← Counter-clockwise'}
              </div>
            )}

            {/* Player seats around the table */}
            {room.players.map((player, i) => (
              <PlayerSeat
                key={player.id}
                player={player} idx={i}
                myIdx={myIdx} totalPlayers={room.players.length}
                isActive={room.currentTurn===i && phase==='playing'}
                isFrozen={room.frozenPlayer===i}
                isStunned={room.stunnedPlayer===i}
                isPuppeteer={room.puppeteerInfo?.puppeteerIdx===i}
                isPuppeted={room.puppeteerInfo?.targetIdx===i}
                isMe={i===myIdx}
              />
            ))}

            {/* Game log */}
            <GameLog logs={logs} />

            {/* Show window */}
            {phase==='showWindow' && (
              <ShowWindowOverlay
                countdown={countdown} canJoinShow={canJoinShow}
                hasJoinedShow={hasJoinedShow} onJoinShow={joinShow}
              />
            )}

            {/* Round results */}
            {(phase==='afterShow' || phase==='roundEnd') && room.roundResults && (
              <RoundResultModal room={room} />
            )}

            {/* Round end */}
            {phase==='roundEnd' && (
              <RoundEndControls isHost={isHost} onNextRound={nextRound} onEndGame={endGame} />
            )}

            {/* My hand HUD */}
            {!['showWindow','afterShow'].includes(phase) && (
              <HandHud
                myPlayer={myPlayer} myRevealed={myRevealed}
                selectedChit={selectedChit} isMyTurn={isMyTurn}
                phase={phase} canCallShow={canCallShow}
                mustPassNormal={mustPassNormal}
                specialAction={specialAction}
                amIStunned={amIStunned}
                amIPuppeteer={amIPuppeteer}
                onChitClick={onChitClick}
                onPass={handlePass}
                onCallShow={callShow}
              />
            )}

            {/* Special modals */}
            <SpecialModalManager
              specialAction={specialAction}
              room={room} myIdx={myIdx}
              myPlayer={myPlayer}
              myRevealed={myRevealed}
              amIPuppeted={amIPuppeted}
              amIPuppeteer={amIPuppeteer}
              puppetTarget={puppetTarget}
              puppeteerName={puppeteerName}
              onUse={useSpecial}
              onPass={handlePass}
              onCancel={cancelSpecial}
              onPickTarget={pickTarget}
              onRevealedSnatchPick={revealedSnatchPick}
              onNukePickCard={nukePickCard}
              onDismissVitals={dismissVitals}
              onBlindSnatchPickCard={blindSnatchPickCard}
              onPuppetChitClick={handlePuppetChitClick}
              onPuppetPass={(chitIdx) => handlePass(chitIdx, true)}
              onPuppetUseSpecial={(chitIdx, special) => useSpecial(chitIdx, special, true)}
            />

            {/* Error toast */}
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

        {/* ── End ── */}
        {screen === 'end' && room && (
          <EndScreen room={room} onPlayAgain={playAgain} onLeave={onLeave} />
        )}

      </div>
    </>
  )
}