# ensure_tables.py
from main import app, db
# Import models so SQLAlchemy knows about them
from auth import UserModel, RefreshToken

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print("✅ tables ensured (including refresh_tokens)")
