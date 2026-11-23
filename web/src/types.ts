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
  /** The terminal's newest check, or null when it has none. */
  latest_event: { result: AccessResult; created_at: string } | null
}

/** From GET /terminals/:id/key: the terminal's key, with the names the door tab shows. */
export interface TerminalKey extends Terminal {
  key: string
  building_name: string
}

/** Someone allowed through the door. The server keeps only their face embedding, never a photo. */
export interface Person {
  id: string
  building_id: string
  name: string
  apartment: string
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

/** One row of the Access log, from GET /buildings/:id/access-log. The server adds the names. */
export interface AccessEvent {
  id: string
  terminal_id: string
  terminal_name: string
  person_id: string | null
  /** Null for a denied check. */
  person_name: string | null
  result: AccessResult
  /** Similarity to the nearest person. Null when no face was found or no one is enrolled. */
  score: number | null
  created_at: string
}

/** The door's answer, from POST /terminals/:id/identify. */
export interface IdentifyResponse {
  result: AccessResult
  /** Set only when granted. */
  person_name: string | null
}
