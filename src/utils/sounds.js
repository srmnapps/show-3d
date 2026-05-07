// src/utils/sounds.js

const LS_SFX_ENABLED      = 'show_sfx_enabled'
const LS_SFX_VOLUME       = 'show_sfx_volume'
const LS_AMBIENCE_ENABLED = 'show_ambience_enabled'
const LS_AMBIENCE_VOLUME  = 'show_ambience_volume'

const DEFAULT_SFX_VOL = 0.35
const DEFAULT_AMB_VOL = 0.12

function _bool(key, def) {
  try { const v = localStorage.getItem(key); return v === null ? def : v === 'true' } catch { return def }
}
function _num(key, def) {
  try { const v = parseFloat(localStorage.getItem(key)); return isNaN(v) ? def : v } catch { return def }
}
function _save(key, val) { try { localStorage.setItem(key, String(val)) } catch {} }

// ── Settings ──────────────────────────────────────────────────────
export const getSfxEnabled      = () => _bool(LS_SFX_ENABLED,     true)
export const setSfxEnabled      = (v) => _save(LS_SFX_ENABLED,    v)
export const getSfxVolume       = () => _num(LS_SFX_VOLUME,        DEFAULT_SFX_VOL)
export const setSfxVolume       = (v) => _save(LS_SFX_VOLUME,      v)
export const getAmbienceEnabled = () => _bool(LS_AMBIENCE_ENABLED, true)
export const getAmbienceVolume  = () => _num(LS_AMBIENCE_VOLUME,   DEFAULT_AMB_VOL)

// Legacy aliases
export const getSoundEnabled = getSfxEnabled
export const setSoundEnabled = setSfxEnabled
export const getSoundVolume  = getSfxVolume
export const setSoundVolume  = setSfxVolume

export function setAmbienceEnabled(v) {
  _save(LS_AMBIENCE_ENABLED, v)
  if (!v) _pauseAllAmbience()
  else if (_wantAmb && _unlocked) _doPlayAmbience(_wantAmb)
}
export function setAmbienceVolume(v) {
  _save(LS_AMBIENCE_VOLUME, v)
  Object.values(_ambEls).forEach(el => { try { el.volume = v } catch {} })
}

// ── Sound files ───────────────────────────────────────────────────
const SOUND_FILES = {
  button:               '/sounds/button.wav',
  loadingStart:         '/sounds/loading-start.mp3',
  cardFlip:             '/sounds/card-flip.wav',
  cardSelect:           '/sounds/card-select.wav',
  cardReorder:          '/sounds/card-reorder.wav',
  cardPass:             '/sounds/card-pass.wav',
  show:                 '/sounds/show.wav',
  roundResult:          '/sounds/round-result.wav',
  gameEnd:              '/sounds/game-end.wav',
  error:                '/sounds/error.wav',
  yourTurn:             '/sounds/your-turn.wav',
  specialReverse:       '/sounds/special-reverse.wav',
  specialFreeze:        '/sounds/special-freeze.wav',
  specialBlindSnatch:   '/sounds/special-blind-snatch.wav',
  specialRevealedSnatch:'/sounds/special-revealed-snatch.wav',
  specialStunGrenade:   '/sounds/special-stun-grenade.mp3',
  specialVitals:        '/sounds/special-vitals.wav',
  specialSuperVitals:   '/sounds/special-super-vitals.wav',
  specialNuke:          '/sounds/special-nuke.mp3',
}

const AMBIENCE_FILES = {
  lobby:  '/sounds/bg-lobby-loop.wav',
  game1:  '/sounds/bg-game-loop-1.mp3',
  result: '/sounds/bg-result-loop.wav',
}

export const SPECIAL_SOUND_MAP = {
  REVERSE:         'specialReverse',
  FREEZE:          'specialFreeze',
  BLIND_SNATCH:    'specialBlindSnatch',
  REVEALED_SNATCH: 'specialRevealedSnatch',
  STUN_GRENADE:    'specialStunGrenade',
  VITALS:          'specialVitals',
  SUPER_VITALS:    'specialSuperVitals',
  NUKE:            'specialNuke',
}

// ── State ─────────────────────────────────────────────────────────
let _unlocked = false
let _initDone = false
let _wantAmb  = null
const _ambEls = {}   // name → HTMLAudioElement

// ── Ambience element factory ──────────────────────────────────────
function _getAmbEl(name) {
  if (_ambEls[name]) return _ambEls[name]
  const src = AMBIENCE_FILES[name]
  if (!src) return null
  const el  = new Audio(src)
  el.loop   = true
  el.volume = getAmbienceVolume()
  el.addEventListener('error', () =>
    console.error('[AMBIENCE NOT FOUND]', name, src)
  )
  // Safety net: if loop somehow ends (network hiccup), restart it
  el.addEventListener('ended', () => {
    if (_wantAmb === name && _unlocked && getAmbienceEnabled()) {
      el.currentTime = 0
      el.play().catch(() => {})
    }
  })
  _ambEls[name] = el
  return el
}

