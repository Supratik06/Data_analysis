-- Database Schema for Expense Splitter

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at DATE NOT NULL,
    left_at DATE,
    UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    paid_by_id INTEGER REFERENCES users(id), -- Nullable for unresolved entries (can be set during import or left null)
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    date DATE NOT NULL,
    split_type TEXT NOT NULL, -- 'equal', 'unequal', 'percentage', 'share', 'settlement'
    notes TEXT,
    exchange_rate REAL DEFAULT 1.0,
    amount_in_inr REAL NOT NULL,
    is_settlement INTEGER DEFAULT 0 CHECK(is_settlement IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount REAL NOT NULL, -- Calculated share in INR
    share_value REAL, -- Original value specified in the split details (e.g. 30 for percentage, 2 for share)
    UNIQUE(expense_id, user_id)
);

CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    summary TEXT
);

CREATE TABLE IF NOT EXISTS import_anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_log_id INTEGER REFERENCES import_logs(id) ON DELETE CASCADE,
    row_index INTEGER,
    anomaly_type TEXT NOT NULL,
    description TEXT NOT NULL,
    raw_data TEXT,
    resolved_action TEXT,
    status TEXT DEFAULT 'pending'
);
