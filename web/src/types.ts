export interface Building {
  id: string
  name: string
  address: string
}

/** A door with a camera and screen. One terminal per entry point. */
export interface Terminal {
  id: string
  building_id: string
  name: string
}

/** One row of the Terminals page. */
export interface TerminalListItem extends Terminal {
  // GIL-79 (Identify + access log): the terminal's newest event, if any.
  // latest_event: { result: AccessResult; created_at: string } | null
}

/** From GET /terminals/:id/key: the terminal's key, with the names the door tab shows. */
export interface TerminalKey extends Terminal {
  key: string
  building_name: string
}

export interface Person {
  id: string
  building_id: string
  name: string
  unit: string
  photo: string | null
  created_at: string
}

/** Someone who signs in to the admin panel. Separate from the people who walk through the door. */
export type UserRole = 'unassigned' | 'building_admin' | 'platform_admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  /** The one building a Building Admin manages. Null for everyone else (Platform Admins see all). */
  building_id: string | null
  created_at: string
}

export type AccessResult = 'granted' | 'denied'

export interface AccessEvent {
  id: string
  building_id: string
  terminal_id: string
  result: AccessResult
  person_id: string | null
  at: string
}
