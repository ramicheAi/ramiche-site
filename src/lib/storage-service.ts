// src/lib/storage-service.ts
import type { Athlete } from '@/app/apex-athlete/coach/types'

const STORAGE_KEYS = {
  ROSTER: 'apex-athlete-roster-v5',
  AUTH: 'apex-coach-auth',
  SNAPSHOTS: 'apex-athlete-snapshots-v2',
  AUDIT: 'apex-athlete-audit-v2'
}

type StorageKey = keyof typeof STORAGE_KEYS

export const StorageService = {
  // Save unified roster to both localStorage and Firestore (if online)
  // Handles conflict resolution: never overwrite higher-XP with zero-XP seed data
  async saveRoster(roster: Athlete[], orgId: string = 'saint-andrews-aquatics'): Promise<void> {
    if (!roster || roster.length === 0) return

    // Guard: Zero-XP check to prevent seed overwrite
    const totalXP = roster.reduce((sum, a) => sum + (a.xp || 0), 0)
    const localData = localStorage.getItem(STORAGE_KEYS.ROSTER)
    let localTotalXP = 0
    if (localData) {
      try {
        const localRoster = JSON.parse(localData) as Athlete[]
        localTotalXP = localRoster.reduce((sum, a) => sum + (a.xp || 0), 0)
      } catch (e) {
        console.warn('Failed to parse local roster for zero-XP check', e)
      }
    }

    // If trying to save significantly less XP (potential reset), block it unless explicit force
    if (totalXP < localTotalXP * 0.5 && localTotalXP > 1000) {
      console.error(`Blocked roster overwrite: New XP (${totalXP}) << Old XP (${localTotalXP})`)
      return
    }

    // 1. Save to LocalStorage (Target of Truth for offline/latency)
    try {
      localStorage.setItem(STORAGE_KEYS.ROSTER, JSON.stringify(roster))
    } catch (e) {
      console.error('LocalStorage save failed', e)
    }

    // 2. Save to Firestore via server (Admin SDK) — /organizations is locked to `if false`
    try {
      await fetch('/api/apex-athlete/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // send the coach session cookie
        body: JSON.stringify({ orgId, athletes: roster }),
      })
    } catch (e) {
      console.error('Roster save failed (offline?)', e)
    }
  },

  // Load roster with fallback: LocalStorage -> Firestore -> Empty
  async loadRoster(orgId: string = 'saint-andrews-aquatics'): Promise<Athlete[] | null> {
    // 1. Try LocalStorage first (Fastest)
    const localData = localStorage.getItem(STORAGE_KEYS.ROSTER)
    if (localData) {
      try {
        return JSON.parse(localData) as Athlete[]
      } catch (e) {
        console.error('LocalStorage parse error', e)
      }
    }

    // 2. Fallback to server (Admin SDK reads the locked /organizations path)
    try {
      const res = await fetch(`/api/apex-athlete/roster?orgId=${encodeURIComponent(orgId)}`, { credentials: 'include' })
      if (res.ok) {
        const { athletes } = await res.json()
        if (Array.isArray(athletes) && athletes.length) {
          localStorage.setItem(STORAGE_KEYS.ROSTER, JSON.stringify(athletes))
          return athletes as Athlete[]
        }
      }
    } catch (e) {
      console.error('Roster load failed', e)
    }

    return null
  },

  // Clear data (dangerous - for logout/reset)
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
  }
}
