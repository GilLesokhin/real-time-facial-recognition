# Real Time Facial Recognition: API

The Python backend: FastAPI, SQLAlchemy, Alembic and Postgres, managed with [uv](https://docs.astral.sh/uv/).

## Set up (once)

1. Install uv and Docker.
2. Start Postgres (with pgvector) from the repo root. It creates the `building_entry` database. The tests create their own `building_entry_test` on their first run.

   ```bash
   docker compose up -d
   ```

3. Copy `.env.example` to `.env` and fill it in: both database URLs, a random `SECRET_KEY` (at least 32 characters) and the first Platform Admin's email and password.

   ```bash
   uv run python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

4. Install the packages, build the database and create the Platform Admin from `.env`.

   ```bash
   uv sync
   uv run alembic upgrade head
   uv run python -m app.users.create_admin
   ```

## Run

```bash
uv run fastapi dev app/main.py
```

The API runs on http://localhost:8000, with interactive docs at http://localhost:8000/docs. The web app reaches it through the Vite proxy at `/api`.

## Test

```bash
uv run pytest
```

The tests use `TEST_DATABASE_URL`, never `DATABASE_URL`. Each run creates that database if it's missing, empties it and rebuilds it with the real migrations, and each test is rolled back afterwards.

## Endpoints

Every endpoint is listed at http://localhost:8000/docs. To protect an endpoint so only signed-in admins can call it, add `admin: CurrentAdmin` (from `app/auth/deps.py`) to its parameters.

## Code map

Each feature has three layers: router (HTTP) → service (rules) → db (queries).

| Path | What |
| -- | -- |
| `app/main.py` | The app and the session-cookie middleware |
| `app/core/` | Settings from `.env`, the database session, password hashing |
| `app/<feature>/` | One folder per feature, such as `auth/` and `users/` |
| `migrations/versions/` | Database migrations. Create one with `uv run alembic revision --autogenerate -m "..."` after changing a `models.py`, then run `uv run alembic upgrade head` |
| `tests/` | pytest suite, one folder per feature. `conftest.py` sets up the test database |
