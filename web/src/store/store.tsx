import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Building } from '../types'
import { useAuth } from './auth'

/**
 * The buildings the signed-in admin can reach, shared by every admin page.
 * Each page loads its own data (people, terminals, ...) with `useApi`.
 */
function useStoreValue() {
  const { user: currentUser } = useAuth()
  // Tagged with whose list it is, so a new sign-in never sees the previous user's buildings.
  const [loaded, setLoaded] = useState<{ userId: string; buildings: Building[] } | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    const save = (buildings: Building[]) => !cancelled && setLoaded({ userId: currentUser.id, buildings })
    api<Building[]>('/buildings')
      .then(save)
      .catch(() => save([]))
    return () => {
      cancelled = true
    }
  }, [currentUser, version])

  return useMemo(() => {
    const buildings = currentUser && loaded?.userId === currentUser.id ? loaded.buildings : null
    const visibleBuildings = buildings ?? []
    return {
      currentUser,
      isPlatformAdmin: currentUser?.role === 'platform_admin',
      /** False until GET /buildings answers for the signed-in user. */
      buildingsLoaded: buildings !== null,
      visibleBuildings,
      /** Where an admin lands: their (first) building's terminals, or the Buildings list if they have none. */
      homePath: visibleBuildings[0] ? `/buildings/${visibleBuildings[0].id}/terminals` : '/buildings',
      /** Call after adding, editing or deleting a building. */
      reloadBuildings: () => setVersion((v) => v + 1),
    }
  }, [loaded, currentUser])
}

type Store = ReturnType<typeof useStoreValue>

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreValue()
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}

/** The building in the URL (`/buildings/:buildingId/...`). AdminLayout shows Not found before a page can ask for one you can't reach. */
export function useCurrentBuilding() {
  const { buildingId } = useParams()
  const building = useStore().visibleBuildings.find((b) => b.id === buildingId)
  if (!building) throw new Error('useCurrentBuilding must be used under /buildings/:buildingId')
  return building
}
