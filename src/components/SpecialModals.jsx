import { useState } from 'react'
import { isSpecial, chitDisplay, SEAT_COLORS, SPECIALS } from '../utils/game.js'
import { initials } from '../utils/helpers.js'

// ── Shared modal wrapper ──────────────────────────────────────
function Modal({ children, title, emoji, color = '#1E88E5' }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:50,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,.85)', backdropFilter:'blur(12px)',
      padding:'1.5rem',
    }}>
      <div style={{
        background:'rgba(5,12,8,.97)',
        border:`1.5px solid ${color}44`,
        borderRadius:20, padding:'28px 24px',
        width:'100%', maxWidth:400,
        boxShadow:`0 8px 40px rgba(0,0,0,.8), 0 0 0 1px ${color}22`,
        animation:'popIn .25s cubic-bezier(.34,1.56,.64,1)',
      }}>
        {(title||emoji) && (
          <div style={{ textAlign:'center', marginBottom:20 }}>
            {emoji && <div style={{ fontSize:48, marginBottom:8, filter:`drop-shadow(0 0 12px ${color}88)` }}>{emoji}</div>}
            {title && <h3 style={{ fontFamily:"'Fredoka One',cursive", fontSize:'1.3rem', color:'#fff' }}>{title}</h3>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ── Mini chit card for pickers ────────────────────────────────
function MiniChit({ chit, selected, onClick, masked, label }) {
  const sp      = isSpecial(chit)
  const display = masked ? '?' : chitDisplay(chit)
  return (
    <div onClick={onClick} style={{
      width:56, height:76, borderRadius:10, flexShrink:0,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:3, fontSize: masked ? 18 : 26,
      fontFamily: masked ? "'Fredoka One',cursive" : 'inherit',
      color: masked ? 'rgba(155,127,255,.5)' : '#111',
      cursor: onClick ? 'pointer' : 'default',
      border:`2px solid ${selected?'#FFD600':sp?'rgba(170,0,255,.6)':'rgba(255,255,255,.15)'}`,
      background: selected
        ? 'rgba(255,214,0,.15)'
        : sp ? 'linear-gradient(145deg,#6a0dad,#9c27b0)'
        : masked ? 'linear-gradient(145deg,#1a237e,#283593)'
        : '#fff',
      boxShadow: selected ? '0 0 16px rgba(255,214,0,.4)' : '0 2px 8px rgba(0,0,0,.4)',
      transform: selected ? 'translateY(-5px) scale(1.06)' : 'none',
      transition:'all .15s',
    }}>
      <span>{display}</span>
      {label && <span style={{ fontSize:8, fontWeight:900, color: sp?'rgba(255,255,255,.7)':'#666', textTransform:'uppercase', letterSpacing:.4 }}>{label}</span>}
    </div>
  )
}

// ── Player button ─────────────────────────────────────────────
function PlayerBtn({ player, idx, onClick, icon }) {
  const sc = SEAT_COLORS[idx % SEAT_COLORS.length]
  const normalCount = player.chits.filter(c => !isSpecial(c)).length
  const specCount   = player.chits.filter(c => isSpecial(c)).length
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'12px 16px', borderRadius:12, width:'100%',
      background:`${sc}18`, border:`1.5px solid ${sc}44`,
      cursor:'pointer', color:'#fff', marginBottom:8,
      fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:14,
      transition:'all .15s',
    }}
    onMouseEnter={e=>{ e.currentTarget.style.background=`${sc}30`; e.currentTarget.style.borderColor=`${sc}88` }}
    onMouseLeave={e=>{ e.currentTarget.style.background=`${sc}18`; e.currentTarget.style.borderColor=`${sc}44` }}
    >
      <div style={{
        width:32, height:32, borderRadius:'50%', flexShrink:0,
        background:`${sc}33`, color:sc, border:`2px solid ${sc}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:"'Fredoka One',cursive", fontSize:12,
      }}>{initials(player.name)}</div>
      <span style={{ flex:1 }}>{player.name}</span>
      <span style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:700 }}>
        🃏{normalCount} {specCount>0?`✦${specCount}`:''}
      </span>
      <span style={{ fontSize:18 }}>{icon}</span>
    </button>
  )
}

// ── USE or PASS modal ─────────────────────────────────────────
export function UseOrPassModal({ special, chitIdx, onUse, onPass, onCancel, forActing, isMyTurn }) {
  const colorMap = {
    REVERSE:'#1E88E5', FREEZE:'#26C6DA', BLIND_SNATCH:'#FFD600',
    REVEALED_SNATCH:'#AA00FF', STUN_GRENADE:'#E53935', VITALS:'#43A047',
    SUPER_VITALS:'#FF8F00', NUKE:'#E53935', PUPPETEER:'#7B1FA2',
    POSITION_SWAP:'#00897B',
  }
  const descMap = {
    REVERSE:        'Flip the passing direction for the rest of this round.',
    FREEZE:         'Pick a player — their next turn is skipped!',
    BLIND_SNATCH:   'Pick a player, steal a hidden card, swap with one of your revealed cards.',
    REVEALED_SNATCH:'Pick a player, see 2 of their cards, swap one with your revealed card.',
    STUN_GRENADE:   'Pick a player — their screen flashes, all chits hidden!',
    VITALS:         'See a probability report of who is close to calling Show.',
    SUPER_VITALS:   'Activate round-long alert: know when anyone reaches 4-match!',
    NUKE:           'Pick a player and destroy one of their special cards!',
    PUPPETEER:      'Control another player\'s entire turn — see their hand!',
    POSITION_SWAP:  'Swap turn-order position with another player this round.',
  }
  const color = colorMap[special.type] ?? '#1E88E5'
  const canPass = isMyTurn !== false
  return (
    <Modal emoji={special.emoji} title={special.name} color={color}>
      {forActing && (
        <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,.45)', marginBottom:8, fontWeight:800 }}>
          🎭 Using as Puppeteer
        </div>
      )}
      <p style={{ color:'rgba(255,255,255,.55)', fontSize:13, textAlign:'center', marginBottom:24, fontWeight:700, lineHeight:1.5 }}>
        {descMap[special.type] ?? ''}
      </p>
      <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:10 }}>
        <button className="btn btn-green btn-lg" onClick={() => onUse(chitIdx, special, forActing)}>
          ✨ Use It
        </button>
        {canPass && (
          <button className="btn btn-blue" onClick={() => onPass(chitIdx, forActing)}>
            📤 Pass It
          </button>
        )}
      </div>
      <button className="btn btn-ghost" style={{ width:'100%' }} onClick={onCancel}>Cancel</button>
    </Modal>
  )
}

// ── Generic target picker ─────────────────────────────────────
export function PickTargetModal({ actionType, players, myIdx, exclude, onPick }) {
  const iconMap = {
    FREEZE_PICK:'🧊',
    BLIND_SNATCH_PICK:'🎲', REVEALED_SNATCH_PICK_TARGET:'👁',
    STUN_GRENADE_PICK:'💥', NUKE_PICK_TARGET:'💣',
    PUPPETEER_PICK:'🎭', POSITION_SWAP_PICK:'🔀',
  }
  const titleMap = {
    FREEZE_PICK:'Pick Target — Freeze',
    BLIND_SNATCH_PICK:'Pick Target — Blind Snatch',
    REVEALED_SNATCH_PICK_TARGET:'Pick Target — Revealed Snatch',
    STUN_GRENADE_PICK:'Pick Target — Stun Grenade',
    NUKE_PICK_TARGET:'Pick Target — Nuke',
    PUPPETEER_PICK:'Pick Target — Puppeteer',
    POSITION_SWAP_PICK:'Pick Target — Position Swap',
  }
  const hintMap = {
    FREEZE_PICK:'Their turn will be skipped once.',
    BLIND_SNATCH_PICK:'You\'ll steal and swap a hidden card.',
    REVEALED_SNATCH_PICK_TARGET:'You\'ll see 2 of their cards and swap one.',
    STUN_GRENADE_PICK:'Their screen flashes and all chits go hidden!',
    NUKE_PICK_TARGET:'You\'ll pick which of their specials to destroy.',
    PUPPETEER_PICK:'You\'ll control their entire turn — see their hand!',
    POSITION_SWAP_PICK:'You\'ll swap turn positions for this round.',
  }
  const colorMap = {
    FREEZE_PICK:'#26C6DA',
    BLIND_SNATCH_PICK:'#FFD600', REVEALED_SNATCH_PICK_TARGET:'#AA00FF',
    STUN_GRENADE_PICK:'#E53935', NUKE_PICK_TARGET:'#E53935',
    PUPPETEER_PICK:'#7B1FA2', POSITION_SWAP_PICK:'#00897B',
  }
  const color = colorMap[actionType] ?? '#1E88E5'
  return (
    <Modal emoji={iconMap[actionType]} title={titleMap[actionType]} color={color}>
      <p style={{ color:'rgba(255,255,255,.45)', fontSize:12, textAlign:'center', marginBottom:20, fontWeight:700 }}>
        {hintMap[actionType]}
      </p>
      <div>
        {players.map((p, i) => {
          if (i === myIdx || (exclude ?? []).includes(i)) return null
          return (
            <PlayerBtn key={p.id} player={p} idx={i}
              icon={iconMap[actionType]}
              onClick={() => onPick(i, actionType)}
            />
          )
        })}
      </div>
    </Modal>
  )
}

// ── Blind Snatch: select target hidden card + own revealed card ──
export function BlindSnatchPickModal({ targetIdx, handOwnerIdx, players, myIdx, myRevealed, onPick }) {
  const [selTarget, setSelTarget] = useState(-1)
  const [selOwn,    setSelOwn]    = useState(-1)

  const targetPlayer    = players[targetIdx]
  const targetChits     = targetPlayer?.chits ?? []
  const hoIdx           = handOwnerIdx ?? myIdx
  const handOwnerPlayer = players[hoIdx]
  const handOwnerChits  = handOwnerPlayer?.chits ?? []
  const isOwnHand       = hoIdx === myIdx

  const targetNormals = targetChits.map((c, i) => ({ c, i })).filter(({ c }) => !isSpecial(c))
  // All normal cards from hand owner — no revealed filter (player knows their own cards)
  const ownRevealedCards = handOwnerChits.map((c, i) => ({ c, i })).filter(({ c }) => !isSpecial(c))

  const canConfirm = selTarget !== -1 && selOwn !== -1 && targetNormals.length > 0 && ownRevealedCards.length > 0

  return (
    <Modal emoji="🎲" title={`Swap with ${targetPlayer?.name ?? 'Target'}`} color="#FFD600">
      <p style={{ color:'rgba(255,214,0,.7)', fontSize:12, textAlign:'center', marginBottom:16, fontWeight:800 }}>
        Select one of their cards + one of your revealed cards to swap!
      </p>

      <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:800, marginBottom:8, textAlign:'center' }}>
        {targetPlayer?.name ?? 'Target'}'s cards (hidden)
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
        {targetNormals.map(({ c, i }) => (
          <MiniChit key={i} chit={c} masked selected={selTarget === i} onClick={() => setSelTarget(prev => prev === i ? -1 : i)} label="pick?" />
        ))}
        {targetNormals.length === 0 && (
          <p style={{ color:'rgba(255,255,255,.4)', fontSize:13 }}>No normal cards to steal!</p>
        )}
      </div>

      <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:800, marginBottom:8, textAlign:'center' }}>
        Your revealed cards to give
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
        {ownRevealedCards.map(({ c, i }) => (
          <MiniChit key={i} chit={c} selected={selOwn === i} onClick={() => setSelOwn(prev => prev === i ? -1 : i)} label="give?" />
        ))}
        {ownRevealedCards.length === 0 && (
          <p style={{ color:'rgba(255,255,255,.4)', fontSize:13 }}>No revealed cards to give! Reveal one first.</p>
        )}
      </div>

      <button className="btn btn-yellow" style={{ width:'100%' }}
        disabled={!canConfirm}
        onClick={() => onPick(selTarget, selOwn)}>
        🎲 Swap Cards!
      </button>
    </Modal>
  )
}

// ── Revealed Snatch: 2 target cards revealed; select + own revealed card ──
export function RevealedSnatchPickModal({ options, targetName, targetIdx, handOwnerIdx, players, myIdx, myRevealed, onPick }) {
  const [selTarget, setSelTarget] = useState(-1)
  const [selOwn,    setSelOwn]    = useState(-1)

  const targetChits     = players[targetIdx]?.chits ?? []
  const hoIdx           = handOwnerIdx ?? myIdx
  const handOwnerChits  = players[hoIdx]?.chits ?? []
  const revealedIdxs    = new Set((options ?? []).map(o => o.i))

  // All normal cards from hand owner — no revealed filter
  const ownRevealedCards = handOwnerChits.map((c, i) => ({ c, i })).filter(({ c }) => !isSpecial(c))

  const canConfirm = selTarget !== -1 && selOwn !== -1 && ownRevealedCards.length > 0

  return (
    <Modal emoji="👁" title={`Swap with ${targetName}'s chits`} color="#AA00FF">
      <p style={{ color:'rgba(170,0,255,.7)', fontSize:12, textAlign:'center', marginBottom:16, fontWeight:800 }}>
        👁 2 revealed — pick one to swap with your revealed card
      </p>

      <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:800, marginBottom:8, textAlign:'center' }}>
        {targetName}'s cards
      </div>
      <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
        {targetChits.map((c, fullIdx) => {
          if (isSpecial(c)) return null
          const revealed = revealedIdxs.has(fullIdx)
          return (
            <MiniChit
              key={fullIdx}
              chit={c}
              masked={!revealed}
              selected={selTarget === fullIdx}
              onClick={() => setSelTarget(prev => prev === fullIdx ? -1 : fullIdx)}
              label={revealed ? 'revealed' : 'hidden'}
            />
          )
        })}
      </div>

      <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:800, marginBottom:8, textAlign:'center' }}>
        Your revealed cards to give
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
        {ownRevealedCards.map(({ c, i }) => (
          <MiniChit key={i} chit={c} selected={selOwn === i} onClick={() => setSelOwn(prev => prev === i ? -1 : i)} label="give?" />
        ))}
        {ownRevealedCards.length === 0 && (
          <p style={{ color:'rgba(255,255,255,.4)', fontSize:13 }}>No revealed cards to give! Reveal one first.</p>
        )}
      </div>

      <button className="btn btn-purple" style={{ width:'100%' }}
        disabled={!canConfirm}
        onClick={() => onPick(selTarget, selOwn)}>
        👁 Swap Cards!
      </button>
    </Modal>
  )
}

