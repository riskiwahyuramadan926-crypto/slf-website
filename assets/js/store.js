(() => {
  'use strict';
  const cfg=window.SLF_STORE_CONFIG||{};
  const $=id=>document.getElementById(id);
  const rupiah=value=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value)||0);
  let products=[],modalProduct=null;
  $('year').textContent=new Date().getFullYear();

  async function loadProducts(){
    try{
      const response=await fetch('/api/store-products',{cache:'no-store'});
      if(!response.ok)throw new Error('catalog unavailable');
      const data=await response.json();
      if(!Array.isArray(data.products)||!data.products.length)throw new Error('empty catalog');
      products=data.products;
    }catch(_){
      products=Array.isArray(cfg.products)?cfg.products:[];
      const notice=$('catalog-message');
      if(notice){notice.hidden=false;notice.textContent='Katalog cadangan ditampilkan. Harga akhir tetap diverifikasi server saat checkout.';}
    }
    renderProducts();
  }

  function renderProducts(){
    const root=$('products');
    root.replaceChildren();
    if(!products.length){
      const empty=document.createElement('div');
      empty.className='empty';
      empty.textContent='Katalog sementara tidak tersedia. Silakan muat ulang halaman.';
      root.append(empty);
      return;
    }
    for(const product of products){
      const card=document.createElement('article');
      card.className='product product-clean';
      const icon=document.createElement('div');
      icon.className='iconbox';
      icon.setAttribute('aria-hidden','true');
      icon.textContent=product.icon||'✦';
      const name=document.createElement('h3');
      name.textContent=product.name;
      const price=document.createElement('strong');
      price.className='price';
      price.textContent=rupiah(product.price);
      const actions=document.createElement('div');
      actions.className='product-actions';
      const info=document.createElement('button');
      info.type='button';
      info.className='info-button';
      info.textContent='i';
      info.setAttribute('aria-label','Informasi '+product.name);
      info.addEventListener('click',()=>showInfo(product));
      const donate=document.createElement('button');
      donate.type='button';
      donate.className='donate-button';
      donate.textContent='Donasi';
      donate.addEventListener('click',()=>goToForm(product.id));
      actions.append(info,donate);
      card.append(icon,name,price,actions);
      root.append(card);
    }
  }

  function showInfo(product){
    modalProduct=product;
    $('product-info-title').textContent=product.name;
    $('product-info-price').textContent=rupiah(product.price);
    $('product-info-description').textContent=product.description||'Informasi produk belum tersedia.';
    $('product-info-note').textContent=product.note||'';
    $('product-info-modal').showModal();
  }

  function goToForm(productId){
    window.location.href='/store/form.html?product='+encodeURIComponent(productId);
  }

  $('product-info-close').addEventListener('click',()=>$('product-info-modal').close());
  $('product-info-donate').addEventListener('click',()=>{if(modalProduct)goToForm(modalProduct.id);});
  $('product-info-modal').addEventListener('click',event=>{if(event.target===$('product-info-modal'))$('product-info-modal').close();});
  loadProducts();
})();
