# auth.py
from flask import Blueprint, request, jsonify, current_app, make_response
from functools import wraps
import bcrypt, pyotp, jwt, datetime, secrets, hashlib
from sqlalchemy import func, func as sa_func

from db import db
from models_admin import append_admin_activity  # only what we use
from models_privacy import append_activity      # NEW: log user self-actions

auth_bp = Blueprint('auth', __name__)

# ---- Config ----
OTP_VALIDITY_SECONDS = 300
RESEND_COOLDOWN_SECONDS = 30
JWT_EXP_MIN = 15
REFRESH_EXP_DAYS = 14

# ---- Models ----
class UserModel(db.Model):
    __tablename__ = 'users'
    id          = db.Column(db.Integer, primary_key=True)
    email       = db.Column(db.String(120), unique=True, nullable=False)
    password    = db.Column(db.LargeBinary, nullable=False)
    otp_secret  = db.Column(db.String(32), nullable=False)
    last_otp_at = db.Column(db.DateTime, nullable=True)
    role        = db.Column(db.String(16), nullable=False, default='user')  # 'user' | 'admin'

class RefreshToken(db.Model):
    __tablename__ = 'refresh_tokens'
    id                = db.Column(db.Integer, primary_key=True)
    user_id           = db.Column(db.Integer, db.ForeignKey('users.id'), index=True, nullable=False)
    token_hash        = db.Column(db.String(128), unique=True, nullable=False)
    expires_at        = db.Column(db.DateTime, nullable=False)
    revoked           = db.Column(db.Boolean, default=False, nullable=False)
    created_at        = db.Column(db.DateTime, default=datetime.datetime.utcnow, nullable=False)
    replaced_by_token = db.Column(db.String(128), nullable=True)
    user              = db.relationship('UserModel', backref='refresh_tokens')

# ---- Helpers ----
def normalize_email(e: str) -> str:
    return (e or '').strip().lower()

def _create_access_jwt(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=JWT_EXP_MIN)
    }
    token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm="HS256")
    return token if isinstance(token, str) else token.decode('utf-8')

def _hash_refresh(raw: str) -> str:
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

def _mint_refresh(user_id: int) -> tuple[str, 'RefreshToken']:
    raw = secrets.token_urlsafe(48)
    rt = RefreshToken(
        user_id=user_id,
        token_hash=_hash_refresh(raw),
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_EXP_DAYS),
    )
    db.session.add(rt)
    db.session.commit()
    return raw, rt

def _rotate_refresh(old_rt: 'RefreshToken') -> str:
    new_raw, new_rt = _mint_refresh(old_rt.user_id)
    old_rt.revoked = True
    old_rt.replaced_by_token = new_rt.token_hash
    db.session.commit()
    return new_raw

def _set_refresh_cookie(resp, raw_refresh: str):
    resp.set_cookie(
        'refresh_token',
        raw_refresh,
        httponly=True,
        secure=False,         # True in production (HTTPS)
        samesite='Lax',
        max_age=REFRESH_EXP_DAYS * 24 * 3600,
        path='/',
    )

def _clear_refresh_cookie(resp):
    resp.delete_cookie('refresh_token', path='/')

