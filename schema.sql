-- Main Store schema. Runtime middleware also creates these tables safely on first /api request.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, access_key_hash TEXT NOT NULL, minecraft_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('Java','Bedrock')), whatsapp TEXT NOT NULL, email TEXT,
  product_id TEXT NOT NULL, product_name TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}',
  promo_code TEXT, subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK(status IN ('PENDING_PAYMENT','PAID','PROCESSING','COMPLETED','EXPIRED','CANCELLED')),
  partner_reference_no TEXT NOT NULL UNIQUE, dana_reference_no TEXT, qr_content TEXT, qr_image TEXT, qr_url TEXT,
  expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, paid_at TEXT, completed_at TEXT, rated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  player_name TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE TABLE IF NOT EXISTS review_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, review_order_id TEXT NOT NULL UNIQUE REFERENCES reviews(order_id),
  admin_name TEXT NOT NULL DEFAULT 'Tim SLF', reply TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_replies_created_at ON review_replies(created_at DESC);

CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL CHECK(price >= 0),
  description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '✦', tag TEXT NOT NULL DEFAULT 'Store',
  note TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_store_products_active ON store_products(active);
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('percent','fixed')), value REAL NOT NULL CHECK(value > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), expires_at TEXT, max_uses INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL DEFAULT 'admin', action TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT, details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity(created_at DESC);
CREATE TABLE IF NOT EXISTS reentry_tickets (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), access_key_hash TEXT NOT NULL,
  minecraft_name TEXT NOT NULL, product_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING_PAYMENT'
    CHECK (status IN ('WAITING_PAYMENT','ACTIVE','PENDING','COMPLETED','CANCELLED')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, submitted_at TEXT, completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reentry_tickets_order ON reentry_tickets(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reentry_tickets_status ON reentry_tickets(status, created_at DESC);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY, player_name TEXT NOT NULL, contact TEXT NOT NULL, category TEXT NOT NULL,
  subject TEXT NOT NULL, message TEXT NOT NULL, request_hash TEXT, status TEXT NOT NULL DEFAULT 'OPEN'
  CHECK(status IN ('OPEN','IN_PROGRESS','WAITING_PLAYER','RESOLVED','CLOSED')),
  admin_reply TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  starts_at TEXT, ends_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active, starts_at, ends_at);

INSERT OR IGNORE INTO store_products(id,name,price,description,icon,tag,note,active,created_at,updated_at) VALUES
('VIP_PLUS','VIP+',55000,'Rank VIP+ tetap dimiliki setelah langganan fitur berakhir; benefit aktif mengikuti masa langganan pada paket','♜','Rank tetap + fitur berlangganan','Saat langganan berakhir, rank VIP+ tetap ada tetapi benefit langganan berhenti. Saat aktif: 20 chunk/2 claim, /shop jarak jauh, dan 5 nyawa per tiket re-entry.',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('CUSTOM_RANK','Custom Rank',20000,'Rank dengan nama dan tampilan pilihan pembeli','✧','Personalisasi','Gaya final mengikuti kemampuan plugin dan format teks server SLF.',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('REENTRY_1','Tiket Masuk Kembali · 1',15000,'Satu tiket re-entry memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ yang langganan fiturnya aktif','♥','Paket 1 tiket','Setiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan fitur aktif. Pengajuan diproses manual oleh admin.',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('REENTRY_2','Tiket Masuk Kembali · 2',28000,'Paket dua tiket re-entry','♥','Paket 2 tiket','Setiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif. Pengajuan diproses manual oleh admin.',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('REENTRY_3','Tiket Masuk Kembali · 3',35000,'Paket tiga tiket re-entry','♥','Paket 3 tiket','Setiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif. Pengajuan diproses manual oleh admin.',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);


-- Owner-only finance ledger. Store sales are read from verified orders to avoid double counting.
CREATE TABLE IF NOT EXISTS finance_entries (
  id TEXT PRIMARY KEY, entry_date TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('INCOME','EXPENSE')),
  category TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0),
  reference TEXT, status TEXT NOT NULL DEFAULT 'POSTED' CHECK(status IN ('POSTED','VOIDED')),
  created_by TEXT NOT NULL DEFAULT 'owner', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_entries_date ON finance_entries(entry_date DESC,status);

CREATE TABLE IF NOT EXISTS admin_notes (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Operasional', priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DONE')),
  created_by TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_notes_status ON admin_notes(status,priority,updated_at DESC);

CREATE TABLE IF NOT EXISTS site_content (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('slot','card')), page TEXT NOT NULL CHECK(page IN ('home','store','wiki')),
  slot_key TEXT UNIQUE, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), starts_at TEXT, ends_at TEXT,
  created_by TEXT NOT NULL DEFAULT 'owner', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_content_active ON site_content(active,page,kind);

