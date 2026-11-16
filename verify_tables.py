import sqlite3

conn = sqlite3.connect('dev.db')
cursor = conn.cursor()

# List all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()
print('Tables:', [t[0] for t in tables])

# Check user_profiles
cursor.execute("PRAGMA table_info(user_profiles)")
print("\nuser_profiles columns:")
for col in cursor.fetchall():
    print(f"  {col[1]} ({col[2]})")

# Check donation_items
cursor.execute("PRAGMA table_info(donation_items)")
print("\ndonation_items columns:")
for col in cursor.fetchall():
    print(f"  {col[1]} ({col[2]})")

# Check donation_batches
cursor.execute("PRAGMA table_info(donation_batches)")
print("\ndonation_batches columns:")
for col in cursor.fetchall():
    print(f"  {col[1]} ({col[2]})")

# Check indexes
cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
indexes = cursor.fetchall()
print("\nIndexes:", [i[0] for i in indexes])

conn.close()