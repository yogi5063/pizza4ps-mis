import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import LoginPage from './pages/Login'

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

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

function AppLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  return (
    <div className="flex h-screen bg-content-bg overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 min-w-0 transition-all duration-300">
        <Topbar onMenuClick={() => setSidebarCollapsed(c => !c)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><AppLayout><DailyFlash /></AppLayout></PrivateRoute>} />
        <Route path="/daily-flash" element={<PrivateRoute><AppLayout><DailyFlash /></AppLayout></PrivateRoute>} />
        <Route path="/overview" element={<PrivateRoute><AppLayout><Overview /></AppLayout></PrivateRoute>} />
        <Route path="/monthly" element={<PrivateRoute><AppLayout><MonthlyDetail /></AppLayout></PrivateRoute>} />
        <Route path="/comparison" element={<PrivateRoute><AppLayout><Comparison /></AppLayout></PrivateRoute>} />
        <Route path="/items" element={<PrivateRoute><AppLayout><ItemAnalysis /></AppLayout></PrivateRoute>} />
        <Route path="/cogs" element={<PrivateRoute><AppLayout><CogsMargin /></AppLayout></PrivateRoute>} />
        <Route path="/targets" element={<PrivateRoute><AppLayout><Targets /></AppLayout></PrivateRoute>} />
        <Route path="/sales-vs-cogs" element={<PrivateRoute><AppLayout><SalesVsCogs /></AppLayout></PrivateRoute>} />
        <Route path="/discount" element={<PrivateRoute><AppLayout><DiscountAnalysis /></AppLayout></PrivateRoute>} />
        <Route path="/voids" element={<PrivateRoute><AppLayout><VoidsCancels /></AppLayout></PrivateRoute>} />
        <Route path="/gst" element={<PrivateRoute><AppLayout><GstSummary /></AppLayout></PrivateRoute>} />
        <Route path="/table-performance" element={<PrivateRoute><AppLayout><TablePerformance /></AppLayout></PrivateRoute>} />
        <Route path="/top-invoices" element={<PrivateRoute><AppLayout><TopInvoices /></AppLayout></PrivateRoute>} />
        <Route path="/covers" element={<PrivateRoute><AppLayout><CoverAnalytics /></AppLayout></PrivateRoute>} />
        <Route path="/inventory" element={<PrivateRoute><AppLayout><InventoryIntel /></AppLayout></PrivateRoute>} />
        <Route path="/menu-engineering" element={<PrivateRoute><AppLayout><MenuEngineering /></AppLayout></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><AppLayout><Admin /></AppLayout></PrivateRoute>} />
        <Route path="/month-end" element={<PrivateRoute><AppLayout><MonthEndClose /></AppLayout></PrivateRoute>} />
        <Route path="/pl" element={<PrivateRoute><AppLayout><PnL /></AppLayout></PrivateRoute>} />
        <Route path="/bs" element={<PrivateRoute><AppLayout><BalanceSheet /></AppLayout></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
