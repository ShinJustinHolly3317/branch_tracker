import { createApp } from './app.js'
import { getEnv } from './env.js'

/** 本機開發 / Docker 常駐；Vercel 走 src/app.ts 的 default export */
const app = createApp()
const env = getEnv()
app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on :${env.PORT}`)
})
