import { servingReference } from './portions.ts'
import type { Dictionary, Summary, TimeKey, Timing } from '../schema/v1.ts'

export const normalise = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
  .replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export const timeText = (t: Timing) => `${t.estimated ? 'Est. ' : ''}${t.minMinutes === t.maxMinutes ? t.maxMinutes : `${t.minMinutes}–${t.maxMinutes}`} min`
const spell = (text: string) => normalise(text).replace(/\bchilis?\b/g, 'chilli')
const byTitle = (a: Summary, b: Summary) => a.title.localeCompare(b.title, 'en-GB') || a.id.localeCompare(b.id)

export function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1]
    for (let j = 0; j < b.length; j++) next.push(Math.min(row[j + 1] + 1, next[j] + 1, row[j] + Number(a[i] !== b[j])))
    row = next
  }
  return row[b.length]
}

export function titleRank(query: string, recipe: Summary) {
  const q = spell(query)
  if (!q) return 0
  const fields = [recipe.title, `${recipe.title} ${recipe.subtitle || ''}`, ...recipe.aliases, ...(recipe.seasons || [])].map(spell)
  if (fields.includes(q)) return 0
  if (fields.some(s => s.startsWith(q))) return 1
  const words = [...new Set(fields.flatMap(field => field.split(' ')))]
  const terms = q.split(' ')
  if (terms.every(t => words.some(w => w.startsWith(t)))) return 2
  if (terms.every(t => words.some(w => w.startsWith(t) || (t.length >= 4 && Math.abs(t.length - w.length) <= 1 && distance(w, t) <= 1)))) return 3
  return Infinity
}

