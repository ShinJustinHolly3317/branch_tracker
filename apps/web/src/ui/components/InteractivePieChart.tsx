import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts'
import type { PieSectorDataItem } from 'recharts/types/polar/Pie'

const DEFAULT_COLORS = [
  '#0f9b8e',
  '#14b8a6',
  '#2dd4bf',
  '#5eead4',
  '#99f6e4',
  '#0d8177',
  '#0f5952',
  '#134e4a',
  '#5ebfb5',
  '#d5f5f0'
]

/** 單一圓餅扇區：含導頁路徑 */
export type PieSegment = {
  id: string
  label: string
  value: number
  navigateTo: string
  actionLabel: string
}

type ChartRow = PieSegment & { name: string }

type Props = {
  segments: PieSegment[]
  colors?: string[]
  loading?: boolean
  emptyMessage?: string
}

function renderActiveShape(props: PieSectorDataItem) {
  const { cx = 0, cy = 0, innerRadius = 0, outerRadius = 0, startAngle = 0, endAngle = 0, fill } = props
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={Number(outerRadius) + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="var(--color-bg-card)"
      strokeWidth={2}
      style={{ cursor: 'pointer' }}
    />
  )
}

type TooltipPayload = {
  payload?: ChartRow
  value?: number
}

function PieHoverTooltip({
  active,
  payload,
  total,
  onNavigate
}: {
  active?: boolean
  payload?: TooltipPayload[]
  total: number
  onNavigate: (to: string) => void
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  const value = Number(payload[0]?.value ?? row.value)
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'

  return (
    <div className="pie-hover-tooltip" role="tooltip">
      <div className="pie-hover-tooltip__icon" aria-hidden>
        ↗
      </div>
      <div className="pie-hover-tooltip__body">
        <div className="pie-hover-tooltip__label">{row.label}</div>
        <div className="pie-hover-tooltip__meta">
          淨額 {value.toLocaleString()} · {pct}%
        </div>
        <button
          type="button"
          className="pie-hover-chip"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate(row.navigateTo)
          }}
        >
          {row.actionLabel}
        </button>
      </div>
    </div>
  )
}

export function InteractivePieChart({ segments, colors = DEFAULT_COLORS, loading, emptyMessage }: Props) {
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  const chartData = useMemo(
    (): ChartRow[] =>
      segments.map((s) => ({
        ...s,
        name: s.label
      })),
    [segments]
  )

  const total = useMemo(() => chartData.reduce((sum, s) => sum + s.value, 0), [chartData])

  function goToSegment(row: ChartRow) {
    navigate(row.navigateTo)
  }

  if (loading) {
    return <div className="chart-empty">載入中…</div>
  }

  if (chartData.length === 0) {
    return (
      <div className="chart-empty">
        {emptyMessage ?? '尚無可視覺化的資料。'}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          dataKey="value"
          data={chartData}
          nameKey="name"
          outerRadius={130}
          paddingAngle={1}
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          style={{ cursor: 'pointer' }}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(undefined)}
          onClick={(_, index) => {
            const row = chartData[index]
            if (row) goToSegment(row)
          }}
        >
          {chartData.map((s, i) => (
            <Cell
              key={s.id}
              fill={colors[i % colors.length]}
              stroke="var(--color-bg-card)"
              opacity={activeIndex === undefined || activeIndex === i ? 1 : 0.72}
            />
          ))}
        </Pie>
        <Tooltip
          content={
            <PieHoverTooltip total={total} onNavigate={(to) => navigate(to)} />
          }
          wrapperStyle={{ zIndex: 20, pointerEvents: 'auto' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
