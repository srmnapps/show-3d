// src/utils/sounds.js
// File-based audio manager using HTMLAudioElement.
// Loads WAV files from /sounds/ (Vite public folder).
// Supports separate SFX and Ambience controls with localStorage persistence.

// ── localStorage keys ────────────────────────────────────────
const LS_SFX_ENABLED      = 'show_sfx_enabled'
const LS_SFX_VOLUME       = 'show_sfx_volume'
const LS_AMBIENCE_ENABLED = 'show_ambience_enabled'
const LS_AMBIENCE_VOLUME  = 'show_ambience_volume'

// ── State ────────────────────────────────────────────────────
let _sfxEnabled      = true
let _sfxVolume       = 0.35
let _ambienceEnabled = true
let _ambienceVolume  = 0.12
let _unlocked        = false

let _currentAmbience = null   // { name, el } | null
let _ambienceTarget  = null   // name of desired ambience

// ── Persistence ──────────────────────────────────────────────
function loadPrefs() {
  try {
    const se = localStorage.getItem(LS_SFX_ENABLED)
    const sv = localStorage.getItem(LS_SFX_VOLUME)
    const ae = localStorage.getItem(LS_AMBIENCE_ENABLED)
    const av = localStorage.getItem(LS_AMBIENCE_VOLUME)
    if (se !== null) _sfxEnabled      = se === 'true'
    if (sv !== null) _sfxVolume       = clamp(parseFloat(sv))
    if (ae !== null) _ambienceEnabled = ae === 'true'
    if (av !== null) _ambienceVolume  = clamp(parseFloat(av))
  } catch {}
}

function savePrefs() {
  try {
    localStorage.setItem(LS_SFX_ENABLED,      String(_sfxEnabled))
    localStorage.setItem(LS_SFX_VOLUME,        String(_sfxVolume))
    localStorage.setItem(LS_AMBIENCE_ENABLED,  String(_ambienceEnabled))
    localStorage.setItem(LS_AMBIENCE_VOLUME,   String(_ambienceVolume))
  } catch {}
}

function clamp(v) { return isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v)) }

// ── Sound file maps ───────────────────────────────────────────
const SOUND_FILES = {
  button:               '/sounds/button.wav',
  loadingStart:         '/sounds/loading-start.wav',
  cardFlip:             '/sounds/card-flip.wav',
  cardSelect:           '/sounds/card-select.wav',
  cardReorder:          '/sounds/card-reorder.wav',
  cardPass:             '/sounds/card-pass.wav',
  show:                 '/sounds/show.wav',
  roundResult:          '/sounds/round-result.wav',
  gameEnd:              '/sounds/game-end.wav',
  error:                '/sounds/error.wav',
  specialReverse:       '/sounds/special-reverse.wav',
  specialFreeze:        '/sounds/special-freeze.wav',
  specialBlindSnatch:   '/sounds/special-blind-snatch.wav',
  specialRevealedSnatch:'/sounds/special-revealed-snatch.wav',
  specialStunGrenade:   '/sounds/special-stun-grenade.wav',
  specialVitals:        '/sounds/special-vitals.wav',
  specialSuperVitals:   '/sounds/special-super-vitals.wav',
  specialNuke:          '/sounds/special-nuke.wav',
}

const AMBIENCE_FILES = {
  lobby:  '/sounds/bg-lobby-loop.wav',
  game1:  '/sounds/bg-game-loop-1.wav',
  game2:  '/sounds/bg-game-loop-2.wav',
  game3:  '/sounds/bg-game-loop-3.wav',
  result: '/sounds/bg-result-loop.wav',
}

// ── Special card → sound name map ────────────────────────────
export const SPECIAL_SOUND_MAP = {
  REVERSE:          'specialReverse',
  FREEZE:           'specialFreeze',
  BLIND_SNATCH:     'specialBlindSnatch',
  REVEALED_SNATCH:  'specialRevealedSnatch',
  STUN_GRENADE:     'specialStunGrenade',
  VITALS:           'specialVitals',
  SUPER_VITALS:     'specialSuperVitals',
  NUKE:             'specialNuke',
}

// ── Preloaded SFX pool ────────────────────────────────────────
// Each SFX has a small pool so repeated sounds don't cut each other off.
const POOL_SIZE = 3
const _sfxPools = {}   // name → HTMLAudioElement[]
let   _sfxCursors = {} // name → index

function preloadSfx() {
  for (const [name, src] of Object.entries(SOUND_FILES)) {
    const pool = []
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = new Audio(src)
      el.preload = 'auto'
      pool.push(el)
    }
    _sfxPools[name]    = pool
    _sfxCursors[name]  = 0
  }
}

// Preload ambience elements (one per track, loop=true)
const _ambienceEls = {}

function preloadAmbience() {
  for (const [name, src] of Object.entries(AMBIENCE_FILES)) {
    const el = new Audio(src)
    el.loop    = true
    el.preload = 'auto'
    el.volume  = _ambienceEnabled ? _ambienceVolume : 0
    _ambienceEls[name] = el
  }
}

