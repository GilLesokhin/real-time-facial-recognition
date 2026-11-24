import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useAuth } from '../store/useAuth'
import { useStore } from '../store/store'

export function WelcomePage() {
  const { status, user } = useAuth()
  const { homePath } = useStore()

  // Still asking the API whether the session cookie is valid: don't flash the wrong buttons.
  if (status === 'loading') return null

  return (
    <div className="center-page">
      <div className="card card-pad form-grid" style={{ width: 'min(420px, 100%)' }}>
        <Logo />
        <div>
          <h1 className="title">Real Time Facial Recognition</h1>
          <p className="muted">Face-recognition entry for your buildings.</p>
        </div>
        {user ? (
          <Link to={homePath} className="btn btn-primary">
            Go to the admin panel
          </Link>
        ) : (
          <>
            <Link to="/login" className="btn btn-primary">
              Sign in
            </Link>
            <Link to="/signup" className="btn">
              Sign up
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
