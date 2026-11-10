import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { seedBuildings, seedEvents, seedPeople, seedTerminals, seedUsers } from '../data/seed'
import { newId } from '../lib/format'
import type { AccessEvent, AccessResult, Building, Person, Terminal, User, UserRole } from '../types'

/**
 * Front-end only: all data lives in this store and in localStorage.
 * Each action maps to one backend endpoint (noted beside it).
 */

interface State {
  users: User[]
  buildings: Building[]
  terminals: Terminal[]
  people: Person[]
  events: AccessEvent[]
  /** Demo sign-in: stands in for POST /auth/login. */
  /** null when signed out. */
  currentUserId: string | null
  currentBuildingId: string | null
}

type Action =
  | { type: 'signInAs'; userId: string | null }
  | { type: 'selectBuilding'; buildingId: string | null }
  | { type: 'signUp'; user: User }
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

const STORAGE_KEY = 'building-entry-demo-v4'

const initialState = (): State => ({
  users: seedUsers,
  buildings: seedBuildings,
  terminals: seedTerminals,
  people: seedPeople,
  events: seedEvents,
  currentUserId: 'u-maya',
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

/** Unassigned users can't use the panel. */
const canSignIn = (user: User | undefined) => !!user && user.role !== 'unassigned'

const buildingsFor = (state: State, user: User | undefined) => {
  if (!user || user.role === 'unassigned') return []
  if (user.role === 'platform_admin') return state.buildings
  return state.buildings.filter((b) => user.buildingIds.includes(b.id))
}

/** Keeps the signed-in user and selected building valid after any change. */
function settle(state: State): State {
  const current = state.users.find((u) => u.id === state.currentUserId)
  // Deleted or unassigned users are signed out.
  const user = canSignIn(current) ? current : undefined
  const visible = buildingsFor(state, user)
  const buildingId = visible.some((b) => b.id === state.currentBuildingId)
    ? state.currentBuildingId
    : (visible[0]?.id ?? null)
  const userId = user?.id ?? null
  return userId === state.currentUserId && buildingId === state.currentBuildingId
    ? state
    : { ...state, currentUserId: userId, currentBuildingId: buildingId }
}

const replace = <T extends { id: string }>(list: T[], item: T) => list.map((x) => (x.id === item.id ? item : x))

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'signInAs':
      return { ...state, currentUserId: action.userId }
    case 'selectBuilding':
      return { ...state, currentBuildingId: action.buildingId }

    case 'signUp':
      return { ...state, users: [...state.users, action.user] }
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
        terminals: state.terminals.filter((t) => t.buildingId !== action.id),
        people: state.people.filter((p) => p.buildingId !== action.id),
        events: state.events.filter((e) => e.buildingId !== action.id),
        users: state.users.map((u) =>
          u.buildingIds.includes(action.id) ? { ...u, buildingIds: u.buildingIds.filter((id) => id !== action.id) } : u,
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

const reducer = (state: State, action: Action) => settle(reduce(state, action))

function useStoreValue() {
  const [state, dispatch] = useReducer(reducer, undefined, () => settle(loadState()))

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota exceeded (large photos) or storage blocked: keep working in memory.
    }
  }, [state])

  return useMemo(() => {
    const currentUser = state.users.find((u) => u.id === state.currentUserId)
    const visibleBuildings = buildingsFor(state, currentUser)
    const currentBuilding = visibleBuildings.find((b) => b.id === state.currentBuildingId) ?? null

    return {
      state,
      currentUser,
      currentUserId: state.currentUserId,
      isPlatformAdmin: currentUser?.role === 'platform_admin',
      /** Approved users, for the demo "signed in as" switcher. */
      signInOptions: state.users.filter(canSignIn),
      visibleBuildings,
      currentBuilding,

      signInAs: (userId: string) => dispatch({ type: 'signInAs', userId }),
      /**
       * POST /auth/login. The demo checks the email only: any password works.
       * Returns why sign-in failed, or null on success.
       */
      signIn: (email: string): 'unknown' | 'unassigned' | null => {
        const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (!user) return 'unknown'
        if (!canSignIn(user)) return 'unassigned'
        dispatch({ type: 'signInAs', userId: user.id })
        return null
      },
      // POST /auth/logout
      signOut: () => dispatch({ type: 'signInAs', userId: null }),
      selectBuilding: (buildingId: string | null) => dispatch({ type: 'selectBuilding', buildingId }),

      // POST /auth/signup: creates an unassigned user with no access
      signUp: (name: string, email: string) =>
        dispatch({
          type: 'signUp',
          user: { id: newId('u'), name, email, role: 'unassigned', buildingIds: [], createdAt: new Date().toISOString() },
        }),
      // PATCH /users/:id (role + buildings), DELETE /users/:id. Platform Admin only.
      setUserAccess: (user: User, role: UserRole, buildingIds: string[]) =>
        dispatch({
          type: 'updateUser',
          user: { ...user, role, buildingIds: role === 'building_admin' ? buildingIds : [] },
        }),
      removeUser: (id: string) => dispatch({ type: 'removeUser', id }),

      // POST /buildings, PATCH /buildings/:id, DELETE /buildings/:id
      addBuilding: (name: string, address: string) =>
        dispatch({ type: 'addBuilding', building: { id: newId('b'), name, address } }),
      updateBuilding: (building: Building) => dispatch({ type: 'updateBuilding', building }),
      removeBuilding: (id: string) => dispatch({ type: 'removeBuilding', id }),

      // POST /buildings/:id/terminals, PATCH /terminals/:id, DELETE /terminals/:id
      addTerminal: (buildingId: string, name: string) =>
        dispatch({ type: 'addTerminal', terminal: { id: newId('t'), buildingId, name } }),
      updateTerminal: (terminal: Terminal) => dispatch({ type: 'updateTerminal', terminal }),
      removeTerminal: (id: string) => dispatch({ type: 'removeTerminal', id }),

      // POST /buildings/:id/people, PATCH /people/:id, DELETE /people/:id
      addPerson: (input: Omit<Person, 'id' | 'createdAt'>) =>
        dispatch({ type: 'addPerson', person: { ...input, id: newId('p'), createdAt: new Date().toISOString() } }),
      updatePerson: (person: Person) => dispatch({ type: 'updatePerson', person }),
      removePerson: (id: string) => dispatch({ type: 'removePerson', id }),

      // Written by the backend inside POST /terminals/:id/identify
      logEvent: (terminal: Terminal, result: AccessResult, personId: string | null) =>
        dispatch({
          type: 'logEvent',
          event: {
            id: newId('ev'),
            buildingId: terminal.buildingId,
            terminalId: terminal.id,
            result,
            personId,
            at: new Date().toISOString(),
          },
        }),

      resetDemo: () => dispatch({ type: 'reset' }),
    }
  }, [state])
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
