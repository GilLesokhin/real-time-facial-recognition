import { useOutletContext } from 'react-router-dom'
import type { Person } from '../../types'

/** What the add/edit popup (a nested route) gets from the People page. */
export interface PeopleOutlet {
  /** Every active person in the building, or null while loading. */
  everyone: Person[] | null
  reload: () => void
}

export const usePeopleOutlet = () => useOutletContext<PeopleOutlet>()
