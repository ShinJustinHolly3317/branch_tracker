/**
 * Vercel Serverless：build 後從 dist 載入 Express（monorepo 已先 compile @twbbd/shared）。
 * Root Directory = apps/api；build 見 vercel.json。
 */
import serverless from 'serverless-http'

import { createApp } from '../dist/app.js'

const handler = serverless(createApp())
export default handler
