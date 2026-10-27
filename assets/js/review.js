(() => {
  'use strict';
  const $=id=>document.getElementById(id), p=new URLSearchParams(location.search), id=p.get('id'), key=p.get('key');
  $('year').textContent=new Date().getFullYear();
  function error(m){$('review-error').textContent=m;$('review-error').classList.toggle('show',Boolean(m));}
  async function load(){
    if(!id||!key){error('Tautan ulasan tidak lengkap.');return;}
    try{
      const r=await fetch('/api/orders/'+encodeURIComponent(id)+'?key='+encodeURIComponent(key),{cache:'no-store'}), d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Tautan tidak valid.');
      const o=d.order;
      if(o.rated){$('review-title').textContent='Ulasan sudah dikirim';$('review-copy').textContent='Tautan ini hanya dapat digunakan satu kali.';$('review-used').hidden=false;return;}
      if(o.status!=='COMPLETED'||!o.reviewUrl){$('review-title').textContent='Pesanan belum selesai';$('review-copy').textContent='Ulasan aktif setelah admin menyelesaikan pesanan.';return;}
      $('review-title').textContent='Bagaimana pengalamanmu?';$('review-copy').textContent='Pesanan '+o.id+' · '+o.productName+'. Rating hanya bisa dikirim sekali.';$('review-form').hidden=false;
    }catch(e){error(e.message||'Tidak dapat memeriksa pesanan.');}
  }
  $('review-form').addEventListener('submit',async e=>{
    e.preventDefault();const b=$('submit-review');b.disabled=true;error('');
    try{
      const r=await fetch('/api/reviews',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:id,key,rating:Number($('rating').value),comment:$('review-text').value.trim()})}),d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Rating gagal disimpan.');
      $('review-form').hidden=true;$('review-success').hidden=false;$('review-title').textContent='Terima kasih atas ulasanmu';$('review-copy').textContent='Ulasan berhasil disimpan.';
    }catch(e){error(e.message||'Rating gagal disimpan.');b.disabled=false;}
  });
  load();
})();