import { isSpecial } from '../utils/game.js'
import { initials } from '../utils/helpers.js'
import { SEAT_COLORS } from '../utils/game.js'

// ── Shared modal wrapper ──────────────────────────────────────
function Modal({ children, title, emoji }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:50,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,.82)', backdropFilter:'blur(12px)',
      padding:'1.5rem',
    }}>
      <div style={{
        background:'rgba(5,15,10,.97)',
        backdropFilter:'blur(20px)',
        border:'1.5px solid rgba(255,255,255,.12)',
        borderRadius:20, padding:'28px 24px',
        width:'100%', maxWidth:380,
        boxShadow:'0 8px 40px rgba(0,0,0,.8)',
        animation:'popIn .25s cubic-bezier(.34,1.56,.64,1)',
      }}>
        {(title||emoji) && (
          <div style={{ textAlign:'center', marginBottom:20 }}>
            {emoji && <div style={{ fontSize:44, marginBottom:8 }}>{emoji}</div>}
            {title && <h3 style={{ fontFamily:"'Fredoka One',cursive", fontWeight:400, fontSize:'1.2rem', color:'#fff' }}>{title}</h3>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ── USE or PASS modal ─────────────────────────────────────────
export function UseOrPassModal({ special, chitIdx, onUse, onPass, onCancel }) {
  const desc = {
    REVERSE:       'Flip the passing direction for the rest of this round.',
    FREEZE:        'Freeze the next player — they skip their turn.',
    RANDOM_SNATCH: 'Pick a player and steal a random chit from them!',
    STUN_GRENADE:  'Pick a player and stun them — their chits go hidden!',
  }[special.type] ?? ''

  return (
    <Modal emoji={special.emoji} title={special.name}>
      <p style={{ color:'rgba(255,255,255,.55)', fontSize:13, textAlign:'center', marginBottom:24, fontWeight:700 }}>
        {desc}
      </p>
      <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:10 }}>
        <button className="btn btn-red btn-lg" onClick={() => onUse(chitIdx, special)}>
          ✨ Use It
        </button>
        <button className="btn btn-blue" onClick={() => onPass(chitIdx)}>
          📤 Pass It
        </button>
      </div>
      <button className="btn btn-ghost" style={{ width:'100%' }} onClick={onCancel}>
        Cancel
      </button>
    </Modal>
  )
}

// ── Random Snatch: pick target player ────────────────────────
export function RandomSnatchPickPlayerModal({ players, myIdx, onPick }) {
  return (
    <Modal emoji="🎲" title="Random Snatch!">
      <p style={{ color:'rgba(255,255,255,.55)', fontSize:13, textAlign:'center', marginBottom:20, fontWeight:700 }}>
        Pick a player to snatch a random chit from. They won't know which one!
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {players.map((p, i) => {
          if (i===myIdx) return null
          const sc = SEAT_COLORS[i % SEAT_COLORS.length]
          const normalCount = p.chits.filter(c => !isSpecial(c)).length
          return (
            <button key={p.id}
              style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'12px 16px', borderRadius:12,
                background:`${sc}18`, border:`1.5px solid ${sc}55`,
                cursor:'pointer', transition:'all .15s', color:'#fff',
                fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:14,
              }}
              onMouseEnter={e => { e.currentTarget.style.background=`${sc}30`; e.currentTarget.style.borderColor=`${sc}99` }}
              onMouseLeave={e => { e.currentTarget.style.background=`${sc}18`; e.currentTarget.style.borderColor=`${sc}55` }}
              onClick={() => onPick(i)}
            >
              <div style={{
                width:32, height:32, borderRadius:'50%',
                background:`${sc}33`, color:sc,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'Fredoka One',cursive", fontSize:13,
                border:`2px solid ${sc}`,
              }}>
                {initials(p.name)}
              </div>
              <span style={{ flex:1 }}>{p.name}</span>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:800 }}>
                🃏 {normalCount} normals
              </span>
              <span style={{ fontSize:16 }}>🎲</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

// ── Stun Grenade: pick target player ─────────────────────────
export function StunGrenadePickPlayerModal({ players, myIdx, onPick }) {
  return (
    <Modal emoji="💥" title="Stun Grenade!">
      <p style={{ color:'rgba(255,255,255,.55)', fontSize:13, textAlign:'center', marginBottom:20, fontWeight:700 }}>
        Pick a player to stun! Their screen flashes and all their chits go hidden!
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {players.map((p, i) => {
          if (i===myIdx) return null
          const sc = SEAT_COLORS[i % SEAT_COLORS.length]
          return (
            <button key={p.id}
              style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'12px 16px', borderRadius:12,
                background:'rgba(229,57,53,.12)', border:'1.5px solid rgba(229,57,53,.4)',
                cursor:'pointer', transition:'all .15s', color:'#fff',
                fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:14,
              }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(229,57,53,.25)'; e.currentTarget.style.borderColor='rgba(229,57,53,.7)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(229,57,53,.12)'; e.currentTarget.style.borderColor='rgba(229,57,53,.4)' }}
              onClick={() => onPick(i)}
            >
              <div style={{
                width:32, height:32, borderRadius:'50%',
                background:`${sc}33`, color:sc,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'Fredoka One',cursive", fontSize:13,
                border:`2px solid ${sc}`,
              }}>
                {initials(p.name)}
              </div>
              <span style={{ flex:1 }}>{p.name}</span>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:800 }}>
                🃏 {p.chits.length} chits
              </span>
              <span style={{ fontSize:16 }}>💥</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

// ── Master dispatcher ─────────────────────────────────────────
export function SpecialModalManager({
  specialAction, room, myIdx,
  onUse, onPass, onCancel,
  onRandomSnatchPickPlayer,
  onStunGrenadePickPlayer,
}) {
  if (!specialAction) return null

  switch (specialAction.type) {
    case 'USE_OR_PASS':
      return (
        <UseOrPassModal
          special={specialAction.special}
          chitIdx={specialAction.chitIdx}
          onUse={onUse} onPass={onPass} onCancel={onCancel}
        />
      )
    case 'RANDOM_SNATCH_PICK_PLAYER':
      return (
        <RandomSnatchPickPlayerModal
          players={room?.players ?? []}
          myIdx={myIdx}
          onPick={onRandomSnatchPickPlayer}
        />
      )
    case 'STUN_GRENADE_PICK_PLAYER':
      return (
        <StunGrenadePickPlayerModal
          players={room?.players ?? []}
          myIdx={myIdx}
          onPick={onStunGrenadePickPlayer}
        />
      )
    default:
      return null
  }
}