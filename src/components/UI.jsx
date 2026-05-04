import { useState, useRef, useCallback, useEffect } from 'react'
import { AVATAR_COLORS, MEDALS, SEAT_COLORS, isSpecial, chitDisplay } from '../utils/game.js'
import { initials } from '../utils/helpers.js'
import { playSound } from '../utils/sounds.js'

// ── LoadingOverlay ────────────────────────────────────────────
export function LoadingOverlay({ message = 'Loading…' }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:200,
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'rgba(6,18,8,.92)', backdropFilter:'blur(14px)',
      pointerEvents:'all',
    }}>
      <div style={{ fontSize:40, marginBottom:18, animation:'spin .9s linear infinite' }}>⚙️</div>
      <div style={{
        fontFamily:"'Fredoka One',cursive", fontSize:'1.15rem',
        color:'rgba(255,255,255,.85)', letterSpacing:1,
      }}>
        {message}
      </div>
    </div>
  )
}

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

// ── Hand card ────────────────────────────────────────────────
// isStackedLayer = true → fan style but at a smaller size (for 8+4 two-layer hand)
// isLargeHand    = true → flat compact grid style (for 7-8 card hand)
// normal (both false) → premium full-size fan
export function HandCard({
  chit, revealed, selected, onClick,
  arcIndex, totalCards,
  stunned, frozen,
  isLargeHand,
  isStackedLayer,
  isDragging,
}) {
  const special   = isSpecial(chit)
  const display   = chitDisplay(chit)
  const isBlind   = stunned || frozen
  const showFront = !isBlind && revealed

  const mid   = (totalCards - 1) / 2
  const angle = (arcIndex - mid) * 5
  const lift  = Math.abs(arcIndex - mid) * 3

  let outerStyle

  if (isStackedLayer) {
    // Fan style identical to normal, just smaller card dimensions
    outerStyle = {
      width: 52, height: 74, borderRadius: 9,
      position: 'relative', flexShrink: 0,
      cursor: isDragging ? 'grabbing' : 'grab',
      userSelect: 'none',
      transform: selected
        ? 'perspective(500px) rotateX(5deg) translateY(-22px) rotate(0deg) scale(1.09)'
        : `perspective(500px) rotateX(5deg) rotate(${angle}deg) translateY(${lift}px)`,
      transition: isDragging ? 'none' : 'transform .18s, box-shadow .18s',
      opacity: isDragging ? 0.4 : 1,
      boxShadow: selected
        ? '0 0 0 3px #FFD600, 0 10px 24px rgba(0,0,0,.6)'
        : special && showFront
        ? '0 0 12px rgba(170,0,255,.4), 0 4px 12px rgba(0,0,0,.5)'
        : '0 4px 14px rgba(0,0,0,.55)',
      marginLeft: arcIndex === 0 ? 0 : -10,
      zIndex: isDragging ? 50 : selected ? 10 : arcIndex,
    }
  } else if (isLargeHand) {
    outerStyle = {
      width: 46, height: 64, borderRadius: 8,
      position: 'relative', flexShrink: 0,
      cursor: 'pointer', userSelect: 'none',
      transform: selected ? 'translateY(-10px) scale(1.08)' : 'none',
      transition: 'transform .18s, box-shadow .18s',
      boxShadow: selected
        ? '0 0 0 3px #FFD600, 0 8px 20px rgba(0,0,0,.6)'
        : special && showFront
        ? '0 0 10px rgba(170,0,255,.4), 0 3px 8px rgba(0,0,0,.5)'
        : '0 3px 10px rgba(0,0,0,.55)',
      zIndex: selected ? 10 : 1,
    }
  } else {
    // Normal premium fan (up to 6 cards)
    outerStyle = {
      width: 58, height: 82, borderRadius: 10,
      position: 'relative', flexShrink: 0,
      cursor: 'pointer', userSelect: 'none',
      transform: selected
        ? 'perspective(500px) rotateX(5deg) translateY(-28px) rotate(0deg) scale(1.09)'
        : `perspective(500px) rotateX(5deg) rotate(${angle}deg) translateY(${lift}px)`,
      transition: 'transform .18s, box-shadow .18s',
      boxShadow: selected
        ? '0 0 0 3px #FFD600, 0 12px 30px rgba(0,0,0,.6)'
        : special && showFront
        ? '0 0 12px rgba(170,0,255,.4), 0 4px 12px rgba(0,0,0,.5)'
        : '0 4px 14px rgba(0,0,0,.55)',
      marginLeft: arcIndex === 0 ? 0 : -12,
      zIndex: selected ? 10 : arcIndex,
    }
  }

  const borderR   = isStackedLayer ? 8 : isLargeHand ? 7 : 9
  const emojiSize = isStackedLayer ? 22 : isLargeHand ? 20 : 28
  const backSize  = isStackedLayer ? 18 : isLargeHand ? 16 : 22

  const faceBase = {
    position: 'absolute', inset: 0, borderRadius: borderR,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: 3, overflow: 'hidden',
  }

  return (
    <div
      style={outerStyle}
      onClick={onClick}
      className={`hand-card ${showFront ? 'is-revealed' : 'is-hidden'}`}
    >
      <div
        className="hand-card-inner"
        style={{ transitionDelay: showFront ? `${arcIndex * 50}ms` : '0ms' }}
      >
        <div className="hand-card-face hand-card-front" style={{
          ...faceBase,
          justifyContent: special ? 'space-evenly' : 'center',
          border: `2px solid ${selected ? 'rgba(255,214,0,.6)' : special ? 'rgba(170,0,255,.5)' : 'rgba(255,255,255,.15)'}`,
          background: special ? 'linear-gradient(135deg,#6a0dad,#9c27b0)' : '#fff',
        }}>
          <span style={{ fontSize: emojiSize, lineHeight: 1, flexShrink: 0 }}>{display}</span>
          {special && (
            <span className={`special-card-name${isStackedLayer ? ' special-card-name--sm' : ''}`}>
              {chit.name}
            </span>
          )}
        </div>
        <div className="hand-card-face hand-card-back" style={{
          ...faceBase,
          border: '2px solid rgba(255,255,255,.15)',
          background: 'linear-gradient(135deg,#1a237e 0%,#283593 50%,#1a237e 100%)',
        }}>
          <div style={{
            position: 'absolute', inset: 5, borderRadius: 6,
            backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.15) 1.5px,transparent 1.5px)',
            backgroundSize: '8px 8px',
          }}/>
          <span style={{ fontSize: backSize, fontFamily: "'Fredoka One',cursive", color: 'rgba(255,255,255,.5)', position: 'relative' }}>
            {stunned ? '💥' : frozen ? '🧊' : '?'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Player seat ───────────────────────────────────────────────
function getSeatPos(relIdx, total) {
  const seats = {
    2:[
      { bottom:'13%', left:'50%', transform:'translateX(-50%)' },
      { top:'10%',    left:'50%', transform:'translateX(-50%)' },
    ],
    3:[
      { bottom:'13%', left:'50%',  transform:'translateX(-50%)' },
      { top:'12%',    left:'16%',  transform:'none' },
      { top:'12%',    right:'16%', transform:'none' },
    ],
    4:[
      { bottom:'13%', left:'50%',  transform:'translateX(-50%)' },
      { top:'50%',    left:'3%',   transform:'translateY(-50%)' },
      { top:'10%',    left:'50%',  transform:'translateX(-50%)' },
      { top:'50%',    right:'3%',  transform:'translateY(-50%)' },
    ],
    5:[
      { bottom:'13%', left:'50%',  transform:'translateX(-50%)' },
      { top:'50%',    left:'2%',   transform:'translateY(-50%)' },
      { top:'10%',    left:'20%',  transform:'none' },
      { top:'10%',    right:'20%', transform:'none' },
      { top:'50%',    right:'2%',  transform:'translateY(-50%)' },
    ],
  }
  return (seats[total]??seats[2])[relIdx] ?? { bottom:'13%', left:'50%', transform:'translateX(-50%)' }
}

function Badge({ label, bg, color }) {
  return (
    <span style={{
      fontSize: 8, fontWeight: 900, letterSpacing: .5,
      padding: '1px 5px', borderRadius: 6,
      background: bg, color, textTransform: 'uppercase',
    }}>{label}</span>
  )
}

export function PlayerSeat({ player, idx, myIdx, totalPlayers, isActive, isFrozen, isStunned, isMe }) {
  const relIdx    = (idx - myIdx + totalPlayers) % totalPlayers
  const pos       = getSeatPos(relIdx, totalPlayers)
  const color     = SEAT_COLORS[idx % SEAT_COLORS.length]
  const specCount = player.chits.filter(c => isSpecial(c)).length

  let plateClass = 'seat-plate'
  if (isActive)  plateClass += ' active'
  if (isFrozen)  plateClass += ' frozen'
  if (isStunned) plateClass += ' stunned'

  return (
    <div className="seat" style={{ ...pos, position:'fixed' }}>
      {isActive && (
        <div style={{ width:10, height:10, borderRadius:'50%', background:color, boxShadow:`0 0 14px ${color},0 0 28px ${color}` }}/>
      )}
      <div className={plateClass} style={{ borderColor: isActive ? color : undefined }}>
        <div className="avatar" style={{ background:`${color}22`, color, width:24, height:24, fontSize:11, border:`1.5px solid ${color}` }}>
          {initials(player.name)}
        </div>
        <span className="seat-name" style={{ color: isMe ? color : '#fff' }}>
          {player.name}{isMe?' (you)':''}
        </span>
        <span className="seat-score">{player.score>0?'+':''}{player.score}</span>
        {isFrozen  && <span style={{ fontSize:13 }}>🧊</span>}
        {isStunned && <span style={{ fontSize:13 }}>💥</span>}
        {player.isShow && <span style={{ fontSize:13 }}>🔥</span>}
        {player.isBot    && <Badge label="BOT"  bg="rgba(30,136,229,.3)" color="#90CAF9" />}
        {player.botActive && <Badge label="AUTO" bg="rgba(67,160,71,.3)"  color="#A5D6A7" />}
        {player.online === false && <Badge label="OFF" bg="rgba(229,57,53,.3)" color="#EF9A9A" />}
      </div>
      <div style={{ display:'flex', gap:5, alignItems:'center', padding:'3px 10px', borderRadius:12, background:'rgba(0,0,0,.55)', border:`1px solid ${color}33` }}>
        <span style={{ fontSize:12 }}>🃏</span>
        <span style={{ fontSize:12, fontWeight:900, color:'rgba(255,255,255,.75)' }}>{player.chits.length}</span>
        {specCount>0 && <span style={{ fontSize:10, color:'#c084fc', fontWeight:900 }}>✦{specCount}</span>}
      </div>
    </div>
  )
}

// ── reconcileDisplayOrder ─────────────────────────────────────
// Reconcile displayOrder (array of chit ids) against the current chits array.
// • Cards that left: removed from order.
// • Cards that arrived: appended at the end.
// Stable ids (chit.id) prevent resets on every STATE_SYNC.
function reconcileDisplayOrder(order, chits) {
  const currentIds = chits.map(c => c.id).filter(Boolean)
  // Keep existing ids that are still in hand
  const kept    = order.filter(id => currentIds.includes(id))
  // Append brand-new ids not yet tracked
  const newIds  = currentIds.filter(id => !kept.includes(id))
  return [...kept, ...newIds]
}

// ── useDragReorder ────────────────────────────────────────────
// Container-level pointer tracking + FLIP animation on reorder.
//
// FLIP = First / Last / Invert / Play:
//   Before the state update  → record every card's getBoundingClientRect() (First)
//   After React re-renders   → record new positions (Last)
//   Compute the delta        → Invert (start each card translated back to where it was)
//   Animate to 0,0           → Play (transition to final position)
//
// slotRefsMap: Map<actualIdx → DOM element of .hand-card-slot>
// This lets us look up a card's DOM node regardless of its visual position.
function useDragReorder({ displayOrder, setDisplayOrder, myRevealed, blocked, containerRef }) {
  const dragFromRef  = useRef(null)
  const dragToRef    = useRef(null)
  const isDragging   = useRef(false)
  const startX       = useRef(0)
  const startY       = useRef(0)
  const longPressT   = useRef(null)

  // Map actualIdx → slot DOM element (populated by renderSlot via callback ref)
  const slotRefsMap  = useRef(new Map())

  const [draggingIdx, setDraggingIdx] = useState(null)
  const [dropIdx,     setDropIdx]     = useState(null)

  // ── FLIP animation ──────────────────────────────────────────
  // Call BEFORE setDisplayOrder to snapshot current positions.
  // Returns a function to call AFTER the DOM has updated (in useLayoutEffect).
  const snapPositions = useCallback(() => {
    const before = new Map()
    slotRefsMap.current.forEach((el, actualIdx) => {
      if (el) before.set(actualIdx, el.getBoundingClientRect())
    })
    return before
  }, [])

  const playFlip = useCallback((before) => {
    // Use rAF to ensure the browser has painted the new layout (Last position)
    requestAnimationFrame(() => {
      slotRefsMap.current.forEach((el, actualIdx) => {
        if (!el || !before.has(actualIdx)) return
        const first = before.get(actualIdx)
        const last  = el.getBoundingClientRect()
        const dx    = first.left - last.left
        const dy    = first.top  - last.top
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return  // didn't move, skip

        // Invert: jump card back to its old position instantly
        el.style.transform  = `translate(${dx}px, ${dy}px)`
        el.style.transition = 'transform 0s'

        // Play: animate to final (0,0) position
        requestAnimationFrame(() => {
          el.style.transform  = 'translate(0, 0)'
          el.style.transition = 'transform 380ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          // Clean up after animation completes
          const onEnd = () => {
            el.style.transform  = ''
            el.style.transition = ''
            el.removeEventListener('transitionend', onEnd)
          }
          el.addEventListener('transitionend', onEnd)
        })
      })
    })
  }, [])

  // ── Hit-test: which slot is under pointer, ignoring dragging card ──
  const hitTest = useCallback((x, y) => {
    const draggingEl = containerRef.current?.querySelector('.hc-dragging')
    if (draggingEl) draggingEl.style.pointerEvents = 'none'
    const el = document.elementFromPoint(x, y)
    if (draggingEl) draggingEl.style.pointerEvents = ''
    if (!el) return null
    const slot = el.closest('[data-vidx]')
    return slot ? parseInt(slot.dataset.vidx, 10) : null
  }, [containerRef])

  const reset = useCallback(() => {
    clearTimeout(longPressT.current)
    dragFromRef.current = null
    dragToRef.current   = null
    isDragging.current  = false
    setDraggingIdx(null)
    setDropIdx(null)
  }, [])

  const applyReorder = useCallback(() => {
    const from = dragFromRef.current
    const to   = dragToRef.current
    reset()   // clear drag state FIRST so cards don't flash dragging style during FLIP

    if (from !== null && to !== null && from !== to) {
      const before = snapPositions()   // First: snapshot before state change
      setDisplayOrder(prev => {
        const next = [...prev]
        const [card] = next.splice(from, 1)
        next.splice(to, 0, card)
        return next
      })
      // After React commits the new order to the DOM, run the animation
      // We use a short timeout as a stand-in for useLayoutEffect from outside a component.
      // The rAF inside playFlip handles the actual timing correctly.
      setTimeout(() => playFlip(before), 0)
    }
  }, [snapPositions, playFlip, setDisplayOrder, reset])

  // ── Per-card pointer down ───────────────────────────────────
  const onCardPointerDown = useCallback((e, visualIdx) => {
    if (blocked) return
    // data-revealed is set by renderSlot; if false, let the tap-to-reveal handler fire
    const slotEl = e.currentTarget
    if (slotEl.dataset.revealed === 'false') return

    startX.current      = e.clientX
    startY.current      = e.clientY
    dragFromRef.current = visualIdx
    isDragging.current  = false

    longPressT.current = setTimeout(() => {
      isDragging.current = true
      dragToRef.current  = visualIdx
      setDraggingIdx(visualIdx)
      setDropIdx(null)
      try { containerRef.current?.setPointerCapture(e.pointerId) } catch {}
    }, 200)
  }, [blocked, containerRef])

  // ── Container-level pointer move ────────────────────────────
  const onContainerPointerMove = useCallback((e) => {
    if (dragFromRef.current === null) return

    const dx = Math.abs(e.clientX - startX.current)
    const dy = Math.abs(e.clientY - startY.current)

    if (!isDragging.current && dx > 8 && dx > dy * 1.3) {
      clearTimeout(longPressT.current)
      isDragging.current = true
      dragToRef.current  = dragFromRef.current
      setDraggingIdx(dragFromRef.current)
      setDropIdx(null)
      try { containerRef.current?.setPointerCapture(e.pointerId) } catch {}
    }

    if (!isDragging.current) return

    const vidx = hitTest(e.clientX, e.clientY)
    if (vidx !== null && vidx !== dragToRef.current) {
      dragToRef.current = vidx
      setDropIdx(vidx)
    }
  }, [containerRef, hitTest])

  const onContainerPointerUp = useCallback((e) => {
    clearTimeout(longPressT.current)
    if (isDragging.current) {
      const vidx = hitTest(e.clientX, e.clientY)
      if (vidx !== null) dragToRef.current = vidx
      applyReorder()
    } else {
      reset()
    }
  }, [hitTest, applyReorder, reset])

  const onContainerPointerCancel = useCallback(() => reset(), [reset])

  // ── Callback ref: register/unregister each slot DOM node ───
  // Usage: ref={slotRef(actualIdx)} on each .hand-card-slot div
  const slotRef = useCallback((actualIdx) => (el) => {
    if (el) slotRefsMap.current.set(actualIdx, el)
    else    slotRefsMap.current.delete(actualIdx)
  }, [])

  return {
    draggingIdx,
    dropIdx,
    isDragging,
    slotRef,
    onCardPointerDown,
    onContainerPointerMove,
    onContainerPointerUp,
    onContainerPointerCancel,
  }
}

// ── Hand HUD ──────────────────────────────────────────────────
export function HandHud({
  myPlayer, myRevealed, selectedChit, isMyTurn, phase,
  canCallShow, mustPassNormal, specialAction, amIStunned,
  onChitClick, onPass, onCallShow,
}) {
  if (!myPlayer) return null
  const chits         = myPlayer.chits ?? []
  const blocked       = !!specialAction
  const isStackedHand = chits.length > 8          // 9+ cards → two-layer fan
  const isLargeHand   = !isStackedHand && chits.length >= 7 // 7-8 → compact grid

  // displayOrder[visualPos] = chit.id (stable across STATE_SYNC)
  const [displayOrder, setDisplayOrder] = useState(() =>
    chits.map(c => c.id).filter(Boolean)
  )

  // Reconcile when hand changes (pass/receive) — preserves order, only adds/removes
  const prevChitIds = useRef(chits.map(c => c.id).join(','))
  useEffect(() => {
    const newKey = chits.map(c => c.id).join(',')
    if (newKey !== prevChitIds.current) {
      prevChitIds.current = newKey
      setDisplayOrder(prev => reconcileDisplayOrder(prev, chits))
    }
  }, [chits])

  const containerRef = useRef(null)

  const {
    draggingIdx,
    dropIdx,
    isDragging,
    slotRef,
    onCardPointerDown,
    onContainerPointerMove,
    onContainerPointerUp,
    onContainerPointerCancel,
  } = useDragReorder({ displayOrder, setDisplayOrder, myRevealed, blocked, containerRef })

  let hint = ''
  if (amIStunned && isMyTurn)             hint = '💥 Stunned! Pass a chit blind!'
  else if (mustPassNormal)                hint = '✨ Special used — pass a normal chit'
  else if (isMyTurn && phase==='playing') hint = 'Tap to reveal · Select to pass · Drag to reorder'
  else if (phase==='playing')             hint = 'Tap once to reveal all 👀'

  // Shared card-slot renderer
  // chitId     = the chit's stable id (stored in displayOrder)
  // visualIdx  = position in displayOrder (used for drag hit-test via data-vidx)
  // arcIndex   = position within its layer row (used for fan angle/lift calc)
  // layerLen   = total cards in that layer (for mid-point calc)
  // stackedLayer = true if inside a two-layer stacked hand
  function renderSlot(chitId, visualIdx, arcIndex, layerLen, stackedLayer) {
    const actualIdx = chits.findIndex(c => c.id === chitId)
    const chit = chits[actualIdx]
    if (!chit || actualIdx === -1) return null

    const iAmDragging   = draggingIdx === visualIdx
    const iAmDropTarget = dropIdx === visualIdx && draggingIdx !== null && draggingIdx !== visualIdx

    return (
      <div
        key={`slot-${chitId}`}
        ref={slotRef(actualIdx)}
        className={[
          'hand-card-slot',
          iAmDragging   ? 'hc-dragging'    : '',
          iAmDropTarget ? 'hc-drop-target' : '',
        ].join(' ').trim()}
        data-vidx={visualIdx}
        data-revealed={myRevealed[actualIdx] ? 'true' : 'false'}
        onPointerDown={e => onCardPointerDown(e, visualIdx)}
        style={{ touchAction: 'none', userSelect: 'none' }}
      >
        <HandCard
          chit={chit}
          revealed={myRevealed[actualIdx] || false}
          selected={selectedChit === actualIdx}
          stunned={amIStunned}
          frozen={myPlayer.frozen}
          arcIndex={arcIndex}
          totalCards={layerLen}
          isLargeHand={stackedLayer ? false : isLargeHand}
          isStackedLayer={stackedLayer}
          isDragging={iAmDragging}
          onClick={() => {
            if (isDragging.current) return   // suppress click after drag
            if (!blocked) {
              // Sound: flip if not yet revealed, select if already revealed
              if (!myRevealed[actualIdx]) playSound('cardFlip')
              else playSound('cardSelect')
              onChitClick(actualIdx)
            }
          }}
        />
      </div>
    )
  }

  const containerEvents = {
    ref: containerRef,
    onPointerMove:   onContainerPointerMove,
    onPointerUp:     onContainerPointerUp,
    onPointerCancel: onContainerPointerCancel,
  }

  return (
    <div className="hand-hud">
      {amIStunned && (
        <div style={{
          textAlign:'center', padding:'6px 16px', borderRadius:20,
          background:'rgba(229,57,53,.2)', border:'1px solid rgba(229,57,53,.5)',
          color:'#EF5350', fontSize:13, fontWeight:900,
          animation:'stunPulse 1s ease-in-out infinite',
        }}>
          💥 STUNNED — pass blind!
        </div>
      )}

      {isStackedHand ? (
        // ── 8+4 mode: two rows, each a fan of ≤6 cards ──
        <div className="hand-cards hand-cards--stacked" {...containerEvents}>
          <div className="hand-layer hand-layer--top">
            {displayOrder.slice(0, 6).map((chitId, i) =>
              renderSlot(chitId, i, i, Math.min(6, displayOrder.length), true)
            )}
          </div>
          <div className="hand-layer hand-layer--bottom">
            {displayOrder.slice(6).map((chitId, i) =>
              renderSlot(chitId, 6 + i, i, displayOrder.slice(6).length, true)
            )}
          </div>
        </div>
      ) : (
        // ── Normal / large single-row ──
        <div
          className={`hand-cards${isLargeHand ? ' hand-cards--large' : ''}`}
          {...containerEvents}
        >
          {displayOrder.map((chitId, visualIdx) =>
            renderSlot(chitId, visualIdx, visualIdx, displayOrder.length, false)
          )}
          {chits.length === 0 && (
            <span style={{ color:'rgba(255,255,255,.4)', fontSize:13, fontWeight:800 }}>No chits</span>
          )}
        </div>
      )}

      {hint && (
        <div style={{ textAlign:'center', fontSize:12, color:'rgba(255,255,255,.5)', fontWeight:800 }}>
          {hint}
        </div>
      )}

      <div className="action-row">
        {phase==='playing' && (isMyTurn || mustPassNormal) && (
          <button
            className="btn btn-blue btn-lg"
            disabled={selectedChit === -1 || blocked}
            onClick={() => { playSound('button'); onPass(selectedChit) }}
          >
            {mustPassNormal ? '📤 Pass Normal' : amIStunned ? '🙈 Pass Blind' : '📤 Pass Chit'}
          </button>
        )}
        {phase==='playing' && canCallShow && !mustPassNormal && !amIStunned && (
          <button className="btn btn-red btn-lg pulse" disabled={blocked}
            onClick={() => { playSound('show'); onCallShow() }}>
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
      {logs.slice(0,10).map((l,i) => <div key={i} className="log-entry">› {l}</div>)}
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
    if (amIStunned&&isMyTurn)    { cls+='status-show';    text='💥 Stunned — pass blind!' }
    else if (mustPassNormal)     { cls+='status-playing'; text='✨ Now pass a normal chit!' }
    else if (isMyTurn)           { cls+='status-playing'; text='✋ YOUR TURN!' }
    else                         { cls+='status-wait';    text=`${turnPlayer?.name}'s turn…` }
  }
  else if (phase==='showWindow')            { cls+='status-show';     text='🎉 SHOW WINDOW OPEN!' }
  else if (phase==='afterShow')             { cls+='status-show';     text='👀 Revealing hands…' }
  else if (phase==='roundEnd')              { cls+='status-roundend'; text=`⚡ Round ${room.round} done!` }
  else if (phase==='pendingSpecial')        { cls+='status-special';  text='✨ Special card in play!' }
  else if (phase==='revealedSnatchPicking') { cls+='status-special';  text='👁 Pick a revealed chit!' }
  else if (phase==='nukePicking')           { cls+='status-special';  text='💣 Pick a special to nuke!' }
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
        <button className="btn btn-red btn-xl pulse" style={{ marginTop:16 }}
          onClick={() => { playSound('show'); onJoinShow() }}>
          🎉 JOIN SHOW!
        </button>
      )}
      {hasJoinedShow && (
        <div className="btn btn-green" style={{ marginTop:16, pointerEvents:'none' }}>✓ YOU'RE IN!</div>
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
        <div style={{ padding:'10px 18px', borderRadius:30, background:'rgba(0,0,0,.65)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,.12)', fontSize:13, fontWeight:800, color:'rgba(255,255,255,.6)' }}>
          ⏳ Waiting for host…
        </div>
      )}
    </div>
  )
}

