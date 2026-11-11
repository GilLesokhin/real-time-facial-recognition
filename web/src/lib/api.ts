/** A failed API call. `status` is 0 when the API couldn't be reached at all. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Calls the Python API through the Vite proxy (`/api` → http://localhost:8000).
 * The browser sends the session cookie by itself; this code never sees it.
 */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, "Can't reach the server.")
  }

  if (!res.ok) {
    let message = res.statusText
    try {
      const data: unknown = await res.json()
      // Our errors are {"detail": "..."}. Validation errors (422) have a list instead.
      if (data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') message = data.detail
    } catch {
      // Not JSON, e.g. the proxy's own error page when the API is down.
    }
    throw new ApiError(res.status, message)
  }

  return (res.status === 204 ? undefined : await res.json()) as T
}
