import type { TradeByBranchDaily } from '@twbbd/shared'
import { load } from 'cheerio'

export type TwseFetchResult = {
  tradeDate: string // YYYY-MM-DD
  stockId: string
  stockName?: string
  closePrice?: number
  rows: TradeByBranchDaily[]
}

/** TWSE 分點頁：資料列數門檻過高會回空 body，依序降低 RecCount 重試 */
const REC_COUNT_STEPS = [10, 5, 1] as const

function buildBsContentUrl(stockId: string, recCount: number): string {
  const base = 'https://bsr.twse.com.tw/bshtm/bsContent.aspx'
  const q = new URLSearchParams({
    v: 't',
    StkNo: stockId,
    RecCount: String(recCount)
  })
  return `${base}?${q.toString()}`
}

function ymdFromSlash(s: string): string | undefined {
  const m = s.match(/(\d{4})\/(\d{2})\/(\d{2})/)
  if (!m) return undefined
  return `${m[1]}-${m[2]}-${m[3]}`
}

function parseNumberLike(s: string): number {
  const cleaned = s.replaceAll(',', '').trim()
  if (!cleaned) return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

/**
 * TWSE「證券商」欄常見為四碼純數字（5831），亦常見數字三位 + 英數第四位（538A / 102A）。
 * 舊版只認純數字四碼，會整列丢棄導致彙總嚴重缺量、名次與對照網頁對不起來。
 */
function parseBranchCell(cell: string): { code?: string; name?: string } {
  const raw = cell.replace(/\s+/g, ' ').trim()
  if (!raw) return {}

  const parts = raw.split(/\s+/).filter(Boolean)
  const token = parts[0]
  if (!token) return {}

  const normalized = token.toUpperCase()
  /** 四位純數字，或三位數末尾再接一個英文字母（證交所常見分店代號如 538A / 102A） */
  const code =
    /^[0-9]{4}$/.test(normalized) || /^[0-9]{3}[A-Z]$/.test(normalized) ? normalized : undefined
  if (!code) return {}

  const nameTail = parts.slice(1).join('')
  const name = nameTail ? nameTail.replace(/\s+/g, '') : undefined

  return { code, name: name || undefined }
}

type ParsedPage =
  | { kind: 'ok'; data: TwseFetchResult }
  | { kind: 'no_trade_date' }

/** 只解析 HTML；無交易日期視為頁面不可用（可換較小 RecCount） */
function parseBsContentHtml(html: string, stockId: string): ParsedPage {
  const $ = load(html)
  let tradeDateSlash: string | undefined
  let stockName: string | undefined
  let closePrice: number | undefined

  $('td,th').each((_, el) => {
    const t = $(el).text().trim()
    if (t === '交易日期') {
      const nxt = $(el).next('td')
      tradeDateSlash = nxt.text().trim()
    }
    if (t === '股票代號') {
      const nxt = $(el).next('td').text().trim()
      const parts = nxt.split(/\s+/)
      stockName = parts.slice(1).join(' ').trim() || undefined
    }
    if (t === '收盤價') {
      const nxt = $(el).next('td').text().trim()
      const n = parseNumberLike(nxt)
      closePrice = n > 0 ? n : undefined
    }
  })

  const tradeDate = tradeDateSlash ? ymdFromSlash(tradeDateSlash) : undefined
  if (!tradeDate) {
    return { kind: 'no_trade_date' }
  }

  const branchNameByCode = new Map<string, string>()
  const agg = new Map<string, { buy: number; sell: number }>()

  $('table')
    .filter((_, tbl) => {
      const text = $(tbl).text()
      return text.includes('證券商') && text.includes('買進股數') && text.includes('賣出股數')
    })
    .each((_, tbl) => {
      $(tbl)
        .find('tr')
        .each((_, tr) => {
          const tds = $(tr).find('td')
          if (tds.length < 5) return
          const seq = $(tds[0]).text().trim()
          if (!seq || !/^\d+$/.test(seq)) return

          const branchCell = $(tds[1]).text()
          const { code, name } = parseBranchCell(branchCell)
          if (!code) return
          if (name) branchNameByCode.set(code, name)

          const buy = parseNumberLike($(tds[3]).text())
          const sell = parseNumberLike($(tds[4]).text())
          const cur = agg.get(code) ?? { buy: 0, sell: 0 }
          cur.buy += buy
          cur.sell += sell
          agg.set(code, cur)
        })
    })

  const rows: TradeByBranchDaily[] = [...agg.entries()].map(([code, v]) => {
    const branchName2 = branchNameByCode.get(code) ?? code
    return {
      date: tradeDate,
      market: 'TWSE',
      stockId,
      branchId: code,
      branchName: branchName2,
      buyShares: v.buy,
      sellShares: v.sell,
      netShares: v.buy - v.sell
    }
  })

  return {
    kind: 'ok',
    data: { tradeDate, stockId, stockName, closePrice, rows }
  }
}

/** 同一 RecCount 下 empty body 短暫重試；403 rate-limit 時退避重試 */
async function fetchHtmlWithBackoff(stockId: string, recCount: number): Promise<string> {
  const url = buildBsContentUrl(stockId, recCount)
  let lastStatus = 0

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7',
        referer: 'https://bsr.twse.com.tw/bshtm/',
        'accept-encoding': 'gzip'
      }
    })
    lastStatus = res.status

    if (res.status === 403) {
      // TWSE rate limit：等待後重試（1s → 3s → 9s）
      if (attempt < 3) {
        const waitMs = 1000 * 3 ** (attempt - 1)
        // eslint-disable-next-line no-console
        console.log(`[ingester] 403 rate-limit ${stockId} RecCount=${recCount}，第 ${attempt} 次重試（等 ${waitMs}ms）`)
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      throw new Error(`twse_fetch_failed stockId=${stockId} status=403 RecCount=${recCount}`)
    }

    if (!res.ok) {
      throw new Error(`twse_fetch_failed stockId=${stockId} status=${res.status} RecCount=${recCount}`)
    }

    const html = await res.text()
    if (html.length > 0) {
      if (attempt > 1) {
        // eslint-disable-next-line no-console
        console.log(`[ingester] retry ok ${stockId} RecCount=${recCount}（第 ${attempt} 次成功）`)
      }
      return html
    }

    await new Promise((r) => setTimeout(r, 400 * attempt))
  }

  throw new Error(`twse_fetch_failed stockId=${stockId} empty_body status=${lastStatus} RecCount=${recCount}`)
}

/**
 * 抓取 TWSE 分點彙總：RecCount 依 10 → 5 → 1 遞減，直到取得可用 HTML。
 * URL 僅使用 v、t、StkNo、RecCount，不加額外 query。
 */
export async function fetchTwseStockBranchDaily(params: { stockId: string }): Promise<TwseFetchResult> {
  const { stockId } = params
  let lastEmptyRec: number | undefined

  for (const recCount of REC_COUNT_STEPS) {
    try {
      const html = await fetchHtmlWithBackoff(stockId, recCount)
      const parsed = parseBsContentHtml(html, stockId)
      if (parsed.kind === 'no_trade_date') {
        continue
      }
      return parsed.data
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('empty_body')) {
        lastEmptyRec = recCount
        continue
      }
      throw e
    }
  }

  throw new Error(
    `twse_fetch_failed stockId=${stockId} after_RecCount_steps=${REC_COUNT_STEPS.join(',')}` +
      (lastEmptyRec !== undefined ? ` last_empty_RecCount=${lastEmptyRec}` : '')
  )
}
