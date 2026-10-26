import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker registration
if ('serviceWorker' in navigator) {
  // Check if browser supports Service Worker
  window.addEventListener('load', () => {
    // Execute after page is fully loaded
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
        // Registration successful
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
        // Registration failed
      });
  });
}
