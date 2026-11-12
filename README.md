# Building Entry

A face-recognition entry system for multiple buildings. Admins enroll the people allowed into a building with a face photo, and a terminal at each door recognizes faces from a webcam and shows whether the person may enter.

| Folder | What |
| -- | -- |
| `api/` | Python backend (FastAPI, Postgres). See [api/README.md](api/README.md) |
| `web/` | React + TypeScript admin panel and door terminal (Vite). See [web/README.md](web/README.md) |

## Run it

Start the API first ([api/README.md](api/README.md) has the one-time setup):

```bash
cd api
uv run fastapi dev app/main.py
```

Then, in a second terminal, start the web app:

```bash
cd web
npm ci
npm run dev
```

Open http://localhost:5173 and sign in as the Platform Admin from `api/.env`.

The plan, PRD, tickets and design docs live in the Linear project "Building Entry".
