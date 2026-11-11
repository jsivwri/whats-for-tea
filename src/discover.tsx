import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowRight, BookOpen, CalendarDays, ChevronDown, Clock3, Flame, Grid2X2, List, Search, SlidersHorizontal, Sparkles, Timer, X } from 'lucide-react'
import { seasons, type Summary, type TimeKey } from '../schema/v1.ts'
import type { Catalogue } from './catalogue.ts'
import { browse, emptyFilters, shortlist, timeText, type Filters, type PantryItem } from './matching.ts'
import type { Session } from './state.ts'
import { Card, Empty, Panel, PantryField, Photo, RecipeTags, ResultCount, ShowMore, cookLink, plural, recipeLink, titleOf, type IngredientTools } from './ui.tsx'

export type LibraryProps = {
  catalogue: Catalogue; tools: IngredientTools; saved: string[]; onSave: (id: string) => void
}
type DinnerProps = LibraryProps & {
  pantry: PantryItem[]; basics: string[]; setPantry: (items: PantryItem[]) => void
  filters: Filters; setFilters: Dispatch<SetStateAction<Filters>>
}
export const timeLabels: Record<TimeKey, string> = { prep: 'Prep', cook: 'Cook', total: 'Total' }
const facets = ['cuisine', 'themes', 'seasons', 'ingredients', 'provider'] as const
const facetLabels = { cuisine: 'Cuisine', themes: 'Theme', seasons: 'Season', ingredients: 'Ingredient', provider: 'Provider' }
const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en-GB'))

function useOptions(catalogue: Catalogue, tools: IngredientTools) {
  return useMemo(() => ({
    cuisine: unique(catalogue.index.flatMap(r => r.cuisine ? [r.cuisine] : [])),
    themes: unique(catalogue.index.flatMap(r => r.themes)),
    seasons,
    ingredients: [...tools.byId.keys()].filter(id => !tools.byId.get(id)?.staple).sort((a, b) => tools.label(a).localeCompare(tools.label(b))),
    provider: unique(catalogue.index.map(r => r.provider)),
  }), [catalogue, tools])
}

function FiltersForm({ filters, setFilters, options, tools }: {
  filters: Filters; setFilters: Dispatch<SetStateAction<Filters>>; options: ReturnType<typeof useOptions>; tools: IngredientTools
}) {
  const [ingredientQuery, setIngredientQuery] = useState('')
  const ingredientMatches = new Set(tools.search(ingredientQuery))
  return <div className="filter-groups">
    {facets.map(key => <fieldset key={key}>
      <legend>{facetLabels[key]}</legend>
      {key === 'ingredients' && <input className="small-input" value={ingredientQuery} onChange={event => setIngredientQuery(event.target.value)} aria-label="Find an ingredient filter" placeholder="Find ingredient…" />}
      <div className={key === 'ingredients' ? 'facet-options ingredient-options' : 'facet-options'}>
        {options[key].filter(value => key !== 'ingredients' || !ingredientQuery.trim() || ingredientMatches.has(value)).map(value =>
          <label className="check-label" key={value}><input type="checkbox" checked={filters[key].includes(value)}
            onChange={() => setFilters(f => ({ ...f, [key]: f[key].includes(value) ? f[key].filter(v => v !== value) : [...f[key], value] }))} />
            {key === 'ingredients' ? tools.label(value) : value}</label>)}
      </div>
    </fieldset>)}
    <fieldset className="time-filter"><legend>Maximum time</legend>
      {(['total', 'prep', 'cook'] as const).map(key => <label key={key}><span>{timeLabels[key]}</span>
        <select value={filters.time[key] || ''} onChange={event => { const value = Number(event.target.value); setFilters(f => ({ ...f, time: { ...f.time, [key]: value || undefined } })) }}>
          <option value="">Any time</option>{[10, 15, 20, 25, 30, 35, 45, 60, 90, 120, 180].map(min => <option key={min} value={min}>{min} min</option>)}
        </select></label>)}
      <label className="check-label"><input type="checkbox" checked={filters.unknown} onChange={event => setFilters(f => ({ ...f, unknown: event.target.checked }))} /> Include unknown times</label>
    </fieldset>
  </div>
}

