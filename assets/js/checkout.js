(() => {
  'use strict';
  const cfg=window.SLF_STORE_CONFIG||{};
  const $=id=>document.getElementById(id);
  const rupiah=value=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value)||0);
  let selected=null;
  $('year').textContent=new Date().getFullYear();
  const productId=new URLSearchParams(location.search).get('product')||'';

  async function init(){
    try{
      const response=await fetch('/api/store-products',{cache:'no-store'});
      if(response.ok){
        const data=await response.json();
        if(Array.isArray(data.products))cfg.products=data.products;
      }
    }catch(_){}
    selected=(cfg.products||[]).find(product=>product.id===productId)||null;
    if(!selected){
      showError('Produk tidak ditemukan atau sudah tidak tersedia. Silakan pilih ulang dari katalog.');
      $('submit-order').disabled=true;
      return;
    }
    $('product-id').value=selected.id;
    $('summary-product').textContent=selected.name;
    $('summary-price').textContent=rupiah(selected.price);
    $('summary-total').textContent=rupiah(selected.price);
    const needsRank=['CUSTOM_RANK','VIP_PLUS'].includes(selected.id);
    $('custom-rank-fields').hidden=!needsRank;
    $('vip-fields').hidden=selected.id!=='VIP_PLUS';
    $('ticket-fields').hidden=!selected.id.startsWith('REENTRY_');
    $('rank-name').required=needsRank;
    $('rank-color').required=needsRank;
    $('rank-style').required=needsRank;
    (cfg.rankColors||[]).forEach(color=>$('rank-color').add(new Option(color.label,color.value)));
    (cfg.rankStyles||[]).forEach(style=>$('rank-style').add(new Option(style.label,style.value)));
    $('submit-order').disabled=false;
  }

  function preview(){
    const name=$('rank-name').value.trim()||'STARLIGHT';
    const color=$('rank-color').value||'#B98CF4';
    const style=$('rank-style').value;
    $('rank-preview').textContent='['+name+'] NamaPemain';
    $('rank-preview').style.color=color;
    $('rank-preview').style.fontWeight=style.includes('bold')?'800':'500';
    $('rank-preview').style.fontStyle=style.includes('italic')?'italic':'normal';
  }

  function showError(message){
    const error=$('form-error');
    error.textContent=message;
    error.classList.add('show');
    error.scrollIntoView({behavior:'smooth',block:'center'});
  }

  ['rank-name','rank-color','rank-style'].forEach(id=>$(id).addEventListener('input',preview));
  $('promo').addEventListener('input',()=>$('summary-promo').textContent=$('promo').value.trim()?'Dicek saat checkout':'—');

  $('order-form').addEventListener('submit',async event=>{
    event.preventDefault();
    $('form-error').textContent='';
    $('form-error').classList.remove('show');
    if(!selected){showError('Produk tidak tersedia.');return;}
    const button=$('submit-order');
    button.disabled=true;
    button.textContent='Membuat pesanan…';
    const adminPhone=String(cfg.adminWhatsApp||'').replace(/\D/g,'');
    const popup=adminPhone?window.open('about:blank','_blank'):null;
    const details={
      buyerNote:$('buyer-note').value.trim()
    };
    if(['CUSTOM_RANK','VIP_PLUS'].includes(selected.id)){
      details.rankName=$('rank-name').value.trim();
      details.rankColor=$('rank-color').value;
      details.rankStyle=$('rank-style').value;
    }
    const body={
      minecraftName:$('minecraft-name').value.trim(),
      platform:$('platform').value,
      whatsapp:$('whatsapp').value.trim(),
      email:$('email').value.trim(),
      promoCode:$('promo').value.trim().toUpperCase(),
      productId:selected.id,
      agree:$('agree').checked,
      details
    };

    try{
      const response=await fetch('/api/orders/create',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(body)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Pesanan belum bisa dibuat. Coba kembali.');
      if(!data.orderUrl)throw new Error('Tautan informasi pesanan tidak diterima dari server.');

      if(adminPhone){
        const message=[
          'Halo Admin SLF, saya ingin melanjutkan pembayaran pesanan berikut:',
          '• Nomor pesanan: '+data.orderId,
          '• Nama Minecraft: '+body.minecraftName+' ('+body.platform+')',
          '• Produk: '+selected.name,
          '• Total pembayaran: '+rupiah(data.total),
          '• Catatan: '+(details.buyerNote||'—'),
          'Status Pesanan:',
          data.orderUrl,
          'Mohon kirimkan QRIS pembayarannya. Terima kasih!'
        ].join('\n');
        const whatsappUrl='https://wa.me/'+adminPhone+'?text='+encodeURIComponent(message);
        if(popup&&!popup.closed)popup.location.href=whatsappUrl;
        else {
          let opened=null;
          try{opened=window.open(whatsappUrl,'_blank');}catch(_){}
          if(!opened){
            try{sessionStorage.setItem('slf-checkout-whatsapp:'+data.orderId,whatsappUrl);}catch(_){}
          }
        }
      }
      window.location.href=data.orderUrl;
    }catch(error){
      if(popup&&!popup.closed)popup.close();
      showError(error.message||'Koneksi gagal.');
      button.disabled=false;
      button.textContent='Lanjutkan Pembayaran / Checkout';
    }
  });
  init();
})();
