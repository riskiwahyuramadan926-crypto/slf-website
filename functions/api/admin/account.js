import { json, fail, readJson, resolveAdminSecrets, sha256Hex, randomHex } from '../../_lib/common.js';
const emailOk=v=>/^[a-z0-9._%+-]+@gmail\.com$/i.test(v)&&v.length<=254;
const encoder=new TextEncoder();
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:310000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
async function ensureTables(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS admin_accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','admin')),active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,last_login_at TEXT)").run();
 await db.prepare('CREATE TABLE IF NOT EXISTS admin_sessions(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES admin_accounts(id),token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL)').run();
 await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_single_owner ON admin_accounts(role) WHERE role='owner'").run();
 await db.prepare('CREATE TABLE IF NOT EXISTS admin_account_attempts(ip_hash TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,window_started INTEGER NOT NULL,blocked_until INTEGER NOT NULL DEFAULT 0)').run();
}
async function checkRate(db,request){const ipHash=await sha256Hex(request.headers.get('cf-connecting-ip')||'local-unknown'),now=Math.floor(Date.now()/1000),old=await db.prepare('SELECT attempts,window_started,blocked_until FROM admin_account_attempts WHERE ip_hash=?').bind(ipHash).first();if(old&&Number(old.blocked_until)>now)return false;const count=old&&now-Number(old.window_started)<900?Number(old.attempts):0,next=count+1,window=count?Number(old.window_started):now,blocked=next>=8?now+900:0;await db.prepare('INSERT INTO admin_account_attempts(ip_hash,attempts,window_started,blocked_until) VALUES(?,?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts=excluded.attempts,window_started=excluded.window_started,blocked_until=excluded.blocked_until').bind(ipHash,next,window,blocked).run();return true;}
export async function onRequestPost({request,env}){
 if(!env.DB)return fail('Database D1 belum tersedia.',503);
 let d;try{d=await readJson(request);}catch(e){return fail(e.message);}
 const action=String(d.action||'login');
 if(action==='logout'){const cookie=request.headers.get('cookie')||'',m=cookie.match(/(?:^|;\s*)slf_admin_session=([A-Za-z0-9]+)/);if(m)await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha256Hex(m[1])).run();return json({ok:true},200,{'set-cookie':'slf_admin_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});}
 if(action!=='login')return fail('Aksi autentikasi tidak dikenal.');
 try{await ensureTables(env.DB);}catch(error){console.error('[SLF_ACCOUNT] schema:',error?.message||error);return fail('Tabel akun Admin gagal disiapkan.',503);}
 let allowed;try{allowed=await checkRate(env.DB,request);}catch(_){return fail('Pemeriksaan keamanan login gagal. Coba beberapa saat lagi.',503);}if(!allowed)return fail('Terlalu banyak percobaan login. Tunggu 15 menit.',429);
 const email=String(d.email||'').trim().toLowerCase(),password=String(d.password||''),code=String(d.accessCode||'').trim();
 if(!emailOk(email))return fail('Gunakan alamat Gmail yang valid.');
 if(password.length<12||password.length>128)return fail('Password harus 12–128 karakter.');
 const existing=await env.DB.prepare('SELECT id,email,password_salt,password_hash,role,active FROM admin_accounts WHERE email=?').bind(email).first();
 let account=existing;
 if(existing){if(!existing.active)return fail('Akun dinonaktifkan. Hubungi Owner.',403);const actual=await passwordHash(password,existing.password_salt);if(!equal(actual,existing.password_hash))return fail('Email atau password tidak cocok.',401);}
 else{
  if(code.length<32)return fail('Akun belum terdaftar. Masukkan Kode Owner atau Kode Admin satu kali untuk mengikat role.');
  const secrets=resolveAdminSecrets(env);if(!secrets.ready)return fail('Kode Owner/Admin belum dikonfigurasi dengan benar pada environment Preview. Pastikan OWNER_SECRET dan ADMIN_SECRET berbeda dan minimal 32 karakter.',503);
  const role=equal(code,secrets.ownerSecret)?'owner':equal(code,secrets.adminSecret)?'admin':'';if(!role)return fail('Kode akses tidak cocok. Pastikan secret Preview sama dengan yang ditetapkan di Cloudflare.');if(role==='owner'){const owner=await env.DB.prepare('SELECT id FROM admin_accounts WHERE role=\'owner\' LIMIT 1').first();if(owner)return fail('Akun Owner sudah terikat. Gunakan akun Owner yang sudah terdaftar atau minta Owner mengelola akses staf.',403);}
  const now=new Date().toISOString(),id='ADM-'+randomHex(12),salt=randomHex(32),hash=await passwordHash(password,salt);
  try{await env.DB.prepare('INSERT INTO admin_accounts(id,email,password_salt,password_hash,role,active,created_at,updated_at,last_login_at) VALUES(?,?,?,?,?,1,?,?,?)').bind(id,email,salt,hash,role,now,now,now).run();}catch(error){return fail('Akun mungkin sudah dibuat dari perangkat lain. Coba login kembali tanpa kode akses.',409);}
  account={id,email,role,active:1};
 }
 const token=randomHex(64),tokenHash=await sha256Hex(token),now=new Date().toISOString(),expires=new Date(Date.now()+30*86400000).toISOString(),sessionId='SES-'+randomHex(12);
 await env.DB.prepare('INSERT INTO admin_sessions(id,account_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)').bind(sessionId,account.id,tokenHash,expires,now,now).run();
 await env.DB.prepare('UPDATE admin_accounts SET last_login_at=?,updated_at=? WHERE id=?').bind(now,now,account.id).run();
 await env.DB.prepare('DELETE FROM admin_account_attempts WHERE ip_hash=?').bind(await sha256Hex(request.headers.get('cf-connecting-ip')||'local-unknown')).run();
 return json({ok:true,email:account.email,role:account.role,expiresAt:expires},200,{'set-cookie':'slf_admin_session='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000'});
}
