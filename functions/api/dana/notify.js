import { json, fail, sha256Hex, rsaVerify, danaTimestamp, notifyAdmin } from '../../_lib/common.js';
const PATH = '/v1.0/debit/notify';

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB || !env.DANA_PUBLIC_KEY_PEM) return fail('Webhook pembayaran belum dikonfigurasi.', 503);
  const rawBody = await request.text();
  if (rawBody.length > 20000) return fail('Payload terlalu besar.', 413);
  const timestamp = request.headers.get('x-timestamp') || '';
  const signature = request.headers.get('x-signature') || '';
  const parsedTime = Date.parse(timestamp);
  if (!timestamp || !Number.isFinite(parsedTime) || Math.abs(Date.now() - parsedTime) > 24 * 60 * 60 * 1000) return fail('Timestamp webhook tidak valid.', 401);
  const digest = await sha256Hex(rawBody);
  const signingText = `POST:${PATH}:${digest}:${timestamp}`;
  if (!(await rsaVerify(env.DANA_PUBLIC_KEY_PEM, signingText, signature))) return fail('Signature webhook DANA tidak valid.', 401);
  let data; try { data = JSON.parse(rawBody); } catch { return fail('Payload JSON tidak valid.'); }
  const partnerRef = String(data.originalPartnerReferenceNo || '');
  if (!partnerRef || !data.amount?.value || !data.amount?.currency) return fail('Data transaksi tidak lengkap.');
  if (data.merchantId !== env.DANA_MERCHANT_ID) return fail('Merchant tidak cocok.', 401);
  const order = await env.DB.prepare('SELECT id, minecraft_name, platform, product_name, total, status, partner_reference_no FROM orders WHERE partner_reference_no = ?').bind(partnerRef).first();
  if (!order) return fail('Pesanan terkait tidak ditemukan.', 404);
  const paidAmount = Number(data.amount.value);
  if (data.amount.currency !== 'IDR' || !Number.isFinite(paidAmount) || Math.abs(paidAmount - order.total) > 0.001) return fail('Nominal pembayaran tidak cocok.', 409);
  const statusCode = String(data.latestTransactionStatus || '');
  const now = new Date().toISOString();
  if (statusCode === '00' && order.status === 'PENDING_PAYMENT') {
    await env.DB.prepare("UPDATE orders SET status = 'PAID', paid_at = ?, dana_reference_no = COALESCE(?, dana_reference_no), updated_at = ? WHERE id = ? AND status = 'PENDING_PAYMENT'")
      .bind(now, data.originalReferenceNo || null, now, order.id).run();
    const notifyOrder = { ...order, status: 'PAID' };
    const adminUrl = `${env.PUBLIC_SITE_URL || new URL(request.url).origin}/admin/?order=${encodeURIComponent(order.id)}`;
    if (waitUntil) waitUntil(notifyAdmin(env, notifyOrder, adminUrl).catch(e => console.error('WhatsApp paid notification failed', e.message)));
  } else if (statusCode === '05' && order.status === 'PENDING_PAYMENT') {
    await env.DB.prepare("UPDATE orders SET status = 'EXPIRED', updated_at = ? WHERE id = ? AND status = 'PENDING_PAYMENT'").bind(now, order.id).run();
  }
  return json({ responseCode: '2005600', responseMessage: 'Successful' });
}
