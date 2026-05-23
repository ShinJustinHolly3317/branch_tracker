import express from 'express'
import { createApp } from './createApp.js'

/** Vercel 入口：官方範例為同檔建立 app 後 export default app */
const app: express.Express = createApp()
export default app
