import { AVATAR_COLORS, MEDALS, SEAT_COLORS, isSpecial, chitDisplay } from '../utils/game.js'
import { initials } from '../utils/helpers.js'

// ── WsStatus ──────────────────────────────────────────────────
export function WsStatus({ status }) {
  const color = status==='connected'?'#43A047':status==='connecting'?'#FFD600':'#E53935'
  const label = status==='connected'?'LIVE':status==='connecting'?'...':'OFF'
  return (
    <span className="ws-dot">
      <span className="ws-dot-circle" style={{ background:color, boxShadow:`0 0 6px ${color}` }}/>
      {label}
    </span>
  )
}

// ── Single hand card (UNO fan style) ─────────────────────────
export function HandCard({ chit, revealed, selected, onClick, arcIndex, totalCards, stunned }) {
  const special = isSpecial(chit)
  const display = chitDisplay(chit)
  const mid     = (totalCards - 1) / 2
  const angle   = (arcIndex - mid) * 5
  const lift    = Math.abs(arcIndex - mid) * 3

  const isBlind = stunned  // stunned = cards show as ? even if revealed

  const style = {
    width:58, height:82, borderRadius:10,
    position:'relative', flexShrink:0,
    cursor:'pointer', userSelect:'none',
    transform: selected
      ? `perspective(500px) rotateX(5deg) translateY(-26px) rotate(0deg) scale(1.09)`
      : `perspective(500px) rotateX(5deg) rotate(${angle}deg) translateY(${lift}px)`,
    transition:'transform .18s, box-shadow .18s',
    boxShadow: selected
      ? '0 0 0 3px #FFD600, 0 12px 30px rgba(0,0,0,.6)'
      : '0 4px 14px rgba(0,0,0,.55)',
    marginLeft: arcIndex===0 ? 0 : -12,
    zIndex: selected ? 10 : arcIndex,
  }

  const faceStyle = {
    position:'absolute', inset:0, borderRadius:9,
    display:'flex', alignItems:'center', justifyContent:'center',
    flexDirection:'column', gap:3,
    border:'2px solid rgba(255,255,255,.18)',
    overflow:'hidden',
    background: (isBlind || !revealed)
      ? 'linear-gradient(135deg,#1a237e 0%,#283593 50%,#1a237e 100%)'
      : special
      ? 'linear-gradient(135deg,#6a0dad,#9c27b0)'
      : '#fff',
  }

  return (
    <div style={style} onClick={onClick}>
      <div style={faceStyle}>
        {(isBlind || !revealed) ? (
          <>
            <div style={{
              position:'absolute', inset:5, borderRadius:6,
              backgroundImage:'radial-gradient(circle,rgba(255,255,255,.15) 1.5px,transparent 1.5px)',
              backgroundSize:'8px 8px',
            }}/>
            <span style={{ fontSize:22, fontFamily:"'Fredoka One',cursive", color:'rgba(255,255,255,.5)', position:'relative' }}>
              {stunned ? '💥' : '?'}
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize:28, lineHeight:1 }}>{display}</span>
            {special && <span style={{ fontSize:8, fontWeight:900, color:'rgba(255,255,255,.8)', textTransform:'uppercase', letterSpacing:.5 }}>SPECIAL</span>}
          </>
        )}
      </div>
    </div>
  )
}

// ── Player seat around the table ─────────────────────────────
function getSeatPos(relIdx, total) {
  const seats = {
    2: [
      { bottom:'13%', left:'50%', transform:'translateX(-50%)' },
      { top:'10%',    left:'50%', transform:'translateX(-50%)' },
    ],
    3: [
      { bottom:'13%', left:'50%',  transform:'translateX(-50%)' },
      { top:'12%',    left:'16%',  transform:'none' },
      { top:'12%',    right:'16%', transform:'none' },
    ],
    4: [
      { bottom:'13%', left:'50%',  transform:'translateX(-50%)' },
      { top:'50%',    left:'3%',   transform:'translateY(-50%)' },
      { top:'10%',    left:'50%',  transform:'translateX(-50%)' },
      { top:'50%',    right:'3%',  transform:'translateY(-50%)' },
    ],
    5: [
      { bottom:'13%', left:'50%',  transform:'translateX(-50%)' },
      { top:'50%',    left:'2%',   transform:'translateY(-50%)' },
      { top:'10%',    left:'20%',  transform:'none' },
      { top:'10%',    right:'20%', transform:'none' },
      { top:'50%',    right:'2%',  transform:'translateY(-50%)' },
    ],
  }
  return (seats[total] ?? seats[2])[relIdx] ?? { bottom:'13%', left:'50%', transform:'translateX(-50%)' }
}

