import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App' // Make sure this points to App.tsx

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)