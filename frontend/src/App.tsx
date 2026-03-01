import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import './i18n'
import './App.css'

import Hero from './components/Landing/Hero'

const LoginPage = lazy(() => import('./components/Auth/LoginPage'))
const RegisterPage = lazy(() => import('./components/Auth/RegisterPage'))
const ProtectedRoute = lazy(() => import('./components/Auth/ProtectedRoute'))
const DashboardPage = lazy(() => import('./components/Dashboard/DashboardPage'))

function LazyFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <Loader2 className="h-8 w-8 animate-spin text-[#FF7000]" />
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
