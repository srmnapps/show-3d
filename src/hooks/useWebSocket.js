// show-3d/src/hooks/useWebSocket.js
// Removed old relay JOIN_ROOM on open — server now uses CREATE_ROOM / JOIN_ROOM messages
// sent explicitly from useGame. Reconnect and send functionality preserved.

import { useRef, useCallback } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

export function useWebSocket() {
  const wsRef          = useRef(null)
  const onMessageRef   = useRef(null)
  const manualCloseRef = useRef(false)
  const reconnTimerRef = useRef(null)
  const statusRef      = useRef('disconnected')
  const statusCbRef    = useRef(null)
  // Queued message to send as soon as the socket opens (used for CREATE_ROOM / JOIN_ROOM)
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
      // Send the queued initial message (CREATE_ROOM or JOIN_ROOM) if present
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
        reconnTimerRef.current = setTimeout(open, 2000)
      }
    }

    ws.onerror = () => ws.close()
  }, [])

  /**
   * connect(onMessage, onStatusChange, initialMsg?)
   *
   * initialMsg is sent immediately when the socket opens.
   * For CREATE_ROOM it should be { type:'CREATE_ROOM', player }
   * For JOIN_ROOM  it should be { type:'JOIN_ROOM', roomCode, player }
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