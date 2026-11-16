import sqlite3
import hashlib
import secrets

conn = sqlite3.connect('dev.db')
cursor = conn.cursor()
cursor.execute("SELECT email, password_hash, password_salt, role FROM users")
users = cursor.fetchall()

for user in users:
    email, hash_val, salt, role = user
    # Try common passwords
    for pwd in ['password123', 'test', '123456', 'nourish', 'food', '1234']:
        key = hashlib.pbkdf2_hmac(
            "sha256",
            pwd.encode(),
            bytes.fromhex(salt),
            200_000,
        )
        if key.hex() == hash_val:
            print(f"MATCH: {email} password='{pwd}' role={role}")
            break
    else:
        print(f"NO MATCH: {email} role={role}")

conn.close()