import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")

if not os.path.exists(DB_PATH):
    print(f"❌ Database file not found: {DB_PATH}")
else:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id, email, password, otp_secret FROM users")
        rows = cursor.fetchall()

        if not rows:
            print("ℹ️ No users found in the database.")
        else:
            print("✅ Users in database:")
            for row in rows:
                print(f"ID: {row[0]}, Email: {row[1]}, Password Hash: {row[2]}, OTP Secret: {row[3]}")
    except sqlite3.OperationalError as e:
        print(f"❌ Error reading database: {e}")
    finally:
        conn.close()
