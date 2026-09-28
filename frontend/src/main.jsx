import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './pwaRegister.js'
import { reloadOnceForStaleChunks } from './utils/lazyWithReload.js'

// Vite fires this when a lazy chunk's preloaded dependency is missing —
// same stale-deploy case lazyWithReload() handles for the chunk itself.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForStaleChunks()) event.preventDefault()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
