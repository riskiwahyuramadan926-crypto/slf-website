(() => {
  'use strict';
  const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
  const id=params.get('id')||'', ticketId=params.get('ticket')||'', key=params.get('key')||'';
  const isTicketReview=Boolean(ticketId);
  $('year').textContent=new Date().getFullYear();
  function error(message){$('review-error').textContent=message;$('review-error').classList.toggle('show',Boolean(message));}
  function showUsed(){ $('review-title').textContent='Ulasan sudah dikirim';$('review-copy').textContent='Slot ulasan ini hanya dapat digunakan satu kali.';$('review-used').hidden=false; }
  async function load(){
    if((!id&&!ticketId)||key.length<32){error('Tautan ulasan tidak lengkap atau tidak valid.');return;}
    try{
      let response,data;
      if(isTicketReview){
        response=await fetch('/api/reviews?ticketId='+encodeURIComponent(ticketId)+'&key='+encodeURIComponent(key),{cache:'no-store'});
        data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Tautan ulasan layanan tiket tidak valid.');
        const ticket=data.ticket;
        $('review-title').textContent='Nilai layanan pemakaian tiket';
        $('review-copy').textContent='Tiket '+ticket.id+' · '+ticket.productName+'. Ulasan ini khusus untuk proses layanan Admin SLF.';
        if(ticket.rated){showUsed();return;}
      }else{
        response=await fetch('/api/orders/'+encodeURIComponent(id)+'?key='+encodeURIComponent(key),{cache:'no-store'});
        data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Tautan tidak valid.');
        const order=data.order;
        $('review-title').textContent='Bagaimana pengalaman pembelianmu?';
        $('review-copy').textContent='Pesanan '+order.id+' · '+order.productName+'. Ulasan pembelian hanya dapat dikirim sekali.';
        if(order.rated){showUsed();return;}
        if(order.status!=='COMPLETED'||!order.reviewUrl){$('review-title').textContent='Pesanan belum selesai';$('review-copy').textContent='Ulasan pembelian aktif setelah Admin menyelesaikan pesanan.';return;}
      }
      $('review-form').hidden=false;
    }catch(e){error(e.message||'Tidak dapat memeriksa tautan ulasan.');}
  }
  $('review-form').addEventListener('submit',async e=>{
    e.preventDefault();const button=$('submit-review');button.disabled=true;error('');
    try{
      const payload={key,rating:Number($('rating').value),comment:$('review-text').value.trim()};
      if(isTicketReview)payload.ticketId=ticketId;else payload.orderId=id;
      const response=await fetch('/api/reviews',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Ulasan gagal disimpan.');
      $('review-form').hidden=true;$('review-success').hidden=false;
      $('review-title').textContent='Terima kasih atas ulasanmu';
      $('review-copy').textContent=isTicketReview?'Ulasan layanan tiket berhasil disimpan. Ulasan pembelian tetap terpisah.':'Ulasan pembelian berhasil disimpan. Ulasan layanan tiket tetap terpisah.';
    }catch(e){error(e.message||'Ulasan gagal disimpan.');button.disabled=false;}
  });
  load();
})();
