(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const secretKey = 'slf_admin_secret_session';
  let allOrders = [], allReviews = [], allProducts = [], allPromos = [], allCustomers = [], allTickets = [], allAnnouncements = [], knownOrderIds = new Set(), firstLoad = true, activeTab = 'orders';
  const statusLabels = {PENDING_PAYMENT:'Menunggu pembayaran',PAID:'Pembayaran berhasil',PROCESSING:'Sedang diproses',COMPLETED:'Selesai',EXPIRED:'Kedaluwarsa',CANCELLED:'Dibatalkan'};
  const idr = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $('logout').addEventListener('click',()=>{sessionStorage.removeItem(secretKey);location.href='/admin/';});
  $('login-form').addEventListener('submit',async e=>{e.preventDefault();sessionStorage.setItem(secretKey,$('admin-secret').value);firstLoad=true;await loadOrders();});
  $('reload').addEventListener('click',()=>loadOrders(true));
  $('reload-reviews').addEventListener('click',loadReviews);
  $('reload-customers').addEventListener('click',loadCustomers);
  $('run-report').addEventListener('click',loadReports);
  $('reload-activity').addEventListener('click',loadActivity);
  $('reload-support').addEventListener('click',loadSupport);
  $('customer-search').addEventListener('input',renderCustomers);
  $('product-reset').addEventListener('click',resetProductForm);
  $('promo-reset').addEventListener('click',resetPromoForm);
  $('announcement-reset').addEventListener('click',resetAnnouncementForm);
  $('product-form').addEventListener('submit',saveProduct);
  $('promo-form').addEventListener('submit',savePromo);
  $('announcement-form').addEventListener('submit',saveAnnouncement);
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
    ['orders','reviews','products','promos','customers','reports','activity','support','announcements'].forEach(name=>{
      const section=$(name+'-tab'); if(section) section.hidden=name!==activeTab;
    });
    if(activeTab!=='orders')loadTab(activeTab);
  }));
  async function api(path,init={}) {
    const secret=sessionStorage.getItem(secretKey)||'';
    const headers={...(init.headers||{}),authorization:'Bearer '+secret};
    if(init.body)headers['content-type']='application/json';
    const res=await fetch(path,{...init,headers,cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok){if(res.status===401){sessionStorage.removeItem(secretKey);$('login-panel').hidden=false;$('dashboard').hidden=true;}throw new Error(data.error||'Permintaan gagal ('+res.status+').');}
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

  function loadTab(name){
    const jobs={products:loadProducts,promos:loadPromos,customers:loadCustomers,reports:loadReports,activity:loadActivity,support:loadSupport,announcements:loadAnnouncements};
    if(name==='reviews'){loadReviews();return;}
    if(jobs[name])jobs[name]();
  }
  function setError(id,message){const el=$(id);if(!el)return;el.textContent=message||'';el.classList.toggle('show',Boolean(message));}
  function makeTable(headers,rows){
    if(!rows.length)return '<div class="empty">Belum ada data untuk ditampilkan.</div>';
    return '<div class="admin-table-wrap"><table class="admin-data-table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  async function loadProducts(){
    setError('products-error','');
    try{const d=await api('/api/admin/products');allProducts=d.products||[];renderProducts();}
    catch(e){setError('products-error',e.message);}
  }
  function renderProducts(){
    const root=$('products-list');root.replaceChildren();
    if(!allProducts.length){root.innerHTML='<div class="empty">Belum ada produk.</div>';return;}
    allProducts.forEach(p=>{
      const card=document.createElement('article');card.className='admin-list-card';
      const h=document.createElement('h3');h.textContent=(p.icon||'✦')+' '+p.name;
      const meta=document.createElement('p');meta.textContent=idr(p.price)+' · '+(p.active?'Aktif':'Nonaktif')+' · ID: '+p.id;
      const desc=document.createElement('p');desc.textContent=p.description||'Tanpa deskripsi';
      const note=document.createElement('p');note.className='admin-muted';note.textContent=p.note||'—';
      const actions=document.createElement('div');actions.className='admin-inline-actions';
      const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='Edit produk';edit.addEventListener('click',()=>editProduct(p.id));
      actions.append(edit);card.append(h,meta,desc,note,actions);root.append(card);
    });
  }
  function resetProductForm(){
    $('product-form').reset();$('product-id').readOnly=false;$('product-active').value='1';$('product-icon').value='✦';$('product-tag').value='Store';$('product-form-title').textContent='Tambah produk';setError('products-error','');
  }
  function editProduct(id){
    const p=allProducts.find(x=>x.id===id);if(!p)return;
    $('product-id').value=p.id;$('product-id').readOnly=true;$('product-name').value=p.name;$('product-price').value=p.price;
    $('product-icon').value=p.icon||'✦';$('product-tag').value=p.tag||'Store';$('product-description').value=p.description||'';
    $('product-note').value=p.note||'';$('product-active').value=p.active?'1':'0';$('product-form-title').textContent='Edit '+p.name;
    $('product-form').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function saveProduct(e){
    e.preventDefault();setError('products-error','');
    const payload={id:$('product-id').value.trim().toUpperCase(),name:$('product-name').value.trim(),price:Number($('product-price').value),icon:$('product-icon').value.trim(),tag:$('product-tag').value.trim(),description:$('product-description').value.trim(),note:$('product-note').value.trim(),active:$('product-active').value==='1'};
    const btn=$('product-form').querySelector('[type=submit]');btn.disabled=true;
    try{await api('/api/admin/products',{method:'POST',body:JSON.stringify(payload)});await loadProducts();resetProductForm();showToast('Produk tersimpan. Harga berlaku untuk checkout baru.');}
    catch(err){setError('products-error',err.message);}finally{btn.disabled=false;}
  }
  async function loadPromos(){
    setError('promos-error','');
    try{const d=await api('/api/admin/promos');allPromos=d.promos||[];renderPromos();}
    catch(e){setError('promos-error',e.message);}
  }
  function renderPromos(){
    const root=$('promos-list');root.replaceChildren();
    if(!allPromos.length){root.innerHTML='<div class="empty">Belum ada kode promo yang dibuat melalui panel admin.</div>';return;}
    allPromos.forEach(p=>{
      const card=document.createElement('article');card.className='admin-list-card';
      const h=document.createElement('h3');h.textContent=p.code;
      const meta=document.createElement('p');meta.textContent=(p.type==='percent'?p.value+'%':'Rp'+Number(p.value).toLocaleString('id-ID'))+' potongan · '+(p.active?'Aktif':'Nonaktif');
      const limits=document.createElement('p');limits.textContent='Terpakai '+p.uses+' kali'+(p.max_uses===null?'':' dari '+p.max_uses)+' · Kedaluwarsa: '+(p.expires_at||'tidak diatur');
      const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Edit promo';b.addEventListener('click',()=>editPromo(p.code));
      card.append(h,meta,limits,b);root.append(card);
    });
  }
  function resetPromoForm(){
    $('promo-form').reset();$('promo-code-admin').readOnly=false;$('promo-type').value='percent';$('promo-active').value='1';$('promo-form-title').textContent='Buat kode promo';setError('promos-error','');
  }
  function editPromo(code){
    const p=allPromos.find(x=>x.code===code);if(!p)return;
    $('promo-code-admin').value=p.code;$('promo-code-admin').readOnly=true;$('promo-type').value=p.type;$('promo-value').value=p.value;
    $('promo-active').value=p.active?'1':'0';$('promo-max-uses').value=p.max_uses??'';
    $('promo-expiry').value=p.expires_at?new Date(p.expires_at).toISOString().slice(0,16):'';$('promo-form-title').textContent='Edit '+p.code;
    $('promo-form').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function savePromo(e){
    e.preventDefault();setError('promos-error','');
    const expiry=$('promo-expiry').value;
    const payload={code:$('promo-code-admin').value.trim().toUpperCase(),type:$('promo-type').value,value:Number($('promo-value').value),active:$('promo-active').value==='1',maxUses:$('promo-max-uses').value===''?null:Number($('promo-max-uses').value),expiresAt:expiry?new Date(expiry).toISOString():null};
    const btn=$('promo-form').querySelector('[type=submit]');btn.disabled=true;
    try{await api('/api/admin/promos',{method:'POST',body:JSON.stringify(payload)});await loadPromos();resetPromoForm();showToast('Kode promo tersimpan.');}
    catch(err){setError('promos-error',err.message);}finally{btn.disabled=false;}
  }
  async function loadCustomers(){setError('customers-error','');try{const d=await api('/api/admin/customers');allCustomers=d.customers||[];renderCustomers();}catch(e){setError('customers-error',e.message);}}
  function renderCustomers(){
    const q=$('customer-search').value.trim().toLowerCase();
    const rows=allCustomers.filter(c=>[c.minecraft_name,c.platform,c.whatsapp,c.email].join(' ').toLowerCase().includes(q))
      .map(c=>[c.minecraft_name,c.platform,c.whatsapp,c.email||'—',c.order_count,c.paid_orders,idr(c.verified_spend),c.last_order?new Date(c.last_order).toLocaleString('id-ID'):'—']);
    $('customers-list').innerHTML=makeTable(['Pemain','Platform','WhatsApp','Email','Jumlah order','Order terbayar','Total belanja terverifikasi','Order terakhir'],rows);
  }
  async function loadReports(){
    setError('reports-error','');
    const from=$('report-from').value,to=$('report-to').value;
    const params=new URLSearchParams();if(from)params.set('from',from);if(to)params.set('to',to);
    try{
      const d=await api('/api/admin/reports'+(params.size?'?'+params.toString():''));
      const s=d.summary||{};
      $('report-stats').innerHTML=[['Periode',d.from+' s.d. '+d.to],['Jumlah pesanan',s.total_orders||0],['Omzet terverifikasi',idr(s.verified_revenue)],['Pesanan terbayar',s.paid_orders||0],['Menunggu pembayaran',s.pending||0],['Batal / kedaluwarsa',s.cancelled||0],['Selesai',s.completed||0]].map(([k,v])=>'<div class="admin-stat"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('');
      $('report-daily').innerHTML=makeTable(['Tanggal','Pesanan','Omzet terverifikasi'],(d.daily||[]).map(x=>[x.day,x.orders,idr(x.revenue)]));
      $('report-products').innerHTML=makeTable(['Produk','Pesanan','Omzet terverifikasi'],(d.products||[]).map(x=>[x.product_name,x.orders,idr(x.revenue)]));
    }catch(e){setError('reports-error',e.message);}
  }
  async function loadActivity(){
    setError('activity-error','');
    try{
      const d=await api('/api/admin/activity');const root=$('activity-list');root.replaceChildren();
      if(!(d.activities||[]).length){root.innerHTML='<div class="empty">Belum ada aktivitas yang tercatat.</div>';return;}
      d.activities.forEach(a=>{
        const card=document.createElement('article');card.className='admin-list-card';
        const h=document.createElement('h3');h.textContent=a.action+' · '+(a.entity_type||'');
        const meta=document.createElement('p');meta.className='admin-muted';meta.textContent=new Date(a.created_at).toLocaleString('id-ID')+' · '+(a.entity_id||'—');
        const details=document.createElement('p');details.textContent=JSON.stringify(a.details||{});
        card.append(h,meta,details);root.append(card);
      });
    }catch(e){setError('activity-error',e.message);}
  }
  async function loadSupport(){
    setError('support-error','');
    try{const d=await api('/api/admin/support');allTickets=d.tickets||[];renderSupport();}
    catch(e){setError('support-error',e.message);}
  }
  function renderSupport(){
    const root=$('support-list');root.replaceChildren();
    if(!allTickets.length){root.innerHTML='<div class="empty">Belum ada tiket masuk.</div>';return;}
    const statuses={OPEN:'Baru',IN_PROGRESS:'Sedang ditangani',WAITING_PLAYER:'Menunggu pemain',RESOLVED:'Selesai',CLOSED:'Ditutup'};
    allTickets.forEach(t=>{
      const card=document.createElement('article');card.className='admin-list-card';
      const h=document.createElement('h3');h.textContent=t.subject+' · '+t.id;
      const meta=document.createElement('p');meta.className='admin-muted';meta.textContent=t.player_name+' · '+t.contact+' · '+t.category+' · '+new Date(t.created_at).toLocaleString('id-ID');
      const msg=document.createElement('p');msg.textContent=t.message;
      const contactActions=document.createElement('div');contactActions.className='admin-inline-actions';
      const replyText=t.admin_reply||('Halo '+t.player_name+', kami menindaklanjuti tiket bantuan '+t.id+' dari tim SLF. Pesan kamu: '+t.subject+'.');
      if (/^\\+?[0-9\\s()\\-]{8,20}$/.test(t.contact)) {
        const a=document.createElement('a');a.className='btn btn-quiet';a.target='_blank';a.rel='noopener noreferrer';a.href='https://wa.me/'+t.contact.replace(/\\D/g,'')+'?text='+encodeURIComponent(replyText);a.textContent='Hubungi via WhatsApp';contactActions.append(a);
      } else if (/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(t.contact)) {
        const a=document.createElement('a');a.className='btn btn-quiet';a.href='mailto:'+encodeURIComponent(t.contact)+'?subject='+encodeURIComponent('Tindak lanjut tiket SLF '+t.id)+'&body='+encodeURIComponent(replyText);a.textContent='Hubungi via email';contactActions.append(a);
      }
      const copyTicket=document.createElement('button');copyTicket.type='button';copyTicket.className='btn btn-quiet';copyTicket.textContent='Salin detail tiket';
      copyTicket.addEventListener('click',()=>copyText('Tiket '+t.id+'\\nPemain: '+t.player_name+'\\nKontak: '+t.contact+'\\nSubjek: '+t.subject+'\\nPesan: '+t.message+'\\nBalasan admin: '+(t.admin_reply||'—'),'Detail tiket tersalin.'));
      contactActions.append(copyTicket);
      const form=document.createElement('form');form.className='admin-form';
      const lab1=document.createElement('label');lab1.textContent='Status tiket';
      const select=document.createElement('select');['OPEN','IN_PROGRESS','WAITING_PLAYER','RESOLVED','CLOSED'].forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=statuses[s];select.append(o);});select.value=t.status;
      const lab2=document.createElement('label');lab2.textContent='Balasan admin (opsional)';
      const area=document.createElement('textarea');area.maxLength=1500;area.value=t.admin_reply||'';area.placeholder='Catatan tindak lanjut untuk pelanggan';
      const btn=document.createElement('button');btn.type='submit';btn.className='btn btn-gold';btn.textContent='Simpan tindak lanjut';
      form.append(lab1,select,lab2,area,btn);
      form.addEventListener('submit',async e=>{e.preventDefault();btn.disabled=true;try{await api('/api/admin/support',{method:'POST',body:JSON.stringify({id:t.id,status:select.value,reply:area.value})});await loadSupport();showToast('Tiket diperbarui.');}catch(err){setError('support-error',err.message);btn.disabled=false;}});
      card.append(h,meta,msg,contactActions,form);root.append(card);
    });
  }
  async function loadAnnouncements(){setError('announcements-error','');try{const d=await api('/api/admin/announcements');allAnnouncements=d.announcements||[];renderAnnouncements();}catch(e){setError('announcements-error',e.message);}}
  function renderAnnouncements(){
    const root=$('announcements-list');root.replaceChildren();
    if(!allAnnouncements.length){root.innerHTML='<div class="empty">Belum ada pengumuman.</div>';return;}
    allAnnouncements.forEach(a=>{
      const card=document.createElement('article');card.className='admin-list-card';
      const h=document.createElement('h3');h.textContent=a.title;
      const meta=document.createElement('p');meta.textContent=(a.active?'Aktif':'Nonaktif')+' · '+a.id;
      const body=document.createElement('p');body.textContent=a.body;
      const dates=document.createElement('p');dates.className='admin-muted';dates.textContent='Mulai: '+(a.starts_at||'sekarang')+' · Selesai: '+(a.ends_at||'tanpa batas');
      const btn=document.createElement('button');btn.type='button';btn.className='btn';btn.textContent='Edit pengumuman';btn.addEventListener('click',()=>editAnnouncement(a.id));
      card.append(h,meta,body,dates,btn);root.append(card);
    });
  }
  function resetAnnouncementForm(){
    $('announcement-form').reset();$('announcement-id').value='';$('announcement-active').value='1';$('announcement-form-title').textContent='Buat pengumuman';setError('announcements-error','');
  }
  function toLocalDateTime(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  function editAnnouncement(id){
    const a=allAnnouncements.find(x=>x.id===id);if(!a)return;
    $('announcement-id').value=a.id;$('announcement-title').value=a.title;$('announcement-body').value=a.body;$('announcement-active').value=a.active?'1':'0';
    $('announcement-start').value=toLocalDateTime(a.starts_at);$('announcement-end').value=toLocalDateTime(a.ends_at);$('announcement-form-title').textContent='Edit pengumuman';
    $('announcement-form').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function saveAnnouncement(e){
    e.preventDefault();setError('announcements-error','');
    const starts=$('announcement-start').value,ends=$('announcement-end').value;
    const payload={id:$('announcement-id').value||undefined,title:$('announcement-title').value.trim(),body:$('announcement-body').value.trim(),active:$('announcement-active').value==='1',startsAt:starts?new Date(starts).toISOString():null,endsAt:ends?new Date(ends).toISOString():null};
    const btn=$('announcement-form').querySelector('[type=submit]');btn.disabled=true;
    try{await api('/api/admin/announcements',{method:'POST',body:JSON.stringify(payload)});await loadAnnouncements();resetAnnouncementForm();showToast('Pengumuman tersimpan.');}
    catch(err){setError('announcements-error',err.message);}finally{btn.disabled=false;}
  }
  function initReportDates(){
    const today=new Date(),from=new Date(Date.now()-29*86400000),format=d=>d.toISOString().slice(0,10);
    if(!$('report-to').value)$('report-to').value=format(today);
    if(!$('report-from').value)$('report-from').value=format(from);
  }
  initReportDates();

  if(sessionStorage.getItem(secretKey))loadOrders();
  setInterval(()=>{if(sessionStorage.getItem(secretKey)&&!document.hidden)loadOrders();},45000);
})();