function activeChips(filters: Filters, tools: IngredientTools, set: Dispatch<SetStateAction<Filters>>) {
  return [
    ...facets.flatMap(key => filters[key].map(value => ({ key: key + value, label: key === 'ingredients' ? tools.label(value) : value, remove: () => set(f => ({ ...f, [key]: f[key].filter(x => x !== value) })) }))),
    ...(['total', 'prep', 'cook'] as const).filter(key => filters.time[key]).map(key => ({ key, label: `${timeLabels[key]} ≤ ${filters.time[key]} min`, remove: () => set(f => ({ ...f, time: { ...f.time, [key]: undefined } })) })),
    ...(filters.unknown ? [{ key: 'unknown', label: 'Unknown times included', remove: () => set(f => ({ ...f, unknown: false })) }] : []),
  ]
}

export function Browse({ catalogue, tools, saved, onSave, filters, setFilters, mode, setMode }: LibraryProps & {
  filters: Filters; setFilters: Dispatch<SetStateAction<Filters>>; mode: 'grid' | 'list'; setMode: (mode: 'grid' | 'list') => void
}) {
  const [open, setOpen] = useState(false)
  const [inline, setInline] = useState(false)
  const [page, setPage] = useState({ key: '', limit: 24 })
  const key = JSON.stringify(filters)
  const limit = page.key === key ? page.limit : 24
  const options = useOptions(catalogue, tools)
  const results = useMemo(() => browse(catalogue.index, filters, tools), [catalogue, filters, tools])
  const chips = activeChips(filters, tools, setFilters)
  const reset = () => setFilters(emptyFilters)
  return <main className="container page">
    <div className="page-intro"><span className="eyebrow"><BookOpen size={15} /> The recipe library</span><h1>Browse recipes</h1><p>Find a remembered favourite or see what looks good.</p></div>
    <div className="browse-tools">
      <div className="input-wrap"><Search size={20} /><input type="search" aria-label="Search recipes by name or season" placeholder="Search by recipe or season" value={filters.query}
        onChange={event => setFilters(f => ({ ...f, query: event.target.value }))} /></div>
      <button className="button secondary mobile-filter" onClick={() => setOpen(true)}><SlidersHorizontal size={17} /> Filters{chips.length > 0 && <span className="number-pill">{chips.length}</span>}</button>
      <button className="button secondary desktop-filter" aria-expanded={inline} aria-controls="browse-filters" onClick={() => setInline(!inline)}><SlidersHorizontal size={17} /> Filters{chips.length > 0 && <span className="number-pill">{chips.length}</span>}</button>
      <div className="segmented" aria-label="Recipe layout">
        <button aria-label="Photo grid" aria-pressed={mode === 'grid'} onClick={() => setMode('grid')}><Grid2X2 size={18} /></button>
        <button aria-label="Compact list" aria-pressed={mode === 'list'} onClick={() => setMode('list')}><List size={20} /></button>
      </div>
    </div>
    {inline && <div id="browse-filters" className="inline-filters"><FiltersForm filters={filters} setFilters={setFilters} options={options} tools={tools} /></div>}
    {open && <Panel title="Filter recipes" onClose={() => setOpen(false)} wide><FiltersForm filters={filters} setFilters={setFilters} options={options} tools={tools} />
      <div className="filter-footer"><button className="text-button" onClick={reset}>Clear all</button><button className="button primary" onClick={() => setOpen(false)}>Show {plural(results.length, 'recipe')}</button></div></Panel>}
    {chips.length > 0 && <div className="active-filters">{chips.map(chip => <button className="chip" key={chip.key} onClick={chip.remove} aria-label={`Remove filter ${chip.label}`}>{chip.label}<X size={15} /></button>)}
      <button className="text-button" onClick={reset}>Clear all</button></div>}
    <div className="results-line"><ResultCount count={results.length} /><label>Sort <select value={filters.sort} onChange={event => setFilters(f => ({ ...f, sort: event.target.value as Filters['sort'] }))}>
      <option value="relevance">Best match</option><option value="name">Name A–Z</option><option value="recent">Recently added</option><option value="total">Quickest total time</option><option value="prep">Lowest prep time</option>
    </select></label></div>
    {results.length ? <div className={mode === 'list' ? 'compact-list' : 'recipe-grid'}>{results.slice(0, limit).map(recipe =>
      <div key={recipe.id}><Card recipe={recipe} catalogue={catalogue} compact={mode === 'list'} saved={saved.includes(recipe.id)} onSave={onSave} />
        {filters.unknown && (Object.keys(filters.time) as TimeKey[]).some(k => filters.time[k] && !recipe.timings[k]) &&
          <p className="unknown-time">{(Object.keys(filters.time) as TimeKey[]).filter(k => filters.time[k] && !recipe.timings[k]).map(k => timeLabels[k]).join(' and ')} time unknown</p>}</div>)}</div> :
      <Empty title="No recipes match"><p>Try a shorter title or remove a filter.</p>
        {!filters.unknown && Object.values(filters.time).some(Boolean) && <button className="button secondary" onClick={() => setFilters(f => ({ ...f, unknown: true }))}>Include unknown times</button>}
        <button className="text-button" onClick={reset}>Reset search and filters</button></Empty>}
    <ShowMore count={results.length} limit={limit} show={() => setPage({ key, limit: limit + 24 })} />
  </main>
}

