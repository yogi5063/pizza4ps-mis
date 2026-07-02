import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import LoginPage from './pages/Login'
import useAuthStore from './store/authStore'
import { canView, firstAllowedPath, pageKey } from './utils/nav'

import DailyFlash from './pages/DailyFlash'
import Overview from './pages/Overview'
import MonthlyDetail from './pages/MonthlyDetail'
import Comparison from './pages/Comparison'
import ItemAnalysis from './pages/ItemAnalysis'
import CogsMargin from './pages/CogsMargin'
import Targets from './pages/Targets'
import SalesVsCogs from './pages/SalesVsCogs'
import DiscountAnalysis from './pages/DiscountAnalysis'
import VoidsCancels from './pages/VoidsCancels'
import GstSummary from './pages/GstSummary'
import TablePerformance from './pages/TablePerformance'
import TopInvoices from './pages/TopInvoices'
import CoverAnalytics from './pages/CoverAnalytics'
import InventoryIntel from './pages/InventoryIntel'
import MenuEngineering from './pages/MenuEngineering'
import Admin from './pages/Admin'
import MonthEndClose from './pages/MonthEndClose'
import PnL from './pages/PnL'
import BalanceSheet from './pages/BalanceSheet'
import Users from './pages/Users'
import ChangePassword from './pages/ChangePassword'

function AppLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  return (
    <div className="flex h-screen bg-content-bg overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 min-w-0 transition-all duration-300">
        <Topbar onMenuClick={() => setSidebarCollapsed(c => !c)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

// Gate: requires a valid token; forces password change; checks page rights.
function Protected({ pageKey: key, children }) {
  const location = useLocation()
  const { me, loaded } = useAuthStore()
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  if (!loaded) return <div className="p-10 text-t3 font-sans">Loading…</div>
  if (me?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  if (key && !canView(me, key)) {
    return <Navigate to={firstAllowedPath(me)} replace />
  }
  return <AppLayout>{children}</AppLayout>
}

const P = (key, el) => <Protected pageKey={key}>{el}</Protected>

export default function App() {
  const { loadMe, loaded } = useAuthStore()
  useEffect(() => { loadMe() }, [])   // bootstrap current user on load

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<Protected>{<ChangePassword />}</Protected>} />
        <Route path="/no-access" element={<Protected>{<div className="p-10 font-sans text-t2">You don't have access to any pages yet. Please contact your administrator.</div>}</Protected>} />

        <Route path="/" element={P('daily-flash', <DailyFlash />)} />
        <Route path="/daily-flash" element={P('daily-flash', <DailyFlash />)} />
        <Route path="/overview" element={P('overview', <Overview />)} />
        <Route path="/monthly" element={P('monthly', <MonthlyDetail />)} />
        <Route path="/comparison" element={P('comparison', <Comparison />)} />
        <Route path="/items" element={P('items', <ItemAnalysis />)} />
        <Route path="/cogs" element={P('cogs', <CogsMargin />)} />
        <Route path="/targets" element={P('targets', <Targets />)} />
        <Route path="/sales-vs-cogs" element={P('sales-vs-cogs', <SalesVsCogs />)} />
        <Route path="/discount" element={P('discount', <DiscountAnalysis />)} />
        <Route path="/voids" element={P('voids', <VoidsCancels />)} />
        <Route path="/gst" element={P('gst', <GstSummary />)} />
        <Route path="/table-performance" element={P('table-performance', <TablePerformance />)} />
        <Route path="/top-invoices" element={P('top-invoices', <TopInvoices />)} />
        <Route path="/covers" element={P('covers', <CoverAnalytics />)} />
        <Route path="/inventory" element={P('inventory', <InventoryIntel />)} />
        <Route path="/menu-engineering" element={P('menu-engineering', <MenuEngineering />)} />
        <Route path="/admin" element={P('admin', <Admin />)} />
        <Route path="/month-end" element={P('month-end', <MonthEndClose />)} />
        <Route path="/pl" element={P('pl', <PnL />)} />
        <Route path="/bs" element={P('bs', <BalanceSheet />)} />
        <Route path="/users" element={P('users', <Users />)} />
      </Routes>
    </BrowserRouter>
  )
}
