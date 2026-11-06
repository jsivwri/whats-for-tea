import { useEffect, useState } from 'react'
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

export function useUserData(library: string) {
  const key = 'whats-for-tea:v1:' + library
  const [storageError, setStorageError] = useState(false)
  const [value, setValue] = useState<UserData>(() => {
    try { return { ...cleanData, ...JSON.parse(localStorage.getItem(key) || '{}') } } catch { return cleanData }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); setStorageError(false) } catch { setStorageError(true) }
  }, [value, key])
  return [value, setValue, storageError] as const
}

export function downloadBackup(library: string, data: UserData) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, library, data }, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'whats-for-tea-settings.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
