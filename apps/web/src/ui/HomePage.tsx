import { Navigate, useSearchParams } from 'react-router-dom'
import { PerformancePage } from './pages/PerformancePage'

/** 首頁：Performance；保留舊版 `/?stockId=` 深連結轉到 /stock */
export function HomePage() {
  const [searchParams] = useSearchParams()
  if (searchParams.get('stockId')?.trim()) {
    return <Navigate to={`/stock?${searchParams.toString()}`} replace />
  }
  return <PerformancePage />
}
