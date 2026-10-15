import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource/inconsolata/400.css'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

registerSW({
  immediate: true,
  onRegisteredSW: (_scriptUrl, registration) => {
    if (registration) void registration.update().catch(() => undefined)
  },
  onNeedReload: () => {
    const active = document.activeElement
    const isEditing = active instanceof HTMLInputElement
      || active instanceof HTMLTextAreaElement
      || active instanceof HTMLSelectElement
      || active instanceof HTMLElement && active.isContentEditable
    if (isEditing && active instanceof HTMLElement) {
      active.blur()
      window.setTimeout(() => window.location.reload(), 700)
      return
    }
    window.location.reload()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
