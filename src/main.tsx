import { createRoot } from 'react-dom/client'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowRight, BookOpen, Bookmark, Download, Globe, House, Search, Settings2, ShoppingBasket, Upload, Utensils } from 'lucide-react'
import { Browse, Pantry, Today, type LibraryProps } from './discover.tsx'
import { CookMode, RecipePage } from './cooking.tsx'
import { getCatalogue, type Catalogue } from './catalogue.ts'
import { defaultBasics, emptyFilters, ingredientTools } from './matching.ts'
import { cleanData, downloadBackup, useUserData, type UserData } from './state.ts'
import { Card, Empty, Panel, recipeLink } from './ui.tsx'
import type { Recipe } from '../schema/v1.ts'
import './styles.css'

const tabs = [
  { to: '/', label: 'Today', Icon: House }, { to: '/browse', label: 'Browse', Icon: BookOpen },
  { to: '/pantry', label: 'Pantry', Icon: ShoppingBasket }, { to: '/saved', label: 'Saved', Icon: Bookmark },
]
const route = () => location.hash.slice(1) || '/'
type ChangeData = Dispatch<SetStateAction<UserData>>

function Header({ path }: { path: string }) {
  const active = path === '/' ? '/' : '/' + path.split('/')[1]
  return <header className="site-header"><div className="container header-inner">
    <a href="#/" className="brand"><span className="brand-mark"><Utensils size={23} strokeWidth={1.8} /></span><span>What’s for Tea<span className="brand-question">?</span><small>THE HOUSEHOLD COOKBOOK</small></span></a>
    <nav aria-label="Main navigation">{tabs.map(({ to, label, Icon }) => <a href={`#${to}`} key={to} aria-current={active === to ? 'page' : undefined}><Icon size={18} strokeWidth={1.85} />{label}</a>)}</nav>
    <div className="header-actions"><a href="#/browse" className="icon-button header-search" aria-label="Search recipes"><Search size={20} /></a>
      <a href="#/settings" className="icon-button" aria-label="Settings" aria-current={active === '/settings' ? 'page' : undefined}><Settings2 size={21} /></a></div>
  </div></header>
}

function Saved({ catalogue, saved, onSave, cooked, history }: LibraryProps & { cooked: UserData['cooked']; history: boolean }) {
  const byId = new Map(catalogue.index.map(recipe => [recipe.id, recipe]))
  const ids = history ? cooked.map(c => c.id) : saved
  const results = ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : [])
  return <main id="main" className="container page"><div className="page-intro"><span className="eyebrow"><Bookmark size={15} /> Your recipe box</span>
    <h1>Saved recipes</h1><p>Keep the dishes you want to make again within reach.</p></div>
    <div className="shelf-tabs"><a href="#/saved" aria-current={!history ? 'page' : undefined}>Favourites</a><a href="#/saved/cooked" aria-current={history ? 'page' : undefined}>Recently cooked</a></div>
    {results.length ? <div className="recipe-grid">{results.map(recipe => <div key={recipe.id}>
      <Card catalogue={catalogue} recipe={recipe} saved={saved.includes(recipe.id)} onSave={onSave} />
      {history && <p className="muted cooked-date">Cooked {new Date(cooked.find(c => c.id === recipe.id)!.date).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</p>}</div>)}</div> :
      <Empty title={history ? 'No meals cooked yet' : 'No favourites yet'}><p>{history ? 'Finish a Cook Mode session to add it to your history.' : 'Use the bookmark on a recipe to save it here.'}</p>
        <a href="#/browse" className="button secondary">Browse recipes <ArrowRight size={17} /></a></Empty>}
  </main>
}

