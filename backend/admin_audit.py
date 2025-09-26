# admin_audit.py
from datetime import datetime
from io import BytesIO, StringIO
import json, csv

from flask import Blueprint, request, jsonify, send_file, Response

from db import db
from auth import require_role, UserModel
from models_admin import AdminActivityLog  # note: verify_admin_chain removed

admin_audit_bp = Blueprint("admin_audit", __name__)

def _parse_dt(s: str | None):
    if not s:
        return None
    try:
        if len(s) == 10:
            return datetime.strptime(s, "%Y-%m-%d")
        return datetime.fromisoformat(s.replace("Z", ""))
    except Exception:
        return None

def _build_query(current_admin: UserModel, args):
    q = AdminActivityLog.query

    admin_id = args.get("admin_id", type=int)
    email = (args.get("email") or "").strip().lower()

    if email:
        target_admin = UserModel.query.filter(UserModel.email.ilike(email)).first()
        if not target_admin:
            return q.filter(db.text("1=0"))
        q = q.filter(AdminActivityLog.admin_id == target_admin.id)
    elif admin_id:
        q = q.filter(AdminActivityLog.admin_id == admin_id)
    else:
        q = q.filter(AdminActivityLog.admin_id == current_admin.id)

    action = (args.get("action") or "").strip()
    target_type = (args.get("target_type") or "").strip()
    target_id = (args.get("target_id") or "").strip()
    since = _parse_dt(args.get("since"))
    until = _parse_dt(args.get("until"))

    if action:
        q = q.filter(AdminActivityLog.action.ilike(f"%{action}%"))
    if target_type:
        q = q.filter(AdminActivityLog.target_type == target_type)
    if target_id:
        q = q.filter(AdminActivityLog.target_id == target_id)
    if since:
        q = q.filter(AdminActivityLog.ts >= since)
    if until:
        q = q.filter(AdminActivityLog.ts <= until)

    sort_by = (args.get('sort_by') or 'id').lower()
    sort_dir = (args.get('sort_dir') or 'desc').lower()
    column_map = {
        'id': AdminActivityLog.id,
        'ts': AdminActivityLog.ts,
        'action': AdminActivityLog.action,
        'target_type': AdminActivityLog.target_type,
        'target_id': AdminActivityLog.target_id,
    }
    col = column_map.get(sort_by, AdminActivityLog.id)
    q = q.order_by(col.asc() if sort_dir == 'asc' else col.desc())
    return q

def _row_to_dict(r: AdminActivityLog):
    return {
        "id": r.id,
        "admin_id": r.admin_id,
        "ts": (r.ts.isoformat() + "Z"),
        "action": r.action,
        "target_type": r.target_type,
        "target_id": r.target_id,
        "meta": r.meta,
        "justification": r.justification,
        "prev_hash": r.prev_hash,
        "row_hash": r.row_hash,
    }

@admin_audit_bp.route("/admin/activity", methods=["GET"])
@require_role("admin")
def list_admin_activity(current_admin: UserModel):
    q = _build_query(current_admin, request.args)

    # CSV export
    if (request.args.get('format') or '').lower() == 'csv':
        MAX_EXPORT = 5000
        rows = q.limit(MAX_EXPORT).all()
        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(['id','admin_id','ts','action','target_type','target_id','meta_json','justification','prev_hash','row_hash'])
        from models_admin import _json_canon
        for r in rows:
            writer.writerow([
                r.id, r.admin_id, r.ts.isoformat() + "Z", r.action,
                r.target_type or '', r.target_id or '',
                _json_canon(r.meta), (r.justification or '').replace('\n','\\n'),
                r.prev_hash or '', r.row_hash or ''
            ])
        csv_data = buf.getvalue()
        resp = Response(csv_data, mimetype="text/csv")
        resp.headers['Content-Disposition'] = 'attachment; filename=admin_audit.csv'
        return resp

    limit = min(request.args.get("limit", default=50, type=int) or 50, 500)
    offset = request.args.get("offset", default=0, type=int) or 0
    total = q.count()
    rows = q.limit(limit).offset(offset).all()

    return jsonify({
        "items": [_row_to_dict(r) for r in rows],
        "count": total,
        "limit": limit,
        "offset": offset,
    })

# NOTE: verify-chain endpoint removed.

@admin_audit_bp.route("/admin/activity/export", methods=["POST"])
@require_role("admin")
def export_admin_activity(current_admin: UserModel):
    body = request.get_json(silent=True) or {}
    filters = body.get("filters") or {}
    admin_id = body.get("admin_id")

    args_like = request.args.copy()
    for k, v in filters.items():
        args_like = args_like.copy()
        args_like[k] = v
    if admin_id:
        args_like = args_like.copy()
        args_like["admin_id"] = str(admin_id)

    q = _build_query(current_admin, args_like)
    rows = q.order_by(AdminActivityLog.id.asc()).all()

    payload = [_row_to_dict(r) for r in rows]
    buf = BytesIO()
    buf.write(json.dumps(payload, indent=2).encode("utf-8"))
    buf.seek(0)
    filename = f"admin_activity_{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}.json"
    return send_file(buf, mimetype="application/json", as_attachment=True, download_name=filename)
