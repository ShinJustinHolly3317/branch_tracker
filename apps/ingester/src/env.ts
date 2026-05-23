import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  QDATA_API_KEY: z.string().optional(),
  /** 未設定或空字串＝不要走 TWSE 分支（會進 fake / qdata） */
  TWSE_STOCKS: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined
      const s = String(v).trim()
      return s === '' ? undefined : s
    },
    z.string().optional()
  ),
  /**
   * TWSE_STOCKS=all 時標的清單來源：twse＝僅證交所 STOCK_DAY_ALL（與 bsContent 相容）；
   * merged＝再加櫃買四碼（多數無法用 TWSE 分點頁，略過會很多）
   */
  TW_STOCK_UNIVERSE: z.enum(['twse', 'merged']).default('twse'),
  /** 設為 1 時略過個股會印完整錯誤含 stack */
  DEBUG_INGEST: z
    .string()
    .optional()
    .transform((s) => s === '1' || (s ?? '').toLowerCase() === 'true'),
  /** 每檔股票請求後休眠毫秒數（避免塞爆 TWSE） */
  INGEST_MS_BETWEEN_STOCKS: z.coerce.number().int().min(0).max(60000).default(350),
  /** 同時爬幾支股票（並行數），預設 5，上限 20 */
  INGEST_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(5),
  /** 排程表達式（node-cron），預設週一至週五 18:00 台灣時間 */
  INGEST_CRON: z.string().default('0 18 * * 1-5'),
  /** IANA 時區，須與 INGEST_CRON 搭配 */
  INGEST_TZ: z.string().default('Asia/Taipei'),
  /** 啟動時是否立刻跑一次（除錯用） */
  INGEST_RUN_ON_START: z.enum(['true', 'false']).default('false')
})

export type Env = z.infer<typeof EnvSchema>

export function getEnv(): Env {
  return EnvSchema.parse(process.env)
}

