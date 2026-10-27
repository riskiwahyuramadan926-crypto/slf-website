(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const secretKey = 'slf_admin_secret_session';
  let allOrders = [], allReviews = [], allProducts = [], allPromos = [], allCustomers = [], allTickets = [], allAnnouncements = [], allNotes = [], allCmsItems = [], allFinanceEntries = [], currentFinance = {}, investmentPlan = null, currentRole = '', ownerSecretConfigured = false, lastCmsKind = 'slot', knownOrderIds = new Set(), knownTicketIds = new Set(), firstLoad = true, firstTicketLoad = true, activeTab = 'orders';
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
  $('reload-tickets').addEventListener('click',loadTickets);
  $('reload-notes').addEventListener('click',loadNotes);
  $('reload-finance').addEventListener('click',loadFinance);
  $('finance-form').addEventListener('submit',saveFinance);
  $('finance-kind').addEventListener('change',syncFinanceCategories);
  $('finance-export').addEventListener('click',exportFinanceCsv);
  $('note-form').addEventListener('submit',saveNote);
  $('cms-form').addEventListener('submit',saveCms);
  $('cms-reset').addEventListener('click',resetCmsForm);
  $('cms-kind').addEventListener('change',syncCmsForm);
  $('cms-page').addEventListener('change',syncCmsSlots);
  $('investment-form').addEventListener('submit',saveInvestment);
  $('investment-reload').addEventListener('click',loadInvestment);
  $('investment-profit-input').addEventListener('input',renderInvestmentCalculation);
  $('ticket-search').addEventListener('input',renderTickets);
  $('ticket-status-filter').addEventListener('change',renderTickets);
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
    ['orders','tickets','reviews','products','promos','customers','reports','activity','support','announcements','notes','finance','site-content','investment','access'].forEach(name=>{
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
    if(!res.ok){if(res.status===401){sessionStorage.removeItem(secretKey);currentRole='';$('login-panel').hidden=false;$('dashboard').hidden=true;$('role-pill').textContent='Belum masuk';}throw new Error(data.error||'Permintaan gagal ('+res.status+').');}
    return data;
  }
  async function loadOrders(manual=false){
    $('login-error').classList.remove('show');$('admin-error').classList.remove('show');
    const secret=sessionStorage.getItem(secretKey)||'';
    if(!secret){$('login-panel').hidden=false;$('dashboard').hidden=true;return;}
    try{
      if(!currentRole){const auth=await api('/api/admin/me');currentRole=auth.role;ownerSecretConfigured=Boolean(auth.ownerSecretConfigured);applyRole();updateAccessStatus(auth);}
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
      if(!currentRole){sessionStorage.removeItem(secretKey);$('login-panel').hidden=false;$('dashboard').hidden=true;$('login-error').textContent=e.message;$('login-error').classList.add('show');}
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
      if(o.status==='PENDING_PAYMENT'){const cancel=document.createElement('button');cancel.type='button';cancel.className='btn btn-quiet';cancel.textContent='Batalkan transaksi';cancel.addEventListener('click',async()=>{if(!confirm('Batalkan transaksi '+o.id+'? Pastikan pembeli belum membayar. Tiket re-entry yang terkait juga akan dibatalkan.'))return;cancel.disabled=true;try{await api('/api/admin/cancel',{method:'POST',body:JSON.stringify({orderId:o.id})});await loadOrders();showToast('Transaksi dibatalkan.');}catch(e){showAdminError(e.message);cancel.disabled=false;}});actions.append(cancel);}
      if(o.status==='PAID'){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Mulai proses';b.addEventListener('click',async()=>{b.disabled=true;try{await api('/api/admin/process',{method:'POST',body:JSON.stringify({orderId:o.id})});await loadOrders();}catch(e){showAdminError(e.message);b.disabled=false;}});actions.append(b);}
      if(['PAID','PROCESSING'].includes(o.status)){const b=document.createElement('button');b.type='button';b.className='btn btn-gold';b.textContent='Tandai selesai';b.addEventListener('click',async()=>{if(!confirm('Produk sudah benar-benar diberikan ke '+o.minecraft_name+'?'))return;b.disabled=true;try{await api('/api/admin/complete',{method:'POST',body:JSON.stringify({orderId:o.id})});await loadOrders();showToast('Pesanan selesai.');}catch(e){showAdminError(e.message);b.disabled=false;}});actions.append(b);}
      if(['PENDING_PAYMENT','PAID','PROCESSING'].includes(o.status)){const b=document.createElement('button');b.type='button';b.className='btn btn-quiet';b.textContent='Salin pesan status';b.addEventListener('click',()=>copyText(messageFor(o),'Pesan status tersalin.'));actions.append(b);}
      card.append(actions);root.append(card);
    });
  }
  function messageFor(o){const s=o.status==='PENDING_PAYMENT'?'masih menunggu pembayaran. Jika sudah membayar, kirim bukti agar kami cocokkan dengan transaksi masuk.':o.status==='PAID'?'sudah terverifikasi dan masuk antrean pemrosesan.':o.status==='PROCESSING'?'sedang diproses oleh tim SLF.':o.status==='COMPLETED'?'telah selesai. Terima kasih telah mendukung SLF.':'sedang kami periksa.';return 'Halo '+o.minecraft_name+', ini admin SLF. Pesanan '+o.id+' ('+o.product_name+', '+idr(o.total)+') '+s+'';}
  function orderSummary(o){return ['SLF STORE — RINGKASAN PESANAN','Nomor: '+o.id,'Tanggal: '+new Date(o.created_at).toLocaleString('id-ID'),'Pemain: '+o.minecraft_name+' ('+o.platform+')','WhatsApp: '+o.whatsapp,'Produk: '+o.product_name,'Subtotal: '+idr(o.subtotal),'Diskon: '+idr(o.discount),'Total: '+idr(o.total),'Status: '+(statusLabels[o.status]||o.status),'Catatan: '+(o.details?.buyerNote||'—')].join('\n');}
  const ticketStatusLabels={WAITING_PAYMENT:'Menunggu transaksi selesai',ACTIVE:'Aktif · belum digunakan',PENDING:'Pending · diajukan member',COMPLETED:'Selesai · terpakai',CANCELLED:'Dibatalkan'};
  async function loadTickets(){
    setError('tickets-error','');
    try{
      const data=await api('/api/admin/tickets');
      allTickets=data.tickets||[];
      knownTicketIds=new Set(allTickets.map(t=>t.id));
      firstTicketLoad=false;
      renderTickets();
    }catch(e){setError('tickets-error',e.message);}
  }
  function renderTickets(){
    const root=$('tickets-list');if(!root)return;root.replaceChildren();
    const query=$('ticket-search').value.trim().toLowerCase(), status=$('ticket-status-filter').value;
    const list=allTickets.filter(t=>{
      const hay=[t.id,t.order_id,t.minecraft_name,t.product_name,t.whatsapp,t.status].join(' ').toLowerCase();
      return (!query||hay.includes(query))&&(status==='ALL'||t.status===status);
    });
    if(!list.length){root.innerHTML='<div class="empty">Tidak ada tiket yang cocok dengan filter.</div>';return;}
    list.forEach(t=>{
      const card=document.createElement('article');card.className='admin-list-card';
      const h=document.createElement('h3');h.textContent=t.id+' · '+t.minecraft_name;
      const state=document.createElement('span');state.className='admin-status';state.textContent=ticketStatusLabels[t.status]||t.status;
      const details=document.createElement('p');details.textContent=t.product_name+' · Pesanan '+t.order_id+' · '+idr(t.total);
      const dates=document.createElement('p');dates.className='admin-muted';dates.textContent='Dibeli: '+new Date(t.created_at).toLocaleString('id-ID')+' · Diajukan: '+(t.submitted_at?new Date(t.submitted_at).toLocaleString('id-ID'):'—')+' · Selesai: '+(t.completed_at?new Date(t.completed_at).toLocaleString('id-ID'):'—');
      const contact=document.createElement('p');contact.textContent='WhatsApp: '+(t.whatsapp||'—')+' · Status transaksi: '+(statusLabels[t.order_status]||t.order_status);
      card.append(h,state,details,dates,contact);
      const actions=document.createElement('div');actions.className='admin-inline-actions';
      const copy=document.createElement('button');copy.type='button';copy.className='btn btn-quiet';copy.textContent='Salin ID tiket';copy.addEventListener('click',()=>copyText(t.id,'Nomor tiket tersalin.'));actions.append(copy);
      if(t.status==='PENDING'){
        const done=document.createElement('button');done.type='button';done.className='btn btn-gold';done.textContent='Tandai selesai';done.addEventListener('click',async()=>{if(!confirm('Proses re-entry untuk '+t.minecraft_name+' sudah benar-benar selesai?'))return;done.disabled=true;try{await api('/api/admin/ticket-status',{method:'POST',body:JSON.stringify({ticketId:t.id,status:'COMPLETED'})});await loadTickets();showToast('Tiket ditandai selesai.');}catch(e){showAdminError(e.message);done.disabled=false;}});actions.append(done);
        const reopen=document.createElement('button');reopen.type='button';reopen.className='btn btn-quiet';reopen.textContent='Kembalikan aktif';reopen.addEventListener('click',async()=>{if(!confirm('Kembalikan tiket ini ke status Aktif agar member bisa mengajukan lagi?'))return;reopen.disabled=true;try{await api('/api/admin/ticket-status',{method:'POST',body:JSON.stringify({ticketId:t.id,status:'ACTIVE'})});await loadTickets();showToast('Tiket dikembalikan ke Aktif.');}catch(e){showAdminError(e.message);reopen.disabled=false;}});actions.append(reopen);
      } else if(t.status==='COMPLETED'){
        const reopen=document.createElement('button');reopen.type='button';reopen.className='btn btn-quiet';reopen.textContent='Pulihkan ke aktif';reopen.addEventListener('click',async()=>{if(!confirm('Pulihkan tiket yang sudah selesai ke status Aktif? Gunakan hanya jika status sebelumnya keliru.'))return;reopen.disabled=true;try{await api('/api/admin/ticket-status',{method:'POST',body:JSON.stringify({ticketId:t.id,status:'ACTIVE'})});await loadTickets();showToast('Tiket dipulihkan.');}catch(e){showAdminError(e.message);reopen.disabled=false;}});actions.append(reopen);
      }
      card.append(actions);root.append(card);
    });
  }

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
    const jobs={tickets:loadTickets,products:loadProducts,promos:loadPromos,customers:loadCustomers,reports:loadReports,activity:loadActivity,support:loadSupport,announcements:loadAnnouncements,notes:loadNotes,finance:loadFinance,'site-content':loadSiteContent,investment:loadInvestment,access:loadAccess};
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
    $('promo-expiry').value=toLocalDateTime(p.expires_at);$('promo-form-title').textContent='Edit '+p.code;
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
        const meta=document.createElement('p');meta.className='admin-muted';meta.textContent=new Date(a.created_at).toLocaleString('id-ID')+' · Oleh: '+(a.actor==='owner'?'Owner':'Admin')+' · '+(a.entity_id||'—');
        const details=document.createElement('p');details.textContent=JSON.stringify(a.details||{});
        card.append(h,meta,details);root.append(card);
      });
    }catch(e){setError('activity-error',e.message);}
  }
  async function loadSupport(manual=false){
    setError('support-error','');
    try{
      const d=await api('/api/admin/support');
      const nextTickets=d.tickets||[];
      const newTickets=nextTickets.filter(t=>!knownTicketIds.has(t.id));
      if(!firstTicketLoad&&newTickets.length)notifyNewTickets(newTickets);
      nextTickets.forEach(t=>knownTicketIds.add(t.id));
      firstTicketLoad=false;
      allTickets=nextTickets;renderSupport();
      if(manual)showToast('Tiket bantuan diperbarui.');
    }catch(e){setError('support-error',e.message);}
  }
  function notifyNewTickets(tickets){
    if('Notification' in window&&Notification.permission==='granted'){
      tickets.forEach(t=>new Notification('Tiket bantuan baru · SLF',{body:t.id+' · '+t.player_name+' · '+t.subject,tag:t.id}));
    }
    showToast(tickets.length+' tiket bantuan baru masuk.');
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
      if (/^\+?[0-9\s()\-]{8,20}$/.test(t.contact)) {
        const a=document.createElement('a');a.className='btn btn-quiet';a.target='_blank';a.rel='noopener noreferrer';a.href='https://wa.me/'+t.contact.replace(/\D/g,'')+'?text='+encodeURIComponent(replyText);a.textContent='Hubungi via WhatsApp';contactActions.append(a);
      } else if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.contact)) {
        const a=document.createElement('a');a.className='btn btn-quiet';a.href='mailto:'+encodeURIComponent(t.contact)+'?subject='+encodeURIComponent('Tindak lanjut tiket SLF '+t.id)+'&body='+encodeURIComponent(replyText);a.textContent='Hubungi via email';contactActions.append(a);
      }
      const copyTicket=document.createElement('button');copyTicket.type='button';copyTicket.className='btn btn-quiet';copyTicket.textContent='Salin detail tiket';
      copyTicket.addEventListener('click',()=>copyText('Tiket '+t.id+'\nPemain: '+t.player_name+'\nKontak: '+t.contact+'\nSubjek: '+t.subject+'\nPesan: '+t.message+'\nBalasan admin: '+(t.admin_reply||'—'),'Detail tiket tersalin.'));
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

  function applyRole(){
    const owner=currentRole==='owner';
    $('role-pill').textContent=owner?'OWNER · akses penuh':'ADMIN · terbatas';
    $('role-pill').style.color=owner?'var(--gold)':'var(--purple)';
    document.querySelectorAll('[data-owner-only="true"]').forEach(button=>{button.hidden=!owner;});
    if(!owner&&['products','promos','reports','finance','site-content','investment','access'].includes(activeTab)){
      activeTab='orders';
      document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));
      ['orders','tickets','reviews','products','promos','customers','reports','activity','support','announcements','notes','finance','site-content','investment','access'].forEach(name=>{const section=$(name+'-tab');if(section)section.hidden=name!==activeTab;});
    }
  }
  function updateAccessStatus(auth){
    ownerSecretConfigured=Boolean(auth.ownerSecretConfigured);
    if(!$('access-status'))return;
    if(!ownerSecretConfigured){
      $('access-status').innerHTML='<p class="admin-danger-note"><b>Status penting:</b> OWNER_SECRET belum terdeteksi. Untuk sementara, ADMIN_SECRET lama masih memiliki hak Owner.</p><p>Setel OWNER_SECRET di Cloudflare terlebih dahulu. Setelah itu, ADMIN_SECRET berubah menjadi akses Admin terbatas.</p>';
      return;
    }
    if(!auth.adminSecretConfigured || !auth.secretsDistinct){
      $('access-status').innerHTML='<p class="admin-danger-note"><b>Konfigurasi belum aman:</b> OWNER_SECRET dan ADMIN_SECRET harus diisi dan nilainya wajib berbeda. Jika sama, sistem menolak login karena tidak bisa memisahkan role.</p><p>Buat dua rahasia berbeda di Cloudflare, simpan, lalu coba masuk lagi.</p>';
      return;
    }
    $('access-status').innerHTML='<p><b>Status:</b> <span class="admin-status">Owner/Admin terpisah</span></p><p>Mode saat ini memisahkan rahasia Owner dan Admin. Jangan bagikan OWNER_SECRET kepada staf.</p>';
  }
  async function loadAccess(){
    try{const auth=await api('/api/admin/me');currentRole=auth.role;updateAccessStatus(auth);applyRole();}
    catch(e){setError('admin-error',e.message);}
  }

  async function loadNotes(){
    setError('notes-error','');
    try{const d=await api('/api/admin/notes');allNotes=d.notes||[];renderNotes();}
    catch(e){setError('notes-error',e.message);}
  }
  function renderNotes(){
    const root=$('notes-list');root.replaceChildren();
    if(!allNotes.length){root.innerHTML='<div class="empty">Belum ada catatan tim.</div>';return;}
    const priorities={LOW:'Rendah',MEDIUM:'Normal',HIGH:'Tinggi'};
    allNotes.forEach(n=>{
      const card=document.createElement('article');card.className='admin-list-card';
      const h=document.createElement('h3');h.textContent=n.title;
      const meta=document.createElement('p');meta.className='admin-muted';meta.textContent=n.category+' · Prioritas '+(priorities[n.priority]||n.priority)+' · '+(n.created_by==='owner'?'Owner':'Admin')+' · '+new Date(n.created_at).toLocaleString('id-ID');
      const body=document.createElement('p');body.textContent=n.body;
      const state=document.createElement('span');state.className='admin-status';state.textContent=n.status==='DONE'?'Selesai':'Perlu ditindaklanjuti';
      const btn=document.createElement('button');btn.type='button';btn.className=n.status==='DONE'?'btn':'btn btn-gold';btn.textContent=n.status==='DONE'?'Buka kembali':'Tandai selesai';
      btn.addEventListener('click',async()=>{btn.disabled=true;try{await api('/api/admin/notes',{method:'POST',body:JSON.stringify({id:n.id,status:n.status==='DONE'?'OPEN':'DONE'})});await loadNotes();showToast('Catatan diperbarui.');}catch(e){setError('notes-error',e.message);btn.disabled=false;}});
      card.append(h,meta,body,state,document.createElement('br'),btn);root.append(card);
    });
  }
  async function saveNote(e){
    e.preventDefault();setError('notes-error','');
    const payload={title:$('note-title').value.trim(),category:$('note-category').value,priority:$('note-priority').value,body:$('note-body').value.trim()};
    const btn=$('note-form').querySelector('[type=submit]');btn.disabled=true;
    try{await api('/api/admin/notes',{method:'POST',body:JSON.stringify(payload)});$('note-form').reset();$('note-priority').value='MEDIUM';await loadNotes();showToast('Catatan tersimpan.');}
    catch(err){setError('notes-error',err.message);}finally{btn.disabled=false;}
  }

  function syncFinanceCategories(){
    const kind=$('finance-kind').value;
    const old=$('finance-category').value;
    const categories=kind==='INCOME'
      ?[['Donasi','Donasi'],['Sponsor','Sponsor'],['Pemasukan lain','Pemasukan lain']]
      :[['Pengembalian dana','Pengembalian dana'],['Hosting','Hosting'],['Domain','Domain'],['Plugin dan layanan','Plugin dan layanan'],['Promosi','Promosi'],['Biaya transaksi','Biaya transaksi'],['Operasional lain','Operasional lain']];
    $('finance-category').replaceChildren();
    categories.forEach(([value,label])=>$('finance-category').add(new Option(label,value)));
    if(categories.some(x=>x[0]===old))$('finance-category').value=old;
  }
  async function loadFinance(){
    if(currentRole!=='owner'){setError('finance-error','Tab keuangan hanya tersedia untuk Owner.');return;}
    setError('finance-error','');
    const params=new URLSearchParams();if($('finance-from').value)params.set('from',$('finance-from').value);if($('finance-to').value)params.set('to',$('finance-to').value);
    try{const d=await api('/api/admin/finance'+(params.size?'?'+params.toString():''));currentFinance=d;allFinanceEntries=d.entries||[];renderFinance();showToast('Laporan kas diperbarui.');}
    catch(e){setError('finance-error',e.message);}
  }
  function renderFinance(){
    const s=currentFinance.summary||{};
    $('finance-stats').innerHTML=[
      ['Penjualan Store',idr(s.storeSales||0)],
      ['Pemasukan lain',idr(s.otherIncome||0)],
      ['Total pengeluaran',idr(s.expenses||0)],
      ['Total pemasukan',idr(s.allIncome||0)],
      ['Surplus kas estimasi',idr(s.estimatedNet||0)],
      ['Order terverifikasi',Number(s.paidOrders||0)]
    ].map(([k,v])=>'<div class="admin-stat"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('');
    const root=$('finance-entries');root.replaceChildren();
    if(!allFinanceEntries.length){root.innerHTML='<div class="empty">Belum ada transaksi kas manual di rentang ini. Penjualan Store tetap dihitung otomatis.</div>';}
    else{
      const wrap=document.createElement('div');wrap.className='admin-table-wrap';
      const table=document.createElement('table');table.className='admin-data-table';
      const thead=document.createElement('thead');thead.innerHTML='<tr><th>Tanggal</th><th>Jenis</th><th>Kategori / Uraian</th><th>Nominal</th><th>Referensi</th><th>Status</th><th>Aksi</th></tr>';table.append(thead);
      const tbody=document.createElement('tbody');
      allFinanceEntries.forEach(x=>{
        const tr=document.createElement('tr');if(x.status==='VOIDED')tr.className='voided';
        const vals=[x.entry_date,x.kind==='INCOME'?'Masuk':'Keluar',x.category+' · '+x.description,idr(x.amount),x.reference||'—',x.status==='POSTED'?'Tercatat':'Dibatalkan'];
        vals.forEach(v=>{const td=document.createElement('td');td.textContent=String(v??'—');tr.append(td);});
        const act=document.createElement('td');
        if(x.status==='POSTED'){
          const btn=document.createElement('button');btn.type='button';btn.className='btn btn-quiet';btn.textContent='Batalkan catatan';
          btn.addEventListener('click',async()=>{if(!confirm('Tandai catatan '+x.id+' sebagai dibatalkan? Catatan tidak dihapus dari audit.'))return;btn.disabled=true;try{await api('/api/admin/finance',{method:'POST',body:JSON.stringify({id:x.id,void:true})});await loadFinance();showToast('Catatan kas dibatalkan dan tetap tersimpan di audit.');}catch(e){setError('finance-error',e.message);btn.disabled=false;}});
          act.append(btn);
        }else act.textContent='—';
        tr.append(act);tbody.append(tr);
      });
      table.append(tbody);wrap.append(table);root.append(wrap);
    }
    $('finance-daily').innerHTML=makeTable(['Tanggal','Penjualan Store','Pemasukan lain','Pengeluaran','Surplus estimasi'],(currentFinance.daily||[]).map(x=>[x.day,idr(x.storeSales),idr(x.otherIncome),idr(x.expenses),idr(x.estimatedNet)]));
  }
  async function saveFinance(e){
    e.preventDefault();setError('finance-error','');
    const payload={kind:$('finance-kind').value,entryDate:$('finance-date').value,category:$('finance-category').value,amount:Number($('finance-amount').value),description:$('finance-description').value.trim(),reference:$('finance-reference').value.trim()};
    const btn=$('finance-form').querySelector('[type=submit]');btn.disabled=true;
    try{await api('/api/admin/finance',{method:'POST',body:JSON.stringify(payload)});$('finance-form').reset();$('finance-date').value=new Date().toISOString().slice(0,10);syncFinanceCategories();await loadFinance();showToast('Transaksi kas dicatat.');}
    catch(err){setError('finance-error',err.message);}finally{btn.disabled=false;}
  }
  function exportFinanceCsv(){
    const s=currentFinance.summary||{};
    const from=currentFinance.from||$('finance-from').value||'';
    const to=currentFinance.to||$('finance-to').value||'';
    const rows=[
      ['ID','Tanggal / Periode','Jenis','Kategori','Uraian','Nominal','Referensi','Status','Dibuat Oleh'],
      ['STORE-SALES-SUMMARY',from+' s.d. '+to,'INCOME','Penjualan Store terverifikasi','Ringkasan omzet pesanan terverifikasi selama periode ini',Number(s.storeSales||0),'Sumber otomatis: order terverifikasi','SUMMARY','system']
    ];
    allFinanceEntries.forEach(x=>rows.push([x.id,x.entry_date,x.kind,x.category,x.description,x.amount,x.reference||'',x.status,x.created_by]));
    const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='slf-laporan-kas-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);showToast('CSV kas dibuat. Penjualan Store di baris pertama adalah ringkasan periode, bukan transaksi individu.');
  }

  const cmsSlotsByPage={home:[['home.lead','Deskripsi utama'],['home.zoneLead','Pengantar wilayah'],['home.storeLead','Pengantar Store']],store:[['store.lead','Deskripsi utama']],wiki:[['wiki.lead','Pengantar Wiki']]};
  function syncCmsForm(){
    const kind=$('cms-kind').value;
    if(kind!==lastCmsKind && $('cms-id').value){
      // Do not let a user accidentally convert an existing text slot into a card or vice versa.
      $('cms-id').value='';
      $('cms-form-title').textContent=kind==='slot'?'Tambah / edit konten':'Tambah kartu informasi';
    }
    lastCmsKind=kind;
    const slot=kind==='slot';
    $('cms-slot-wrap').hidden=!slot;$('cms-title-wrap').hidden=slot;
    if(slot)syncCmsSlots();
  }
  function syncCmsSlots(){
    const page=$('cms-page').value, old=$('cms-slot').value;
    const options=cmsSlotsByPage[page]||[];
    $('cms-slot').replaceChildren();
    options.forEach(([value,label])=>{$('cms-slot').add(new Option(label,value));});
    if(options.some(x=>x[0]===old))$('cms-slot').value=old;
    if($('cms-kind').value==='slot')$('cms-slot-wrap').hidden=false;
  }
  $('cms-slot').addEventListener('change',()=>{const prefix=$('cms-slot').value.split('.')[0];if(['home','store','wiki'].includes(prefix))$('cms-page').value=prefix;});
  async function loadSiteContent(){
    if(currentRole!=='owner'){setError('cms-error','Editor Website hanya tersedia untuk Owner.');return;}
    setError('cms-error','');
    try{const d=await api('/api/admin/site-content');allCmsItems=d.items||[];renderSiteContent();}
    catch(e){setError('cms-error',e.message);}
  }
  function renderSiteContent(){
    const root=$('cms-list');root.replaceChildren();
    if(!allCmsItems.length){root.innerHTML='<div class="empty">Belum ada perubahan teks atau kartu konten.</div>';return;}
    allCmsItems.forEach(x=>{
      const card=document.createElement('article');card.className='admin-list-card';
      const h=document.createElement('h3');h.textContent=x.kind==='slot'?'Slot teks · '+x.slot_key:x.title;
      const meta=document.createElement('p');meta.className='admin-muted';meta.textContent=x.page.toUpperCase()+' · '+(x.active?'Aktif':'Nonaktif')+' · '+(x.starts_at||'mulai sekarang')+' · '+(x.ends_at||'tanpa jadwal akhir');
      const body=document.createElement('p');body.textContent=x.body;
      const actions=document.createElement('div');actions.className='admin-inline-actions';
      const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='Edit';edit.addEventListener('click',()=>editCmsItem(x.id));
      actions.append(edit);
      if(x.kind==='card'){const del=document.createElement('button');del.type='button';del.className='btn btn-quiet';del.textContent='Hapus kartu';del.addEventListener('click',async()=>{if(!confirm('Hapus kartu konten ini dari website?'))return;del.disabled=true;try{await api('/api/admin/site-content?id='+encodeURIComponent(x.id),{method:'DELETE'});await loadSiteContent();showToast('Kartu konten dihapus.');}catch(e){setError('cms-error',e.message);del.disabled=false;}});actions.append(del);}
      card.append(h,meta,body,actions);root.append(card);
    });
  }
  function editCmsItem(id){
    const x=allCmsItems.find(v=>v.id===id);if(!x)return;
    $('cms-id').value=x.id;$('cms-kind').value=x.kind;lastCmsKind=x.kind;$('cms-page').value=x.page;syncCmsSlots();
    if(x.slot_key)$('cms-slot').value=x.slot_key;
    $('cms-title').value=x.title||'';$('cms-body').value=x.body;$('cms-active').value=x.active?'1':'0';
    $('cms-start').value=toLocalDateTime(x.starts_at);$('cms-end').value=toLocalDateTime(x.ends_at);
    $('cms-form-title').textContent='Edit konten';syncCmsForm();$('cms-form').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function resetCmsForm(){
    $('cms-form').reset();$('cms-id').value='';$('cms-kind').value='slot';lastCmsKind='slot';$('cms-page').value='home';$('cms-active').value='1';
    $('cms-form-title').textContent='Tambah / edit konten';syncCmsSlots();syncCmsForm();setError('cms-error','');
  }
  async function saveCms(e){
    e.preventDefault();setError('cms-error','');
    const kind=$('cms-kind').value;
    const payload={id:$('cms-id').value||undefined,kind,page:$('cms-page').value,slotKey:kind==='slot'?$('cms-slot').value:undefined,title:kind==='card'?$('cms-title').value.trim():'',body:$('cms-body').value.trim(),active:$('cms-active').value==='1',startsAt:$('cms-start').value?new Date($('cms-start').value).toISOString():null,endsAt:$('cms-end').value?new Date($('cms-end').value).toISOString():null};
    const btn=$('cms-form').querySelector('[type=submit]');btn.disabled=true;
    try{await api('/api/admin/site-content',{method:'POST',body:JSON.stringify(payload)});resetCmsForm();await loadSiteContent();showToast('Konten tersimpan. Muat ulang halaman publik untuk melihat hasilnya.');}
    catch(err){setError('cms-error',err.message);}finally{btn.disabled=false;}
  }

  async function loadInvestment(){
    if(currentRole!=='owner'){setError('investment-error','Simulasi pendanaan hanya tersedia untuk Owner.');return;}
    setError('investment-error','');
    try{
      const d=await api('/api/admin/investment');investmentPlan=d.plan;
      $('investment-unit-price').value=investmentPlan.unit_price;$('investment-units').value=investmentPlan.total_units;
      $('investment-share').value=investmentPlan.profit_share_pct;$('investment-months').value=investmentPlan.lock_months;
      $('investment-start').value=investmentPlan.start_date||'';$('investment-status').value=investmentPlan.status;
      $('investment-notes').value=investmentPlan.notes||'';renderInvestmentCalculation();
    }catch(e){setError('investment-error',e.message);}
  }
  async function saveInvestment(e){
    e.preventDefault();setError('investment-error','');
    const payload={unitPrice:Number($('investment-unit-price').value),totalUnits:Number($('investment-units').value),profitSharePct:Number($('investment-share').value),lockMonths:Number($('investment-months').value),startDate:$('investment-start').value||null,status:$('investment-status').value,notes:$('investment-notes').value.trim()};
    const btn=$('investment-form').querySelector('[type=submit]');btn.disabled=true;
    try{await api('/api/admin/investment',{method:'POST',body:JSON.stringify(payload)});await loadInvestment();showToast('Parameter simulasi tersimpan sebagai draf internal.');}
    catch(e){setError('investment-error',e.message);}finally{btn.disabled=false;}
  }
  function renderInvestmentCalculation(){
    const unit=Number($('investment-unit-price').value)||0,units=Number($('investment-units').value)||0,share=Number($('investment-share').value)||0,profit=Math.max(0,Number($('investment-profit-input').value)||0);
    const target=unit*units,pool=Math.floor(profit*share/100),perUnit=units?Math.floor(pool/units):0;
    $('investment-stats').innerHTML=[['Target dana (simulasi)',idr(target)],['Unit direncanakan',units],['Periode',Number($('investment-months').value||0)+' bulan']].map(([k,v])=>'<div class="admin-stat"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('');
    $('investment-calculation').innerHTML=[['Keuntungan bersih simulasi',idr(profit)],['Pool '+share+'% (jika benar-benar untung)',idr(pool)],['Per unit dari pool',idr(perUnit)]].map(([k,v])=>'<div class="admin-stat"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('');
  }

  function initReportDates(){
    const today=new Date(),from=new Date(Date.now()-29*86400000),format=d=>d.toISOString().slice(0,10);
    if(!$('report-to').value)$('report-to').value=format(today);
    if(!$('report-from').value)$('report-from').value=format(from);
    if(!$('finance-to').value)$('finance-to').value=format(today);
    if(!$('finance-from').value)$('finance-from').value=format(from);
    if(!$('finance-date').value)$('finance-date').value=format(today);
    syncCmsSlots();syncCmsForm();syncFinanceCategories();
  }
  initReportDates();

  if(sessionStorage.getItem(secretKey))loadOrders();
  setInterval(()=>{if(sessionStorage.getItem(secretKey)&&!document.hidden){loadOrders();loadSupport();if(activeTab==='tickets')loadTickets();}},45000);
})();