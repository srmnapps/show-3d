// src/utils/sounds.js
// Web Audio API sound manager — no external files, no copyrighted assets.
// All sounds are synthesized with oscillators/noise for instant, lightweight playback.

let _ctx = null
let _enabled = true
let _volume = 0.35
let _unlocked = false

const LS_KEY_ENABLED = 'show_sound_enabled'
const LS_KEY_VOLUME  = 'show_sound_volume'

// ── Persistence ───────────────────────────────────────────────
function loadPrefs() {
  try {
    const e = localStorage.getItem(LS_KEY_ENABLED)
    const v = localStorage.getItem(LS_KEY_VOLUME)
    if (e !== null) _enabled = e === 'true'
    if (v !== null) _volume  = Math.max(0, Math.min(1, parseFloat(v)))
  } catch {}
}

function savePrefs() {
  try {
    localStorage.setItem(LS_KEY_ENABLED, String(_enabled))
    localStorage.setItem(LS_KEY_VOLUME,  String(_volume))
  } catch {}
}

// ── AudioContext (lazy, unlocked on first user gesture) ───────
function getCtx() {
  if (_ctx) return _ctx
  try {
    _ctx = new (window.AudioContext || window.webkitAudioContext)()
  } catch { _ctx = null }
  return _ctx
}

export function initAudio() {
  loadPrefs()
  // Unlock on first user interaction
  const unlock = () => {
    if (_unlocked) return
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    _unlocked = true
  }
  document.addEventListener('click',      unlock, { once: false, passive: true })
  document.addEventListener('touchstart', unlock, { once: false, passive: true })
  document.addEventListener('keydown',    unlock, { once: false, passive: true })
}

export function getSoundEnabled() { return _enabled }
export function setSoundEnabled(enabled) {
  _enabled = !!enabled
  savePrefs()
}

export function getSoundVolume() { return _volume }
export function setSoundVolume(vol) {
  _volume = Math.max(0, Math.min(1, vol))
  savePrefs()
}

// ── Master gain node (cached) ──────────────────────────────────
let _masterGain = null
function getMaster() {
  const ctx = getCtx()
  if (!ctx) return null
  if (!_masterGain) {
    _masterGain = ctx.createGain()
    _masterGain.connect(ctx.destination)
  }
  _masterGain.gain.value = _volume
  return _masterGain
}

// ── Low-level helpers ─────────────────────────────────────────

/** Play a simple oscillator tone. */
function playTone(freq, duration, type = 'sine', gainVal = 0.4, delay = 0, ctx, master) {
  try {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type      = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration)
    osc.connect(gain)
    gain.connect(master)
    osc.start(ctx.currentTime + delay)
    osc.stop(ctx.currentTime  + delay + duration + 0.01)
  } catch {}
}

/** Play band-pass filtered white noise. */
function playNoise(duration, gainVal = 0.3, filterFreq = 1200, delay = 0, ctx, master) {
  try {
    const bufSize   = ctx.sampleRate * Math.max(duration, 0.05)
    const buffer    = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data      = buffer.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

    const src    = ctx.createBufferSource()
    src.buffer   = buffer

    const filter = ctx.createBiquadFilter()
    filter.type  = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value         = 1.2

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    src.start(ctx.currentTime + delay)
    src.stop(ctx.currentTime  + delay + duration + 0.01)
  } catch {}
}

/** Frequency sweep (ascending or descending). */
function playSweep(startFreq, endFreq, duration, type = 'sine', gainVal = 0.35, delay = 0, ctx, master) {
  try {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime + delay)
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + delay + duration)
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration)
    osc.connect(gain)
    gain.connect(master)
    osc.start(ctx.currentTime + delay)
    osc.stop(ctx.currentTime  + delay + duration + 0.01)
  } catch {}
}

// ── Sound definitions ─────────────────────────────────────────

function playButton(ctx, master) {
  // Short soft click: tiny noise burst + mild high tone
  playNoise(0.04, 0.18, 3200, 0,    ctx, master)
  playTone(900, 0.06, 'sine', 0.12, 0.01, ctx, master)
}

function playCardFlip(ctx, master) {
  // Paper tap / card flip: short noise with mid filter
  playNoise(0.09, 0.28, 900, 0, ctx, master)
  playSweep(320, 180, 0.09, 'triangle', 0.12, 0, ctx, master)
}

function playCardSelect(ctx, master) {
  // Slightly brighter tap than flip
  playNoise(0.07, 0.22, 1400, 0, ctx, master)
  playTone(520, 0.08, 'sine', 0.10, 0, ctx, master)
}

function playCardPass(ctx, master) {
  // Swoosh — descending sweep with noise
  playSweep(600, 200, 0.14, 'sawtooth', 0.14, 0,    ctx, master)
  playNoise(0.14, 0.22, 600, 0, ctx, master)
}

