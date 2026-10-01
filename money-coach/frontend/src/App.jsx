import { useEffect, useRef, useState } from 'react'
import { apiRequest } from './api/client'
import './styles.css'

/** Product sections mirror the reference dashboard while staying faithful to Khehla. */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'budget', label: 'Budget' },
  { id: 'goals', label: 'Savings Goals' },
  { id: 'outlook', label: 'Money Impact' }
]

/** Format ZAR consistently throughout the product. */
const zar = (value) => `R ${Number(value).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`

/** Chat history stays on this device; only the latest turns are sent for follow-up context. */
const CHAT_STORAGE_KEY = 'khehla-chat'
const CHAT_MESSAGES_KEPT = 50
const HISTORY_TURNS_SENT = 8
const HISTORY_CHARS_SENT = 1000

/** Read the saved chat safely: storage can be blocked, cleared, or hold stale data. */
function loadChat() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

/** Render one compact transaction row without icon-heavy decoration. */
function TransactionRow({ label, detail, amount, positive = false }) {
  return <div className="transaction-row"><div><strong>{label}</strong><span>{detail}</span></div><b className={positive ? 'money-positive' : 'money-negative'}>{positive ? '+' : '-'}{zar(amount)}</b></div>
}

/** Shared card heading keeps spacing and hierarchy consistent. */
function CardHeader({ eyebrow, title, action }) {
  return <div className="card-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action && <button className="text-button" type="button">{action}</button>}</div>
}