// ── Nuke: pick which special to destroy (shown masked) ────────
export function NukePickCardModal({ targetIdx, specials, players, onPick }) {
  const targetName = players[targetIdx]?.name ?? 'Target'
  const [sel, setSel] = useState(-1)
  return (
    <Modal emoji="💣" title={`Nuke ${targetName}'s Special`} color="#E53935">
      <p style={{ color:'rgba(229,57,53,.7)', fontSize:12, textAlign:'center', marginBottom:20, fontWeight:800 }}>
        Pick a special to destroy permanently!
      </p>
      {specials.length === 0 ? (
        <p style={{ textAlign:'center', color:'rgba(255,255,255,.4)', fontSize:13, marginBottom:20 }}>
          They have no specials to nuke!
        </p>
      ) : (
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:24 }}>
          {specials.map(({ c, i }) => (
            <div key={i} style={{ textAlign:'center' }}>
              <MiniChit chit={c} masked selected={sel===i} onClick={() => setSel(i)} />
              <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', marginTop:4, fontWeight:700 }}>special</div>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-red" style={{ width:'100%' }}
        disabled={sel===-1 || specials.length===0}
        onClick={() => onPick(specials.find(s=>s.i===sel)?.i ?? sel)}>
        💣 Nuke It!
      </button>
    </Modal>
  )
}

// ── Vitals result ─────────────────────────────────────────────
export function VitalsModal({ data, onClose }) {
  const colorMap = { 'SHOW!':'#E53935', danger:'#FF6D00', high:'#FFD600', medium:'#43A047', low:'#1E88E5', unknown:'#666' }
  const emojiMap = { 'SHOW!':'🔥🔥🔥', danger:'🔥🔥', high:'⚠️', medium:'📊', low:'😴', unknown:'❓' }
  return (
    <Modal emoji="📊" title="Vitals Report" color="#43A047">
      <p style={{ color:'rgba(255,255,255,.45)', fontSize:12, textAlign:'center', marginBottom:20, fontWeight:700 }}>
        Estimated match probability for each player
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
        {data.map(({ name, level, desc, maxSame, total }) => {
          const color = colorMap[level] ?? '#666'
          return (
            <div key={name} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
              borderRadius:10, background:`${color}18`, border:`1px solid ${color}44`,
            }}>
              <span style={{ fontSize:20 }}>{emojiMap[level]}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:900, fontSize:13, color:'#fff' }}>{name}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontWeight:700 }}>{desc}</div>
              </div>
              <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:16, color }}>
                {maxSame}/{total}
              </div>
            </div>
          )
        })}
        {data.length === 0 && (
          <p style={{ textAlign:'center', color:'rgba(255,255,255,.4)', fontSize:13 }}>No data available.</p>
        )}
      </div>
      <button className="btn btn-green" style={{ width:'100%' }} onClick={onClose}>Got it!</button>
    </Modal>
  )
}

