import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, Check, ChefHat, ClipboardList, Clock3, CookingPot, ExternalLink, List, Maximize2, Minus, Plus, Timer as TimerIcon, Users, X } from 'lucide-react'
import type { IngredientLine, Recipe, Step, TimeKey } from '../schema/v1.ts'
import { matchRequirements, timeText } from './matching.ts'
import { formatAmount, servingOptions, textAt, usable } from './portions.ts'
import type { Session, UserData } from './state.ts'
import { Empty, Panel, Photo, RecipeTags, cookLink, recipeLink, type IngredientTools } from './ui.tsx'
import { timeLabels, type LibraryProps } from './discover.tsx'

type CookingProps = LibraryProps & { recipe: Recipe; data: UserData; setData: Dispatch<SetStateAction<UserData>>; basics: string[] }
const variantOf = (recipe: Recipe, variant: string) => recipe.variants.find(item => item.id === variant) || recipe

function IngredientList({ lines, servings, checked, toggle }: { lines: IngredientLine[]; servings: number; checked?: string[]; toggle?: (line: string) => void }) {
  return <ul className="ingredient-list">{usable(lines, servings).map(line =>
    <li key={line.id}>
      {toggle ? <label className="check-label"><input type="checkbox" checked={checked?.includes(line.id) || false} onChange={() => toggle(line.id)} /><span>{line.label}{line.optional && <small>Optional</small>}</span></label> :
        <span>{line.label}{line.optional && <small>Optional</small>}</span>}
      <strong>{formatAmount(line, servings)}</strong>
    </li>)}</ul>
}

function StepText({ step, lines, servings }: { step: Step; lines: IngredientLine[]; servings: number }) {
  return <div className="step-text">{step.blocks.length > 1 ?
    <ol type="a">{step.blocks.map((block, i) => <li key={i}>{textAt(block, step, lines, servings)}</li>)}</ol> :
    <p>{textAt(step.blocks[0], step, lines, servings)}</p>}
    {step.notes.map(note => <p className="step-note" key={note}>{textAt(note, step, lines, servings)}</p>)}
  </div>
}

