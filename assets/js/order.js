(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const id = params.get('id'); const key = params.get('key');
  const rp = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n || 0);
  let lastStatus = null; let orderInfo = null; let pollHandle = null;
  $('year').textContent = new Date().getFullYear();
  if (!id || !key) { fail('Tautan status tidak lengkap. Buka kembali tautan pesanan yang diberikan setelah checkout.'); return; }

  async function refresh() {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`, { cache:'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pesanan tidak ditemukan atau tautannya tidak valid.');
      orderInfo = data.order; render(orderInfo);
      if (['COMPLETED','EXPIRED','CANCELLED'].includes(orderInfo.status) && pollHandle) { clearInterval(pollHandle); pollHandle = null; }
    } catch(e) { fail(e.message || 'Tidak dapat mengambil status pesanan.'); }
  }
  function render(o) {
    const labels = {
      PENDING_PAYMENT: ['Menunggu pembayaran','QRIS siap digunakan. Status akan diperbarui setelah DANA mengirim konfirmasi pembayaran.',''],
      PAID: ['Pembayaran berhasil','Pembayaran telah terverifikasi. Pesanan menunggu admin memberikan produk di Minecraft.','paid'],
      PROCESSING: ['Sedang diproses admin','Pembayaran terverifikasi. Admin sedang memberikan produk secara manual.','paid'],
      COMPLETED: ['Pesanan selesai','Admin sudah menandai pesanan selesai. Kamu dapat memberi rating toko di bawah.','completed'],
      EXPIRED: ['QRIS kedaluwarsa','QRIS tidak lagi berlaku. Buat pesanan baru jika masih ingin membeli.','expired'],
      CANCELLED: ['Pesanan dibatalkan','Pesanan ini dibatalkan. Buat pesanan baru bila masih ingin membeli.','expired']
    };
    const l = labels[o.status] || ['Status pesanan', 'Status pesanan sedang diperiksa.',''];
    $('status-title').textContent = l[0]; $('status-copy').textContent = l[1];
    $('status-pill').textContent = l[0]; $('status-pill').className = `status-pill ${l[2]}`;
    const meta = $('order-meta'); meta.replaceChildren();
    const rows = [['Nomor pesanan',o.id],['Produk',o.productName],['Nama Minecraft',o.minecraftName],['Platform',o.platform],['Total',rp(o.total)],['Dibuat',new Date(o.createdAt).toLocaleString('id-ID')]];
    rows.forEach(([label,value]) => { const item=document.createElement('div');item.className='meta-item';const small=document.createElement('small');small.textContent=label;const b=document.createElement('b');b.textContent=value ?? '—';item.append(small,b);meta.appendChild(item); });
    const showQr = o.status === 'PENDING_PAYMENT'; $('qr-section').hidden = !showQr;
    if (showQr) drawQr(o);
    $('rating-section').hidden = o.status !== 'COMPLETED' || Boolean(o.rated);
    $('rated-message').hidden = !o.rated;
    if (lastStatus !== o.status) { lastStatus = o.status; }
  }
  async function drawQr(o) {
    $('amount-due').textContent = rp(o.total);
    $('expiry-text').textContent = o.expiresAt ? `Batas pembayaran: ${new Date(o.expiresAt).toLocaleString('id-ID')}` : 'Perhatikan masa berlaku yang tertera pada QRIS.';
    const image = $('qr-image'); const render = $('qr-render');
    if (o.qrImage) { image.src = o.qrImage.startsWith('data:') ? o.qrImage : `data:image/png;base64,${o.qrImage}`; image.hidden = false; render.replaceChildren(); return; }
    if (o.qrUrl) { image.src = o.qrUrl; image.hidden = false; render.replaceChildren(); return; }
    image.hidden = true;
    if (o.qrContent && window.QRCode && !render.dataset.value) {
      try { await QRCode.toCanvas(o.qrContent, {width:230,margin:1,errorCorrectionLevel:'M'}, (err, canvas) => { if (!err) render.replaceChildren(canvas); }); render.dataset.value = 'drawn'; }
      catch (_) { render.textContent = 'QR belum bisa ditampilkan. Muat ulang halaman atau hubungi CS.'; }
    } else if (!o.qrContent) { render.textContent = 'QRIS belum diterima dari layanan pembayaran.'; }
  }
  function fail(message) { const e=$('load-error'); e.textContent=message; e.classList.add('show'); $('status-title').textContent='Belum bisa membuka pesanan'; $('status-copy').textContent='Periksa tautan status atau hubungi CS SLF.'; }
  $('rating-form').addEventListener('submit', async event => {
    event.preventDefault(); const err=$('rating-error');err.textContent='';err.classList.remove('show');
    try {
      const res=await fetch('/api/reviews',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:id,key,rating:Number($('rating').value),comment:$('review-text').value.trim()})});
      const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||'Rating gagal disimpan.');
      $('rating-section').hidden=true; $('rated-message').hidden=false; await refresh();
    } catch(e) { err.textContent=e.message;err.classList.add('show'); }
  });
  refresh(); pollHandle=setInterval(refresh,6000);
})();