export type PantryItem = { id: string; first: boolean }
export type Pending = { text: string; choices: string[] }
export type Filters = {
  query: string; cuisine: string[]; themes: string[]; seasons: string[]; provider: string[]; ingredients: string[]
  time: Partial<Record<TimeKey, number>>; unknown: boolean; sort: 'relevance' | 'name' | 'recent' | 'total' | 'prep'
}
export const emptyFilters: Filters = { query: '', cuisine: [], themes: [], seasons: [], provider: [], ingredients: [], time: {}, unknown: false, sort: 'relevance' }
export const defaultBasics = ['salt', 'black-pepper', 'neutral-oil', 'water']
const stripAmount = (s: string) => s.trim()
  .replace(/^(?:(?:i['’]?ve got|i have|we have|we['’]?ve got|i['’]?ve|some|a few)\s+)+/i, '')
  .replace(/^(?:[-•]\s*)?(?:\d+(?:[./]\d+)?\s*)?(?:kg|g|ml|l|oz|lb|tbsp|tsp|cups?)?\b\s*(?:of\s+)?/i, '')
  .replace(/^(?:some|a few)\s+/i, '').trim()

export function ingredientTools(dictionary: Dictionary) {
  const byId = new Map(dictionary.map(entry => [entry.id, entry]))
  const names = new Map<string, string[]>()
  for (const entry of dictionary) {
    for (const name of new Set([entry.label, ...entry.aliases].map(normalise))) names.set(name, [...(names.get(name) || []), entry.id])
  }
  const label = (id: string) => byId.get(id)?.label || id
  const within = (item: string, ancestor: string) => {
    for (let cursor: string | undefined = item; cursor; cursor = byId.get(cursor)?.family) if (cursor === ancestor) return true
    return false
  }
  function rankNames(scoreOf: (name: string) => number) {
    const ranked = new Map<string, number>()
    for (const [name, ids] of names) {
      const score = scoreOf(name)
      if (Number.isFinite(score)) for (const id of ids) ranked.set(id, Math.min(score, ranked.get(id) ?? Infinity))
    }
    return [...ranked].sort(([a, x], [b, y]) => x - y || label(a).localeCompare(label(b))).map(([id]) => id)
  }
  function search(raw: string) {
    const key = normalise(raw)
    if (!key) return []
    return rankNames(name => {
      if (name === key) return 0
      if (name.startsWith(key)) return 1
      if (name.includes(' ' + key)) return 2
      return name.includes(key) ? 3 : Infinity
    })
  }
  function suggest(raw: string) {
    const query = normalise(raw)
    const key = normalise(stripAmount(raw))
    const literal = search(query)
    if (literal.length) return literal
    const matches = key === query ? literal : search(key)
    if (matches.length || key.length < 4) return matches
    return rankNames(name => Math.abs(name.length - key.length) <= 2 && distance(name, key) <= (key.length > 7 ? 2 : 1) ? 0 : Infinity).slice(0, 3)
  }
  function parse(raw: string) {
    const ids = new Set<string>()
    const pending: Pending[] = []
    const resolve = (part: string) => {
      const text = stripAmount(part)
      if (!text) return
      const direct = names.get(normalise(text))
      if (direct?.length === 1) { ids.add(direct[0]); return }
      if (!direct && /\s+(?:and|&)\s+/i.test(text)) {
        for (const token of text.split(/\s+(?:and|&)\s+/i)) resolve(token)
        return
      }
      pending.push({ text, choices: direct || suggest(text) })
    }
    // Protect exact dictionary phrases with separators before splitting.
    let rest = raw.trim()
    const protectedPhrases: string[] = []
    for (const entry of dictionary) {
      for (const phrase of [entry.label, ...entry.aliases]) {
        if (!/[,;]/.test(phrase)) continue
        const literal = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        rest = rest.replace(new RegExp(`\\b${literal}\\b`, 'gi'), () => `\u0001${protectedPhrases.push(phrase) - 1}\u0002`)
      }
    }
    for (const part of rest.split(/[,;\n]+/)) resolve(part.replace(/\u0001(\d+)\u0002/g, (_, i) => protectedPhrases[Number(i)]))
    return { ids: [...ids], pending }
  }
  return { byId, label, within, search, suggest, parse }
}

type Tools = ReturnType<typeof ingredientTools>
export function matchRequirements(requirements: string[], pantry: PantryItem[], basics: string[], tools: Tools) {
  const matched: string[] = [], assumed: string[] = [], missing: string[] = [], leads: string[] = [], usedFirst: string[] = []
  for (const need of new Set(requirements)) {
    const accepts = tools.byId.get(need)?.accepts || []
    const have = pantry.filter(item => item.id === need || accepts.includes(item.id))
    if (have.length) {
      matched.push(need)
      usedFirst.push(...have.filter(item => item.first).map(item => item.id))
    } else if (basics.includes(need)) assumed.push(need)
    else {
      missing.push(need)
      if (pantry.some(item => tools.byId.get(item.id)?.broad && tools.within(need, item.id))) leads.push(need)
    }
  }
  return { matched, assumed, missing, leads, firstCount: new Set(usedFirst).size, ratio: matched.length / Math.max(1, matched.length + missing.length) }
}
export type Match = ReturnType<typeof matchRequirements>
export const requirementsFor = (recipe: Summary, size = recipe.defaultServings, variant = 'base') => (recipe.requirements[variant] || recipe.requirements.base)[servingReference(recipe.servings, size)] || []
const timeSort = (a: Summary, b: Summary, key: TimeKey) => (a.timings[key]?.maxMinutes ?? 1e9) - (b.timings[key]?.maxMinutes ?? 1e9)

export function browse(index: Summary[], filters: Filters, tools: Tools) {
  const any = (picked: string[], values: string[]) => !picked.length || picked.some(value => values.includes(value))
  const ranked = index.map(recipe => ({ recipe, rank: titleRank(filters.query, recipe) })).filter(({ recipe, rank }) =>
    Number.isFinite(rank) && any(filters.themes, recipe.themes) && any(filters.seasons, recipe.seasons || []) && any(filters.cuisine, [recipe.cuisine || '']) && any(filters.provider, [recipe.provider]) &&
    filters.ingredients.every(item => Object.values(recipe.requirements).some(version => Object.values(version).some(needs => needs.some(id => tools.within(id, item))))) &&
    (Object.entries(filters.time) as [TimeKey, number][]).every(([key, max]) => {
      const value = recipe.timings[key]
      return !max || (value ? value.maxMinutes <= max : filters.unknown)
    }),
  )
  return ranked.sort(({ recipe: a, rank: x }, { recipe: b, rank: y }) => {
    if (filters.sort === 'total' || filters.sort === 'prep') return timeSort(a, b, filters.sort) || x - y || byTitle(a, b)
    if (filters.sort === 'recent') return b.added.localeCompare(a.added) || byTitle(a, b)
    return (filters.sort === 'name' ? 0 : x - y) || byTitle(a, b)
  }).map(({ recipe }) => recipe)
}

export function shortlist(index: Summary[], filters: Filters, pantry: PantryItem[], basics: string[], tools: Tools, showAll = false) {
  const time = (Object.keys(filters.time) as TimeKey[]).find(key => filters.time[key])
  return browse(index, filters, tools).map(recipe => ({ recipe, match: matchRequirements(requirementsFor(recipe), pantry, basics, tools) }))
    .filter(({ match }) => !pantry.length || showAll || match.matched.length || match.leads.length)
    .sort(({ recipe: a, match: x }, { recipe: b, match: y }) =>
      (pantry.length ? x.missing.length - y.missing.length || y.firstCount - x.firstCount || y.ratio - x.ratio : 0) ||
      (time ? timeSort(a, b, time) : 0) || byTitle(a, b))
}
