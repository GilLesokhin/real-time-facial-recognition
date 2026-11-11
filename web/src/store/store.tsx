import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { useAuth } from './auth'
import { seedBuildings, seedEvents, seedPeople, seedTerminals, seedUsers } from '../data/seed'
import { newId } from '../lib/format'
import type { AccessEvent, AccessResult, Building, Person, Terminal, User, UserRole } from '../types'

/**
 * Mock data: everything except sign-in lives in this store and in localStorage.
 * Each action maps to one backend endpoint (noted beside it). Sign-in is real: see ./auth.
 */

interface State {
  users: User[]
  buildings: Building[]
  terminals: Terminal[]
  people: Person[]
  events: AccessEvent[]
  currentBuildingId: string | null
}

type Action =
  | { type: 'selectBuilding'; buildingId: string | null }
  | { type: 'updateUser'; user: User }
  | { type: 'removeUser'; id: string }
  | { type: 'addBuilding'; building: Building }
  | { type: 'updateBuilding'; building: Building }
  | { type: 'removeBuilding'; id: string }
  | { type: 'addTerminal'; terminal: Terminal }
  | { type: 'updateTerminal'; terminal: Terminal }
  | { type: 'removeTerminal'; id: string }
  | { type: 'addPerson'; person: Person }
  | { type: 'updatePerson'; person: Person }
  | { type: 'removePerson'; id: string }
  | { type: 'logEvent'; event: AccessEvent }
  | { type: 'reset' }

const STORAGE_KEY = 'building-entry-demo-v6'

const initialState = (): State => ({
  users: seedUsers,
  buildings: seedBuildings,
  terminals: seedTerminals,
  people: seedPeople,
  events: seedEvents,
  currentBuildingId: 'b-north',
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

const buildingsFor = (state: State, user: User | null) => {
  if (!user || user.role === 'unassigned') return []
  if (user.role === 'platform_admin') return state.buildings
  return state.buildings.filter((b) => user.building_ids.includes(b.id))
}

const replace = <T extends { id: string }>(list: T[], item: T) => list.map((x) => (x.id === item.id ? item : x))

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'selectBuilding':
      return { ...state, currentBuildingId: action.buildingId }

    case 'updateUser':
      return { ...state, users: replace(state.users, action.user) }
    case 'removeUser':
      return { ...state, users: state.users.filter((u) => u.id !== action.id) }

    case 'addBuilding':
      return { ...state, buildings: [...state.buildings, action.building], currentBuildingId: action.building.id }
    case 'updateBuilding':
      return { ...state, buildings: replace(state.buildings, action.building) }
    case 'removeBuilding':
      return {
        ...state,
        buildings: state.buildings.filter((b) => b.id !== action.id),
        terminals: state.terminals.filter((t) => t.building_id !== action.id),
        people: state.people.filter((p) => p.building_id !== action.id),
        events: state.events.filter((e) => e.building_id !== action.id),
        users: state.users.map((u) =>
          u.building_ids.includes(action.id) ? { ...u, building_ids: u.building_ids.filter((id) => id !== action.id) } : u,
        ),
      }

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

function useStoreValue() {
  const { user: currentUser } = useAuth()
  const [state, dispatch] = useReducer(reduce, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota exceeded (large photos) or storage blocked: keep working in memory.
    }
  }, [state])

  return useMemo(() => {
    const visibleBuildings = buildingsFor(state, currentUser)
    // Falls back to the first visible building if the selected one was removed or isn't visible.
    const currentBuilding = visibleBuildings.find((b) => b.id === state.currentBuildingId) ?? visibleBuildings[0] ?? null

    return {
      state,
      currentUser,
      isPlatformAdmin: currentUser?.role === 'platform_admin',
      visibleBuildings,
      currentBuilding,

      selectBuilding: (buildingId: string | null) => dispatch({ type: 'selectBuilding', buildingId }),

      // PATCH /users/:id (role + buildings), DELETE /users/:id. Platform Admin only.
      setUserAccess: (user: User, role: UserRole, buildingIds: string[]) =>
        dispatch({
          type: 'updateUser',
          user: { ...user, role, building_ids: role === 'building_admin' ? buildingIds : [] },
        }),
      removeUser: (id: string) => dispatch({ type: 'removeUser', id }),

      // POST /buildings, PATCH /buildings/:id, DELETE /buildings/:id
      addBuilding: (name: string, address: string) =>
        dispatch({ type: 'addBuilding', building: { id: newId('b'), name, address } }),
      updateBuilding: (building: Building) => dispatch({ type: 'updateBuilding', building }),
      removeBuilding: (id: string) => dispatch({ type: 'removeBuilding', id }),

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
  }, [state, currentUser])
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