export function PlayerSeat({ player, idx, myIdx, totalPlayers, isActive, isFrozen, isStunned, isMe }) {
  const relIdx = (idx - myIdx + totalPlayers) % totalPlayers
  const pos    = getSeatPos(relIdx, totalPlayers)
  const color  = SEAT_COLORS[idx % SEAT_COLORS.length]
  const normalCount  = player.chits.filter(c => !isSpecial(c)).length
  const specialCount = player.chits.filter(c => isSpecial(c)).length

  return (
    <div className="seat" style={{ ...pos, position:'fixed' }}>
      {/* Active glow ring */}
      {isActive && (
        <div style={{
          width:12, height:12, borderRadius:'50%',
          background:color, boxShadow:`0 0 14px ${color},0 0 28px ${color}`,
        }}/>
      )}

      {/* Name plate */}
      <div className={`seat-plate${isActive?' active':''}${isFrozen?' frozen':''}${isStunned?' stunned':''}`}
        style={{ borderColor: isActive ? color : undefined }}>
        <div className="avatar" style={{
          background:color+'22', color, width:24, height:24, fontSize:11,
          border:`1.5px solid ${color}`,
        }}>
          {initials(player.name)}
        </div>
        <span className="seat-name" style={{ color: isMe ? color : '#fff' }}>
          {player.name}{isMe ? ' (you)' : ''}
        </span>
        <span className="seat-score">{player.score>0?'+':''}{player.score}</span>
        {isFrozen  && <span style={{ fontSize:13 }}>🧊</span>}
        {isStunned && <span style={{ fontSize:13 }}>💥</span>}
        {player.isShow && <span style={{ fontSize:13 }}>🔥</span>}
      </div>

      {/* Card count */}
      <div style={{
        display:'flex', gap:5, alignItems:'center',
        padding:'3px 10px', borderRadius:12,
        background:'rgba(0,0,0,.55)', border:`1px solid ${color}33`,
      }}>
        <span style={{ fontSize:12 }}>🃏</span>
        <span style={{ fontSize:12, fontWeight:900, color:'rgba(255,255,255,.75)' }}>{player.chits.length}</span>
        {specialCount>0 && (
          <span style={{ fontSize:10, color:'#c084fc', fontWeight:900 }}>✦{specialCount}</span>
        )}
      </div>
    </div>
  )
}

// ── Hand HUD ──────────────────────────────────────────────────
export function HandHud({
  myPlayer, myRevealed, selectedChit, isMyTurn, phase,
  canCallShow, mustPassNormal, specialAction, amIStunned,
  onChitClick, onPass, onCallShow,
}) {
  if (!myPlayer) return null
  const chits   = myPlayer.chits ?? []
  const blocked = !!specialAction

  let hint = ''
  if (amIStunned && isMyTurn)              hint = '💥 You are stunned! Pass a chit blind!'
  else if (mustPassNormal)                 hint = '✨ Special used — pass a normal chit'
  else if (isMyTurn && phase==='playing')  hint = 'Tap to reveal · Select to pass'
  else if (phase==='playing')              hint = 'Tap cards to peek 👀'

  return (
    <div className="hand-hud">
      {/* Stun indicator */}
      {amIStunned && (
        <div style={{
          textAlign:'center', padding:'6px 16px', borderRadius:20,
          background:'rgba(229,57,53,.2)', border:'1px solid rgba(229,57,53,.5)',
          color:'#EF5350', fontSize:13, fontWeight:900,
          animation:'stunPulse 1s ease-in-out infinite',
        }}>
          💥 STUNNED — Pass blind!
        </div>
      )}

      {/* Fan of cards */}
      <div className="hand-cards">
        {chits.map((c, i) => (
          <HandCard
            key={i} chit={c}
            revealed={myRevealed[i] || false}
            selected={selectedChit===i}
            stunned={amIStunned}
            arcIndex={i} totalCards={chits.length}
            onClick={() => !blocked && onChitClick(i)}
          />
        ))}
        {chits.length===0 && (
          <span style={{ color:'rgba(255,255,255,.4)', fontSize:13, fontWeight:800 }}>No chits</span>
        )}
      </div>

      {hint && (
        <div style={{ textAlign:'center', fontSize:12, color:'rgba(255,255,255,.55)', fontWeight:800 }}>
          {hint}
        </div>
      )}

      <div className="action-row">
        {phase==='playing' && (isMyTurn||mustPassNormal) && (
          <button className="btn btn-blue btn-lg"
            disabled={selectedChit===-1||blocked}
            onClick={() => onPass(selectedChit)}>
            {mustPassNormal ? '📤 Pass Normal' : amIStunned ? '🙈 Pass Blind' : '📤 Pass Chit'}
          </button>
        )}
        {phase==='playing' && canCallShow && !mustPassNormal && !amIStunned && (
          <button className="btn btn-red btn-lg pulse" disabled={blocked} onClick={onCallShow}>
            🎉 SHOW!
          </button>
        )}
        {phase==='playing' && !isMyTurn && !mustPassNormal && (
          <span style={{ fontSize:12, color:'rgba(255,255,255,.4)', fontWeight:800 }}>
            Waiting for your turn…
          </span>
        )}
      </div>
    </div>
  )
}

