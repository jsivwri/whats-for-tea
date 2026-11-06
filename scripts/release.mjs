import { mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { validateLibrary, imageType } from '../schema/v1.ts'

const source = new URL('../release/', import.meta.url)
const output = new URL('../public/library/', import.meta.url)
const read = name => readFileSync(new URL(name, source))
const json = name => JSON.parse(read(name))
const { recipes: allowedRecipes, media: allowedMedia } = json('allowlist.json')
const paths = [...allowedRecipes.map(slug => `recipes/${slug}.json`), ...allowedMedia]
const list = folder => readdirSync(new URL(folder, source)).sort().map(name => folder + name)
if ([...list('recipes/'), ...list('media/')].sort().join('\n') !== [...paths].sort().join('\n')) throw Error('Release directory differs from the public allowlist')
const lib = validateLibrary({ manifest: { ...json('manifest.json'), recipeCount: allowedRecipes.length, media: allowedMedia },
  ingredients: json('ingredients.json'), recipes: allowedRecipes.map(slug => json(`recipes/${slug}.json`)) })
if (lib.recipes.some((r, i) => r.slug !== allowedRecipes[i])) throw Error('Recipe filenames must match slugs')
const hash = createHash('sha256')
for (const path of ['manifest.json', 'ingredients.json', 'allowlist.json', ...paths]) {
  const data = read(path)
  hash.update(path).update('\0').update(data)
  if (allowedMedia.includes(path)) {
    imageType(path, data)
    if (data.length > 1_500_000) throw Error(`Optimise release image ${path}`)
  } else if (/(?:\/Users\/|\/home\/|file:\/\/|\.pdf\b|rawOcr|scanHash)/i.test(data.toString())) throw Error(`Private development reference in ${path}`)
}
const version = hash.digest('hex').slice(0, 16)
if (!process.argv.includes('--check')) {
  rmSync(output, { recursive: true, force: true })
  const versionDir = new URL(version + '/', output)
  for (const dir of ['media/', 'recipes/']) mkdirSync(new URL(dir, versionDir), { recursive: true })
  for (const path of allowedMedia) copyFileSync(new URL(path, source), new URL(path, versionDir))
  const write = (path, data) => writeFileSync(new URL(path, versionDir), JSON.stringify(data))
  for (const recipe of lib.recipes) write(`recipes/${recipe.slug}.json`, recipe)
  write('index.json', { ingredients: lib.ingredients, index: lib.index })
  writeFileSync(new URL('release.json', output), JSON.stringify({ ...lib.manifest, version }))
}
const counts = Object.fromEntries(['prep', 'cook', 'total', 'card'].map(key => [key, lib.recipes.filter(r => r.timings[key]).length]))
console.log(JSON.stringify({ version, recipes: lib.recipes.length, images: allowedMedia.length, timings: counts }))
