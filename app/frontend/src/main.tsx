import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import './styles.css'

// Rutas
import Landing from './routes/Landing'
import Login from './routes/Login'
import Dashboard from './routes/Dashboard'
import BotEditor from './routes/BotEditor'
import Register from './routes/Register'   // <-- IMPORTANTE
import BotSessions from './routes/BotSessions'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },  // <-- RUTA NUEVA
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/bots/:id', element: <BotEditor /> },
  { path:"/bots/:id/sessions", element:<BotSessions /> },
  // (opcional) 404 amigable:
  { path: '*', element: <div className="container py-16">404 Not Found</div> }
])

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
)
