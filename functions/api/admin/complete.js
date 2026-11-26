import { json, fail, readJson, requireAdmin, logAdminActivity, ensureOrderAccessKey, currency } from '../../_lib/common.js';

const TICKET_PRODUCTS = new Set(['REENTRY_1','REENTRY_2','REENTRY_3']);

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request,env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.',401);
  if (!env.DB) return fail('Database belum tersambung.',503);
  const data=await readJson(request),id=typeof data.orderId==='string'?data.orderId.trim():'';
  if (!id) return fail('Nomor pesanan wajib diisi.');
  const row=await env.DB.prepare('SELECT id,status,access_key_hash,access_key_encrypted,whatsapp,minecraft_name,platform,product_id,product_name,total FROM orders WHERE id=?').bind(id).first();
  if (!row) return fail('Pesanan tidak ditemukan.',404);
  if (!['PAID','PROCESSING','COMPLETED'].includes(row.status)) return fail('Pesanan hanya boleh diselesaikan setelah pembayaran terverifikasi.',409);
  if (row.status!=='COMPLETED') {
    const now=new Date().toISOString();
    const changed=await env.DB.prepare("UPDATE orders SET status='COMPLETED',completed_at=?,updated_at=? WHERE id=? AND status IN ('PAID','PROCESSING')").bind(now,now,id).run();
    if (changed.meta?.changes) {
      await env.DB.prepare("UPDATE reentry_tickets SET status='ACTIVE',updated_at=? WHERE order_id=? AND status='WAITING_PAYMENT'").bind(now,id).run();
      await logAdminActivity(env.DB,'order_completed','order',id,{status:'COMPLETED'});
    }
  }
  try {
    const completed=await env.DB.prepare('SELECT id,status,access_key_hash,access_key_encrypted,whatsapp,minecraft_name,platform,product_id,product_name,total FROM orders WHERE id=?').bind(id).first();
    const orderKey=await ensureOrderAccessKey(env.DB,completed,env);
    const phone=String(completed.whatsapp||'').replace(/\D/g,'');
    if (!phone) return fail('Pesanan selesai, tetapi nomor WhatsApp pembeli tidak valid.',422);
    const reviewUrl=new URL('/store/review.html',request.url);
    reviewUrl.searchParams.set('id',id);reviewUrl.searchParams.set('key',orderKey);
    const ticket=TICKET_PRODUCTS.has(completed.product_id);
    const lines=ticket
      ? ['*SLF STORE · PESANAN SELESAI*','Halo '+completed.minecraft_name+', pesanan tiketmu sudah selesai diproses.','', '*ID:* '+id,'*Produk:* '+completed.product_name,'*Total:* '+currency(completed.total),'*Status:* COMPLETED','*Ulasan:*',reviewUrl.toString(),'','Terima kasih telah mendukung SLF.']
      : ['*SLF STORE · PESANAN SELESAI*','Halo '+completed.minecraft_name+', rank/VIP pesananmu telah diberikan ke akunmu.','', '*ID:* '+id,'*Produk:* '+completed.product_name,'*Total:* '+currency(completed.total),'*Status:* COMPLETED','*Ulasan:*',reviewUrl.toString(),'','Terima kasih telah mendukung SLF.'];
    const whatsappUrl='https://wa.me/'+phone+'?text='+encodeURIComponent(lines.join('\n'));
    return json({ok:true,status:'COMPLETED',whatsappUrl});
  } catch(error) {
    console.error('Completion WhatsApp preparation failed:',error?.message||error);
    return fail('Pesanan selesai, tetapi tautan ulasan belum dapat dibuat: '+String(error?.message||error),503);
  }
}
