# seed_admin.py
import os
import getpass
import bcrypt
import pyotp

from flask import Flask
from db import db
from auth import UserModel
from main import app  # reuse app & db bindings

def main():
    with app.app_context():
        db.create_all()
        invite = os.getenv("ADMIN_INVITE_CODE", "").strip()
        if not invite:
            print("[ERROR] ADMIN_INVITE_CODE env var must be set before seeding.")
            return

        email = input("Admin email to create: ").strip().lower()
        if not email:
            print("No email provided.")
            return

        existing = UserModel.query.filter_by(email=email).first()
        if existing:
            print("User already exists; aborting.")
            return

        pwd = getpass.getpass("Admin password: ")
        if not pwd or len(pwd) < 8:
            print("Password must be at least 8 chars.")
            return

        hashed_pw = bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt())
        otp_secret = pyotp.random_base32()

        u = UserModel(email=email, password=hashed_pw, otp_secret=otp_secret, role='admin')
        db.session.add(u)
        db.session.commit()

        print(f"\n[OK] Admin created: {email}")
        print(f"OTP secret (for apps like Google Authenticator, for demo we TOTP via backend): {otp_secret}")

if __name__ == "__main__":
    main()
