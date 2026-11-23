/** A failed API call. `status` is 0 when the API couldn't be reached at all. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** `path` with the filled-in params as a query string. Empty and missing values are left out. */
export function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
  const text = query.toString()
  return text ? `${path}?${text}` : path
}

/**
 * Calls the API through the Vite proxy (`/api` → http://localhost:8000).
 * A `FormData` body is sent as multipart, with the browser's own Content-Type. Any other body is sent as JSON.
 * `bearer` is a terminal's key, sent as `Authorization: Bearer <key>`. Admin calls leave it out and use the cookie.
 */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; bearer?: string } = {},
): Promise<T> {
  const { body } = options
  const isForm = body instanceof FormData
  const headers: Record<string, string> = {}
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
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
