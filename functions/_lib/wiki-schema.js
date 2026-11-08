const initialized = new WeakMap();

const categories = [
  ['cat-pemula','Mulai Petualangan','mulai-petualangan','Panduan pertama untuk pemain baru sebelum menjelajah frontier.','✦',1],
  ['cat-server','Server & Aturan','server-aturan','Aturan bermain, survival, nyawa, PvP, claim, dan perjalanan.','⚔',2],
  ['cat-dunia','Dunia & Wilayah','dunia-wilayah','Mengenal lore, season, zona, dan wilayah frontier.','🌙',3],
  ['cat-komunitas','Komunitas','komunitas','Etika, keamanan, interaksi, dan kehidupan komunitas SLF.','☷',4],
  ['cat-ekonomi','Ekonomi & Store','ekonomi-store','Pasar, perdagangan, VIP, pembelian, dan dukungan server.','◇',5],
  ['cat-karakter','Karakter & Kemampuan','karakter-kemampuan','Ras, kemampuan, skill, dan sistem karakter.','✧',6],
  ['cat-bantuan','Bantuan & FAQ','bantuan-faq','Jawaban masalah umum, laporan, dan bantuan teknis.','⌕',7]
];

const articles = [
  ['legacy-mulai-bermain','cat-pemula','Mulai Bermain di SLF','mulai-bermain','Persiapan sebelum masuk, mengenal lobby, dan langkah pertama di frontier.','/wiki/artikel/mulai-bermain.html','✦',1],
  ['legacy-aturan-server','cat-server','Peraturan Server & Gameplay','aturan-server','Rules lengkap: zona, PvP, nyawa, re-entry, claim, perjalanan, ekonomi, dan sanksi.','/wiki/artikel/aturan-server.html','⚔',1],
  ['legacy-nyawa-reentry','cat-server','Sistem Nyawa dan Re-entry','nyawa-reentry','Maksimal 3 tiket per pemain per season; pelajari perbedaan nyawa Member/VIP dan VIP+ aktif.','/wiki/artikel/nyawa-reentry.html','♥',2],
  ['legacy-pvp-coliseum','cat-server','PvP dan Coliseum','pvp-coliseum','Perbedaan zona PvP, pertarungan, dan duel di area khusus.','/wiki/artikel/pvp-coliseum.html','⚔',3],
  ['legacy-claim-tanah','cat-server','Claim Tanah dan Perlindungan','claim-tanah','Batas claim Member/VIP dan VIP+ serta cara melindungi bangunan.','/wiki/artikel/claim-tanah.html','▦',4],
  ['legacy-perjalanan-waystone','cat-server','Perjalanan dan Waystone','perjalanan-waystone','Panduan berpindah wilayah tanpa mengandalkan teleport command bebas.','/wiki/artikel/perjalanan-waystone.html','⌖',5],
  ['legacy-lapar-haus','cat-server','Lapar dan Haus','lapar-haus','Persiapan makanan, minuman, dan kebiasaan bertahan hidup.','/wiki/artikel/lapar-haus.html','◉',6],
  ['legacy-dunia-slf','cat-dunia','Mengenal Dunia SLF','dunia-slf','Konsep survival fantasy, roleplay, eksplorasi, dan kehidupan pemain.','/wiki/artikel/dunia-slf.html','🌙',1],
  ['legacy-season-reset','cat-dunia','Season, Reset, dan Perubahan Dunia','season-reset','Cara membaca pengumuman reset dan mengetahui perubahan antar-season.','/wiki/artikel/season-reset.html','⟳',2],
  ['legacy-zona-elarion','cat-dunia','Zona Elarion — Tanah Suaka','zona-elarion','Green Zone: permukiman, pembangunan, perdagangan, dan area aman.','/wiki/artikel/zona-elarion.html','♧',3],
  ['legacy-zona-veyrwood','cat-dunia','Zona Veyrwood — Rimba Perbatasan','zona-veyrwood','Yellow Zone: tambang, sumber daya, perburuan, dan monster lebih kuat.','/wiki/artikel/zona-veyrwood.html','⚒',4],
  ['legacy-zona-drakmor','cat-dunia','Zona Drakmor — Tanah Pertaruhan','zona-drakmor','Red Zone berada di Nether dan hanya diakses melalui portal resmi.','/wiki/artikel/zona-drakmor.html','⚔',5],
  ['legacy-zona-noxveil','cat-dunia','Zona Noxveil — Wilayah Kehampaan','zona-noxveil','Konsep Black Zone; akses, peta, hadiah, dan aturan belum final.','/wiki/artikel/zona-noxveil.html','◈',6],
  ['legacy-aturan-komunitas','cat-komunitas','Aturan Komunitas dan Perilaku','aturan-komunitas','Etika chat, keamanan akun, transaksi aman, laporan, dan banding.','/wiki/artikel/aturan-komunitas.html','☷',1],
  ['legacy-ekonomi-pasar','cat-ekonomi','Ekonomi, Toko NPC, dan Pasar','ekonomi-pasar','Jadwal restok pasar, fungsi tiap NPC, dan tips berdagang.','/wiki/artikel/ekonomi-pasar.html','◇',1],
  ['legacy-benefit-vip','cat-ekonomi','VIP Biasa vs VIP+','benefit-vip','VIP permanen tanpa bonus; VIP+ rank permanen dengan fitur tambahan berlangganan.','/wiki/artikel/benefit-vip.html','♜',2],
  ['legacy-store-donasi','cat-ekonomi','Store dan Dukungan Saweria','store-donasi','Perbedaan dukungan sukarela dengan pembelian paket dan cara transaksi aman.','/wiki/artikel/store-donasi.html','♡',3],
  ['legacy-ras-kemampuan','cat-karakter','Ras dan Kemampuan','ras-kemampuan','Cara memahami pilihan ras, skill, cooldown, dan mana.','/wiki/artikel/ras-kemampuan.html','✧',1],
  ['legacy-faq-teknis','cat-bantuan','FAQ dan Masalah Teknis','faq-teknis','Solusi awal untuk gagal masuk, menu tidak merespons, dan masalah tampilan.','/wiki/artikel/faq-teknis.html','⌕',1],
  ['legacy-bantuan-laporan','cat-bantuan','Pusat Bantuan dan Laporan','bantuan-laporan','Cara menyiapkan laporan bug, kehilangan item, gangguan pemain, dan pertanyaan akun.','/wiki/artikel/bantuan-laporan.html','✉',2]
];

