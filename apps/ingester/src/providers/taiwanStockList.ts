/**
 * 合併「上市」與「上櫃」當日可取得的標的代號，供全量爬蟲使用。
 * - 上市：證交所 OpenAPI exchangeReport/STOCK_DAY_ALL（最近交易日有成交者）
 * - 上櫃：櫃買行情 JSON（四碼數字代號 + 名稱排除權證/債券字樣）
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const WARRANT_OR_DEBT_RE = /認購|認售|牛證|熊證|權證|債券|公司債|金融債|乙種/

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

async function fetchJsonWithRetry<T>(url: string, init: RequestInit, label: string): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          'user-agent': UA,
          accept: 'application/json,text/plain,*/*',
          ...init.headers
        }
      })
      if (!res.ok) {
        throw new Error(`${label} http_${res.status}`)
      }
      return (await res.json()) as T
    } catch (e) {
      lastErr = e
      await sleep(400 * attempt)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

type TwseDayAllRow = { Code?: string }

/** 證交所 STOCK_DAY_ALL 全部 Code（含 ETF、債券型商品代號等） */
async function fetchTwseStockDayAllCodesRaw(): Promise<string[]> {
  const url = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'
  const rows = await fetchJsonWithRetry<TwseDayAllRow[]>(url, { method: 'GET' }, 'twse_stock_day_all')
  const set = new Set<string>()
  for (const r of rows) {
    const c = (r.Code ?? '').trim()
    if (c) set.add(c)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

const TWSE_BSCONTENT_CODE = /^[0-9]{4}$/

/**
 * bshtm 分點頁對「純數字且非四碼」（如 006203）常回 empty body；四碼（含 0050 類 ETF）較穩。
 */
export function filterCodesCompatibleWithTwseBsContent(codes: string[]): string[] {
  return codes.filter((c) => TWSE_BSCONTENT_CODE.test(c.trim())).sort((a, b) => a.localeCompare(b))
}

type TpexQuotesJson = {
  tables?: Array<{
    title?: string
    data?: string[][]
  }>
}

/** 櫃買：僅四碼數字普通標的（約八百多家），排除名稱含權證/債券關鍵字 */
async function fetchTpexFourDigitStockCodes(): Promise<string[]> {
  const url =
    'https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json'
  const j = await fetchJsonWithRetry<TpexQuotesJson>(url, { method: 'GET' }, 'tpex_stk_quote_result')
  const table = j.tables?.find((t) => (t.title ?? '').includes('上櫃股票行情'))
  const rows = table?.data ?? []
  const four = /^[0-9]{4}$/
  const set = new Set<string>()
  for (const row of rows) {
    if (!row?.length) continue
    const code = row[0]?.trim() ?? ''
    const name = row[1] ?? ''
    if (!four.test(code)) continue
    if (WARRANT_OR_DEBT_RE.test(name)) continue
    set.add(code)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export type TaiwanStockUniverse = 'twse' | 'merged'

/** TWSE_STOCKS=all 時依 universe 決定是否合併櫃買四碼 */
export async function fetchTaiwanTradableStockCodes(universe: TaiwanStockUniverse): Promise<string[]> {
  if (universe === 'twse') {
    const raw = await fetchTwseStockDayAllCodesRaw()
    return filterCodesCompatibleWithTwseBsContent(raw)
  }
  const twseFiltered = filterCodesCompatibleWithTwseBsContent(await fetchTwseStockDayAllCodesRaw())
  const tpex = await fetchTpexFourDigitStockCodes()
  const merged = new Set<string>([...twseFiltered, ...tpex])
  return [...merged].sort((a, b) => a.localeCompare(b))
}
