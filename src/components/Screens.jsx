import { useState } from 'react'
import { WsStatus } from './UI.jsx'
import { AVATAR_COLORS, SEAT_COLORS } from '../utils/game.js'
import { initials, copyToClipboard } from '../utils/helpers.js'

// ── Landing Page ──────────────────────────────────────────────
export function LandingPage({ onPlay }) {
  const [showPlay, setShowPlay] = useState(false)
  const [name, setName] = useState('')
  const t = name.trim()

  return (
    <div className="landing-page">
      {/* Hero */}
      <div className="landing-hero">
        <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:500, display:'flex', flexDirection:'column', alignItems:'center' }}>

          {/* Floating card decorations */}
          {['🃏','🎴','🃏','🎴'].map((c,i) => (
            <div key={i} style={{
              position:'absolute', fontSize:32, opacity:.25,
              top: i<2 ? '-10%' : '110%',
              left: i%2===0 ? '-8%' : '108%',
              animation:`bounce ${1.5+i*.3}s ease-in-out infinite`,
              animationDelay:`${i*.4}s`,
            }}>{c}</div>
          ))}

          <div className="logo-title">SHOW</div>
          <div className="logo-sub">Telugu Chit Matching Game · 2–5 Players</div>

          {/* UNO-style 4 colored card suits */}
          <div style={{ display:'flex', gap:10, marginBottom:32 }}>
            {[
              { bg:'#E53935', emoji:'🍎' },
              { bg:'#1E88E5', emoji:'🍋' },
              { bg:'#43A047', emoji:'🍇' },
              { bg:'#FFD600', emoji:'🍓' },
            ].map(({ bg, emoji }, i) => (
              <div key={i} style={{
                width:52, height:72, borderRadius:10,
                background:`linear-gradient(145deg,${bg}CC,${bg})`,
                border:'2px solid rgba(255,255,255,.25)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:26, boxShadow:`0 4px 16px ${bg}66`,
                transform:`rotate(${(i-1.5)*6}deg)`,
                animation:`floatCard ${1.8+i*.2}s ease-in-out infinite`,
                animationDelay:`${i*.3}s`,
              }}>{emoji}</div>
            ))}
          </div>

          {!showPlay ? (
            <button className="btn btn-green btn-xl" onClick={() => setShowPlay(true)}>
              🎮 Play Now
            </button>
          ) : (
            <div className="name-entry fade-up">
              <div className="input-group">
                <label className="input-label">Your Name</label>
                <input
                  className="input" placeholder="Enter your name…"
                  value={name} maxLength={18}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter' && t) onPlay(t) }}
                  autoFocus
                />
              </div>
              <button className="btn btn-green" style={{ width:'100%', marginBottom:8, fontSize:16 }}
                disabled={!t} onClick={() => onPlay(t)}>
                ✦ Let's Play!
              </button>
              <button className="btn btn-ghost" style={{ width:'100%' }} onClick={() => setShowPlay(false)}>
                ← Back
              </button>
            </div>
          )}

          <div style={{ marginTop:24, color:'rgba(255,255,255,.4)', fontSize:12, fontWeight:800 }}>
            Scroll down to learn how to play ↓
          </div>
        </div>
      </div>

      {/* How to Play */}
      <div className="how-to-play">
        <h2 className="how-title">How to Play</h2>

        <div className="rules-grid">
          {[
            { icon:'🃏', title:'Get Your Chits', desc:'Each player gets 6 chits — 4 normal emoji chits and 2 special power cards.' },
            { icon:'👁', title:'Peek Your Hand', desc:'Tap your cards to secretly reveal them. Only YOU can see your own chits!' },
            { icon:'📤', title:'Pass a Chit', desc:'On your turn, select a chit and pass it to the next player. Strategy is key!' },
            { icon:'🎉', title:'Call SHOW!', desc:'Get 4 matching normal chits and call SHOW! to win the round and score big.' },
            { icon:'⏱', title:'Join the Show', desc:'After someone calls SHOW!, a 5-second window opens. Join to score too!' },
            { icon:'🏆', title:'Score Points', desc:'1st show = most points. Position matters. Last to join gets fewest points.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rule-card">
              <div className="rule-icon">{icon}</div>
              <div className="rule-title">{title}</div>
              <div className="rule-desc">{desc}</div>
            </div>
          ))}
        </div>

        <h2 className="how-title" style={{ marginTop:8 }}>Special Cards</h2>
        <div className="specials-grid">
          {[
            { cls:'reverse', emoji:'🔄', name:'Reverse', desc:'Flip the passing direction for the rest of the round. Catch opponents off guard!' },
            { cls:'freeze',  emoji:'🧊', name:'Freeze',  desc:'Freeze the next player! They skip their turn and must pass blindly.' },
            { cls:'snatch',  emoji:'🎲', name:'Random Snatch', desc:'Pick any player and steal a random chit from them — they won\'t know which one!' },
            { cls:'stun',    emoji:'💥', name:'Stun Grenade',  desc:'Blast a player! Their screen flashes white and all their chits go hidden again.' },
          ].map(({ cls, emoji, name, desc }) => (
            <div key={name} className={`special-card ${cls}`}>
              <div className="special-emoji">{emoji}</div>
              <div className="special-name">{name}</div>
              <div className="special-desc">{desc}</div>
            </div>
          ))}
        </div>

        {/* Modes */}
        <h2 className="how-title" style={{ marginTop:8 }}>Game Modes</h2>
        <div className="rules-grid" style={{ gridTemplateColumns:'1fr 1fr' }}>
          <div className="rule-card" style={{ borderColor:'rgba(30,136,229,.4)', background:'rgba(30,136,229,.08)' }}>
            <div className="rule-icon">🎯</div>
            <div className="rule-title" style={{ color:'#42A5F5' }}>Normal Mode</div>
            <div className="rule-desc">4 normal chits each. Pure strategy — no special cards. Perfect for beginners.</div>
          </div>
          <div className="rule-card" style={{ borderColor:'rgba(170,0,255,.4)', background:'rgba(170,0,255,.08)' }}>
            <div className="rule-icon">✨</div>
            <div className="rule-title" style={{ color:'#CC44FF' }}>Special Mode</div>
            <div className="rule-desc">4 normal + 2 special chits each. Chaos, strategy and surprises. For the bold!</div>
          </div>
        </div>

        {/* CTA at bottom */}
        <div style={{ textAlign:'center', marginTop:32, paddingBottom:32 }}>
          <button className="btn btn-green btn-xl" onClick={() => {
            window.scrollTo({ top:0, behavior:'smooth' })
            setTimeout(() => setShowPlay(true), 400)
          }}>
            🎮 Start Playing!
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create / Join choice screen ───────────────────────────────
export function CreateJoinScreen({ name, onCreate, onJoin: goJoin, onBack }) {
  return (
    <div className="join-wrap">
      <div className="join-inner">
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div className="logo-title" style={{ fontSize:'3.5rem' }}>SHOW</div>
          <div className="logo-sub">Welcome, <strong style={{ color:'#fff' }}>{name}</strong>!</div>
        </div>
        <div className="name-entry">
          <button className="btn btn-green" style={{ width:'100%', marginBottom:12, fontSize:16 }} onClick={onCreate}>
            ✦ Create Room
          </button>
          <div className="divider">or</div>
          <button className="btn btn-blue" style={{ width:'100%', fontSize:15 }} onClick={goJoin}>
            🚪 Join a Room
          </button>
          <button className="btn btn-ghost" style={{ width:'100%', marginTop:10 }} onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Join Screen ───────────────────────────────────────────────
export function JoinScreen({ name, onJoin, onBack, errorMsg }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    if (!code.trim()) return
    setBusy(true)
    await onJoin(code.trim().toUpperCase(), () => setBusy(false))
  }
  return (
    <div className="join-wrap">
      <div className="join-inner">
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div className="logo-title" style={{ fontSize:'3.5rem' }}>SHOW</div>
          <div className="logo-sub">Enter the room code</div>
        </div>
        <div className="name-entry">
          <div className="input-group">
            <label className="input-label">Room Code</label>
            <input className="input input-code" placeholder="SHOW-XXXX"
              value={code} maxLength={9}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key==='Enter') go() }}
              autoFocus />
          </div>
          {errorMsg && <p className="error-msg" style={{ marginBottom:10 }}>{errorMsg}</p>}
          <button className="btn btn-blue" style={{ width:'100%', marginBottom:8, fontSize:16 }}
            disabled={busy||!code.trim()} onClick={go}>
            {busy ? '⏳ Joining…' : '🚀 Join Room'}
          </button>
          <button className="btn btn-ghost" style={{ width:'100%' }} onClick={onBack}>← Back</button>
        </div>
      </div>
    </div>
  )
}

