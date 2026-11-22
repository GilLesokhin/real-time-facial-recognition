import hashlib
import hmac
import uuid

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import settings

_hasher = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _hasher.verify(password, password_hash)


DUMMY_HASH = hash_password("not-a-real-password")


def terminal_key(terminal_id: uuid.UUID) -> str:
    """The key a terminal sends as `Authorization: Bearer <key>`. Derived, never stored.

    It never changes. Deleting the terminal cancels it. Changing SECRET_KEY changes every key.
    """
    message = f"terminal-key:{terminal_id}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()