// ── Super Vitals result ───────────────────────────────────────
export function SuperVitalsModal({ data, onClose }) {
  return (
    <Modal emoji="⚡" title="Super Vitals" color="#FF8F00">
      <p style={{ color:'rgba(255,143,0,.7)', fontSize:12, textAlign:'center', marginBottom:20, fontWeight:800 }}>
        Players who can call SHOW right now:
      </p>
      {data.length === 0 ? (
        <div style={{ textAlign:'center', padding:'20px 0' }}>
          <div style={{ fontSize:40, marginBottom:8 }}>😌</div>
          <p style={{ color:'rgba(255,255,255,.55)', fontSize:14, fontWeight:800 }}>
            Nobody can show right now. You're safe!
          </p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          {data.map(({ name, idx }) => {
            const sc = SEAT_COLORS[idx % SEAT_COLORS.length]
            return (
              <div key={name} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                borderRadius:12, background:'rgba(229,57,53,.15)', border:'1px solid rgba(229,57,53,.4)',
              }}>
                <span style={{ fontSize:24 }}>🔥</span>
                <div style={{
                  width:30, height:30, borderRadius:'50%',
                  background:`${sc}33`, color:sc, border:`2px solid ${sc}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:"'Fredoka One',cursive", fontSize:12,
                }}>{initials(name)}</div>
                <span style={{ flex:1, fontWeight:900, fontSize:14, color:'#fff' }}>{name}</span>
                <span style={{ color:'#E53935', fontWeight:900, fontSize:13 }}>CAN SHOW!</span>
              </div>
            )
          })}
        </div>
      )}
      <button className="btn btn-yellow" style={{ width:'100%' }} onClick={onClose}>Got it!</button>
    </Modal>
  )
}

// ── Puppeteer: you are being controlled ──────────────────────
export function PuppetedOverlay({ puppeteerName }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:45,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(123,31,162,.25)', backdropFilter:'blur(4px)',
      pointerEvents:'none',
    }}>
      <div style={{
        padding:'20px 32px', borderRadius:20,
        background:'rgba(123,31,162,.85)', backdropFilter:'blur(16px)',
        border:'2px solid rgba(170,0,255,.6)',
        textAlign:'center',
        boxShadow:'0 0 40px rgba(123,31,162,.5)',
      }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🎭</div>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:'1.3rem', color:'#fff', marginBottom:6 }}>
          You're being Puppeteered!
        </div>
        <div style={{ color:'rgba(255,255,255,.65)', fontSize:13, fontWeight:800 }}>
          {puppeteerName} is controlling your turn…
        </div>
      </div>
    </div>
  )
}

// ── Puppeteer: target's hand shown to puppeteer ───────────────
export function PuppeteerHandModal({ targetPlayer, targetIdx, targetName, selectedChit, onChitClick, onPass, onUseSpecial, onDone }) {
  const [sel, setSel] = useState(-1)
  const chits = targetPlayer?.chits ?? []

  function handleChit(i) {
    const chit = chits[i]
    if (!chit) return
    setSel(prev => prev === i ? -1 : i)
    onChitClick(i)
  }

  return (
    <Modal emoji="🎭" title={`Controlling ${targetName}`} color="#7B1FA2">
      <p style={{ color:'rgba(170,0,255,.6)', fontSize:12, textAlign:'center', marginBottom:16, fontWeight:800 }}>
        You see their full hand — select a chit to pass or use a special!
      </p>

      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
        {chits.map((c, i) => (
          <div key={i} style={{ textAlign:'center' }}>
            <MiniChit chit={c} selected={sel===i} onClick={() => handleChit(i)} />
            {isSpecial(c) && (
              <div style={{ fontSize:8, color:'rgba(170,0,255,.7)', fontWeight:900, marginTop:3, textTransform:'uppercase' }}>
                {c.name}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        <button className="btn btn-blue"
          disabled={sel===-1 || isSpecial(chits[sel])}
          onClick={() => onPass(sel, true)}>
          📤 Pass Chit
        </button>
        {sel !== -1 && isSpecial(chits[sel]) && (
          <button className="btn btn-purple"
            onClick={() => onUseSpecial(sel, chits[sel], true)}>
            ✨ Use {chits[sel]?.name}
          </button>
        )}
      </div>
    </Modal>
  )
}

// ── Master dispatcher ─────────────────────────────────────────
export function SpecialModalManager({
  specialAction, room, myIdx, myPlayer, myRevealed,
  amIPuppeted, amIPuppeteer, puppetTarget,
  puppeteerName,
  onUse, onPass, onCancel,
  onPickTarget, onBlindSnatchPickCard, onRevealedSnatchPick, onNukePickCard,
  onDismissVitals,
  onPuppetChitClick, onPuppetPass, onPuppetUseSpecial,
}) {
  if (!specialAction && !amIPuppeted && !amIPuppeteer) return null

  // Compute isMyTurn from room state
  const isMyTurn = room?.currentTurn === myIdx
    || !!(room?.effects?.find(e => e.type === 'PUPPETEER' && e.ownerIdx === myIdx && e.targetIdx === room?.currentTurn))

  if (amIPuppeteer && !specialAction) {
    return (
      <PuppeteerHandModal
        targetPlayer={puppetTarget}
        targetIdx={room?.puppeteerInfo?.targetIdx}
        targetName={puppetTarget?.name ?? 'Target'}
        onChitClick={onPuppetChitClick}
        onPass={onPuppetPass}
        onUseSpecial={onPuppetUseSpecial}
        onDone={onCancel}
      />
    )
  }

  if (amIPuppeted && !specialAction) {
    return <PuppetedOverlay puppeteerName={puppeteerName} />
  }

  if (!specialAction) return null

  switch (specialAction.type) {
    case 'USE_OR_PASS':
      return (
        <UseOrPassModal
          special={specialAction.special} chitIdx={specialAction.chitIdx}
          forActing={specialAction.forActing}
          isMyTurn={isMyTurn}
          onUse={onUse} onPass={onPass} onCancel={onCancel}
        />
      )
    case 'PICK_TARGET':
      return (
        <PickTargetModal
          actionType={specialAction.actionType}
          players={room?.players ?? []} myIdx={myIdx}
          exclude={specialAction.exclude ?? []}
          onPick={onPickTarget}
        />
      )
    case 'BLIND_SNATCH_PICK_CARD':
      return (
        <BlindSnatchPickModal
          targetIdx={specialAction.targetIdx}
          handOwnerIdx={specialAction.handOwnerIdx ?? myIdx}
          players={room?.players ?? []}
          myIdx={myIdx}
          myRevealed={myRevealed}
          onPick={onBlindSnatchPickCard}
        />
      )
    case 'REVEALED_SNATCH_PICK':
      return (
        <RevealedSnatchPickModal
          options={specialAction.options}
          targetIdx={specialAction.targetIdx}
          handOwnerIdx={specialAction.handOwnerIdx ?? myIdx}
          targetName={room?.players[specialAction.targetIdx]?.name ?? 'Target'}
          players={room?.players ?? []}
          myIdx={myIdx}
          myRevealed={myRevealed}
          onPick={onRevealedSnatchPick}
        />
      )
    case 'NUKE_PICK_CARD':
      return (
        <NukePickCardModal
          targetIdx={specialAction.targetIdx}
          specials={specialAction.specials}
          players={room?.players ?? []}
          onPick={onNukePickCard}
        />
      )
    case 'VITALS_RESULT':
      return <VitalsModal data={specialAction.data} onClose={onDismissVitals} />
    case 'SUPER_VITALS_RESULT':
      return <SuperVitalsModal data={specialAction.data} onClose={onDismissVitals} />
    default:
      return null
  }
}