function Shortcuts({ filters, setFilters, themes }: { filters: Filters; setFilters: Dispatch<SetStateAction<Filters>>; themes: string[] }) {
  const [choose, setChoose] = useState<'themes' | 'seasons' | null>(null)
  const title = choose === 'themes' ? 'Pick a theme' : 'Pick a season'
  return <>
    <div className="shortcuts" aria-label="Dinner shortcuts">
      <button className="shortcut" aria-pressed={filters.time.total === 30} onClick={() => setFilters(f => ({ ...f, time: { ...f.time, total: f.time.total === 30 ? undefined : 30 } }))}><Clock3 size={17} /> Ready in 30 min</button>
      <button className="shortcut" aria-pressed={filters.time.prep === 15} onClick={() => setFilters(f => ({ ...f, time: { ...f.time, prep: f.time.prep === 15 ? undefined : 15 } }))}><Flame size={17} /> Low prep</button>
      <button className="shortcut" aria-haspopup="dialog" aria-pressed={filters.themes.length > 0} onClick={() => setChoose('themes')}><Sparkles size={17} /> {filters.themes.length === 1 ? filters.themes[0] : 'Pick a theme'} <ChevronDown size={15} /></button>
      <button className="shortcut" aria-haspopup="dialog" aria-pressed={filters.seasons.length > 0} onClick={() => setChoose('seasons')}><CalendarDays size={17} /> {filters.seasons.length === 1 ? filters.seasons[0] : filters.seasons.length > 1 ? plural(filters.seasons.length, 'season') : 'Pick a season'} <ChevronDown size={15} /></button>
    </div>
    {choose && <Panel title={title} onClose={() => setChoose(null)}>
      <div className="theme-choices">{(choose === 'themes' ? themes : seasons).map(value => <button key={value} className="button secondary" aria-pressed={filters[choose].includes(value)}
        onClick={() => setFilters(f => ({ ...f, [choose]: f[choose].includes(value) ? f[choose].filter(item => item !== value) : [...f[choose], value] }))}>{value}</button>)}</div>
      <div className="filter-footer"><button className="text-button" onClick={() => setFilters(f => ({ ...f, [choose]: [] }))}>Clear {choose}</button><button className="button primary" onClick={() => setChoose(null)}>Done</button></div>
    </Panel>}
  </>
}

