/** These match the API's responses. See http://localhost:8000/docs. */

export interface Building {
  id: string
  name: string
  address: string
}

export type AccessResult = 'granted' | 'denied'

/** A door with a camera and screen. One terminal per entry point. */
export interface Terminal {
  id: string
  building_id: string
  name: string
  /** The newest check at this door. Null when there's none yet. */
  last_result: AccessResult | null
  last_at: string | null
}

/** What the door screen shows. */
export interface TerminalScreen {
  id: string
  name: string
  building_id: string
  building_name: string
}

/** Someone allowed through the door. The photo loads from `personPhotoUrl`. */
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
  /** The one building a Building Admin manages. Null for everyone else. */
  building_id: string | null
  created_at: string
}

export interface AccessEvent {
  id: string
  terminal_id: string
  terminal_name: string
  person_id: string | null
  person_name: string | null
  result: AccessResult
  /** Similarity of the nearest person. Null when nobody is enrolled. */
  score: number | null
  created_at: string
}

export interface IdentifyResult {
  result: AccessResult
  person: { id: string; name: string } | null
  score: number | null
}
