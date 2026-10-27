(() => {
  'use strict';
  const cfg = window.SLF_STORE_CONFIG;
  const $ = (id) => document.getElementById(id);
  const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
  let selected = null;

  $('year').textContent = new Date().getFullYear();
  function renderProducts(){
    const productRoot = $('products');
    cfg.products.forEach((p) => {
      const article = document.createElement('article'); article.className = 'product'; article.dataset.product = p.id;
      article.innerHTML = `<div class="iconbox" aria-hidden="true"></div><span class="pill"></span><h3></h3><div class="price"></div><p></p><div class="subtle"></div><button class="btn btn-quiet" type="button">Pilih produk</button>`;
      article.querySelector('.iconbox').textContent = p.icon;
      article.querySelector('.pill').textContent = p.tag;
      article.querySelector('h3').textContent = p.name;
      article.querySelector('.price').textContent = rupiah(p.price);
      article.querySelector('p').textContent = p.description;
      article.querySelector('.subtle').textContent = p.note;
      article.querySelector('button').addEventListener('click', () => chooseProduct(p.id, true));
      productRoot.appendChild(article);
    });
  }
  async function initProducts(){
    try {
      const response = await fetch('/api/store-products', { cache:'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.products)) {
          cfg.products = data.products.map(p => ({ ...(cfg.products.find(old => old.id === p.id) || {}), ...p }));
        }
      }
    } catch (_) { /* Gunakan katalog cadangan statis bila API belum tersedia. */ }
    renderProducts();
  }
  initProducts();
  cfg.rankColors.forEach(c => $('rank-color').add(new Option(c.label, c.value)));
  cfg.rankStyles.forEach(s => $('rank-style').add(new Option(s.label, s.value)));

  function chooseProduct(id, scrollToForm) {
    selected = cfg.products.find(p => p.id === id) || null;
    document.querySelectorAll('.product').forEach(el => el.classList.toggle('selected', el.dataset.product === id));
    $('product-id').value = selected ? selected.id : '';
    $('summary-product').textContent = selected ? selected.name : 'Belum dipilih';
    $('summary-price').textContent = rupiah(selected ? selected.price : 0);
    const promo = $('promo').value.trim();
    $('summary-promo').textContent = promo ? 'Dicek saat checkout' : '—';
    $('summary-total').textContent = rupiah(selected ? selected.price : 0);
    const rankIncluded = !!selected && ['CUSTOM_RANK', 'VIP_PLUS'].includes(selected.id);
    $('custom-rank-fields').hidden = !rankIncluded;
    $('vip-fields').hidden = !selected || selected.id !== 'VIP_PLUS';
    $('ticket-fields').hidden = !selected || !selected.id.startsWith('REENTRY_');
    $('rank-name').required = rankIncluded;
    $('rank-color').required = rankIncluded;
    $('rank-style').required = rankIncluded;
    $('submit-order').disabled = !selected;
    updateRankPreview();
    if (scrollToForm) $('pesan').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function updateRankPreview() {
    const name = $('rank-name').value.trim() || 'STARLIGHT';
    const color = $('rank-color').value || '#B98CF4';
    const style = $('rank-style').value;
    const preview = $('rank-preview'); preview.textContent = `[${name}] NamaPemain`; preview.style.color = color;
    preview.style.fontWeight = style.includes('bold') ? '800' : '500'; preview.style.fontStyle = style.includes('italic') ? 'italic' : 'normal';
  }
  ['rank-name','rank-color','rank-style'].forEach(id => $(id).addEventListener('input', updateRankPreview));
  $('promo').addEventListener('input', () => {
    $('summary-promo').textContent = $('promo').value.trim() ? 'Dicek saat checkout' : '—';
  });
  $('order-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = $('form-error'); error.textContent = ''; error.classList.remove('show');
    if (!selected) { showError('Pilih satu produk terlebih dahulu.'); return; }
    const btn = $('submit-order'); btn.disabled = true; btn.textContent = 'Membuat pesanan…';
    const waPhone = String(cfg.adminWhatsApp || '').replace(/\D/g, '');
    const waWindow = waPhone ? window.open('about:blank', '_blank') : null;
    const body = {
      minecraftName: $('minecraft-name').value.trim(), platform: $('platform').value,
      whatsapp: $('whatsapp').value.trim(), email: $('email').value.trim(), promoCode: $('promo').value.trim().toUpperCase(),
      productId: selected.id, agree: $('agree').checked,
      details: ['CUSTOM_RANK', 'VIP_PLUS'].includes(selected.id) ? {
        rankName: $('rank-name').value.trim(), rankColor: $('rank-color').value, rankStyle: $('rank-style').value,
        buyerNote: selected.id === 'VIP_PLUS' ? $('vip-note').value.trim() : ''
      } : { buyerNote: $('ticket-note-input').value.trim() }
    };
    try {
      const response = await fetch('/api/orders/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Pesanan belum bisa dibuat. Periksa konfigurasi server dan coba lagi.');
      if (!data.orderUrl) throw new Error('Server tidak mengembalikan tautan status pesanan.');
      if (waPhone) {
        const lines = ['Halo Admin SLF, saya membuat pesanan Store.', 'Nomor pesanan: ' + data.orderId, 'Pemain: ' + body.minecraftName + ' (' + body.platform + ')', 'Produk: ' + selected.name, 'Total: ' + rupiah(data.total), body.details.rankName ? ('Custom Rank: [' + body.details.rankName + '] warna ' + body.details.rankColor + ', gaya ' + body.details.rankStyle) : '', 'Tautan status: ' + data.orderUrl, 'Mohon kirim QRIS DANA untuk pembayaran. Saya akan membayar sesuai nominal dan mengirim bukti di chat ini.'].filter(Boolean).join('\n');
        const waUrl = 'https://wa.me/' + waPhone + '?text=' + encodeURIComponent(lines);
        if (waWindow) waWindow.location.href = waUrl; else window.open(waUrl, '_blank', 'noopener,noreferrer');
      }
      location.href = data.orderUrl;
    } catch (e) {
      if (waWindow && !waWindow.closed) waWindow.close();
      showError(e.message || 'Koneksi gagal. Periksa internet dan coba kembali.');
      btn.disabled = false; btn.textContent = 'Buat pesanan & WhatsApp ↗';
    }
  });
  function showError(message) { const e = $('form-error'); e.textContent = message; e.classList.add('show'); e.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

  async function loadReviews() {
    try {
      const r = await fetch('/api/reviews'); if (!r.ok) return;
      const d = await r.json();
      $('review-average').textContent = d.count ? Number(d.average).toFixed(1) : '—';
      $('review-stars').textContent = d.count ? '★'.repeat(Math.round(d.average)) + '☆'.repeat(5 - Math.round(d.average)) : '☆☆☆☆☆';
      $('review-count').textContent = d.count ? `${d.count} ulasan pembeli terverifikasi` : 'Belum ada ulasan';
      const root = $('reviews-list'); root.replaceChildren();
      if (!d.reviews || !d.reviews.length) { root.innerHTML = '<div class="empty">Belum ada ulasan. Pembeli bisa memberi rating setelah admin menyelesaikan pesanan.</div>'; return; }
      d.reviews.forEach(review => {
        const card = document.createElement('article'); card.className = 'review';
        const stars = document.createElement('div'); stars.className = 'stars'; stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5-review.rating);
        const p = document.createElement('p'); p.textContent = review.comment || 'Pembeli tidak menambahkan komentar.';
        const name = document.createElement('strong'); name.textContent = review.playerName || 'Pemain SLF';
        const time = document.createElement('div'); time.className = 'subtle'; time.textContent = new Date(review.createdAt).toLocaleDateString('id-ID');
        card.append(stars, p, name, time); if (review.adminReply) { const reply = document.createElement('div'); reply.className = 'review-admin-reply'; reply.style.cssText = 'margin-top:12px;padding:12px;border-left:3px solid #e8c47c;background:#21192c;border-radius:0 10px 10px 0'; const label = document.createElement('strong'); label.textContent = 'Balasan ' + (review.adminName || 'Tim SLF'); const text = document.createElement('p'); text.style.margin = '5px 0 0'; text.textContent = review.adminReply; reply.append(label, text); card.appendChild(reply); } root.appendChild(card);
      });
    } catch (_) { /* Ulasan boleh tidak tampil bila API belum dipasang. */ }
  }
  loadReviews();
  loadAnnouncements();

  async function loadAnnouncements(){
    try{
      const response=await fetch('/api/announcements',{cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json(),items=data.announcements||[];
      if(!items.length)return;
      const section=$('store-announcements'),root=$('announcement-list');
      root.replaceChildren();
      items.forEach(item=>{
        const card=document.createElement('article');card.className='product';
        const label=document.createElement('span');label.className='pill';label.textContent='Pengumuman SLF';
        const title=document.createElement('h3');title.textContent=item.title;
        const body=document.createElement('p');body.textContent=item.body;
        const date=document.createElement('div');date.className='subtle';date.textContent=new Date(item.created_at).toLocaleDateString('id-ID');
        card.append(label,title,body,date);root.append(card);
      });
      section.hidden=false;
    }catch(_){/* Pengumuman tidak mengganggu checkout bila API belum aktif. */}
  }
  $('support-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const error=$('support-form-error'),result=$('support-result'),btn=$('support-submit');
    error.textContent='';error.classList.remove('show');result.textContent='';
    btn.disabled=true;btn.textContent='Mengirim tiket…';
    const body={playerName:$('support-player').value.trim(),contact:$('support-contact').value.trim(),category:$('support-category').value,subject:$('support-subject').value.trim(),message:$('support-message').value.trim(),website:$('support-website').value};
    try{
      const response=await fetch('/api/support/tickets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Tiket belum dapat dikirim.');
      result.textContent='Tiket berhasil dibuat: '+data.ticketId+'. Simpan nomor ini untuk tindak lanjut.';
      $('support-form').reset();
    }catch(e){error.textContent=e.message;error.classList.add('show');}
    finally{btn.disabled=false;btn.textContent='Kirim tiket bantuan';}
  });
})();
