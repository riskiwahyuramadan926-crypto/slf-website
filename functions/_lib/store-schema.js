const initialized = new WeakMap();

const statements = [
  `CREATE TABLE IF NOT EXISTS orders (
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
    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
      CHECK (status IN ('PENDING_PAYMENT','PAID','PROCESSING','COMPLETED','EXPIRED','CANCELLED')),
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
  )`,
  'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
  `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
    player_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC)',
  `CREATE TABLE IF NOT EXISTS review_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_order_id TEXT NOT NULL UNIQUE REFERENCES reviews(order_id),
    admin_name TEXT NOT NULL DEFAULT 'Tim SLF',
    reply TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_review_replies_created_at ON review_replies(created_at DESC)',
  `CREATE TABLE IF NOT EXISTS store_products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL CHECK (price >= 0),
    description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '✦', tag TEXT NOT NULL DEFAULT 'Store',
    note TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_store_products_active ON store_products(active)',
  `CREATE TABLE IF NOT EXISTS promo_codes (
    code TEXT PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('percent','fixed')), value REAL NOT NULL CHECK (value > 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), expires_at TEXT, max_uses INTEGER,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL DEFAULT 'admin', action TEXT NOT NULL,
    entity_type TEXT NOT NULL, entity_id TEXT, details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity(created_at DESC)',
  `CREATE TABLE IF NOT EXISTS reentry_tickets (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    access_key_hash TEXT NOT NULL,
    minecraft_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'WAITING_PAYMENT'
      CHECK (status IN ('WAITING_PAYMENT','ACTIVE','PENDING','COMPLETED','CANCELLED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    submitted_at TEXT,
    completed_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_reentry_tickets_order ON reentry_tickets(order_id, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_reentry_tickets_status ON reentry_tickets(status, created_at DESC)',
  `CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY, player_name TEXT NOT NULL, contact TEXT NOT NULL, category TEXT NOT NULL,
    subject TEXT NOT NULL, message TEXT NOT NULL, request_hash TEXT, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','WAITING_PLAYER','RESOLVED','CLOSED')),
    admin_reply TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC)',
  `CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    starts_at TEXT, ends_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active, starts_at, ends_at)',
  `CREATE TABLE IF NOT EXISTS finance_entries (
    id TEXT PRIMARY KEY, entry_date TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('INCOME','EXPENSE')),
    category TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0),
    reference TEXT, status TEXT NOT NULL DEFAULT 'POSTED' CHECK(status IN ('POSTED','VOIDED')),
    created_by TEXT NOT NULL DEFAULT 'owner', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_finance_entries_date ON finance_entries(entry_date DESC, status)',
  `CREATE TABLE IF NOT EXISTS admin_notes (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Operasional', priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DONE')),
    created_by TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_admin_notes_status ON admin_notes(status, priority, updated_at DESC)',
  `CREATE TABLE IF NOT EXISTS site_content (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('slot','card')), page TEXT NOT NULL CHECK(page IN ('home','store','wiki')),
    slot_key TEXT UNIQUE, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), starts_at TEXT, ends_at TEXT,
    created_by TEXT NOT NULL DEFAULT 'owner', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_site_content_active ON site_content(active, page, kind)',
  `CREATE TABLE IF NOT EXISTS investment_plans (
    id TEXT PRIMARY KEY, unit_price INTEGER NOT NULL CHECK(unit_price > 0), total_units INTEGER NOT NULL CHECK(total_units BETWEEN 1 AND 1000),
    profit_share_pct REAL NOT NULL CHECK(profit_share_pct >= 0 AND profit_share_pct <= 100),
    lock_months INTEGER NOT NULL CHECK(lock_months BETWEEN 1 AND 60), start_date TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PAUSED')),
    notes TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT 'owner', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`
];

