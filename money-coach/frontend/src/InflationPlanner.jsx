import { useState } from 'react'
import { apiRequest } from './api/client'

const zar = (v) => `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const STATUS_LABEL = {
  live: 'Live from World Bank',
  cached: 'Cached data (under 24 hours old)',
  stale_cache: 'Cached data (could not refresh)'
}

export default function InflationPlanner() {
  const [goal, setGoal] = useState('')
  const [saved, setSaved] = useState('')
  const [months, setMonths] = useState('12')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    const goalToday = Number(goal)
    const currentSavings = saved === '' ? 0 : Number(saved)
    const monthCount = Number(months)
    if (!goal || !Number.isFinite(goalToday) || goalToday <= 0) return setError('Enter what the goal costs today, in rand.')
    if (!Number.isFinite(currentSavings) || currentSavings < 0) return setError('Savings must be zero or more.')
    if (!Number.isInteger(monthCount) || monthCount < 1 || monthCount > 120) return setError('Choose between 1 and 120 months.')
    setBusy(true)
    try {
      setResult(await apiRequest('/api/predictions/goal', {
        method: 'POST',
        body: JSON.stringify({ goal_today: goalToday, current_savings: currentSavings, months: monthCount })
      }))
    } catch (err) {
      setResult(null)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const economy = result?.economy
  return <article className="card span-12">
    <span className="eyebrow">Inflation planner</span>
    <h2 style={{ margin: '0 0 6px' }}>What could this goal cost later?</h2>
    <p className="muted">Enter today's price. Khehla adjusts it for South African inflation and shows a monthly amount to aim for.</p>
    <form onSubmit={submit} className="planner-form">
      <label>Cost today (R)<input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="10000" /></label>
      <label>Already saved (R)<input inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="4000" /></label>
      <label>Months to go<input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} /></label>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Calculating…' : 'Calculate'}</button>
    </form>
    {error && <div className="planner-error" role="alert">{error}</div>}
    {result && <div className="planner-results">
      <div>
        <span className="eyebrow">Latest available annual inflation</span>
        <div className="metric">{economy.annual_inflation_percent.toFixed(1)}%</div>
        <span className="muted">{economy.observation_year} · {economy.source}</span>
        <span className="badge">{STATUS_LABEL[economy.data_status]}</span>
      </div>
      <div>
        <span className="eyebrow">Goal in {result.months} months</span>
        <div className="metric">{zar(result.inflation_adjusted_goal)}</div>
        <span className="muted">{zar(result.remaining)} still to save</span>
      </div>
      <div>
        <span className="eyebrow">Aim to save</span>
        <div className="metric">R {result.suggested_monthly_rand.toLocaleString('en-ZA')} / month</div>
        <span className="muted">Estimate, assuming inflation stays the same</span>
      </div>
    </div>}
    {result && <p className="muted planner-note">This is a planning estimate, not a forecast. It ignores interest, fees and withdrawals.</p>}
  </article>
}