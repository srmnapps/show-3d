import { AVATAR_COLORS, MEDALS } from '../utils/game.js'
import { initials } from '../utils/helpers.js'

// ── WsStatus ──────────────────────────────────────────────────
export function WsStatus({ status }) {
  const color = status==='connected' ? '#4ADE80' : status==='connecting' ? '#FBBF24' : '#F87171'
  const label = status==='connected' ? 'Live' : status==='connecting' ? 'Connecting…' : 'Offline'
  return (
    <span className="ws-dot">
      <span className="ws-dot-circle" style={{ background:color, boxShadow:`0 0 6px ${color}` }} />
      {label}
    </span>
  )
}

// ── Single HUD card (CSS 3D) ─────────────────────────────────
export function HudCard({ symbol, revealed, selected, onClick }) {
  let cls = 'hud-card'
  if (selected) cls += ' selected'

  const innerCls = revealed
    ? 'hud-card-inner hud-card-revealed'
    : 'hud-card-inner hud-card-down'

  const cardStyle = {
    boxShadow: selected
      ? '0 0 24px rgba(245,200,66,.5), 0 8px 24px rgba(0,0,0,.7)'
      : revealed
      ? '0 4px 16px rgba(0,0,0,.6), 0 0 8px rgba(155,127,255,.15)'
      : '0 4px 12px rgba(0,0,0,.5)',
  }

  return (
    <div className={cls} style={cardStyle} onClick={onClick}>
      <div className={innerCls}>
        {revealed && <span style={{ fontSize:28, filter:'drop-shadow(0 1px 2px rgba(0,0,0,.3))' }}>{symbol}</span>}
      </div>
    </div>
  )
}

