(() => {
  'use strict';
  if (document.getElementById('slf-cs-root')) return;

  const style = document.createElement('style');
  style.textContent = `
    #slf-cs-root{--cs-bg:#17111f;--cs-panel:#21182b;--cs-line:#554366;--cs-text:#f4edf9;--cs-muted:#c0b2ce;--cs-accent:#c9a5f6;--cs-gold:#e8c47c;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--cs-text);position:fixed;right:18px;bottom:18px;z-index:99999}
    #slf-cs-root *{box-sizing:border-box}
    .slf-cs-launch{border:1px solid #8b6cad;background:linear-gradient(135deg,#7046a0,#352047);color:#fff;border-radius:999px;padding:13px 17px;box-shadow:0 12px 35px #0007;cursor:pointer;font:600 14px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;align-items:center;gap:9px}
    .slf-cs-dot{width:9px;height:9px;border-radius:50%;background:#83e6ad;box-shadow:0 0 0 4px #83e6ad20}
    .slf-cs-window{position:absolute;right:0;bottom:64px;width:min(370px,calc(100vw - 28px));height:min(570px,calc(100dvh - 110px));min-height:390px;display:flex;flex-direction:column;background:var(--cs-bg);border:1px solid var(--cs-line);border-radius:18px;box-shadow:0 22px 65px #0009;overflow:hidden}
    .slf-cs-window[hidden]{display:none}
    .slf-cs-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 15px;background:#2d2138;border-bottom:1px solid var(--cs-line)}
    .slf-cs-brand{font-weight:750;font-size:14px}.slf-cs-sub{color:var(--cs-muted);font-size:11px;margin-top:2px}
    .slf-cs-close{border:1px solid #6e5a7d;background:transparent;color:var(--cs-text);border-radius:10px;padding:6px 10px;cursor:pointer}
    .slf-cs-log{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
    .slf-cs-msg{max-width:94%;padding:10px 12px;border-radius:13px;white-space:pre-wrap;overflow-wrap:anywhere}
    .slf-cs-msg.bot{align-self:flex-start;background:var(--cs-panel);border:1px solid #41334d}
    .slf-cs-msg.user{align-self:flex-end;background:#3d2852;border:1px solid #70538b}
    .slf-cs-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
    .slf-cs-actions a{color:var(--cs-gold);border:1px solid #635071;border-radius:9px;padding:6px 9px;text-decoration:none;font-size:12px}
    .slf-cs-quick{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 10px}
    .slf-cs-quick button{background:#23182e;border:1px solid #554366;color:var(--cs-text);border-radius:999px;padding:6px 9px;font-size:11px;cursor:pointer}
    .slf-cs-form{display:flex;gap:7px;padding:10px;border-top:1px solid var(--cs-line);background:#1d1525}
    .slf-cs-form input{width:100%;min-width:0;background:#100c17;border:1px solid #5a466b;border-radius:11px;color:var(--cs-text);padding:11px;font:inherit;outline-offset:2px}
    .slf-cs-form button{flex-shrink:0;background:var(--cs-accent);color:#21162b;border:0;border-radius:11px;padding:0 13px;font-weight:750;cursor:pointer}
    .slf-cs-form button:disabled{opacity:.6;cursor:wait}
    .slf-cs-disclaimer{padding:0 12px 9px;background:#1d1525;color:var(--cs-muted);font-size:10px}
    @media(max-width:480px){#slf-cs-root{right:10px;bottom:10px}.slf-cs-window{right:-2px;width:calc(100vw - 20px);height:min(610px,calc(100dvh - 92px));bottom:61px}.slf-cs-launch{padding:12px 14px}}
    @media(prefers-reduced-motion:reduce){.slf-cs-log{scroll-behavior:auto}}
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'slf-cs-root';
  root.innerHTML = `
    <section class="slf-cs-window" id="slf-cs-window" aria-label="Layanan bantuan otomatis SLF" role="dialog" aria-modal="false" aria-labelledby="slf-cs-title" hidden>
      <div class="slf-cs-head"><div><div class="slf-cs-brand" id="slf-cs-title">✦ Asisten CS SLF</div><div class="slf-cs-sub">Bantuan otomatis · tersedia 24 jam</div></div><button class="slf-cs-close" id="slf-cs-close" type="button" aria-label="Tutup chat">Tutup</button></div>
      <div class="slf-cs-log" id="slf-cs-log" aria-live="polite" aria-relevant="additions"></div>
      <div class="slf-cs-quick" id="slf-cs-quick">
        <button type="button" data-question="Bagaimana cara pembayaran DANA?">Pembayaran</button>
        <button type="button" data-question="Bagaimana cek status pesanan?">Status pesanan</button>
        <button type="button" data-question="Bagaimana VIP dan Custom Rank diproses?">VIP / Rank</button>
        <button type="button" data-question="Bagaimana tiket masuk kembali digunakan?">Tiket re-entry</button>
        <button type="button" data-question="Saya ada kendala teknis masuk server">Kendala teknis</button>
        <button type="button" data-question="Bagaimana aturan dan zona SLF?">Aturan / Zona</button>
        <button type="button" data-question="Bagaimana cara klaim tanah?">Klaim tanah</button>
        <button type="button" data-question="Saya ingin bicara dengan admin manusia">Hubungi admin</button>
      </div>
      <form class="slf-cs-form" id="slf-cs-form"><input id="slf-cs-input" maxlength="500" required autocomplete="off" aria-label="Tulis pertanyaan" placeholder="Tulis pertanyaan…"><button id="slf-cs-send" type="submit">Kirim</button></form>
      <div class="slf-cs-disclaimer">Jawaban bot bersifat otomatis. Tiket tersimpan untuk tindak lanjut; balasan manusia mungkin tidak langsung.</div>
    </section>
    <button class="slf-cs-launch" id="slf-cs-launch" type="button" aria-expanded="false" aria-controls="slf-cs-window"><span class="slf-cs-dot"></span> CS SLF · 24 Jam</button>
  `;
  document.body.appendChild(root);

  const $ = id => document.getElementById(id);
  const windowEl = $('slf-cs-window');
  const log = $('slf-cs-log');
  const input = $('slf-cs-input');
  const send = $('slf-cs-send');
  let greeted = false;

  function addMessage(text, who, actionList=[]) {
    const bubble = document.createElement('div');
    bubble.className = 'slf-cs-msg ' + who;
    bubble.textContent = text;
    if (actionList.length) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'slf-cs-actions';
      actionList.forEach(action => {
        if (!action || typeof action.href !== 'string' || !action.href.startsWith('/') || action.href.startsWith('//')) return;
        const a = document.createElement('a');
        a.href = action.href; a.textContent = action.label || 'Buka bantuan';
        actionsEl.appendChild(a);
      });
      if (actionsEl.childElementCount) bubble.appendChild(actionsEl);
    }
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    addMessage('Halo! Aku Asisten Otomatis SLF. Aku bisa bantu pertanyaan umum kapan saja. Untuk masalah pesanan, pembayaran, atau kendala akun yang perlu pemeriksaan, gunakan tiket bantuan supaya tim SLF bisa menindaklanjuti.', 'bot', [
      {label:'Lihat Store',href:'/store/#produk'},
      {label:'Buat tiket bantuan',href:'/store/#pusat-bantuan'}
    ]);
  }

  function setOpen(open) {
    windowEl.hidden = !open;
    $('slf-cs-launch').setAttribute('aria-expanded',String(open));
    $('slf-cs-launch').innerHTML = open ? '<span class="slf-cs-dot"></span> Chat terbuka' : '<span class="slf-cs-dot"></span> CS SLF · 24 Jam';
    if (open) { greet(); input.focus(); }
  }

  async function ask(question) {
    const value = String(question || '').trim().slice(0,500);
    if (!value) return;
    addMessage(value,'user');
    input.value = '';
    send.disabled = true; send.textContent = '…';
    const pending = addMessage('Sedang mencari jawaban…','bot');
    try {
      const response = await fetch('/api/support/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:value}),cache:'no-store'});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || 'Asisten sementara tidak dapat dihubungi.');
      pending.remove();
      addMessage(data.answer || 'Aku belum menemukan jawaban. Buat tiket agar tim SLF bisa membantu.', 'bot', data.actions || [{label:'Buat tiket bantuan',href:'/store/#pusat-bantuan'}]);
    } catch (error) {
      pending.remove();
      addMessage('Maaf, asisten otomatis sedang tidak dapat dihubungi. Kamu tetap bisa mengirim tiket bantuan dari formulir berikut; pesanmu akan masuk ke kotak tiket admin.', 'bot', [{label:'Buat tiket bantuan',href:'/store/#pusat-bantuan'}]);
    } finally { send.disabled=false;send.textContent='Kirim';input.focus(); }
  }

  $('slf-cs-launch').addEventListener('click',()=>setOpen(windowEl.hidden));
  $('slf-cs-close').addEventListener('click',()=>setOpen(false));
  $('slf-cs-form').addEventListener('submit',event=>{event.preventDefault();ask(input.value);});
  $('slf-cs-quick').addEventListener('click',event=>{
    const btn=event.target.closest('button[data-question]');
    if(btn)ask(btn.dataset.question);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!windowEl.hidden)setOpen(false);});
})();
