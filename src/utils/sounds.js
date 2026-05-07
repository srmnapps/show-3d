// show-3d/src/utils/sounds.js
// Reliable cross-browser sound manager

// ── LocalStorage keys ─────────────────────────────────────────────────────────
const LS_SFX_ENABLED      = 'show_sfx_enabled'
const LS_SFX_VOLUME       = 'show_sfx_volume'
const LS_AMBIENCE_ENABLED = 'show_ambience_enabled'
const LS_AMBIENCE_VOLUME  = 'show_ambience_volume'

const DEFAULT_SFX_VOL = 0.35
const DEFAULT_AMB_VOL = 0.12

// ── Sound file map ────────────────────────────────────────────────────────────
// Edit the extensions here if your files are .mp3 instead of .wav
const SOUND_FILES = {
  button:                '/sounds/button.wav',
  loadingStart:          '/sounds/loading-start.mp3',
  cardFlip:              '/sounds/card-flip.wav',
  cardSelect:            '/sounds/card-select.wav',
  cardReorder:           '/sounds/card-reorder.wav',
  cardPass:              '/sounds/card-pass.wav',
  show:                  '/sounds/show.wav',
  roundResult:           '/sounds/round-result.wav',
  gameEnd:               '/sounds/game-end.wav',
  error:                 '/sounds/error.wav',
  specialReverse:        '/sounds/special-reverse.wav',
  specialFreeze:         '/sounds/special-freeze.wav',
  specialBlindSnatch:    '/sounds/special-blind-snatch.wav',
  specialRevealedSnatch: '/sounds/special-revealed-snatch.wav',
  specialStunGrenade:    '/sounds/special-stun-grenade.mp3',
  specialVitals:         '/sounds/special-vitals.wav',
  specialSuperVitals:    '/sounds/special-super-vitals.wav',
  specialNuke:           '/sounds/special-nuke.wav',
}

const AMBIENCE_FILES = {
  lobby:  '/sounds/bg-lobby-loop.wav',
  game1:  '/sounds/bg-game-loop-1.mp3',
  game2:  '/sounds/bg-game-loop-1.mp3',
  game3:  '/sounds/bg-game-loop-1.mp3',
  result: '/sounds/bg-result-loop.wav',
}

// ── Module state ──────────────────────────────────────────────────────────────
let _unlocked   = false
let _initDone   = false

// The ambience track we WANT playing right now (set immediately on every playAmbience call)
let _wantAmb    = null
// One persistent looping Audio element per ambience track (created lazily)
const _ambEl    = {}

// ── localStorage helpers ──────────────────────────────────────────────────────
function _bool(key, def) {
  try { const v = localStorage.getItem(key); return v === null ? def : v === 'true' } catch { return def }
}
function _num(key, def) {
  try { const v = parseFloat(localStorage.getItem(key)); return isNaN(v) ? def : v } catch { return def }
}
function _save(key, val) { try { localStorage.setItem(key, String(val)) } catch {} }

// ── Settings API ──────────────────────────────────────────────────────────────
export const getSfxEnabled      = () => _bool(LS_SFX_ENABLED,      true)
export const setSfxEnabled      = (v) => _save(LS_SFX_ENABLED,     v)
export const getSfxVolume       = () => _num(LS_SFX_VOLUME,         DEFAULT_SFX_VOL)
export const setSfxVolume       = (v) => _save(LS_SFX_VOLUME,       v)
export const getAmbienceEnabled = () => _bool(LS_AMBIENCE_ENABLED,  true)
export const getAmbienceVolume  = () => _num(LS_AMBIENCE_VOLUME,    DEFAULT_AMB_VOL)

export function setAmbienceEnabled(v) {
  _save(LS_AMBIENCE_ENABLED, v)
  if (!v) {
    _pauseAll()
  } else if (_wantAmb && _unlocked) {
    _doPlay(_wantAmb)
  }
}
export function setAmbienceVolume(v) {
  _save(LS_AMBIENCE_VOLUME, v)
  Object.values(_ambEl).forEach(el => { try { el.volume = v } catch {} })
}

// Legacy aliases used in App.jsx
export const getSoundEnabled = getSfxEnabled
export const setSoundEnabled = setSfxEnabled

// ── Internal helpers ──────────────────────────────────────────────────────────

// Pause ALL ambience elements (not just current — safety net)
function _pauseAll() {
  Object.values(_ambEl).forEach(el => {
    try { if (!el.paused) { el.pause(); el.currentTime = 0 } } catch {}
  })
}

// Get or create a looping Audio element for an ambience track
function _getEl(name) {
  if (_ambEl[name]) return _ambEl[name]
  const src = AMBIENCE_FILES[name]
  if (!src) return null
  const el  = new Audio(src)
  el.loop   = true
  el.volume = getAmbienceVolume()
  // Log load errors so missing files are visible
  el.addEventListener('error', () =>
    console.error('[AMBIENCE FILE NOT FOUND]', name, src,
      '— check show-3d/public/sounds/ has this file')
  )
  _ambEl[name] = el
  return el
}

