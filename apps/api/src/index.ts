import { createApp } from './app.js'
import { getEnv } from './env.js'

const app = createApp()
const env = getEnv()
app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on :${env.PORT}`)
})
