import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { User } from '../types'

type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

/** The auth state behind <AuthProvider>. Only the provider calls this. Screens call useAuth. */
export function useAuthValue() {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)

  const setSignedIn = useCallback((u: User | null) => {
    setUser(u)
    setStatus(u ? 'signedIn' : 'signedOut')
  }, [])

  // On page load, ask the API whether the session cookie is still valid.
  useEffect(() => {
    let cancelled = false
    api<User>('/auth/me')
      .then((u) => !cancelled && setSignedIn(u))
      .catch(() => !cancelled && setSignedIn(null))
    return () => {
      cancelled = true
    }
  }, [setSignedIn])

  return useMemo(
    () => ({
      status,
      user,
      /** Throws ApiError: 401 wrong email or password, 403 not approved yet. */
      signIn: async (email: string, password: string) => {
        setSignedIn(await api<User>('/auth/login', { method: 'POST', body: { email, password } }))
      },
      /** Throws ApiError: 409 email taken. Doesn't sign you in. */
      signUp: async (name: string, email: string, password: string) => {
        await api<User>('/auth/signup', { method: 'POST', body: { name, email, password } })
      },
      signOut: async () => {
        try {
          await api('/auth/logout', { method: 'POST' })
        } finally {
          setSignedIn(null)
        }
      },
    }),
    [status, user, setSignedIn],
  )
}

type Auth = ReturnType<typeof useAuthValue>

export const AuthContext = createContext<Auth | null>(null)

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}
