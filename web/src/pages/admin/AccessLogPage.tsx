import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { formatDateTime } from '../../lib/format'
import { useStore } from '../../store/store'
import type { AccessResult } from '../../types'

export function AccessLogPage() {
  const { state, currentBuilding } = useStore()
  const [terminalFilter, setTerminalFilter] = useState('')
  const [resultFilter, setResultFilter] = useState<AccessResult | ''>('')

  if (!currentBuilding) return <p className="card empty muted">No building selected.</p>

  const terminals = state.terminals.filter((t) => t.building_id === currentBuilding.id)
  const events = state.events.filter(
    (ev) =>
      ev.building_id === currentBuilding.id &&
      (!terminalFilter || ev.terminal_id === terminalFilter) &&
      (!resultFilter || ev.result === resultFilter),
  )

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">{currentBuilding.name}</span>
          <h1 className="title">Access log</h1>
          <p className="muted">Every check made by this building's terminals</p>
        </div>
        <div className="toolbar">
          <label className="field">
            <span className="label">Terminal</span>
            <select className="select" value={terminalFilter} onChange={(e) => setTerminalFilter(e.target.value)}>
              <option value="">All</option>
              {terminals.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Result</span>
            <select
              className="select"
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as AccessResult | '')}
            >
              <option value="">All</option>
              <option value="granted">Granted</option>
              <option value="denied">Denied</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card table-wrap">
        {events.length === 0 ? (
          <p className="empty muted">No entries yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th className="label">Time</th>
                <th className="label">Person</th>
                <th className="label">Terminal</th>
                <th className="label">Result</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const person = ev.person_id ? state.people.find((p) => p.id === ev.person_id) : undefined
                const terminal = state.terminals.find((t) => t.id === ev.terminal_id)
                return (
                  <tr key={ev.id}>
                    <td className="muted">{formatDateTime(ev.at)}</td>
                    <td>
                      {person ? (
                        <div className="cell-row">
                          <Avatar name={person.name} photo={person.photo} size={32} />
                          {person.name}
                        </div>
                      ) : (
                        <span className="faint">{ev.person_id ? 'Removed person' : 'Unknown face'}</span>
                      )}
                    </td>
                    <td className="muted">{terminal?.name ?? 'Removed terminal'}</td>
                    <td>
                      <span className={`badge badge-${ev.result}`}>{ev.result}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
