-- Jalankan di Cloudflare D1 database yang di-bind ke Pages Function sebagai DB.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  access_key_hash TEXT NOT NULL,
  minecraft_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('Java','Bedrock')),
  whatsapp TEXT NOT NULL,
  email TEXT,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  promo_code TEXT,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('PENDING_PAYMENT','PAID','PROCESSING','COMPLETED','EXPIRED','CANCELLED')),
  partner_reference_no TEXT NOT NULL UNIQUE,
  dana_reference_no TEXT,
  qr_content TEXT,
  qr_image TEXT,
  qr_url TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  completed_at TEXT,
  rated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  player_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