// ── Round Result Modal ────────────────────────────────────────
export function RoundResultModal({ room }) {
  if (!room?.roundResults?.length) return null
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:35,
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'1rem', background:'rgba(0,0,0,.76)', backdropFilter:'blur(8px)',
      overflowY:'auto',
    }}>
      <div style={{
        width:'100%', maxWidth:460,
        background:'rgba(4,12,6,.97)',
        border:'1.5px solid rgba(255,255,255,.12)',
        borderRadius:18, padding:'20px 18px',
        boxShadow:'0 12px 48px rgba(0,0,0,.8)',
        maxHeight:'78vh', overflowY:'auto',
      }}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:'1.5rem', color:'#fff', marginBottom:4 }}>
            Round Results
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', fontWeight:800, letterSpacing:1, textTransform:'uppercase' }}>
            All hands revealed
          </div>
        </div>
        {room.roundResults.map(result => {
          const color = SEAT_COLORS[result.playerIdx % SEAT_COLORS.length]
          const chits = result.chits ?? []
          return (
            <div key={result.playerIdx} style={{
              marginBottom:10, padding:'12px 14px', borderRadius:12,
              background: result.isShow ? 'rgba(255,214,0,.08)' : 'rgba(255,255,255,.04)',
              border:`1px solid ${result.isShow ? 'rgba(255,214,0,.35)' : 'rgba(255,255,255,.08)'}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div className="avatar" style={{ background:`${color}22`, color, border:`1.5px solid ${color}`, width:26, height:26, fontSize:10 }}>
                  {initials(result.name)}
                </div>
                <div style={{ flex:1, color:'#fff', fontWeight:900, fontSize:13 }}>{result.name}</div>
                {result.isShow && <div style={{ color:'#FFD600', fontWeight:900, fontSize:12 }}>SHOW</div>}
                {typeof result.roundPoints === 'number' && (
                  <div style={{ color:'#43A047', fontWeight:900, fontSize:12 }}>+{result.roundPoints}</div>
                )}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {chits.map((chit, i) => {
                  const special = isSpecial(chit)
                  return (
                    <div key={i} style={{
                      width:34, height:46, borderRadius:7,
                      display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column',
                      background: special ? 'linear-gradient(135deg,#6a0dad,#9c27b0)' : '#fff',
                      border:'1px solid rgba(255,255,255,.18)',
                      boxShadow:'0 2px 8px rgba(0,0,0,.35)',
                    }}>
                      <span style={{ fontSize:18, lineHeight:1 }}>{chitDisplay(chit)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
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
          <h2 style={{ fontFamily:"'Fredoka One',cursive", fontSize:'2.2rem', marginBottom:'.3rem', background:'linear-gradient(135deg,#E53935,#FFD600,#1E88E5,#43A047)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>GAME OVER!</h2>
          <p style={{ color:'rgba(255,255,255,.55)', fontSize:13, fontWeight:800, marginBottom:'1.5rem' }}>
            {sorted[0]?.name} wins with <span style={{ color:'#FFD600', fontFamily:"'Fredoka One',cursive", fontSize:18 }}>{sorted[0]?.score}</span> pts!
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:'1.5rem', textAlign:'left' }}>
            {sorted.map((p,i) => {
              const pidx = room.players.findIndex(pl=>pl.id===p.id)
              const sc   = SEAT_COLORS[pidx%SEAT_COLORS.length]
              return (
                <div key={p.id} className={`score-row${i===0?' first':''}`}>
                  <span style={{ fontSize:20, width:26 }}>{MEDALS[i]}</span>
                  <div className="avatar" style={{ background:`${sc}22`, color:sc, border:`1.5px solid ${sc}` }}>{initials(p.name)}</div>
                  <span style={{ flex:1, fontSize:13, fontWeight:900, color:'#fff' }}>{p.name}</span>
                  <span style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:i===0?'#FFD600':'rgba(255,255,255,.45)' }}>{p.score}</span>
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