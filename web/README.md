# Real Time Facial Recognition: web app

A React + TypeScript front end for the face-recognition entry system: the admin panel and the door screen. All data comes from the Python API (`api/`).

## Run it

Start the API first (see `api/`), on http://localhost:8000. Then:

```bash
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api/*` to the API (see `vite.config.ts`), so the browser sees one origin and the session cookie works without CORS.

Sign in as the Platform Admin you create with `uv run python -m app.users.create_admin`, run from `api/`. New accounts start Unassigned and can't sign in until a Platform Admin gives them a role on the Admins page.

## Try the door

1. Add a building, then a terminal on its Terminals page.
2. Add a person on the People page, with a clear webcam photo or an uploaded photo of one face.
3. Click **Open** next to the terminal. A new tab opens the door screen, signed in as that terminal.
4. Look at the webcam. The screen shows "Access granted" with your name, or "Access denied".
5. Every check shows on the Access log page, with its score.

## Screens

| Route | Screen |
| -- | -- |
| `/` | Welcome page with sign-in and sign-up |
| `/login`, `/signup` | Sign in, and sign up (new accounts start Unassigned) |
| `/buildings` | Buildings. Platform Admins can add, edit and delete them |
| `/users` | Platform Admin: give users a role and a building |
| `/buildings/:buildingId/terminals` | Terminals (one per door). This is where `/buildings/:buildingId` opens |
| `/buildings/:buildingId/people` | People allowed in, with face photos (`/new`, `/:id/edit`) |
| `/buildings/:buildingId/access-log` | Every check, filtered by terminal and result |
| `/terminal/:terminalId` | The door screen: camera, face box, granted or denied |
| Anything else | 404 page |

## How the door screen signs in

**Open** on the Terminals page asks the API for a new key for that terminal (`POST /terminals/{id}/key`). The key travels to the new tab in the URL `#fragment`, which the browser never sends to a server. The door screen moves it to `sessionStorage` and sends it as `Authorization: Bearer …` on every request. Opening the terminal again makes a new key, and the old tab is signed out.

## Code map

| Path | What |
| -- | -- |
| `src/lib/api.ts` | `api()`: every call to the backend, and its errors |
| `src/hooks/useApi.ts` | Loads one API path for a page, with `reload()` |
| `src/store/auth.tsx` | Sign-in state |
| `src/store/store.tsx` | The buildings the signed-in admin can reach |
| `src/types.ts` | The API's response shapes |
| `src/pages/` | One file per screen |
| `src/components/` | Layout, modals, avatar, logo, photo picker |
| `src/hooks/useCamera.ts` | Webcam stream and frame capture |
| `src/hooks/useFaceDetection.ts`, `src/lib/face/` | Finds the face in the browser (MediaPipe) and crops it for the server |
| `src/index.css` | Design tokens and all styles |
