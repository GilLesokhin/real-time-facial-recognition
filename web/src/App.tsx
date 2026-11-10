import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AccessLogPage } from './pages/admin/AccessLogPage'
import { AdminsPage } from './pages/admin/AdminsPage'
import { BuildingsPage } from './pages/admin/BuildingsPage'
import { PeoplePage } from './pages/admin/PeoplePage'
import { PersonFormPage } from './pages/admin/PersonFormPage'
import { TerminalsPage } from './pages/admin/TerminalsPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { TerminalPage } from './pages/terminal/TerminalPage'

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="people" replace />} />
        <Route path="people" element={<PeoplePage />}>
          <Route path="new" element={<PersonFormPage key="new" />} />
          <Route path=":id/edit" element={<PersonFormPage key="edit" />} />
        </Route>
        <Route path="access-log" element={<AccessLogPage />} />
        <Route path="buildings" element={<BuildingsPage />} />
        <Route path="terminals" element={<TerminalsPage />} />
        <Route path="admins" element={<AdminsPage />} />
      </Route>
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/terminal" element={<Navigate to="/admin/terminals" replace />} />
      <Route path="/terminal/:terminalId" element={<TerminalPage />} />
      <Route path="*" element={<Navigate to="/admin/people" replace />} />
    </Routes>
  )
}
