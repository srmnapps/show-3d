import { useState } from 'react'
import { WsStatus } from './UI.jsx'
import { AVATAR_COLORS } from '../utils/game.js'
import { initials, copyToClipboard } from '../utils/helpers.js'

export function LandingScreen({ onCreate, onGoJoin }) {
  const [name, setName] = useState('')
  const t = name.trim()
  return (
    <div className="landing-wrap">
      <div className="landing-inner">
        <div className="logo-title">SHOW</div>
        <div className="logo-sub">Telugu Chit Matching · 2–5 Players</div>
        <div className="glass" style={{ padding:'24px' }}>
          <div className="input-group">
            <label className="input-label">Your Name</label>
            <input className="input" placeholder="Enter your name…" value={name} maxLength={18}
              onChange={e=>setName(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&t) onCreate(t) }}
              autoFocus />
          </div>
          <button className="btn btn-gold" style={{ width:'100%', marginBottom:8, fontSize:15 }}
            disabled={!t} onClick={()=>onCreate(t)}>
            ✦ Create Room
          </button>
          <div className="divider">or</div>
          <button className="btn btn-ghost" style={{ width:'100%' }}
            disabled={!t} onClick={()=>onGoJoin(t)}>
            Join a Room →
          </button>
        </div>
        <p style={{ textAlign:'center', fontSize:11, color:'var(--muted)', marginTop:14, letterSpacing:'.3px' }}>
          No account needed · Play instantly
        </p>
      </div>
    </div>
  )
}

export function JoinScreen({ onJoin, onBack, errorMsg }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    if (!code.trim()) return
    setBusy(true)
    await onJoin(code.trim().toUpperCase(), ()=>setBusy(false))
  }
  return (
    <div className="landing-wrap">
      <div className="landing-inner">
        <div className="logo-title">SHOW</div>
        <div className="logo-sub">Enter the room code</div>
        <div className="glass" style={{ padding:'24px' }}>
          <div className="input-group">
            <label className="input-label">Room Code</label>
            <input className="input input-code" placeholder="SHOW-XXXX" value={code} maxLength={9}
              onChange={e=>setCode(e.target.value.toUpperCase())}
              onKeyDown={e=>{ if(e.key==='Enter') go() }}
              autoFocus />
          </div>
          {errorMsg && <p className="error-msg" style={{ marginBottom:10 }}>{errorMsg}</p>}
          <button className="btn btn-gold" style={{ width:'100%', marginBottom:8 }}
            disabled={busy||!code.trim()} onClick={go}>
            {busy ? 'Joining…' : 'Join Room →'}
          </button>
          <button className="btn btn-ghost" style={{ width:'100%' }} onClick={onBack}>← Back</button>
        </div>
      </div>
    </div>
  )
}

export function LobbyScreen({ room, me, isHost, wsStatus, onStart, onLeave }) {
  const [copied, setCopied] = useState(false)
  async function doCopy() {
    await copyToClipboard(room.code)
    setCopied(true); setTimeout(()=>setCopied(false), 1600)
  }
  return (
    <div className="overlay">
      <div className="overlay-inner">
        <div className="glass" style={{ padding:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <h2 className="font-display" style={{ fontSize:'1.1rem', fontWeight:800, letterSpacing:2 }}>LOBBY</h2>
            <WsStatus status={wsStatus} />
          </div>
          {/* Code */}
          <div style={{ textAlign:'center', marginBottom:'1.25rem', padding:'16px',
            background:'rgba(245,200,66,.04)', borderRadius:10, border:'1px solid rgba(245,200,66,.15)' }}>
            <div className="section-label" style={{ marginBottom:6 }}>Share this code</div>
            <div className="room-code-display">{room.code}</div>
            <button className="btn btn-sm btn-ghost" style={{ marginTop:10 }} onClick={doCopy}>
              {copied ? '✓ Copied!' : '⎘ Copy'}
            </button>
          </div>
          {/* Players */}
          <div className="section-label">Players ({room.players.length}/5)</div>
          <div style={{ marginBottom:14, maxHeight:200, overflowY:'auto' }}>
            {room.players.map(p => {
              const ac = AVATAR_COLORS[p.color] ?? AVATAR_COLORS[0]
              return (
                <div key={p.id} className="lobby-player">
                  <div className="avatar" style={{ background:ac.bg, color:ac.fg }}>{initials(p.name)}</div>
                  <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{p.name}</span>
                  {p.id===me.id      && <span className="badge badge-you"  style={{ marginRight:4 }}>You</span>}
                  {room.hostId===p.id && <span className="badge badge-host">Host</span>}
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'#4ADE80',
                    boxShadow:'0 0 6px #4ADE80', flexShrink:0 }} />
                </div>
              )
            })}
          </div>
          <div className="btn-row">
            <button className="btn btn-gold" disabled={!isHost||room.players.length<2} onClick={onStart}>
              Start Game ▶
            </button>
            <button className="btn btn-ghost" onClick={onLeave}>Leave</button>
          </div>
          {!isHost && <p style={{ fontSize:11, color:'var(--muted)', marginTop:10, textAlign:'center' }}>Waiting for host…</p>}
          {isHost && room.players.length<2 && <p style={{ fontSize:11, color:'var(--muted)', marginTop:10, textAlign:'center' }}>Need at least 2 players.</p>}
        </div>
      </div>
    </div>
  )
}
