import { json, fail, requireAdmin } from '../../_lib/common.js';

const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && Number.isFinite(Date.parse(v + 'T00:00:00Z'));
export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0,10);
  const defaultFrom = new Date(Date.now() - 29*86400000).toISOString().slice(0,10);
  const from = url.searchParams.get('from') || defaultFrom;
  const to = url.searchParams.get('to') || today;
  if (!validDate(from) || !validDate(to) || from > to) return fail('Rentang tanggal tidak valid.');
  if ((Date.parse(to)-Date.parse(from))/86400000 > 366) return fail('Laporan maksimal 367 hari sekali jalan.');
  const where = "date(created_at) BETWEEN ? AND ?";
  const summary = await env.DB.prepare(`SELECT COUNT(*) AS total_orders,
    SUM(CASE WHEN status='PENDING_PAYMENT' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status='CANCELLED' OR status='EXPIRED' THEN 1 ELSE 0 END) AS cancelled,
    SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN status IN ('PAID','PROCESSING','COMPLETED') THEN total ELSE 0 END) AS verified_revenue,
    SUM(CASE WHEN status IN ('PAID','PROCESSING','COMPLETED') THEN 1 ELSE 0 END) AS paid_orders
    FROM orders WHERE ${where}`).bind(from,to).first();
  const daily = await env.DB.prepare(`SELECT date(created_at) AS day, COUNT(*) AS orders,
    SUM(CASE WHEN status IN ('PAID','PROCESSING','COMPLETED') THEN total ELSE 0 END) AS revenue
    FROM orders WHERE ${where} GROUP BY date(created_at) ORDER BY day ASC`).bind(from,to).all();
  const products = await env.DB.prepare(`SELECT product_name, COUNT(*) AS orders,
    SUM(CASE WHEN status IN ('PAID','PROCESSING','COMPLETED') THEN total ELSE 0 END) AS revenue
    FROM orders WHERE ${where} GROUP BY product_name ORDER BY orders DESC LIMIT 50`).bind(from,to).all();
  return json({ from,to,summary:Object.fromEntries(Object.entries(summary||{}).map(([k,v])=>[k,Number(v||0)])),daily:daily.results||[],products:(products.results||[]).map(p=>({...p,orders:Number(p.orders),revenue:Number(p.revenue||0)})) });
}
