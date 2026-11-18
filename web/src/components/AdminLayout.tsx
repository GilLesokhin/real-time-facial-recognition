import { Building2, History, LogOut, MonitorSmartphone, ShieldCheck, Users } from 'lucide-react'
import { Navigate, NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom'
import { NotFound } from '../pages/NotFoundPage'
import { useAuth } from '../store/auth'
import { useStore } from '../store/store'
import { Logo } from './Logo'

export function AdminLayout() {
  const { status, user: currentUser, signOut } = useAuth()
  const { visibleBuildings, isPlatformAdmin, buildingsLoaded } = useStore()
  const navigate = useNavigate()
  // The building in the URL. On /buildings and /users, the nav links point at the first building.
  const match = useMatch('/buildings/:buildingId/*')
  const urlBuildingId = match?.params.buildingId
  const building = visibleBuildings.find((b) => b.id === (urlBuildingId ?? visibleBuildings[0]?.id)) ?? null
  // Switching building keeps you on the same page: people stays people.
  const section = match?.params['*']?.split('/')[0] || 'terminals'

  const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`
  // Still asking the API whether the session cookie is valid: don't flash the sign-in page.
  if (status === 'loading') return null
  if (!currentUser) return <Navigate to="/login" replace />
  if (!buildingsLoaded) return null

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />

        {/* Only a Platform Admin reaches more than one building. */}
        {isPlatformAdmin && visibleBuildings.length > 1 ? (
          <label className="field">
            <span className="label">Building</span>
            <select className="select" value={building?.id ?? ''} onChange={(e) => navigate(`/buildings/${e.target.value}/${section}`)}>
              {visibleBuildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="field">
            <span className="label">Building</span>
            <span className="building-name">{building?.name ?? 'No buildings'}</span>
          </div>
        )}

        <nav className="nav">
          {building && (
            <>
              <NavLink to={`/buildings/${building.id}/terminals`} className={navClass}>
                <MonitorSmartphone size={16} /> Terminals
              </NavLink>
              <NavLink to={`/buildings/${building.id}/people`} className={navClass}>
                <Users size={16} /> People
              </NavLink>
              <NavLink to={`/buildings/${building.id}/access-log`} className={navClass}>
                <History size={16} /> Access log
              </NavLink>
            </>
          )}
          {isPlatformAdmin && (
            <>
              <NavLink to="/buildings" end className={navClass}>
                <Building2 size={16} /> Buildings
              </NavLink>
              <NavLink to="/users" className={navClass}>
                <ShieldCheck size={16} /> Admins
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="signed-in">
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className="truncate">{currentUser.name}</span>
              <span className="small faint">
                {currentUser.role === 'platform_admin' ? 'Platform Admin' : 'Building Admin'}
              </span>
            </div>
            <button type="button" className="icon-btn" aria-label="Sign out" title="Sign out" onClick={signOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        {urlBuildingId && building?.id !== urlBuildingId ? <NotFound /> : <Outlet />}
      </main>
    </div>
  )
}
