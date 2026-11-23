import type { AccessEvent } from '../types'

export const seedEvents: AccessEvent[] = [
  { id: 'ev-1', building_id: 'b-north', terminal_id: 't-north-lobby', result: 'granted', person_id: 'p-1', at: '2026-11-09T16:04:12Z' },
  { id: 'ev-2', building_id: 'b-north', terminal_id: 't-north-garage', result: 'granted', person_id: 'p-2', at: '2026-11-09T15:58:40Z' },
  { id: 'ev-3', building_id: 'b-north', terminal_id: 't-north-lobby', result: 'denied', person_id: null, at: '2026-11-09T15:41:05Z' },
  { id: 'ev-4', building_id: 'b-north', terminal_id: 't-north-back', result: 'granted', person_id: 'p-3', at: '2026-11-09T15:22:19Z' },
  { id: 'ev-5', building_id: 'b-north', terminal_id: 't-north-lobby', result: 'granted', person_id: 'p-4', at: '2026-11-09T14:55:02Z' },
  { id: 'ev-6', building_id: 'b-north', terminal_id: 't-north-garage', result: 'denied', person_id: null, at: '2026-11-09T14:30:47Z' },
  { id: 'ev-7', building_id: 'b-harbor', terminal_id: 't-harbor-lobby', result: 'granted', person_id: 'p-9', at: '2026-11-09T13:12:33Z' },
]
