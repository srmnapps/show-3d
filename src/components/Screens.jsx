// show-3d/src/components/Screens.jsx

import { useEffect, useState } from 'react'
import { WsStatus } from './UI.jsx'
import { AVATAR_COLORS, SEAT_COLORS, SPECIALS } from '../utils/game.js'
import { initials, copyToClipboard } from '../utils/helpers.js'
import { playSound } from '../utils/sounds.js'

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
          <div className="logo-sub">Card Matching Game · 2–5 Players</div>

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
            <button className="btn btn-green btn-xl" onClick={() => { playSound('button'); setShowPlay(true) }}>
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
              <button className="btn btn-ghost" style={{ width:'100%' }} onClick={() => { playSound('button'); setShowPlay(false) }}>
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

        {/* Smart Bots */}
        <h2 className="how-title" style={{ marginTop:8 }}>🤖 Smart Bots</h2>
        <div className="rules-grid" style={{ gridTemplateColumns:'1fr' }}>
          <div className="rule-card" style={{ borderColor:'rgba(67,160,71,.35)', background:'rgba(67,160,71,.07)' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:16, justifyContent:'center' }}>
              {[
                { icon:'➕', text:'Add bots before starting to fill empty seats' },
                { icon:'🔄', text:'Disconnected players are instantly bot-controlled' },
                { icon:'🧠', text:'Bots keep matching cards, pass weak ones, call SHOW when ready' },
                { icon:'🚪', text:'No bot-only rooms — empty lobbies clean up automatically' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display:'flex', alignItems:'flex-start', gap:10, minWidth:200, flex:'1 1 200px' }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
                  <span style={{ fontSize:13, color:'rgba(255,255,255,.75)', fontWeight:700, lineHeight:1.4 }}>{text}</span>
                </div>
              ))}
            </div>
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
export function CreateJoinScreen({ name, onCreate, onCreatePublic, onGoJoin, onBrowse, onBack }) {
  return (
    <div className="join-wrap">
      <div className="join-inner">
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div className="logo-title" style={{ fontSize:'3.5rem' }}>SHOW</div>
          <div className="logo-sub">Welcome, <strong style={{ color:'#fff' }}>{name}</strong>!</div>
        </div>

        <div className="name-entry">

          {/* Private section */}
          <div style={sectionLabel}>🔒 Private Game</div>
          <button className="btn btn-green" style={{ width:'100%', marginBottom:8, fontSize:15 }} onClick={onCreate}>
            ✦ Create Private Room
          </button>
          <button className="btn btn-blue" style={{ width:'100%', marginBottom:16, fontSize:15 }} onClick={onGoJoin}>
            🚪 Join with Code
          </button>

          <div className="divider">or</div>

          {/* Public section */}
          <div style={sectionLabel}>🌐 Public Game</div>
          <button className="btn btn-green" style={{ width:'100%', marginBottom:8, fontSize:15, background:'#7B1FA2' }} onClick={onCreatePublic}>
            ✦ Create Public Room
          </button>
          <button className="btn btn-blue" style={{ width:'100%', marginBottom:16, fontSize:15, background:'#0288D1' }} onClick={onBrowse}>
            🔍 Browse Public Rooms
          </button>

          <button className="btn btn-ghost" style={{ width:'100%', marginTop:4 }} onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Public Lobby Browser ──────────────────────────────────────
export function PublicLobbyScreen({ name, publicRooms, onJoin, onRefresh, onBack, loading }) {
  useEffect(() => {
    onRefresh()
    const t = setInterval(onRefresh, 5000)
    return () => clearInterval(t)
  }, [onRefresh])

  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000)
    if (s < 60)  return `${s}s ago`
    if (s < 3600) return `${Math.floor(s/60)}m ago`
    return `${Math.floor(s/3600)}h ago`
  }

  return (
    <div className="join-wrap">
      <div className="join-inner" style={{ maxWidth: 560 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div className="logo-title" style={{ fontSize:'2.5rem', lineHeight:1 }}>SHOW</div>
            <div className="logo-sub" style={{ marginTop:2 }}>🌐 Public Rooms</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh} title="Refresh">
            🔄 Refresh
          </button>
        </div>

        {/* Room list */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:200 }}>
          {loading && publicRooms.length === 0 && (
            <div style={emptyStyle}>⏳ Loading rooms…</div>
          )}
          {!loading && publicRooms.length === 0 && (
            <div style={emptyStyle}>
              <div style={{ fontSize:40, marginBottom:8 }}>🏜️</div>
              <div>No public rooms open right now.</div>
              <div style={{ fontSize:12, marginTop:4, opacity:.6 }}>Be the first — create a public room!</div>
            </div>
          )}
          {publicRooms.map(r => (
            <div key={r.code} style={roomCardStyle}>
              {/* Left info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontWeight:900, fontSize:15, color:'#fff' }}>{r.hostName}'s Room</span>
                  <span style={modeBadge(r.mode)}>{r.mode === 'special' ? '✨ Special' : '🎯 Normal'}</span>
                </div>
                <div style={{ display:'flex', gap:12, fontSize:12, color:'rgba(255,255,255,.55)', flexWrap:'wrap' }}>
                  <span>🔑 {r.code}</span>
                  <span>👥 {r.playerCount}/{r.maxPlayers} players</span>
                  <span>🕐 {timeAgo(r.createdAt)}</span>
                </div>
              </div>
              {/* Join button */}
              <button
                className="btn btn-blue"
                style={{ flexShrink:0, fontSize:13, padding:'6px 16px' }}
                disabled={r.playerCount >= r.maxPlayers}
                onClick={() => onJoin(r.code)}
              >
                {r.playerCount >= r.maxPlayers ? '🔴 Full' : '➜ Join'}
              </button>
            </div>
          ))}
        </div>

        <button className="btn btn-ghost" style={{ width:'100%', marginTop:16 }} onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  )
}

