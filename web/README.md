# Real Time Facial Recognition: web

The front end of the system. It uses React, TypeScript and Vite. It has two parts:

- The admin panel
- The door terminal

All the data comes from the API in `api/`.

Run all the commands in this file from `web/`.

## Run

Before you start, make sure that Node.js is installed and the API is running. See [api/README.md](../api/README.md).

```bash
npm ci
npm run dev
```

Open http://localhost:5173 and sign in as the Platform Admin from `api/.env`.

Vite sends all the requests to `/api/*` to the API on http://localhost:8000. Thus, the browser sees one origin, and the session cookie works without CORS (Cross-Origin Resource Sharing). See `vite.config.ts`.

## Check

```bash
npm run lint
npm run build
```

`npm run build` also does the TypeScript check.

## Things to know

- **Camera:** the browser lets the page use the camera only on `localhost` or on HTTPS.
- **New accounts:** a new account from the sign-up page has no role. It cannot sign in until a Platform Admin gives it a role on the **Admins** page.
- **Terminal sign-in:** the terminal gets its key from the API with the admin's session cookie. Thus, an admin must be signed in in the same browser. The key stays only in the memory of that tab.
- **Enrollment:** the browser finds the face and sends only a crop of it. The API refuses a photo with no face or with more than one face.
- **At the door:** the terminal sends the biggest face that is near enough to the camera. It shows "granted" with the name of the person, or "denied".

## Code map

| Path | Contents |
| -- | -- |
| `src/App.tsx` | All the routes |
| `src/pages/` | One file for each screen. `admin/` has the admin panel. `terminal/` has the door screen. |
| `src/components/` | Shared parts: the layout, modals and photo picker |
| `src/store/` | The API calls, the shared state and the signed-in user |
| `src/lib/` | `api.ts` makes all the calls to the API. `face/` finds faces with MediaPipe. |
| `src/hooks/` | The webcam stream and live face detection |