// Actually start playing a named ambience track.
// Pauses everything else first, then starts this one.
function _doPlay(name) {
  // Stop all other tracks
  Object.entries(_ambEl).forEach(([n, el]) => {
    if (n !== name) {
      try { if (!el.paused) { el.pause(); el.currentTime = 0 } } catch {}
    }
  })
  const el = _getEl(name)
  if (!el) return
  el.volume = getAmbienceVolume()
  if (!el.paused) return  // already playing this exact element
  const p = el.play()
  if (p && typeof p.catch === 'function') {
    p.catch(err => {
      // NotAllowedError = autoplay blocked (shouldn't happen post-unlock)
      // NotSupportedError = file not found or bad format
      console.error('[AMBIENCE PLAY ERROR]', name, err.name, err.message)
    })
  }
}

// ── initAudio ─────────────────────────────────────────────────────────────────
export function initAudio() {
  if (_initDone) return
  _initDone = true
  console.log('[SOUND INIT]')

  function _unlock() {
    if (_unlocked) return
    _unlocked = true
    console.log('[SOUND UNLOCKED]')
    document.removeEventListener('pointerdown', _unlock, true)
    document.removeEventListener('click',       _unlock, true)
    document.removeEventListener('keydown',     _unlock, true)
    document.removeEventListener('touchstart',  _unlock, true)
    // Defer by one tick — play() called synchronously inside a capture-phase
    // listener still triggers NotAllowedError on Chrome/Safari because the
    // browser hasn't yet committed the gesture to the audio context.
    setTimeout(() => {
      if (_wantAmb && getAmbienceEnabled()) _doPlay(_wantAmb)
    }, 0)
  }

  // Use capture phase so we fire before React's own handlers
  document.addEventListener('pointerdown', _unlock, true)
  document.addEventListener('click',       _unlock, true)
  document.addEventListener('keydown',     _unlock, true)
  document.addEventListener('touchstart',  _unlock, true)
}

// ── unlockAudio (explicit call from UI) ───────────────────────────────────────
export function unlockAudio() {
  if (_unlocked) return
  _unlocked = true
  console.log('[SOUND UNLOCKED via unlockAudio]')
  setTimeout(() => {
    if (_wantAmb && getAmbienceEnabled()) _doPlay(_wantAmb)
  }, 0)
}

// ── playSound ─────────────────────────────────────────────────────────────────
// Creates a fresh Audio every call — most reliable cross-browser approach.
export function playSound(name) {
  if (!getSfxEnabled()) return
  if (!_unlocked) {
    console.log('[PLAY SOUND blocked — not yet unlocked]', name)
    return
  }
  const src = SOUND_FILES[name]
  if (!src) {
    console.warn('[PLAY SOUND] unknown key:', name)
    return
  }
  console.log('[PLAY SOUND]', name)
  try {
    const el  = new Audio(src)
    el.volume = getSfxVolume()
    const p   = el.play()
    if (p && typeof p.catch === 'function') {
      p.catch(err => console.error('[SFX PLAY ERROR]', name, err.name, err.message,
        '\n→ Check file exists at', src))
    }
  } catch (err) {
    console.error('[SFX ERROR]', name, err)
  }
}

// ── playSpecial ───────────────────────────────────────────────────────────────
const SPECIAL_SOUND_MAP = {
  REVERSE:          'specialReverse',
  FREEZE:           'specialFreeze',
  BLIND_SNATCH:     'specialBlindSnatch',
  REVEALED_SNATCH:  'specialRevealedSnatch',
  STUN_GRENADE:     'specialStunGrenade',
  VITALS:           'specialVitals',
  SUPER_VITALS:     'specialSuperVitals',
  NUKE:             'specialNuke',
}
export function playSpecial(type) {
  const name = SPECIAL_SOUND_MAP[type]
  if (name) playSound(name)
}

// ── playAmbience ──────────────────────────────────────────────────────────────
// Call this freely from React effects — it is idempotent:
// calling playAmbience('lobby') repeatedly while lobby is already playing does nothing.
export function playAmbience(name) {
  if (!name) return

  // If this is already the track we want AND it's playing — nothing to do
  if (_wantAmb === name) {
    const el = _ambEl[name]
    if (el && !el.paused) return  // already playing, skip
    // Element exists but paused (e.g. tab was backgrounded) — fall through to restart
  }

  console.log('[PLAY AMBIENCE]', name)
  _wantAmb = name  // always update intent

  if (!getAmbienceEnabled()) {
    // Muted — record intent but don't play
    _pauseAll()
    return
  }

  if (!_unlocked) {
    // Not yet unlocked — intent is recorded in _wantAmb, will start on first gesture
    _pauseAll()  // make sure nothing is playing
    return
  }

  _doPlay(name)
}

// ── stopAmbience ──────────────────────────────────────────────────────────────
export function stopAmbience() {
  _wantAmb = null
  _pauseAll()
}

// ── Game loop chooser ─────────────────────────────────────────────────────────
// All three loop keys point to game1 — only one file needed
const GAME_LOOPS = ['game1']
let _chosenLoop  = null
export function chooseGameLoop() {
  if (!_chosenLoop) _chosenLoop = GAME_LOOPS[Math.floor(Math.random() * GAME_LOOPS.length)]
  return _chosenLoop
}
export function resetGameLoop() { _chosenLoop = null }

// ── withButtonSound ───────────────────────────────────────────────────────────
export function withButtonSound(fn) {
  return (...args) => { playSound('button'); return fn?.(...args) }
}