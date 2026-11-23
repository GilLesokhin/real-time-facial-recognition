import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from './auth'
import { api } from '../lib/api'
import type { AccessEvent, AccessResult, Building, Person, Terminal, TerminalListItem, User, UserRole } from '../types'

// Real API calls for the Admins page, Platform Admin only. Each throws ApiError, e.g. 403 for your own account.
// Outside the store's state, so the page reloads the list itself after a change.

/** GET /users. Filters are optional. Unassigned users come first, then by name. */
const listUsers = (filters: { role?: UserRole; building?: string; search?: string } = {}) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  const query = params.toString()
  return api<User[]>(query ? `/users?${query}` : '/users')
}

/** PATCH /users/:id. `buildingId` is used only for a Building Admin. Everyone else gets null. */
const setUserAccess = (user: User, role: UserRole, buildingId: string | null) =>
  api<User>(`/users/${user.id}`, {
    method: 'PATCH',
    body: { role, building_id: role === 'building_admin' ? buildingId : null },
  })

/** DELETE /users/:id */
const removeUser = (id: string) => api(`/users/${id}`, { method: 'DELETE' })

// Real API calls for terminals, any admin who can manage the building. Each throws ApiError, e.g. 409 when the name is taken.
// Outside the store's state, so the page reloads the list itself after a change.

/** GET /buildings/:id/terminals. By name. */
const listTerminals = (buildingId: string) => api<TerminalListItem[]>(`/buildings/${buildingId}/terminals`)

/** POST /buildings/:id/terminals */
const addTerminal = (buildingId: string, name: string) =>
  api<Terminal>(`/buildings/${buildingId}/terminals`, { method: 'POST', body: { name } })

/** PATCH /terminals/:id. Rename only. */
const renameTerminal = (id: string, name: string) => api<Terminal>(`/terminals/${id}`, { method: 'PATCH', body: { name } })

/** DELETE /terminals/:id. Its key stops working. Its past checks stay in the access log. */
const removeTerminal = (id: string) => api(`/terminals/${id}`, { method: 'DELETE' })

// Real API calls for people, any admin who can manage the building. Each throws ApiError:
// 413 for a photo over 1 MB, 422 for a photo with no face or more than one.
// Outside the store's state, so the page reloads the list itself after a change.

/** The text fields of the person form. */
export interface PersonFields {
  name: string
  apartment: string
}

/** Multipart body. `photo` is the face crop JPEG from PhotoPicker. */
const personForm = (fields: PersonFields, photo: Blob | null) => {
  const form = new FormData()
  form.set('name', fields.name)
  form.set('apartment', fields.apartment)
  if (photo) form.set('photo', photo, 'face.jpg')
  return form
}

/** GET /buildings/:id/people. By name. `search` looks in name and apartment. */
const listPeople = (buildingId: string, search = '') => {
  const query = search.trim() ? `?${new URLSearchParams({ search: search.trim() })}` : ''
  return api<Person[]>(`/buildings/${buildingId}/people${query}`)
}

/** POST /buildings/:id/people. The server keeps the face embedding and discards the photo. */
const addPerson = (buildingId: string, fields: PersonFields, photo: Blob) =>
  api<Person>(`/buildings/${buildingId}/people`, { method: 'POST', body: personForm(fields, photo) })

/** PATCH /people/:id. A new photo replaces the face. Without one, the face stays. */
const updatePerson = (id: string, fields: PersonFields, photo: Blob | null) =>
  api<Person>(`/people/${id}`, { method: 'PATCH', body: personForm(fields, photo) })

/** DELETE /people/:id. The door stops letting them in. Their past checks stay in the access log. */
const removePerson = (id: string) => api(`/people/${id}`, { method: 'DELETE' })

// Real API call for the access log, any admin who can manage the building.

/** GET /buildings/:id/access-log. The newest 100 checks, newest first. Both filters are optional. */
const listAccessLog = (buildingId: string, filters: { terminal?: string; result?: AccessResult } = {}) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  const query = params.toString()
  return api<AccessEvent[]>(`/buildings/${buildingId}/access-log${query ? `?${query}` : ''}`)
}

function useStoreValue() {
  const { user: currentUser } = useAuth()
  // From GET /buildings: only the buildings this admin can manage.
  // Tagged with the user, so a list loaded for someone else never shows after a new sign-in.
  const [loaded, setLoaded] = useState<{ userId: string; buildings: Building[] } | null>(null)
  const buildings = currentUser && loaded?.userId === currentUser.id ? loaded.buildings : null

  // After a change. The change already worked, so a failed reload keeps the old list instead of failing it.
  const reloadBuildings = useCallback(async () => {
    if (!currentUser) return
    try {
      setLoaded({ userId: currentUser.id, buildings: await api<Building[]>('/buildings') })
    } catch {
      // Keep the list we have.
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    api<Building[]>('/buildings')
      .then((list) => !cancelled && setLoaded({ userId: currentUser.id, buildings: list }))
      .catch(() => !cancelled && setLoaded({ userId: currentUser.id, buildings: [] }))
    return () => {
      cancelled = true
    }
  }, [currentUser])

  return useMemo(() => {
    return {
      currentUser,
      isPlatformAdmin: currentUser?.role === 'platform_admin',
      buildingsLoaded: buildings !== null,
      /** The buildings this admin can manage: all for a Platform Admin, their one building for a Building Admin. */
      visibleBuildings: buildings ?? [],
      /** Where an admin lands: a Building Admin's building, or the Buildings list for a Platform Admin. */
      homePath: currentUser?.building_id ? `/buildings/${currentUser.building_id}/terminals` : '/buildings',

      listUsers,
      setUserAccess,
      removeUser,

      // Real API calls, Platform Admin only. Each throws ApiError, e.g. 409 when the name is taken.
      addBuilding: async (name: string, address: string) => {
        await api<Building>('/buildings', { method: 'POST', body: { name, address } })
        await reloadBuildings()
      },
      updateBuilding: async (building: Building) => {
        await api<Building>(`/buildings/${building.id}`, {
          method: 'PATCH',
          body: { name: building.name, address: building.address },
        })
        await reloadBuildings()
      },
      /** Deactivates the building with its terminals and people. */
      removeBuilding: async (id: string) => {
        await api(`/buildings/${id}`, { method: 'DELETE' })
        await reloadBuildings()
      },

      listTerminals,
      addTerminal,
      renameTerminal,
      removeTerminal,

      listPeople,
      addPerson,
      updatePerson,
      removePerson,

      listAccessLog,
    }
  }, [currentUser, buildings, reloadBuildings])
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

/** The building in the URL (`/buildings/:buildingId/...`). AdminLayout shows Not found before a page can ask for one you can't manage. */
export function useCurrentBuilding() {
  const { buildingId } = useParams()
  const building = useStore().visibleBuildings.find((b) => b.id === buildingId)
  if (!building) throw new Error('useCurrentBuilding must be used under /buildings/:buildingId')
  return building
}
