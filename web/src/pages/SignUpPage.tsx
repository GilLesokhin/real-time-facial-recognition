import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useStore } from '../store/store'

/** Public sign-up. New accounts are unassigned until a Platform Admin gives them a role. */
export function SignUpPage() {
  const { state, signUp } = useStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return setError('Enter your name and email.')
    if (password.length < 8) return setError('Use at least 8 characters for the password.')
    if (password !== confirm) return setError("The passwords don't match.")
    if (state.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
      return setError('That email already has an account.')
    // The demo doesn't store the password: the backend hashes it.
    signUp(name.trim(), email.trim())
    setDone(true)
  }

  return (
    <div className="center-page">
      <div className="card card-pad" style={{ width: 'min(420px, 100%)' }}>
        <Logo />
        {done ? (
          <>
            <h1 className="title">Waiting for approval</h1>
            <p className="muted">
              Your account is created. A Platform Admin will give you access to your buildings, and then you can sign
              in.
            </p>
            <Link to="/signin" className="btn">
              Back to sign in
            </Link>
          </>
        ) : (
          <form className="form-grid auth-form" onSubmit={onSubmit} noValidate>
            <div>
              <h1 className="title">Create an admin account</h1>
              <p className="muted">For building staff. A Platform Admin gives new accounts a role and buildings.</p>
            </div>
            <label className="field">
              <span className="label">Full name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span className="label">Confirm password</span>
              <input
                className="input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error && <p className="small error">{error}</p>}
            <button type="submit" className="btn btn-primary">
              Sign up
            </button>
            <p className="small muted" style={{ textAlign: 'center' }}>
              Already have an account?{' '}
              <Link to="/signin" className="text-link">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
