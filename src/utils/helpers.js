export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'SHOW-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text) } catch { }
}
