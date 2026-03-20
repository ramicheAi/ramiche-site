// src/lib/storage-service.ts
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
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

    // 2. Save to Firestore (Async backup)
    try {
      if (orgId && db) {
        await setDoc(doc(db, 'organizations', orgId, 'rosters', 'all'), {
          athletes: roster,
          updatedAt: new Date().toISOString(),
          totalXP // Metadata for recovery
        }, { merge: true }) // Merge prevents wiping fields not in Roster type
      }
    } catch (e) {
      console.error('Firestore save failed (offline?)', e)
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

    // 2. Fallback to Firestore
    if (!db) return null
    try {
      const snap = await getDoc(doc(db, 'organizations', orgId, 'rosters', 'all'))
      if (snap.exists()) {
        const data = snap.data()
        const roster = data.athletes as Athlete[]
        // Cache it locally for next time
        localStorage.setItem(STORAGE_KEYS.ROSTER, JSON.stringify(roster))
        return roster
      }
    } catch (e) {
      console.error('Firestore load failed', e)
    }

    return null
  },

  // Clear data (dangerous - for logout/reset)
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
  }
}