function DinnerResults({ catalogue, tools, pantry, basics, filters, setFilters, saved, onSave, today }: DinnerProps & { today?: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const [limit, setLimit] = useState(24)
  const hits = useMemo(() => shortlist(catalogue.index, filters, pantry, basics, tools, showAll), [catalogue, filters, pantry, basics, tools, showAll])
  const visible = hits.slice(0, today ? 5 : limit)
  const groups = pantry.length ? [
    { title: 'No missing items', hits: visible.filter(hit => !hit.match.missing.length) },
    { title: 'Missing 1–2', hits: visible.filter(hit => hit.match.missing.length >= 1 && hit.match.missing.length <= 2) },
    { title: 'More ingredients needed', hits: visible.filter(hit => hit.match.missing.length > 2) },
  ] : [{ title: '', hits: visible }]
  const key = (Object.keys(filters.time) as TimeKey[]).find(key => filters.time[key])
  return <section className="dinner-results" aria-labelledby="dinner-heading">
    <div className="section-head"><div><span className="eyebrow"><Sparkles size={15} /> Dinner ideas</span><h2 id="dinner-heading">{today ? 'Your dinner shortlist' : 'What you could make'}</h2></div><ResultCount count={hits.length} /></div>
    {pantry.length > 0 && <div className="dinner-explain"><div><p>Matches use the recipe’s default serving size. <strong>Check quantities.</strong></p>
      <details><summary>Cupboard assumptions</summary><p>{basics.length ? basics.map(tools.label).join(', ') : 'Cupboard assumptions are off.'} <a href="#/settings">Edit in Settings</a></p></details></div>
      <label className="check-label"><input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)} /> Show all matching filters</label></div>}
    {!hits.length && <Empty title="Nothing fits just yet"><p>{pantry.length ? 'Try adding another ingredient or show dishes without a pantry connection.' : 'Try changing your shortcuts.'}</p>
      {!showAll && pantry.length > 0 && <button className="button secondary" onClick={() => setShowAll(true)}>Show all matching filters</button>}
      {key && !filters.unknown && <button className="button secondary" onClick={() => setFilters(f => ({ ...f, unknown: true }))}>Include unknown times</button>}
      <button className="text-button" onClick={() => setFilters(emptyFilters)}>Clear dinner shortcuts</button></Empty>}
    {groups.filter(group => group.hits.length).map(group => <div className="dinner-group" key={group.title}>
      {group.title && <h3 className="group-heading">{group.title}</h3>}
      <div className="dinner-list">{group.hits.map(({ recipe, match }) => <article key={recipe.id} className="dinner-card">
        <a className="dinner-photo" href={recipeLink(recipe.slug)} tabIndex={-1} aria-hidden><Photo asset={recipe.hero} catalogue={catalogue} title={recipe.title} sizes="180px" /></a>
        <div className="dinner-card-body">
          <span className="eyebrow">{today && visible[0]?.recipe.id === recipe.id ? 'Top suggestion' : recipe.provider}</span>
          <h3><a href={recipeLink(recipe.slug)} aria-label={titleOf(recipe)}>{recipe.title}</a></h3>
          {pantry.length ? <><p>{match.matched.length > 0 ? `Uses your ${match.matched.map(tools.label).join(', ')}` : match.leads.length ? `Possible lead for ${match.leads.map(tools.label).join(', ')}` : 'No confirmed pantry matches'}
            {' · '}{!match.missing.length ? 'No missing items' : match.missing.length <= 2 ? `missing ${match.missing.map(tools.label).join(', ')}` : `${plural(match.missing.length, 'item')} needed`}</p>
            <details><summary>Shopping gap for {recipe.defaultServings}</summary>
              <p>{match.missing.length ? match.missing.map(tools.label).join(', ') : 'Everything required is covered.'}</p>
              {match.assumed.length > 0 && <p>Assuming {match.assumed.map(tools.label).join(', ')}.</p>}
            </details></> : key && <p>{recipe.timings[key] ? `${timeText(recipe.timings[key]!)} ${key}` : `${timeLabels[key]} time unknown`}</p>}
          {pantry.length > 0 && key && !recipe.timings[key] && <p className="unknown-time">{timeLabels[key]} time unknown</p>}
          <RecipeTags recipe={recipe} />
        </div>
        <div className="dinner-actions"><a className="button secondary" href={recipeLink(recipe.slug)}>View recipe <ArrowRight size={17} /></a>
          <button className="text-button" aria-pressed={saved.includes(recipe.id)} onClick={() => onSave(recipe.id)}>{saved.includes(recipe.id) ? 'Saved' : 'Save'}</button></div>
      </article>)}</div>
    </div>)}
    {!today && <ShowMore count={hits.length} limit={limit} show={() => setLimit(limit + 24)} />}
    {today && hits.length > 5 && <a className="button secondary" href="#/pantry">See all matches <ArrowRight size={17} /></a>}
  </section>
}

