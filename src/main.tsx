import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import '@fontsource-variable/manrope'
import '@fontsource/inconsolata/400.css'
import { ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.tsx'

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim()

if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL is required. Run `npx convex dev` to connect this app to Convex.')
}

const convex = new ConvexReactClient(convexUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex} storage={window.localStorage}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>,
)
