import { json, fail, readJson, sha256Hex, randomHex } from '../../_lib/common.js';

const emailOk = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const encoder = new TextEncoder();

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 310000, hash: 'SHA-256' },
    key,
    256
  );
  return [...new Uint8Array(bits)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function d1Message(error) {
  return String(error?.message || error || 'Kesalahan database tidak diketahui')
    .replace(/[\\r\\n]/g, ' ')
    .slice(0, 240);
}

async function ensureTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS admin_accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner','admin')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES admin_accounts(id),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  )`).run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_single_owner ON admin_accounts(role) WHERE role='owner'").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS admin_account_attempts (
    ip_hash TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    window_started INTEGER NOT NULL,
    blocked_until INTEGER NOT NULL DEFAULT 0
  )`).run();
}

async function checkRate(db, request) {
  const ipHash = await sha256Hex(request.headers.get('cf-connecting-ip') || 'local-unknown');
  const now = Math.floor(Date.now() / 1000);
  const old = await db.prepare('SELECT attempts, window_started, blocked_until FROM admin_account_attempts WHERE ip_hash=?')
    .bind(ipHash).first();
  if (old && Number(old.blocked_until) > now) return false;

  const count = old && now - Number(old.window_started) < 900 ? Number(old.attempts) : 0;
  const next = count + 1;
  const window = count ? Number(old.window_started) : now;
  const blocked = next >= 8 ? now + 900 : 0;
  await db.prepare(`INSERT INTO admin_account_attempts(ip_hash,attempts,window_started,blocked_until)
    VALUES(?,?,?,?)
    ON CONFLICT(ip_hash) DO UPDATE SET
      attempts=excluded.attempts,
      window_started=excluded.window_started,
      blocked_until=excluded.blocked_until`)
    .bind(ipHash, next, window, blocked).run();
  return true;
}

function resolveAccessRole(code, env) {
  // Pages Functions expose Preview/Production secrets through env at request time.
  // Trim both sides so dashboard copy/paste whitespace cannot invalidate a valid code.
  const ownerSecret = typeof env.OWNER_SECRET === 'string' ? env.OWNER_SECRET.trim() : '';
  const adminSecret = typeof env.ADMIN_SECRET === 'string' ? env.ADMIN_SECRET.trim() : '';
  const ownerReady = ownerSecret.length >= 32;
  const adminReady = adminSecret.length >= 32;

  if (!ownerSecret && !adminSecret) {
    return { error: 'Variabel OWNER_SECRET dan ADMIN_SECRET belum terbaca di environment Preview ini. Periksa Settings → Variables and Secrets, lalu deploy ulang Preview.' };
  }
  if (ownerReady && adminReady && ownerSecret === adminSecret) {
    return { error: 'Konfigurasi tidak valid: OWNER_SECRET dan ADMIN_SECRET harus berbeda.' };
  }

  // A valid configured role can still authenticate when the other secret is absent.
  if (ownerReady && equal(code, ownerSecret)) return { role: 'owner' };
  if (adminReady && equal(code, adminSecret)) return { role: 'admin' };

  if (!ownerSecret || !ownerReady) {
    return { error: ownerSecret
      ? 'OWNER_SECRET terbaca, tetapi panjangnya kurang dari 32 karakter. Perbarui secret Owner di Preview.'
      : 'Variabel OWNER_SECRET belum terbaca di environment Preview ini.' };
  }
  if (!adminSecret || !adminReady) {
    return { error: adminSecret
      ? 'ADMIN_SECRET terbaca, tetapi panjangnya kurang dari 32 karakter. Perbarui secret Admin di Preview.'
      : 'Variabel ADMIN_SECRET belum terbaca di environment Preview ini.' };
  }
  return { error: 'Kode Owner/Admin tidak cocok. Periksa kode akses yang dimasukkan.' };
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || typeof env.DB.prepare !== 'function' || typeof env.DB.batch !== 'function') {
    return fail('Binding D1 DB tidak tersedia pada environment Preview ini.', 503);
  }

  let data;
  try {
    data = await readJson(request);
  } catch (error) {
    return fail(error.message || 'Format permintaan tidak valid.');
  }

  const action = String(data.action || 'login');
  if (action !== 'login' && action !== 'logout') return fail('Aksi autentikasi tidak dikenal.');

  // Bootstrap each account table before the first SELECT/DELETE/INSERT that uses it.
  try {
    await ensureTables(env.DB);
  } catch (error) {
    const detail = d1Message(error);
    console.error('[SLF_ACCOUNT] table bootstrap failed:', detail);
    return fail('Error D1 saat menyiapkan tabel akun: ' + detail, 503);
  }

  if (action === 'logout') {
    try {
      const cookie = request.headers.get('cookie') || '';
      const match = cookie.match(/(?:^|;\\s*)slf_admin_session=([A-Za-z0-9]+)/);
      if (match) {
        await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha256Hex(match[1])).run();
      }
      return json({ ok: true }, 200, {
        'set-cookie': 'slf_admin_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
      });
    } catch (error) {
      const detail = d1Message(error);
      console.error('[SLF_ACCOUNT] logout failed:', detail);
      return fail('Error D1 saat mengakhiri sesi: ' + detail, 503);
    }
  }

  const email = String(data.email || '').trim().toLowerCase().replace(/\s+/g, '');
  const password = String(data.password || '');
  const accessCode = String(data.accessCode || '').trim();

  if (!emailOk(email)) return fail('Gunakan alamat Gmail yang valid.');
  if (password.length < 12 || password.length > 128) return fail('Password harus 12–128 karakter.');

  let allowed;
  try {
    allowed = await checkRate(env.DB, request);
  } catch (error) {
    const detail = d1Message(error);
    console.error('[SLF_ACCOUNT] rate-limit check failed:', detail);
    return fail('Error D1 saat memeriksa percobaan login: ' + detail, 503);
  }
  if (!allowed) return fail('Terlalu banyak percobaan login. Tunggu 15 menit.', 429);

  let existing;
  try {
    // Account storage is guaranteed to exist by ensureTables() immediately above.
    existing = await env.DB.prepare(
      'SELECT id,email,password_salt,password_hash,role,active FROM admin_accounts WHERE email=? LIMIT 1'
    ).bind(email).first();
  } catch (error) {
    const detail = d1Message(error);
    console.error('[SLF_ACCOUNT] account lookup failed:', detail);
    return fail('Error D1 saat mencari akun: ' + detail, 503);
  }

  let accountId;
  let role;
  let batchStatements = [];
  const now = new Date().toISOString();

  if (accessCode) {
    const access = resolveAccessRole(accessCode, env);
    if (access.error) return fail(access.error, access.error.includes('tidak cocok') ? 401 : 503);
    role = access.role;
    accountId = existing?.id || ('ADM-' + randomHex(12));

    // A valid one-time code provisions a new account or explicitly rebinds an existing email.
    // Existing sessions are revoked so the new password and role take effect immediately.
    const salt = randomHex(32);
    let hash;
    try {
      hash = await passwordHash(password, salt);
    } catch (error) {
      console.error('[SLF_ACCOUNT] password hashing failed:', error?.message || error);
      return fail('Password tidak dapat diproses dengan aman. Coba lagi.', 500);
    }
    const sessionToken = randomHex(64);
    const tokenHash = await sha256Hex(sessionToken);
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    const sessionId = 'SES-' + randomHex(12);
    const ipHash = await sha256Hex(request.headers.get('cf-connecting-ip') || 'local-unknown');

    batchStatements = [];

    // A valid Owner code may transfer the single Owner role to this email.
    // Revoke the previous Owner's sessions before demoting that account to Admin.
    // Both operations and the new Owner bind are committed atomically by D1 batch().
    if (role === 'owner') {
      batchStatements.push(
        env.DB.prepare(`DELETE FROM admin_sessions
          WHERE account_id IN (
            SELECT id FROM admin_accounts WHERE role='owner' AND id<>?
          )`).bind(accountId),
        env.DB.prepare(`UPDATE admin_accounts
          SET role='admin', updated_at=?
          WHERE role='owner' AND id<>?`).bind(now, accountId)
      );
    }

    batchStatements.push(
      env.DB.prepare(`INSERT INTO admin_accounts
        (id,email,password_salt,password_hash,role,active,created_at,updated_at,last_login_at)
        VALUES(?,?,?,?,?,1,?,?,?)
        ON CONFLICT(email) DO UPDATE SET
          password_salt=excluded.password_salt,
          password_hash=excluded.password_hash,
          role=excluded.role,
          active=1,
          updated_at=excluded.updated_at,
          last_login_at=excluded.last_login_at`)
        .bind(accountId, email, salt, hash, role, now, now, now),
      env.DB.prepare('DELETE FROM admin_sessions WHERE account_id=?').bind(accountId),
      env.DB.prepare('INSERT INTO admin_sessions(id,account_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)')
        .bind(sessionId, accountId, tokenHash, expires, now, now),
      env.DB.prepare('DELETE FROM admin_account_attempts WHERE ip_hash=?').bind(ipHash)
    );

    try {
      await env.DB.batch(batchStatements);
    } catch (error) {
      const detail = d1Message(error);
      console.error('[SLF_ACCOUNT] account create/rebind transaction failed:', detail);
      return fail('Error D1 saat membuat atau memperbarui akun: ' + detail, 503);
    }

    return json({ ok: true, email, role, expiresAt: expires, accountBound: true }, 200, {
      'set-cookie': 'slf_admin_session=' + sessionToken + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000'
    });
  }

  if (!existing) {
    return fail('Akun Gmail belum terdaftar. Isi Kode Owner/Admin untuk membuat akun dan mengikat role pertama kali.', 404);
  }
  if (!existing.active) return fail('Akun dinonaktifkan. Hubungi Owner.', 403);

  try {
    const actual = await passwordHash(password, existing.password_salt);
    if (!equal(actual, existing.password_hash)) return fail('Email atau password tidak cocok.', 401);
  } catch (error) {
    console.error('[SLF_ACCOUNT] password verification failed:', error?.message || error);
    return fail('Password tidak dapat diverifikasi. Periksa konfigurasi akun dan coba lagi.', 500);
  }

  accountId = existing.id;
  role = existing.role;
  const sessionToken = randomHex(64);
  const tokenHash = await sha256Hex(sessionToken);
  const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  const sessionId = 'SES-' + randomHex(12);
  const ipHash = await sha256Hex(request.headers.get('cf-connecting-ip') || 'local-unknown');

  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO admin_sessions(id,account_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)')
        .bind(sessionId, accountId, tokenHash, expires, now, now),
      env.DB.prepare('UPDATE admin_accounts SET last_login_at=?,updated_at=? WHERE id=?')
        .bind(now, now, accountId),
      env.DB.prepare('DELETE FROM admin_account_attempts WHERE ip_hash=?').bind(ipHash)
    ]);
  } catch (error) {
    const detail = d1Message(error);
    console.error('[SLF_ACCOUNT] session creation failed:', detail);
    return fail('Error D1 saat membuat sesi login: ' + detail, 503);
  }

  return json({ ok: true, email: existing.email, role, expiresAt: expires }, 200, {
    'set-cookie': 'slf_admin_session=' + sessionToken + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000'
  });
}
