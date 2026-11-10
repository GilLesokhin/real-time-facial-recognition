import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useStore } from '../store/store'

const ERRORS = {
  unknown: 'Wrong email or password.',
  unassigned: "Your account doesn't have access yet. A Platform Admin needs to give you a role.",
}

export function SignInPage() {
  const { currentUser, signIn } = useStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (currentUser) return <Navigate to="/admin/people" replace />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    const failure = signIn(email)
    if (failure) return setError(ERRORS[failure])
    navigate('/admin/people')
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
          <button type="submit" className="btn btn-primary">
            Sign in
          </button>
          <p className="small muted" style={{ textAlign: 'center' }}>
            No account?{' '}
            <Link to="/signup" className="text-link">
              Sign up
            </Link>
          </p>
        </form>
        <p className="small faint demo-hint">
          Demo: any password works. Try avi@example.com (Platform Admin), maya@example.com (Building Admin) or
          noa@example.com (Unassigned).
        </p>
      </div>
    </div>
  )
}
