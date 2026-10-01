/** Small fetch wrapper used by the chat-first frontend. */
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

/** Fetch JSON and convert HTML/proxy failures into a user-readable error. */
export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) throw new Error('Money Coach is not connected right now.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data
}
