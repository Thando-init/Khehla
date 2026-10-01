import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

/** Mount the single-page Khehla application. */
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
