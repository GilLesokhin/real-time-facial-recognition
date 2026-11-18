import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { useApi } from '../../hooks/useApi'
import { personPhotoUrl } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useCurrentBuilding } from '../../store/store'
import type { AccessEvent, AccessResult, Terminal } from '../../types'

export function AccessLogPage() {
  const currentBuilding = useCurrentBuilding()
  const [terminalFilter, setTerminalFilter] = useState('')
  const [resultFilter, setResultFilter] = useState<AccessResult | ''>('')

  const params = new URLSearchParams()
  if (terminalFilter) params.set('terminal', terminalFilter)
  if (resultFilter) params.set('result', resultFilter)
  const { data: events, error } = useApi<AccessEvent[]>(`/buildings/${currentBuilding.id}/access-log?${params}`)
  const { data: terminals } = useApi<Terminal[]>(`/buildings/${currentBuilding.id}/terminals`)

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
              {terminals?.map((t) => (
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

      <div className="card table-wrap">
        {error ? (
          <p className="empty error">{error}</p>
        ) : !events ? (
          <p className="empty muted">Loading…</p>
        ) : events.length === 0 ? (
          <p className="empty muted">No entries yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th className="label">Time</th>
                <th className="label">Person</th>
                <th className="label">Terminal</th>
                <th className="label">Result</th>
                <th className="label">Score</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="muted">{formatDateTime(ev.created_at)}</td>
                  <td>
                    {ev.person_id && ev.person_name ? (
                      <div className="cell-row">
                        <Avatar name={ev.person_name} photo={personPhotoUrl(ev.person_id)} size={32} />
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
                  <td className="muted" title="Similarity to the nearest person. 0.363 or more is a match.">
                    {ev.score === null ? '—' : ev.score.toFixed(2)}
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
