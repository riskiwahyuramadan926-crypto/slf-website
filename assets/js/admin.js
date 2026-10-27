(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const secretKey = 'slf_admin_secret_session';
  let selectedOrder = new URLSearchParams(location.search).get('order');
  $('logout').addEventListener('click', () => { sessionStorage.removeItem(secretKey); location.href = '/admin/'; });
  $('login-form').addEventListener('submit', async event => { event.preventDefault(); const value=$('admin-secret').value; sessionStorage.setItem(secretKey,value); await loadOrders(); });
  $('reload').addEventListener('click', loadOrders);
  async function api(path, init = {}) {
    const secret = sessionStorage.getItem(secretKey) || '';
    const headers = { ...(init.headers || {}), authorization: `Bearer ${secret}` };
    if (init.body) headers['content-type'] = 'application/json';
    const res = await fetch(path, { ...init, headers, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status}).`);
    return data;
  }
  async function loadOrders() {
    const secret = sessionStorage.getItem(secretKey) || '';
    $('login-error').classList.remove('show'); $('admin-error').classList.remove('show');
    if (!secret) { $('login-panel').hidden=false; $('dashboard').hidden=true; return; }
    try {
      const result = await api('/api/admin/orders');
      $('login-panel').hidden=true; $('dashboard').hidden=false;
      renderOrders(result.orders || []);
    } catch(e) {
      sessionStorage.removeItem(secretKey); $('login-panel').hidden=false; $('dashboard').hidden=true;
      $('login-error').textContent=e.message; $('login-error').classList.add('show');
    }
  }
  function renderOrders(orders) {
    const root=$('orders'); root.replaceChildren();
    if (!orders.length) { root.innerHTML='<div class="empty">Belum ada pesanan tersimpan.</div>'; return; }
    const orderSorted = [...orders].sort((a,b) => (a.id === selectedOrder ? -1 : b.id === selectedOrder ? 1 : 0));
    orderSorted.forEach(o => {
      const card=document.createElement('article'); card.className='admin-order'; card.id=`order-${o.id}`;
      const head=document.createElement('div');head.className='admin-order-head';
      const title=document.createElement('div'); const h=document.createElement('h3');h.textContent=`${o.product_name} · ${o.id}`;const p=document.createElement('p');p.className='subtle';p.textContent=new Date(o.created_at).toLocaleString('id-ID');title.append(h,p);
      const badge=document.createElement('span');badge.className='status-pill '+(['PAID','PROCESSING','COMPLETED'].includes(o.status)?'paid':o.status==='EXPIRED'?'expired':'');badge.textContent=statusName(o.status);head.append(title,badge);card.appendChild(head);
      const dl=document.createElement('dl');
      const detail=o.details||{};
      const entries=[['Pemain',`${o.minecraft_name} (${o.platform})`],['WhatsApp',o.whatsapp],['Email',o.email||'—'],['Harga',idr(o.subtotal)],['Diskon',idr(o.discount)],['Total',idr(o.total)],['Status',statusName(o.status)]];
      if (['VIP_PLUS','CUSTOM_RANK'].includes(o.product_id)) {
        entries.push(['Nama Custom Rank',detail.rankName||'—'],['Warna Custom Rank',detail.rankColor||'—'],['Gaya tulisan',({normal:'Normal',bold:'Tebal',italic:'Miring',bold_italic:'Tebal + Miring'})[detail.rankStyle]||detail.rankStyle||'—']);
        if (o.product_id==='VIP_PLUS') entries.push(['Catatan VIP+',detail.buyerNote||'—']);
      } else { entries.push(['Catatan pembeli',detail.buyerNote||'—']); }
      entries.forEach(([k,v])=>{const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=String(v);dl.append(dt,dd);});card.appendChild(dl);
      const actions=document.createElement('div');actions.style.display='flex';actions.style.gap='8px';actions.style.flexWrap='wrap';actions.style.marginTop='14px';
      const buyerPhone=String(o.whatsapp||'').replace(/\D/g,'');
      if (buyerPhone) { const chat=document.createElement('a'); chat.className='btn btn-quiet'; chat.href='https://wa.me/'+buyerPhone+'?text='+encodeURIComponent('Halo, ini admin SLF terkait pesanan '+o.id+'.'); chat.target='_blank'; chat.rel='noopener noreferrer'; chat.textContent='Chat pembeli'; actions.appendChild(chat); }
      const copy=document.createElement('button');copy.className='btn btn-quiet';copy.type='button';copy.textContent='Salin nomor';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(o.id);copy.textContent='Tersalin';}catch{prompt('Salin nomor pesanan:',o.id);}});actions.appendChild(copy);
      if (o.status === 'PENDING_PAYMENT') { const verify=document.createElement('button'); verify.className='btn btn-gold'; verify.type='button'; verify.textContent='Verifikasi pembayaran (cek DANA)'; verify.addEventListener('click',async()=>{if(!confirm('Pastikan transaksi benar-benar masuk di aplikasi/dashboard DANA dan nominal tepat. Screenshot pembeli saja tidak cukup. Verifikasi pesanan '+o.id+'?'))return;verify.disabled=true;try{await api('/api/admin/verify-payment',{method:'POST',body:JSON.stringify({orderId:o.id})});await loadOrders();}catch(e){showAdminError(e.message);verify.disabled=false;}});actions.appendChild(verify); }
      if (o.status === 'PAID') { const start=document.createElement('button');start.className='btn';start.type='button';start.textContent='Mulai Proses';start.addEventListener('click',async()=>{start.disabled=true;try{await api('/api/admin/process',{method:'POST',body:JSON.stringify({orderId:o.id})});await loadOrders();}catch(e){showAdminError(e.message);start.disabled=false;}});actions.appendChild(start); }
      if (['PAID','PROCESSING'].includes(o.status)) { const done=document.createElement('button');done.className='btn btn-gold';done.type='button';done.textContent='Tandai Pesanan Selesai';done.addEventListener('click',async()=>{if(!confirm(`Sudah memberikan ${o.product_name} ke ${o.minecraft_name} di Minecraft? Jika belum, tekan Batal.`))return;done.disabled=true;try{await api('/api/admin/complete',{method:'POST',body:JSON.stringify({orderId:o.id})});await loadOrders();}catch(e){showAdminError(e.message);done.disabled=false;}});actions.appendChild(done);}
      card.appendChild(actions);root.appendChild(card);
    });
    if (selectedOrder) { const target=$(`order-${selectedOrder}`); if(target) setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),100); }
  }
  function statusName(status){return ({PENDING_PAYMENT:'Menunggu pembayaran',PAID:'Pembayaran berhasil',PROCESSING:'Sedang diproses',COMPLETED:'Selesai',EXPIRED:'Kedaluwarsa',CANCELLED:'Dibatalkan'})[status]||status;}
  function idr(n){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);}
  function showAdminError(message){$('admin-error').textContent=message;$('admin-error').classList.add('show');}
  if (sessionStorage.getItem(secretKey)) loadOrders();
})();
