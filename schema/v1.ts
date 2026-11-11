import { z } from 'zod'

export const schemaVersion = 1
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100)
const label = z.string().trim().min(1).max(240)
const note = z.string().trim().min(1).max(5000)
const number = z.number().int().positive()
const date = z.iso.date()
export const imagePath = /^media\/[a-z0-9][a-z0-9-]*\.(webp|jpe?g|png)$/
const asset = z.object({
  id, path: z.string().regex(imagePath), width: number.max(3000), height: number.max(3000),
  alt: z.string().max(240), credit: label,
  sizes: z.array(z.object({ path: z.string().regex(imagePath), width: number.max(3000) })).optional(),
})
export const seasons = ['Spring', 'Summer', 'Autumn', 'Winter', 'Christmas', 'Easter'] as const
const range = z.object({ minMinutes: number, maxMinutes: number, sourceLabel: label, provenance: label, estimated: z.boolean().optional() })
  .refine(x => x.minMinutes <= x.maxMinutes, 'Timing bounds are reversed')
export const dictionarySchema = z.array(z.object({
  id, label, aliases: z.array(label), family: id.optional(), broad: z.boolean().optional(),
  accepts: z.array(id).optional(), staple: z.boolean().optional(),
})).max(15000)
const quantity = z.union([
  z.object({ status: z.literal('printed'), text: label, amount: z.number().nonnegative().optional(), unit: label.optional() }),
  z.object({ status: z.enum(['unused', 'unknown']) }),
])
const ingredient = z.object({
  id, ingredientId: id, label, group: z.enum(['box', 'bring']), optional: z.boolean(),
  quantities: z.record(z.string().regex(/^[1-9]\d*$/), quantity),
})
const step = z.object({
  id, number, heading: label.optional(), blocks: z.array(note).min(1), notes: z.array(note).default([]),
  quantities: z.record(id, z.record(z.string(), label)).optional(), image: asset.optional(),
  ingredientLines: z.array(id).optional(),
  timers: z.array(z.object({ id, label, seconds: z.array(number.max(86400)).min(1).max(2) })).default([]),
})
export const recipeSchema = z.object({
  id, slug: id, title: label, subtitle: label.optional(), aliases: z.array(label), provider: label,
  source: z.object({ label, edition: label.optional(), url: z.url({ protocol: /^https$/ }).optional() }),
  added: date, description: note.optional(), hero: asset.optional(), cuisine: label.optional(),
  themes: z.array(label), seasons: z.array(z.enum(seasons)).optional(), tagSource: z.enum(['printed', 'reviewed']).default('reviewed'),
  timings: z.object({ prep: range.nullable(), cook: range.nullable(), total: range.nullable(), card: range.optional() }),
  servings: z.array(number.max(30)).min(1), defaultServings: number,
  equipment: z.array(label), before: z.array(note), allergens: z.array(label), cautions: z.array(note),
  ingredients: z.array(ingredient).min(1), steps: z.array(step).min(1),
  variants: z.array(z.object({ id, label, ingredients: z.array(ingredient).min(1), steps: z.array(step).min(1) })).default([]),
}).superRefine((recipe, ctx) => {
  const report = (message: string) => ctx.addIssue({ code: 'custom', message })
  const distinct = (ids: string[]) => new Set(ids).size === ids.length
  const portions = recipe.servings.map(String)
  if (!distinct(portions) || !recipe.servings.includes(recipe.defaultServings)) report('Invalid serving options')
  if (!distinct(recipe.variants.map(v => v.id)) || recipe.variants.some(v => v.id === 'base')) report('Invalid variant IDs')
  for (const version of [recipe, ...recipe.variants]) {
    const lines = version.ingredients.map(line => line.id)
    if (!distinct(lines)) report('Duplicate ingredient line ID')
    for (const line of version.ingredients) {
      if (Object.keys(line.quantities).length !== portions.length || portions.some(n => !line.quantities[n])) report(`Serving columns missing or unexpected for ${line.id}`)
    }
    if (!distinct(version.steps.map(s => s.id))) report('Duplicate step ID')
    version.steps.forEach((s, i) => {
      if (s.number !== i + 1 || !distinct(s.timers.map(t => t.id))) report('Invalid step sequence or timer IDs')
      if (s.ingredientLines?.some(line => !lines.includes(line))) report('Step references unknown ingredient line')
      for (const block of [...s.blocks, ...s.notes]) {
        for (const [, token] of block.matchAll(/\{\{([a-z0-9-]+)\}\}/g)) {
          const line = version.ingredients.find(ingredient => ingredient.id === token)
          const amounts = s.quantities?.[token]
          if (portions.some(n => amounts ? !amounts[n] : line?.quantities[n]?.status !== 'printed')) {
            report(`Unresolved serving token ${token}`)
          }
        }
      }
    })
  }
})

