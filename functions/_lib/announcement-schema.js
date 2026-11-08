const initialized=new WeakMap();

const requiredColumns={
 title:"TEXT NOT NULL DEFAULT ''",
 body:"TEXT NOT NULL DEFAULT ''",
 active:"INTEGER NOT NULL DEFAULT 1",
 starts_at:"TEXT",
 ends_at:"TEXT",
 created_at:"TEXT NOT NULL DEFAULT ''",
 updated_at:"TEXT NOT NULL DEFAULT ''"
};

export async function ensureAnnouncementsSchema(db){
 if(!db||typeof db.prepare!=='function')throw new Error('Binding D1 DB tidak tersedia.');
 let task=initialized.get(db);
 if(!task){
  task=(async()=>{
   await db.prepare(`CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    starts_at TEXT, ends_at TEXT, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
   )`).run();
   const info=await db.prepare('PRAGMA table_info("announcements")').all();
   const existing=new Set((info.results||[]).map(row=>row.name));
   if(!existing.has('id'))throw new Error('Kolom announcements.id tidak ditemukan pada tabel lama.');
   for(const [column,definition] of Object.entries(requiredColumns)){
    if(existing.has(column))continue;
    try{
     await db.prepare('ALTER TABLE announcements ADD COLUMN "'+column+'" '+definition).run();
     existing.add(column);
    }catch(error){
     if(/duplicate column/i.test(String(error?.message||error))){
      const refreshed=await db.prepare('PRAGMA table_info("announcements")').all();
      if((refreshed.results||[]).some(row=>row.name===column)){existing.add(column);continue;}
     }
     throw new Error('Kolom announcements.'+column+' gagal ditambahkan: '+String(error?.message||error).slice(0,180));
    }
   }
  })().catch(error=>{initialized.delete(db);throw error;});
  initialized.set(db,task);
 }
 return task;
}
