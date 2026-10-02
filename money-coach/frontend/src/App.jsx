import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from './api/client'
import InflationPlanner from './InflationPlanner'
import './styles.css'

const NAV_ITEMS = [
  { id: 'overview', label: 'Home', icon: 'home' },
  { id: 'budget', label: 'Budget', icon: 'budget' },
  { id: 'goals', label: 'Goals', icon: 'goal' },
  { id: 'impact', label: 'Money impact', icon: 'impact' },
  { id: 'credit', label: 'Credit', icon: 'credit' },
]

const VIEW_LABELS = {
  overview: 'Your month',
  budget: 'Budget centre',
  goals: 'Savings goals',
  impact: 'Money impact',
  activity: 'Demo activity',
  credit: 'Credit preview',
}

const CHAT_STORAGE_KEY = 'khehla-chat'
const CHAT_MESSAGES_KEPT = 50
const HISTORY_TURNS_SENT = 8
const HISTORY_CHARS_SENT = 1000

function loadChat() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

const zar = (value) => `R${Number(value || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
const zarCents = (value) => `R${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const slugify = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)

function displayDate(value) {
  if (!value) return 'No date set'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short' }).format(date)
}

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5M9 21v-7h6v7" /></>,
    budget: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M7 9h10M7 13h3m4 0h3M7 17h2m3 0h5" /><path d="M7 5V3h10v2" /></>,
    goal: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    impact: <><path d="M3 17h4l3-9 4 12 3-8h4" /><path d="M3 21h18" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.6-.8L4 20l1.2-3.8A7.1 7.1 0 0 1 4 12c0-4.1 3.6-7.5 8-7.5s8 3.1 8 7Z" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    activity: <><path d="M3 12h4l3-7 4 14 3-7h4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    credit: <><path d="M4.5 18.5a9 9 0 1 1 15 0" /><path d="m12 13 4-4" /><circle cx="12" cy="13" r="1.5" /><path d="M6.4 16.6h.01M17.6 16.6h.01" /></>,
  }
  return <svg {...common}>{paths[name] || paths.home}</svg>
}

function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-heading">
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="page-description">{description}</p>}
    </div>
    {action}
  </div>
}

