# models_privacy.py
from datetime import datetime
import hashlib
import json
from sqlalchemy.types import TypeDecorator, LargeBinary
from sqlalchemy import desc, asc
from db import db
from crypto_utils import f_encrypt, f_decrypt, encrypt_json, decrypt_json

# ---------- Encrypted JSON column for activity meta ----------
class EncryptedJSON(TypeDecorator):
    impl = LargeBinary
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_json(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return {}
        return decrypt_json(value)

# ---------- Settings / Consent ----------
class UserSettings(db.Model):
    __tablename__ = "user_settings"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, index=True, nullable=False, unique=True)

    profile_public     = db.Column(db.Boolean, default=False, nullable=False)
    share_usage        = db.Column(db.Boolean, default=False, nullable=False)
    ad_personalization = db.Column(db.Boolean, default=False, nullable=False)
    show_last_seen     = db.Column(db.Boolean, default=False, nullable=False)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ConsentLog(db.Model):
    __tablename__ = "consent_log"
    id      = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, index=True, nullable=False)
    ts      = db.Column(db.DateTime, default=datetime.utcnow, index=True, nullable=False)
    item    = db.Column(db.String(128), nullable=False)
    version = db.Column(db.String(32), nullable=True)
    action  = db.Column(db.String(32), nullable=False)  # accepted / revoked / updated

# ---------- Tamper-evident, encrypted activity ----------
class ActivityLog(db.Model):
    __tablename__ = "activity_log"
    id      = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, index=True, nullable=False)
    ts      = db.Column(db.DateTime, default=datetime.utcnow, index=True, nullable=False)
    event   = db.Column(db.String(128), nullable=False)

    # Encrypted at rest
    meta_enc = db.Column(EncryptedJSON, nullable=True)

    # Chain fields
    prev_hash = db.Column(db.String(64), nullable=True)
    row_hash  = db.Column(db.String(64), nullable=True)

    # Convenience property for decrypted meta
    @property
    def meta(self):
        return self.meta_enc or {}

    @meta.setter
    def meta(self, value):
        self.meta_enc = value or {}

    def compute_hash(self, prev_hash: str | None):
        data = {
            "user_id": self.user_id,
            "ts": self.ts.replace(microsecond=0).isoformat() if self.ts else None,
            "event": self.event,
            "meta": self.meta,  # use decrypted object for hashing
            "prev_hash": prev_hash or "",
        }
        blob = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(blob).hexdigest()

def append_activity(user_id: int, event: str, meta_dict: dict | None = None):
    last = ActivityLog.query.filter_by(user_id=user_id).order_by(desc(ActivityLog.id)).first()
    prev = last.row_hash if last else None

    row = ActivityLog(user_id=user_id, event=event)
    row.meta = meta_dict or {}   # encrypted via EncryptedJSON
    row.prev_hash = prev
    row.row_hash = row.compute_hash(prev)
    db.session.add(row)
    db.session.commit()

def verify_chain(user_id: int):
    rows = ActivityLog.query.filter_by(user_id=user_id).order_by(asc(ActivityLog.id)).all()
    expected_prev = None
    for r in rows:
        if r.prev_hash != (expected_prev or None):
            return False, {"id": r.id, "reason": "prev_hash mismatch"}
        expected_hash = r.compute_hash(expected_prev)
        if r.row_hash != expected_hash:
            return False, {"id": r.id, "reason": "row_hash mismatch"}
        expected_prev = r.row_hash
    return True, {"count": len(rows)}

# ---------- Encrypted profile ----------
class UserProfile(db.Model):
    __tablename__ = "user_profile"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, index=True, nullable=False, unique=True)

    # ciphertext; decrypt on property access
    encrypted_phone = db.Column(db.LargeBinary, nullable=True)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def phone(self) -> str:
        return f_decrypt(self.encrypted_phone or b"")

    @phone.setter
    def phone(self, value: str):
        self.encrypted_phone = f_encrypt(value or "")
