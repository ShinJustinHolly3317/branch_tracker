import { NavLink, Route, Routes } from 'react-router-dom'
import { DashboardTabCacheProvider } from './DashboardTabCache'
import { StockPage } from './pages/StockPage'
import { BranchPage } from './pages/BranchPage'
import { PerformancePage } from './pages/PerformancePage'
import { StatusBar } from './components/StatusBar'

export function App() {
  return (
    <DashboardTabCacheProvider>
    <div className="container">
      <header className="app-header">
        <h1 className="app-title">TW Broker-Branch Dashboard</h1>
        <p className="app-subtitle">
          EOD data, arbitrary trading-day windows, and quick concentration views.
        </p>
      </header>

      <StatusBar />

      <nav className="nav">
        <NavLink to="/" end>
          Stock
        </NavLink>
        <NavLink to="/branch">Branch</NavLink>
        <NavLink to="/performance">Performance</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<StockPage />} />
        <Route path="/branch" element={<BranchPage />} />
        <Route path="/performance" element={<PerformancePage />} />
      </Routes>
    </div>
    </DashboardTabCacheProvider>
  )
}

