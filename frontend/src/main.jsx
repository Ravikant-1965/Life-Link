// main.jsx — Entry point of our React app
// This is the very first file that runs in the browser
// It mounts our <App /> component into the <div id="root"> in index.html

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'   // Needed for routing (just like your ecommerce project!)

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>     {/* Wrap the whole app so any component can use routing */}
      <App />
    </BrowserRouter>
  </StrictMode>,
)