const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string')
function parseBackup(raw: string, library: string): UserData {
  const { schemaVersion, library: owner, data } = JSON.parse(raw)
  if (schemaVersion !== 1 || owner !== library || !data ||
    !ids(data.saved) || !(data.basics === null || ids(data.basics)) || typeof data.largeType !== 'boolean' ||
    !Array.isArray(data.pantry) || !data.pantry.every((item: UserData['pantry'][number]) => typeof item?.id === 'string' && typeof item.first === 'boolean') ||
    !Array.isArray(data.cooked) || !data.cooked.every((item: UserData['cooked'][number]) => typeof item?.id === 'string' && typeof item.date === 'string' && Number.isFinite(Date.parse(item.date)))) throw Error('This file is not a valid settings backup for this library.')
  if (data.session !== null) {
    const s = data.session
    if (!s || typeof s.recipeId !== 'string' || typeof s.slug !== 'string' || !Number.isInteger(s.servings) || s.servings <= 0 ||
      typeof s.variant !== 'string' || !(s.step === null || typeof s.step === 'string') ||
      !ids(s.ingredients) || !ids(s.equipment) || !Array.isArray(s.timers) ||
      !s.timers.every((t: NonNullable<UserData['session']>['timers'][number]) => typeof t?.id === 'string' && typeof t.label === 'string' && Number.isFinite(t.ends))) throw Error('The backup has an invalid cooking session.')
  }
  return { pantry: data.pantry, basics: data.basics, saved: data.saved, cooked: data.cooked, session: data.session, largeType: data.largeType }
}

function Settings({ catalogue, data, setData }: { catalogue: Catalogue; data: UserData; setData: ChangeData }) {
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState<'reset' | UserData>()
  const fileRef = useRef<HTMLInputElement>(null)
  const basics = data.basics ?? defaultBasics
  const selectable = catalogue.ingredients.filter(i => i.staple).sort((a, b) => a.label.localeCompare(b.label))
  return <main id="main" className="container page settings"><div className="page-intro"><span className="eyebrow"><Settings2 size={15} /> Your kitchen</span>
    <h1>Settings</h1><p>Manage cupboard assumptions and the activity stored in this browser.</p></div>
    <section className="settings-section"><h2>The recipe library</h2><div className="library-badge"><Globe size={24} /><div><strong>{catalogue.manifest.title}</strong>
      <p>Revision {catalogue.manifest.revision} · {catalogue.index.length} recipes · Public library</p></div></div>
      <p>Open this site’s address on another device to get the same catalogue. Pantry ingredients, bookmarks and cooking history stay in this browser.</p></section>
    <section className="settings-section"><h2>Cupboard basics</h2><p>Tick the ingredients the pantry matcher can assume you have.</p>
      <div className="basics-grid">{selectable.map(item => <label key={item.id} className="check-label"><input type="checkbox" checked={basics.includes(item.id)} onChange={() => setData(value => ({
        ...value, basics: basics.includes(item.id) ? basics.filter(id => id !== item.id) : [...basics, item.id],
      }))} />{item.label}</label>)}</div>
      <div className="settings-actions"><button className="button secondary" onClick={() => setData(value => ({ ...value, basics: null }))}>Restore defaults</button>
        <button className="text-button" onClick={() => setData(value => ({ ...value, basics: [] }))}>Turn off assumptions</button></div></section>
    <section className="settings-section"><h2>Browser data</h2><p>Move your pantry, favourites and cooking history to another browser using a settings backup.</p>
      <div className="settings-actions"><button className="button secondary" onClick={() => downloadBackup(catalogue.manifest.libraryId, data)}><Download size={18} /> Export settings</button>
        <button className="button secondary" onClick={() => fileRef.current?.click()}><Upload size={18} /> Restore settings</button>
        <button className="text-button danger" onClick={() => setConfirm('reset')}>Reset browser data</button></div>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        try {
          if (file.size > 500_000) throw Error('This backup is too large.')
          setConfirm(parseBackup(await file.text(), catalogue.manifest.libraryId)); setMessage('')
        } catch (error) { setMessage(error instanceof SyntaxError ? 'This file could not be read as a settings backup.' : (error as Error).message) }
      }} /><p role="status">{message}</p></section>
    {confirm && <Panel title={confirm === 'reset' ? 'Reset browser data?' : 'Restore from backup?'} onClose={() => setConfirm(undefined)}>
      <p>{confirm === 'reset' ? 'This clears your pantry, favourites, history, settings and current cooking session on this browser.' : 'This replaces the activity and settings currently stored in this browser.'}</p>
      <div className="filter-footer"><button className="button secondary" onClick={() => setConfirm(undefined)}>Cancel</button>
        <button className="button primary" onClick={() => { setData(confirm === 'reset' ? cleanData : confirm); setMessage(confirm === 'reset' ? 'Browser data cleared.' : 'Settings restored.'); setConfirm(undefined) }}>{confirm === 'reset' ? 'Reset data' : 'Restore'}</button></div>
    </Panel>}
  </main>
}