function _pauseAllAmbience() {
  Object.values(_ambEls).forEach(el => {
    try { if (!el.paused) { el.pause(); el.currentTime = 0 } } catch {}
  })
}

function _doPlayAmbience(name) {
  // Pause all other tracks first
  Object.entries(_ambEls).forEach(([n, el]) => {
    if (n !== name) {
      try { if (!el.paused) { el.pause(); el.currentTime = 0 } } catch {}
    }
  })
  const el = _getAmbEl(name)
  if (!el) return
  el.volume = getAmbienceVolume()
  // Don't skip if paused — always attempt play so mobile resume works
  const p = el.play()
  if (p?.catch) p.catch(err => {
    // NotAllowedError = autoplay blocked — will retry on next gesture
    if (err.name !== 'NotAllowedError') {
      console.error('[AMBIENCE ERROR]', name, err.name, err.message)
    }
  })
}

// ── Unlock ────────────────────────────────────────────────────────
function _markUnlocked() {
  if (_unlocked) return
  _unlocked = true
  // MUST be synchronous — iOS/Android block audio started from setTimeout
  if (_wantAmb && getAmbienceEnabled()) {
    _doPlayAmbience(_wantAmb)
  }
}

// ── initAudio ─────────────────────────────────────────────────────
export function initAudio() {
  if (_initDone) return
  _initDone = true

  // Desktop: if AudioContext already running, unlock immediately
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) {
      const ctx = new Ctx()
      if (ctx.state === 'running') _markUnlocked()
      ctx.close()
    }
  } catch {}

  // Capture-phase listeners — fire before React handlers
  // Named function so removeEventListener works with same reference
  function _handler() {
    _markUnlocked()
    ;['pointerdown','mousedown','click','keydown','touchstart'].forEach(e =>
      document.removeEventListener(e, _handler, true)
    )
  }
  ;['pointerdown','mousedown','click','keydown','touchstart'].forEach(e =>
    document.addEventListener(e, _handler, true)
  )

  // ── visibilitychange: resume ambience when tab comes back ─────
  // On mobile, browsers suspend audio when the tab goes to background.
  // When the user returns, we need to explicitly resume.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (_wantAmb && _unlocked && getAmbienceEnabled()) {
        const el = _ambEls[_wantAmb]
        // el.paused could be true (suspended) or readyState could be broken
        // Always try to play — the browser will no-op if already running
        if (el) {
          el.play().catch(() => {
            // If play fails after returning to tab, recreate the element
            // (some Android browsers garbage-collect audio on background)
            delete _ambEls[_wantAmb]
            _doPlayAmbience(_wantAmb)
          })
        } else {
          _doPlayAmbience(_wantAmb)
        }
      }
    } else {
      // Tab going to background — some browsers need explicit pause
      // to avoid audio cutting/crackling when suspended
      _pauseAllAmbience()
    }
  })

  // ── pageshow: handles back/forward cache on iOS Safari ────────
  // iOS Safari restores pages from bfcache — audio is frozen but
  // the page is "visible", so visibilitychange doesn't fire.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && _wantAmb && _unlocked && getAmbienceEnabled()) {
      // Small delay needed — bfcache restore needs a tick to settle
      setTimeout(() => _doPlayAmbience(_wantAmb), 100)
    }
  })
}

export function unlockAudio() { _markUnlocked() }

// ── playSound ─────────────────────────────────────────────────────
export function playSound(name) {
  // Synchronous unlock — we are inside a gesture handler
  _markUnlocked()

  if (!getSfxEnabled()) return

  const src = SOUND_FILES[name]
  if (!src) { console.warn('[SFX] unknown key:', name); return }

  try {
    const el  = new Audio(src)
    el.volume = getSfxVolume()
    const p   = el.play()
    if (p?.catch) p.catch(err => console.error('[SFX ERROR]', name, err.name, err.message))
  } catch (err) {
    console.error('[SFX EXCEPTION]', name, err)
  }
}

export function playSpecial(type) {
  const name = SPECIAL_SOUND_MAP[type]
  if (name) playSound(name)
}

// ── playAmbience ─────────────────────────────────────────────────
export function playAmbience(name) {
  if (!name) return
  // Already playing the right track — no-op
  const existing = _ambEls[name]
  if (existing && !existing.paused && _wantAmb === name) return
  _wantAmb = name
  if (!getAmbienceEnabled()) { _pauseAllAmbience(); return }
  if (!_unlocked) {
    // Intent stored — starts synchronously on first gesture via _markUnlocked
    _pauseAllAmbience()
    return
  }
  _doPlayAmbience(name)
}

export function stopAmbience() {
  _wantAmb = null
  _pauseAllAmbience()
}

let _chosenLoop = null
export function chooseGameLoop()  { if (!_chosenLoop) _chosenLoop = 'game1'; return _chosenLoop }
export function resetGameLoop()   { _chosenLoop = null }

export function withButtonSound(fn) {
  return (...args) => { playSound('button'); return fn?.(...args) }
}