# ---- Auth decorators ----
def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"message": "Missing token"}), 401
        token = auth_header.split(' ', 1)[1].strip()
        try:
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            user = UserModel.query.get(data.get('user_id'))
            if not user:
                return jsonify({"message": "User not found"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401
        return fn(user, *args, **kwargs)
    return wrapper

def require_role(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(user: UserModel, *args, **kwargs):
            if user.role not in roles:
                return jsonify({"message": "Forbidden: insufficient role"}), 403
            return fn(user, *args, **kwargs)
        return require_auth(wrapper)
    return decorator

# ---- User Routes ----
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    password = (data.get('password') or '').strip()
    role = (data.get('role') or 'user').strip().lower()
    if role not in ('user', 'admin'):
        return jsonify({"message": "Invalid role"}), 400
    if not email or not password:
        return jsonify({"message": "Email and password required"}), 400
    if UserModel.query.filter(func.lower(UserModel.email) == email).first():
        return jsonify({"message": "User already exists"}), 400
    if role == 'admin':
        invite = (data.get('admin_code') or '').strip()
        server_code = current_app.config.get('ADMIN_INVITE_CODE', '')
        if not server_code:
            return jsonify({"message": "Admin registration is disabled"}), 403
        if invite != server_code:
            return jsonify({"message": "Invalid admin invite code"}), 403
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    otp_secret = pyotp.random_base32()
    new_user = UserModel(email=email, password=hashed_pw, otp_secret=otp_secret, role=role)
    db.session.add(new_user)
    db.session.commit()
    print(f"[REGISTER] {email} (role={role})")
    return jsonify({"message": "User registered successfully", "role": role}), 200

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    password = (data.get('password') or '').strip()
    user = UserModel.query.filter(func.lower(UserModel.email) == email).first()
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password):
        return jsonify({"message": "Invalid credentials"}), 401
    totp = pyotp.TOTP(user.otp_secret, interval=OTP_VALIDITY_SECONDS)
    otp = totp.now()
    user.last_otp_at = datetime.datetime.utcnow()
    db.session.commit()
    print(f"[LOGIN] OTP for {email}: {otp}")
    return jsonify({"message": "OTP sent to user", "email": email}), 200

@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    user = UserModel.query.filter(func.lower(UserModel.email) == email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    now = datetime.datetime.utcnow()
    if user.last_otp_at:
        elapsed = (now - user.last_otp_at).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            wait = int(RESEND_COOLDOWN_SECONDS - elapsed)
            return jsonify({"message": f"Please wait {wait}s before requesting another OTP."}), 429
    totp = pyotp.TOTP(user.otp_secret, interval=OTP_VALIDITY_SECONDS)
    otp = totp.now()
    user.last_otp_at = now
    db.session.commit()
    print(f"[RESEND] OTP for {email}: {otp}")
    return jsonify({"message": "OTP resent"}), 200

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    otp_input = (data.get('otp') or '').strip()
    user = UserModel.query.filter(func.lower(UserModel.email) == email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    totp = pyotp.TOTP(user.otp_secret, interval=OTP_VALIDITY_SECONDS)
    if not totp.verify(otp_input, valid_window=1):
        return jsonify({"message": "Invalid OTP"}), 401
    access = _create_access_jwt(user.id)
    raw_refresh, _ = _mint_refresh(user.id)
    resp = make_response(jsonify({"message": "OTP verified. Login successful!", "token": access}), 200)
    _set_refresh_cookie(resp, raw_refresh)
    print(f"[VERIFY] OTP verified for {email}. JWT + refresh issued.")
    return resp

@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    raw = request.cookies.get('refresh_token')
    if not raw:
        return jsonify({"message": "Missing refresh token"}), 401
    rt_hash = _hash_refresh(raw)
    rt = RefreshToken.query.filter_by(token_hash=rt_hash).first()
    if not rt or rt.revoked or rt.expires_at < datetime.datetime.utcnow():
        resp = make_response(jsonify({"message": "Invalid refresh"}), 401)
        _clear_refresh_cookie(resp)
        return resp
    new_raw = _rotate_refresh(rt)
    access = _create_access_jwt(rt.user_id)
    resp = make_response(jsonify({"token": access}), 200)
    _set_refresh_cookie(resp, new_raw)
    return resp

@auth_bp.route('/logout', methods=['POST'])
def logout():
    raw = request.cookies.get('refresh_token')
    resp = make_response(jsonify({"message": "Logged out"}), 200)
    if raw:
        rt_hash = _hash_refresh(raw)
        rt = RefreshToken.query.filter_by(token_hash=rt_hash).first()
        if rt:
            rt.revoked = True
            db.session.commit()
    _clear_refresh_cookie(resp)
    return resp

@auth_bp.route('/me', methods=['GET'])
@require_auth
def me(user: UserModel):
    return jsonify({
        "id": user.id,
        "email": user.email,
        "role": user.role
    })

# ---------- NEW: user self-service ----------
@auth_bp.route('/me/password', methods=['PUT'])
@require_auth
def change_password(user: UserModel):
    data = request.get_json(silent=True) or {}
    current_pw = (data.get('current_password') or '').strip()
    new_pw = (data.get('new_password') or '').strip()

    if not current_pw or not new_pw:
        return jsonify({"message": "current_password and new_password are required"}), 400
    if not bcrypt.checkpw(current_pw.encode('utf-8'), user.password):
        return jsonify({"message": "Current password is incorrect"}), 401
    if len(new_pw) < 8:
        return jsonify({"message": "New password must be at least 8 characters"}), 400
    if bcrypt.checkpw(new_pw.encode('utf-8'), user.password):
        return jsonify({"message": "New password must be different from the current password"}), 400

    # Update password
    user.password = bcrypt.hashpw(new_pw.encode('utf-8'), bcrypt.gensalt())
    db.session.add(user)

    # Revoke all refresh tokens for this user (security)
    RefreshToken.query.filter_by(user_id=user.id, revoked=False).update({"revoked": True})
    db.session.commit()

    # Log activity
    append_activity(user.id, "PASSWORD_CHANGED", {})

    # Clear refresh cookie so the client must re-login (fresh session)
    resp = make_response(jsonify({"message": "Password updated. Please log in again."}), 200)
    _clear_refresh_cookie(resp)
    return resp

@auth_bp.route('/me/email', methods=['PUT'])
@require_auth
def change_email(user: UserModel):
    data = request.get_json(silent=True) or {}
    new_email = normalize_email(data.get('new_email'))
    current_pw = (data.get('current_password') or '').strip()

    if not new_email or not current_pw:
        return jsonify({"message": "new_email and current_password are required"}), 400
    if not bcrypt.checkpw(current_pw.encode('utf-8'), user.password):
        return jsonify({"message": "Current password is incorrect"}), 401

    # Must be unique
    exists = UserModel.query.filter(func.lower(UserModel.email) == new_email, UserModel.id != user.id).first()
    if exists:
        return jsonify({"message": "Email is already taken"}), 409

    old_email = user.email
    user.email = new_email
    db.session.add(user)
    db.session.commit()

    # Log activity
    append_activity(user.id, "EMAIL_CHANGED", {"old": old_email, "new": new_email})

    return jsonify({"message": "Email updated", "email": user.email}), 200

# ---------- Admin endpoints (separate OTP flow + admin user mgmt) ----------
@auth_bp.route('/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    password = (data.get('password') or '').strip()

    user = UserModel.query.filter(func.lower(UserModel.email) == email).first()
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password):
        return jsonify({"message": "Invalid credentials"}), 401

    if user.role != 'admin':
        return jsonify({"message": "Admins only"}), 403

    totp = pyotp.TOTP(user.otp_secret, interval=OTP_VALIDITY_SECONDS)
    otp = totp.now()
    user.last_otp_at = datetime.datetime.utcnow()
    db.session.commit()

    print(f"[ADMIN LOGIN] OTP for {email}: {otp}")
    return jsonify({"message": "OTP sent to admin", "email": email}), 200

@auth_bp.route('/admin/resend-otp', methods=['POST'])
def admin_resend_otp():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    user = UserModel.query.filter(func.lower(UserModel.email) == email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    if user.role != 'admin':
        return jsonify({"message": "Admins only"}), 403

    now = datetime.datetime.utcnow()
    if user.last_otp_at:
        elapsed = (now - user.last_otp_at).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            wait = int(RESEND_COOLDOWN_SECONDS - elapsed)
            return jsonify({"message": f"Please wait {wait}s before requesting another OTP."}), 429

    totp = pyotp.TOTP(user.otp_secret, interval=OTP_VALIDITY_SECONDS)
    otp = totp.now()
    user.last_otp_at = now
    db.session.commit()

    print(f"[ADMIN RESEND] OTP for {email}: {otp}")
    return jsonify({"message": "Admin OTP resent"}), 200

@auth_bp.route('/admin/verify-otp', methods=['POST'])
def admin_verify_otp():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    otp_input = (data.get('otp') or '').strip()

    user = UserModel.query.filter(func.lower(UserModel.email) == email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    if user.role != 'admin':
        return jsonify({"message": "Admins only"}), 403

    totp = pyotp.TOTP(user.otp_secret, interval=OTP_VALIDITY_SECONDS)
    if not totp.verify(otp_input, valid_window=1):
        return jsonify({"message": "Invalid OTP"}), 401

    access = _create_access_jwt(user.id)
    raw_refresh, _ = _mint_refresh(user.id)

    # Log successful admin login
    append_admin_activity(
        admin_id=user.id,
        action="ADMIN_LOGIN_OK",
        target_type="self",
        target_id=user.id,
        meta={"email": user.email},
    )

    resp = make_response(jsonify({"message": "OTP verified. Admin login successful!", "token": access}), 200)
    _set_refresh_cookie(resp, raw_refresh)
    print(f"[ADMIN VERIFY] OTP verified for {email}. JWT + refresh issued (admin).")
    return resp

@auth_bp.route('/admin/users', methods=['GET'])
@require_role('admin')
def admin_list_users(user: UserModel):
    # Log read operation
    append_admin_activity(
        admin_id=user.id,
        action="ADMIN_LIST_USERS",
        target_type="user",
        target_id="*",
        meta={"scope": "all"},
    )
    users = UserModel.query.order_by(UserModel.id.asc()).all()
    return jsonify([
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "last_otp_at": u.last_otp_at.isoformat() + "Z" if u.last_otp_at else None
        } for u in users
    ])

@auth_bp.route('/admin/users/<int:user_id>/role', methods=['POST'])
@require_role('admin')
def admin_change_role(user: UserModel, user_id: int):
    data = request.get_json() or {}
    new_role = (data.get('role') or '').strip()
    justification = (data.get('justification') or '').strip()

    if new_role not in ('user', 'admin'):
        return jsonify({"message": "Invalid role"}), 400
    if not justification or len(justification) < 5:
        return jsonify({"message": "Justification is required (min 5 chars)."}), 400

    target = UserModel.query.get(user_id)
    if not target:
        return jsonify({"message": "User not found"}), 404
    if target.id == user.id:
        return jsonify({"message": "Refusing to change own role"}), 400

    old_role = target.role
    target.role = new_role
    db.session.commit()

    # Log role change
    append_admin_activity(
        admin_id=user.id,
        action="ADMIN_ROLE_CHANGED",
        target_type="user",
        target_id=target.id,
        meta={"email": target.email, "old_role": old_role, "new_role": new_role},
        justification=justification,
    )

    return jsonify({"message": "Role updated", "id": target.id, "role": target.role}), 200

# ---------- Admin quick stats ----------
@auth_bp.route('/admin/stats', methods=['GET'])
@require_role('admin')
def admin_stats(current_admin: UserModel):
    total_users = db.session.query(sa_func.count(UserModel.id)).scalar() or 0
    total_admins = db.session.query(sa_func.count()).filter(UserModel.role == 'admin').scalar() or 0
    return jsonify({
        "totals": {"users": total_users, "admins": total_admins},
        "recent_actions": []  # (kept empty; AdminAudit fetches list anyway)
    })
