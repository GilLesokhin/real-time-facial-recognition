/** A failed API call. `status` is 0 when the API couldn't be reached at all. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface Options {
  method?: string
  /** Sent as JSON. */
  body?: unknown
  /** Sent as multipart/form-data, for uploads. */
  form?: FormData
  headers?: Record<string, string>
}

/**
 * Calls the API through the Vite proxy (`/api` → http://localhost:8000).
 */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { ...options.headers }
  let body: BodyInit | undefined = options.form
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  let res: Response
  try {
    res = await fetch(`/api${path}`, { method: options.method ?? 'GET', headers, body })
  } catch {
    throw new ApiError(0, "Can't reach the server.")
  }

  if (!res.ok) {
    let message = res.statusText
    try {
      const data: unknown = await res.json()
      // Our errors are {"detail": "..."}. Validation errors (422) have a list instead.
      if (data && typeof data === 'object' && 'detail' in data) {
        if (typeof data.detail === 'string') message = data.detail
        else if (Array.isArray(data.detail) && data.detail[0]?.msg) message = String(data.detail[0].msg)
      }
    } catch {
      // Not JSON, e.g. the proxy's own error page when the API is down.
    }
    throw new ApiError(res.status, message)
  }

  return (res.status === 204 ? undefined : await res.json()) as T
}

/** The person's face photo, for an <img>. `version` busts the browser cache after a new photo. */
export const personPhotoUrl = (personId: string, version?: string) =>
  `/api/people/${personId}/photo${version ? `?v=${encodeURIComponent(version)}` : ''}`

/** A data URL (from the photo picker) as a file to upload. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.')
