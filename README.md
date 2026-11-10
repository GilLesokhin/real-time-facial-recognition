# Building Entry

A face-recognition entry system for multiple buildings. Admins enroll the people allowed into a building with a face photo, and a terminal at each door recognizes faces from a webcam and shows whether the person may enter.

| Folder | What |
| -- | -- |
| `web/` | React + TypeScript admin panel and door terminal (Vite). For now it runs on a local mock store with no backend. See [web/README.md](web/README.md) |
| `api/` | Python backend. Not started yet: the stack is decided first |

## Run the web app

```bash
cd web
npm ci
npm run dev
```

Open http://localhost:5173.

The plan, PRD and tickets live in the Linear project "Building Entry".
