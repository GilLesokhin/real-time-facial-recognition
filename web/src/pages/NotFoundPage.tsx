import { Link } from 'react-router-dom'

/** Also shown inside the admin panel for a building you can't manage, the same as the API's 404. */
export function NotFound() {
  return (
    <div className="card card-pad form-grid">
      <h1 className="title">404: Page not found</h1>
      <p className="muted">This page doesn't exist, or you don't have access to it.</p>
      <Link to="/" className="btn">
        Home
      </Link>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="center-page">
      <div style={{ width: 'min(420px, 100%)' }}>
        <NotFound />
      </div>
    </div>
  )
}
