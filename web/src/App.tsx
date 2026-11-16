import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AccessLogPage } from './pages/admin/AccessLogPage'
import { AdminsPage } from './pages/admin/AdminsPage'
import { BuildingsPage } from './pages/admin/BuildingsPage'
import { PeoplePage } from './pages/admin/PeoplePage'
import { PersonFormPage } from './pages/admin/PersonFormPage'
import { TerminalsPage } from './pages/admin/TerminalsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { TerminalPage } from './pages/terminal/TerminalPage'
import { WelcomePage } from './pages/WelcomePage'

/** Matches the "Web URLs" doc in Linear. */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/login" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      <Route element={<AdminLayout />}>
        <Route path="/buildings" element={<BuildingsPage />} />
        <Route path="/users" element={<AdminsPage />} />
        <Route path="/buildings/:buildingId">
          <Route index element={<Navigate to="terminals" replace />} />
          <Route path="terminals" element={<TerminalsPage />} />
          <Route path="people" element={<PeoplePage />}>
            <Route path="new" element={<PersonFormPage key="new" />} />
            <Route path=":id/edit" element={<PersonFormPage key="edit" />} />
          </Route>
          <Route path="access-log" element={<AccessLogPage />} />
        </Route>
      </Route>

      <Route path="/terminal/:terminalId" element={<TerminalPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
