import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const databasePath = process.env.DATABASE_PATH || path.resolve('data', 'krishisetu.sqlite');
const dataDir = path.dirname(path.resolve(databasePath));
fs.mkdirSync(dataDir, { recursive: true });
export const db = new Database(path.resolve(databasePath));
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('FARMER','OPERATOR','ADMIN')),
      mobile TEXT, state TEXT, district TEXT, village TEXT, language TEXT DEFAULT 'English', centre_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (centre_id) REFERENCES centres(id)
    );
    CREATE TABLE IF NOT EXISTS centres (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, district TEXT NOT NULL, state TEXT NOT NULL,
      daily_capacity INTEGER NOT NULL, active_counters INTEGER NOT NULL DEFAULT 1,
      average_processing_minutes REAL NOT NULL DEFAULT 18, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS crops (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, price_per_quintal REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, centre_id INTEGER NOT NULL, slot_date TEXT NOT NULL,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, capacity INTEGER NOT NULL,
      UNIQUE(centre_id, slot_date, start_time), FOREIGN KEY(centre_id) REFERENCES centres(id)
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, farmer_id INTEGER NOT NULL, centre_id INTEGER NOT NULL, crop_id INTEGER NOT NULL,
      slot_id INTEGER NOT NULL, quantity REAL NOT NULL, token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'BOOKED' CHECK(status IN ('BOOKED','CHECKED_IN','WAITING','CALLED','PROCESSING','COMPLETED','SKIPPED','NO_SHOW','CANCELLED')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, checked_in_at TEXT, completed_at TEXT,
      FOREIGN KEY(farmer_id) REFERENCES users(id), FOREIGN KEY(centre_id) REFERENCES centres(id), FOREIGN KEY(crop_id) REFERENCES crops(id), FOREIGN KEY(slot_id) REFERENCES slots(id)
    );
    CREATE TABLE IF NOT EXISTS queue_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL UNIQUE, position INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'BOOKED', estimated_wait_minutes REAL NOT NULL DEFAULT 0,
      called_at TEXT, FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS procurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL UNIQUE, quality_status TEXT NOT NULL DEFAULT 'PENDING',
      actual_quantity REAL, stage TEXT NOT NULL DEFAULT 'BOOKED', verification_at TEXT, quality_at TEXT, weighing_at TEXT, completed_at TEXT,
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL UNIQUE, amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED','INITIATED','PROCESSING','COMPLETED')),
      transaction_ref TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT,
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'IN_APP', read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, resource TEXT NOT NULL,
      resource_id INTEGER, old_value TEXT, new_value TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
  `);
  const bookingColumns = db.prepare('PRAGMA table_info(bookings)').all().map((column) => column.name);
  if (!bookingColumns.includes('quantity_unit')) db.exec("ALTER TABLE bookings ADD COLUMN quantity_unit TEXT NOT NULL DEFAULT 'quintals'");
}

function clearData() {
  db.exec('PRAGMA foreign_keys = OFF; DELETE FROM audit_logs; DELETE FROM notifications; DELETE FROM payments; DELETE FROM procurements; DELETE FROM queue_entries; DELETE FROM bookings; DELETE FROM slots; DELETE FROM sessions; DELETE FROM users; DELETE FROM crops; DELETE FROM centres; DELETE FROM sqlite_sequence; PRAGMA foreign_keys = ON;');
}

export function seed() {
  migrate();
  if (db.prepare('SELECT COUNT(*) count FROM users').get().count > 0) return;
  const insertCentre = db.prepare('INSERT INTO centres (name,district,state,daily_capacity,active_counters,average_processing_minutes) VALUES (?,?,?,?,?,?)');
  const nashik = insertCentre.run('APMC Nashik East', 'Nashik', 'Maharashtra', 100, 2, 18).lastInsertRowid;
  const pune = insertCentre.run('Pune Grain Yard', 'Pune', 'Maharashtra', 90, 2, 22).lastInsertRowid;
  const sinnar = insertCentre.run('Sinnar Collection Hub', 'Nashik', 'Maharashtra', 80, 1, 16).lastInsertRowid;
  const insertCrop = db.prepare('INSERT INTO crops (name,price_per_quintal) VALUES (?,?)');
  const wheat = insertCrop.run('Wheat', 2000).lastInsertRowid;
  insertCrop.run('Rice', 2183); insertCrop.run('Soybean', 4892); insertCrop.run('Maize', 2225); insertCrop.run('Cotton', 7120);
  const password = bcrypt.hashSync('demo123', 10);
  const insertUser = db.prepare('INSERT INTO users (name,email,password_hash,role,mobile,state,district,village,language,centre_id) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const farmer = insertUser.run('Ramesh Kumar', 'demo.farmer@example.com', password, 'FARMER', '9000000001', 'Maharashtra', 'Nashik', 'Songaon', 'English', nashik).lastInsertRowid;
  insertUser.run('Meera Joshi', 'demo.operator@example.com', password, 'OPERATOR', '9000000002', 'Maharashtra', 'Nashik', 'Nashik', 'English', nashik);
  insertUser.run('Anil Deshmukh', 'demo.admin@example.com', password, 'ADMIN', '9000000003', 'Maharashtra', 'Mumbai', 'Mumbai', 'English', null);
  const insertSlot = db.prepare('INSERT INTO slots (centre_id,slot_date,start_time,end_time,capacity) VALUES (?,?,?,?,?)');
  for (const centreId of [nashik, pune, sinnar]) for (const time of [['09:00','09:30'],['09:30','10:00'],['10:00','10:30'],['10:30','11:00'],['11:00','11:30'],['11:30','12:00']]) insertSlot.run(centreId, '2026-09-12', time[0], time[1], 10);
  const slot = db.prepare("SELECT id FROM slots WHERE centre_id=? AND start_time='10:30'").get(nashik).id;
  const booking = insertBooking({ farmerId: farmer, centreId: nashik, cropId: wheat, slotId: slot, quantity: 48, token: 'KRS-1048', status: 'BOOKED' });
  db.prepare('INSERT INTO notifications (user_id,title,message) VALUES (?,?,?)').run(farmer, 'Welcome to KrishiSetu', 'Your demo farmer account is ready.');
  db.prepare('INSERT INTO audit_logs (user_id,action,resource,resource_id,new_value) VALUES (?,?,?,?,?)').run(farmer, 'SEED_SCENARIO', 'booking', booking, 'KRS-1048');
}

function insertBooking({ farmerId, centreId, cropId, slotId, quantity, token, status }) {
  const id = db.prepare('INSERT INTO bookings (farmer_id,centre_id,crop_id,slot_id,quantity,token,status) VALUES (?,?,?,?,?,?,?)').run(farmerId, centreId, cropId, slotId, quantity, token, status).lastInsertRowid;
  db.prepare('INSERT INTO queue_entries (booking_id,status) VALUES (?,?)').run(id, status);
  db.prepare('INSERT INTO procurements (booking_id,stage) VALUES (?,?)').run(id, status);
  db.prepare('INSERT INTO payments (booking_id) VALUES (?)').run(id);
  return id;
}

export function reset() { migrate(); clearData(); seed(); }

migrate();
if (process.argv[1]?.endsWith('db.js')) { const command = process.argv[2] || 'migrate'; if (command === 'reset') reset(); else if (command === 'seed') seed(); }
