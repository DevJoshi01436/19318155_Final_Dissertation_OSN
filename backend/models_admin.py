# models_admin.py
from datetime import datetime
import hashlib, json
from typing import Tuple

from db import db
from crypto_utils import f_encrypt, f_decrypt


def _json_canon(obj) -> str:
    """Deterministic JSON for hashing (sorted keys, compact)."""
    return json.dumps(obj or {}, sort_keys=True, separators=(",", ":"))


class AdminActivityLog(db.Model):
    __tablename__ = "admin_activity_log"

    id                  = db.Column(db.Integer, primary_key=True)
    admin_id            = db.Column(db.Integer, index=True, nullable=False)

    # NOTE: store UTC-naive, but we *hash* the timestamp normalized to seconds.
    ts                  = db.Column(db.DateTime, index=True, nullable=False, default=datetime.utcnow)

    action              = db.Column(db.String(128), nullable=False)
    target_type         = db.Column(db.String(64), nullable=True)
    target_id           = db.Column(db.String(64), nullable=True)

    # encrypted blobs
    meta_enc            = db.Column(db.LargeBinary, nullable=True)
    justification_enc   = db.Column(db.LargeBinary, nullable=True)

    # hash chain
    prev_hash           = db.Column(db.String(64), nullable=True)
    row_hash            = db.Column(db.String(64), nullable=True)

    # ---- convenience (decrypted) ----
    @property
    def meta(self):
        txt = f_decrypt(self.meta_enc or b"")
        try:
            # We store canonical JSON as text; loading -> dict keeps verify path simple
            return json.loads(txt) if txt else {}
        except Exception:
            return {}

    @property
    def justification(self):
        return f_decrypt(self.justification_enc or b"") or ""

    # ---- hashing (plaintext, deterministic) ----
    @staticmethod
    def _iso_seconds(ts: datetime) -> str:
        """
        Normalize to second precision for hashing so DB round-trips never
        cause mismatches (SQLite can drop microseconds depending on adapters).
        """
        return ts.replace(microsecond=0).isoformat(timespec="seconds")

    @staticmethod
    def compute_hash_plain(
        *,
        admin_id: int,
        ts: datetime,
        action: str,
        target_type: str | None,
        target_id: str | None,
        meta_json: str,             # canonical JSON string
        justification_text: str,    # plain string
        prev_hash: str | None,
    ) -> str:
        payload = {
            "admin_id": admin_id,
            "ts": AdminActivityLog._iso_seconds(ts),  # <-- normalized to seconds
            "action": action,
            "target_type": (target_type or ""),
            "target_id": (target_id or ""),
            "meta_json": meta_json,
            "justification": (justification_text or ""),
            "prev_hash": (prev_hash or ""),
        }
        blob = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(blob).hexdigest()


def append_admin_activity(
    admin_id: int,
    action: str,
    *,
    target_type: str | None = None,
    target_id: str | None = None,
    meta: dict | None = None,
    justification: str | None = None,
) -> AdminActivityLog:
    """
    Append an admin event, hashing deterministically over PLAINTEXT
    values (normalized timestamp, canonical JSON). Encryption is for storage only.
    """
    from sqlalchemy import desc

    # Find previous hash in this admin's chain
    last = (
        AdminActivityLog.query
        .filter_by(admin_id=admin_id)
        .order_by(desc(AdminActivityLog.id))
        .first()
    )
    prev = last.row_hash if last else None

    # FIX: set timestamp BEFORE hashing and normalize to seconds for consistency
    ts_now = datetime.utcnow().replace(microsecond=0)

    # Canonical JSON for hashing
    meta_json = _json_canon(meta)
    justification_text = (justification or "")

    # Compute hash on plaintexts (with normalized timestamp)
    row_hash = AdminActivityLog.compute_hash_plain(
        admin_id=admin_id,
        ts=ts_now,
        action=action,
        target_type=target_type,
        target_id=target_id,
        meta_json=meta_json,
        justification_text=justification_text,
        prev_hash=prev,
    )

    # Store ciphertext for meta/justification; store the hash/prev_hash
    row = AdminActivityLog(
        admin_id=admin_id,
        ts=ts_now,
        action=action,
        target_type=target_type,
        target_id=target_id,
        meta_enc=f_encrypt(meta_json),               # encrypt the canonical JSON string
        justification_enc=f_encrypt(justification_text),
        prev_hash=prev,
        row_hash=row_hash,
    )
    db.session.add(row)
    db.session.commit()
    print(row)
    return row


def verify_admin_chain(admin_id: int) -> Tuple[bool, dict]:
    """
    Recompute the chain for an admin, decrypting and re-serializing
    meta/justification canonically and normalizing timestamp the same way.
    Returns (ok, info).
    """
    rows = (
        AdminActivityLog.query
        .filter_by(admin_id=admin_id)
        .order_by(AdminActivityLog.id.asc())
        .all()
    )
    prev = None
    count = 0

    for r in rows:
        meta_json = _json_canon(r.meta)          # canon again from decrypted dict
        justification_text = r.justification or ""

        expected = AdminActivityLog.compute_hash_plain(
            admin_id=r.admin_id,
            ts=r.ts,                              # compute_hash_plain normalizes to seconds
            action=r.action,
            target_type=r.target_type,
            target_id=r.target_id,
            meta_json=meta_json,
            justification_text=justification_text,
            prev_hash=prev,
        )

        if r.row_hash != expected:
            return (
                False,
                {
                    "id": r.id,
                    "reason": "hash_mismatch",
                    "expected": expected,
                    "got": r.row_hash,
                    "prev_expected": prev,
                    "prev_got": r.prev_hash,
                    "count": count,
                },
            )

        if r.prev_hash != (prev or None):
            return (
                False,
                {
                    "id": r.id,
                    "reason": "prev_pointer_mismatch",
                    "expected_prev": prev,
                    "got_prev": r.prev_hash,
                    "count": count,
                },
            )

        prev = r.row_hash
        count += 1

    return True, {"count": count}
