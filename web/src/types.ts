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