// ── Lobby Screen ──────────────────────────────────────────────
export function LobbyScreen({ room, me, isHost, wsStatus, onStart, onLeave, onSetMode }) {
  const [copied, setCopied] = useState(false)
  async function doCopy() {
    await copyToClipboard(room.code)
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  const mode = room.mode ?? 'special'

  return (
    <div className="overlay">
      <div className="overlay-inner">
        <div className="panel" style={{ padding:'24px' }}>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <h2 style={{ fontFamily:"'Fredoka One',cursive", fontSize:'1.5rem', color:'#fff' }}>🏠 Lobby</h2>
            <WsStatus status={wsStatus} />
          </div>

          {/* Room code */}
          <div style={{
            textAlign:'center', marginBottom:'1.25rem', padding:'16px',
            borderRadius:14, background:'rgba(255,255,255,.05)',
            border:'1px solid rgba(255,255,255,.12)',
          }}>
            <div className="section-label" style={{ marginBottom:6 }}>Share this code!</div>
            <div className="room-code-display">{room.code}</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={doCopy}>
              {copied ? '✓ Copied!' : '⎘ Copy Code'}
            </button>
          </div>

          {/* Mode toggle — host only */}
          <div style={{ marginBottom:'1.25rem' }}>
            <div className="section-label" style={{ marginBottom:8 }}>Game Mode</div>
            <div className="mode-toggle">
              <button
                className={`mode-btn${mode==='normal' ? ' active-normal' : ''}`}
                onClick={() => isHost && onSetMode('normal')}
                disabled={!isHost}
              >
                🎯 Normal
              </button>
              <button
                className={`mode-btn${mode==='special' ? ' active-special' : ''}`}
                onClick={() => isHost && onSetMode('special')}
                disabled={!isHost}
              >
                ✨ Special
              </button>
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:6, fontWeight:700, textAlign:'center' }}>
              {mode==='normal'
                ? '4 normal chits each — no specials'
                : '4 normal + 2 special chits each'}
            </div>
          </div>

          {/* Players */}
          <div className="section-label">Players ({room.players.length}/5)</div>
          <div style={{ marginBottom:14, maxHeight:180, overflowY:'auto' }}>
            {room.players.map((p, i) => {
              const ac = AVATAR_COLORS[p.color] ?? AVATAR_COLORS[0]
              const sc = SEAT_COLORS[i % SEAT_COLORS.length]
              return (
                <div key={p.id} className="lobby-player">
                  <div className="avatar" style={{ background:sc+'22', color:sc, border:`1.5px solid ${sc}` }}>
                    {initials(p.name)}
                  </div>
                  <span style={{ flex:1, fontSize:13, fontWeight:900 }}>{p.name}</span>
                  {p.id===me.id       && <span style={{ fontSize:10, fontWeight:900, color:sc, background:sc+'22', padding:'2px 8px', borderRadius:10, border:`1px solid ${sc}44` }}>You</span>}
                  {room.hostId===p.id && <span style={{ fontSize:10, fontWeight:900, color:'#FFD600', background:'rgba(255,214,0,.1)', padding:'2px 8px', borderRadius:10, border:'1px solid rgba(255,214,0,.3)', marginLeft:4 }}>Host</span>}
                  <span className="online-dot" />
                </div>
              )
            })}
          </div>

          <div className="btn-row">
            <button className="btn btn-green btn-lg"
              disabled={!isHost||room.players.length<2} onClick={onStart}>
              ▶ Start Game
            </button>
            <button className="btn btn-ghost" onClick={onLeave}>Leave</button>
          </div>
          {!isHost && <p style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:10, textAlign:'center', fontWeight:800 }}>⏳ Waiting for host…</p>}
          {isHost && room.players.length<2 && <p style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:10, textAlign:'center', fontWeight:800 }}>Need at least 2 players.</p>}
        </div>
      </div>
    </div>
  )
}