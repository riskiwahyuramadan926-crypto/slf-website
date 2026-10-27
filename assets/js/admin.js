(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const secretKey = 'slf_admin_secret_session';
  let allOrders = [], allReviews = [], knownOrderIds = new Set(), firstLoad = true, activeTab = 'orders';
  const statusLabels = {PENDING_PAYMENT:'Menunggu pembayaran',PAID:'Pembayaran berhasil',PROCESSING:'Sedang diproses',COMPLETED:'Selesai',EXPIRED:'Kedaluwarsa',CANCELLED:'Dibatalkan'};
  const idr = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $('logout').addEventListener('click',()=>{sessionStorage.removeItem(secretKey);location.href='/admin/';});
  $('login-form').addEventListener('submit',async e=>{e.preventDefault();sessionStorage.setItem(secretKey,$('admin-secret').value);firstLoad=true;await loadOrders();});
  $('reload').addEventListener('click',()=>loadOrders(true));
  $('reload-reviews').addEventListener('click',loadReviews);
  $('order-search').addEventListener('input',renderOrders);
  $('status-filter').addEventListener('change',renderOrders);
  $('export-csv').addEventListener('click',exportCsv);
  $('enable-notifications').addEventListener('click',async()=>{
    if(!('Notification' in window)){showAdminError('Browser ini tidak mendukung notifikasi.');return;}
    const permission=await Notification.requestPermission();
    $('enable-notifications').textContent=permission==='granted'?'Notifikasi aktif':'Notifikasi belum diizinkan';
    if(permission==='granted')new Notification('SLF Admin',{body:'Notifikasi pesanan baru aktif selama panel ini terbuka.'});
  });
  document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    activeTab=btn.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
    $('orders-tab').hidden=activeTab!=='orders';$('reviews-tab').hidden=activeTab!=='reviews';
    if(activeTab==='reviews'&&!allReviews.length)loadReviews();
  }));
  async function api(path,init={}) {
    const secret=sessionStorage.getItem(secretKey)||'';
    const headers={...(init.headers||{}),authorization:'Bearer '+secret};
    if(init.body)headers['content-type']='application/json';
    const res=await fetch(path,{...init,headers,cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||'Permintaan gagal ('+res.status+').');
    return data;
  }
  async function loadOrders(manual=false){
    $('login-error').classList.remove('show');$('admin-error').classList.remove('show');
    const secret=sessionStorage.getItem(secretKey)||'';
    if(!secret){$('login-panel').hidden=false;$('dashboard').hidden=true;return;}
    try{
      const result=await api('/api/admin/orders');
      allOrders=result.orders||[];
      const newOrders=allOrders.filter(o=>!knownOrderIds.has(o.id));
      if(!firstLoad&&newOrders.length)notifyNewOrders(newOrders);
      allOrders.forEach(o=>knownOrderIds.add(o.id));
      firstLoad=false;
      $('login-panel').hidden=true;$('dashboard').hidden=false;
      renderStats(result.stats||{});
      renderOrders();
      $('last-updated').textContent='Pembaruan terakhir: '+new Date(result.generatedAt||Date.now()).toLocaleString('id-ID')+' · '+allOrders.length+' pesanan terakhir';
      if(manual)showToast('Data pesanan diperbarui.');
    }catch(e){
      if(/401|Akses admin ditolak/i.test(e.message)){sessionStorage.removeItem(secretKey);$('login-panel').hidden=false;$('dashboard').hidden=true;$('login-error').textContent=e.message;$('login-error').classList.add('show');}
      else showAdminError(e.message);
    }
  }
  function renderStats(s){
    const items=[['Pesanan tercatat',s.total??0],['Menunggu pembayaran',s.pending??0],['Sedang diproses',Number(s.paid||0)+Number(s.processing||0)],['Omzet terverifikasi',idr(s.revenue||0)],['Pesanan hari ini',s.today??0],['Sudah selesai',s.completed??0],['Belum dibayar',s.pending??0],['Batal / kedaluwarsa',Number(s.cancelled||0)]];
    $('stats').innerHTML=items.map(([label,value])=>'<div class="admin-stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>').join('');
  }
  function renderOrders(){
    const root=$('orders');root.replaceChildren();
    const query=$('order-search').value.trim().toLowerCase(), status=$('status-filter').value;
    const list=allOrders.filter(o=>{
      const hay=[o.id,o.minecraft_name,o.platform,o.product_name,o.whatsapp,o.email,o.status].join(' ').toLowerCase();
      return (!query||hay.includes(query))&&(status==='ALL'||o.status===status);
    });
    if(!list.length){root.innerHTML='<div class="empty">Tidak ada pesanan yang cocok dengan filter.</div>';return;}
    list.forEach(o=>{
      const card=document.createElement('article');card.className='admin-order';card.id='order-'+o.id;
      const head=document.createElement('div');head.className='admin-order-head';
      const title=document.createElement('div');const h=document.createElement('h3');h.textContent=o.product_name+' · '+o.id;const date=document.createElement('p');date.className='subtle';date.textContent=new Date(o.created_at).toLocaleString('id-ID');title.append(h,date);
      const badge=document.createElement('span');badge.className='status-pill '+(['PAID','PROCESSING','COMPLETED'].includes(o.status)?'paid':(['EXPIRED','CANCELLED'].includes(o.status)?'expired':''));badge.textContent=statusLabels[o.status]||o.status;head.append(title,badge);card.append(head);
      const d=o.details||{}, entries=[['Pemain',o.minecraft_name+' ('+o.platform+')'],['WhatsApp',o.whatsapp],['Email',o.email||'—'],['Subtotal',idr(o.subtotal)],['Diskon',idr(o.discount)],['Total',idr(o.total)],['Promo',o.promo_code||'—'],['Waktu bayar',o.paid_at?new Date(o.paid_at).toLocaleString('id-ID'):'—'],['Waktu selesai',o.completed_at?new Date(o.completed_at).toLocaleString('id-ID'):'—']];
      if(['VIP_PLUS','CUSTOM_RANK'].includes(o.product_id)){entries.push(['Nama Custom Rank',d.rankName||'—'],['Warna rank',d.rankColor||'—'],['Gaya tulisan',({normal:'Normal',bold:'Tebal',italic:'Miring',bold_italic:'Tebal + Miring'})[d.rankStyle]||d.rankStyle||'—']);if(o.product_id==='VIP_PLUS')entries.push(['Catatan VIP+',d.buyerNote||'—']);}
      else entries.push(['Catatan pembeli',d.buyerNote||'—']);
      const dl=document.createElement('dl');entries.forEach(([k,v])=>{const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=String(v);dl.append(dt,dd);});card.append(dl);
      const actions=document.createElement('div');actions.className='admin-inline-actions';
      const phone=String(o.whatsapp||'').replace(/\D/g,'');
      if(phone){const chat=document.createElement('a');chat.className='btn btn-quiet';chat.href='https://wa.me/'+phone+'?text='+encodeURIComponent(messageFor(o));chat.target='_blank';chat.rel='noopener noreferrer';chat.textContent='Chat pembeli';actions.append(chat);}
      const copy=document.createElement('button');copy.type='button';copy.className='btn btn-quiet';copy.textContent='Salin nomor';copy.addEventListener('click',()=>copyText(o.id,'Nomor pesanan tersalin.'));actions.append(copy);
      const copySummary=document.createElement('button');copySummary.type='button';copySummary.className='btn btn-quiet';copySummary.textContent='Salin ringkasan';copySummary.addEventListener('click',()=>copyText(orderSummary(o),'Ringkasan pesanan tersalin.'));actions.append(copySummary);
      if(o.status==='PENDING_PAYMENT'){const b=document.createElement('button');b.type='button';b.className='btn btn-gold';b.textContent='Konfirmasi pembayaran';b.addEventListener('click',async()=>{if(!confirm('Cocokkan nominal dan transaksi masuk di DANA terlebih dahulu. Screenshot saja tidak cukup. Konfirmasi '+o.id+'?'))return;b.disabled=true;try{await api('/api/admin/verify-payment',{method:'POST',body:JSON.stringify({orderId:o.id})});await loadOrders();showToast('Pembayaran ditandai terverifikasi.');}catch(e){showAdminError(e.message);b.disabled=false;}});actions.append(b);}
      if(o.status==='PAID'){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Mulai proses';b.addEventListener('click',async()=>{b.disabled=true;try{await api('/api/admin/process',{method:'POST',body:JSON.stringify({orderId:o.id})});await loadOrders();}catch(e){showAdminError(e.message);b.disabled=false;}});actions.append(b);}
      if(['PAID','PROCESSING'].includes(o.status)){const b=document.createElement('button');b.type='button';b.className='btn btn-gold';b.textContent='Tandai selesai';b.addEventListener('click',async()=>{if(!confirm('Produk sudah benar-benar diberikan ke '+o.minecraft_name+'?'))return;b.disabled=true;try{await api('/api/admin/complete',{method:'POST',body:JSON.stringify({orderId:o.id})});await loadOrders();showToast('Pesanan selesai.');}catch(e){showAdminError(e.message);b.disabled=false;}});actions.append(b);}
      if(['PENDING_PAYMENT','PAID','PROCESSING'].includes(o.status)){const b=document.createElement('button');b.type='button';b.className='btn btn-quiet';b.textContent='Salin pesan status';b.addEventListener('click',()=>copyText(messageFor(o),'Pesan status tersalin.'));actions.append(b);}
      card.append(actions);root.append(card);
    });
  }
  function messageFor(o){const s=o.status==='PENDING_PAYMENT'?'masih menunggu pembayaran. Jika sudah membayar, kirim bukti agar kami cocokkan dengan transaksi masuk.':o.status==='PAID'?'sudah terverifikasi dan masuk antrean pemrosesan.':o.status==='PROCESSING'?'sedang diproses oleh tim SLF.':o.status==='COMPLETED'?'telah selesai. Terima kasih telah mendukung SLF.':'sedang kami periksa.';return 'Halo '+o.minecraft_name+', ini admin SLF. Pesanan '+o.id+' ('+o.product_name+', '+idr(o.total)+') '+s+'';}
  function orderSummary(o){return ['SLF STORE — RINGKASAN PESANAN','Nomor: '+o.id,'Tanggal: '+new Date(o.created_at).toLocaleString('id-ID'),'Pemain: '+o.minecraft_name+' ('+o.platform+')','WhatsApp: '+o.whatsapp,'Produk: '+o.product_name,'Subtotal: '+idr(o.subtotal),'Diskon: '+idr(o.discount),'Total: '+idr(o.total),'Status: '+(statusLabels[o.status]||o.status),'Catatan: '+(o.details?.buyerNote||'—')].join('\n');}
  async function loadReviews(){
    $('reviews-error').classList.remove('show');
    try{const data=await api('/api/admin/reviews');allReviews=data.reviews||[];renderReviews();}
    catch(e){$('reviews-error').textContent=e.message;$('reviews-error').classList.add('show');}
  }
  function renderReviews(){
    const root=$('reviews-list');root.replaceChildren();
    if(!allReviews.length){root.innerHTML='<div class="empty">Belum ada ulasan yang masuk.</div>';return;}
    allReviews.forEach(r=>{
      const card=document.createElement('article');card.className='review-card';
      const title=document.createElement('h3');title.textContent='★'.repeat(Number(r.rating)||0)+'☆'.repeat(5-(Number(r.rating)||0))+' · '+r.player_name;
      const meta=document.createElement('div');meta.className='admin-muted';meta.textContent='Pesanan '+r.order_id+' · '+new Date(r.created_at).toLocaleString('id-ID');
      const comment=document.createElement('p');comment.textContent=r.comment||'(Tanpa komentar)';
      const form=document.createElement('form');form.className='admin-reply';
      const label=document.createElement('label');label.textContent='Balasan publik admin';
      const area=document.createElement('textarea');area.maxLength=1000;area.required=true;area.placeholder='Tulis balasan yang akan tampil di halaman Store…';area.value=r.reply||'';
      const row=document.createElement('div');row.className='admin-inline-actions';
      const submit=document.createElement('button');submit.type='submit';submit.className='btn btn-gold';submit.textContent=r.reply?'Perbarui balasan':'Kirim balasan';
      const copy=document.createElement('button');copy.type='button';copy.className='btn btn-quiet';copy.textContent='Salin ulasan';copy.addEventListener('click',()=>copyText('Ulasan '+r.player_name+' ('+r.rating+'/5): '+(r.comment||''),'Ulasan tersalin.'));
      row.append(submit,copy);form.append(label,area,row);
      form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{await api('/api/admin/reviews',{method:'POST',body:JSON.stringify({orderId:r.order_id,reply:area.value,adminName:'Tim SLF'})});await loadReviews();showToast('Balasan ulasan tersimpan dan tampil di Store.');}catch(err){$('reviews-error').textContent=err.message;$('reviews-error').classList.add('show');submit.disabled=false;}});
      card.append(title,meta,comment,form);root.append(card);
    });
  }
  function exportCsv(){
    const rows=[['Nomor Pesanan','Dibuat','Pemain','Platform','WhatsApp','Produk','Subtotal','Diskon','Total','Status','Promo','Dibayar','Selesai']];
    allOrders.forEach(o=>rows.push([o.id,o.created_at,o.minecraft_name,o.platform,o.whatsapp,o.product_name,o.subtotal,o.discount,o.total,o.status,o.promo_code||'',o.paid_at||'',o.completed_at||'']));
    const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='slf-transaksi-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);showToast('Ekspor CSV dibuat.');
  }
  function notifyNewOrders(orders){
    if('Notification' in window&&Notification.permission==='granted')orders.forEach(o=>new Notification('Pesanan baru · SLF',{body:o.id+' · '+o.minecraft_name+' · '+idr(o.total),tag:o.id}));
    showToast(orders.length+' pesanan baru masuk.');
  }
  async function copyText(text,message){try{await navigator.clipboard.writeText(text);showToast(message);}catch{prompt('Salin teks berikut:',text);}}
  function showAdminError(message){$('admin-error').textContent=message;$('admin-error').classList.add('show');}
  function showToast(message){const t=$('toast');if(!t)return;t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200);}
  if(sessionStorage.getItem(secretKey))loadOrders();
  setInterval(()=>{if(sessionStorage.getItem(secretKey)&&!document.hidden)loadOrders();},45000);
})();