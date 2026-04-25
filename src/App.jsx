import { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from './hooks/useGame.js'
import { useScene } from './hooks/useScene.js'
import {
  WsStatus, HandHud, Scoreboard, GameLog,
  StatusPill, ShowWindowOverlay, RoundEndControls, EndScreen
} from './components/UI.jsx'
import { SpecialModalManager } from './components/SpecialModals.jsx'
import { LandingScreen, JoinScreen, LobbyScreen } from './components/Screens.jsx'

const GAME_PHASES = ['playing','showWindow','afterShow','roundEnd','giverSnatching','randomSnatching','giverSnatchPicking']

export default function App() {
  const [screen,      setScreen]      = useState('landing')
  const [pendingName, setPendingName] = useState('')
  const canvasRef = useRef(null)

  const {
    me, room, logs, myIdx, selectedChit, setSelectedChit,
    errorMsg, loading, wsStatus,
    isHost, myPlayer, isMyTurn, turnPlayer, showAll,
    myRevealed, countdown, canJoinShow, hasJoinedShow, canCallShow,
    specialAction, mustPassNormal,
    createRoom, joinRoom, startGame,
    revealChit, onChitClick, passChit, useSpecial,
    giverSnatchRespond, giverSnatchPick,
    randomSnatchPickPlayer, randomSnatchPickChit,
    callShow, joinShow,
    nextRound, endGame, playAgain, leaveRoom,
  } = useGame()

  const { sceneRef, revealInScene, selectInScene } = useScene(
    canvasRef, room, myIdx, selectedChit, showAll
  )

  const phase = room?.phase

  useEffect(() => {
    if (!phase) return
    if (phase === 'lobby') setScreen('lobby')
    if (GAME_PHASES.includes(phase)) setScreen('game')
    if (phase === 'ended') setScreen('end')
  }, [phase])

  // Wire reveal to 3D scene
  const handleChitClick = useCallback((i) => {
    const wasRevealed = myRevealed[i]
    onChitClick(i)
    if (!wasRevealed) revealInScene(i)
    else {
      if (selectedChit !== -1 && selectedChit !== i) selectInScene(selectedChit, false)
      selectInScene(i, selectedChit !== i)
    }
  }, [onChitClick, myRevealed, revealInScene, selectInScene, selectedChit])

  async function onCreate(name) { await createRoom(name); setScreen('lobby') }
  function onGoJoin(name) { setPendingName(name); setScreen('join') }
  async function onJoin(code, done) {
    try { await joinRoom(pendingName, code); setScreen('lobby') }
    catch {} finally { done?.() }
  }
  function onLeave() { leaveRoom(); setScreen('landing') }

  const inGame = screen === 'game'

  return (
    <>
      {/* Three.js canvas */}
      <canvas
        id="three-canvas"
        ref={canvasRef}
        style={{ display: inGame ? 'block' : 'none' }}
      />

      <div id="ui-root">

        {screen === 'landing' && <LandingScreen onCreate={onCreate} onGoJoin={onGoJoin} />}
        {screen === 'join'    && <JoinScreen onJoin={onJoin} onBack={()=>setScreen('landing')} errorMsg={errorMsg} />}
        {screen === 'lobby' && room && (
          <LobbyScreen room={room} me={me} isHost={isHost} wsStatus={wsStatus} onStart={startGame} onLeave={onLeave} />
        )}

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

            <StatusPill room={room} isMyTurn={isMyTurn} turnPlayer={turnPlayer} mustPassNormal={mustPassNormal} />
            <Scoreboard room={room} myIdx={myIdx} />
            <GameLog logs={logs} />

            {phase === 'showWindow' && (
              <ShowWindowOverlay countdown={countdown} canJoinShow={canJoinShow} hasJoinedShow={hasJoinedShow} onJoinShow={joinShow} />
            )}

            {phase === 'roundEnd' && (
              <RoundEndControls isHost={isHost} onNextRound={nextRound} onEndGame={endGame} />
            )}

            {/* Hand HUD — hide only when show window or after show */}
            {!['showWindow','afterShow'].includes(phase) && (
              <HandHud
                myPlayer={myPlayer}
                myRevealed={myRevealed}
                selectedChit={selectedChit}
                isMyTurn={isMyTurn}
                phase={phase}
                canCallShow={canCallShow}
                mustPassNormal={mustPassNormal}
                specialAction={specialAction}
                onChitClick={handleChitClick}
                onPass={passChit}
                onCallShow={callShow}
              />
            )}

            {/* Special modals */}
            <SpecialModalManager
              specialAction={specialAction}
              room={room}
              myIdx={myIdx}
              myPlayer={myPlayer}
              onUse={useSpecial}
              onPass={(chitIdx) => passChit(chitIdx)}
              onCancel={() => setSelectedChit(-1)}
              onGiverSnatchRespond={giverSnatchRespond}
              onGiverSnatchPick={giverSnatchPick}
              onRandomSnatchPickPlayer={randomSnatchPickPlayer}
              onRandomSnatchPickChit={randomSnatchPickChit}
            />

            {errorMsg && (
              <div style={{
                position:'fixed', bottom:200, left:'50%', transform:'translateX(-50%)',
                zIndex:25, padding:'8px 16px', borderRadius:8,
                background:'rgba(248,113,113,.12)', border:'1px solid rgba(248,113,113,.3)',
                color:'#F87171', fontSize:13, fontWeight:500, whiteSpace:'nowrap'
              }}>
                {errorMsg}
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