export async function ensureWikiSchema(db) {
  if (!db || typeof db.prepare !== 'function') throw new Error('Binding D1 DB tidak tersedia.');
  let task=initialized.get(db);
  if(!task){
    task=(async()=>{
      const steps=[
        ['create-categories',`CREATE TABLE IF NOT EXISTS wiki_categories (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '📚',
          sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )`],
        ['create-articles',`CREATE TABLE IF NOT EXISTS wiki_articles (
          id TEXT PRIMARY KEY, category_id TEXT NOT NULL, title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE, summary TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL DEFAULT '', legacy_url TEXT,
          icon TEXT NOT NULL DEFAULT '📖', sort_order INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published')),
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )`],
        ['index-categories','CREATE INDEX IF NOT EXISTS idx_wiki_categories_order ON wiki_categories(active,sort_order,name)'],
        ['index-articles','CREATE INDEX IF NOT EXISTS idx_wiki_articles_category ON wiki_articles(category_id,status,sort_order,title)']
      ];
      for(const [name,sql] of steps){
        try{await db.prepare(sql).run();}
        catch(error){throw new Error('SLF_WIKI_STEP:'+name+':'+String(error?.message||error).slice(0,180));}
      }
      const now=new Date().toISOString();
      for(const c of categories){
        try{
          await db.prepare('INSERT OR IGNORE INTO wiki_categories (id,name,slug,description,icon,sort_order,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)')
            .bind(...c,now,now).run();
        }catch(error){throw new Error('SLF_WIKI_STEP:seed-category:'+String(error?.message||error).slice(0,180));}
      }
      for(const a of articles){
        try{
          await db.prepare("INSERT OR IGNORE INTO wiki_articles (id,category_id,title,slug,summary,content,legacy_url,icon,sort_order,status,created_at,updated_at) VALUES (?,?,?,?,?,'',?,?,?,'published',?,?)")
            .bind(...a,now,now).run();
        }catch(error){throw new Error('SLF_WIKI_STEP:seed-article:'+String(error?.message||error).slice(0,180));}
      }
    })();
    initialized.set(db,task);
  }
  try{await task;}catch(error){initialized.delete(db);throw error;}
}
