/**
 * src/App.jsx — root with React Router
 * Governance route removed. All routes defined here.
 * Layout wraps every page via <Outlet />.
 */

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Layout from './layouts/Layout'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import TransactionsPage from './pages/TransactionsPage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* All pages share the sidebar Layout */}
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="profile" element={<ProfilePage />} />

          {/* Catch-all → redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
