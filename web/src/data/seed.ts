import type { AccessEvent, Building, Person, Terminal, User } from '../types'

export const seedUsers: User[] = [
  { id: 'u-avi', name: 'Avi Rosen', email: 'avi@example.com', role: 'platform_admin', building_ids: [], created_at: '2026-10-01T10:00:00Z' },
  { id: 'u-maya', name: 'Maya Cohen', email: 'maya@example.com', role: 'building_admin', building_ids: ['b-north'], created_at: '2026-10-05T10:00:00Z' },
  { id: 'u-eli', name: 'Eli Barak', email: 'eli@example.com', role: 'building_admin', building_ids: ['b-harbor', 'b-cedar'], created_at: '2026-10-07T10:00:00Z' },
  { id: 'u-noa', name: 'Noa Stern', email: 'noa@example.com', role: 'unassigned', building_ids: [], created_at: '2026-11-09T18:20:00Z' },
  { id: 'u-dan', name: 'Dan Kaplan', email: 'dan@example.com', role: 'unassigned', building_ids: [], created_at: '2026-11-08T09:10:00Z' },
]

export const seedBuildings: Building[] = [
  { id: 'b-north', name: 'North Tower', address: '12 Herzl St, Tel Aviv' },
  { id: 'b-harbor', name: 'Harbor House', address: '4 Ha-Namal St, Haifa' },
  { id: 'b-cedar', name: 'Cedar Court', address: '88 Jaffa Rd, Jerusalem' },
]

export const seedTerminals: Terminal[] = [
  { id: 't-north-lobby', building_id: 'b-north', name: 'Main lobby' },
  { id: 't-north-garage', building_id: 'b-north', name: 'Garage' },
  { id: 't-north-back', building_id: 'b-north', name: 'Back door' },
  { id: 't-harbor-lobby', building_id: 'b-harbor', name: 'Main lobby' },
  { id: 't-harbor-pool', building_id: 'b-harbor', name: 'Pool gate' },
  { id: 't-cedar-lobby', building_id: 'b-cedar', name: 'Main lobby' },
  { id: 't-cedar-garage', building_id: 'b-cedar', name: 'Garage' },
]

const person = (
  id: string,
  building_id: string,
  name: string,
  unit: string,
  created_at: string,
): Person => ({ id, building_id, name, unit, photo: null, created_at })

export const seedPeople: Person[] = [
  person('p-1', 'b-north', 'Dana Levi', 'Apt 4B', '2026-11-02T10:00:00Z'),
  person('p-2', 'b-north', 'Omer Ben-David', 'Apt 7A', '2026-11-01T10:00:00Z'),
  person('p-3', 'b-north', 'Noa Shapira', 'Apt 2C', '2026-10-30T10:00:00Z'),
  person('p-4', 'b-north', 'Yossi Katz', 'Apt 11D', '2026-10-28T10:00:00Z'),
  person('p-5', 'b-north', 'Rina Avraham', 'Apt 5F', '2026-10-25T10:00:00Z'),
  person('p-6', 'b-north', 'Tal Mizrahi', 'Apt 9B', '2026-10-21T10:00:00Z'),
  person('p-7', 'b-north', 'Shira Gold', 'Apt 3A', '2026-10-18T10:00:00Z'),
  person('p-8', 'b-north', 'Amit Peretz', 'Apt 6E', '2026-10-14T10:00:00Z'),
  person('p-9', 'b-harbor', 'Lior Friedman', 'Apt 1A', '2026-10-20T10:00:00Z'),
  person('p-10', 'b-harbor', 'Michal Azoulay', 'Apt 8C', '2026-10-19T10:00:00Z'),
  person('p-11', 'b-cedar', 'Gal Shalom', 'Apt 2B', '2026-10-15T10:00:00Z'),
]

export const seedEvents: AccessEvent[] = [
  { id: 'ev-1', building_id: 'b-north', terminal_id: 't-north-lobby', result: 'granted', person_id: 'p-1', at: '2026-11-09T16:04:12Z' },
  { id: 'ev-2', building_id: 'b-north', terminal_id: 't-north-garage', result: 'granted', person_id: 'p-2', at: '2026-11-09T15:58:40Z' },
  { id: 'ev-3', building_id: 'b-north', terminal_id: 't-north-lobby', result: 'denied', person_id: null, at: '2026-11-09T15:41:05Z' },
  { id: 'ev-4', building_id: 'b-north', terminal_id: 't-north-back', result: 'granted', person_id: 'p-3', at: '2026-11-09T15:22:19Z' },
  { id: 'ev-5', building_id: 'b-north', terminal_id: 't-north-lobby', result: 'granted', person_id: 'p-4', at: '2026-11-09T14:55:02Z' },
  { id: 'ev-6', building_id: 'b-north', terminal_id: 't-north-garage', result: 'denied', person_id: null, at: '2026-11-09T14:30:47Z' },
  { id: 'ev-7', building_id: 'b-harbor', terminal_id: 't-harbor-lobby', result: 'granted', person_id: 'p-9', at: '2026-11-09T13:12:33Z' },
]