export const manifestSchema = z.object({
  schemaVersion: z.literal(schemaVersion), libraryId: id, title: label, revision: number,
  recipeCount: number.max(5000), media: z.array(z.string().regex(imagePath)).max(40000),
  redirects: z.record(id, id).default({}),
})
export type Recipe = z.infer<typeof recipeSchema>
export type IngredientLine = z.infer<typeof ingredient>
export type Dictionary = z.infer<typeof dictionarySchema>
export type Asset = z.infer<typeof asset>
export type Step = z.infer<typeof step>
export type Manifest = z.infer<typeof manifestSchema>
export type Timing = z.infer<typeof range>
export type TimeKey = 'prep' | 'cook' | 'total'
export type Requirements = Record<string, Record<number, string[]>>
export type Summary = Pick<Recipe, 'id' | 'slug' | 'title' | 'subtitle' | 'aliases' | 'provider' | 'added' | 'description' | 'hero' | 'cuisine' | 'themes' | 'seasons' | 'timings' | 'servings' | 'defaultServings'> & { requirements: Requirements }

export function summarize(recipe: Recipe): Summary {
  const { id, slug, title, subtitle, aliases, provider, added, description, hero, cuisine, themes, seasons, timings, servings, defaultServings } = recipe
  const requirements = Object.fromEntries([['base', recipe.ingredients] as const, ...recipe.variants.map(v => [v.id, v.ingredients] as const)].map(([key, lines]) => [
    key, Object.fromEntries(servings.map(size => [size, [...new Set(lines.filter(line => !line.optional && line.quantities[size].status !== 'unused').map(line => line.ingredientId))]])),
  ]))
  return { id, slug, title, subtitle, aliases, provider, added, description, hero, cuisine, themes, seasons, timings, servings, defaultServings, requirements }
}

export function mediaOf(recipe: Recipe) {
  const images = [recipe.hero, ...[recipe.steps, ...recipe.variants.map(v => v.steps)].flat().map(s => s.image)]
  return images.filter((image): image is Asset => Boolean(image))
    .flatMap(image => [image.path, ...(image.sizes || []).map(size => size.path)])
}

export function validateLibrary(raw: { manifest: unknown; ingredients: unknown; recipes: unknown[] }) {
  const manifest = manifestSchema.parse(raw.manifest)
  const ingredients = dictionarySchema.parse(raw.ingredients)
  if (raw.recipes.length !== manifest.recipeCount) throw Error('Recipe count differs from manifest')
  const recipes = raw.recipes.map(recipe => recipeSchema.parse(recipe))
  const ids = new Set(ingredients.map(i => i.id))
  const slugs = new Set(recipes.map(recipe => recipe.slug))
  if (ids.size !== ingredients.length || slugs.size !== recipes.length || new Set(recipes.map(recipe => recipe.id)).size !== recipes.length) throw Error('Duplicate record ID or slug')
  if (ingredients.some(i => (i.family && (!ids.has(i.family) || i.family === i.id)) || i.accepts?.some(a => !ids.has(a)))) throw Error('Unknown family or accepted ingredient')
  const byId = new Map(ingredients.map(i => [i.id, i]))
  for (const item of ingredients) {
    const seen = new Set([item.id])
    for (let next = item.family; next; next = byId.get(next)?.family) {
      if (seen.has(next)) throw Error('Ingredient family cycle')
      seen.add(next)
    }
  }
  for (const recipe of recipes) {
    for (const version of [recipe, ...recipe.variants]) {
      if (version.ingredients.some(line => !ids.has(line.ingredientId))) throw Error(`Unknown ingredient in ${recipe.slug}`)
    }
  }
  const paths = new Set(recipes.flatMap(mediaOf))
  if (manifest.media.length !== paths.size || manifest.media.some(path => !paths.has(path)) || new Set(manifest.media).size !== paths.size) throw Error('Media references differ from manifest')
  if (Object.entries(manifest.redirects).some(([old, current]) => slugs.has(old) || !slugs.has(current))) throw Error('Invalid recipe redirect')
  return { manifest, ingredients, recipes, index: recipes.map(summarize) }
}

export function imageType(path: string, bytes: Uint8Array) {
  const at = (start: number, ...signature: number[]) => signature.every((n, i) => bytes[start + i] === n)
  if (path.endsWith('.webp') && at(0, 82, 73, 70, 70) && at(8, 87, 69, 66, 80)) return 'image/webp'
  if (path.endsWith('.png') && at(0, 137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png'
  if (/\.jpe?g$/.test(path) && at(0, 255, 216, 255)) return 'image/jpeg'
  throw Error(`Invalid image data for ${path}`)
}
