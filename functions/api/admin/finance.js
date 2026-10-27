import { json, fail, readJson, requireOwner, safeText, randomHex, logAdminActivity } from '../../_lib/common.js';

const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && Number.isFinite(Date.parse(v + 'T00:00:00Z'));
export async function onRequestGet({ request, env }) {
  if (!(await requireOwner(request, env))) return fail('Laporan keuangan hanya dapat dibuka oleh Owner.', 403);
  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0,10);
  const from = url.searchParams.get('from') || new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  const to = url.searchParams.get('to') || today;
  if (!validDate(from) || !validDate(to) || from > to || (Date.parse(to)-Date.parse(from))/86400000 > 366) return fail('Rentang tanggal tidak valid (maksimal 367 hari).');

  const sales = await env.DB.prepare(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS orders
    FROM orders WHERE status IN ('PAID','PROCESSING','COMPLETED')
    AND date(COALESCE(paid_at,updated_at,created_at)) BETWEEN ? AND ?`).bind(from,to).first();
  const entries = await env.DB.prepare(`SELECT id,entry_date,kind,category,description,amount,reference,status,created_by,created_at,updated_at
    FROM finance_entries WHERE entry_date BETWEEN ? AND ? ORDER BY entry_date DESC,created_at DESC LIMIT 1000`).bind(from,to).all();
  const ledger = (entries.results||[]).map(x=>({...x,amount:Number(x.amount)}));
  const posted = ledger.filter(x=>x.status==='POSTED');
  const otherIncome = posted.filter(x=>x.kind==='INCOME').reduce((a,x)=>a+x.amount,0);
  const expenses = posted.filter(x=>x.kind==='EXPENSE').reduce((a,x)=>a+x.amount,0);
  const grossSales = Number(sales?.total||0);
  const income = grossSales + otherIncome;
  const net = income - expenses;
  const dailyRows = await env.DB.prepare(`SELECT date_key AS day,
    SUM(store_sales) AS store_sales, SUM(other_income) AS other_income, SUM(expenses) AS expenses
    FROM (
      SELECT date(COALESCE(paid_at,updated_at,created_at)) AS date_key, SUM(total) AS store_sales, 0 AS other_income, 0 AS expenses
      FROM orders WHERE status IN ('PAID','PROCESSING','COMPLETED') AND date(COALESCE(paid_at,updated_at,created_at)) BETWEEN ? AND ? GROUP BY date_key
      UNION ALL
      SELECT entry_date AS date_key, 0, SUM(CASE WHEN kind='INCOME' THEN amount ELSE 0 END), SUM(CASE WHEN kind='EXPENSE' THEN amount ELSE 0 END)
      FROM finance_entries WHERE status='POSTED' AND entry_date BETWEEN ? AND ? GROUP BY entry_date
    ) GROUP BY date_key ORDER BY day ASC`).bind(from,to,from,to).all();
  return json({
    from,to,
    summary:{storeSales:grossSales,paidOrders:Number(sales?.orders||0),otherIncome,expenses,allIncome:income,estimatedNet:net},
    daily:(dailyRows.results||[]).map(x=>({day:x.day,storeSales:Number(x.store_sales||0),otherIncome:Number(x.other_income||0),expenses:Number(x.expenses||0),estimatedNet:Number(x.store_sales||0)+Number(x.other_income||0)-Number(x.expenses||0)})),
    entries:ledger
  });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireOwner(request, env))) return fail('Pencatatan keuangan hanya dapat dikelola oleh Owner.', 403);
  const d = await readJson(request);
  const now = new Date().toISOString();
  const id = safeText(d.id,60);
  if (id && d.void === true) {
    const existing = await env.DB.prepare('SELECT id,status FROM finance_entries WHERE id=?').bind(id).first();
    if (!existing) return fail('Catatan keuangan tidak ditemukan.',404);
    if (existing.status === 'VOIDED') return json({ok:true,id,status:'VOIDED'});
    await env.DB.prepare("UPDATE finance_entries SET status='VOIDED',updated_at=? WHERE id=?").bind(now,id).run();
    await logAdminActivity(env.DB,'finance_entry_voided','finance_entry',id,{role:'owner'});
    return json({ok:true,id,status:'VOIDED'});
  }

  const kind = ['INCOME','EXPENSE'].includes(d.kind) ? d.kind : '';
  const category = safeText(d.category,60);
  const description = safeText(d.description,500);
  const amount = Number(d.amount);
  const entryDate = safeText(d.entryDate,10) || now.slice(0,10);
  const reference = safeText(d.reference,120) || null;
  if (!kind || !category || description.length < 3 || !Number.isSafeInteger(amount) || amount < 1 || amount > 2000000000 || !validDate(entryDate)) {
    return fail('Jenis, kategori, tanggal, uraian, atau nominal tidak valid.');
  }
  if (kind === 'INCOME' && /store|order|pesanan|penjualan produk/i.test(category + ' ' + description)) {
    return fail('Pemasukan Store dihitung otomatis dari pesanan terverifikasi. Catat hanya pemasukan lain agar tidak terhitung dua kali.');
  }
  const newId = 'FIN-' + randomHex(8).toUpperCase();
  await env.DB.prepare("INSERT INTO finance_entries (id,entry_date,kind,category,description,amount,reference,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'POSTED','owner',?,?)")
    .bind(newId,entryDate,kind,category,description,amount,reference,now,now).run();
  await logAdminActivity(env.DB,'finance_entry_created','finance_entry',newId,{kind,category,amount,entryDate,role:'owner'});
  return json({ok:true,id:newId});
}