// ── Game Log ──────────────────────────────────────────────────
export function GameLog({ logs }) {
  return (
    <div className="log-panel">
      <div className="section-label" style={{ marginBottom:6 }}>📜 LOG</div>
      {logs.slice(0,10).map((l, i) => (
        <div key={i} className="log-entry">› {l}</div>
      ))}
      {logs.length===0 && <div className="log-entry" style={{ color:'rgba(255,255,255,.25)' }}>No actions yet…</div>}
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────
export function StatusPill({ room, isMyTurn, turnPlayer, mustPassNormal, amIStunned }) {
  if (!room || room.phase==='lobby') return null
  const { phase } = room
  let cls='status-pill ', text=''
  if (phase==='playing') {
    if (amIStunned && isMyTurn) { cls+='status-show';    text='💥 You\'re stunned — pass blind!' }
    else if (mustPassNormal)    { cls+='status-playing'; text='✨ Now pass a normal chit!' }
    else if (isMyTurn)          { cls+='status-playing'; text='✋ YOUR TURN!' }
    else                        { cls+='status-wait';    text=`${turnPlayer?.name}'s turn…` }
  }
  else if (phase==='showWindow')              { cls+='status-show';     text='🎉 SHOW WINDOW OPEN!' }
  else if (phase==='afterShow')               { cls+='status-show';     text='👀 Revealing hands…' }
  else if (phase==='roundEnd')                { cls+='status-roundend'; text=`⚡ Round ${room.round} done!` }
  else if (phase==='randomSnatching')         { cls+='status-show';     text='🎲 Random Snatch!' }
  else if (phase==='stunGrenade')             { cls+='status-show';     text='💥 Stun Grenade!' }
  if (!text) return null
  return <div className={cls}>{text}</div>
}

// ── Show window overlay ───────────────────────────────────────
export function ShowWindowOverlay({ countdown, canJoinShow, hasJoinedShow, onJoinShow }) {
  return (
    <div className="countdown-ring" style={{ pointerEvents:'auto' }}>
      <div className="countdown-num bounce">{countdown}</div>
      <div className="countdown-label">seconds left</div>
      {canJoinShow && (
        <button className="btn btn-red btn-xl pulse" style={{ marginTop:16 }} onClick={onJoinShow}>
          🎉 JOIN SHOW!
        </button>
      )}
      {hasJoinedShow && (
        <div className="btn btn-green" style={{ marginTop:16, pointerEvents:'none' }}>
          ✓ YOU'RE IN!
        </div>
      )}
    </div>
  )
}

// ── Round end controls ────────────────────────────────────────
export function RoundEndControls({ isHost, onNextRound, onEndGame }) {
  return (
    <div className="round-end-controls">
      {isHost ? (
        <>
          <button className="btn btn-green btn-lg" onClick={onNextRound}>▶ Next Round</button>
          <button className="btn btn-white"        onClick={onEndGame}>End Game</button>
        </>
      ) : (
        <div style={{ padding:'10px 18px', borderRadius:30, background:'rgba(0,0,0,.6)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,.12)', fontSize:13, fontWeight:800, color:'rgba(255,255,255,.6)' }}>
          ⏳ Waiting for host…
        </div>
      )}
    </div>
  )
}

// ── End Screen ────────────────────────────────────────────────
export function EndScreen({ room, onPlayAgain, onLeave }) {
  const sorted = [...room.players].sort((a,b) => b.score-a.score)
  return (
    <div className="overlay">
      <div className="overlay-inner">
        <div className="panel" style={{ padding:'28px 24px', textAlign:'center' }}>
          <div style={{ fontSize:60, marginBottom:'.5rem' }} className="bounce">🏆</div>
          <h2 style={{
            fontFamily:"'Fredoka One',cursive", fontSize:'2.2rem', marginBottom:'.3rem',
            background:'linear-gradient(135deg,#E53935,#FFD600,#1E88E5,#43A047)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
          }}>GAME OVER!</h2>
          <p style={{ color:'rgba(255,255,255,.55)', fontSize:13, fontWeight:800, marginBottom:'1.5rem' }}>
            {sorted[0]?.name} wins with <span style={{ color:'#FFD600', fontFamily:"'Fredoka One',cursive", fontSize:18 }}>{sorted[0]?.score}</span> pts!
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:'1.5rem', textAlign:'left' }}>
            {sorted.map((p, i) => {
              const pidx = room.players.findIndex(pl => pl.id===p.id)
              const sc   = SEAT_COLORS[pidx % SEAT_COLORS.length]
              return (
                <div key={p.id} className={`score-row${i===0?' first':''}`}>
                  <span style={{ fontSize:20, width:26 }}>{MEDALS[i]}</span>
                  <div className="avatar" style={{ background:sc+'22', color:sc, border:`1.5px solid ${sc}` }}>
                    {initials(p.name)}
                  </div>
                  <span style={{ flex:1, fontSize:13, fontWeight:900, color:'#fff' }}>{p.name}</span>
                  <span style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:i===0?'#FFD600':'rgba(255,255,255,.45)' }}>
                    {p.score}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="btn-row" style={{ justifyContent:'center', gap:10 }}>
            <button className="btn btn-yellow btn-lg" onClick={onPlayAgain}>🔄 Play Again</button>
            <button className="btn btn-ghost"         onClick={onLeave}>Leave</button>
          </div>
        </div>
      </div>
    </div>
  )
}