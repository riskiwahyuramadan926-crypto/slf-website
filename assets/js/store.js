(() => {
  'use strict';
  const cfg=window.SLF_STORE_CONFIG||{};
  const $=id=>document.getElementById(id);
  const rupiah=value=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value)||0);
  let products=[],modalProduct=null,reviewOffset=0,reviewCount=0,reviewsLoading=false;
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
    loadReviews(true);
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

  function renderDistribution(distribution,count){
    const root=$('review-distribution');root.replaceChildren();
    for(let star=5;star>=1;star--){
      const total=Number(distribution?.[star]||0);
      const row=document.createElement('div');row.className='review-dist-row';
      const label=document.createElement('span');label.textContent=String(star);
      const starIcon=document.createElement('span');starIcon.className='review-dist-star';starIcon.textContent='★';
      const track=document.createElement('div');track.className='review-dist-track';
      const fill=document.createElement('div');fill.className='review-dist-fill';
      fill.style.width=(count?Math.min(100,total/count*100):0)+'%';
      track.append(fill);
      const value=document.createElement('span');value.className='review-dist-count';value.textContent=String(total);
      row.append(label,starIcon,track,value);root.append(row);
    }
  }

  function makeReviewCard(review){
    const card=document.createElement('article');card.className='public-review-card';
    const badge=document.createElement('div');badge.className='public-review-product';
    const isService=review.reviewType==='ticket_service';
    badge.textContent=(isService?'Layanan Tiket: ':'Pembelian: ')+(review.productName||'Produk SLF');
    const head=document.createElement('div');head.className='public-review-head';
    const identity=document.createElement('strong');identity.className='public-review-player';identity.textContent=review.playerName||'Pemain SLF';
    const stars=document.createElement('span');stars.className='public-review-stars';stars.textContent='★'.repeat(Number(review.rating)||0)+'☆'.repeat(5-(Number(review.rating)||0));stars.setAttribute('aria-label',String(review.rating)+' dari 5 bintang');
    const date=document.createElement('time');date.className='public-review-date';
    date.dateTime=review.createdAt||'';
    date.textContent=review.createdAt?new Date(review.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'';
    head.append(identity,stars,date);
    card.append(badge,head);
    if(review.comment){
      const comment=document.createElement('p');comment.className='public-review-comment is-clamped';comment.textContent=review.comment;
      const more=document.createElement('button');more.type='button';more.className='review-expand';more.hidden=true;more.textContent='Lihat selengkapnya';more.setAttribute('aria-expanded','false');
      more.addEventListener('click',()=>{
        const expanded=comment.classList.toggle('is-expanded');
        comment.classList.toggle('is-clamped',!expanded);
        more.textContent=expanded?'Lebih sedikit':'Lihat selengkapnya';
        more.setAttribute('aria-expanded',String(expanded));
      });
      card.append(comment,more);
      requestAnimationFrame(()=>{
        if(review.comment.length>120||comment.scrollHeight>comment.clientHeight+2)more.hidden=false;
      });
    }else{
      const empty=document.createElement('p');empty.className='public-review-comment is-empty';empty.textContent='Pembeli tidak menambahkan komentar.';card.append(empty);
    }
    if(review.adminReply){
      const reply=document.createElement('div');reply.className='public-review-reply';
      const label=document.createElement('strong');label.textContent=review.adminName||'Tim SLF';
      const text=document.createElement('p');text.textContent=review.adminReply;
      reply.append(label,text);card.append(reply);
    }
    return card;
  }

  async function loadReviews(reset=false){
    if(reviewsLoading)return;
    reviewsLoading=true;
    const button=$('reviews-more');
    if(reset){reviewOffset=0;$('public-reviews').replaceChildren();$('reviews-error').hidden=true;}
    button.disabled=true;button.textContent='Memuat…';
    try{
      const response=await fetch('/api/reviews?limit=6&offset='+reviewOffset,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Ulasan belum dapat dimuat.');
      reviewCount=Number(data.count||0);
      $('review-average').textContent=reviewCount?Number(data.average||0).toFixed(1):'—';
      $('review-count').textContent=reviewCount+' ulasan';
      $('review-stars').textContent=reviewCount?'★★★★★':'☆☆☆☆☆';
      renderDistribution(data.distribution,reviewCount);
      for(const review of data.reviews||[])$('public-reviews').append(makeReviewCard(review));
      reviewOffset=Number(data.nextOffset||reviewOffset);
      $('reviews-empty').hidden=reviewCount>0;
      button.hidden=!data.hasMore;
      button.textContent='Muat Lebih Banyak';
    }catch(error){
      $('reviews-error').hidden=false;$('reviews-error').textContent=error.message||'Ulasan belum dapat dimuat.';
      button.hidden=reviewOffset===0;button.textContent='Coba Lagi';
    }finally{
      reviewsLoading=false;button.disabled=false;
    }
  }

  $('reviews-more').addEventListener('click',()=>loadReviews(false));
  $('product-info-close').addEventListener('click',()=>$('product-info-modal').close());
  $('product-info-donate').addEventListener('click',()=>{if(modalProduct)goToForm(modalProduct.id);});
  $('product-info-modal').addEventListener('click',event=>{if(event.target===$('product-info-modal'))$('product-info-modal').close();});
  loadProducts();
})();
