import { NavLink, Route, Routes } from 'react-router-dom'
import { DashboardTabCacheProvider } from './DashboardTabCache'
import { HomePage } from './HomePage'
import { StockPage } from './pages/StockPage'
import { BranchPage } from './pages/BranchPage'
import { PerformancePage } from './pages/PerformancePage'
import { RecommendationsPage } from './pages/RecommendationsPage'
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
          Performance
        </NavLink>
        <NavLink to="/recommendations">推薦</NavLink>
        <NavLink to="/stock">Stock</NavLink>
        <NavLink to="/branch">Branch</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/branch" element={<BranchPage />} />
        <Route path="/performance" element={<PerformancePage />} />
      </Routes>
    </div>
    </DashboardTabCacheProvider>
  )
}

