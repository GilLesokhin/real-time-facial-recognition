import { useState, type SubmitEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { ApiError } from '../lib/api'
import { useAuth } from '../store/useAuth'
import { useStore } from '../store/store'

const errorMessage = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401) return 'Wrong email or password.'
  if (err instanceof ApiError && err.status === 403)
    return "Your account doesn't have access yet. A Platform Admin needs to give you a role."
  if (err instanceof ApiError && err.status === 422) return 'Enter a valid email address.'
  return "Can't reach the server. Try again in a moment."
}

export function SignInPage() {
  const { status, signIn } = useAuth()
  const { homePath } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Also runs right after a successful sign-in.
  if (status === 'signedIn') return <Navigate to={homePath} replace />

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setPending(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="center-page">
      <div className="card card-pad" style={{ width: 'min(420px, 100%)' }}>
        <Logo />
        <form className="form-grid auth-form" onSubmit={onSubmit} noValidate>
          <div>
            <h1 className="title">Sign in</h1>
            <p className="muted">Admin panel for building staff.</p>
          </div>
          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="small error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="small muted" style={{ textAlign: 'center' }}>
            No account?{' '}
            <Link to="/signup" className="text-link">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
