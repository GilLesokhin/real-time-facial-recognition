import { useEffect, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { formatDateTime } from '../../lib/format'
import { useCurrentBuilding, useStore } from '../../store/store'
import type { AccessEvent, AccessResult, Terminal } from '../../types'

export function AccessLogPage() {
  const { listAccessLog, listTerminals } = useStore()
  const currentBuilding = useCurrentBuilding()
  const [terminalFilter, setTerminalFilter] = useState('')
  const [resultFilter, setResultFilter] = useState<AccessResult | ''>('')
  // The active terminals, for the filter. The log itself carries the names, also of removed terminals.
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [events, setEvents] = useState<AccessEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listTerminals(currentBuilding.id)
      .then((list) => !cancelled && setTerminals(list))
      .catch(() => !cancelled && setTerminals([]))
    return () => {
      cancelled = true
    }
  }, [listTerminals, currentBuilding.id])

  useEffect(() => {
    // Ignore an answer that arrives after the building or a filter changed.
    let cancelled = false
    listAccessLog(currentBuilding.id, { terminal: terminalFilter, result: resultFilter || undefined })
      .then((list) => {
        if (cancelled) return
        setEvents(list)
        setError(null)
      })
      .catch(() => !cancelled && setError("Can't reach the server. Try again in a moment."))
    return () => {
      cancelled = true
    }
  }, [listAccessLog, currentBuilding.id, terminalFilter, resultFilter])

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">{currentBuilding.name}</span>
          <h1 className="title">Access log</h1>
          <p className="muted">The newest 100 checks made by this building's terminals</p>
        </div>
        <div className="toolbar">
          <label className="field">
            <span className="label">Terminal</span>
            <select className="select" value={terminalFilter} onChange={(e) => setTerminalFilter(e.target.value)}>
              <option value="">All</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
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

      {error && <p className="small error">{error}</p>}

      <div className="card table-wrap">
        {events === null ? null : events.length === 0 ? (
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
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="muted">{formatDateTime(ev.created_at)}</td>
                  <td>
                    {ev.person_name ? (
                      <div className="cell-row">
                        <Avatar name={ev.person_name} size={32} />
                        {ev.person_name}
                      </div>
                    ) : (
                      <span className="faint">Unknown face</span>
                    )}
                  </td>
                  <td className="muted">{ev.terminal_name}</td>
                  <td>
                    <span className={`badge badge-${ev.result}`}>{ev.result}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
