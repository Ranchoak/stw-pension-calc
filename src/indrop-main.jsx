import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import InDropApp from './InDropApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InDropApp />
  </StrictMode>,
)
