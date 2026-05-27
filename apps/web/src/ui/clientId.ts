const STORAGE_KEY = 'twbbd:clientId'

/** 匿名使用者 ID，供最愛清單 API 使用 */
export function getClientId(): string {
  if (typeof localStorage === 'undefined') return 'anonymous-dev'
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}
