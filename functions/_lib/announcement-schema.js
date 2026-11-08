const initialized=new WeakMap();

export async function ensureAnnouncementsSchema(db){
 if(!db||typeof db.prepare!=='function')throw new Error('Binding D1 DB tidak tersedia.');
 let task=initialized.get(db);
 if(!task){
  task=db.prepare(`CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    starts_at TEXT, ends_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run().catch(error=>{initialized.delete(db);throw error;});
  initialized.set(db,task);
 }
 return task;
}
