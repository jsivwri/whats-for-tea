import { useCallback, useEffect, useState, type SetStateAction } from 'react'
import type { PantryItem } from './matching.ts'

export type Timer = { id: string; label: string; ends: number }
export type Session = {
  recipeId: string; slug: string; servings: number; variant: string; step: string | null
  ingredients: string[]; equipment: string[]; timers: Timer[]
}
export type UserData = {
  pantry: PantryItem[]; basics: string[] | null; saved: string[]
  cooked: { id: string; date: string }[]; session: Session | null; largeType: boolean
}
export const cleanData: UserData = { pantry: [], basics: null, saved: [], cooked: [], session: null, largeType: false }

export function migrateRecipeReferences(data: UserData, redirects: ReadonlyMap<string, { id: string; slug: string }>): UserData {
  if (!redirects.size) return data
  const idFor = (id: string) => redirects.get(id)?.id ?? id
  const saved = [...new Set(data.saved.map(idFor))]
  const cooked = data.cooked.map(entry => ({ ...entry, id: idFor(entry.id) }))
    .filter((entry, index, entries) => entries.findIndex(other => other.id === entry.id) === index)
  const destination = data.session && redirects.get(data.session.slug)
  const session = destination && data.session ? { ...data.session, slug: destination.slug, recipeId: destination.id } : data.session
  return { ...data, saved, cooked, session }
}

export function useUserData(library: string, redirects: ReadonlyMap<string, { id: string; slug: string }>) {
  const key = 'whats-for-tea:v1:' + library
  const [storageError, setStorageError] = useState(false)
  const [value, setValue] = useState<UserData>(() => {
    try {
      return migrateRecipeReferences({ ...cleanData, ...JSON.parse(localStorage.getItem(key) || '{}') }, redirects)
    } catch { return cleanData }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); setStorageError(false) } catch { setStorageError(true) }
  }, [value, key])
  const update = useCallback((next: SetStateAction<UserData>) => {
    setValue(current => migrateRecipeReferences(typeof next === 'function' ? next(current) : next, redirects))
  }, [redirects])
  return [value, update, storageError] as const
}

export function downloadBackup(library: string, data: UserData) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, library, data }, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'whats-for-tea-settings.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