// ── Join Screen ───────────────────────────────────────────────
// initialCode: pre-filled from URL (share link)
// If name is empty (visitor via link), shows a name input too
export function JoinScreen({ name, onJoin, onBack, errorMsg, initialCode = '' }) {
  const [code,      setCode]      = useState(initialCode)
  const [localName, setLocalName] = useState('')
  const [busy,      setBusy]      = useState(false)

  const needsName    = !name
  const effectiveName = name || localName.trim()

  async function go() {
    if (!code.trim() || !effectiveName) return
    playSound('button')
    setBusy(true)
    await onJoin(code.trim().toUpperCase(), needsName ? localName.trim() : undefined, () => setBusy(false))
  }

  return (
    <div className="join-wrap">
      <div className="join-inner">
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div className="logo-title" style={{ fontSize:'3.5rem' }}>SHOW</div>
          <div className="logo-sub">
            {needsName ? 'Join a room' : 'Enter the room code'}
          </div>
        </div>
        <div className="name-entry">
          {/* Name field — only shown when visiting via share link */}
          {needsName && (
            <div className="input-group" style={{ marginBottom:12 }}>
              <label className="input-label">Your Name</label>
              <input className="input" placeholder="Enter your name…"
                value={localName} maxLength={18}
                onChange={e => setLocalName(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter') go() }}
                autoFocus />
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Room Code</label>
            <input className="input input-code" placeholder="XXXX"
              value={code} maxLength={9}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key==='Enter') go() }}
              autoFocus={!needsName} />
          </div>
          {errorMsg && <p className="error-msg" style={{ marginBottom:10 }}>{errorMsg}</p>}
          <button className="btn btn-blue" style={{ width:'100%', marginBottom:8, fontSize:16 }}
            disabled={busy || !code.trim() || !effectiveName} onClick={go}>
            {busy ? '⏳ Joining…' : '🚀 Join Room'}
          </button>
          <button className="btn btn-ghost" style={{ width:'100%' }} onClick={onBack}>← Back</button>
        </div>
      </div>
    </div>
  )
}

// ── Lobby Screen ──────────────────────────────────────────────
export function LobbyScreen({ room, me, isHost, wsStatus, onStart, onLeave, onSetMode, setHandSetup, setEnabledSpecials, isPublic, onToggleVisibility, onAddBot, onRemoveBot }) {
  const [copied,    setCopied]    = useState(false)
  const [specsOpen, setSpecsOpen] = useState(() => window.innerWidth >= 900)

  async function doCopy() {
    playSound('button')
    await copyToClipboard(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const mode            = room.mode ?? 'special'
  const settings        = room.settings ?? { normalCount: 4, specialCount: 2, enabledSpecials: SPECIALS.map(s => s.type) }
  const enabledSpecials = settings.enabledSpecials ?? SPECIALS.map(s => s.type)

  return (
    <div className="lobby-wrap">
      <div className="lobby-panel panel">

        {/* Header */}
        <div className="lobby-header">
          <h2 className="lobby-title">🏠 Lobby</h2>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={visibilityBadge(isPublic)}>
                {isPublic ? '🌐 Public' : '🔒 Private'}
              </span>
              {isHost && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={onToggleVisibility}
                  title={isPublic ? 'Make Private' : 'Make Public'}
                  style={{ fontSize:11, padding:'3px 8px' }}
                >
                  Switch
                </button>
              )}
            </div>
            <WsStatus status={wsStatus} />
          </div>
        </div>

        {/* Two-column content grid */}
        <div className="lobby-content">

          {/* Left: Room code + Players */}
          <div className="lobby-left">
            <div className="lobby-code-box">
              <div className="section-label" style={{ marginBottom: 6 }}>
                {isPublic ? 'Room Code (public)' : 'Share this code!'}
              </div>
              <div className="room-code-display">{room.code}</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={doCopy}>
                {copied ? '✓ Copied!' : '⎘ Copy Code'}
              </button>
            </div>

            <div>
              <div className="section-label">Players ({room.players.length}/5)</div>
              <div className="lobby-players">
                {room.players.map((p, i) => {
                  const sc = SEAT_COLORS[i % SEAT_COLORS.length]
                  return (
                    <div key={p.id} className="lobby-player">
                      <div className="avatar" style={{ background: `${sc}22`, color: sc, border: `1.5px solid ${sc}` }}>
                        {initials(p.name)}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 900 }}>{p.name}</span>
                      {/* Status badges */}
                      {p.isBot && (
                        <span style={botBadgeStyle}>🤖 BOT</span>
                      )}
                      {p.botActive && (
                        <span style={autoBadgeStyle}>AUTO</span>
                      )}
                      {p.online === false && (
                        <span style={offlineBadgeStyle}>OFFLINE</span>
                      )}
                      {p.id === me.id && (
                        <span style={{ fontSize: 10, fontWeight: 900, color: sc, background: `${sc}22`, padding: '2px 8px', borderRadius: 10, border: `1px solid ${sc}44` }}>You</span>
                      )}
                      {room.hostId === p.id && (
                        <span style={{ fontSize: 10, fontWeight: 900, color: '#FFD600', background: 'rgba(255,214,0,.1)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(255,214,0,.3)', marginLeft: 4 }}>Host</span>
                      )}
                      {/* Remove bot button */}
                      {p.isBot && isHost && (
                        <button
                          onClick={() => onRemoveBot?.(i)}
                          style={{ fontSize:11, padding:'2px 6px', borderRadius:6, background:'rgba(229,57,53,.2)', border:'1px solid rgba(229,57,53,.4)', color:'#EF9A9A', cursor:'pointer', marginLeft:4 }}
                        >✕</button>
                      )}
                      {!p.isBot && <span className="online-dot" />}
                    </div>
                  )
                })}
              </div>

              {/* Add bot button */}
              {isHost && room.players.length < 5 && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop:8, width:'100%', fontSize:12 }}
                  onClick={() => onAddBot?.()}
                >
                  🤖 Add Bot
                </button>
              )}
            </div>
          </div>

          {/* Right: Mode + Hand Setup + Specials */}
          <div className="lobby-right">
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>Game Mode</div>
              <div className="mode-toggle">
                <button className={`mode-btn${mode === 'normal' ? ' active-normal' : ''}`}
                  onClick={() => isHost && onSetMode('normal')} disabled={!isHost}>
                  🎯 Normal
                </button>
                <button className={`mode-btn${mode === 'special' ? ' active-special' : ''}`}
                  onClick={() => isHost && onSetMode('special')} disabled={!isHost}>
                  ✨ Special
                </button>
              </div>
              <div className="mode-hint">
                {mode === 'normal' ? '4 normal chits only — no specials' : '4 normal + 2 random special chits'}
              </div>
            </div>

            {mode === 'special' && (
              <>
                <div>
                  <div className="section-label" style={{ marginBottom: 8 }}>Hand Setup</div>
                  <div className="mode-toggle">
                    <button className={`mode-btn${settings.normalCount === 4 ? ' active-normal' : ''}`}
                      onClick={() => isHost && setHandSetup(4, 2)} disabled={!isHost}>
                      Classic · 4+2
                    </button>
                    <button className={`mode-btn${settings.normalCount === 8 ? ' active-special' : ''}`}
                      onClick={() => isHost && setHandSetup(8, 4)} disabled={!isHost}>
                      Extended · 8+4
                    </button>
                  </div>
                  <div className="mode-hint">
                    {settings.normalCount === 4 ? '4 normal + 2 special per player' : '8 normal + 4 special per player'}
                  </div>
                </div>

                <div>
                  <div className="lobby-specials-header">
                    <div className="section-label" style={{ margin: 0 }}>
                      Special Cards{!specsOpen && ` — ${enabledSpecials.length} enabled`}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSpecsOpen(o => !o)}>
                      {specsOpen ? 'Hide ▲' : 'Edit ▼'}
                    </button>
                  </div>
                  {specsOpen && (
                    <div className="lobby-specials-grid fade-up">
                      {SPECIALS.map(s => {
                        const on = enabledSpecials.includes(s.type)
                        return (
                          <button key={s.type}
                            disabled={!isHost}
                            onClick={() => {
                              if (!isHost) return
                              const next = on ? enabledSpecials.filter(t => t !== s.type) : [...enabledSpecials, s.type]
                              if (next.length > 0) setEnabledSpecials(next)
                            }}
                            className={`special-toggle-btn${on ? ' on' : ''}`}
                          >
                            {s.emoji} {s.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {!isHost && (
                    <div className="mode-hint" style={{ marginTop: 4 }}>Only the host can change settings</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status hints */}
        {(!isHost || room.players.length < 2) && (
          <p className="lobby-wait-msg">
            {!isHost ? '⏳ Waiting for host…' : 'Need at least 2 players to start.'}
          </p>
        )}

        {/* Action bar */}
        <div className="lobby-actions">
          <button className="btn btn-green btn-lg lobby-start-btn"
            disabled={!isHost || room.players.length < 2} onClick={onStart}>
            ▶ Start Game
          </button>
          <button className="btn btn-ghost" onClick={onLeave}>Leave</button>
        </div>

      </div>
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────
const sectionLabel = {
  fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
  color: 'rgba(255,255,255,.4)', letterSpacing: 1,
  marginBottom: 8, marginTop: 4,
}

const roomCardStyle = {
  display:      'flex',
  alignItems:   'center',
  gap:          12,
  padding:      '12px 14px',
  background:   'rgba(255,255,255,.06)',
  border:       '1px solid rgba(255,255,255,.1)',
  borderRadius: 12,
}

const emptyStyle = {
  textAlign:  'center',
  padding:    '40px 20px',
  color:      'rgba(255,255,255,.4)',
  fontSize:   14,
}

const modeBadge = (mode) => ({
  fontSize:     10,
  fontWeight:   800,
  padding:      '2px 8px',
  borderRadius: 20,
  background:   mode === 'special' ? 'rgba(170,0,255,.2)' : 'rgba(30,136,229,.2)',
  color:        mode === 'special' ? '#CC44FF' : '#42A5F5',
  border:       `1px solid ${mode === 'special' ? 'rgba(170,0,255,.3)' : 'rgba(30,136,229,.3)'}`,
})

const visibilityBadge = (isPublic) => ({
  fontSize:     11,
  fontWeight:   800,
  padding:      '3px 10px',
  borderRadius: 20,
  background:   isPublic ? 'rgba(67,160,71,.2)' : 'rgba(255,255,255,.08)',
  color:        isPublic ? '#81C784' : 'rgba(255,255,255,.5)',
  border:       `1px solid ${isPublic ? 'rgba(67,160,71,.3)' : 'rgba(255,255,255,.15)'}`,
})

const botBadgeStyle = {
  fontSize: 10, fontWeight: 900, padding: '2px 7px', borderRadius: 10,
  background: 'rgba(30,136,229,.2)', color: '#90CAF9',
  border: '1px solid rgba(30,136,229,.35)',
}

const autoBadgeStyle = {
  fontSize: 10, fontWeight: 900, padding: '2px 7px', borderRadius: 10,
  background: 'rgba(67,160,71,.2)', color: '#A5D6A7',
  border: '1px solid rgba(67,160,71,.35)',
}

const offlineBadgeStyle = {
  fontSize: 10, fontWeight: 900, padding: '2px 7px', borderRadius: 10,
  background: 'rgba(229,57,53,.15)', color: '#EF9A9A',
  border: '1px solid rgba(229,57,53,.3)',
}