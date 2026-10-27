import { json, fail, readJson, requireOwner, safeText, logAdminActivity } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Modul rencana pendanaan hanya dapat dibuka Owner.',403);
  const plan=await env.DB.prepare('SELECT * FROM investment_plans WHERE id=\'main-draft\'').first();
  if(!plan) return fail('Draf rencana belum tersedia.',503);
  const unitPrice=Number(plan.unit_price),totalUnits=Number(plan.total_units),share=Number(plan.profit_share_pct),lockMonths=Number(plan.lock_months);
  return json({plan:{...plan,unit_price:unitPrice,total_units:totalUnits,profit_share_pct:share,lock_months:lockMonths,target_funding:unitPrice*totalUnits},warning:'DRAF INTERNAL: bukan penawaran publik, bukan jaminan imbal hasil, dan tidak menerima pembayaran atau pendaftaran investor.'});
}
export async function onRequestPost({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Modul rencana pendanaan hanya dapat dikelola Owner.',403);
  const d=await readJson(request);
  const unitPrice=Number(d.unitPrice),totalUnits=Number(d.totalUnits),share=Number(d.profitSharePct),lockMonths=Number(d.lockMonths);
  const startDate=safeText(d.startDate,10)||null;
  const status=d.status==='PAUSED'?'PAUSED':'DRAFT';
  const notes=safeText(d.notes,1000);
  if(!Number.isSafeInteger(unitPrice)||unitPrice<1000||unitPrice>2000000000||!Number.isInteger(totalUnits)||totalUnits<1||totalUnits>1000||!Number.isFinite(share)||share<0||share>40||!Number.isInteger(lockMonths)||lockMonths<1||lockMonths>60) {
    return fail('Nilai harga, jumlah unit, persentase (maksimum 40%), atau jangka waktu tidak valid.');
  }
  if(startDate&&!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return fail('Tanggal mulai tidak valid.');
  const now=new Date().toISOString();
  await env.DB.prepare(`UPDATE investment_plans SET unit_price=?,total_units=?,profit_share_pct=?,lock_months=?,start_date=?,status=?,notes=?,updated_by='owner',updated_at=? WHERE id='main-draft'`)
    .bind(unitPrice,totalUnits,share,lockMonths,startDate,status,notes,now).run();
  await logAdminActivity(env.DB,'investment_draft_updated','investment_plan','main-draft',{unitPrice,totalUnits,share,lockMonths,startDate,status,role:'owner'});
  return json({ok:true,targetFunding:unitPrice*totalUnits,status,disclaimer:'Draf internal tersimpan. Jangan publikasikan atau menerima uang sebelum struktur dan aturan ditinjau pihak dewasa/profesional yang kompeten.'});
}