// ── Unlock audio on first user interaction ────────────────────
function tryUnlock() {
  if (_unlocked) return
  _unlocked = true

  // Resume any suspended AudioContext (not needed here, but safe)
  // Trigger a silent play on all pools to warm up mobile browsers
  const silentEl = new Audio()
  silentEl.volume = 0
  silentEl.play().catch(() => {})

  // If ambience was requested before unlock, start it now
  if (_ambienceTarget) {
    _startAmbience(_ambienceTarget)
  }
}

function attachUnlockListeners() {
  const events = ['click', 'touchstart', 'keydown', 'pointerdown']
  const handler = () => {
    tryUnlock()
    events.forEach(e => document.removeEventListener(e, handler))
  }
  events.forEach(e => document.addEventListener(e, handler, { passive: true }))
}

// ── Public: initAudio ─────────────────────────────────────────
export function initAudio() {
  loadPrefs()
  preloadSfx()
  preloadAmbience()
  attachUnlockListeners()
}

// ── SFX controls ─────────────────────────────────────────────
export function getSfxEnabled()       { return _sfxEnabled }
export function setSfxEnabled(v)      { _sfxEnabled = !!v; savePrefs() }
export function getSfxVolume()        { return _sfxVolume }
export function setSfxVolume(v)       { _sfxVolume = clamp(v); savePrefs() }

// Legacy aliases used by existing App.jsx
export function getSoundEnabled()     { return _sfxEnabled }
export function setSoundEnabled(v)    { setSfxEnabled(v) }
export function getSoundVolume()      { return _sfxVolume }
export function setSoundVolume(v)     { setSfxVolume(v) }

// ── Ambience controls ─────────────────────────────────────────
export function getAmbienceEnabled()  { return _ambienceEnabled }
export function setAmbienceEnabled(v) {
  _ambienceEnabled = !!v
  savePrefs()
  if (_currentAmbience) {
    _currentAmbience.el.volume = _ambienceEnabled ? _ambienceVolume : 0
    if (_ambienceEnabled && _currentAmbience.el.paused && _unlocked) {
      _currentAmbience.el.play().catch(() => {})
    } else if (!_ambienceEnabled) {
      _currentAmbience.el.pause()
    }
  }
}
export function getAmbienceVolume()   { return _ambienceVolume }
export function setAmbienceVolume(v) {
  _ambienceVolume = clamp(v)
  savePrefs()
  if (_currentAmbience && _ambienceEnabled) {
    _currentAmbience.el.volume = _ambienceVolume
  }
}

// ── Play SFX ─────────────────────────────────────────────────
export function playSound(name) {
  if (!_sfxEnabled) return
  const pool = _sfxPools[name]
  if (!pool) return
  try {
    const idx = _sfxCursors[name] % pool.length
    _sfxCursors[name] = (idx + 1) % pool.length
    const el = pool[idx]
    el.volume      = _sfxVolume
    el.currentTime = 0
    el.play().catch(() => {})
  } catch {}
}

// ── Play special by card type ─────────────────────────────────
export function playSpecial(type) {
  const name = SPECIAL_SOUND_MAP[type]
  if (name) playSound(name)
}

// ── Ambience internals ────────────────────────────────────────
function _stopCurrentAmbience() {
  if (!_currentAmbience) return
  try {
    _currentAmbience.el.pause()
    _currentAmbience.el.currentTime = 0
  } catch {}
  _currentAmbience = null
}

function _startAmbience(name) {
  const el = _ambienceEls[name]
  if (!el) return
  el.volume = _ambienceEnabled ? _ambienceVolume : 0
  el.currentTime = 0
  _currentAmbience = { name, el }
  if (_ambienceEnabled) {
    el.play().catch(() => {})
  }
}

// ── Public: playAmbience / stopAmbience ───────────────────────
export function playAmbience(name) {
  // No-op if same ambience already playing
  if (_currentAmbience?.name === name && !_currentAmbience.el.paused) return

  _stopCurrentAmbience()
  _ambienceTarget = name

  if (!_unlocked) return  // Will be started on first interaction
  _startAmbience(name)
}

export function stopAmbience() {
  _ambienceTarget = null
  _stopCurrentAmbience()
}

// ── Helper: choose a random game loop ────────────────────────
let _gameLoopChoice = null
export function chooseGameLoop() {
  if (!_gameLoopChoice) {
    const choices = ['game1', 'game2', 'game3']
    _gameLoopChoice = choices[Math.floor(Math.random() * choices.length)]
  }
  return _gameLoopChoice
}
export function resetGameLoop() { _gameLoopChoice = null }

// ── Helper: withButtonSound ───────────────────────────────────
export function withButtonSound(handler) {
  return (...args) => {
    playSound('button')
    handler?.(...args)
  }
}