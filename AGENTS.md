# Real Time Facial Recognition

Face-recognition entry for multiple buildings. `api/` is the FastAPI + Postgres backend and `web/` is the React admin panel and door terminal. Setup and commands live in each folder's README.

Plan, tickets and design docs: Linear project "Real Time Facial Recognition",
https://linear.app/gil-lesokhin/project/real-time-facial-recognition-debea10898b0
Before building a feature, read its ticket and the "Data model", "Backend API" and "Web URLs" docs.

## How we work

- One ticket is one feature, end to end: endpoints, tests, and the web screen that uses them.
- Explain each choice briefly and lay out options with pros and cons. The user decides.
- The user runs installs, Docker, migrations and tests. Hand over the command.
- Refer to a ticket by ID and title: "GIL-74 (Buildings + who can reach them)".
- Progress lives in Linear. READMEs hold only what stays true.
- In Markdown, write separate sentences instead of semicolons.

## Code

- Simple first: the plainest code that works.
- Comments only explain code that isn't clear on its own. Explanations for the user go in chat.
- Each feature is one folder, `api/app/<feature>/`, split into router (HTTP) → service (rules) → db (queries), with tests in `api/tests/<feature>/`. `auth/` is the pattern to copy.
- Admin endpoints take `admin: CurrentAdmin`.
- Every schema change gets a new Alembic migration.
- Each request saves all its changes or none of them. The service function the router calls makes all the changes, then calls `session.commit()` once, as its last step. Nothing else commits. `db.py` functions call `flush()` when they need the new row's id.
- Services check every rule and return a clear error. They never rely on the database for that. The database also enforces what it can (NOT NULL, CHECK, foreign keys, unique indexes) as a safety net for races and bugs. A broken unique index becomes a 409 in `app/main.py`. Give each new unique index a message in `CONFLICTS` in `app/core/db.py`.
