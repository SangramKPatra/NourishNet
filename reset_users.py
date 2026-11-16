import sqlite3
import hashlib
import secrets

def hash_password(password):
    """Hash a password using the same method as auth.py"""
    if secrets is not None:
        salt = secrets.token_bytes(32)
    else:
        # Fallback if secrets not available
        import os
        salt = os.urandom(32).hex()
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        200_000,
    )
    return key.hex(), salt.hex()

conn = sqlite3.connect('dev.db')
cursor = conn.cursor()

# Delete all existing users
cursor.execute("DELETE FROM users")
cursor.execute("DELETE FROM user_tokens")

# Create fresh users with known passwords
users_data = [
    ('test@nourishnet.dev', 'password123', 'supplier', 37.7749, -122.4194, 15),
    ('home@test.com', 'password123', 'supplier', 37.77, -122.41, 10),
    ('donor@test.com', 'password123', 'supplier', 37.7749, -122.4194, 15),
    ('distributor@test.com', 'password123', 'distributor', 37.7749, -122.4194, 15),
    ('newuser@test.com', 'password123', 'distributor', 37.7, -122.4, 5),
]

for data in users_data:
    email, password, role, lat, lng, radius = data
    password_hash, salt = hash_password(password)
    import uuid
    user_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO users (id, email, password_hash, password_salt, role, lat, lng, radius_km, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))",
        (user_id, email, password_hash, salt, role, lat, lng, radius)
    )
    print(f"Created user: {email} role={role}")

conn.commit()
conn.close()
print("\nAll users reset with password 'password123'")