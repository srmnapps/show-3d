import { useState } from 'react'
import { WsStatus } from './UI.jsx'
import { AVATAR_COLORS, SEAT_COLORS, SPECIALS } from '../utils/game.js'
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
        <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:520, display:'flex', flexDirection:'column', alignItems:'center' }}>

          {/* Floating cards */}
          {[
            { emoji:'🃏', top:'-8%',  left:'-6%',  rot:-15, delay:0 },
            { emoji:'🎴', top:'-10%', right:'-8%', rot:12,  delay:.3 },
            { emoji:'🃏', bottom:'-8%',left:'-5%', rot:8,   delay:.6 },
            { emoji:'🎴', bottom:'-6%',right:'-6%',rot:-10, delay:.9 },
          ].map(({ emoji, rot, delay, ...pos }, i) => (
            <div key={i} style={{
              position:'absolute', fontSize:36, opacity:.22,
              animation:`bounce ${1.6+i*.25}s ease-in-out infinite`,
              animationDelay:`${delay}s`,
              transform:`rotate(${rot}deg)`,
              ...pos,
            }}>{emoji}</div>
          ))}

          <div className="logo-title">SHOW</div>
          <div className="logo-sub">Telugu Chit Matching Game · 2–5 Players</div>

          {/* Sample cards */}
          <div style={{ display:'flex', gap:8, marginBottom:32, position:'relative' }}>
            {[
              { bg:'#E53935', emoji:'🍎', rot:-12, lift:10 },
              { bg:'#1E88E5', emoji:'🍋', rot:-5,  lift:4  },
              { bg:'#43A047', emoji:'🍇', rot:0,   lift:0  },
              { bg:'#FFD600', emoji:'🍓', rot:5,   lift:4  },
              { bg:'#AA00FF', emoji:'🔥', rot:12,  lift:10 },
            ].map(({ bg, emoji, rot, lift }, i) => (
              <div key={i} style={{
                width:52, height:72, borderRadius:10,
                background:`linear-gradient(145deg,${bg}CC,${bg})`,
                border:'2px solid rgba(255,255,255,.25)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:26, boxShadow:`0 4px 16px ${bg}66`,
                transform:`rotate(${rot}deg) translateY(${lift}px)`,
                animation:`floatCard ${1.8+i*.2}s ease-in-out infinite`,
                animationDelay:`${i*.25}s`,
                '--r': `${rot}deg`,
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
                <input className="input" placeholder="Enter your name…"
                  value={name} maxLength={18}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter'&&t) onPlay(t) }}
                  autoFocus />
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

          <div style={{ marginTop:24, color:'rgba(255,255,255,.35)', fontSize:12, fontWeight:800 }}>
            Scroll down to learn how to play ↓
          </div>
        </div>
      </div>

      {/* How to Play */}
      <div className="how-to-play">
        <h2 className="how-title">How to Play</h2>
        <div className="rules-grid">
          {[
            { icon:'🃏', title:'Get Your Chits',    desc:'Each player gets 6 chits — 4 normal emoji chits and 2 random special power cards.' },
            { icon:'👁', title:'Peek Your Hand',    desc:'Tap your cards to secretly reveal them. Only YOU can see your own chits!' },
            { icon:'📤', title:'Pass a Chit',       desc:'On your turn, select a chit and pass it face-down to the next player.' },
            { icon:'🎉', title:'Call SHOW!',        desc:'Get 4 matching normal chits and call SHOW! to win the round and score big.' },
            { icon:'⏱', title:'Join the Show',     desc:'After someone calls SHOW!, a 5-second window opens. Click to join and score!' },
            { icon:'🏆', title:'Score Points',      desc:'Points = (players+2)×10. 1st caller gets most, last gets 0. Strategy matters!' },
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
            { cls:'reverse',  emoji:'🔄', name:'Reverse',        desc:'Flip passing direction for the rest of the round.' },
            { cls:'freeze',   emoji:'🧊', name:'Freeze',          desc:'Freeze the next player — they skip their turn.' },
            { cls:'blind',    emoji:'🎲', name:'Blind Snatch',    desc:'Pick any player and steal a random chit from them blind!' },
            { cls:'revealed', emoji:'👁', name:'Revealed Snatch', desc:'Pick a player, see 2 of their chits, then take one.' },
            { cls:'stun',     emoji:'💥', name:'Stun Grenade',    desc:'Screen flashes white — target\'s chits all go hidden!' },
            { cls:'vitals',   emoji:'📊', name:'Vitals',          desc:'See a match probability report for all other players.' },
            { cls:'svitals',  emoji:'⚡', name:'Super Vitals',    desc:'Instantly know if anyone can call SHOW right now!' },
            { cls:'nuke',     emoji:'💣', name:'Nuke',            desc:'Destroy one of a target player\'s special cards!' },
            { cls:'puppet',   emoji:'🎭', name:'Puppeteer',       desc:'Control another player\'s entire turn — see their hand!' },
            { cls:'pswap',    emoji:'🔀', name:'Position Swap',   desc:'Swap turn-order position with any player this round.' },
          ].map(({ cls, emoji, name, desc }) => (
            <div key={name} className={`special-card ${cls}`}>
              <div className="special-emoji">{emoji}</div>
              <div className="special-name">{name}</div>
              <div className="special-desc">{desc}</div>
            </div>
          ))}
        </div>

        {/* Game Modes */}
        <h2 className="how-title" style={{ marginTop:8 }}>Game Modes</h2>
        <div className="rules-grid" style={{ gridTemplateColumns:'1fr 1fr' }}>
          <div className="rule-card" style={{ borderColor:'rgba(30,136,229,.4)', background:'rgba(30,136,229,.08)' }}>
            <div className="rule-icon">🎯</div>
            <div className="rule-title" style={{ color:'#42A5F5' }}>Normal Mode</div>
            <div className="rule-desc">4 normal chits each. Pure strategy, no specials. Great for beginners.</div>
          </div>
          <div className="rule-card" style={{ borderColor:'rgba(170,0,255,.4)', background:'rgba(170,0,255,.08)' }}>
            <div className="rule-icon">✨</div>
            <div className="rule-title" style={{ color:'#CC44FF' }}>Special Mode</div>
            <div className="rule-desc">4 normal + 2 random specials. Chaos, strategy and surprises!</div>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:32, paddingBottom:40 }}>
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

// ── Create / Join choice ──────────────────────────────────────
export function CreateJoinScreen({ name, onCreate, onGoJoin, onBack }) {
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
          <button className="btn btn-blue" style={{ width:'100%', fontSize:15 }} onClick={onGoJoin}>
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
export function LobbyScreen({ room, me, isHost, wsStatus, onStart, onLeave, onSetMode, setHandSetup, setEnabledSpecials }) {
  const [copied, setCopied] = useState(false)
  async function doCopy() {
    await copyToClipboard(room.code)
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  const mode     = room.mode ?? 'special'
  const settings = room.settings ?? { normalCount: 4, specialCount: 2, enabledSpecials: SPECIALS.map(s => s.type) }

  return (
    <div className="overlay">
      <div className="overlay-inner">
        <div className="panel" style={{ padding:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <h2 style={{ fontFamily:"'Fredoka One',cursive", fontSize:'1.5rem', color:'#fff' }}>🏠 Lobby</h2>
            <WsStatus status={wsStatus} />
          </div>

          {/* Room code */}
          <div style={{ textAlign:'center', marginBottom:'1.25rem', padding:'16px', borderRadius:14, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)' }}>
            <div className="section-label" style={{ marginBottom:6 }}>Share this code!</div>
            <div className="room-code-display">{room.code}</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={doCopy}>
              {copied ? '✓ Copied!' : '⎘ Copy Code'}
            </button>
          </div>

          {/* Mode toggle */}
          <div style={{ marginBottom:'1.25rem' }}>
            <div className="section-label" style={{ marginBottom:8 }}>Game Mode</div>
            <div className="mode-toggle">
              <button className={`mode-btn${mode==='normal'?' active-normal':''}`}
                onClick={() => isHost && onSetMode('normal')} disabled={!isHost}>
                🎯 Normal
              </button>
              <button className={`mode-btn${mode==='special'?' active-special':''}`}
                onClick={() => isHost && onSetMode('special')} disabled={!isHost}>
                ✨ Special
              </button>
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:6, fontWeight:700, textAlign:'center' }}>
              {mode==='normal' ? '4 normal chits only — no specials' : '4 normal + 2 random special chits'}
            </div>
          </div>

          {/* Game Setup — special mode only */}
          {mode === 'special' && (
            <div style={{ marginBottom:'1.25rem' }}>
              <div className="section-label" style={{ marginBottom:8 }}>Hand Setup</div>
              <div className="mode-toggle">
                <button
                  className={`mode-btn${settings.normalCount === 4 ? ' active-normal' : ''}`}
                  onClick={() => isHost && setHandSetup(4, 2)} disabled={!isHost}
                >
                  Classic · 4+2
                </button>
                <button
                  className={`mode-btn${settings.normalCount === 8 ? ' active-special' : ''}`}
                  onClick={() => isHost && setHandSetup(8, 4)} disabled={!isHost}
                >
                  Extended · 8+4
                </button>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:6, fontWeight:700, textAlign:'center' }}>
                {settings.normalCount === 4 ? '4 normal + 2 special per player' : '8 normal + 4 special per player'}
              </div>

              <div className="section-label" style={{ marginTop:12, marginBottom:8 }}>Special Cards</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {SPECIALS.map(s => {
                  const on = (settings.enabledSpecials ?? SPECIALS.map(x => x.type)).includes(s.type)
                  return (
                    <button key={s.type}
                      disabled={!isHost}
                      onClick={() => {
                        if (!isHost) return
                        const cur  = settings.enabledSpecials ?? SPECIALS.map(x => x.type)
                        const next = on ? cur.filter(t => t !== s.type) : [...cur, s.type]
                        if (next.length > 0) setEnabledSpecials(next)
                      }}
                      style={{
                        padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:800,
                        border:`1px solid ${on ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.09)'}`,
                        background: on ? 'rgba(255,255,255,.11)' : 'rgba(0,0,0,.15)',
                        color: on ? '#fff' : 'rgba(255,255,255,.28)',
                        cursor: isHost ? 'pointer' : 'default',
                        transition:'all .15s',
                      }}
                    >
                      {s.emoji} {s.name}
                    </button>
                  )
                })}
              </div>
              {!isHost && (
                <div style={{ fontSize:10, color:'rgba(255,255,255,.25)', marginTop:6, fontWeight:700 }}>
                  Only the host can change settings
                </div>
              )}
            </div>
          )}

          {/* Players */}
          <div className="section-label">Players ({room.players.length}/5)</div>
          <div style={{ marginBottom:14, maxHeight:180, overflowY:'auto' }}>
            {room.players.map((p, i) => {
              const sc = SEAT_COLORS[i % SEAT_COLORS.length]
              return (
                <div key={p.id} className="lobby-player">
                  <div className="avatar" style={{ background:`${sc}22`, color:sc, border:`1.5px solid ${sc}` }}>
                    {initials(p.name)}
                  </div>
                  <span style={{ flex:1, fontSize:13, fontWeight:900 }}>{p.name}</span>
                  {p.id===me.id       && <span style={{ fontSize:10, fontWeight:900, color:sc, background:`${sc}22`, padding:'2px 8px', borderRadius:10, border:`1px solid ${sc}44` }}>You</span>}
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
          {!isHost && <p style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:10, textAlign:'center', fontWeight:800 }}>⏳ Waiting for host…</p>}
          {isHost && room.players.length<2 && <p style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:10, textAlign:'center', fontWeight:800 }}>Need at least 2 players.</p>}
        </div>
      </div>
    </div>
  )
}