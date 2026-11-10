# Building Entry: front-end mockup

A clickable React + TypeScript mockup of the face-recognition building entry system. It has **no backend**: all data lives in an in-memory store saved to `localStorage`, so the screens can be tried before the Python API exists.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with any password as:

| Email | Role |
| -- | -- |
| avi@example.com | Platform Admin (all buildings, Buildings and Admins pages) |
| maya@example.com | Building Admin (North Tower) |
| eli@example.com | Building Admin (Harbor House, Cedar Court) |
| noa@example.com | Unassigned (can't sign in yet) |

"Reset demo data" in the sidebar restores the seed data.

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
