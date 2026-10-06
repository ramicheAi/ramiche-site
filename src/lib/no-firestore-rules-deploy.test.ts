/* This repo must not be able to deploy Firestore rules.

   The Firebase project is shared with other repos and has one live ruleset; the
   last `firebase deploy` wins. The rules live in, and deploy only from,
   ramicheAi/mettle. See FIRESTORE-RULES.md at the repo root. */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

describe('Firestore rules are not deployable from this repo', () => {
  it('has no firestore.rules in the repo root', () => {
    expect(existsSync(join(ROOT, 'firestore.rules'))).toBe(false)
  })

  it('has no *.rules file in the root or firebase/ directory', () => {
    for (const dir of [ROOT, join(ROOT, 'firebase')]) {
      if (!existsSync(dir)) continue
      expect(readdirSync(dir).filter((f) => f.endsWith('.rules'))).toEqual([])
    }
  })

  it('has no firebase.json declaring a firestore target', () => {
    for (const name of ['firebase.json', 'firebase.jsonc']) {
      const file = join(ROOT, name)
      if (!existsSync(file)) continue
      const config = JSON.parse(readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '')) as Record<string, unknown>
      expect('firestore' in config).toBe(false)
    }
  })

  it('has no .firebaserc pointing the CLI at a project', () => {
    expect(existsSync(join(ROOT, '.firebaserc'))).toBe(false)
  })

  it('documents where the rules live', () => {
    expect(readFileSync(join(ROOT, 'FIRESTORE-RULES.md'), 'utf8')).toContain('ramicheAi/mettle')
  })
})
