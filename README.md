# Real Time Facial Recognition

A real-time facial recognition building entry system for multiple buildings.

Entry should take no effort. Residents carry nothing. Admins know who may enter, and who did.

Your face is the key.

- An admin panel to manage buildings, residents and doors, with a full access log.
- Fast and secure entry. The door terminal recognizes the resident's face.
## How face recognition works

A door terminal finds a face. The server decides if the person is a resident.

- **Client:** MediaPipe watches the webcam and picks one face to check.
- **Server:** OpenCV YuNet and SFace convert that face to an embedding. pgvector finds the closest enrolled person in the building.
- **Result:** close enough means "granted". Anything else means "denied".

## Project layout

| Folder | What | Docs |
| -- | -- | -- |
| `api/` | Python backend: FastAPI, SQLAlchemy, Alembic, Postgres with pgvector | [api/README.md](api/README.md) |
| `web/` | Admin panel and door terminal: React, TypeScript, Vite | [web/README.md](web/README.md) |

## Quick start

You'll need [uv](https://docs.astral.sh/uv/), Node.js, Docker and a webcam.

Set up the API once, from `api/`. The script starts Postgres, writes `.env`, downloads the face models, builds the database and creates your first admin. Say yes to the demo data:

```bash
uv run python -m app.setup
```

Then start the API from `api/`:

```bash
uv run fastapi dev app/main.py
```

And the web app from `web/`, in a second terminal:

```bash
npm ci
npm run dev
```

Open http://localhost:5173 and sign in with the admin you just created.

## Try it yourself

With the demo data loaded:

1. Pick a building in the sidebar.
2. Add yourself on **People** and snap a photo with the webcam.
3. Open a terminal from **Terminals** and step up to the camera. You're in.
4. Remove yourself on **People**, then try to identify again. Your access is denied.
5. Enroll yourself in one building, then try to identify at a terminal in the other building. Your access is denied.

> **Note:** sign in with the Platform Admin email and password from setup. The demo data adds 2 buildings with terminals and enrolled people. Their Building Admins are `demo.admin@example.com` and `harbor.admin@example.com`. Both sign in with the Platform Admin password. A Building Admin sees only their own building.
