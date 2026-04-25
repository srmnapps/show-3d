import { useState } from 'react'
import { isSpecial, chitDisplay } from '../utils/game.js'

// ── Shared modal wrapper ──────────────────────────────────────
function Modal({ children, title, emoji }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(6,6,8,.8)',
      backdropFilter: 'blur(8px)',
      padding: '1.5rem',
    }}>
      <div style={{
        background: 'rgba(15,15,28,.98)',
        border: '1px solid rgba(155,127,255,.3)',
        borderRadius: 18,
        padding: '24px',
        width: '100%', maxWidth: 360,
        boxShadow: '0 0 40px rgba(155,127,255,.15), 0 20px 60px rgba(0,0,0,.8)',
        animation: 'fadeSlideUp .2s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{emoji}</div>
          <h3 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: '1.1rem', color: 'var(--gold)',
          }}>{title}</h3>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Chit display mini card ────────────────────────────────────
function MiniChit({ chit, selected, onClick, dimmed }) {
  const special = isSpecial(chit)
  const display = chitDisplay(chit)
  return (
    <div onClick={onClick} style={{
      width: 52, height: 68, borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 24, cursor: onClick ? 'pointer' : 'default',
      border: `2px solid ${selected ? 'var(--gold)' : special ? 'rgba(155,127,255,.4)' : 'rgba(255,255,255,.1)'}`,
      background: selected
        ? 'rgba(245,200,66,.12)'
        : special
        ? 'rgba(155,127,255,.08)'
        : 'rgba(255,255,255,.04)',
      boxShadow: selected ? '0 0 16px rgba(245,200,66,.35)' : 'none',
      transform: selected ? 'translateY(-4px)' : 'none',
      transition: 'all .15s',
      opacity: dimmed ? .35 : 1,
    }}>
      {display}
    </div>
  )
}

// ── USE or PASS choice modal ──────────────────────────────────
export function UseOrPassModal({ special, chitIdx, onUse, onPass, onCancel }) {
  return (
    <Modal emoji={special.emoji} title={special.name}>
      <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
        {special.type === 'REVERSE'       && 'Flip the passing direction for the rest of this round.'}
        {special.type === 'FREEZE'        && 'Freeze the next player — they skip a turn.'}
        {special.type === 'RANDOM_SNATCH' && 'Snatch a chit from another player!'}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn btn-coral btn-lg" onClick={() => onUse(chitIdx, special)}>
          ✨ Use It
        </button>
        <button className="btn btn-teal" onClick={() => onPass(chitIdx)}>
          Pass It →
        </button>
      </div>
      <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={onCancel}>
        Cancel
      </button>
    </Modal>
  )
}

// ── Giver Snatch prompt (receiver sees this) ──────────────────
export function GiverSnatchPromptModal({ giverName, onYes, onNo }) {
  return (
    <Modal emoji="👁" title="Giver Snatch!">
      <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
        <strong style={{ color: 'var(--text)' }}>{giverName}</strong> is passing you a chit.
      </p>
      <p style={{ color: 'var(--gold)', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
        Use your Giver Snatch to take a chit of YOUR choice instead?
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn btn-coral btn-lg" onClick={onYes}>
          👁 Use It!
        </button>
        <button className="btn btn-ghost btn-lg" onClick={onNo}>
          No, take it
        </button>
      </div>
    </Modal>
  )
}

// ── Giver Snatch picking (see mode — pick from giver's chits) ─
export function GiverSnatchPickModal({ giverChits, giverName, onPick }) {
  const [sel, setSel] = useState(-1)
  const normals = giverChits
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !isSpecial(c))

  return (
    <Modal emoji="👁" title={`Pick from ${giverName}'s chits`}>
      <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
        The randomiser gave you <strong style={{ color: 'var(--teal)' }}>SEE</strong> mode — pick any of their normal chits.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        {normals.map(({ c, i }) => (
          <MiniChit key={i} chit={c} selected={sel === i} onClick={() => setSel(i)} />
        ))}
        {normals.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>No normal chits available.</p>
        )}
      </div>
      <button className="btn btn-gold" style={{ width: '100%' }}
        disabled={sel === -1} onClick={() => onPick(sel)}>
        Snatch It! 👁
      </button>
    </Modal>
  )
}

