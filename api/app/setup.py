"""One-time setup: Postgres, .env, packages, face models, database and the first Platform Admin.

Run from api/: uv run python -m app.setup
Pass the admin and the demo data choice on the command line, or leave them out and the script asks:
    uv run python -m app.setup --email admin@example.com --password example-password --name "Admin name" --demo-data
Safe to run again: it keeps an existing .env unless you say to replace it.
"""

import argparse
import getpass
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = API_DIR.parent
ENV_FILE = API_DIR / ".env"
ENV_EXAMPLE = API_DIR / ".env.example"

MIN_PASSWORD_LENGTH = 8


def run(command: list[str], cwd: Path = API_DIR) -> None:
    print(f"\n> {' '.join(command)}")
    result = subprocess.run(command, cwd=cwd)
    if result.returncode != 0:
        sys.exit(f"Setup stopped: '{' '.join(command)}' failed.")


def check_tools() -> None:
    for tool in ("uv", "docker"):
        if shutil.which(tool) is None:
            sys.exit(f"{tool} is not installed. Install it, then run this script again.")


def email_error(email: str) -> str | None:
    if "@" not in email:
        return "The email needs an @."
    return None


def password_error(password: str) -> str | None:
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"The password needs at least {MIN_PASSWORD_LENGTH} characters."
    return None


def env_value_error(value: str) -> str | None:
    # .env reads ${NAME} as another variable, so a "$" could change the value.
    if "$" in value:
        return "Don't use $ here."
    return None


def ask(question: str, default: str = "") -> str:
    hint = f" [{default}]" if default else ""
    answer = input(f"{question}{hint}: ").strip()
    return answer or default


def ask_email() -> str:
    while True:
        email = ask("Admin email")
        error = email_error(email) or env_value_error(email)
        if error is None:
            return email
        print(error)


def ask_password() -> str:
    while True:
        password = getpass.getpass(f"Admin password (at least {MIN_PASSWORD_LENGTH} characters): ")
        error = password_error(password) or env_value_error(password)
        if error is not None:
            print(error)
            continue
        if getpass.getpass("Repeat it: ") != password:
            print("The passwords don't match.")
            continue
        return password


def ask_name() -> str:
    while True:
        name = ask("Admin name", "Platform Admin")
        error = env_value_error(name)
        if error is None:
            return name
        print(error)


def ask_yes_no(question: str, default: str) -> bool:
    while True:
        answer = ask(f"{question} (y/n)", default).lower()
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("Type y or n.")


def keep_existing_env() -> bool:
    if not ENV_FILE.exists():
        return False
    return ask_yes_no("\n.env already exists. Keep it?", "y")


def env_line(key: str, value: str) -> str:
    """KEY="value", with \\ and " escaped, so spaces, # and quotes stay part of the value."""
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'{key}="{escaped}"'


def write_env(email: str, password: str, name: str) -> None:
    """Copies .env.example and fills in the secret key and the admin. The database URLs stay as they are."""
    values = {
        "SECRET_KEY": secrets.token_urlsafe(32),
        "PLATFORM_ADMIN_EMAIL": email,
        "PLATFORM_ADMIN_PASSWORD": password,
        "PLATFORM_ADMIN_NAME": name,
    }
    lines = []
    for line in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines():
        key = line.split("=", 1)[0]
        if key in values:
            line = env_line(key, values[key])
        lines.append(line)
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {ENV_FILE}.")


def check_args(args: argparse.Namespace) -> None:
    """Stops before any work if a value passed on the command line can't be used."""
    errors = []
    if args.email is not None:
        errors.append(email_error(args.email) or env_value_error(args.email))
    if args.password is not None:
        errors.append(password_error(args.password) or env_value_error(args.password))
    if args.name is not None:
        errors.append(env_value_error(args.name))
    for error in errors:
        if error is not None:
            sys.exit(f"Setup stopped: {error}")


def setup(args: argparse.Namespace) -> None:
    check_args(args)
    check_tools()
    # --wait: go on only when Postgres takes connections (see the healthcheck in docker-compose.yml).
    run(["docker", "compose", "up", "-d", "--wait"], cwd=REPO_DIR)

    if keep_existing_env():
        print("Keeping .env. The admin comes from it.")
        if args.email or args.password or args.name:
            print("--email, --password and --name are not used. Answer n to write them into a new .env.")
    else:
        print("\nThe first Platform Admin. Use a throwaway email and password, never a real one.")
        email = args.email or ask_email()
        password = args.password or ask_password()
        name = args.name or ask_name()
        write_env(email, password, name)

    # Asked here, so every question comes before the long steps.
    add_demo_data = args.demo_data
    if add_demo_data is None:
        add_demo_data = ask_yes_no("\nAdd demo buildings, terminals and admins?", "y")

    run(["uv", "sync"])
    run(["uv", "run", "python", "-m", "app.faces.download_models"])
    run(["uv", "run", "alembic", "upgrade", "head"])
    # A new process, so it reads the .env written above.
    run(["uv", "run", "python", "-m", "app.users.create_admin"])
    if add_demo_data:
        run(["uv", "run", "python", "-m", "app.demo_data"])

    print("\nSetup done. Start the API with: uv run fastapi dev app/main.py")


def main() -> None:
    parser = argparse.ArgumentParser(description="Set up the API once. Asks for anything you leave out.")
    parser.add_argument("--email", help="The first Platform Admin's email")
    parser.add_argument("--password", help="Their password. Leave it out to type it hidden")
    parser.add_argument("--name", help="Their name (default: Platform Admin)")
    parser.add_argument(
        "--demo-data",
        action=argparse.BooleanOptionalAction,
        help="Add demo buildings, terminals and admins (app/demo_data.py). Leave it out to be asked",
    )
    args = parser.parse_args()
    try:
        setup(args)
    except (KeyboardInterrupt, EOFError):
        sys.exit("\nSetup stopped.")


if __name__ == "__main__":
    main()
