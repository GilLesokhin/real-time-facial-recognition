# Real Time Facial Recognition: front-end mockup

A React + TypeScript front end for the face-recognition entry system. **Sign-in and buildings are real**: they go to the Python API (`api/`). Everything else (people, terminals, the access log, the Admins page) is still mock data saved to `localStorage`, until those endpoints exist.

## Run it

Start the API first (see `api/`), on http://localhost:8000. Then:

```bash
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api/*` to the API (see `vite.config.ts`), so the browser sees one origin and the session cookie works without CORS.

Sign in as the Platform Admin you create with `uv run python -m app.users.create_admin`, run from `api/`. New accounts start Unassigned and can't sign in, and the Admins page doesn't use the API yet, so for now other accounts get a role in the database:

```sql
UPDATE users SET role = 'building_admin', building_id = '<building id>' WHERE email = 'someone@example.com';
```

"Reset demo data" in the sidebar restores the mock data.

## Screens

| Route | Screen |
| -- | -- |
| `/` | Welcome page with sign-in and sign-up |
| `/login`, `/signup` | Sign in, and sign up (new accounts start Unassigned) |
| `/buildings` | Buildings. Platform Admins can add, edit and delete them |
| `/users` | Platform Admin: give users a role and buildings |
| `/buildings/:buildingId/terminals` | Terminals (one per door). This is where `/buildings/:buildingId` opens |
| `/buildings/:buildingId/people` | People allowed in, with face photos (`/new`, `/:id/edit`) |
| `/buildings/:buildingId/access-log` | Every check, filtered by terminal and result |
| `/terminal/:terminalId` | The door screen: camera, face box, granted or denied |
| Anything else | 404 page |

The terminal has demo controls to choose who the camera "sees", since face matching needs the backend.

## Code map

| Path | What |
| -- | -- |
| `src/store/store.tsx` | All data and actions. Each action notes the endpoint it stands in for |
| `src/types.ts` | Data model shared by every screen |
| `src/data/seed.ts` | Demo data |
| `src/pages/` | One file per screen |
| `src/components/` | Layout, modals, avatar, logo, photo picker |
| `src/hooks/useCamera.ts` | Webcam stream and frame capture |
| `src/index.css` | Design tokens and all styles |

To connect a real backend, replace the actions in `store.tsx` with API calls. The screens don't need to change.
