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
  `CREATE TABLE IF NOT EXISTS admin_auth_attempts (
    ip_hash TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    window_started INTEGER NOT NULL,
    blocked_until INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS reentry_tickets (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    access_key_hash TEXT NOT NULL,
    minecraft_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    season_id TEXT NOT NULL DEFAULT 'season-1',
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
  'CREATE INDEX IF NOT EXISTS idx_site_content_active ON site_content(active, page, kind)'
];

// Existing D1 databases can keep older table layouts even when CREATE TABLE IF NOT EXISTS runs.
// Add missing non-key columns before building indexes or using the Admin APIs.
const legacyColumnDefinitions = {
  orders: {
    access_key_hash: 'TEXT', minecraft_name: 'TEXT', platform: "TEXT DEFAULT 'Java'",
    whatsapp: "TEXT DEFAULT ''", email: 'TEXT', product_id: "TEXT DEFAULT ''",
    product_name: "TEXT DEFAULT ''", details_json: "TEXT DEFAULT '{}'", promo_code: 'TEXT',
    subtotal: 'INTEGER DEFAULT 0', discount: 'INTEGER DEFAULT 0', total: 'INTEGER DEFAULT 0',
    status: "TEXT DEFAULT 'PENDING_PAYMENT'", partner_reference_no: 'TEXT', dana_reference_no: 'TEXT',
    qr_content: 'TEXT', qr_image: 'TEXT', qr_url: 'TEXT', expires_at: 'TEXT',
    created_at: 'TEXT', updated_at: 'TEXT', paid_at: 'TEXT', completed_at: 'TEXT', rated_at: 'TEXT'
  },
  reviews: { order_id: 'TEXT', player_name: "TEXT DEFAULT ''", rating: 'INTEGER', comment: 'TEXT', created_at: 'TEXT' },
  review_replies: { review_order_id: 'TEXT', admin_name: "TEXT DEFAULT 'Tim SLF'", reply: "TEXT DEFAULT ''", created_at: 'TEXT', updated_at: 'TEXT' },
  store_products: {
    name: "TEXT DEFAULT ''", price: 'INTEGER DEFAULT 0', description: "TEXT DEFAULT ''",
    icon: "TEXT DEFAULT '✦'", tag: "TEXT DEFAULT 'Store'", note: "TEXT DEFAULT ''",
    active: 'INTEGER DEFAULT 1', created_at: 'TEXT', updated_at: 'TEXT'
  },
  promo_codes: { type: "TEXT DEFAULT 'percent'", value: 'REAL DEFAULT 0', active: 'INTEGER DEFAULT 1', expires_at: 'TEXT', max_uses: 'INTEGER', created_at: 'TEXT', updated_at: 'TEXT' },
  admin_activity: { actor: "TEXT DEFAULT 'admin'", action: "TEXT DEFAULT ''", entity_type: "TEXT DEFAULT ''", entity_id: 'TEXT', details_json: "TEXT DEFAULT '{}'", created_at: 'TEXT' },
  admin_auth_attempts: { attempts: 'INTEGER DEFAULT 0', window_started: 'INTEGER DEFAULT 0', blocked_until: 'INTEGER DEFAULT 0' },
  reentry_tickets: {
    order_id: 'TEXT', access_key_hash: "TEXT DEFAULT ''", minecraft_name: "TEXT DEFAULT ''",
    product_name: "TEXT DEFAULT ''", season_id: "TEXT DEFAULT 'season-1'",
    status: "TEXT DEFAULT 'WAITING_PAYMENT'", created_at: 'TEXT', updated_at: 'TEXT',
    submitted_at: 'TEXT', completed_at: 'TEXT'
  },
  support_tickets: {
    player_name: "TEXT DEFAULT ''", contact: "TEXT DEFAULT ''", category: "TEXT DEFAULT 'other'",
    subject: "TEXT DEFAULT ''", message: "TEXT DEFAULT ''", request_hash: 'TEXT',
    status: "TEXT DEFAULT 'OPEN'", admin_reply: 'TEXT', created_at: 'TEXT', updated_at: 'TEXT', resolved_at: 'TEXT'
  },
  announcements: { title: "TEXT DEFAULT ''", body: "TEXT DEFAULT ''", active: 'INTEGER DEFAULT 1', starts_at: 'TEXT', ends_at: 'TEXT', created_at: 'TEXT', updated_at: 'TEXT' },
  finance_entries: {
    entry_date: 'TEXT', kind: "TEXT DEFAULT 'INCOME'", category: "TEXT DEFAULT 'Lainnya'",
    description: "TEXT DEFAULT ''", amount: 'INTEGER DEFAULT 0', reference: 'TEXT',
    status: "TEXT DEFAULT 'POSTED'", created_by: "TEXT DEFAULT 'owner'", created_at: 'TEXT', updated_at: 'TEXT'
  },
  admin_notes: {
    title: "TEXT DEFAULT ''", body: "TEXT DEFAULT ''", category: "TEXT DEFAULT 'Operasional'",
    priority: "TEXT DEFAULT 'MEDIUM'", status: "TEXT DEFAULT 'OPEN'",
    created_by: "TEXT DEFAULT 'admin'", created_at: 'TEXT', updated_at: 'TEXT'
  },
  site_content: {
    kind: "TEXT DEFAULT 'slot'", page: "TEXT DEFAULT 'home'", slot_key: 'TEXT',
    title: "TEXT DEFAULT ''", body: "TEXT DEFAULT ''", active: 'INTEGER DEFAULT 1',
    starts_at: 'TEXT', ends_at: 'TEXT', created_by: "TEXT DEFAULT 'owner'", created_at: 'TEXT', updated_at: 'TEXT'
  }
};

async function ensureLegacyColumns(db) {
  for (const [table, columns] of Object.entries(legacyColumnDefinitions)) {
    const { results = [] } = await db.prepare('PRAGMA table_info("' + table + '")').all();
    const existing = new Set(results.map(row => row.name));
    if (!results.length) throw new Error('Tabel ' + table + ' tidak ditemukan setelah tahap pembuatan tabel.');
    for (const [column, definition] of Object.entries(columns)) {
      if (existing.has(column)) continue;
      try {
        await db.prepare('ALTER TABLE "' + table + '" ADD COLUMN "' + column + '" ' + definition).run();
        existing.add(column);
      } catch (error) {
        throw new Error('column-migration:' + table + '.' + column + ':' + String(error?.message || error).slice(0, 180));
      }
    }
  }
}

export async function ensureStoreSchema(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('Binding D1 tidak tersedia atau tidak valid.');
  }
  let task = initialized.get(db);
  if (!task) {
    task = (async () => {
      const tableStatements = statements.filter(sql => /^\s*CREATE TABLE IF NOT EXISTS/i.test(sql));
      const indexStatements = statements.filter(sql => /^\s*CREATE INDEX IF NOT EXISTS/i.test(sql));

      // First create any missing tables. Existing tables are deliberately not dropped or rebuilt.
      for (let i = 0; i < tableStatements.length; i += 1) {
        const sql = tableStatements[i];
        try {
          await db.prepare(sql).run();
        } catch (error) {
          console.error('[SLF_SCHEMA] create-table-' + (i + 1) + ' failed:', error?.message || error);
          throw new Error('SLF_SCHEMA_STEP:create-table-' + (i + 1) + ':' + String(error?.message || error).slice(0, 240));
        }
      }

      // Upgrade legacy tables before indexes are created. This prevents a single old table
      // missing a newly introduced column from blocking the entire Admin/Store API.
      try {
        await ensureLegacyColumns(db);
      } catch (error) {
        console.error('[SLF_SCHEMA] legacy-column-migration failed:', error?.message || error);
        throw new Error('SLF_SCHEMA_STEP:legacy-column-migration:' + String(error?.message || error).slice(0, 240));
      }

      for (let i = 0; i < indexStatements.length; i += 1) {
        const sql = indexStatements[i];
        try {
          await db.prepare(sql).run();
        } catch (error) {
          console.error('[SLF_SCHEMA] create-index-' + (i + 1) + ' failed:', error?.message || error);
          throw new Error('SLF_SCHEMA_STEP:create-index-' + (i + 1) + ':' + String(error?.message || error).slice(0, 240));
        }
      }
      // Safe schema migration for a deployment that created the ticket table before the rate-limit field existed.
      try { await db.prepare('ALTER TABLE support_tickets ADD COLUMN request_hash TEXT').run(); }
      catch (error) { if (!/duplicate column/i.test(String(error?.message || error))) throw error; }
      // Tag each re-entry ticket with the season in which its quota was reserved.
      // Existing tickets are classified as season-1; future season changes use SLF_CURRENT_SEASON.
      try { await db.prepare("ALTER TABLE reentry_tickets ADD COLUMN season_id TEXT NOT NULL DEFAULT 'season-1'").run(); }
      catch (error) { if (!/duplicate column/i.test(String(error?.message || error))) throw error; }
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_reentry_tickets_season_player ON reentry_tickets(season_id, minecraft_name, created_at)').run();
      const now = new Date().toISOString();
      const products = [
        ['VIP_PLUS','VIP+',55000,'Rank VIP+ permanen dengan fitur tambahan berlangganan 60 hari; fitur berhenti saat langganan berakhir, rank tetap','♜','Rank tetap + fitur berlangganan','Fitur tambahan VIP+ aktif selama langganan 60 hari: 20 chunk/2 claim, /shop jarak jauh, dan 5 nyawa per tiket re-entry. Saat langganan berakhir, rank VIP+ dan Custom Rank tetap permanen, tetapi fitur tambahan berhenti.'],
        ['CUSTOM_RANK','Custom Rank',20000,'Rank dengan nama dan tampilan pilihan pembeli','✧','Personalisasi','Gaya final mengikuti kemampuan plugin dan format teks server SLF.'],
        ['REENTRY_1','Tiket Masuk Kembali · 1',15000,'Satu tiket re-entry memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ yang langganan fiturnya aktif. Maksimal total 3 tiket per pemain per season.','♥','Paket 1 tiket','Setiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan fitur aktif. Batas total 3 tiket per pemain per season; pengajuan diproses manual oleh admin.'],
        ['REENTRY_2','Tiket Masuk Kembali · 2',28000,'Paket dua tiket re-entry; tiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif. Maksimal total 3 tiket per pemain per season.','♥','Paket 2 tiket','Paket 2 dihitung sebagai 2 tiket dalam batas maksimum 3 tiket per pemain per season. Jumlah nyawa mengikuti status langganan VIP+; pengajuan diproses manual.'],
        ['REENTRY_3','Tiket Masuk Kembali · 3',35000,'Paket tiga tiket re-entry; tiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif. Paket ini menghabiskan kuota 3 tiket per pemain per season.','♥','Paket 3 tiket','Paket 3 menghabiskan seluruh kuota maksimal 3 tiket per pemain per season. Jumlah nyawa mengikuti status langganan VIP+; pengajuan diproses manual.']
      ];
      for (const p of products) {
        await db.prepare('INSERT OR IGNORE INTO store_products (id,name,price,description,icon,tag,note,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .bind(...p,1,now,now).run();
      }
      // Migrate only the older default copy. Do not overwrite product descriptions edited later in the Owner panel.
      const vip = products.find(p => p[0] === 'VIP_PLUS');
      await db.prepare(`UPDATE store_products SET description=?,tag=?,note=?,updated_at=?
        WHERE id='VIP_PLUS' AND (description LIKE 'Rank VIP+ dan Custom Rank permanen%' OR description LIKE 'Rank VIP+ dengan fitur Custom Rank permanen%' OR note LIKE '%claim 15 chunk/3 claim%' OR (description='Rank VIP+ tetap dimiliki setelah langganan fitur berakhir; benefit aktif mengikuti masa langganan pada paket' AND note LIKE 'Saat langganan berakhir, rank VIP+ tetap ada%'))`)
        .bind(vip[3],vip[5],vip[6],now).run();
      const ticket1 = products.find(p => p[0] === 'REENTRY_1');
      await db.prepare(`UPDATE store_products SET description=?,note=?,updated_at=?
        WHERE id='REENTRY_1'
          AND description NOT LIKE '%Maksimal total 3 tiket per pemain per season%'
          AND note NOT LIKE '%3 tiket per pemain per season%'
          AND (description LIKE 'Satu tiket re-entry:%' OR description LIKE 'Satu tiket re-entry memberi %' OR description LIKE 'Satu tiket re-entry untuk mengajukan%')
          AND note LIKE 'Setiap tiket%'`)
        .bind(ticket1[3],ticket1[6],now).run();
      const ticket2 = products.find(p => p[0] === 'REENTRY_2');
      await db.prepare(`UPDATE store_products SET description=?,note=?,updated_at=?
        WHERE id='REENTRY_2'
          AND description NOT LIKE '%Maksimal total 3 tiket per pemain per season%'
          AND note NOT LIKE '%3 tiket per pemain per season%'
          AND description LIKE 'Paket dua tiket re-entry%'
          AND note LIKE 'Setiap tiket%'`)
        .bind(ticket2[3],ticket2[6],now).run();
      const ticket3 = products.find(p => p[0] === 'REENTRY_3');
      await db.prepare(`UPDATE store_products SET description=?,note=?,updated_at=?
        WHERE id='REENTRY_3'
          AND description NOT LIKE '%Paket tiga tiket re-entry; tiap tiket memberi 3 nyawa%'
          AND note NOT LIKE '%3 tiket per pemain per season%'
          AND description LIKE 'Paket tiga tiket re-entry%'
          AND note LIKE 'Setiap tiket%'`)
        .bind(ticket3[3],ticket3[6],now).run();
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
