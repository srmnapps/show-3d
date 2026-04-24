import { useEffect, useRef } from 'react'
import { GameScene } from '../3d/GameScene.js'

export function useScene(canvasRef, room, myIdx, selectedChit, showAll) {
  const sceneRef    = useRef(null)
  const prevRoomRef = useRef(null)

  // Init scene on mount
  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new GameScene(canvasRef.current)
    sceneRef.current = scene
    return () => scene.destroy()
  }, [])

  // React to room state changes
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || !room) return
    const prev  = prevRoomRef.current

    // New game started or players changed
    if (!prev || prev.phase === 'lobby' && room.phase === 'playing') {
      scene.clearAllCards()
      scene.buildSeats(room.players.length)
      room.players.forEach((p, i) => {
        scene.buildPlayerCards(i, room.players.length, p.chits.length)
      })
    }

    // Turn changed — highlight active seat
    if (room.phase === 'playing') {
      scene.setActiveSeat(room.currentTurn, room.players.length)
    }

    // Show all cards when show is called
    if (showAll && (!prev || !['afterShow','roundEnd','ended'].includes(prev.phase))) {
      scene.showAllCards()
    }

    // Chit count changed — rebuild that player's cards
    if (prev && room.phase === 'playing') {
      room.players.forEach((p, i) => {
        const prevPlayer = prev.players[i]
        if (prevPlayer && p.chits.length !== prevPlayer.chits.length) {
          scene.buildPlayerCards(i, room.players.length, p.chits.length)
        }
      })
    }

    // Next round — rebuild all
    if (prev && prev.phase !== 'playing' && room.phase === 'playing' && prev.round !== room.round) {
      scene.clearAllCards()
      scene.buildSeats(room.players.length)
      room.players.forEach((p, i) => {
        scene.buildPlayerCards(i, room.players.length, p.chits.length)
      })
    }

    prevRoomRef.current = room
  }, [room, showAll])

  // Reveal animation for my cards
  const revealInScene = (chitIdx) => {
    const scene = sceneRef.current
    if (!scene || myIdx < 0) return
    scene.revealCard(myIdx, chitIdx, null)
  }

  // Select animation
  const selectInScene = (chitIdx, isSelected) => {
    const scene = sceneRef.current
    if (!scene || myIdx < 0) return
    scene.selectCard(myIdx, chitIdx, isSelected)
  }

  return { sceneRef, revealInScene, selectInScene }
}
