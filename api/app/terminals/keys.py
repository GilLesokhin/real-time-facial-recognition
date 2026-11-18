"""A terminal signs in with its own random key (the GIL-66 proposal).

"Open terminal" makes a new key. The database stores only its SHA-256, so a database leak
doesn't reveal keys. A fast hash is enough because the key is long and random, not a password.
"""

import hashlib
import hmac
import secrets


def new_key() -> str:
    return secrets.token_urlsafe(32)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def key_matches(key: str, key_hash: str | None) -> bool:
    return key_hash is not None and hmac.compare_digest(hash_key(key), key_hash)
