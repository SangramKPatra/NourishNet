import sqlite3
conn = sqlite3.connect('backend/dev.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print('Tables:', [row[0] for row in cursor.fetchall()])
cursor.execute('PRAGMA table_info(users)')
print('Users columns:', [row[1] for row in cursor.fetchall()])
conn.close()