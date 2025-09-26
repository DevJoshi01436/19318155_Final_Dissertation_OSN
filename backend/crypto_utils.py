# crypto_utils.py
import os
import json
from cryptography.fernet import Fernet, InvalidToken

def get_fernet() -> Fernet:
    """
    Load DATA_KEY (a base64 Fernet key) from env and return a Fernet instance.
    Generate once for dev:
      >>> from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())
    """
    key = os.getenv("DATA_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "DATA_KEY is not set. Generate a Fernet key and set it in your environment. "
            "Example (PowerShell):  $env:DATA_KEY = 'YOUR_FERNET_BASE64_KEY'"
        )
    try:
        return Fernet(key)
    except Exception as e:
        raise RuntimeError("DATA_KEY is invalid for Fernet.") from e

# ---- Simple string helpers ----
def f_encrypt(plaintext: str) -> bytes:
    if plaintext is None:
        return b""
    return get_fernet().encrypt(plaintext.encode("utf-8"))

def f_decrypt(ciphertext: bytes) -> str:
    if not ciphertext:
        return ""
    try:
        return get_fernet().decrypt(ciphertext).decode("utf-8")
    except InvalidToken:
        # Key rotated/changed or data corrupted
        return ""

# ---- JSON helpers (for encrypted activity meta) ----
def encrypt_json(obj) -> bytes:
    """Encrypt any JSON-serializable object."""
    raw = json.dumps(obj or {}, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return get_fernet().encrypt(raw)

def decrypt_json(ciphertext: bytes):
    """Return python object or {} if key/record invalid."""
    if not ciphertext:
        return {}
    try:
        raw = get_fernet().decrypt(ciphertext).decode("utf-8")
        return json.loads(raw)
    except InvalidToken:
        return {}