function Portions({ recipe, servings, setServings, variant, setVariant }: {
  recipe: Recipe; servings: number; setServings: (value: number) => void; variant: string; setVariant: (value: string) => void
}) {
  const options = servingOptions(recipe)
  const i = options.indexOf(servings)
  return <div className="portion-row"><div className="portion-control"><Users size={19} />
    <div className="stepper">
      <button className="icon-button" aria-label="Fewer servings" disabled={i <= 0} onClick={() => setServings(options[i - 1])}><Minus size={17} /></button>
      <label>Servings <select value={servings} onChange={event => setServings(Number(event.target.value))}>
        {options.map(size => <option value={size} key={size}>{size}</option>)}
      </select></label>
      <button className="icon-button" aria-label="More servings" disabled={i === options.length - 1} onClick={() => setServings(options[i + 1])}><Plus size={17} /></button>
    </div></div>
    {recipe.variants.length > 0 && <label className="variant-select">Card variant <select value={variant} onChange={event => setVariant(event.target.value)}>
      <option value="base">Original card</option>{recipe.variants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>}
    {!recipe.servings.includes(servings) && <p className="portion-note">Calculated portions. Use batches if your pan or tray is crowded.</p>}
  </div>
}

export function RecipePage({ recipe, catalogue, data, setData, tools, saved, onSave, basics, back }: CookingProps & { back: () => void }) {
  const session = data.session?.recipeId === recipe.id ? data.session : null
  const [previewServings, setPreviewServings] = useState(recipe.defaultServings)
  const [previewVariant, setPreviewVariant] = useState('base')
  const servings = session && servingOptions(recipe).includes(session.servings) ? session.servings : previewServings
  const variant = session?.variant ?? previewVariant
  const [copy, setCopy] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [expanded, setExpanded] = useState<Step>()
  const current = variantOf(recipe, variant)
  const lines = usable(current.ingredients, servings)
  const required = lines.filter(line => !line.optional)
  const match = matchRequirements(required.map(line => line.ingredientId), data.pantry, basics, tools)
  const isSaved = saved.includes(recipe.id)
  const setServings = (size: number) => {
    setPreviewServings(size)
    setCopy('')
    if (session) setData(value => value.session?.recipeId === recipe.id
      ? { ...value, session: { ...value.session, servings: size, ingredients: [] } } : value)
  }
  const setVariant = (id: string) => {
    setPreviewVariant(id)
    setCopy('')
    if (session) setData(value => value.session?.recipeId === recipe.id
      ? { ...value, session: { ...value.session, variant: id, ingredients: [], timers: [] } } : value)
  }
  const start = () => {
    const session: Session = { recipeId: recipe.id, slug: recipe.slug, servings, variant, step: null, ingredients: [], equipment: [], timers: [] }
    setData(value => ({ ...value, session }))
    location.hash = cookLink(recipe.slug)
  }
  const missing = required.filter(line => match.missing.includes(line.ingredientId))
  const copyMissing = async () => {
    const copied = [...new Set(missing.map(line => `${line.label} · ${formatAmount(line, servings)}`))].join('\n')
    try { await navigator.clipboard.writeText(copied); setCopy('Missing ingredients copied.') }
    catch { setCopy(copied) }
  }
  return <main id="main" className="container page recipe-page">
    <button className="text-button back-link" onClick={back}><ArrowLeft size={18} /> Back to recipes</button>
    <section className="recipe-hero">
      <div className="recipe-hero-photo"><Photo asset={recipe.hero} catalogue={catalogue} title={recipe.title} theme={recipe.themes[0]} eager sizes="(max-width: 800px) 100vw, 640px" /></div>
      <div className="recipe-hero-copy"><span className="eyebrow"><span className="short-rule" /> {recipe.provider} {recipe.source.edition && `· ${recipe.source.edition}`}</span>
        <h1>{recipe.title}</h1>{recipe.subtitle && <p className="recipe-subtitle">{recipe.subtitle}</p>}
        {recipe.description && <p>{recipe.description}</p>}
        <div className="timing-row">{(['prep', 'cook', 'total'] as TimeKey[]).map(key => <div key={key}><small>{timeLabels[key]}</small><strong>{recipe.timings[key] ? timeText(recipe.timings[key]!) : 'Unknown'}</strong></div>)}
          {recipe.timings.card && <div><small>Card time</small><strong>{timeText(recipe.timings.card)}</strong></div>}</div>
        <div className="recipe-actions">
          {session ? <a className="button primary" href={cookLink(recipe.slug)}><ChefHat size={19} /> Resume cooking</a> :
            <button className="button primary" onClick={() => data.session ? setConfirm(true) : start()}><ChefHat size={19} /> Start cooking</button>}
          <button className="button secondary" aria-pressed={isSaved} onClick={() => onSave(recipe.id)}><Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Saved' : 'Save recipe'}</button>
        </div>
      </div>
    </section>
    <div className="recipe-detail">
      <section className="recipe-ingredients"><h2>Ingredients</h2>
        <Portions recipe={recipe} servings={servings} setServings={setServings} variant={variant} setVariant={setVariant} />
        {data.pantry.length ? <>
          <p className="muted"><strong>Check quantities.</strong> Pantry match for {servings}.</p>
          {[
            ['In your pantry', required.filter(line => match.matched.includes(line.ingredientId))],
            ['Still needed', missing],
            ['Cupboard basics', required.filter(line => match.assumed.includes(line.ingredientId))],
            ['Optional', lines.filter(line => line.optional)],
          ].map(([heading, group]) => <div key={heading as string}><h3>{heading as string}</h3>
            {(group as IngredientLine[]).length > 0 ? <IngredientList lines={group as IngredientLine[]} servings={servings} /> : <p className="muted">None.</p>}</div>)}
          {missing.length > 0 && <button className="button secondary" onClick={copyMissing}><ClipboardList size={17} /> Copy missing ingredients</button>}
          {copy && <p className="copy-result" role="status">{copy}</p>}
        </> : <>
          <h3>In the box</h3><IngredientList lines={lines.filter(line => line.group === 'box')} servings={servings} />
          {lines.some(line => line.group === 'bring') && <><h3>Bring your own</h3><IngredientList lines={lines.filter(line => line.group === 'bring')} servings={servings} /></>}
        </>}
        {(recipe.seasons?.length || recipe.themes.length) ? <div className="recipe-note"><h3>Tags</h3><RecipeTags recipe={recipe} /></div> : null}
        {recipe.equipment.length > 0 && <div className="recipe-note"><h3>Equipment</h3><p>{recipe.equipment.join(', ')}</p></div>}
        {(recipe.allergens.length > 0 || recipe.cautions.length > 0) && <div className="recipe-note"><h3>Allergens and cautions</h3>
          {recipe.allergens.length > 0 && <p><strong>{recipe.allergens.join(', ')}</strong></p>}
          {recipe.cautions.map(note => <p key={note}>{note}</p>)}</div>}
        <div className="recipe-note"><h3>Source</h3><p>{recipe.source.label}{recipe.source.edition && ` · ${recipe.source.edition}`}</p>
          {recipe.hero && <p>Photo credit · {recipe.hero.credit}</p>}
          {recipe.source.url && <a href={recipe.source.url} target="_blank" rel="noreferrer">Original provider recipe <ExternalLink size={14} /></a>}</div>
      </section>
      <section className="recipe-method"><div className="method-heading"><h2>Method</h2><span>{current.steps.length} steps</span></div>
        {recipe.before.map(note => <p key={note} className="step-note">{note}</p>)}
        <ol className="method-list">{current.steps.map(step => <li key={step.id}><div className="method-number" aria-hidden>{String(step.number).padStart(2, '0')}</div>
          <div className="method-step"><h3>{step.heading || `Step ${step.number}`}</h3><StepText step={step} lines={current.ingredients} servings={servings} />
            {step.image && <button className="step-thumb" aria-label={`Enlarge image for step ${step.number}`} onClick={() => setExpanded(step)}><Photo asset={step.image} catalogue={catalogue} title={step.heading || `Step ${step.number}`} sizes="260px" /><Maximize2 size={17} /></button>}</div>
        </li>)}</ol>
      </section>
    </div>
    {expanded && <Panel title={expanded.heading || `Step ${expanded.number}`} wide onClose={() => setExpanded(undefined)}><div className="expanded-photo"><Photo asset={expanded.image} catalogue={catalogue} title={expanded.heading || recipe.title} eager sizes="90vw" /></div></Panel>}
    {confirm && <Panel title="Start a new cooking session?" onClose={() => setConfirm(false)}><p>This will replace your current session and its timers.</p>
      <div className="filter-footer"><button className="button secondary" onClick={() => setConfirm(false)}>Cancel</button><button className="button primary" onClick={start}>Start cooking</button></div></Panel>}
  </main>
}

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function useWakeLock() {
  const [on, setOn] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    if (!on || !navigator.wakeLock) return
    let wake: WakeLockSentinel | undefined
    let disposed = false
    let pending = false
    async function acquire() {
      if (pending || wake && !wake.released || document.visibilityState !== 'visible') return
      pending = true
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (disposed) await lock.release()
        else { wake = lock; setUnavailable(false) }
      } catch { if (!disposed) setUnavailable(true) }
      finally { pending = false }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => { disposed = true; document.removeEventListener('visibilitychange', acquire); void wake?.release().catch(() => {}) }
  }, [on])
  return { supported: Boolean(navigator.wakeLock), on, setOn, unavailable }
}

