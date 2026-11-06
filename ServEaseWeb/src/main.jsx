import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/auth_context.jsx' // adjust to your real path/export

// Google Sign-In. VITE_GOOGLE_CLIENT_ID is the WEB OAuth client ID from Google
// Cloud Console; on the deployed site it must also be set in the host's env vars
// (Vite bakes it in at build time, so redeploy after adding it there).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)