# Building Entry: front-end mockup

A React + TypeScript front end for the face-recognition building entry system. **Sign-in is real**: sign-up, sign-in, sign-out and "who am I" go to the Python API (`api/`). Everything else (buildings, people, terminals, the access log, the Admins page) is still mock data saved to `localStorage`, until those endpoints exist.

## Run it

Start the API first (see `api/`), on http://localhost:8000. Then:

```bash
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api/*` to the API (see `vite.config.ts`), so the browser sees one origin and the session cookie works without CORS.

Sign in as the Platform Admin that the API's migrations create from `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` in `api/.env`. New accounts start Unassigned and can't sign in, and the Admins page doesn't use the API yet, so for now other accounts get a role in the database:

```sql
UPDATE users SET role = 'building_admin' WHERE email = 'someone@example.com';
```

A Building Admin from the API has no buildings yet, so they see "No buildings". A Platform Admin sees all the mock buildings.

"Reset demo data" in the sidebar restores the mock data.

## Screens

| Route | Screen |
| -- | -- |
| `/signin`, `/signup` | Sign in, and sign up (new accounts start Unassigned) |
| `/admin/people` | People allowed into the building, with face photos |
| `/admin/terminals` | Terminals (one per door). Open one in a new tab |
| `/admin/access-log` | Every check, filtered by terminal and result |
| `/admin/buildings` | Platform Admin: add, edit and delete buildings |
| `/admin/admins` | Platform Admin: give users a role and buildings |
| `/terminal/:id` | The door screen: camera, face box, granted or denied |

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