function SummaryCard({ label, value, detail, tone = 'default' }) {
  return <article className={`summary-card summary-${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {detail && <small>{detail}</small>}
  </article>
}

function BalanceCard({ summary, onNavigate }) {
  return <article className="summary-card summary-featured balance-card">
    <div className="balance-card-meta"><span>KHEHLA DEMO</span><span>THIS MONTH</span></div>
    <strong className="balance-amount">{zar(summary.remaining)}</strong>
    <p>after your recent activity</p>
    <button className="balance-action" type="button" onClick={() => onNavigate('activity')}>View activity <Icon name="arrow" size={14} /></button>
  </article>
}

function TransactionRow({ transaction }) {
  const inflow = transaction.transaction_type === 'income'
  const detail = `${transaction.merchant} · ${displayDate(transaction.occurred_at)}`
  const category = transaction.category.replaceAll('_', ' ')
  return <div className="activity-row">
    <span className={`activity-mark ${inflow ? 'activity-inflow' : ''}`}><Icon name={inflow ? 'arrow' : 'activity'} size={17} /></span>
    <span className="activity-copy"><strong>{transaction.merchant || category}</strong><small>{detail}</small></span>
    <strong className={inflow ? 'amount-positive' : 'amount-negative'}>{inflow ? '+' : '−'}{zar(transaction.amount)}</strong>
  </div>
}

function GoalCard({ goal, compact = false }) {
  const progress = Math.max(0, Math.min(100, Number(goal.progress_percent || 0)))
  return <article className={`goal-card ${compact ? 'goal-card-compact' : ''}`}>
    <div className="goal-card-heading">
      <div><span className="goal-kicker">{goal.priority === 'high' ? 'Top priority' : 'Savings goal'}</span><h3>{goal.name}</h3></div>
      <strong className="goal-percent">{Math.round(progress)}%</strong>
    </div>
    <div className="progress-track" role="progressbar" aria-label={`${goal.name} progress`} aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>
    <div className="goal-details"><span>{zar(goal.saved_amount)} saved of {zar(goal.target_amount)}</span><span>{zar(goal.remaining)} to go</span></div>
    <div className="goal-foot"><span><Icon name="calendar" size={14} /> {goal.deadline ? `Due ${displayDate(goal.deadline)}` : 'No deadline'}</span>{goal.days_remaining > 0 && <span>{goal.days_remaining} days</span>}</div>
  </article>
}

function Onboarding({ initial, onSave, saving, error }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState(initial.profile?.name || 'Grace')
  const [income, setIncome] = useState(String(initial.profile?.monthly_income || ''))
  const [categories, setCategories] = useState(initial.categories || [])
  const total = categories.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const remaining = Number(income || 0) - total

  function save() {
    onSave({
      name: name.trim(),
      monthly_income: Number(income),
      categories: categories.map((row) => ({ ...row, amount: Number(row.amount || 0) })),
    })
  }

  return <main className="onboarding-shell">
    <div className="onboarding-brand"><span className="brand-mark">K</span><strong>Khehla</strong><span className="demo-chip">Demo setup</span></div>
    <section className="onboarding-card">
      <div className="step-indicator"><span>STEP {step} OF 2</span><div><i className={step === 1 ? 'step-active' : 'step-done'} /><i className={step === 2 ? 'step-active' : ''} /></div></div>
      {step === 1 ? <>
        <p className="eyebrow">A plan that fits your month</p>
        <h1>Let’s set up your budget.</h1>
        <p className="onboarding-intro">Start with take-home income. You can adjust everything later.</p>
        <label className="field-label">What should we call you?<input value={name} onChange={(event) => setName(event.target.value)} maxLength="80" autoComplete="given-name" /></label>
        <label className="field-label">Monthly take-home income <span className="field-suffix">ZAR</span><input type="number" min="1" step="50" value={income} onChange={(event) => setIncome(event.target.value)} inputMode="decimal" /></label>
        <div className="privacy-note"><span className="privacy-dot" /><span>This demo saves your plan on this app’s local database.</span></div>
        <button className="button-primary button-full" type="button" onClick={() => setStep(2)} disabled={!name.trim() || Number(income) <= 0}>Continue <Icon name="arrow" size={17} /></button>
      </> : <>
        <p className="eyebrow">Monthly plan</p>
        <h1>Give your money a place to go.</h1>
        <p className="onboarding-intro">These starter amounts are editable. Add, rename, or remove categories.</p>
        <CategoryEditor categories={categories} onChange={setCategories} />
        <div className="plan-total"><span>Planned from {zar(income)}</span><strong>{zar(total)}</strong><small className={remaining < 0 ? 'text-warning' : ''}>{remaining < 0 ? `${zar(Math.abs(remaining))} over income` : `${zar(remaining)} left unassigned`}</small></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="onboarding-actions"><button className="button-secondary" type="button" onClick={() => setStep(1)} disabled={saving}>Back</button><button className="button-primary" type="button" onClick={save} disabled={saving || categories.length === 0}>{saving ? 'Saving…' : 'Save my plan'} <Icon name="check" size={17} /></button></div>
      </>}
    </section>
    <p className="onboarding-footer">Khehla helps you understand your money. Your plan stays editable.</p>
  </main>
}

function CategoryEditor({ categories, onChange, disabled = false }) {
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('0')
  const [error, setError] = useState('')

  function update(index, field, value) {
    onChange(categories.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: field === 'amount' ? value : value } : row))
  }

  function addCategory(event) {
    event.preventDefault()
    const label = newLabel.trim()
    const category = slugify(label)
    if (!label || !category) return setError('Enter a category name.')
    if (categories.some((item) => item.category === category || item.label.toLowerCase() === label.toLowerCase())) return setError('That category is already in your plan.')
    onChange([...categories, { category, label, amount: Number(newAmount || 0) }])
    setNewLabel('')
    setNewAmount('0')
    setError('')
  }

  return <div className="category-editor">
    {categories.map((row, index) => <div className="editable-category" key={`${row.category}-${index}`}>
      <label className="sr-only" htmlFor={`budget-label-${row.category}-${index}`}>Category name</label>
      <input id={`budget-label-${row.category}-${index}`} className="category-name-input" value={row.label} maxLength="60" onChange={(event) => update(index, 'label', event.target.value)} disabled={disabled} />
      <label className="sr-only" htmlFor={`budget-amount-${row.category}-${index}`}>Monthly amount for {row.label}</label>
      <span className="amount-input-wrap"><span>R</span><input id={`budget-amount-${row.category}-${index}`} type="number" min="0" step="50" value={row.amount} onChange={(event) => update(index, 'amount', event.target.value)} disabled={disabled} inputMode="decimal" /></span>
      <button className="icon-button remove-row" type="button" aria-label={`Remove ${row.label}`} onClick={() => onChange(categories.filter((_, rowIndex) => rowIndex !== index))} disabled={disabled}><Icon name="close" size={16} /></button>
    </div>)}
    <form className="add-category-form" onSubmit={addCategory}>
      <label className="sr-only" htmlFor="new-category-name">New category name</label><input id="new-category-name" placeholder="Add a category" value={newLabel} maxLength="60" onChange={(event) => setNewLabel(event.target.value)} disabled={disabled} />
      <label className="sr-only" htmlFor="new-category-amount">Monthly amount</label><span className="amount-input-wrap"><span>R</span><input id="new-category-amount" type="number" min="0" step="50" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} disabled={disabled} inputMode="decimal" /></span>
      <button className="icon-button add-row" type="submit" aria-label="Add budget category" disabled={disabled}><Icon name="plus" size={17} /></button>
    </form>
    {error && <p className="form-error compact-error" role="alert">{error}</p>}
  </div>
}

function Overview({ dashboard, transactions, onNavigate, impact, onOpenCoach }) {
  const summary = dashboard.financial_summary
  const goal = dashboard.goal
  const spending = Object.entries(dashboard.spending_by_category || {}).sort((a, b) => b[1] - a[1]).slice(0, 4)
  return <>
    <PageHeader eyebrow="" title="Move money. Make room." description="Your everyday money, in one place." />
    <section className="snapshot-grid">
      <BalanceCard summary={summary} onNavigate={onNavigate} />
    </section>
    <section className="quick-tools" aria-labelledby="quick-tools-title">
      <div className="section-heading quick-tools-heading"><div><h2 id="quick-tools-title">What do you need?</h2></div></div>
      <div className="quick-action-grid">
        <button className="quick-action" type="button" onClick={() => onNavigate('budget')}><span className="quick-action-icon"><Icon name="budget" size={17} /></span><span className="quick-action-title">Budget</span><span className="quick-action-caption">monthly plan</span></button>
        <button className="quick-action" type="button" onClick={() => onNavigate('goals')}><span className="quick-action-icon quick-action-sage"><Icon name="goal" size={17} /></span><span className="quick-action-title">Goals</span><span className="quick-action-caption">save steadily</span></button>
        <button className="quick-action" type="button" onClick={() => onNavigate('activity')}><span className="quick-action-icon quick-action-ink"><Icon name="activity" size={17} /></span><span className="quick-action-title">Activity</span><span className="quick-action-caption">recent history</span></button>
        <button className="quick-action" type="button" onClick={onOpenCoach}><span className="quick-action-icon quick-action-ink"><Icon name="chat" size={17} /></span><span className="quick-action-title">Khehla</span><span className="quick-action-caption">ask a question</span></button>
      </div>
    </section>
    <article className="insight-card">
      <div className="insight-copy"><p className="eyebrow">A DEMO SIGNAL TO NOTICE</p><h2>Khehla noticed something worth knowing.</h2><p>{impact?.description || 'Explore a simple estimate based on your demo plan.'}</p><button className="insight-action" type="button" onClick={() => onNavigate('impact')}>Take a look <Icon name="arrow" size={14} /></button></div>
      <span className="insight-watermark" aria-hidden="true">K</span>
    </article>
    <article className="credit-teaser">
      <span className="credit-teaser-icon"><Icon name="credit" size={19} /></span>
      <div className="credit-teaser-copy"><p className="eyebrow">CREDIT PREVIEW</p><h2>Credit, made clearer.</h2><p>Score and support options at a glance.</p></div>
      <button className="credit-teaser-button" type="button" onClick={() => onNavigate('credit')}>Preview <Icon name="arrow" size={15} /></button>
    </article>
    <section className="snapshot-grid secondary-metrics" aria-label="Monthly summary">
      <SummaryCard label="Income" value={zar(summary.income)} detail="Monthly take-home" />
      <SummaryCard label="Spent & sent" value={zar(summary.spent)} detail="Demo transaction totals" />
    </section>
    <section className="content-grid overview-grid">
      <article className="surface-card goal-overview-card">
        <div className="section-heading"><div><p className="eyebrow">YOUR PRIORITY</p><h2>Keep a goal moving</h2></div><button className="text-link" type="button" onClick={() => onNavigate('goals')}>All goals <Icon name="arrow" size={15} /></button></div>
        {goal ? <GoalCard goal={goal} compact /> : <p className="muted">Add a goal to get a simple savings pace.</p>}
      </article>
      <article className="surface-card">
        <div className="section-heading"><div><p className="eyebrow">THIS MONTH</p><h2>Where it went</h2></div><button className="text-link" type="button" onClick={() => onNavigate('budget')}>Your plan <Icon name="arrow" size={15} /></button></div>
        {spending.length ? <div className="spending-list">{spending.map(([category, amount]) => <div className="spending-row" key={category}><span>{category.replaceAll('_', ' ')}</span><strong>{zar(amount)}</strong></div>)}</div> : <p className="muted">No activity yet.</p>}
      </article>
      <article className="surface-card activity-card">
        <div className="section-heading"><div><p className="eyebrow">DEMO ACTIVITY</p><h2>Recent transactions</h2></div><button className="text-link" type="button" onClick={() => onNavigate('activity')}>See history <Icon name="arrow" size={15} /></button></div>
        <div className="activity-list">{transactions.slice(0, 4).map((transaction) => <TransactionRow transaction={transaction} key={transaction.id} />)}</div>
        <p className="demo-caption">Sample transactions stored in the demo database.</p>
      </article>
    </section>
  </>
}

function CreditPreview({ onOpenCoach, onNavigate, budget }) {
  const factors = [
    ['Payment history', 'Not connected'],
    ['Credit use', 'Not connected'],
    ['Report accuracy', 'No source'],
  ]
  const monthlyIncome = Number(budget.monthly_income || 0)
  const planned = Number(budget.total_planned ?? (budget.categories || []).reduce((sum, row) => sum + Number(row.amount || 0), 0))
  const unassigned = Number(budget.unassigned_income ?? monthlyIncome - planned)

  return <>
    <PageHeader eyebrow="CREDIT PREVIEW" title="Credit, made clearer." description="Score and next steps at a glance." action={<span className="demo-chip">Sample</span>} />
    <section className="credit-preview-grid" aria-label="Illustrative credit overview">
      <article className="credit-score-card">
        <div className="credit-score-heading"><div><p className="eyebrow">SAMPLE SCORE</p><h2>Credit snapshot</h2></div><span className="credit-sample-stamp">DEMO</span></div>
        <div className="credit-score-main">
          <div className="credit-score-ring" role="img" aria-label="Fictional sample score 612; no bureau data connected"><div className="credit-score-center"><strong>612</strong><span>demo only</span></div></div>
          <div className="credit-score-copy"><span className="credit-status-chip">Sample profile</span><h3>Know what shapes it.</h3><p>Needs a verified source and your consent.</p></div>
        </div>
        <p className="credit-score-footnote">Fictional score. No bureau data.</p>
      </article>
      <article className="surface-card credit-trend-card">
        <p className="eyebrow">SCORE TREND</p><h2>Track your score.</h2>
        <div className="credit-chart-placeholder" aria-hidden="true"><span className="credit-chart-label">Illustrative trend</span><svg viewBox="0 0 280 82" preserveAspectRatio="none"><path d="M4 64 C34 56 44 61 69 49 S104 52 128 36 S167 43 190 27 S229 32 276 10" /></svg><div className="credit-chart-axis"><span>Past</span><span>Now</span></div></div>
        <p className="credit-small-note">Sample art only.</p>
      </article>
    </section>

    <section className="surface-card credit-signals-card">
      <div className="section-heading"><div><p className="eyebrow">SCORE FACTORS</p><h2>Data needed</h2></div><span className="credit-not-connected">Not linked</span></div>
      <div className="credit-factor-list">{factors.map(([label, detail], index) => <div className="credit-factor-row" key={label}><span className="credit-factor-index">0{index + 1}</span><span className="credit-factor-copy"><strong>{label}</strong><small>{detail}</small></span><span className="credit-factor-status">—</span></div>)}</div>
      <p className="credit-small-note">Real checks need your consent and a named bureau.</p>
    </section>

    <section className="surface-card credit-budget-card" aria-label="Saved Budget Centre figures">
      <div className="credit-budget-heading"><div><p className="eyebrow">FROM BUDGET CENTRE</p><h2>Your plan</h2></div><button className="text-link" type="button" onClick={() => onNavigate('budget')}>Edit <Icon name="arrow" size={14} /></button></div>
      <div className="credit-budget-values"><div><span>Income</span><strong>{zar(monthlyIncome)}</strong></div><div><span>Planned</span><strong>{zar(planned)}</strong></div><div><span>Unassigned</span><strong>{zar(unassigned)}</strong></div></div>
    </section>

    <section className="surface-card credit-services-card">
      <div className="section-heading"><div><p className="eyebrow">MUKURU IDEAS</p><h2>Possible options</h2></div><span className="credit-not-connected">Not live</span></div>
      <div className="credit-service-list">
        <article className="credit-service-row"><span className="credit-service-icon"><Icon name="goal" size={18} /></span><div className="credit-service-copy"><strong>Funeral cover</strong><p>Example category. Terms unverified.</p></div><span className="credit-service-status">Preview only</span></article>
        <article className="credit-service-row"><span className="credit-service-icon credit-service-icon-dark"><Icon name="credit" size={18} /></span><div className="credit-service-copy"><strong>Borrowing</strong><p>Rates and eligibility aren't connected.</p></div><span className="credit-service-status">No live rate</span></article>
      </div>
      <p className="credit-small-note">Examples only—not offers.</p>
    </section>

    <section className="credit-support-card">
      <div><p className="eyebrow">NEED SUPPORT?</p><h2>Plan ahead.</h2><p>Review your budget with Khehla.</p></div>
      <button className="button-primary" type="button" onClick={onOpenCoach}>Talk to Khehla <Icon name="arrow" size={15} /></button>
    </section>
    <p className="credit-preview-disclaimer">Demo only · no bureau checks, offers, or rates.</p>
  </>
}

function BudgetView({ budget, name, onSave, saving, error }) {
  const [income, setIncome] = useState(String(budget.monthly_income || ''))
  const [categories, setCategories] = useState(budget.categories || [])
  const [savedMessage, setSavedMessage] = useState('')
  const total = categories.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const remaining = Number(income || 0) - total

  useEffect(() => {
    setIncome(String(budget.monthly_income || ''))
    setCategories(budget.categories || [])
  }, [budget])

  async function savePlan() {
    setSavedMessage('')
    const rows = categories.map((row) => ({ ...row, amount: Number(row.amount || 0) }))
    const slugSet = new Set(rows.map((row) => row.category))
    if (slugSet.size !== rows.length) return setSavedMessage('Each category needs a unique name.')
    const labelSet = new Set(rows.map((row) => row.label.trim().toLowerCase()))
    if (labelSet.size !== rows.length || rows.some((row) => !row.label.trim())) return setSavedMessage('Category names must be unique and non-empty.')
    const success = await onSave({ name, monthly_income: Number(income), categories: rows })
    if (success) setSavedMessage('Budget saved.')
  }

  return <>
    <PageHeader eyebrow="YOUR PLAN" title="Budget centre" description="Set category amounts that fit your income. Change them whenever you need." />
    <section className="content-grid budget-grid">
      <article className="surface-card budget-editor-card">
        <div className="section-heading"><div><p className="eyebrow">MONTHLY TAKE-HOME</p><h2>Plan your month</h2></div><span className="saved-tag"><Icon name="check" size={14} /> Saved on this app</span></div>
        <label className="field-label">Monthly income <span className="field-suffix">ZAR</span><input type="number" min="1" step="50" value={income} onChange={(event) => setIncome(event.target.value)} inputMode="decimal" /></label>
        <div className="editor-heading"><h3>Monthly category amounts</h3><span>{categories.length} categories</span></div>
        <CategoryEditor categories={categories} onChange={setCategories} disabled={saving} />
        <div className="plan-total plan-total-inline"><span>Assigned</span><strong>{zar(total)}</strong><small className={remaining < 0 ? 'text-warning' : ''}>{remaining < 0 ? `${zar(Math.abs(remaining))} over income` : `${zar(remaining)} left unassigned`}</small></div>
        {(error || savedMessage) && <p className={error ? 'form-error' : 'success-note'} role="status">{error || savedMessage}</p>}
        <button className="button-primary button-save" type="button" onClick={savePlan} disabled={saving || Number(income) <= 0 || categories.length === 0}>{saving ? 'Saving…' : 'Save budget'} <Icon name="check" size={17} /></button>
      </article>
      <aside className="surface-card budget-side-card">
        <p className="eyebrow">HOW IT LOOKS TODAY</p><h2>Plan vs. demo activity</h2><p className="muted">Your plan is a guide. The demo transaction history is separate from planned amounts.</p>
        <div className="comparison-list">{categories.map((row) => {
          const actual = Number(budget.actual_spending?.[row.category] || 0)
          const planned = Number(row.amount || 0)
          const width = planned ? Math.min(actual / planned * 100, 100) : (actual ? 100 : 0)
          return <div className="comparison-item" key={row.category}><div><span>{row.label}</span><b>{zar(actual)} <small>of {zar(planned)}</small></b></div><div className="progress-track"><span style={{ width: `${width}%` }} /></div></div>
        })}</div>
        <p className="demo-caption">Actual totals come from the seeded SQLite ledger and are for demonstration only.</p>
      </aside>
    </section>
  </>
}

function GoalsView({ goals, onCreate, creating, error }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', target_amount: '', saved_amount: '0', deadline: '', priority: 'normal' })

  async function submit(event) {
    event.preventDefault()
    const success = await onCreate({ ...form, target_amount: Number(form.target_amount), saved_amount: Number(form.saved_amount || 0), deadline: form.deadline || null })
    if (success) {
      setShowForm(false)
      setForm({ name: '', target_amount: '', saved_amount: '0', deadline: '', priority: 'normal' })
    }
  }

  return <>
    <PageHeader eyebrow="WHAT MATTERS TO YOU" title="Savings goals" description="Make progress visible, one manageable step at a time." action={<button className="button-primary" type="button" onClick={() => setShowForm(true)}><Icon name="plus" size={17} /> New goal</button>} />
    {error && !showForm && <p className="form-error" role="alert">{error}</p>}
    <section className="goal-grid">{goals.map((goal) => <GoalCard goal={goal} key={goal.id} />)}</section>
    {goals.length === 0 && <article className="surface-card empty-state"><span className="empty-icon"><Icon name="goal" size={22} /></span><h2>Start with one goal</h2><p>Choose something important and set a target that feels possible.</p><button className="button-primary" type="button" onClick={() => setShowForm(true)}>Create a goal</button></article>}
    {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false) }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title"><div className="modal-heading"><div><p className="eyebrow">NEW SAVINGS GOAL</p><h2 id="goal-modal-title">What are you saving for?</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setShowForm(false)}><Icon name="close" /></button></div>
      <form className="goal-form" onSubmit={submit}>
        <label className="field-label">Goal name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength="2" maxLength="80" required placeholder="For example, school fees" /></label>
        <div className="form-row"><label className="field-label">Target amount (R)<input type="number" min="1" step="1" value={form.target_amount} onChange={(event) => setForm({ ...form, target_amount: event.target.value })} required inputMode="decimal" /></label><label className="field-label">Already saved (R)<input type="number" min="0" step="1" value={form.saved_amount} onChange={(event) => setForm({ ...form, saved_amount: event.target.value })} inputMode="decimal" /></label></div>
        <label className="field-label">Target date <span className="optional-label">Optional</span><input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
        <label className="field-label">Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="normal">Regular</option><option value="high">Important</option><option value="low">Flexible</option></select></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="button-secondary" type="button" onClick={() => setShowForm(false)} disabled={creating}>Cancel</button><button className="button-primary" type="submit" disabled={creating}>{creating ? 'Saving…' : 'Save goal'} <Icon name="check" size={17} /></button></div>
      </form>
    </section></div>}
  </>
}

function MoneyImpactView({ impact }) {
  return <>
    <PageHeader eyebrow="PERSONAL ESTIMATES" title="Money impact" description="Explore how wider changes could affect your own plan." />
    <section className="impact-view-grid">
      <article className="impact-feature-card"><div className="impact-feature-top"><span className="impact-symbol"><Icon name="impact" size={20} /></span><span className="demo-chip">Demo scenario</span></div><p className="eyebrow">A CHANGE TO WATCH</p><h2>{impact?.title || 'Fuel-cost scenario'}</h2><p>{impact?.description || 'This estimate uses the sample transport activity.'}</p><strong className="impact-amount">{zar(impact?.estimated_monthly_impact)}<small> / month</small></strong><small className="estimate-disclaimer">Estimate only. The 10% change is sample context, not a live price or forecast.</small></article>
      <article className="impact-choices"><p className="eyebrow">POSSIBLE NEXT STEPS</p><h2>Keep the plan flexible.</h2><p>Choose a small adjustment that protects what matters most to you.</p><ul><li>Check transport spending against your plan.</li><li>Keep family support visible in your budget.</li><li>Review your goal before changing essentials.</li></ul></article>
    </section>
    <InflationPlanner />
  </>
}

function ActivityView({ transactions }) {
  return <>
    <PageHeader eyebrow="SAMPLE DATA" title="Transaction history" description="A hard-coded demo ledger is stored in SQLite and served by the API." />
    <article className="surface-card full-activity-card"><div className="section-heading"><div><p className="eyebrow">RECENT ITEMS</p><h2>Demo transactions</h2></div><span className="demo-chip">Not real bank data</span></div>
      <div className="activity-list">{transactions.map((transaction) => <TransactionRow transaction={transaction} key={transaction.id} />)}</div>
      <p className="demo-caption">These sample rows power the demo totals and linked notification examples. They are not connected to a bank.</p>
    </article>
  </>
}

function Drawer({ title, onClose, children, side = 'right' }) {
  return <div className="drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className={`drawer drawer-${side}`} role="dialog" aria-modal="true" aria-label={title}><div className="drawer-header"><h2>{title}</h2><button className="icon-button" type="button" aria-label={`Close ${title}`} onClick={onClose}><Icon name="close" /></button></div>{children}</aside>
  </div>
}

function MenuDrawer({ activeView, onNavigate, onClose, unreadCount }) {
  return <Drawer title="Menu" onClose={onClose} side="left">
    <div className="menu-user"><span className="menu-avatar">K</span><span><strong>Khehla</strong><small>Money, made simpler</small></span></div>
    <nav className="menu-links" aria-label="Main menu">{NAV_ITEMS.map((item) => <button className={activeView === item.id ? 'menu-link menu-link-active' : 'menu-link'} key={item.id} type="button" onClick={() => onNavigate(item.id)}><Icon name={item.icon} /><span>{item.label}</span><Icon name="arrow" size={15} /></button>)}
      <button className={activeView === 'activity' ? 'menu-link menu-link-active' : 'menu-link'} type="button" onClick={() => onNavigate('activity')}><Icon name="activity" /><span>Transaction history</span><Icon name="arrow" size={15} /></button>
    </nav>
    <div className="menu-section"><p className="eyebrow">YOUR INBOX</p><button className="menu-link" type="button" onClick={() => onNavigate('notifications')}><Icon name="bell" /><span>Notifications</span>{unreadCount > 0 && <b className="menu-count">{unreadCount}</b>}</button></div>
    <div className="menu-footnote"><strong>Demo workspace</strong><span>Budget plans and goals are saved in the local SQLite database. Activity is synthetic sample data.</span></div>
  </Drawer>
}

function NotificationsDrawer({ items, unreadCount, onRead, onClose }) {
  return <Drawer title="Notifications" onClose={onClose}>
    <div className="notification-intro"><span>{unreadCount} unread</span><small>Examples from the demo database.</small></div>
    <div className="notification-list">{items.map((item) => <article className={`notification-item ${item.is_read ? 'notification-read' : ''}`} key={item.id}>
      <span className={`notification-kind kind-${item.kind}`}><Icon name={item.kind === 'goal' ? 'goal' : item.kind === 'transaction' ? 'activity' : 'impact'} size={17} /></span>
      <div className="notification-copy"><div className="notification-title"><strong>{item.title}</strong>{!item.is_read && <i aria-label="Unread" />}</div><p>{item.body}</p><small>{displayDate(item.created_at)}</small>{!item.is_read && <button className="text-link mark-read" type="button" onClick={() => onRead(item.id)}>Mark as read</button>}</div>
    </article>)}
    {items.length === 0 && <div className="empty-inbox"><Icon name="bell" size={24} /><p>You’re all caught up.</p></div>}</div>
  </Drawer>
}

function CoachPanel({ messages, question, setQuestion, sending, onSubmit, onClear, onClose, logRef }) {
  return <div className="coach-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="coach-panel" role="dialog" aria-modal="true" aria-labelledby="coach-title">
      <header className="coach-header"><span className="coach-avatar">K</span><span><strong>Khehla</strong><small>Money coach · demo</small></span><button className="icon-button" type="button" aria-label="Close Coach" onClick={onClose}><Icon name="close" /></button></header>
      <div className="coach-log" ref={logRef} aria-live="polite">
        <div className="coach-welcome"><p className="eyebrow">HERE TO HELP</p><h2 id="coach-title">What would you like to understand?</h2><p>Ask about your budget, goals, spending, or a what-if scenario.</p></div>
        {messages.map((message, index) => <div key={index} className={`chat-message chat-${message.role}`}><p>{message.content}</p>{message.actions?.length > 0 && <ul>{message.actions.map((action) => <li key={action}>{action}</li>)}</ul>}{message.disclaimer && <small>{message.disclaimer}</small>}</div>)}
        {sending && <div className="chat-message chat-assistant chat-typing">Khehla is thinking…</div>}
      </div>
      <form className="coach-compose" onSubmit={onSubmit}><label className="sr-only" htmlFor="coach-question">Your question</label><input id="coach-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a money question" disabled={sending} autoFocus /><button className="send-button" type="submit" aria-label="Send question" disabled={sending || !question.trim()}><Icon name="arrow" size={18} /></button></form>
      {messages.length > 0 && <button className="text-link clear-chat" type="button" onClick={onClear} disabled={sending}>Clear this chat on this device</button>}
      <p className="coach-disclaimer">Educational support, not financial advice.</p>
    </section>
  </div>
}

export default function App() {
  const [activeView, setActiveView] = useState(() => new URLSearchParams(window.location.search).get('preview') === 'credit' ? 'credit' : 'overview')
  const [onboarding, setOnboarding] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [budget, setBudget] = useState({ categories: [] })
  const [goals, setGoals] = useState([])
  const [transactions, setTransactions] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [impact, setImpact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingPlan, setSavingPlan] = useState(false)
  const [creatingGoal, setCreatingGoal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState(loadChat)
  const [sending, setSending] = useState(false)
  const coachLogRef = useRef(null)

  const refreshData = useCallback(async () => {
    const [onboardingData, dashboardData, budgetData, goalsData, activityData, notificationData, impactData] = await Promise.all([
      apiRequest('/api/onboarding'),
      apiRequest('/api/dashboard'),
      apiRequest('/api/budget'),
      apiRequest('/api/goals'),
      apiRequest('/api/transactions?limit=50'),
      apiRequest('/api/notifications'),
      apiRequest('/api/money-impact'),
    ])
    setOnboarding(onboardingData)
    setDashboard(dashboardData)
    setBudget(budgetData)
    setGoals(goalsData.goals || [])
    setTransactions(activityData.transactions || [])
    setNotifications(notificationData.notifications || [])
    setUnreadCount(notificationData.unread_count || 0)
    setImpact(impactData.cards?.[0] || null)
  }, [])

  useEffect(() => {
    let mounted = true
    refreshData().catch((error) => { if (mounted) setPageError(error.message || 'Could not load the demo app.') }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [refreshData])

  useEffect(() => {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-CHAT_MESSAGES_KEPT))) } catch { /* device storage may be disabled */ }
    if (coachLogRef.current) coachLogRef.current.scrollTop = coachLogRef.current.scrollHeight
  }, [messages, sending, coachOpen])

  async function submitOnboarding(payload) {
    setSavingPlan(true)
    setActionError('')
    try {
      await apiRequest('/api/onboarding', { method: 'PUT', body: JSON.stringify(payload) })
      await refreshData()
      setActiveView('overview')
      return true
    } catch (error) {
      setActionError(error.message || 'Could not save your plan.')
      return false
    } finally {
      setSavingPlan(false)
    }
  }

  async function saveBudget(payload) {
    setSavingPlan(true)
    setActionError('')
    try {
      await apiRequest('/api/budget', { method: 'PUT', body: JSON.stringify(payload) })
      await refreshData()
      return true
    } catch (error) {
      setActionError(error.message || 'Could not save your budget.')
      return false
    } finally {
      setSavingPlan(false)
    }
  }

  async function createGoal(payload) {
    setCreatingGoal(true)
    setActionError('')
    try {
      await apiRequest('/api/goals', { method: 'POST', body: JSON.stringify(payload) })
      await refreshData()
      return true
    } catch (error) {
      setActionError(error.message || 'Could not save your goal.')
      return false
    } finally {
      setCreatingGoal(false)
    }
  }

  async function markRead(notificationId) {
    try {
      await apiRequest(`/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' })
      const data = await apiRequest('/api/notifications')
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread_count || 0)
    } catch (error) {
      setActionError(error.message || 'Could not update the notification.')
    }
  }

  async function askCoach(event) {
    event.preventDefault()
    const text = question.trim()
    if (!text || sending) return
    const history = messages.filter((message) => message.role !== 'error').slice(-HISTORY_TURNS_SENT).map(({ role, content }) => ({ role, content: content.slice(0, HISTORY_CHARS_SENT) }))
    setMessages((current) => [...current, { role: 'user', content: text }])
    setQuestion('')
    setSending(true)
    try {
      const response = await apiRequest('/api/coach/message', { method: 'POST', body: JSON.stringify({ user_id: 'demo-grace', message: text, history }) })
      setMessages((current) => [...current, { role: 'assistant', content: response.message, actions: response.actions || [], disclaimer: response.disclaimer }])
    } catch (error) {
      setMessages((current) => [...current, { role: 'error', content: error.message || 'The Coach is unavailable right now.' }])
    } finally {
      setSending(false)
    }
  }

  function navigate(view) {
    setActiveView(view === 'notifications' ? activeView : view)
    setMenuOpen(false)
    if (view === 'notifications') setNotificationsOpen(true)
    setActionError('')
  }

  if (loading) return <main className="loading-shell"><span className="loading-mark">K</span><p>Loading your demo plan…</p></main>
  if (pageError || !onboarding || !dashboard) return <main className="load-error"><span className="brand-mark">K</span><h1>Couldn’t load Khehla.</h1><p>{pageError || 'The demo API did not return its starting data.'}</p><button className="button-primary" type="button" onClick={() => window.location.reload()}>Try again</button></main>
  if (!onboarding.onboarding_complete) return <Onboarding initial={onboarding} onSave={submitOnboarding} saving={savingPlan} error={actionError} />

  const unreadLabel = unreadCount > 9 ? '9+' : unreadCount
  const title = VIEW_LABELS[activeView] || 'Your month'

  return <div className="app-shell">
    <header className="app-header">
      <div className="header-inner">
        <button className="header-menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon name="menu" /><span>Menu</span></button>
        <button className="brand-button" type="button" onClick={() => navigate('overview')}><span className="brand-mark">K</span><span>Khehla</span></button>
        <nav className="desktop-nav" aria-label="Main navigation">{NAV_ITEMS.map((item) => <button key={item.id} type="button" className={activeView === item.id ? 'nav-item nav-active' : 'nav-item'} onClick={() => navigate(item.id)}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}</nav>
        <div className="header-actions"><button className="header-coach-button" type="button" aria-label="Ask Khehla" onClick={() => setCoachOpen(true)}><Icon name="chat" /></button><button className="notification-button" type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} onClick={() => setNotificationsOpen(true)}><Icon name="bell" />{unreadCount > 0 && <span className="notification-badge">{unreadLabel}</span>}</button><span className="header-user"><span className="user-avatar" aria-hidden="true">{dashboard.user.name?.trim()?.charAt(0).toUpperCase() || 'K'}</span><span className="header-user-name">{dashboard.user.name}</span></span></div>
      </div>
    </header>

    <main className="main-content">
      {activeView === 'overview' && <Overview dashboard={dashboard} transactions={transactions} impact={impact} onNavigate={navigate} onOpenCoach={() => setCoachOpen(true)} />}
      {activeView === 'budget' && <BudgetView budget={budget} name={dashboard.user.name} onSave={saveBudget} saving={savingPlan} error={actionError} />}
      {activeView === 'goals' && <GoalsView goals={goals} onCreate={createGoal} creating={creatingGoal} error={actionError} />}
      {activeView === 'impact' && <MoneyImpactView impact={impact} />}
      {activeView === 'credit' && <CreditPreview budget={budget} onNavigate={navigate} onOpenCoach={() => setCoachOpen(true)} />}
      {activeView === 'activity' && <ActivityView transactions={transactions} />}
      <p className="page-demo-note">{title} · Khehla demo data · Not connected to a bank</p>
    </main>

    <nav className="mobile-nav" aria-label="Main navigation">{NAV_ITEMS.map((item) => <button key={item.id} type="button" className={activeView === item.id ? 'mobile-nav-item mobile-nav-active' : 'mobile-nav-item'} onClick={() => navigate(item.id)}><Icon name={item.icon} size={19} /><span>{item.label === 'Money impact' ? 'Impact' : item.label}</span></button>)}</nav>
    <button className="coach-launcher" type="button" onClick={() => setCoachOpen(true)}><span className="coach-launcher-mark">K</span><span>Ask Khehla</span><Icon name="arrow" size={16} /></button>

    {menuOpen && <MenuDrawer activeView={activeView} onNavigate={navigate} onClose={() => setMenuOpen(false)} unreadCount={unreadCount} />}
    {notificationsOpen && <NotificationsDrawer items={notifications} unreadCount={unreadCount} onRead={markRead} onClose={() => setNotificationsOpen(false)} />}
    {coachOpen && <CoachPanel messages={messages} question={question} setQuestion={setQuestion} sending={sending} onSubmit={askCoach} onClear={() => setMessages([])} onClose={() => setCoachOpen(false)} logRef={coachLogRef} />}
    {actionError && <div className="toast-error" role="alert"><span>{actionError}</span><button className="icon-button" type="button" aria-label="Dismiss" onClick={() => setActionError('')}><Icon name="close" size={16} /></button></div>}
  </div>
}
