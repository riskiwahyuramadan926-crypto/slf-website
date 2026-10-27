(() => {
  'use strict';
  const $=id=>document.getElementById(id), p=new URLSearchParams(location.search), id=p.get('id'), key=p.get('key');
  const rp=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
  let timer=null;
  $('year').textContent=new Date().getFullYear();
  if(!id||!key){fail('Tautan status tidak lengkap. Buka tautan pesanan yang diberikan setelah checkout.');return;}
  const cfg=window.SLF_STORE_CONFIG||{}, phone=String(cfg.adminWhatsApp||'').replace(/\D/g,'');
  if(phone){$('contact-admin').hidden=false;$('contact-admin').href='https://wa.me/'+phone+'?text='+encodeURIComponent('Halo Admin SLF, saya ingin menanyakan pesanan '+id+'.');$('admin-missing').hidden=true;}
  async function refresh(){
    try{
      const r=await fetch('/api/orders/'+encodeURIComponent(id)+'?key='+encodeURIComponent(key),{cache:'no-store'}),d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Pesanan tidak ditemukan atau tautan tidak valid.');
      render(d.order);
      if(['COMPLETED','EXPIRED','CANCELLED'].includes(d.order.status)&&timer){clearInterval(timer);timer=null;}
    }catch(e){fail(e.message||'Tidak dapat mengambil status pesanan.');}
  }
  function render(o){
    const labels={
      PENDING_PAYMENT:['Menunggu pembayaran','Hubungi admin melalui WhatsApp. Admin mengirim QRIS DANA secara manual; periksa nama merchant dan nominal sebelum membayar.',''],
      PAID:['Pembayaran terverifikasi','Admin sudah memeriksa transaksi masuk. Pesanan menunggu pemberian produk di Minecraft.','paid'],
      PROCESSING:['Sedang diproses admin','Pembayaran terverifikasi. Admin sedang memberikan produk secara manual.','paid'],
      COMPLETED:['Pesanan selesai','Admin telah menyelesaikan pesanan. Tautan ulasan satu kali tersedia di bawah.','completed'],
      EXPIRED:['Pesanan kedaluwarsa','Hubungi admin bila masih perlu bantuan.','expired'],
      CANCELLED:['Pesanan dibatalkan','Hubungi admin jika ada pertanyaan.','expired']
    },l=labels[o.status]||['Status pesanan','Status sedang diperiksa.',''];
    $('status-title').textContent=l[0];$('status-copy').textContent=l[1];$('status-pill').textContent=l[0];$('status-pill').className='status-pill '+l[2];
    const meta=$('order-meta');meta.replaceChildren();
    [['Nomor pesanan',o.id],['Produk',o.productName],['Nama Minecraft',o.minecraftName],['Platform',o.platform],['Total',rp(o.total)],['Dibuat',new Date(o.createdAt).toLocaleString('id-ID')]].forEach(([label,value])=>{const item=document.createElement('div'),small=document.createElement('small'),b=document.createElement('b');item.className='meta-item';small.textContent=label;b.textContent=value==null?'—':String(value);item.append(small,b);meta.appendChild(item);});
    $('payment-section').hidden=o.status!=='PENDING_PAYMENT';
    $('review-link-section').hidden=!(o.status==='COMPLETED'&&!o.rated&&o.reviewUrl);
    if(o.reviewUrl)$('review-link').href=o.reviewUrl;
    $('rated-message').hidden=!o.rated;
    if(o.rated)$('review-link-section').hidden=true;
  }
  function fail(m){const e=$('load-error');e.textContent=m;e.classList.add('show');$('status-title').textContent='Belum bisa membuka pesanan';$('status-copy').textContent='Periksa tautan status atau hubungi CS SLF.';}
  refresh();timer=setInterval(refresh,6000);
})();