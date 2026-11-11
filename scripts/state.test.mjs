import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanData, migrateRecipeReferences } from '../src/state.ts'

test('keeps bookmarks, history and an active session when duplicate recipes merge', () => {
  const redirects = new Map([['marinara-w39', { id: 'marinara-w44', slug: 'marinara-w44' }]])
  const original = {
    ...cleanData,
    saved: ['marinara-w39', 'marinara-w44', 'other'],
    cooked: [{ id: 'marinara-w39', date: '2026-11-10' }, { id: 'marinara-w44', date: '2026-11-09' }],
    session: { recipeId: 'marinara-w39', slug: 'marinara-w39', servings: 6, variant: 'base', step: 'step-2', ingredients: ['line-1'], equipment: [], timers: [] },
  }
  const migrated = migrateRecipeReferences(original, redirects)
  assert.deepEqual(migrated.saved, ['marinara-w44', 'other'])
  assert.deepEqual(migrated.cooked, [{ id: 'marinara-w44', date: '2026-11-10' }])
  assert.deepEqual(migrated.session, { ...original.session, recipeId: 'marinara-w44', slug: 'marinara-w44' })
  assert.deepEqual(migrateRecipeReferences(migrated, redirects), migrated)
})
