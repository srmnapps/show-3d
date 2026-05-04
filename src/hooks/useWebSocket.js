// show-3d/src/hooks/useWebSocket.js
// Per-room session storage + URL helpers + send() returns boolean

import { useRef, useCallback } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

// ── Per-room localStorage helpers ─────────────────────────────
const LS_PREFIX = 'show_session_'
const LS_LAST   = 'show_last_room'

export function saveSession(me, roomCode) {
  try {
    localStorage.setItem(LS_PREFIX + roomCode, JSON.stringify({ me, roomCode, lastSeen: Date.now() }))
    localStorage.setItem(LS_LAST, roomCode)
  } catch {}
}

export function clearSession(roomCode) {
  try {
    if (roomCode) {
      localStorage.removeItem(LS_PREFIX + roomCode)
      if (localStorage.getItem(LS_LAST) === roomCode) localStorage.removeItem(LS_LAST)
    } else {
      const last = localStorage.getItem(LS_LAST)
      if (last) localStorage.removeItem(LS_PREFIX + last)
      localStorage.removeItem(LS_LAST)
    }
  } catch {}
}

export function loadSession(roomCode) {
  try {
    const key = roomCode
      ? LS_PREFIX + roomCode
      : LS_PREFIX + (localStorage.getItem(LS_LAST) ?? '')
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { me, roomCode: rc } = JSON.parse(raw)
    if (me?.id && me?.name && rc) return { me, roomCode: rc }
  } catch {}
  return null
}

// ── URL helpers (path-based SPA routing) ──────────────────────

/**
 * Extract roomCode from path like /room/XXXX.
 * Returns null if path doesn't match.
 */
export function getRoomCodeFromPath() {
  const m = window.location.pathname.match(/^\/room\/([^/]+)/)
  return m ? m[1].toUpperCase() : null
}

/**
 * Navigate to /room/<roomCode> using pushState.
 * Marks the history entry with { showScreen: 'room', roomCode }.
 */
export function navigateToRoom(roomCode) {
  const path = `/room/${roomCode}`
  if (window.location.pathname !== path) {
    window.history.pushState(
      { showScreen: 'room', roomCode },
      '',
      path,
    )
  }
}

/**
 * Navigate to / using pushState.
 */
export function navigateHome() {
  if (window.location.pathname !== '/') {
    window.history.pushState(
      { showScreen: 'home' },
      '',
      '/',
    )
  }
}

// ── Hook ──────────────────────────────────────────────────────
export function useWebSocket() {
  const wsRef          = useRef(null)
  const onMessageRef   = useRef(null)
  const manualCloseRef = useRef(false)
  const reconnTimerRef = useRef(null)
  const statusRef      = useRef('disconnected')
  const statusCbRef    = useRef(null)
  const pendingMsgRef  = useRef(null)

  const setStatus = (s) => {
    statusRef.current = s
    statusCbRef.current?.(s)
  }

  const open = useCallback(() => {
    if (manualCloseRef.current) return
    setStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      if (pendingMsgRef.current) {
        ws.send(JSON.stringify(pendingMsgRef.current))
        pendingMsgRef.current = null
      }
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        onMessageRef.current?.(data)
      } catch {}
    }

    ws.onclose = () => {
      setStatus('disconnected')
      if (!manualCloseRef.current) {
        reconnTimerRef.current = setTimeout(() => {
          // On reconnect — use per-room session (last room)
          const session = loadSession()
          if (session) {
            pendingMsgRef.current = {
              type:     'JOIN_ROOM',
              roomCode: session.roomCode,
              player:   session.me,
            }
          }
          open()
        }, 2000)
      }
    }

    ws.onerror = () => ws.close()
  }, [])

  /**
   * connect(onMessage, onStatusChange, initialMsg?)
   * initialMsg is sent immediately on socket open.
   */
  const connect = useCallback((onMessage, onStatusChange, initialMsg) => {
    onMessageRef.current   = onMessage
    statusCbRef.current    = onStatusChange
    manualCloseRef.current = false
    pendingMsgRef.current  = initialMsg ?? null
    open()
  }, [open])

  /** Returns true if sent, false if socket not open. */
  const send = useCallback((payload) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
      return true
    }
    return false
  }, [])

  const disconnect = useCallback(() => {
    manualCloseRef.current = true
    clearTimeout(reconnTimerRef.current)
    const ws = wsRef.current
    if (ws) { ws.onclose = null; ws.close(); wsRef.current = null }
    pendingMsgRef.current = null
    setStatus('disconnected')
  }, [])

  return { connect, send, disconnect, statusRef }
}