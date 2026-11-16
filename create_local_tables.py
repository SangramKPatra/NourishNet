import sqlite3

def create_tables():
    conn = sqlite3.connect('dev.db')
    cursor = conn.cursor()
    
    # Create user_profiles table (extends users with extra fields)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_profiles (
            id CHAR(36) NOT NULL,
            role VARCHAR NOT NULL CHECK (role IN ('supplier', 'distributor')),
            lat FLOAT,
            lng FLOAT,
            radius_km FLOAT DEFAULT 10.0,
            active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL,
            updated_at DATETIME,
            PRIMARY KEY (id),
            FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Create donation_items table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS donation_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            donor_id CHAR(36) NOT NULL,
            name VARCHAR NOT NULL,
            approx_kg FLOAT NOT NULL CHECK (approx_kg > 0),
            tier VARCHAR NOT NULL CHECK (tier IN ('HIGH_MOISTURE', 'MEDIUM_MOISTURE', 'DRY')),
            portions INTEGER NOT NULL CHECK (portions > 0),
            ambient_temp_c FLOAT,
            humidity_pct FLOAT,
            weather_source VARCHAR,
            safe_window_min INTEGER,
            tier_expiry DATETIME,
            is_demo BOOLEAN DEFAULT 0,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (donor_id) REFERENCES user_profiles(id) ON DELETE CASCADE
        )
    ''')
    
    # Create donation_batches table with validity keys
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS donation_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            donor_id CHAR(36) NOT NULL,
            items TEXT NOT NULL DEFAULT '[]',
            total_kg FLOAT NOT NULL DEFAULT 0 CHECK (total_kg >= 0),
            portions INTEGER NOT NULL DEFAULT 0 CHECK (portions >= 0),
            tier VARCHAR NOT NULL CHECK (tier IN ('HIGH_MOISTURE', 'MEDIUM_MOISTURE', 'DRY')),
            ambient_temp_c FLOAT,
            humidity_pct FLOAT,
            weather_source VARCHAR,
            safe_window_min INTEGER,
            tier_expiry DATETIME,
            status VARCHAR NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'dispatched', 'claimed', 'picked_up', 'delivered', 'expired', 'at_risk')),
            validity_key VARCHAR UNIQUE,
            claimed_at DATETIME,
            claimed_by CHAR(36),
            completed_at DATETIME,
            created_at DATETIME NOT NULL,
            updated_at DATETIME,
            FOREIGN KEY (donor_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
            FOREIGN KEY (claimed_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ''')
    
    # Create indexes for performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_donation_items_donor_id ON donation_items(donor_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_donation_batches_donor_id ON donation_batches(donor_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_donation_batches_status ON donation_batches(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_donation_batches_validity_key ON donation_batches(validity_key)')
    
    # Create triggers for updated_at
    cursor.execute('''
        CREATE TRIGGER IF NOT EXISTS handle_user_profiles_updated_at
        AFTER UPDATE ON user_profiles
        BEGIN
            UPDATE user_profiles SET updated_at = datetime('now') WHERE id = NEW.id;
        END
    ''')
    
    cursor.execute('''
        CREATE TRIGGER IF NOT EXISTS handle_donation_items_updated_at
        AFTER UPDATE ON donation_items
        BEGIN
            UPDATE donation_items SET created_at = datetime('now') WHERE id = NEW.id;
        END
    ''')
    
    cursor.execute('''
        CREATE TRIGGER IF NOT EXISTS handle_donation_batches_updated_at
        AFTER UPDATE ON donation_batches
        BEGIN
            UPDATE donation_batches SET updated_at = datetime('now') WHERE id = NEW.id;
        END
    ''')
    
    conn.commit()
    conn.close()
    print('All local tables created successfully!')

if __name__ == '__main__':
    create_tables()