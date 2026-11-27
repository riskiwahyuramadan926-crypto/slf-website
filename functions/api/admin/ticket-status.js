import { json, fail, readJson, requireAdmin, logAdminActivity, ensureOrderAccessKey } from '../../_lib/common.js';

function whatsappLink(phoneValue, message) {
  const phone = String(phoneValue || '').replace(/\D/g,'');
  if (!phone) throw new Error('Nomor WhatsApp member tidak valid.');
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request);
  const id = typeof data.ticketId === 'string' ? data.ticketId.trim() : '';
  const status = typeof data.status === 'string' ? data.status : '';
  if (!id || !['ACTIVE', 'COMPLETED'].includes(status)) return fail('Data status tiket tidak valid.');

  const row = await env.DB.prepare(
    'SELECT t.id, t.order_id, t.status, t.submitted_at, t.minecraft_name, t.product_name, o.status AS order_status, o.access_key_hash, o.access_key_encrypted, o.product_id, o.whatsapp FROM reentry_tickets t JOIN orders o ON o.id=t.order_id WHERE t.id=?'
  ).bind(id).first();
  if (!row) return fail('Tiket tidak ditemukan.',404);
  if (row.order_status !== 'COMPLETED') return fail('Pesanan tiket belum selesai diproses. Selesaikan pesanan di panel Admin terlebih dahulu.',409);

  const now = new Date().toISOString();
  if (status === 'ACTIVE' && (row.status === 'PENDING' || (row.status === 'ACTIVE' && row.submitted_at))) {
    let whatsappUrl;
    try {
      whatsappUrl = whatsappLink(row.whatsapp,
        '🎟️ Halo ' + row.minecraft_name + ', pengajuan tiket ' + row.id + ' kamu sudah kami terima!\nHarap segera login sekarang dan tunggu di lobby, lalu nantikan instruksi selanjutnya dari Admin.');
    } catch (error) { return fail(error.message,422); }
    if (row.status === 'PENDING') {
      await env.DB.prepare("UPDATE reentry_tickets SET status='ACTIVE',updated_at=?,completed_at=NULL WHERE id=? AND status='PENDING'").bind(now,id).run();
      await logAdminActivity(env.DB,'reentry_ticket_accepted','reentry_ticket',id,{status:'ACTIVE'});
    }
    return json({ok:true,status:'ACTIVE',whatsappUrl});
  }

  if (status === 'COMPLETED' && ((row.status === 'ACTIVE' && row.submitted_at) || row.status === 'COMPLETED')) {
    let orderKey;
    try { orderKey = await ensureOrderAccessKey(env.DB,{id:row.order_id,product_id:row.product_id,access_key_hash:row.access_key_hash,access_key_encrypted:row.access_key_encrypted},env); }
    catch (error) { return fail('Tiket selesai, tetapi link ulasan belum dapat dibuat: '+String(error?.message||error),503); }
    let whatsappUrl;
    try {
      const reviewUrl = new URL('/store/review.html',request.url);
      reviewUrl.searchParams.set('id',row.order_id);
      reviewUrl.searchParams.set('key',orderKey);
      const message = '🎉 Halo ' + row.minecraft_name + ', penggunaan tiket ' + row.id + ' telah selesai diproses. Selamat bermain kembali!\nJangan lupa berikan ulasan layanan kami di sini:\n' + reviewUrl.toString();
      whatsappUrl = whatsappLink(row.whatsapp,message);
    } catch (error) { return fail(error.message,422); }
    if (row.status === 'ACTIVE') {
      await env.DB.prepare("UPDATE reentry_tickets SET status='COMPLETED',updated_at=?,completed_at=? WHERE id=? AND status='ACTIVE' AND submitted_at IS NOT NULL").bind(now,now,id).run();
      await logAdminActivity(env.DB,'reentry_ticket_completed','reentry_ticket',id,{status:'COMPLETED'});
    }
    return json({ok:true,status:'COMPLETED',whatsappUrl});
  }

  // A completed ticket can be restored for recovery; this does not send a member
  // notification because it is an administrative correction, not an approval.
  if (status === 'ACTIVE' && row.status === 'COMPLETED') {
    await env.DB.prepare("UPDATE reentry_tickets SET status='ACTIVE',submitted_at=NULL,completed_at=NULL,updated_at=? WHERE id=? AND status='COMPLETED'").bind(now,id).run();
    await logAdminActivity(env.DB,'reentry_ticket_reactivated','reentry_ticket',id,{status:'ACTIVE'});
    return json({ok:true,status:'ACTIVE',restored:true});
  }

  if (row.status === status) return json({ok:true,status});
  if (status === 'COMPLETED') return fail('Tiket harus diajukan dan diterima Admin sebelum ditandai selesai.',409);
  return fail('Tiket ini tidak dapat diubah ke status tersebut.',409);
}
