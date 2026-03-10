import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// global styles imported in App.tsx
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
