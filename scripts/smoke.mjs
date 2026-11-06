import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { validateLibrary, imageType } from '../schema/v1.ts'

const files = readdirSync('dist', { recursive: true, withFileTypes: true }).filter(f => f.isFile())
const names = files.map(file => file.parentPath + '/' + file.name)
const html = readFileSync('dist/index.html', 'utf8')
const entry = html.match(/<script[^>]*src="([^"]+\.js)"/)?.[1].split('/').pop()
if (!entry) throw Error('No production entry point')
const compressed = gzipSync(readFileSync('dist/assets/' + entry)).length
if (compressed > 200 * 1024) throw Error('Initial JS exceeds the 200 KiB gzip budget')
const manifest = JSON.parse(readFileSync('dist/library/release.json', 'utf8'))
const version = 'dist/library/' + manifest.version
const { ingredients, index } = JSON.parse(readFileSync(version + '/index.json', 'utf8'))
const recipes = index.map(({ slug }) => JSON.parse(readFileSync(`${version}/recipes/${slug}.json`, 'utf8')))
const verified = validateLibrary({ manifest, ingredients, recipes })
if (JSON.stringify(index) !== JSON.stringify(verified.index)) throw Error('Release index differs from recipe records')
const library = new Set(['dist/library/release.json', version + '/index.json', ...recipes.map(r => `${version}/recipes/${r.slug}.json`), ...manifest.media.map(path => `${version}/${path}`)])
for (const path of manifest.media) imageType(path, readFileSync(`${version}/${path}`))
for (const name of names) {
  if (!(library.has(name) || /^dist\/(?:index\.html|favicon\.svg|assets\/[\w.-]+\.(?:js|css))$/.test(name))) throw Error(`Unexpected public build file: ${name}`)
  if (/\.(js|json|html|css)$/.test(name) && /(?:\/Users\/|Finances and Household|rawOcr|scanHash)/.test(readFileSync(name, 'utf8'))) throw Error(`Private development reference in ${name}`)
}
console.log(`Production smoke check passed. ${recipes.length} recipes and ${(compressed / 1024).toFixed(1)} KiB gzip entry JavaScript.`)
