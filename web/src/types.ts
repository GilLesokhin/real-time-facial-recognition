export interface Building {
  id: string
  name: string
  address: string
}

/** A door with a camera and screen. One terminal per entry point. */
export interface Terminal {
  id: string
  buildingId: string
  name: string
}

export interface Person {
  id: string
  buildingId: string
  name: string
  unit: string
  photo: string | null
  createdAt: string
}

/** Someone who signs in to the admin panel. Separate from the people who walk through the door. */
export type UserRole = 'unassigned' | 'building_admin' | 'platform_admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  /** Buildings a Building Admin manages. Empty for unassigned users and Platform Admins (who see all). */
  buildingIds: string[]
  createdAt: string
}

export type AccessResult = 'granted' | 'denied'

export interface AccessEvent {
  id: string
  buildingId: string
  terminalId: string
  result: AccessResult
  personId: string | null
  at: string
}
