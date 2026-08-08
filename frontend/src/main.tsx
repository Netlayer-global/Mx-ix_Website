import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Signal to vite-plugin-prerender that the page has finished rendering.
// This lets the pre-renderer capture fully-rendered HTML for each route.
setTimeout(() => {
  document.dispatchEvent(new Event('prerender-ready'))
}, 1500)
