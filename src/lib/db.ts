import Database from 'better-sqlite3';
import path from 'path';

// Define the absolute path to the database file in the project root
const dbPath = path.join(process.cwd(), 'my-wrld.db');

// Initialize the database connection
const db = new Database(dbPath);

// Create the flights table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS flights (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    origin_code TEXT NOT NULL,
    origin_city TEXT NOT NULL,
    destination_code TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    flight_number TEXT,
    status TEXT,
    type TEXT,
    confirmed_at TEXT,
    user_id TEXT
  )
`);

export default db;
