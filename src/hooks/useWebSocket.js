import { useRef, useCallback } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

export function useWebSocket() {
  const wsRef          = useRef(null)
  const roomCodeRef    = useRef(null)
  const onMessageRef   = useRef(null)
  const manualCloseRef = useRef(false)
  const reconnTimerRef = useRef(null)
  const statusRef      = useRef('disconnected')
  const statusCbRef    = useRef(null)

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
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', room: roomCodeRef.current }))
    }
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'JOINED') return
        if (data.room && data.room !== roomCodeRef.current) return
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

  const connect = useCallback((code, onMessage, onStatusChange) => {
    roomCodeRef.current  = code
    onMessageRef.current = onMessage
    statusCbRef.current  = onStatusChange
    manualCloseRef.current = false
    open()
  }, [open])

  const send = useCallback((payload) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ room: roomCodeRef.current, ...payload }))
    }
  }, [])

  const disconnect = useCallback(() => {
    manualCloseRef.current = true
    clearTimeout(reconnTimerRef.current)
    const ws = wsRef.current
    if (ws) { ws.onclose = null; ws.close(); wsRef.current = null }
    roomCodeRef.current = null
    setStatus('disconnected')
  }, [])

  return { connect, send, disconnect, statusRef }
}
