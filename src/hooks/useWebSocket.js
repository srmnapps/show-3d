// show-3d/src/hooks/useWebSocket.js
// Auto-rejoin on reconnect using localStorage saved session

import { useRef, useCallback } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

// ── localStorage helpers ──────────────────────────────────────
const LS_ME   = 'show_me'
const LS_ROOM = 'show_room'

export function saveSession(me, roomCode) {
  try {
    localStorage.setItem(LS_ME,   JSON.stringify(me))
    localStorage.setItem(LS_ROOM, roomCode)
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(LS_ME)
    localStorage.removeItem(LS_ROOM)
  } catch {}
}

export function loadSession() {
  try {
    const me       = JSON.parse(localStorage.getItem(LS_ME) || 'null')
    const roomCode = localStorage.getItem(LS_ROOM)
    if (me?.id && me?.name && roomCode) return { me, roomCode }
  } catch {}
  return null
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
      // Send initial message if queued (CREATE_ROOM / JOIN_ROOM)
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
          // On reconnect — check localStorage for saved session
          // and automatically rejoin the room
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

  const send = useCallback((payload) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
    }
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