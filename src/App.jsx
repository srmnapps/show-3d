import { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from './hooks/useGame.js'
import {
  WsStatus, HandHud, PlayerSeat, GameLog,
  StatusPill, ShowWindowOverlay, RoundEndControls, EndScreen
} from './components/UI.jsx'
import { SpecialModalManager } from './components/SpecialModals.jsx'
import { LandingPage, CreateJoinScreen, JoinScreen, LobbyScreen } from './components/Screens.jsx'

const GAME_PHASES = ['playing','showWindow','afterShow','roundEnd','randomSnatching','stunGrenade']

export default function App() {
  const [screen,      setScreen]      = useState('landing')   // landing|createjoin|join|lobby|game|end
  const [playerName,  setPlayerName]  = useState('')
  const canvasRef = useRef(null)

  const {
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
  } = useGame()

  const phase = room?.phase

  useEffect(() => {
    if (!phase) return
    if (phase === 'lobby') setScreen('lobby')
    if (GAME_PHASES.includes(phase)) setScreen('game')
    if (phase === 'ended') setScreen('end')
  }, [phase])

  // ── Nav handlers ──────────────────────────────────────────
  function onPlay(name) {
    setPlayerName(name)
    setScreen('createjoin')
  }

  async function onCreate() {
    await createRoom(playerName)
    setScreen('lobby')
  }

  function onGoJoin() { setScreen('join') }

  async function onJoin(code, done) {
    try { await joinRoom(playerName, code); setScreen('lobby') }
    catch {} finally { done?.() }
  }

  function onLeave() {
    leaveRoom()
    setScreen('landing')
  }

  function onBack() {
    setScreen(screen === 'join' ? 'createjoin' : 'landing')
  }

  const inGame = screen === 'game'

  return (
    <>
      {/* Hidden canvas — Three.js disabled in UNO mode */}
      <canvas ref={canvasRef} id="three-canvas" style={{ display:'none' }} />

      {/* Stun flash overlay */}
      {stunFlash && <div className="stun-flash" />}

      <div id="ui-root">

        {/* ── Landing ── */}
        {screen === 'landing' && <LandingPage onPlay={onPlay} />}

        {/* ── Create or Join choice ── */}
        {screen === 'createjoin' && (
          <CreateJoinScreen
            name={playerName}
            onCreate={onCreate}
            onJoin={onGoJoin}
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
            onStart={startGame} onLeave={onLeave}
            onSetMode={setMode}
          />
        )}

        {/* ── Game ── */}
        {screen === 'game' && room && (
          <>
            {/* Top bar */}
            <div className="top-bar">
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <span style={{ fontSize:9, color:'rgba(255,255,255,.5)', fontWeight:900, letterSpacing:1, textTransform:'uppercase' }}>
                  Round {room.round} · {room.mode==='special'?'✨ Special':'🎯 Normal'}
                </span>
                <span style={{
                  fontFamily:"'Fredoka One',cursive", fontWeight:400,
                  fontSize:16, letterSpacing:3,
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
              amIStunned={amIStunned}
            />

            {/* Player seats around the table */}
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

            {/* Game log */}
            <GameLog logs={logs} />

            {/* Show window */}
            {phase==='showWindow' && (
              <ShowWindowOverlay
                countdown={countdown} canJoinShow={canJoinShow}
                hasJoinedShow={hasJoinedShow} onJoinShow={joinShow}
              />
            )}

            {/* Round end */}
            {phase==='roundEnd' && (
              <RoundEndControls isHost={isHost} onNextRound={nextRound} onEndGame={endGame} />
            )}

            {/* Hand HUD */}
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

            {/* Special modals */}
            <SpecialModalManager
              specialAction={specialAction}
              room={room} myIdx={myIdx}
              onUse={useSpecial}
              onPass={passChit}
              onCancel={cancelSpecial}
              onRandomSnatchPickPlayer={randomSnatchPickPlayer}
              onStunGrenadePickPlayer={stunGrenadePickPlayer}
            />

            {/* Error toast */}
            {errorMsg && (
              <div style={{
                position:'fixed', bottom:200, left:'50%', transform:'translateX(-50%)',
                zIndex:25, padding:'10px 20px', borderRadius:30,
                background:'rgba(229,57,53,.85)', backdropFilter:'blur(10px)',
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