// ── My hand HUD at bottom ────────────────────────────────────
export function HandHud({
  myPlayer, myRevealed, selectedChit, isMyTurn, phase,
  canCallShow, onReveal, onSelect, onPass, onCallShow
}) {
  if (!myPlayer) return null
  const chits = myPlayer.chits ?? []

  return (
    <div className="hand-hud">
      {/* Cards */}
      <div className="hand-cards">
        {chits.map((c, i) => (
          <HudCard
            key={i}
            symbol={c}
            revealed={myRevealed[i] || false}
            selected={selectedChit === i}
            onClick={() => {
              if (!myRevealed[i]) onReveal(i)
              else onSelect(i)
            }}
          />
        ))}
        {chits.length === 0 && (
          <span style={{ color:'var(--muted)', fontSize:12 }}>No chits</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="action-row">
        {phase === 'playing' && isMyTurn && (
          <button
            className="btn btn-teal btn-lg"
            disabled={selectedChit === -1}
            onClick={onPass}
          >
            Pass →
          </button>
        )}
        {phase === 'playing' && canCallShow && (
          <button className="btn btn-coral btn-lg" onClick={onCallShow}>
            🎉 Show!
          </button>
        )}
        {phase === 'playing' && !isMyTurn && (
          <span style={{ fontSize:12, color:'var(--muted)' }}>
            {selectedChit !== -1 ? 'Chit selected — wait for your turn' : 'Tap your cards to peek'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Scoreboard (top right) ───────────────────────────────────
export function Scoreboard({ room, myIdx }) {
  if (!room) return null
  return (
    <div className="scoreboard">
      {room.players.map((p, i) => {
        const ac = AVATAR_COLORS[p.color] ?? AVATAR_COLORS[0]
        const isActive = room.currentTurn === i && room.phase === 'playing'
        const isShow   = p.isShow
        let cls = 'score-entry fade-up'
        if (isActive) cls += ' active-turn'
        if (isShow)   cls += ' is-show'
        return (
          <div key={p.id} className={cls}>
            <div className="avatar" style={{ background:ac.bg, color:ac.fg, width:24, height:24, fontSize:10 }}>
              {initials(p.name)}
            </div>
            <span style={{ flex:1, fontSize:11, fontWeight:600, color: i===myIdx ? 'var(--purple)' : 'var(--text)' }}>
              {p.name.length > 8 ? p.name.slice(0,8)+'…' : p.name}
            </span>
            <span style={{
              fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:12,
              color: p.score > 0 ? 'var(--gold)' : 'var(--muted)'
            }}>
              {p.score > 0 ? '+' : ''}{p.score}
            </span>
            {isActive && <span style={{ fontSize:9, color:'var(--teal)' }}>▶</span>}
            {isShow   && <span style={{ fontSize:10 }}>🔥</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── Game Log (top left) ──────────────────────────────────────
export function GameLog({ logs }) {
  return (
    <div className="log-panel glass">
      <div className="section-label" style={{ marginBottom:4 }}>Log</div>
      {logs.slice(0,10).map((l, i) => (
        <div key={i} className="log-entry">› {l}</div>
      ))}
    </div>
  )
}

// ── Status pill (top center) ─────────────────────────────────
export function StatusPill({ room, isMyTurn, turnPlayer }) {
  if (!room || room.phase === 'lobby') return null
  const { phase } = room
  let cls = 'status-pill glass '
  let text = ''

  if (phase === 'playing') {
    cls  += isMyTurn ? 'status-playing' : 'status-wait'
    text  = isMyTurn ? '✋ Your turn!' : `${turnPlayer?.name}'s turn…`
  } else if (phase === 'showWindow') {
    cls  += 'status-show'
    text  = '🎉 Show Window Open!'
  } else if (phase === 'afterShow') {
    cls  += 'status-show'
    text  = '👀 Revealing all hands…'
  } else if (phase === 'roundEnd') {
    cls  += 'status-roundend'
    text  = `⚡ Round ${room.round} complete!`
  }

  return <div className={cls}>{text}</div>
}

// ── Show window overlay ──────────────────────────────────────
export function ShowWindowOverlay({ countdown, canJoinShow, hasJoinedShow, onJoinShow }) {
  return (
    <div className="countdown-ring">
      <div className="countdown-num">{countdown}</div>
      <div className="countdown-label">seconds left</div>
      {canJoinShow && (
        <button className="btn btn-coral btn-lg pulse" style={{ marginTop:16 }} onClick={onJoinShow}>
          🎉 Join Show!
        </button>
      )}
      {hasJoinedShow && (
        <div style={{ marginTop:12, color:'var(--teal)', fontWeight:700, fontSize:14 }}>
          ✓ Joined!
        </div>
      )}
    </div>
  )
}

// ── Round end controls ───────────────────────────────────────
export function RoundEndControls({ isHost, onNextRound, onEndGame }) {
  return (
    <div style={{
      position:'fixed', bottom:140, left:'50%', transform:'translateX(-50%)',
      display:'flex', gap:10, zIndex:20
    }}>
      {isHost ? (
        <>
          <button className="btn btn-gold btn-lg" onClick={onNextRound}>Next Round ▶</button>
          <button className="btn btn-ghost" onClick={onEndGame}>End Game</button>
        </>
      ) : (
        <div className="glass" style={{ padding:'10px 18px', borderRadius:10, fontSize:13, color:'var(--muted)' }}>
          Waiting for host…
        </div>
      )}
    </div>
  )
}

// ── End Screen ───────────────────────────────────────────────
export function EndScreen({ room, onPlayAgain, onLeave }) {
  const sorted = [...room.players].sort((a,b) => b.score-a.score)
  return (
    <div className="overlay">
      <div className="overlay-inner">
        <div className="glass" style={{ padding:'28px 24px', textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:'.75rem', filter:'drop-shadow(0 0 24px rgba(245,200,66,.5))' }}>🏆</div>
          <h2 className="font-display" style={{ fontSize:'2rem', fontWeight:800, color:'var(--gold)',
            textShadow:'0 0 24px rgba(245,200,66,.5)', marginBottom:'.3rem' }}>
            Game Over!
          </h2>
          <p style={{ color:'var(--muted)', fontSize:13, marginBottom:'1.5rem' }}>
            {sorted[0]?.name} wins with <span style={{ color:'var(--gold)', fontWeight:700 }}>{sorted[0]?.score}</span> pts
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:'1.5rem', textAlign:'left' }}>
            {sorted.map((p, i) => {
              const ac = AVATAR_COLORS[p.color] ?? AVATAR_COLORS[0]
              return (
                <div key={p.id} className={`score-row${i===0?' first':''}`}>
                  <span style={{ fontSize:20, width:26 }}>{MEDALS[i]}</span>
                  <div className="avatar" style={{ background:ac.bg, color:ac.fg, width:28, height:28, fontSize:10 }}>
                    {initials(p.name)}
                  </div>
                  <span style={{ flex:1, fontSize:13, fontWeight:600 }}>{p.name}</span>
                  <span className="font-display" style={{
                    fontSize:20, fontWeight:800,
                    color: i===0 ? 'var(--gold)' : 'var(--text-dim)',
                  }}>{p.score}</span>
                </div>
              )
            })}
          </div>
          <div className="btn-row" style={{ justifyContent:'center', gap:10 }}>
            <button className="btn btn-gold btn-lg" onClick={onPlayAgain}>Play Again</button>
            <button className="btn btn-ghost" onClick={onLeave}>Leave</button>
          </div>
        </div>
      </div>
    </div>
  )
}
