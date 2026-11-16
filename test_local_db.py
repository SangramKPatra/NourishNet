import sqlite3
import sys
sys.path.insert(0, r'.')
print('Testing SQLite connection...')

# Test direct SQLite connection
conn = sqlite3.connect('dev.db')
cursor = conn.cursor()

# List tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print('Tables:', tables)

# Check each expected table
for table in ['users', 'user_profiles', 'donation_items', 'donation_batches']:
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    print(f'\n{table} columns:')
    for col in columns:
        print(f'  {col[1]} ({col[2]})')

# Try to get schema
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
sql = cursor.fetchone()
print('\nUsers schema:', sql[0] if sql else 'Not found')

cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_profiles'")
sql = cursor.fetchone()
print('User profiles schema:', sql[0] if sql else 'Not found')

cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='donation_items'")
sql = cursor.fetchone()
print('Donation items schema:', sql[0] if sql else 'Not found')

cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='donation_batches'")
sql = cursor.fetchone()
print('Donation batches schema:', sql[0] if sql else 'Not found')

conn.close()
print('\nDone!')