export function CookMode({ recipe, catalogue, data, setData }: CookingProps) {
  const session = data.session?.recipeId === recipe.id ? data.session : null
  const [dialog, setDialog] = useState<'ingredients' | 'jump' | 'photo' | 'replace'>()
  const [now, setNow] = useState(Date.now)
  const heading = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  const wake = useWakeLock()
  const current = variantOf(recipe, session?.variant || 'base')
  const steps = current.steps
  const currentStep = steps.findIndex(step => step.id === session?.step)
  const step = steps[currentStep]
  const servings = session && servingOptions(recipe).includes(session.servings) ? session.servings : recipe.defaultServings
  const hasTimers = Boolean(session?.timers.length)
  useEffect(() => {
    if (!hasTimers) return
    const tick = () => setNow(Date.now())
    tick()
    const interval = setInterval(tick, 500)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick) }
  }, [hasTimers])
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    window.scrollTo(0, 0)
    heading.current?.focus()
  }, [currentStep])
  useEffect(() => {
    const image = steps[currentStep + 1]?.image
    if (!step || !image || !('requestIdleCallback' in window)) return
    const idle = window.requestIdleCallback(() => { const next = new Image(); next.src = catalogue.media(image.path) })
    return () => window.cancelIdleCallback(idle)
  }, [step, steps, currentStep, catalogue])
  const start = () => {
    setData(value => ({ ...value, session: { recipeId: recipe.id, slug: recipe.slug, servings: recipe.defaultServings, variant: 'base', step: null, ingredients: [], equipment: [], timers: [] } }))
    setDialog(undefined)
  }
  const change = (update: (value: Session) => Session) => setData(value => value.session?.recipeId === recipe.id ? { ...value, session: update(value.session) } : value)
  const go = (position: number) => { change(value => ({ ...value, step: steps[position]?.id || null })); setDialog(undefined) }
  const toggle = (field: 'ingredients' | 'equipment', key: string) => change(value => ({ ...value,
    [field]: value[field].includes(key) ? value[field].filter(item => item !== key) : [...value[field], key],
  }))
  const finish = () => {
    setData(value => ({ ...value, cooked: [{ id: recipe.id, date: new Date().toISOString() }, ...value.cooked.filter(c => c.id !== recipe.id)].slice(0, 100), session: null }))
    location.hash = '#/saved/cooked'
  }
  if (!session) return <main id="main" className="container page"><Empty title="Start cooking">
    <p>{recipe.title}</p><button className="button primary" onClick={() => data.session ? setDialog('replace') : start()}>Start cooking</button>
    <a href={recipeLink(recipe.slug)} className="text-button">View recipe</a></Empty>
    {dialog === 'replace' && <Panel title="Replace your current session?" onClose={() => setDialog(undefined)}><p>Your current progress and timers will be cleared.</p>
      <div className="filter-footer"><button className="button secondary" onClick={() => setDialog(undefined)}>Cancel</button><button className="button primary" onClick={start}>Start cooking</button></div></Panel>}</main>
  return <main id="main" className={`cook-mode ${data.largeType ? 'large-type' : ''}`}>
    <div className="cook-top"><div className="cook-toolbar">
      <a className="text-button" href={recipeLink(recipe.slug)}><ArrowLeft size={18} /> Recipe</a>
      <span className="cook-title">{recipe.title}</span>
      <button className="button secondary" aria-pressed={data.largeType} onClick={() => setData(value => ({ ...value, largeType: !value.largeType }))}>Aa<span className="optional-copy"> Large type</span></button>
    </div><progress value={currentStep + 1} max={steps.length} aria-label="Cooking progress" /></div>
    <div className="cook-content">
      <div className="cook-utility"><span className="eyebrow"><ChefHat size={17} /> Cook Mode · {servings} servings</span>
        <div><button className="button secondary" onClick={() => setDialog('ingredients')}><ClipboardList size={17} /> Ingredients</button>
          <button className="button secondary" onClick={() => setDialog('jump')}><List size={18} /> Steps</button></div></div>
      {hasTimers && <section className="timers" aria-label="Cooking timers">
        {session.timers.map(timer => { const seconds = Math.max(0, Math.ceil((timer.ends - now) / 1000)); return <div className={seconds ? 'timer' : 'timer expired'} key={timer.id}>
          <TimerIcon size={18} /><span><strong>{timer.label}</strong><span>{seconds ? clock(seconds) : 'Time’s up'}</span></span>
          <button className="icon-button" aria-label={`Remove ${timer.label} timer`} onClick={() => change(s => ({ ...s, timers: s.timers.filter(t => t.id !== timer.id) }))}><X size={16} /></button>
        </div> })}
      </section>}
      {step ? <section className={`cook-step ${step.image ? 'with-image' : ''}`}>
        <div><div className="step-index"><strong>{String(step.number).padStart(2, '0')}</strong><span>of {String(steps.length).padStart(2, '0')}</span></div>
          <h1 ref={heading} tabIndex={-1}>{step.heading || `Step ${step.number}`}</h1><StepText step={step} lines={current.ingredients} servings={servings} />
          {step.timers.map(timer => <div key={timer.id} className="timer-options">{timer.seconds.map(seconds => <button className="button secondary" key={seconds}
            disabled={session.timers.some(t => t.id === step.id + ':' + timer.id)}
            onClick={() => { const currentTime = Date.now(); setNow(currentTime); change(s => s.timers.some(t => t.id === step.id + ':' + timer.id) ? s :
              { ...s, timers: [...s.timers, { id: step.id + ':' + timer.id, label: timer.label, ends: currentTime + seconds * 1000 }] }) }}>
              <Clock3 size={17} /> {timer.label} · {seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`}</button>)}</div>)}
        </div>
        {step.image && <button className="cook-photo" aria-label="Enlarge step image" onClick={() => setDialog('photo')}><Photo asset={step.image} catalogue={catalogue} title={step.heading || recipe.title} eager sizes="(max-width: 800px) 100vw, 440px" /><Maximize2 size={19} /></button>}
      </section> : <section className="before-start"><h1 ref={heading} tabIndex={-1}>Before you start</h1>
        <p>Set out your equipment and check the quantities for {servings}.</p>
        <Portions recipe={recipe} servings={servings} setServings={value => change(s => ({ ...s, servings: value, ingredients: [] }))} variant={session.variant}
          setVariant={value => change(s => ({ ...s, variant: value, ingredients: [], timers: [] }))} />
        {recipe.before.map(note => <p className="step-note" key={note}>{note}</p>)}
        <div className="before-grid"><div><h2>Equipment</h2>{recipe.equipment.map(item => <label className="check-label equipment" key={item}><input type="checkbox" checked={session.equipment.includes(item)} onChange={() => toggle('equipment', item)} />{item}</label>)}</div>
          <div><h2>Check quantities</h2><IngredientList lines={current.ingredients} servings={servings} checked={session.ingredients} toggle={id => toggle('ingredients', id)} /></div></div>
      </section>}
      {wake.supported ? <label className="check-label wake-control"><input type="checkbox" checked={wake.on} onChange={event => wake.setOn(event.target.checked)} /> Keep screen awake</label> :
        <p className="muted wake-control">Screen wake lock is unavailable in this browser.</p>}
      {wake.unavailable && <p className="muted" role="status">Your device couldn’t keep the screen awake right now.</p>}
    </div>
    <div className="cook-controls"><div>
      {step ? <button className="button secondary" onClick={() => go(currentStep - 1)}><ArrowLeft size={19} /> Back</button> : <a href={recipeLink(recipe.slug)} className="button secondary"><ArrowLeft size={19} /> Back</a>}
      <span>{step ? `Step ${step.number} of ${steps.length}` : `${steps.length} steps`}</span>
      {currentStep === steps.length - 1 ? <button className="button primary" onClick={finish}><Check size={19} /> Cooked it</button> :
        <button className="button primary" onClick={() => go(currentStep + 1)}>{step ? 'Next' : 'First step'} <ArrowRight size={19} /></button>}
    </div></div>
    {dialog === 'ingredients' && <Panel title={`Ingredients for ${servings}`} onClose={() => setDialog(undefined)}>
      <IngredientList lines={current.ingredients} servings={servings} checked={session.ingredients} toggle={id => toggle('ingredients', id)} /></Panel>}
    {dialog === 'jump' && <Panel title="Jump to a step" onClose={() => setDialog(undefined)}>
      <div className="jump-list"><button className="button secondary" aria-current={!step ? 'step' : undefined} onClick={() => go(-1)}>Before you start</button>
        {steps.map((target, i) => <button className="button secondary" aria-current={i === currentStep ? 'step' : undefined} key={target.id} onClick={() => go(i)}>{target.number}. {target.heading || 'Step'}</button>)}</div></Panel>}
    {dialog === 'photo' && step?.image && <Panel title={step.heading || 'Step image'} onClose={() => setDialog(undefined)} wide><div className="expanded-photo">
      <Photo asset={step.image} catalogue={catalogue} title={step.heading || recipe.title} eager sizes="90vw" /></div></Panel>}
  </main>
}
