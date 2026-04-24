import * as THREE from 'three'

const SEAT_COLORS = [0x9B7FFF, 0x2DD4BF, 0xF5C842, 0xFF6B47, 0x4ADE80]

export class GameScene {
  constructor(canvas) {
    this.canvas    = canvas
    this.cards     = {}      // playerIdx -> [cardMesh, ...]
    this.animQueue = []
    this.clock     = new THREE.Clock()
    this._init()
    this._animate()
  }

  _init() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight

    // ── Renderer ──────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas:      this.canvas,
      antialias:   true,
      alpha:       false,
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.setClearColor(0x060608)

    // ── Scene ─────────────────────────────────────────
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x060608, 0.055)

    // ── Camera — poker angle ──────────────────────────
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    this.camera.position.set(0, 9, 7)
    this.camera.lookAt(0, 0, 0)

    // ── Lights ────────────────────────────────────────
    // Overhead warm spotlight (like a casino lamp)
    const spot = new THREE.SpotLight(0xFFE8A0, 3.5, 20, Math.PI / 5, 0.4, 1.2)
    spot.position.set(0, 10, 0)
    spot.castShadow = true
    spot.shadow.mapSize.set(2048, 2048)
    spot.shadow.camera.near = 1
    spot.shadow.camera.far  = 25
    this.scene.add(spot)
    this.scene.add(spot.target)

    // Rim light — cool blue from behind
    const rim = new THREE.DirectionalLight(0x4060FF, 0.5)
    rim.position.set(-5, 6, -8)
    this.scene.add(rim)

    // Ambient fill
    this.scene.add(new THREE.AmbientLight(0x1A1A3A, 1.2))

    // Subtle purple under-glow
    const under = new THREE.PointLight(0x6B52D4, 0.8, 12)
    under.position.set(0, -1, 0)
    this.scene.add(under)

    // ── Table ─────────────────────────────────────────
    this._buildTable()

    // ── Room (dark walls) ─────────────────────────────
    this._buildRoom()

    // ── Resize handler ────────────────────────────────
    window.addEventListener('resize', () => this._onResize())
  }

  _buildTable() {
    // Felt surface
    const feltGeo  = new THREE.CylinderGeometry(4.8, 4.8, 0.08, 64)
    const feltMat  = new THREE.MeshStandardMaterial({
      color:     0x0D4A2A,
      roughness: 0.92,
      metalness: 0.0,
    })
    const felt = new THREE.Mesh(feltGeo, feltMat)
    felt.receiveShadow = true
    felt.position.y = -0.04
    this.scene.add(felt)

    // Table rim (wood)
    const rimGeo = new THREE.CylinderGeometry(5.1, 5.3, 0.3, 64)
    const rimMat = new THREE.MeshStandardMaterial({
      color:     0x3D1F0A,
      roughness: 0.5,
      metalness: 0.15,
    })
    const rim = new THREE.Mesh(rimGeo, rimMat)
    rim.receiveShadow = true
    rim.castShadow    = true
    rim.position.y = -0.15
    this.scene.add(rim)

    // Gold rim ring
    const ringGeo = new THREE.TorusGeometry(5.1, 0.06, 16, 80)
    const ringMat = new THREE.MeshStandardMaterial({
      color:     0xF5C842,
      roughness: 0.25,
      metalness: 0.85,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.01
    this.scene.add(ring)

    // Center logo — subtle circle
    const logoGeo = new THREE.CircleGeometry(1.2, 48)
    const logoMat = new THREE.MeshStandardMaterial({
      color:     0x0A3D22,
      roughness: 0.85,
      metalness: 0.05,
    })
    const logo = new THREE.Mesh(logoGeo, logoMat)
    logo.rotation.x = -Math.PI / 2
    logo.position.y = 0.001
    this.scene.add(logo)

    // Table leg base (pedestal)
    const pedGeo = new THREE.CylinderGeometry(1.5, 2.0, 3.5, 32)
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x2A1005, roughness: 0.6, metalness: 0.2 })
    const ped    = new THREE.Mesh(pedGeo, pedMat)
    ped.position.y = -2.1
    ped.castShadow = true
    this.scene.add(ped)
  }

  _buildRoom() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(40, 40)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x08080F, roughness: 1, metalness: 0 })
    const floor    = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -4
    floor.receiveShadow = true
    this.scene.add(floor)
  }

  // ── Place seat markers around the table ───────────────
  buildSeats(playerCount) {
    // Remove old seats
    if (this.seatGroup) this.scene.remove(this.seatGroup)
    this.seatGroup = new THREE.Group()

    for (let i = 0; i < playerCount; i++) {
      const angle = (i / playerCount) * Math.PI * 2 - Math.PI / 2
      const r     = 4.0
      const x     = Math.cos(angle) * r
      const z     = Math.sin(angle) * r

      // Seat glow disc on felt
      const discGeo = new THREE.CircleGeometry(0.45, 32)
      const discMat = new THREE.MeshStandardMaterial({
        color:     SEAT_COLORS[i % SEAT_COLORS.length],
        roughness: 0.6,
        metalness: 0.1,
        transparent: true,
        opacity: 0.35,
      })
      const disc = new THREE.Mesh(discGeo, discMat)
      disc.rotation.x = -Math.PI / 2
      disc.position.set(x, 0.005, z)
      this.seatGroup.add(disc)
    }
    this.scene.add(this.seatGroup)
  }

  // ── Create card meshes for a player ───────────────────
  buildPlayerCards(playerIdx, playerCount, chitCount) {
    // Remove existing
    if (this.cards[playerIdx]) {
      this.cards[playerIdx].forEach(c => this.scene.remove(c))
    }
    this.cards[playerIdx] = []

    const angle = (playerIdx / playerCount) * Math.PI * 2 - Math.PI / 2
    const r     = 3.0
    const cx    = Math.cos(angle) * r
    const cz    = Math.sin(angle) * r

    for (let i = 0; i < chitCount; i++) {
      const card = this._makeCard()
      const spread = (i - (chitCount - 1) / 2) * 0.55
      // Perpendicular spread direction
      card.position.set(
        cx + Math.cos(angle + Math.PI / 2) * spread,
        0.15 + i * 0.005,
        cz + Math.sin(angle + Math.PI / 2) * spread
      )
      card.rotation.y  = -angle + Math.PI
      card.rotation.x  = -0.08
      card.userData    = { playerIdx, chitIdx: i, revealed: false, floating: true, floatOffset: i * 1.1 }
      this.scene.add(card)
      this.cards[playerIdx].push(card)
    }
  }

  _makeCard() {
    const geo = new THREE.BoxGeometry(0.42, 0.02, 0.60)
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.6, metalness: 0.1 }), // right
      new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.6, metalness: 0.1 }), // left
      new THREE.MeshStandardMaterial({ color: 0xF0F0F0, roughness: 0.5, metalness: 0.05 }), // top (face)
      new THREE.MeshStandardMaterial({ color: 0x1A1A3A, roughness: 0.7, metalness: 0.0 }), // bottom (back)
      new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.6, metalness: 0.1 }), // front
      new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.6, metalness: 0.1 }), // back
    ]
    const mesh = new THREE.Mesh(geo, materials)
    mesh.castShadow    = true
    mesh.receiveShadow = true
    return mesh
  }

  // ── Flip a card to revealed (rotate 180° on Z) ────────
  revealCard(playerIdx, chitIdx, symbol) {
    const card = this.cards[playerIdx]?.[chitIdx]
    if (!card || card.userData.revealed) return
    card.userData.revealed = true
    card.userData.symbol   = symbol

    const startRot = card.rotation.x
    const targetRot = startRot - Math.PI
    const duration  = 0.5
    let elapsed     = 0

    this.animQueue.push({
      update: (dt) => {
        elapsed += dt
        const t = Math.min(elapsed / duration, 1)
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t
        card.rotation.x = startRot + (targetRot - startRot) * ease
        // Lift card while flipping
        card.position.y = 0.15 + Math.sin(t * Math.PI) * 0.5
        return t >= 1
      }
    })
  }

  // ── Lift & highlight selected card ────────────────────
  selectCard(playerIdx, chitIdx, selected) {
    const card = this.cards[playerIdx]?.[chitIdx]
    if (!card) return
    const targetY = selected ? 0.6 : 0.15
    const duration = 0.25; let elapsed = 0
    const startY = card.position.y
    this.animQueue.push({
      update: (dt) => {
        elapsed += dt
        const t = Math.min(elapsed / duration, 1)
        card.position.y = startY + (targetY - startY) * t
        // Gold tint when selected
        card.material?.[2]?.color?.setHex(selected ? 0xFFF8DC : 0xF0F0F0)
        return t >= 1
      }
    })
  }

  // ── Animate card sliding to next player ───────────────
  passCard(fromIdx, toIdx, chitIdx, playerCount, onDone) {
    const card = this.cards[fromIdx]?.[chitIdx]
    if (!card) { onDone?.(); return }

    const fromAngle = (fromIdx / playerCount) * Math.PI * 2 - Math.PI / 2
    const toAngle   = (toIdx   / playerCount) * Math.PI * 2 - Math.PI / 2
    const toR = 3.0
    const toX = Math.cos(toAngle) * toR
    const toZ = Math.sin(toAngle) * toR

    const startX = card.position.x
    const startZ = card.position.z
    const startY = card.position.y
    const arcH   = 2.5
    const duration = 0.7; let elapsed = 0

    this.animQueue.push({
      update: (dt) => {
        elapsed += dt
        const t = Math.min(elapsed / duration, 1)
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t
        card.position.x = startX + (toX - startX) * ease
        card.position.z = startZ + (toZ - startZ) * ease
        card.position.y = startY + Math.sin(t * Math.PI) * arcH
        card.rotation.y = -toAngle + Math.PI
        if (t >= 1) { this.scene.remove(card); onDone?.() }
        return t >= 1
      }
    })

    // Remove from fromIdx cards array
    this.cards[fromIdx] = this.cards[fromIdx].filter((_, i) => i !== chitIdx)
  }

  // ── Highlight active player's seat ────────────────────
  setActiveSeat(activeIdx, playerCount) {
    if (!this.seatGroup) return
    this.seatGroup.children.forEach((disc, i) => {
      disc.material.opacity = i === activeIdx ? 0.7 : 0.25
    })
  }

  // ── Show all cards face up ────────────────────────────
  showAllCards() {
    Object.entries(this.cards).forEach(([pidx, cards]) => {
      cards.forEach((card, ci) => {
        if (!card.userData.revealed) {
          card.userData.revealed = true
          // Flip up
          const start = card.rotation.x; const target = start - Math.PI
          const dur = 0.4 + ci * 0.1; let el = 0
          this.animQueue.push({
            update: (dt) => {
              el += dt; const t = Math.min(el / dur, 1)
              card.rotation.x = start + (target - start) * t
              return t >= 1
            }
          })
        }
      })
    })
  }

  // ── Cleanup all cards ────────────────────────────────
  clearAllCards() {
    Object.values(this.cards).flat().forEach(c => this.scene.remove(c))
    this.cards = {}
  }

  // ── Animate loop ─────────────────────────────────────
  _animate() {
    this.rafId = requestAnimationFrame(() => this._animate())
    const dt = this.clock.getDelta()

    // Process animation queue
    this.animQueue = this.animQueue.filter(a => !a.update(dt))

    // Gentle float for all cards
    const t = this.clock.getElapsedTime()
    Object.values(this.cards).flat().forEach(card => {
      if (!card.userData.floating) return
      const off = card.userData.floatOffset ?? 0
      const base = card.userData.revealed ? 0.15 : 0.12
      if (Math.abs(card.position.y - base) < 0.8) {
        card.position.y = base + Math.sin(t * 1.2 + off) * 0.04
      }
    })

    // Slow camera bob
    this.camera.position.y = 9 + Math.sin(t * 0.3) * 0.08

    this.renderer.render(this.scene, this.camera)
  }

  _onResize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  destroy() {
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', () => this._onResize())
    this.renderer.dispose()
  }
}