function playShow(ctx, master) {
  // Celebratory ascending chime: 3-note arpeggio
  const notes = [523, 659, 784, 1046]
  notes.forEach((f, i) => {
    playTone(f, 0.22, 'sine', 0.28, i * 0.12, ctx, master)
  })
  // Shimmer on top
  playNoise(0.5, 0.06, 4000, 0.1, ctx, master)
}

function playRoundResult(ctx, master) {
  // Short two-note resolution chord
  playTone(523, 0.3, 'sine', 0.22, 0,    ctx, master)
  playTone(659, 0.3, 'sine', 0.18, 0.08, ctx, master)
  playTone(784, 0.4, 'sine', 0.14, 0.18, ctx, master)
}

function playGameEnd(ctx, master) {
  // Slightly grander version of round result
  const notes = [523, 784, 1046]
  notes.forEach((f, i) => {
    playTone(f, 0.45, 'triangle', 0.20, i * 0.14, ctx, master)
  })
}

function playError(ctx, master) {
  // Soft negative tick — short descending
  playSweep(300, 160, 0.12, 'square', 0.12, 0, ctx, master)
}

// ─ Specials ───────────────────────────────────────────────────

function playSpecialReverse(ctx, master) {
  // Quick bidirectional sweep
  playSweep(300, 900, 0.10, 'sawtooth', 0.16, 0,    ctx, master)
  playSweep(900, 300, 0.10, 'sawtooth', 0.12, 0.10, ctx, master)
}

function playSpecialFreeze(ctx, master) {
  // Icy chime — high triangle tones with slight shimmer
  playTone(1760, 0.18, 'triangle', 0.20, 0,    ctx, master)
  playTone(2093, 0.14, 'triangle', 0.16, 0.09, ctx, master)
  playNoise(0.18, 0.04, 5000, 0, ctx, master)
}

function playSpecialBlindSnatch(ctx, master) {
  // Sneaky card shuffle: rapid noise bursts
  for (let i = 0; i < 3; i++) {
    playNoise(0.06, 0.18, 800, i * 0.07, ctx, master)
  }
  playSweep(400, 200, 0.12, 'triangle', 0.10, 0.18, ctx, master)
}

function playSpecialRevealedSnatch(ctx, master) {
  // Sparkle reveal: ascending shimmer
  playSweep(440, 1760, 0.18, 'sine', 0.18, 0, ctx, master)
  playNoise(0.12, 0.06, 5500, 0.10, ctx, master)
  playTone(1760, 0.14, 'sine', 0.12, 0.18, ctx, master)
}

function playSpecialStunGrenade(ctx, master) {
  // Soft pop/impact, not harsh
  playNoise(0.12, 0.30, 300, 0, ctx, master)
  playSweep(200, 60, 0.15, 'square', 0.14, 0, ctx, master)
}

function playSpecialVitals(ctx, master) {
  // Scanner blip: two rapid pings
  playTone(880, 0.08, 'sine', 0.18, 0,    ctx, master)
  playTone(1100, 0.08, 'sine', 0.14, 0.10, ctx, master)
}

function playSpecialSuperVitals(ctx, master) {
  // Stronger scanner + power-up sweep
  playTone(880, 0.08,  'sine', 0.18, 0,    ctx, master)
  playTone(1100, 0.08, 'sine', 0.18, 0.10, ctx, master)
  playSweep(440, 1320, 0.20, 'sine', 0.16, 0.18, ctx, master)
}

function playSpecialNuke(ctx, master) {
  // Low sub-bass boom, not aggressive
  playSweep(120, 40, 0.25, 'sawtooth', 0.28, 0, ctx, master)
  playNoise(0.25, 0.20, 200, 0, ctx, master)
  playNoise(0.10, 0.10, 80,  0, ctx, master)
}

// ── Sound map ─────────────────────────────────────────────────
const SOUND_FNS = {
  button:               playButton,
  cardFlip:             playCardFlip,
  cardSelect:           playCardSelect,
  cardPass:             playCardPass,
  show:                 playShow,
  roundResult:          playRoundResult,
  gameEnd:              playGameEnd,
  error:                playError,
  specialReverse:       playSpecialReverse,
  specialFreeze:        playSpecialFreeze,
  specialBlindSnatch:   playSpecialBlindSnatch,
  specialRevealedSnatch:playSpecialRevealedSnatch,
  specialStunGrenade:   playSpecialStunGrenade,
  specialVitals:        playSpecialVitals,
  specialSuperVitals:   playSpecialSuperVitals,
  specialNuke:          playSpecialNuke,
}

// ── Public API ────────────────────────────────────────────────
export function playSound(name) {
  if (!_enabled) return
  const fn = SOUND_FNS[name]
  if (!fn) return
  try {
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        const master = getMaster()
        if (master) fn(ctx, master)
      }).catch(() => {})
      return
    }
    const master = getMaster()
    if (master) fn(ctx, master)
  } catch {}
}

// ── Special card → sound name map ─────────────────────────────
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

// ── Button sound helper ───────────────────────────────────────
export function withButtonSound(handler) {
  return (...args) => {
    playSound('button')
    handler?.(...args)
  }
}