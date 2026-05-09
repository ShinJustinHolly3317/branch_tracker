import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string()
})

export type Env = z.infer<typeof EnvSchema>

export function getEnv(): Env {
  return EnvSchema.parse(process.env)
}