/** Main dashboard with deterministic demo data plus a connected Coach prompt. */
export default function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [dashboard, setDashboard] = useState(null)
  const [impact, setImpact] = useState(null)
  const [coachOpen, setCoachOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState(loadChat)
  const [sending, setSending] = useState(false)
  const chatLogRef = useRef(null)
  const [loading, setLoading] = useState(true)

  /** Load calculated dashboard data once; the UI never calculates balances. */
  useEffect(() => {
    Promise.all([apiRequest('/api/dashboard?user_id=demo-grace'), apiRequest('/api/money-impact?user_id=demo-grace')])
      .then(([dashboardData, impactData]) => { setDashboard(dashboardData); setImpact(impactData.cards[0]) })
      .catch(() => { setDashboard(null); setImpact(null) })
      .finally(() => setLoading(false))
  }, [])

  /** Save the chat on this device and keep the newest message in view. */
  useEffect(() => {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-CHAT_MESSAGES_KEPT))) } catch { /* storage unavailable */ }
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
  }, [messages, sending, coachOpen])

  /** Ask Flask Coach with recent turns so follow-up questions keep their meaning. */
  async function askCoach(event) {
    event.preventDefault()
    const text = question.trim()
    if (!text || sending) return
    const history = messages
      .filter((message) => message.role !== 'error')
      .slice(-HISTORY_TURNS_SENT)
      .map(({ role, content }) => ({ role, content: content.slice(0, HISTORY_CHARS_SENT) }))
    setMessages((current) => [...current, { role: 'user', content: text }])
    setQuestion('')
    setSending(true)
    try {
      const response = await apiRequest('/api/coach/message', { method: 'POST', body: JSON.stringify({ user_id: 'demo-grace', message: text, history }) })
      setMessages((current) => [...current, { role: 'assistant', content: response.message, actions: response.actions || [], disclaimer: response.disclaimer }])
    } catch (error) {
      setMessages((current) => [...current, { role: 'error', content: error.message }])
    } finally {
      setSending(false)
    }
  }

  const summary = dashboard?.financial_summary
  const goal = dashboard?.goal
  const spending = dashboard?.spending_by_category || {}

  return <div className="app-shell">
    <main className="app-container">
      <header className="topbar"><div className="brand"><span className="brand-mark">MC</span><span>Khehla</span></div><div className="profile"><span>Hi, Grace</span><span className="avatar">G</span></div></header>

      <section className="hero"><div><span className="hero-label">Your money, made simpler</span><h1>Good afternoon, Grace.</h1><p>You have covered the essentials. Here is what your money is doing and where your next small step could help.</p></div><div className="hero-summary"><span>Money left this month</span><strong>{loading ? '—' : zar(summary?.remaining)}</strong><b>Based on your latest activity</b></div></section>

      <nav className="tabs" aria-label="Khehla sections">{TABS.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>

      {loading && <div className="loading-card">Loading your money snapshot…</div>}

      {!loading && activeTab === 'overview' && <section className="dashboard-grid">
        <article className="card span-5"><CardHeader eyebrow="This month" title="Your snapshot" action="Details" /><div className="metric">{zar(summary?.remaining)}</div><p className="muted">available after expenses and money sent home</p><div className="stat-pair"><div><span>Income</span><b>{zar(summary?.income)}</b></div><div><span>Spent</span><b>{zar(summary?.spent)}</b></div></div></article>
        <article className="card span-7"><CardHeader eyebrow="Priority" title="School-fees goal" action="View goal" /><div className="goal-row"><div><strong>{zar(goal?.saved_amount)}</strong><span>of {zar(goal?.target_amount)} saved</span></div><b>{goal?.progress_percent}%</b></div><div className="progress"><span style={{ width: `${goal?.progress_percent}%` }} /></div><div className="split muted"><span>{zar(goal?.remaining)} to go</span><span>{goal?.days_remaining} days left</span></div><div className="tip"><strong>Coach nudge:</strong> saving about {zar(goal?.required_per_day)} a day keeps this goal within reach.</div></article>
        <article className="card span-7"><CardHeader eyebrow="Your pattern" title="Where your money is going" action="View budget" /><div className="category-list">{Object.entries(spending).slice(0, 5).map(([category, amount]) => <div className="category-row" key={category}><div><strong>{category.replace('_', ' ')}</strong><span>{category === 'remittances' ? 'Family support' : 'This month'}</span></div><b>{zar(amount)}</b></div>)}</div></article>
        <article className="card span-5 impact-card"><CardHeader eyebrow="Money Impact" title="A change to watch" action="Explore" /><div className="impact-title">{impact?.title || 'Transport costs may change'}</div><p>{impact?.description || 'We are checking how changes around you may affect your budget.'}</p><span className="estimate-label">Estimate based on your spending</span></article>
        <article className="card span-12"><CardHeader eyebrow="Latest activity" title="Recent spending" action="See all" /><div className="transactions"><TransactionRow label="Groceries" detail="Today" amount={320} /><TransactionRow label="Transport" detail="Yesterday" amount={48} /><TransactionRow label="Salary" detail="28 September" amount={12000} positive /></div></article>
      </section>}

      {!loading && activeTab === 'budget' && <section className="dashboard-grid"><article className="card span-4"><span className="eyebrow">Monthly income</span><div className="metric">{zar(summary?.income)}</div><span className="badge">Stable</span></article><article className="card span-4"><span className="eyebrow">Spent so far</span><div className="metric">{zar(summary?.spent)}</div><span className="badge">{Math.round((summary?.spent / summary?.income) * 100)}% used</span></article><article className="card span-4"><span className="eyebrow">Available</span><div className="metric">{zar(summary?.remaining)}</div><span className="badge">Keep an eye on it</span></article><article className="card span-7"><CardHeader eyebrow="Spending plan" title="This month" action="Adjust plan" />{Object.entries(spending).map(([category, amount]) => <div className="budget-line" key={category}><div className="split"><strong>{category.replace('_', ' ')}</strong><span>{zar(amount)}</span></div><div className="progress"><span style={{ width: `${Math.min((amount / 2000) * 100, 100)}%` }} /></div></div>)}</article><article className="card span-5"><CardHeader eyebrow="Coach note" title="A small observation" /><div className="tip"><strong>Remittances are visible here because they matter.</strong><br />Money sent home is part of your plan, not a problem to hide. We will look for changes around your priorities.</div></article></section>}

      {!loading && activeTab === 'goals' && <section className="dashboard-grid"><article className="card span-8"><CardHeader eyebrow="Your progress" title="Savings goals" action="+ New goal" /><div className="goal-block"><div className="split"><div><strong>Sister's school fees</strong><span>Target {zar(goal?.target_amount)}</span></div><b>{zar(goal?.saved_amount)}</b></div><div className="progress"><span style={{ width: `${goal?.progress_percent}%` }} /></div><div className="split muted"><span>{goal?.progress_percent}% complete</span><span>{zar(goal?.remaining)} to go</span></div></div><div className="goal-block"><div className="split"><div><strong>Emergency buffer</strong><span>Future goal</span></div><b>R0</b></div><div className="progress"><span style={{ width: '5%' }} /></div><div className="split muted"><span>Just getting started</span><span>Set a target when ready</span></div></div></article><article className="card span-4"><span className="eyebrow">This month's saving</span><div className="metric">R 1,050</div><p className="muted">Small, consistent steps count. What-if scenarios can help you choose a pace.</p><button className="primary-button" type="button" onClick={() => setCoachOpen(true)}>Ask Coach</button></article></section>}

      {!loading && activeTab === 'outlook' && <section className="dashboard-grid"><article className="card span-8"><CardHeader eyebrow="Personal projection" title="What could change?" action="Refresh" /><div className="impact-large"><div className="impact-title">{impact?.title}</div><p>{impact?.description}</p><strong>{zar(impact?.estimated_monthly_impact)} / month</strong><span className="estimate-label">Estimate based on {zar(impact?.monthly_spend)} transport spending</span></div><div className="option-list"><div><strong>Set aside R30 each week</strong><span>Protect your school-fees goal</span></div><div><strong>Review flexible spending</strong><span>Find room without touching rent or family support</span></div></div></article><article className="card span-4"><CardHeader eyebrow="Coach outlook" title="The simple view" /><p className="muted body-copy">Economic changes do not affect everyone in the same way. Khehla connects the change to your own spending, then gives you choices.</p><button className="primary-button" type="button" onClick={() => setCoachOpen(true)}>Talk it through</button></article></section>}
    </main>

    <button className="floating-coach" type="button" onClick={() => setCoachOpen((value) => !value)}><span className="coach-dot">M</span><span>Ask Khehla</span><b>↗</b></button>
    {coachOpen && <aside className="coach-popover">
      <button className="close-button" onClick={() => setCoachOpen(false)}>×</button>
      <span className="eyebrow">Khehla</span>
      <h2>What would you like to understand?</h2>
      {messages.length === 0 && <p className="muted">Ask about your budget, goals, spending, or what-if scenarios.</p>}
      {messages.length > 0 && <div className="coach-log" ref={chatLogRef} aria-live="polite">
        {messages.map((message, index) => <div key={index} className={`coach-message coach-${message.role}`}>
          <p>{message.content}</p>
          {message.actions?.length > 0 && <ul className="coach-actions">{message.actions.map((action) => <li key={action}>{action}</li>)}</ul>}
          {message.disclaimer && <small className="coach-disclaimer">{message.disclaimer}</small>}
        </div>)}
        {sending && <div className="coach-message coach-assistant coach-typing">Khehla is thinking…</div>}
      </div>}
      <form onSubmit={askCoach}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Try: What if I save R100 a week?" disabled={sending} autoFocus /><button className="primary-button" type="submit" disabled={sending}>Ask</button></form>
      {messages.length > 0 && <button className="text-button coach-clear" type="button" onClick={() => setMessages([])} disabled={sending}>Clear chat</button>}
    </aside>}
  </div>
}
