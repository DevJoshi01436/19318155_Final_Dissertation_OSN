# privacy.py
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_cors import cross_origin
from sqlalchemy.exc import SQLAlchemyError
from io import BytesIO
from datetime import datetime
import json

from db import db
from auth import require_auth
from models_privacy import (
    UserSettings, ConsentLog, ActivityLog, append_activity, UserProfile
)

privacy_bp = Blueprint('privacy', __name__)

ALLOWED_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"]

# ---------- Helpers ----------
def _ensure_settings(user_id: int) -> UserSettings:
    s = UserSettings.query.filter_by(user_id=user_id).first()
    if not s:
        s = UserSettings(user_id=user_id)
        db.session.add(s)
        db.session.commit()
    return s

def _ensure_profile(user_id: int) -> UserProfile:
    p = UserProfile.query.filter_by(user_id=user_id).first()
    if not p:
        p = UserProfile(user_id=user_id)
        db.session.add(p)
        db.session.commit()
    return p

def _to_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("true", "1", "yes", "y", "on"): return True
        if v in ("false", "0", "no", "n", "off"): return False
    return bool(value)

# ---------- Privacy Summary (no chain verification) ----------
@privacy_bp.route('/me/privacy-summary', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@require_auth
def privacy_summary(user):
    s = UserSettings.query.filter_by(user_id=user.id).first()

    consents_q = ConsentLog.query.filter_by(user_id=user.id)
    consents_count = consents_q.count()
    last_consent = consents_q.order_by(ConsentLog.id.desc()).first()

    last_act = (
        ActivityLog.query
        .filter_by(user_id=user.id)
        .order_by(ActivityLog.id.desc())
        .first()
    )

    return jsonify({
        "settings": {
            "profile_public": bool(s.profile_public) if s else False,
            "share_usage": bool(s.share_usage) if s else False,
            "ad_personalization": bool(s.ad_personalization) if s else False,
            "show_last_seen": bool(s.show_last_seen) if s else False,
            "updated_at": s.updated_at.isoformat() + "Z" if s and s.updated_at else None,
        },
        "consents": {
            "count": consents_count,
            "last_item": last_consent.item if last_consent else None,
            "last_action": last_consent.action if last_consent else None,
            "last_at": last_consent.ts.isoformat() + "Z" if last_consent else None,
        },
        "activity": {
            "last_activity_at": last_act.ts.isoformat() + "Z" if last_act else None
        }
    }), 200

# ---------- Existing routes ----------
@privacy_bp.route('/privacy-settings', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@require_auth
def get_privacy_settings(user):
    s = _ensure_settings(user.id)
    return jsonify({
        "profile_public": s.profile_public,
        "share_usage": s.share_usage,
        "ad_personalization": s.ad_personalization,
        "show_last_seen": s.show_last_seen,
        "updated_at": (s.updated_at.isoformat() + "Z") if s.updated_at else None
    })

@privacy_bp.route('/privacy-settings', methods=['PUT'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@require_auth
def update_privacy_settings(user):
    try:
        data = request.get_json(force=True) or {}
    except Exception:
        current_app.logger.exception("Bad JSON for /privacy-settings")
        return jsonify({"message": "Invalid JSON body"}), 400

    s = _ensure_settings(user.id)
    changed = {}
    try:
        for key in ["profile_public", "share_usage", "ad_personalization", "show_last_seen"]:
            if key in data:
                new_val = _to_bool(data[key])
                old_val = getattr(s, key)
                if old_val != new_val:
                    setattr(s, key, new_val)
                    changed[key] = {"old": old_val, "new": new_val}

        if not changed:
            return jsonify({"message": "No changes"}), 200

        db.session.commit()

        append_activity(user.id, "PRIVACY_UPDATED", {"changed": changed})
        for k in changed.keys():
            db.session.add(ConsentLog(user_id=user.id, item=k, version=None, action="updated"))
        db.session.commit()

        return jsonify({"message": "Privacy settings updated", "changed": changed}), 200

    except SQLAlchemyError as e:
        current_app.logger.exception("SQLAlchemyError updating privacy settings")
        db.session.rollback()
        return jsonify({"message": f"Failed to update settings: SQLAlchemyError: {str(e)}"}), 500
    except Exception as e:
        current_app.logger.exception("Unexpected error updating privacy settings")
        db.session.rollback()
        return jsonify({"message": f"Failed to update settings: {type(e).__name__}: {str(e)}"}), 500

@privacy_bp.route('/consents', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@require_auth
def list_consents(user):
    rows = ConsentLog.query.filter_by(user_id=user.id).order_by(ConsentLog.id.desc()).limit(200).all()
    return jsonify([
        {"id": r.id, "item": r.item, "version": r.version, "action": r.action, "ts": r.ts.isoformat() + "Z"}
        for r in rows
    ])

@privacy_bp.route('/consents', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@require_auth
def record_consent(user):
    try:
        data = request.get_json(force=True) or {}
    except Exception:
        current_app.logger.exception("Bad JSON for /consents POST")
        return jsonify({"message": "Invalid JSON body"}), 400

    item = (data.get("item") or "").strip()
    version = (data.get("version") or "").strip() or None
    action = (data.get("action") or "").strip().lower()
    if not item or action not in ("accepted", "revoked", "updated"):
        return jsonify({"message": "Invalid consent payload"}), 400

    try:
        row = ConsentLog(user_id=user.id, item=item, version=version, action=action)
        db.session.add(row)
        db.session.commit()
        append_activity(user.id, "CONSENT_" + action.upper(), {"item": item, "version": version})
        return jsonify({"message": "Consent recorded"}), 201
    except Exception as e:
        current_app.logger.exception("Failed to record consent")
        db.session.rollback()
        return jsonify({"message": f"Failed to record consent: {type(e).__name__}: {str(e)}"}), 500

@privacy_bp.route('/activity', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@require_auth
def my_activity(user):
    try:
        limit = int(request.args.get('limit', 50))
    except ValueError:
        limit = 50
    limit = max(1, min(limit, 200))

    rows = ActivityLog.query.filter_by(user_id=user.id).order_by(ActivityLog.id.desc()).limit(limit).all()
    return jsonify([
        {
            "id": r.id,
            "event": r.event,
            "meta": r.meta,
            "ts": r.ts.isoformat() + "Z",
            "prev_hash": r.prev_hash,
            "row_hash": r.row_hash
        } for r in rows
    ])
