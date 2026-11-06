import type { IngredientLine, Step } from '../schema/v1.ts'

export const MAX_SERVINGS = 12
type PrintedServings = { servings: number[] }

export function servingOptions(recipe: PrintedServings) {
  const first = Math.min(...recipe.servings)
  const last = Math.max(MAX_SERVINGS, ...recipe.servings)
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

export function servingReference(printed: number[], servings: number) {
  return Math.max(...printed.filter(size => size <= servings), Math.min(...printed))
}

const fractions: Record<string, number> = { '¼': 1 / 4, '½': 1 / 2, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 }
const measure = /^(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s*([a-z]+))?$/i

function parseMeasure(text: string) {
  const match = text.trim().match(measure)
  if (!match) return
  const [, value, unit = ''] = match
  const fraction = fractions[value.at(-1)!]
  if (fraction) return { amount: Number(value.slice(0, -1)) + fraction, unit }
  const slash = value.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/)
  const amount = slash ? Number(slash[1] || 0) + Number(slash[2]) / Number(slash[3]) : Number(value)
  if (Number.isFinite(amount)) return { amount, unit }
}

function parseQuantity(text: string) {
  let total = 0
  let unit: string | undefined
  for (const part of text.split(/\s*[&+]\s*/)) {
    const [first, second, extra] = part.split(/\s*(?:×|\bx\b)\s*/i)
    const measure = parseMeasure(second ?? first)
    const count = second === undefined ? { amount: 1, unit: '' } : parseMeasure(first)
    if (!measure || !count || count.unit || extra !== undefined || (unit !== undefined && unit !== measure.unit)) return
    total += count.amount * measure.amount
    unit = measure.unit
  }
  return { amount: total, unit: unit ?? '' }
}

const amountFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, useGrouping: false })

function scaledText(text: string, reference: number, servings: number, amount?: number, unit?: string) {
  if (reference === servings) return text
  const parsed = parseQuantity(text)
  const baseAmount = amount ?? parsed?.amount
  if (baseAmount === undefined) return text
  const value = baseAmount * servings / reference
  const originalUnit = unit ?? parsed?.unit ?? ''
  const countUnit = originalUnit.match(/^(bunch|sachet|carton|cup|clove|can|tin)(?:es|s)?$/i)?.[1]
  const displayUnit = countUnit ? countUnit + (value === 1 ? '' : countUnit === 'bunch' ? 'es' : 's') : originalUnit
  return displayUnit ? `${amountFormat.format(value)} ${displayUnit}` : amountFormat.format(value)
}

function ingredientAt(line: IngredientLine, servings: number) {
  const reference = servingReference(Object.keys(line.quantities).map(Number), servings)
  return { reference, quantity: line.quantities[reference] }
}

export function formatAmount(line: IngredientLine, servings: number) {
  const { reference, quantity } = ingredientAt(line, servings)
  return quantity?.status === 'printed' ? scaledText(quantity.text, reference, servings, quantity.amount, quantity.unit) : 'Check card'
}

export const usable = (lines: IngredientLine[], servings: number) =>
  lines.filter(line => ingredientAt(line, servings).quantity?.status !== 'unused')

export function textAt(block: string, step: Step, lines: IngredientLine[], servings: number) {
  return block.replace(/\{\{([a-z0-9-]+)\}\}/g, (_, key: string) => {
    const quantities = step.quantities?.[key]
    if (quantities) {
      const reference = servingReference(Object.keys(quantities).map(Number), servings)
      return scaledText(quantities[reference], reference, servings)
    }
    const line = lines.find(ingredient => ingredient.id === key)
    return line ? formatAmount(line, servings) : 'Check card'
  })
}
