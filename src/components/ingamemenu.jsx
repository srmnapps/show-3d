// show-3d/src/components/InGameMenu.jsx
// Fix 2 — In-game settings menu, confirmation modal, how-to-play modal

// ── In-game dropdown menu ─────────────────────────────────────
export function InGameMenu({ isHost, onHowToPlay, onLeave, onRestart, onEndGame, onClose }) {
  return (
    <>
      {/* Click-away backdrop */}
      <div
        style={{ position:'fixed', inset:0, zIndex:79 }}
        onClick={onClose}
      />
      <div className="ingame-menu-dropdown">
        <button className="ingame-menu-item" onClick={onHowToPlay}>
          📖 How to Play
        </button>
        <button className="ingame-menu-item" onClick={onLeave}>
          🚪 Leave Room
        </button>
        {isHost && (
          <>
            <div className="ingame-menu-divider" />
            <button className="ingame-menu-item" onClick={onRestart}>
              🔄 Restart Game
            </button>
            <button className="ingame-menu-item ingame-menu-item--danger" onClick={onEndGame}>
              ⛔ End Game
            </button>
          </>
        )}
      </div>
    </>
  )
}

// ── Generic confirmation modal ────────────────────────────────
export function ConfirmModal({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="confirm-backdrop">
      <div className="confirm-box">
        <div className="confirm-title">{title}</div>
        {message && <div className="confirm-msg">{message}</div>}
        <div className="confirm-btns">
          <button
            className={`btn ${danger ? 'btn-red' : 'btn-green'} btn-lg`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── How-to-play modal (compact) ───────────────────────────────
export function HowToPlayModal({ onClose }) {
  return (
    <div className="confirm-backdrop" style={{ alignItems:'flex-start', overflowY:'auto', padding:'20px 12px' }}>
      <div className="confirm-box" style={{ maxWidth:480, width:'100%', maxHeight:'85vh', overflowY:'auto' }}>
        <div className="confirm-title" style={{ marginBottom:4 }}>📖 How to Play</div>

        <Section title="🎯 Goal">
          Collect 4 matching normal chits and call <strong>SHOW!</strong> to score points.
          Most points after all rounds wins.
        </Section>

        <Section title="📤 On Your Turn">
          Select a chit and press <strong>Pass Chit</strong> to send it face-down to the next player.
        </Section>

        <Section title="🎉 Calling SHOW">
          When your 4 normal chits all share the same symbol, press <strong>SHOW!</strong>.
          A 5-second window opens — other players can join the show and score too.
        </Section>

        <Section title="🃏 4+2 vs 8+4">
          <strong>Classic 4+2:</strong> 4 normal + 2 special chits. Need 1 set of four to SHOW.<br/>
          <strong>Extended 8+4:</strong> 8 normal + 4 special. Need <em>2</em> sets of four to SHOW.
        </Section>

        <Section title="✨ Special Cards">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px', fontSize:12 }}>
            {SPECIALS_BRIEF.map(s => (
              <div key={s.type} style={{ padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                <span style={{ marginRight:5 }}>{s.emoji}</span>
                <strong style={{ color:'#c084fc' }}>{s.name}</strong>
                <div style={{ color:'rgba(255,255,255,.55)', fontSize:11, marginTop:1 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        <button className="btn btn-ghost" style={{ width:'100%', marginTop:14 }} onClick={onClose}>
          ✕ Close
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:12, fontWeight:900, color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:.6, marginBottom:4 }}>
        {title}
      </div>
      <div style={{ fontSize:13, color:'rgba(255,255,255,.8)', lineHeight:1.55 }}>
        {children}
      </div>
    </div>
  )
}

const SPECIALS_BRIEF = [
  { type:'REVERSE',         emoji:'🔄', name:'Reverse',        desc:'Flip the pass direction.' },
  { type:'FREEZE',          emoji:'🧊', name:'Freeze',          desc:'Target player skips a turn.' },
  { type:'BLIND_SNATCH',    emoji:'🎲', name:'Blind Snatch',    desc:'Steal a random chit from someone.' },
  { type:'REVEALED_SNATCH', emoji:'👁', name:'Revealed Snatch', desc:'See 2 chits, steal one.' },
  { type:'STUN_GRENADE',    emoji:'💥', name:'Stun Grenade',    desc:"Hide target's chits." },
  { type:'VITALS',          emoji:'📊', name:'Vitals',          desc:'See match % for all players.' },
  { type:'SUPER_VITALS',    emoji:'⚡', name:'Super Vitals',    desc:'Instant alert if anyone can SHOW.' },
  { type:'NUKE',            emoji:'💣', name:'Nuke',            desc:"Destroy a target's special card." },
]