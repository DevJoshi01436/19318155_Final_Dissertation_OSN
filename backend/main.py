# main.py
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from db import db  # shared SQLAlchemy instance
from models_admin import AdminActivityLog  # ensure table gets created

# NEW: Flask-Limiter
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

# ---------- CORS ----------
CORS(
    app,
    resources={r"/*": {"origins": ["http://127.0.0.1:3000", "http://localhost:3000"]}},
    supports_credentials=True,
)

# ---- Secrets / Config ----
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET')
app.config['ADMIN_INVITE_CODE'] = os.getenv('ADMIN_INVITE_CODE', '').strip()

# ---- SQLite DB ----
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(BASE_DIR, 'users.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# ---------- Rate Limiter (NEW) ----------
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per hour"],   # global default; safe
    storage_uri="memory://",           # swap to Redis in prod: "redis://localhost:6379/0"
)

# Register blueprints AFTER init_app
from auth import auth_bp
from privacy import privacy_bp
from admin_audit import admin_audit_bp

app.register_blueprint(auth_bp)
app.register_blueprint(privacy_bp)
app.register_blueprint(admin_audit_bp)

ALLOWED_ORIGINS = {"http://127.0.0.1:3000", "http://localhost:3000"}

# ---------- Security + CORS headers ----------
@app.after_request
def set_security_and_cors_headers(resp):
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['X-Frame-Options'] = 'DENY'
    resp.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    resp.headers['Cross-Origin-Resource-Policy'] = 'same-site'

    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        resp.headers['Access-Control-Allow-Origin'] = origin
        resp.headers['Access-Control-Allow-Credentials'] = 'true'
        resp.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
        resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        resp.headers.add('Vary', 'Origin')
    return resp

@app.route('/')
def home():
    return jsonify({"message": "Backend is working!"})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
