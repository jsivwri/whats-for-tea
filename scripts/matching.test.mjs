import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { recipeSchema, summarize } from '../schema/v1.ts'
import { browse, defaultBasics, emptyFilters, ingredientTools, matchRequirements, requirementsFor, shortlist, titleRank } from '../src/matching.ts'

const json = path => JSON.parse(readFileSync(new URL('../release/' + path, import.meta.url)))
const tools = ingredientTools(json('ingredients.json'))
const recipes = json('allowlist.json').recipes.map(slug => recipeSchema.parse(json('recipes/' + slug + '.json')))
const index = recipes.map(summarize)
const orzo = index.find(recipe => recipe.slug === 'pesto-orzo')
const chilli = index.find(recipe => recipe.slug === 'classic-chilli')
const moussaka = index.find(recipe => recipe.slug === 'beef-moussaka')
const pantry = (...ids) => ids.map(id => ({ id, first: false }))

test('finds reviewed aliases and tolerates small typos and spelling variants', () => {
  assert.equal(titleRank('pesto orzo', orzo), 0)
  assert.ok(Number.isFinite(titleRank('pesto orzoo', orzo)))
  assert.equal(titleRank('chili con carne', chilli), 0)
})

test('parses pasted quantities and asks for confirmation on fuzzy and vague matches', () => {
  assert.deepEqual(tools.parse("I've got 2 spring onions, 300 g chicken thighs and some yogurt"),
    { ids: ['spring-onion', 'chicken-thigh', 'natural-yoghurt'], pending: [] })
  const parsed = tools.parse('sallmon flakes; cream\nscallion, spring onion')
  assert.deepEqual(parsed.ids, ['spring-onion'])
  assert.ok(parsed.pending[0].choices.includes('salmon-flakes'))
  assert.ok(parsed.pending[1].choices.includes('creme-fraiche'))
  assert.ok(parsed.pending[1].choices.includes('double-cream'))
})

test('treats a broad chicken as a lead and respects ingredient specificity', () => {
  const needs = requirementsFor(orzo)
  assert.ok(matchRequirements(needs, pantry('chicken'), [], tools).leads.includes('chicken-breast'))
  assert.ok(matchRequirements(needs, pantry('chicken-thigh'), [], tools).missing.includes('chicken-breast'))
  assert.ok(matchRequirements(needs, pantry('chicken-breast'), [], tools).matched.includes('chicken-breast'))
  assert.ok(matchRequirements(needs, pantry('chicken-breast'), defaultBasics, tools).missing.includes('mediterranean-seasoning'))
  assert.deepEqual(matchRequirements(['olive-oil', 'neutral-oil'], [], defaultBasics, tools).missing, ['olive-oil'])
  assert.deepEqual(matchRequirements(['chicken'], pantry('chicken-thigh'), [], tools).matched, ['chicken'])
})

test('uses the maximum of a verified range and filters unknown prep and ambiguous cover times separately', () => {
  const hypothetical = { ...chilli, timings: { ...chilli.timings, total: chilli.timings.card } }
  const time = (key, max, unknown = false) => ({ ...emptyFilters, time: { [key]: max }, unknown })
  assert.deepEqual(browse([hypothetical], time('total', 35), tools), [hypothetical])
  assert.deepEqual(browse([hypothetical], time('total', 30), tools), [])
  assert.deepEqual(browse([chilli], time('total', 35), tools), [])
  assert.deepEqual(browse([moussaka], time('cook', 45), tools), [moussaka])
  assert.deepEqual(browse([moussaka], time('prep', 15), tools), [])
  assert.deepEqual(browse([moussaka], time('prep', 15, true), tools), [moussaka])
})

test('applies AND across facets and includes specific children of a family', () => {
  const filtered = browse(index, { ...emptyFilters, themes: ['Family favourites'], ingredients: ['chicken'], time: { total: 30 } }, tools)
  assert.deepEqual(filtered.map(r => r.id), [orzo.id])
})

test('uses portion and variant requirements consistently', () => {
  assert.ok(!requirementsFor(chilli, 2).includes('beef-stock-mix'))
  assert.ok(requirementsFor(chilli, 3).includes('beef-stock-mix'))
  assert.ok(!requirementsFor(moussaka, 2, 'pork').includes('beef-mince'))
  assert.ok(requirementsFor(moussaka, 2, 'pork').includes('pork-mince'))
  assert.equal(recipes.find(r => r.id === chilli.id).steps[2].quantities['rice-water'][3], '300 ml')
})

test('keeps nonmatching recipes out by default and breaks equal gaps using Use first', () => {
  const trial = (id, ingredient) => ({ ...orzo, id, requirements: { base: { 2: [ingredient, 'carrot'] } } })
  const one = trial('a', 'spring-onion'), two = trial('b', 'leek')
  const picks = [{ id: 'spring-onion', first: false }, { id: 'leek', first: true }]
  assert.deepEqual(shortlist([one, two, moussaka], emptyFilters, picks, [], tools).map(hit => hit.recipe.id), ['b', 'a'])
})

test('500 recipe matching pass retains the interaction budget', () => {
  const fixture = Array.from({ length: 500 }, (_, i) => ({ ...index[i % index.length], id: 'fixture-' + i }))
  const start = performance.now()
  const hits = shortlist(fixture, emptyFilters, pantry('chicken-thigh', 'natural-yoghurt'), defaultBasics, tools)
  assert.ok(hits.length > 0)
  assert.ok(performance.now() - start < 100, '500-recipe shortlist exceeded 100 ms in Node')
})
