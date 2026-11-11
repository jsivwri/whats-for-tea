import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { recipeSchema, summarize } from '../schema/v1.ts'
import { browse, defaultBasics, emptyFilters, ingredientTools, matchRequirements, requirementsFor, shortlist, titleRank } from '../src/matching.ts'
import { formatAmount, servingOptions, textAt, usable } from '../src/portions.ts'

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
  const coverOnly = { ...chilli, timings: { ...chilli.timings, total: null } }
  const unknownPrep = { ...moussaka, timings: { ...moussaka.timings, prep: null } }
  const time = (key, max, unknown = false) => ({ ...emptyFilters, time: { [key]: max }, unknown })
  assert.deepEqual(browse([hypothetical], time('total', 35), tools), [hypothetical])
  assert.deepEqual(browse([hypothetical], time('total', 30), tools), [])
  assert.deepEqual(browse([coverOnly], time('total', 35), tools), [])
  assert.deepEqual(browse([moussaka], time('cook', 45), tools), [moussaka])
  assert.deepEqual(browse([unknownPrep], time('prep', 15), tools), [])
  assert.deepEqual(browse([unknownPrep], time('prep', 15, true), tools), [unknownPrep])
})

test('applies AND across facets and includes specific children of a family', () => {
  const filtered = browse([orzo, chilli, moussaka], { ...emptyFilters, themes: ['Family favourites'], ingredients: ['chicken'], time: { total: 30 } }, tools)
  assert.deepEqual(filtered.map(r => r.id), [orzo.id])
})

test('uses portion and variant requirements consistently', () => {
  assert.ok(!requirementsFor(chilli, 2).includes('beef-stock-mix'))
  assert.ok(requirementsFor(chilli, 3).includes('beef-stock-mix'))
  assert.ok(!requirementsFor(chilli, 12).includes('beef-stock-mix'))
  assert.ok(!requirementsFor(moussaka, 2, 'pork').includes('beef-mince'))
  assert.ok(requirementsFor(moussaka, 2, 'pork').includes('pork-mince'))
  const recipe = recipes.find(r => r.id === chilli.id)
  const rice = recipe.steps[2]
  assert.match(textAt(rice.blocks[0], rice, recipe.ingredients, 3), /300 ml/)
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

test('the orzo method and ingredient list agree from two to twelve servings', () => {
  const recipe = recipes.find(r => r.id === orzo.id)
  const water = recipe.ingredients.find(line => line.label === 'Water for the sauce')
  const finish = recipe.steps[4]
  assert.deepEqual(servingOptions(recipe), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  for (const [servings, expected] of [[2, '125 ml'], [3, '200 ml'], [4, '250 ml'], [5, '312.5 ml'], [8, '500 ml'], [12, '750 ml']]) {
    assert.equal(formatAmount(water, servings), expected)
    assert.ok(textAt(finish.blocks[0], finish, recipe.ingredients, servings).includes(expected + ' water'))
  }
  assert.match(textAt(finish.blocks[0], finish, recipe.ingredients, 12), /60 g chicken stock paste, 450 g crème fraîche/)
  assert.equal(textAt(finish.blocks[1], finish, recipe.ingredients, 12), finish.blocks[1])
})

test('scales packet totals, preserves unmeasured amounts and resolves step-only quantities', () => {
  const recipe = recipes.find(r => r.id === chilli.id)
  const line = label => recipe.ingredients.find(ingredient => ingredient.label === label)
  assert.equal(formatAmount(line('White long grain rice'), 12), '780 g')
  assert.equal(formatAmount(line('Beef mince'), 3), '250 g & 125 g')
  assert.equal(formatAmount(line('Olive oil'), 12), 'As needed')
  assert.ok(!usable(recipe.ingredients, 12).includes(line('Beef stock mix')))
  const rice = recipe.steps[2]
  assert.match(textAt(rice.blocks[0], rice, recipe.ingredients, 12), /1350 ml cold water/)

  const greekRecipe = recipes.find(r => r.id === moussaka.id)
  const pork = greekRecipe.variants.find(v => v.id === 'pork')
  assert.equal(formatAmount(pork.ingredients.find(line => line.ingredientId === 'pork-mince'), 12), '1800 g')
  const sauce = pork.steps[3]
  assert.match(textAt(sauce.blocks[1], sauce, pork.ingredients, 12), /6 tsp sugar and 180 ml water/)
})

test('finds multi-season recipes by name and season and filters by either selected season', () => {
  const tagged = { ...orzo, seasons: ['Spring', 'Summer'] }
  assert.ok(Number.isFinite(titleRank('summer orzo', tagged)))
  assert.deepEqual(browse([tagged, chilli], { ...emptyFilters, seasons: ['Summer', 'Christmas'] }, tools), [tagged])
  assert.deepEqual(browse([tagged, chilli], { ...emptyFilters, seasons: ['Easter'] }, tools), [])
})

test('scales a single large printed batch down to two servings', () => {
  assert.deepEqual(servingOptions({ servings: [8] }), servingOptions({ servings: [2, 3, 4] }))
  const potatoes = { id: 'potatoes', quantities: { 8: { status: 'printed', text: '2 kg', amount: 2, unit: 'kg' } } }
  assert.equal(formatAmount(potatoes, 2), '0.5 kg')
  assert.equal(textAt('Peel {{potatoes}} potatoes.', {}, [potatoes], 12), 'Peel 3 kg potatoes.')
})
