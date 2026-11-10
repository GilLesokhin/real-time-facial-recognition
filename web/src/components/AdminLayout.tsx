import { Building2, History, LogOut, MonitorSmartphone, RotateCcw, ShieldCheck, Users } from 'lucide-react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../store/store'
import { Logo } from './Logo'

export function AdminLayout() {
  const {
    currentUser,
    currentUserId,
    signInOptions,
    visibleBuildings,
    currentBuilding,
    isPlatformAdmin,
    signInAs,
    selectBuilding,
    resetDemo,
    signOut,
  } = useStore()

  const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`
  if (!currentUser) return <Navigate to="/signin" replace />

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />

        {visibleBuildings.length > 1 ? (
          <label className="field">
            <span className="label">Building</span>
            <select className="select" value={currentBuilding?.id ?? ''} onChange={(e) => selectBuilding(e.target.value)}>
              {visibleBuildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          // Only one building (or none): show it as plain text, nothing to choose.
          <div className="field">
            <span className="label">Building</span>
            <span className="building-name">{currentBuilding?.name ?? 'No buildings'}</span>
          </div>
        )}

        <nav className="nav">
          <NavLink to="/admin/people" className={navClass}>
            <Users size={16} /> People
          </NavLink>
          <NavLink to="/admin/terminals" className={navClass}>
            <MonitorSmartphone size={16} /> Terminals
          </NavLink>
          <NavLink to="/admin/access-log" className={navClass}>
            <History size={16} /> Access log
          </NavLink>
          {isPlatformAdmin && (
            <>
              <NavLink to="/admin/buildings" className={navClass}>
                <Building2 size={16} /> Buildings
              </NavLink>
              <NavLink to="/admin/admins" className={navClass}>
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
          <label className="field">
            <span className="label">Demo · switch user</span>
            <select className="select" value={currentUserId ?? ''} onChange={(e) => signInAs(e.target.value)}>
              {signInOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-sm" onClick={resetDemo}>
            <RotateCcw size={14} /> Reset demo data
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
