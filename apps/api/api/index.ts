/**
 * Vercel：直接 export Express app（Fluid Compute 原生支援，勿用 serverless-http）。
 * 本機 / Docker 仍走 src/index.ts 的 app.listen。
 */
import { createApp } from '../src/app.js'

export default createApp()
