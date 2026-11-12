# Building Entry

Face-recognition entry for multiple buildings. `api/` is the FastAPI + Postgres backend and `web/` is the React admin panel and door terminal. Setup and commands live in each folder's README.

Plan, tickets and design docs: Linear project "Building Entry",
https://linear.app/gil-lesokhin/project/building-entry-debea10898b0
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
