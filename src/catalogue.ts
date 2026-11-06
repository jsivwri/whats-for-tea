import type { Asset, Dictionary, Manifest, Recipe, Summary } from '../schema/v1.ts'

export type Catalogue = {
  manifest: Manifest
  ingredients: Dictionary
  index: Summary[]
  recipe(slug: string): Promise<Recipe>
  media(path: string): string
  hosted: boolean
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw Error(`The library could not be loaded (${response.status}).`)
  return response.json()
}

export async function getCatalogue(): Promise<Catalogue> {
  const root = new URL(import.meta.env.BASE_URL + 'library/', location.href).href
  const manifest = await json<Manifest & { version: string }>(root + 'release.json')
  if (manifest.schemaVersion !== 1 || !/^[a-f0-9]{16}$/.test(manifest.version)) throw Error('This library requires a different version of the app.')
  const version = root + manifest.version + '/'
  const { index, ingredients } = await json<{ index: Summary[]; ingredients: Dictionary }>(version + 'index.json')
  const recipes = new Map<string, Promise<Recipe>>()
  return {
    manifest, ingredients, index, hosted: true,
    recipe(slug) {
      const key = Object.hasOwn(manifest.redirects, slug) ? manifest.redirects[slug] : slug
      if (!index.some(recipe => recipe.slug === key)) return Promise.reject(Error('That recipe could not be found in this library.'))
      if (!recipes.has(key)) recipes.set(key, json<Recipe>(`${version}recipes/${key}.json`).catch(error => {
        recipes.delete(key)
        throw error
      }))
      return recipes.get(key)!
    },
    media(path) { return version + path },
  }
}

export function sourceSet(asset: Asset, media: Catalogue['media']) {
  return asset.sizes?.length ? [...asset.sizes, asset].map(image => `${media(image.path)} ${image.width}w`).join(', ') : undefined
}