export function Today(props: DinnerProps & { session: Session | null; browseTheme: (theme?: string) => void }) {
  const { catalogue, tools, pantry, setPantry, filters, setFilters, saved, onSave, session, browseTheme, basics } = props
  const featured = catalogue.index.find(r => r.slug === 'pesto-orzo') || catalogue.index.find(r => r.hero) || catalogue.index[0]
  const resume = catalogue.index.find(r => r.id === session?.recipeId)
  const constrained = filters.themes.length > 0 || filters.seasons.length > 0 || Object.values(filters.time).some(Boolean) || pantry.length > 0
  const [shelf, setShelf] = useState('Recently added')
  const shelfNames = ['Recently added', 'One pan', 'Comfort food'].filter(name => name === 'Recently added' || catalogue.index.some(r => r.themes.includes(name)))
  const shelfRecipes = shelf === 'Recently added' ? catalogue.index : catalogue.index.filter(r => r.themes.includes(shelf))
  const themes = useOptions(catalogue, tools).themes
  return <main id="main" className="container today">
    <section className="hero">
      <div className="hero-copy"><span className="hero-kicker"><i /> THE HOUSEHOLD COOKBOOK</span>
        <h1>What’s for <em>tea?</em></h1><p>Tell us what’s in the fridge and find a familiar recipe for tonight.</p>
        <PantryField tools={tools} pantry={pantry} setPantry={setPantry} dark />
        <div className="hero-note"><span>Try chicken thighs, peppers and yoghurt</span></div>
      </div>
      {featured && <a className="hero-photo" href={recipeLink(featured.slug)} aria-label={titleOf(featured)}>
        <Photo asset={featured.hero} catalogue={catalogue} title={featured.title} eager sizes="(max-width: 760px) 100vw, 620px" />
        <span className="feature-label"><span><small>FROM THE RECIPE BOX</small><strong>{featured.aliases[0] === 'pesto orzo' ? 'Creamy Pesto Orzo' : featured.title}</strong></span><ArrowRight size={19} /></span>
      </a>}
    </section>
    <div className="shortcut-bar"><span>TONIGHT’S SHORTCUTS</span><Shortcuts filters={filters} setFilters={setFilters} themes={themes} /></div>
    {resume && <a href={cookLink(resume.slug)} className="resume"><Timer size={24} /><span><strong>Resume cooking</strong><small>{resume.title}</small></span><ArrowRight size={19} /></a>}
    {constrained ? <DinnerResults {...props} today /> : <section className="recipe-shelf">
      <div className="section-head"><div><span className="eyebrow"><span className="short-rule" /> FROM THE RECIPE BOX</span><h2>Find your next favourite</h2></div>
        <button className="text-button view-all" onClick={() => browseTheme()}>Browse all recipes <ArrowRight size={18} /></button></div>
      <div className="shelf-tabs" aria-label="Recipe collections">{shelfNames.map(name => <button key={name} aria-pressed={shelf === name} onClick={() => setShelf(name)}>{name}</button>)}</div>
      <div className="recipe-grid">{shelfRecipes.slice(0, 3).map(recipe => <Card key={recipe.id} recipe={recipe} catalogue={catalogue} saved={saved.includes(recipe.id)} onSave={onSave} />)}</div>
      {shelf !== 'Recently added' && <button className="text-button collection-link" onClick={() => browseTheme(shelf)}>See the {shelf.toLowerCase()} collection <ArrowRight size={17} /></button>}
    </section>}
    {!pantry.length && <p className="basics-note">For pantry matches, assume {basics.length ? basics.map(tools.label).join(', ') : 'no cupboard basics'}. <a href="#/settings">Change assumptions</a></p>}
  </main>
}

export function Pantry(props: DinnerProps) {
  const themes = useOptions(props.catalogue, props.tools).themes
  return <main id="main" className="container page">
    <div className="page-intro"><span className="eyebrow"><Sparkles size={15} /> Dinner from the fridge</span><h1>Your pantry</h1><p>Tell us what you have and we’ll show what you can make and what you still need.</p></div>
    <section className="pantry-workbench">
      <PantryField tools={props.tools} pantry={props.pantry} setPantry={props.setPantry} />
      <p className="muted">Add several items at once. Select an ingredient chip to correct it or mark it <strong>Use first</strong>.</p>
      <Shortcuts filters={props.filters} setFilters={props.setFilters} themes={themes} />
    </section>
    {props.pantry.length || props.filters.themes.length || props.filters.seasons.length || Object.values(props.filters.time).some(Boolean) ? <DinnerResults {...props} /> :
      <Empty title="What’s in the fridge?"><p>Start with an ingredient you want to use up, or pick one of the shortcuts.</p><a href="#/browse" className="button secondary">Browse recipes <ArrowRight size={16} /></a></Empty>}
  </main>
}
