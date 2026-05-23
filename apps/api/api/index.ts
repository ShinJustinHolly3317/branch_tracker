/**
 * Vercel Serverless：將 Express 套用 serverless-http，所有路由掛載在站台根路徑（見 vercel.json rewrites）。
 * 需在 Vercel 專案設定 Root Directory = apps/api。
 */
import serverless from 'serverless-http'

import { createApp } from '../src/app.js'

const handler = serverless(createApp())
export default handler
