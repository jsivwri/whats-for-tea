import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowRight, Bookmark, Check, ChevronRight, Clock3, CookingPot, Plus, Search, X } from 'lucide-react'
import type { Asset, Summary } from '../schema/v1.ts'
import { sourceSet, type Catalogue } from './catalogue.ts'
import { ingredientTools, timeText, type PantryItem, type Match } from './matching.ts'

export const recipeLink = (slug: string) => '#/recipe/' + slug
export const cookLink = (slug: string) => '#/cook/' + slug
export const titleOf = (item: Pick<Summary, 'title' | 'subtitle'>) => item.subtitle ? `${item.title} · ${item.subtitle}` : item.title
export const plural = (n: number, thing: string) => `${n} ${thing}${n === 1 ? '' : 's'}`
export type IngredientTools = ReturnType<typeof ingredientTools>

export function Panel({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [])
  return <dialog ref={ref} className={wide ? 'panel wide' : 'panel'} aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  } }}>
    <div className="panel-head"><h2 id={id}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X /></button></div>
    <div className="panel-body">{children}</div>
  </dialog>
}

export function Photo({ asset, catalogue, title, theme, eager, sizes = '(max-width: 650px) 90vw, 380px' }: {
  asset?: Asset; catalogue: Catalogue; title: string; theme?: string; eager?: boolean; sizes?: string
}) {
  const [failed, setFailed] = useState<string>()
  const path = asset && catalogue.media(asset.path)
  return asset && path && failed !== path ? <img src={path} srcSet={sourceSet(asset, catalogue.media)} sizes={sizes} width={asset.width} height={asset.height}
    loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" alt={asset.alt}
    onError={() => setFailed(path)} /> : <div className="photo-fallback"><CookingPot size={28} aria-hidden /><small>{theme || 'Recipe collection'}</small><span>{title}</span></div>
}

export function Card({ recipe, catalogue, saved, onSave, compact, match, tools }: {
  recipe: Summary; catalogue: Catalogue; saved: boolean; onSave: (id: string) => void; compact?: boolean; match?: Match; tools?: IngredientTools
}) {
  const timing = recipe.timings.total || recipe.timings.cook || recipe.timings.card
  const kind = recipe.timings.total ? 'total' : recipe.timings.cook ? 'cook' : 'card time'
  return <article className={`card ${compact ? 'compact' : ''}`}>
    <a className="card-link" href={recipeLink(recipe.slug)} aria-label={titleOf(recipe)}>
      {!compact && <div className="card-photo"><Photo catalogue={catalogue} asset={recipe.hero} title={recipe.title} theme={recipe.themes[0]} /></div>}
      <div className="card-copy">
        <div className="card-meta"><span>{recipe.provider}</span>{timing && <span className="time-tag"><Clock3 size={14} /> {timeText(timing)} {kind}</span>}</div>
        <h3>{recipe.title}</h3>
        {!compact && <p className="card-caption">{recipe.description || recipe.subtitle || recipe.themes[0]}</p>}
        {match && tools && <p className="match-preview">{match.matched.length ? `Uses your ${match.matched.slice(0, 3).map(tools.label).join(', ')}` : 'Possible match'}<span> · </span>
          {match.missing.length ? `${plural(match.missing.length, 'item')} needed` : 'No missing items'}</p>}
      </div>
      {compact && <ChevronRight size={19} aria-hidden />}
    </a>
    <button className="save-icon icon-button" aria-label={`${saved ? 'Remove' : 'Save'} ${recipe.title}`} aria-pressed={saved} onClick={() => onSave(recipe.id)}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /></button>
  </article>
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><CookingPot size={27} aria-hidden /><h2>{title}</h2><div>{children}</div></div>
}

