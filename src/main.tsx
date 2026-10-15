import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import '@fontsource-variable/manrope'
import '@fontsource/inconsolata/400.css'
import { ConvexReactClient } from 'convex/react'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim()

if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL is required. Run `npx convex dev` to connect this app to Convex.')
}

const convex = new ConvexReactClient(convexUrl)

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
    <ConvexAuthProvider client={convex} storage={window.localStorage}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>,
)