function RecipeRoute({ slug, cooking, catalogue, data, setData, library, basics, back }: {
  slug: string; cooking: boolean; catalogue: Catalogue; data: UserData; setData: ChangeData; library: LibraryProps; basics: string[]; back: () => void
}) {
  const [recipe, setRecipe] = useState<Recipe>()
  const [problem, setProblem] = useState('')
  useEffect(() => {
    let live = true
    catalogue.recipe(slug).then(recipe => { if (live) setRecipe(recipe) }, error => { if (live) setProblem(error.message) })
    return () => { live = false }
  }, [slug, catalogue])
  if (!recipe) return <main id="main" className="container page">{problem ? <Empty title="Recipe unavailable"><p>{problem}</p><a className="button secondary" href="#/browse">Browse recipes</a></Empty> : <p role="status">Opening the recipe…</p>}</main>
  return cooking ? <CookMode {...library} recipe={recipe} data={data} setData={setData} basics={basics} /> :
    <RecipePage {...library} recipe={recipe} data={data} setData={setData} basics={basics} back={back} />
}

function Site({ catalogue }: { catalogue: Catalogue }) {
  const [path, setPath] = useState(route)
  const redirects = useMemo(() => {
    const bySlug = new Map(catalogue.index.map(recipe => [recipe.slug, recipe]))
    const redirects = new Map<string, { id: string; slug: string }>()
    for (const [from, to] of Object.entries(catalogue.manifest.redirects)) {
      const recipe = bySlug.get(to)
      if (recipe) redirects.set(from, { id: recipe.id, slug: recipe.slug })
    }
    return redirects
  }, [catalogue])
  const [data, setData, storageError] = useUserData(catalogue.manifest.libraryId, redirects)
  const [browseFilters, setBrowseFilters] = useState(emptyFilters)
  const [dinnerFilters, setDinnerFilters] = useState(emptyFilters)
  const [mode, setMode] = useState<'grid' | 'list'>('grid')
  const [visitedBrowse, setVisitedBrowse] = useState(path === '/browse')
  const scrolls = useRef(new Map<string, number>())
  const previous = useRef<string | undefined>(undefined)
  const restore = useRef(false)
  const lastRoute = useRef(path)
  const tools = useMemo(() => ingredientTools(catalogue.ingredients), [catalogue])
  const basics = data.basics ?? defaultBasics
  const cooking = path.startsWith('/cook/')
  const discovering = path === '/browse'
  useEffect(() => {
    const old = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const change = () => {
      const next = route()
      const before = lastRoute.current
      if (before === next) return
      scrolls.current.set(before, window.scrollY)
      restore.current = before.startsWith('/recipe/') && !next.startsWith('/cook/')
      previous.current = before
      lastRoute.current = next
      setPath(next)
      if (next === '/browse') setVisitedBrowse(true)
    }
    window.addEventListener('hashchange', change)
    return () => { history.scrollRestoration = old; window.removeEventListener('hashchange', change) }
  }, [])
  useLayoutEffect(() => {
    window.scrollTo(0, restore.current ? scrolls.current.get(path) || 0 : 0)
    if (previous.current && !restore.current && !path.startsWith('/recipe/') && !path.startsWith('/cook/')) {
      const main = document.querySelector<HTMLElement>('main:not([hidden] *) h1')
      if (main) { main.tabIndex = -1; main.focus({ preventScroll: true }) }
    }
  }, [path])
  useEffect(() => {
    const slug = path.split('/')[2]
    const summary = catalogue.index.find(r => r.slug === (redirects.get(slug)?.slug ?? slug))
    document.title = summary ? summary.title + ' · What’s for Tea?' : 'What’s for Tea? · Your recipe library'
  }, [path, catalogue, redirects])
  const library = { catalogue, tools, saved: data.saved, onSave: (id: string) => setData(value => ({
    ...value, saved: value.saved.includes(id) ? value.saved.filter(item => item !== id) : [id, ...value.saved],
  })) }
  const dinner = { ...library, pantry: data.pantry, basics, setPantry: (pantry: UserData['pantry']) => setData(value => ({ ...value, pantry })), filters: dinnerFilters, setFilters: setDinnerFilters }
  const browseTheme = (theme?: string) => {
    scrolls.current.delete('/browse')
    setBrowseFilters(theme ? { ...emptyFilters, themes: [theme] } : emptyFilters)
    location.hash = '#/browse'
  }
  const recipeMatch = path.match(/^\/(recipe|cook)\/([a-z0-9-]+)$/)
  return <>
    <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); const main = [...document.querySelectorAll<HTMLElement>('main')].find(node => !node.closest('[hidden]')); if (main) { main.tabIndex = -1; main.focus(); main.scrollIntoView() } }}>Skip to content</a>
    {!cooking && <Header path={path} />}
    {storageError && <p className="container storage-error" role="alert">This browser couldn’t save your changes. Keep the tab open to retain them during this visit.</p>}
    {visitedBrowse && <div hidden={!discovering}><Browse {...library} filters={browseFilters} setFilters={setBrowseFilters} mode={mode} setMode={setMode} /></div>}
    {path === '/' && <Today {...dinner} session={data.session} browseTheme={browseTheme} />}
    {path === '/pantry' && <Pantry {...dinner} />}
    {(path === '/saved' || path === '/saved/cooked') && <Saved {...library} cooked={data.cooked} history={path.endsWith('/cooked')} />}
    {path === '/settings' && <Settings catalogue={catalogue} data={data} setData={setData} />}
    {recipeMatch && <RecipeRoute key={recipeMatch[2]} slug={recipeMatch[2]} cooking={cooking} catalogue={catalogue} data={data} setData={setData} library={library} basics={basics}
      back={() => { if (previous.current && ['/', '/browse', '/pantry', '/saved', '/saved/cooked'].includes(previous.current)) history.back(); else location.hash = '#/browse' }} />}
    {!recipeMatch && !['/', '/browse', '/pantry', '/saved', '/saved/cooked', '/settings'].includes(path) && <main id="main" className="container page"><Empty title="That page could not be found"><a className="button secondary" href="#/">Back to Today</a></Empty></main>}
    {!cooking && <footer className="container site-footer"><div><Utensils size={17} /><span>What’s for Tea?</span></div><span>{catalogue.manifest.title} · Revision {catalogue.manifest.revision}</span><a href="#/settings">Settings</a></footer>}
  </>
}

function App() {
  const [catalogue, setCatalogue] = useState<Catalogue>()
  const [error, setError] = useState('')
  useEffect(() => { getCatalogue().then(setCatalogue, issue => setError(issue.message)) }, [])
  return catalogue ? <Site catalogue={catalogue} /> : <main className="container page">
    {error ? <Empty title="Couldn’t open the recipe library"><p>{error}</p><button className="button primary" onClick={() => location.reload()}>Try again</button></Empty> :
      <p role="status" className="loading"><Utensils size={21} /> Opening the recipe library…</p>}</main>
}

createRoot(document.getElementById('root')!).render(<App />)
