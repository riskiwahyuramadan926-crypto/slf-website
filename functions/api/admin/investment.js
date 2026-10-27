import { json, fail, readJson, requireOwner, safeText, logAdminActivity } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Modul rencana pendanaan hanya dapat dibuka Owner.',403);
  // Keep this plan in a fixed four-month cycle; it is only an internal draft.
  await env.DB.prepare("UPDATE investment_plans SET lock_months=4 WHERE id='main-draft' AND lock_months<>4").run();
  const plan=await env.DB.prepare("SELECT * FROM investment_plans WHERE id='main-draft'").first();
  if(!plan) return fail('Draf rencana belum tersedia.',503);
  const unitPrice=Number(plan.unit_price),totalUnits=Number(plan.total_units),share=Number(plan.profit_share_pct),lockMonths=Number(plan.lock_months);
  return json({
    plan:{...plan,unit_price:unitPrice,total_units:totalUnits,profit_share_pct:share,lock_months:4,target_funding:unitPrice*totalUnits},
    policy:{
      cycleMonths:4,
      reportLeadDays:2,
      contributionProration:'Modal yang masuk pada 1–2 bulan pertama siklus ikut pembagian mendatang secara proporsional berdasarkan waktu aktif modal dalam siklus (bulan efektif / 4).',
      lateContribution:'Modal yang baru masuk setelah 3 bulan siklus berjalan dilewatkan dari pembagian terdekat dan baru ikut penuh pada siklus berikutnya.',
      profitRule:'Pembagian hanya dipertimbangkan bila ada laba bersih yang dapat dibagikan. Jika tidak ada laba, tidak ada pembayaran pada periode itu dan evaluasi dilakukan pada periode berikutnya.',
      insolvencyRule:'Jika server berhenti atau bangkrut, pengembalian modal tidak dijamin 100%; pengembalian bisa sebagian atau tidak ada.',
      voluntary:true,
      livePurchasesEnabled:false,
      financialReports:'Snapshot laporan disiapkan dan diumumkan 2 hari sebelum tanggal pembagian.',
      memberLedger:'Catatan jumlah unit per anggota baru boleh diaktifkan sesudah struktur dan ketentuan ditinjau secara hukum/keuangan.'
    },
    warning:'DRAF INTERNAL: bukan penawaran publik, bukan jaminan imbal hasil, tidak menerima pembayaran/pendaftaran pemodal, dan hanya untuk perencanaan.'
  });
}
export async function onRequestPost({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Modul rencana pendanaan hanya dapat dikelola Owner.',403);
  const d=await readJson(request);
  const unitPrice=Number(d.unitPrice),totalUnits=Number(d.totalUnits),share=Number(d.profitSharePct),lockMonths=Number(d.lockMonths);
  const startDate=safeText(d.startDate,10)||null;
  const status=d.status==='PAUSED'?'PAUSED':'DRAFT';
  const notes=safeText(d.notes,1000);
  if(!Number.isSafeInteger(unitPrice)||unitPrice<1000||unitPrice>2000000000||!Number.isInteger(totalUnits)||totalUnits<1||totalUnits>1000||!Number.isFinite(share)||share<0||share>40||lockMonths!==4) {
    return fail('Nilai harga, jumlah unit, persentase (maksimum 40%), atau interval tidak valid. Siklus pembagian draf harus tepat 4 bulan.');
  }
  if(startDate&&!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return fail('Tanggal mulai tidak valid.');
  const now=new Date().toISOString();
  await env.DB.prepare(`UPDATE investment_plans SET unit_price=?,total_units=?,profit_share_pct=?,lock_months=?,start_date=?,status=?,notes=?,updated_by='owner',updated_at=? WHERE id='main-draft'`)
    .bind(unitPrice,totalUnits,share,lockMonths,startDate,status,notes,now).run();
  await logAdminActivity(env.DB,'investment_draft_updated','investment_plan','main-draft',{unitPrice,totalUnits,share,lockMonths,startDate,status,role:'owner'});
  return json({ok:true,targetFunding:unitPrice*totalUnits,status,disclaimer:'Draf internal tersimpan. Jangan publikasikan atau menerima uang sebelum struktur dan aturan ditinjau pihak dewasa/profesional yang kompeten.'});
}