export function PantryField({ tools, pantry, setPantry, dark = false, after }: {
  tools: IngredientTools; pantry: PantryItem[]; setPantry: (value: PantryItem[]) => void; dark?: boolean; after?: () => void
}) {
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState<{ text: string; choices: string[] }[]>([])
  const [picked, setPicked] = useState<string>()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState('')
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const suggestions = open && raw.trim() && !/[,;\n]|\sand\s/i.test(raw) ? tools.suggest(raw) : []
  const add = (ids: string[]) => setPantry([...pantry, ...ids.filter(item => !pantry.some(p => p.id === item)).map(item => ({ id: item, first: false }))])
  const commit = (text = raw) => {
    if (!text.trim()) { input.current?.focus(); return }
    const result = tools.parse(text)
    if (result.ids.length) add(result.ids)
    setPending(result.pending)
    setStatus(result.ids.length ? `Added ${result.ids.map(tools.label).join(', ')}.` : '')
    setOpen(false)
    if (!result.pending.length) { setRaw(''); after?.() }
  }
  const choose = (choice: string) => { add([choice]); setRaw(''); setOpen(false); setActive(-1); setStatus(`Added ${tools.label(choice)}.`); input.current?.focus(); after?.() }
  const narrow = picked ? tools.byId.get(picked)?.broad && [...tools.byId.keys()].filter(key => key !== picked && tools.within(key, picked)) : []
  return <div className={dark ? 'pantry-input dark-input' : 'pantry-input'}>
    <form onSubmit={event => { event.preventDefault(); if (active >= 0 && suggestions[active]) choose(suggestions[active]); else commit() }}>
      <label htmlFor={id} className={dark ? 'visually-hidden' : 'field-label'}>What have you got?</label>
      <div className="pantry-entry">
        <div className="input-wrap"><Search size={19} aria-hidden />
          <input ref={input} id={id} value={raw} maxLength={1500} autoComplete="off" placeholder="e.g. chicken thighs, peppers, yoghurt"
            role="combobox" aria-autocomplete="list" aria-expanded={Boolean(suggestions.length)} aria-controls={suggestions.length ? id + '-list' : undefined}
            aria-activedescendant={active >= 0 && suggestions[active] ? id + '-option-' + active : undefined}
            onChange={event => { setRaw(event.target.value); setOpen(true); setActive(-1) }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
            onPaste={event => {
              const pasted = event.clipboardData.getData('text')
              if (pasted.includes('\n')) { event.preventDefault(); setRaw(pasted.replace(/\r?\n/g, ', ').slice(0, 1500)); setActive(-1) }
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') { setOpen(false); setActive(-1) }
              if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
                event.preventDefault(); setActive(i => event.key === 'ArrowDown' ? (i + 1) % suggestions.length : (i <= 0 ? suggestions.length - 1 : i - 1))
              }
            }} />
          {suggestions.length > 0 && <ul id={id + '-list'} role="listbox" className="suggestions">{suggestions.map((choice, i) =>
            <li key={choice} id={id + '-option-' + i} role="option" aria-selected={active === i} onPointerDown={event => event.preventDefault()} onClick={() => choose(choice)}><Plus size={15} /> {tools.label(choice)}</li>)}</ul>}
        </div>
        <button className="button primary pantry-submit" type="submit">{dark ? 'Find dinner' : 'Add ingredients'}<ArrowRight size={19} /></button>
      </div>
    </form>
    <span className="visually-hidden" role="status">{status}</span>
    {pending.length > 0 && <div className="parse-review"><p><strong>Check these ingredients</strong></p>{pending.map((item, i) => <div className="review-row" key={i}>
      <span>“{item.text}” {item.choices.length ? 'could mean' : 'isn’t in the ingredient list yet.'}</span>
      {item.choices.map(choice => <button className="chip" key={choice} onClick={() => { add([choice]); setPending(pending.filter((_, n) => n !== i)); if (pending.length === 1) setRaw('') }}>{tools.label(choice)}</button>)}
      <button className="icon-button" aria-label={`Dismiss ${item.text}`} onClick={() => { setPending(pending.filter((_, n) => n !== i)); if (pending.length === 1) setRaw('') }}><X size={16} /></button>
    </div>)}</div>}
    {pantry.length > 0 && <div className="pantry-chips" aria-label="Your confirmed ingredients">{pantry.map(item => <div className="ingredient-chip" key={item.id}>
      <button className={item.first ? 'chip first' : 'chip'} onClick={() => setPicked(item.id)}>{item.first && <Check size={14} />}{tools.label(item.id)}{item.first && ' · Use first'}</button>
      <button className="chip-remove" aria-label={`Remove ${tools.label(item.id)}`} onClick={() => setPantry(pantry.filter(p => p.id !== item.id))}><X size={15} /></button>
    </div>)}</div>}
    {picked && <Panel title={tools.label(picked)} onClose={() => setPicked(undefined)}>
      <p>Mark an ingredient to give it priority in your dinner shortlist.</p>
      <button className="button secondary" aria-pressed={pantry.some(item => item.id === picked && item.first)} onClick={() => { setPantry(pantry.map(item => item.id === picked ? { ...item, first: !item.first } : item)); setPicked(undefined) }}>
        {pantry.some(item => item.id === picked && item.first) ? 'Clear Use first' : 'Use first'}
      </button>
      {Array.isArray(narrow) && narrow.length > 0 && <div className="narrow"><p>Which kind do you have?</p>{narrow.map(choice => <button key={choice} className="chip" onClick={() => {
        const original = pantry.find(item => item.id === picked)
        const remaining = pantry.filter(item => item.id !== picked)
        setPantry(remaining.some(item => item.id === choice) ? remaining.map(item => item.id === choice ? { ...item, first: item.first || Boolean(original?.first) } : item) : [...remaining, { id: choice, first: Boolean(original?.first) }])
        setPicked(undefined)
      }}>{tools.label(choice)}</button>)}</div>}
    </Panel>}
  </div>
}

export function ResultCount({ count, thing = 'recipe' }: { count: number; thing?: string }) {
  const [announced, setAnnounced] = useState(count)
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(count), 220)
    return () => clearTimeout(timer)
  }, [count])
  return <><span aria-hidden>{plural(count, thing)}</span><span className="visually-hidden" role="status">{plural(announced, thing)}</span></>
}

export function ShowMore({ count, limit, show }: { count: number; limit: number; show: () => void }) {
  return count > limit && <button className="button secondary show-more" onClick={show}><ArrowDown size={16} /> Show more recipes</button>
}
