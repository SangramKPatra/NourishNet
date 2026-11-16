import sqlite3
import hashlib
import secrets

conn = sqlite3.connect('dev.db')
cursor = conn.cursor()
cursor.execute("SELECT email, password_hash, password_salt, role FROM users WHERE email = 'test@nourishnet.dev'")
row = cursor.fetchone()
print("Email:", row[0])
print("Password hash:", row[1][:20] + "...")
print("Password salt:", row[2][:20] + "...")
print("Role:", row[3])

# Test verify_password manually
key = hashlib.pbkdf2_hmac(
    "sha256",
    b'password123',
    bytes.fromhex(row[2]),
    200_000,
)
actual = key.hex()
print("Computed hash:", actual[:20] + "...")
print("Match:", actual == row[1])
conn.close()