// ── Random Snatch: pick target player ────────────────────────
export function RandomSnatchPickPlayerModal({ players, myIdx, viewMode, onPick }) {
  return (
    <Modal emoji="🎲" title="Random Snatch — Pick Target">
      <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', marginBottom: 6 }}>
        The randomiser said <strong style={{ color: 'var(--gold)' }}>YOU CHOOSE</strong> the player.
      </p>
      <p style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'center', marginBottom: 16 }}>
        View mode: <strong style={{ color: viewMode === 'see' ? 'var(--teal)' : 'var(--coral)' }}>
          {viewMode === 'see' ? '👁 SEE' : '🎲 BLIND'}
        </strong>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
        {players.map((p, i) => {
          if (i === myIdx) return null
          return (
            <button key={p.id} className="btn btn-ghost"
              style={{ justifyContent: 'flex-start', gap: 10 }}
              onClick={() => onPick(i)}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
                {p.chits.filter(c => !isSpecial(c)).length} normals
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

// ── Random Snatch: see mode — pick which chit to swap ────────
export function RandomSnatchPickChitModal({ targetChits, userChits, targetName, onPick }) {
  const [userSel,   setUserSel]   = useState(-1)
  const [targetSel, setTargetSel] = useState(-1)

  const userNormals   = userChits.map((c,i)=>({c,i})).filter(({c})=>!isSpecial(c))
  const targetNormals = targetChits.map((c,i)=>({c,i})).filter(({c})=>!isSpecial(c))

  return (
    <Modal emoji="🎲" title="Random Snatch — See Mode">
      <p style={{ color: 'var(--teal)', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
        👁 SEE mode — pick one of YOUR chits and one of <strong>{targetName}</strong>'s to swap.
      </p>

      <div className="section-label" style={{ marginBottom: 8 }}>Your chit to give:</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {userNormals.map(({ c, i }) => (
          <MiniChit key={i} chit={c} selected={userSel === i} onClick={() => setUserSel(i)} />
        ))}
      </div>

      <div className="section-label" style={{ marginBottom: 8 }}>{targetName}'s chit to take:</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {targetNormals.map(({ c, i }) => (
          <MiniChit key={i} chit={c} selected={targetSel === i} onClick={() => setTargetSel(i)} />
        ))}
      </div>

      <button className="btn btn-gold" style={{ width: '100%' }}
        disabled={userSel === -1 || targetSel === -1}
        onClick={() => onPick(userSel, targetSel)}>
        Swap! 🔀
      </button>
    </Modal>
  )
}

// ── Master modal dispatcher ───────────────────────────────────
export function SpecialModalManager({
  specialAction, room, myIdx, myPlayer,
  onUse, onPass, onCancel,
  onGiverSnatchRespond, onGiverSnatchPick,
  onRandomSnatchPickPlayer, onRandomSnatchPickChit,
}) {
  if (!specialAction) return null

  const gs = room?.pendingGiverSnatch
  const rs = room?.pendingRandomSnatch

  switch (specialAction.type) {
    case 'USE_OR_PASS':
      return (
        <UseOrPassModal
          special={specialAction.special}
          chitIdx={specialAction.chitIdx}
          onUse={onUse}
          onPass={onPass}
          onCancel={onCancel}
        />
      )
    case 'GIVER_SNATCH_PROMPT':
      return (
        <GiverSnatchPromptModal
          giverName={room?.players[gs?.giverIdx]?.name ?? 'Giver'}
          onYes={() => onGiverSnatchRespond(true)}
          onNo={() => onGiverSnatchRespond(false)}
        />
      )
    case 'GIVER_SNATCH_PICK':
      return (
        <GiverSnatchPickModal
          giverChits={specialAction.giverChits}
          giverName={room?.players[gs?.giverIdx]?.name ?? 'Giver'}
          onPick={onGiverSnatchPick}
        />
      )
    case 'RANDOM_SNATCH_PICK_PLAYER':
      return (
        <RandomSnatchPickPlayerModal
          players={room?.players ?? []}
          myIdx={myIdx}
          viewMode={specialAction.viewMode}
          onPick={onRandomSnatchPickPlayer}
        />
      )
    case 'RANDOM_SNATCH_PICK_CHIT':
      return (
        <RandomSnatchPickChitModal
          targetChits={specialAction.targetChits}
          userChits={specialAction.userChits}
          targetName={room?.players[specialAction.targetIdx]?.name ?? 'Target'}
          onPick={onRandomSnatchPickChit}
        />
      )
    default:
      return null
  }
}