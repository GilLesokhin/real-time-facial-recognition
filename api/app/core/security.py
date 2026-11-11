"""Password hashing with Argon2: slow on purpose, so a leaked hash is expensive to guess."""

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

_hasher = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _hasher.verify(password, password_hash)


# Checked when the email is unknown, so a wrong email takes as long as a wrong
# password and response times don't reveal which emails have accounts.
DUMMY_HASH = hash_password("not-a-real-password")
