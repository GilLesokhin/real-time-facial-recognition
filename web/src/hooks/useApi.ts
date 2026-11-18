import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../lib/api'

interface Loaded<T> {
  path: string
  data: T | null
  error: string | null
}

/**
 * Loads `path` from the API, and again whenever `path` changes or `reload()` is called. Pass null to wait.
 * `data` is null while a new path loads, so a page never shows another path's data.
 * After `reload()`, the old data stays on screen until the new data arrives.
 */
export function useApi<T>(path: string | null) {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    api<T>(path)
      .then((data) => !cancelled && setLoaded({ path, data, error: null }))
      .catch((err) => !cancelled && setLoaded({ path, data: null, error: errorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [path, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const current = loaded?.path === path ? loaded : null
  return { data: current?.data ?? null, error: current?.error ?? null, reload }
}
