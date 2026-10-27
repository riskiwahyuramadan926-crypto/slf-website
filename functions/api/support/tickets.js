import { json, fail, readJson, randomHex, safeText, sha256Hex } from '../../_lib/common.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return fail('Pusat bantuan belum tersedia.', 503);
  const d = await readJson(request);
  if (safeText(d.website, 200)) return fail('Permintaan ditolak.', 400);
  const playerName = safeText(d.playerName, 32);
  const contact = safeText(d.contact, 100);
  const category = ['orders','payments','account','technical','other'].includes(d.category) ? d.category : '';
  const subject = safeText(d.subject, 100);
  const message = safeText(d.message, 1500);
  if (!/^[.]?[A-Za-z0-9_ -]{2,32}$/.test(playerName) || !contact || !category || subject.length < 4 || message.length < 10) {
    return fail('Lengkapi nama pemain, kontak, kategori, subjek, dan pesan (minimal 10 karakter).');
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const requestHash = await sha256Hex(ip + ':' + (env.ADMIN_SECRET || 'slf-support-limit'));
  const recent = await env.DB.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE request_hash=? AND created_at >= ?")
    .bind(requestHash, new Date(Date.now()-60*60*1000).toISOString()).first();
  if (Number(recent?.total || 0) >= 5) return fail('Batas pesan bantuan sementara tercapai. Coba lagi nanti.', 429);
  const now = new Date().toISOString();
  const id = 'CS-' + now.slice(2,10).replaceAll('-','') + '-' + randomHex(5).toUpperCase();
  await env.DB.prepare('INSERT INTO support_tickets (id,player_name,contact,category,subject,message,status,request_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,'OPEN',?,?,?)')
    .bind(id,playerName,contact,category,subject,message,requestHash,now,now).run();
  return json({ ok:true, ticketId:id, message:'Pesan tersimpan. Simpan nomor tiket untuk tindak lanjut.' }, 201);
}