export async function ensureStoreSchema(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('Binding D1 tidak tersedia atau tidak valid.');
  }
  let task = initialized.get(db);
  if (!task) {
    task = (async () => {
      for (const sql of statements) {
        await db.prepare(sql).run();
      }
      // Safe schema migration for a deployment that created the ticket table before the rate-limit field existed.
      try { await db.prepare('ALTER TABLE support_tickets ADD COLUMN request_hash TEXT').run(); }
      catch (error) { if (!/duplicate column/i.test(String(error?.message || error))) throw error; }
      const now = new Date().toISOString();
      const products = [
        ['VIP_PLUS','VIP+',55000,'Rank VIP+ permanen dengan fitur tambahan berlangganan 60 hari; fitur berhenti saat langganan berakhir, rank tetap','♜','Rank tetap + fitur berlangganan','Fitur tambahan VIP+ aktif selama langganan 60 hari: 20 chunk/2 claim, /shop jarak jauh, dan 5 nyawa per tiket re-entry. Saat langganan berakhir, rank VIP+ dan Custom Rank tetap permanen, tetapi fitur tambahan berhenti.'],
        ['CUSTOM_RANK','Custom Rank',20000,'Rank dengan nama dan tampilan pilihan pembeli','✧','Personalisasi','Gaya final mengikuti kemampuan plugin dan format teks server SLF.'],
        ['REENTRY_1','Tiket Masuk Kembali · 1',15000,'Satu tiket re-entry memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ yang langganan fiturnya aktif','♥','Paket 1 tiket','Setiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan fitur aktif. Pengajuan diproses manual oleh admin.'],
        ['REENTRY_2','Tiket Masuk Kembali · 2',28000,'Paket dua tiket re-entry; jumlah nyawa per tiket mengikuti rank dan status langganan VIP+','♥','Paket 2 tiket','Setiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan fitur aktif. Pengajuan diproses manual oleh admin.'],
        ['REENTRY_3','Tiket Masuk Kembali · 3',35000,'Paket tiga tiket re-entry; jumlah nyawa per tiket mengikuti rank dan status langganan VIP+','♥','Paket 3 tiket','Setiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan fitur aktif. Pengajuan diproses manual oleh admin.']
      ];
      for (const p of products) {
        await db.prepare('INSERT OR IGNORE INTO store_products (id,name,price,description,icon,tag,note,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .bind(...p,1,now,now).run();
      }
      // Migrate only the older default copy. Do not overwrite product descriptions edited later in the Owner panel.
      const vip = products.find(p => p[0] === 'VIP_PLUS');
      await db.prepare(`UPDATE store_products SET description=?,tag=?,note=?,updated_at=?
        WHERE id='VIP_PLUS' AND (description LIKE 'Rank VIP+ dan Custom Rank permanen%' OR note LIKE '%claim 15 chunk/3 claim%' OR (description='Rank VIP+ tetap dimiliki setelah langganan fitur berakhir; benefit aktif mengikuti masa langganan pada paket' AND note LIKE 'Saat langganan berakhir, rank VIP+ tetap ada%'))`)
        .bind(vip[3],vip[5],vip[6],now).run();
      const ticket = products.find(p => p[0] === 'REENTRY_1');
      await db.prepare(`UPDATE store_products SET description=?,note=?,updated_at=?
        WHERE id='REENTRY_1' AND description LIKE 'Satu tiket re-entry:%'`)
        .bind(ticket[3],ticket[6],now).run();
      await db.prepare("INSERT OR IGNORE INTO investment_plans (id,unit_price,total_units,profit_share_pct,lock_months,start_date,status,notes,updated_by,created_at,updated_at) VALUES ('main-draft',500000,20,40,4,NULL,'DRAFT','Draft internal only. Belum menjadi penawaran publik atau penerimaan pembayaran.','owner',?,?)")
        .bind(now,now).run();
    })();
    initialized.set(db, task);
  }
  try {
    await task;
  } catch (error) {
    initialized.delete(db);
    throw error;
  }
}
