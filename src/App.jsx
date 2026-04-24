import { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from './hooks/useGame.js'
import { useScene } from './hooks/useScene.js'
import {
  WsStatus, HandHud, Scoreboard, GameLog,
  StatusPill, ShowWindowOverlay, RoundEndControls, EndScreen
} from './components/UI.jsx'
import { LandingScreen, JoinScreen, LobbyScreen } from './components/Screens.jsx'

const GAME_PHASES = ['playing','showWindow','afterShow','roundEnd']

export default function App() {
  const [screen,      setScreen]      = useState('landing')
  const [pendingName, setPendingName] = useState('')
  const canvasRef = useRef(null)

  const {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    createRoom, joinRoom, startGame,
    revealChit, selectChit, passChit, callShow, joinShow,
    nextRound, endGame, playAgain, leaveRoom,
  } = useGame()

  const { sceneRef, revealInScene, selectInScene } = useScene(
    canvasRef, room, myIdx, selectedChit, showAll
  )

  const phase = room?.phase

  // Screen transitions
  useEffect(() => {
    if (!phase) return
    if (phase === 'lobby') setScreen('lobby')
    if (GAME_PHASES.includes(phase)) setScreen('game')
    if (phase === 'ended') setScreen('end')
  }, [phase])

  // Wire reveal to also animate 3D scene
  const handleReveal = useCallback((i) => {
    revealChit(i)
    revealInScene(i)
  }, [revealChit, revealInScene])

  // Wire select to also animate 3D scene
  const handleSelect = useCallback((i) => {
    selectChit(i)
    // Deselect previous
    if (selectedChit !== -1 && selectedChit !== i) selectInScene(selectedChit, false)
    selectInScene(i, selectedChit !== i)
  }, [selectChit, selectInScene, selectedChit])

  async function onCreate(name) {
    await createRoom(name); setScreen('lobby')
  }
  function onGoJoin(name) { setPendingName(name); setScreen('join') }
  async function onJoin(code, done) {
    try { await joinRoom(pendingName, code); setScreen('lobby') }
    catch {}
    finally { done?.() }
  }
  function onLeave() { leaveRoom(); setScreen('landing') }

  const inGame = screen === 'game'

  return (
    <>
      {/* Three.js canvas — always mounted so scene initialises */}
      <canvas
        id="three-canvas"
        ref={canvasRef}
        style={{ display: inGame ? 'block' : 'none' }}
      />

      {/* UI root */}
      <div id="ui-root">

        {/* ── Landing ── */}
        {screen === 'landing' && (
          <LandingScreen onCreate={onCreate} onGoJoin={onGoJoin} />
        )}

        {/* ── Join ── */}
        {screen === 'join' && (
          <JoinScreen onJoin={onJoin} onBack={()=>setScreen('landing')} errorMsg={errorMsg} />
        )}

        {/* ── Lobby ── */}
        {screen === 'lobby' && room && (
          <LobbyScreen
            room={room} me={me} isHost={isHost} wsStatus={wsStatus}
            onStart={startGame} onLeave={onLeave}
          />
        )}

        {/* ── Game UI overlay ── */}
        {screen === 'game' && room && (
          <>
            {/* Top bar */}
            <div className="top-bar">
              <div style={{ display:'flex', flexDirection:'column' }}>
                <span style={{ fontSize:9, color:'var(--muted)', fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>
                  Round {room.round}
                </span>
                <span className="font-display" style={{ fontWeight:800, color:'var(--gold)', letterSpacing:3, fontSize:14,
                  textShadow:'0 0 12px rgba(245,200,66,.5)' }}>
                  {room.code}
                </span>
              </div>
              <WsStatus status={wsStatus} />
            </div>

            {/* Status pill */}
            <StatusPill room={room} isMyTurn={isMyTurn} turnPlayer={turnPlayer} />

            {/* Scoreboard */}
            <Scoreboard room={room} myIdx={myIdx} />

            {/* Game log */}
            <GameLog logs={logs} />

            {/* Show window */}
            {phase === 'showWindow' && (
              <ShowWindowOverlay
                countdown={countdown}
                canJoinShow={canJoinShow}
                hasJoinedShow={hasJoinedShow}
                onJoinShow={joinShow}
              />
            )}

            {/* Round end controls */}
            {phase === 'roundEnd' && (
              <RoundEndControls isHost={isHost} onNextRound={nextRound} onEndGame={endGame} />
            )}

            {/* Hand HUD */}
            {phase !== 'roundEnd' && phase !== 'afterShow' && (
              <HandHud
                myPlayer={myPlayer}
                myRevealed={myRevealed}
                selectedChit={selectedChit}
                isMyTurn={isMyTurn}
                phase={phase}
                canCallShow={canCallShow}
                onReveal={handleReveal}
                onSelect={handleSelect}
                onPass={()=>passChit(selectedChit)}
                onCallShow={callShow}
              />
            )}

            {errorMsg && (
              <div style={{ position:'fixed', bottom:200, left:'50%', transform:'translateX(-50%)',
                zIndex:25, padding:'8px 16px', borderRadius:8,
                background:'rgba(248,113,113,.12)', border:'1px solid rgba(248,113,113,.3)',
                color:'#F87171', fontSize:13, fontWeight:500, whiteSpace:'nowrap' }}>
                {errorMsg}
              </div>
            )}
          </>
        )}

        {/* ── End screen ── */}
        {screen === 'end' && room && (
          <EndScreen room={room} onPlayAgain={playAgain} onLeave={onLeave} />
        )}

      </div>
    </>
  )
}
