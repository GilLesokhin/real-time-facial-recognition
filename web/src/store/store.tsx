import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from './auth'
import { seedEvents, seedPeople, seedTerminals } from '../data/seed'
import { api } from '../lib/api'
import { newId } from '../lib/format'
import type { AccessEvent, AccessResult, Building, Person, Terminal, User, UserRole } from '../types'

/**
 * Mock data: everything except sign-in, buildings and users lives in this store and in localStorage.
 * Each action maps to one backend endpoint (noted beside it). Sign-in (see ./auth), buildings and users are real.
 */

interface State {
  terminals: Terminal[]
  people: Person[]
  events: AccessEvent[]
}

type Action =
  | { type: 'addTerminal'; terminal: Terminal }
  | { type: 'updateTerminal'; terminal: Terminal }
  | { type: 'removeTerminal'; id: string }
  | { type: 'addPerson'; person: Person }
  | { type: 'updatePerson'; person: Person }
  | { type: 'removePerson'; id: string }
  | { type: 'logEvent'; event: AccessEvent }
  | { type: 'reset' }

const STORAGE_KEY = 'building-entry-demo-v8'

const initialState = (): State => ({
  terminals: seedTerminals,
  people: seedPeople,
  events: seedEvents,
})

const loadState = (): State => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    // Storage unavailable or corrupt: start from seed data.
  }
  return initialState()
}

const replace = <T extends { id: string }>(list: T[], item: T) => list.map((x) => (x.id === item.id ? item : x))

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'addTerminal':
      return { ...state, terminals: [...state.terminals, action.terminal] }
    case 'updateTerminal':
      return { ...state, terminals: replace(state.terminals, action.terminal) }
    case 'removeTerminal':
      return { ...state, terminals: state.terminals.filter((t) => t.id !== action.id) }

    case 'addPerson':
      return { ...state, people: [action.person, ...state.people] }
    case 'updatePerson':
      return { ...state, people: replace(state.people, action.person) }
    case 'removePerson':
      return { ...state, people: state.people.filter((p) => p.id !== action.id) }

    case 'logEvent':
      return { ...state, events: [action.event, ...state.events].slice(0, 500) }
    case 'reset':
      return initialState()
  }
}

// Real API calls for the Admins page, Platform Admin only. Each throws ApiError, e.g. 403 for your own account.
// Outside the store's state, so the page reloads the list itself after a change.

/** GET /users. Filters are optional. Unassigned users come first, then by name. */
const listUsers = (filters: { role?: UserRole; building?: string; q?: string } = {}) => {
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

function useStoreValue() {
  const { user: currentUser } = useAuth()
  const [state, dispatch] = useReducer(reduce, undefined, loadState)
  // From GET /buildings: only the buildings this admin can reach.
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota exceeded (large photos) or storage blocked: keep working in memory.
    }
  }, [state])

  return useMemo(() => {
    return {
      state,
      currentUser,
      isPlatformAdmin: currentUser?.role === 'platform_admin',
      buildingsLoaded: buildings !== null,
      /** The buildings this admin can reach: all for a Platform Admin, their one building for a Building Admin. */
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

      // POST /buildings/:id/terminals, PATCH /terminals/:id, DELETE /terminals/:id
      addTerminal: (buildingId: string, name: string) =>
        dispatch({ type: 'addTerminal', terminal: { id: newId('t'), building_id: buildingId, name } }),
      updateTerminal: (terminal: Terminal) => dispatch({ type: 'updateTerminal', terminal }),
      removeTerminal: (id: string) => dispatch({ type: 'removeTerminal', id }),

      // POST /buildings/:id/people, PATCH /people/:id, DELETE /people/:id
      addPerson: (input: Omit<Person, 'id' | 'created_at'>) =>
        dispatch({ type: 'addPerson', person: { ...input, id: newId('p'), created_at: new Date().toISOString() } }),
      updatePerson: (person: Person) => dispatch({ type: 'updatePerson', person }),
      removePerson: (id: string) => dispatch({ type: 'removePerson', id }),

      // Written by the backend inside POST /terminals/:id/identify
      logEvent: (terminal: Terminal, result: AccessResult, personId: string | null) =>
        dispatch({
          type: 'logEvent',
          event: {
            id: newId('ev'),
            building_id: terminal.building_id,
            terminal_id: terminal.id,
            result,
            person_id: personId,
            at: new Date().toISOString(),
          },
        }),

      resetDemo: () => dispatch({ type: 'reset' }),
    }
  }, [state, currentUser, buildings, reloadBuildings])
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
