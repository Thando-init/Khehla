import { useState } from 'react'
import { apiRequest } from './api/client'

const zar = (value) => `R${Number(value).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const STATUS_LABEL = {
  live: 'Live from World Bank',
  cached: 'Cached data · under 24 hours old',
  stale_cache: 'Cached data · refresh unavailable',
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
        body: JSON.stringify({ goal_today: goalToday, current_savings: currentSavings, months: monthCount }),
      }))
    } catch (requestError) {
      setResult(null)
      setError(requestError.message || 'Inflation data is unavailable. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const economy = result?.economy
  return <article className="surface-card inflation-card">
    <p className="eyebrow">INFLATION PLANNER</p>
    <h2>What could your goal cost later?</h2>
    <p>Use South African inflation data to make a simple savings scenario.</p>
    <form onSubmit={submit} className="planner-form">
      <label>Cost today (R)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="10000" /></label>
      <label>Already saved (R)<input type="number" min="0" step="0.01" inputMode="decimal" value={saved} onChange={(event) => setSaved(event.target.value)} placeholder="4000" /></label>
      <label>Months to go<input type="number" min="1" max="120" step="1" inputMode="numeric" value={months} onChange={(event) => setMonths(event.target.value)} /></label>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Calculating…' : 'Calculate'}</button>
    </form>
    {error && <div className="planner-error" role="alert">{error}</div>}
    {result && economy && <div className="planner-results" aria-live="polite">
      <div>
        <p className="eyebrow">LATEST ANNUAL INFLATION</p>
        <div className="metric">{Number(economy.annual_inflation_percent).toFixed(1)}%</div>
        <span className="muted">{economy.observation_year} · {economy.source}</span>
        <span className="badge">{STATUS_LABEL[economy.data_status]}</span>
      </div>
      <div>
        <p className="eyebrow">GOAL IN {result.months} MONTHS</p>
        <div className="metric">{zar(result.inflation_adjusted_goal)}</div>
        <span className="muted">{zar(result.remaining)} still to save</span>
      </div>
      <div>
        <p className="eyebrow">AIM TO SAVE</p>
        <div className="metric">{zar(result.suggested_monthly_rand)} / month</div>
        <span className="muted">Assuming inflation stays the same</span>
      </div>
    </div>}
    {result && <p className="planner-note">Planning estimate, not a forecast. It ignores interest, fees, and withdrawals.</p>}
  </article>
}
