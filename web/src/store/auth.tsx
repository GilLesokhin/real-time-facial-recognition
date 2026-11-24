import type { ReactNode } from 'react'
import { AuthContext, useAuthValue } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthValue()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
