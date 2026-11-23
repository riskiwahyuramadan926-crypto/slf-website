import { normalizeStudioLayers } from './_lib/studio-builder.js';

const RESERVED = new Set(['admin','api','app','assets','bantuan','images','store','wiki','fonts','uploads','robots','favicon','sitemap']);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const jsonForScript = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');

function renderLayer(layer) {
  const id = esc(layer.id);
  const style = [
    layer.styles?.color ? 'color:'+layer.styles.color : '',
    layer.styles?.backgroundColor ? 'background:'+layer.styles.backgroundColor : '',
    layer.styles?.fontSize ? 'font-size:'+layer.styles.fontSize+'px' : '',
    layer.styles?.fontWeight ? 'font-weight:'+layer.styles.fontWeight : '',
    layer.styles?.padding ? 'padding:'+layer.styles.padding+'px' : '',
    layer.styles?.borderRadius ? 'border-radius:'+layer.styles.borderRadius+'px' : '',
    layer.styles?.textAlign ? 'text-align:'+layer.styles.textAlign : '',
    layer.styles?.maxWidth ? 'max-width:'+layer.styles.maxWidth+'px' : ''
  ].filter(Boolean).join(';');
  const animation = layer.loop && layer.animation !== 'none' ? ' slf-loop-'+layer.animation : '';
  const base = 'class="slf-layer'+animation+'" data-layer="'+id+'" style="'+style+'"';
  if (layer.type === 'image') return '<figure '+base+'><img loading="lazy" src="'+esc(layer.src)+'" alt="'+esc(layer.name)+'"></figure>';
  if (layer.type === 'video') return '<div '+base+'><video controls playsinline preload="metadata" src="'+esc(layer.src)+'"></video></div>';
  if (layer.type === 'table') {
    const rows = (layer.rows || []).map((row, i) => '<tr>'+row.map(cell => '<'+(i===0?'th':'td')+'>'+esc(cell)+'</'+(i===0?'th':'td')+'>').join('')+'</tr>').join('');
    return '<div '+base+'><table>'+rows+'</table></div>';
  }
  if (layer.type === 'input') return '<label '+base+'><span>'+esc(layer.content || layer.name)+'</span><input name="'+esc(layer.fieldName)+'" maxlength="1000" autocomplete="off"></label>';
  if (layer.type === 'button') {
    const action = layer.action || {type:'none',target:''};
    return '<div '+base+'><button type="button" class="slf-action" data-action="'+esc(action.type)+'" data-target="'+esc(action.target)+'" data-click-animation="'+esc(layer.clickAnimation)+'">'+esc(layer.content || layer.name)+'</button></div>';
  }
  if (layer.type === 'card') return '<article '+base+'><h2>'+esc(layer.name)+'</h2><p>'+esc(layer.content)+'</p></article>';
  return '<div '+base+'><p>'+esc(layer.content || layer.name)+'</p></div>';
}

function documentHtml(page) {
  const safeLayers = normalizeStudioLayers(JSON.parse(page.layers_json || '[]'));
  const title = esc(page.page_name);
  const markup = safeLayers.map(renderLayer).join('');
  const config = jsonForScript({layers:safeLayers});
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#100c18"><title>${title} · Survival Legacy Frontier</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#100c18;color:#f5f1ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#211631,#100c18 60%);min-height:100vh}.slf-page{width:min(100% - 32px,980px);margin:0 auto;padding:36px 0 72px}.slf-head{margin-bottom:28px}.slf-head a{color:#c9a8ff;text-decoration:none;font-size:13px}.slf-head h1{font-size:clamp(28px,5vw,44px);margin:12px 0}.slf-layer{margin:14px 0;overflow-wrap:anywhere}.slf-layer img,.slf-layer video{display:block;max-width:100%;height:auto;border-radius:14px}.slf-layer table{width:100%;border-collapse:collapse;background:#1a1424;border-radius:12px;overflow:hidden}.slf-layer th,.slf-layer td{padding:11px;border:1px solid #40334f;text-align:left}.slf-layer input{display:block;width:100%;padding:13px;margin-top:8px;border:1px solid #57456d;border-radius:10px;background:#17111f;color:white}.slf-action{border:0;border-radius:12px;padding:13px 20px;background:#9b6cff;color:#140d20;font-weight:700;cursor:pointer}.slf-status{font-size:13px;color:#c9a8ff;margin-top:10px;white-space:pre-wrap}.slf-loop-fade{animation:slfFade 2.4s ease-in-out infinite alternate}.slf-loop-float{animation:slfFloat 3s ease-in-out infinite}.slf-loop-pulse{animation:slfPulse 1.8s ease-in-out infinite}@keyframes slfFade{from{opacity:.55}to{opacity:1}}@keyframes slfFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes slfPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}.slf-click-fade{animation:slfClickFade .55s ease}@keyframes slfClickFade{from{opacity:.2}to{opacity:1}}.slf-click-float{animation:slfClickFloat .55s ease}@keyframes slfClickFloat{from{transform:translateY(12px)}to{transform:translateY(0)}}.slf-click-pulse{animation:slfClickPulse .55s ease}@keyframes slfClickPulse{50%{transform:scale(1.06)}}footer{padding-top:38px;color:#8e829e;font-size:12px}
</style></head><body><main class="slf-page"><header class="slf-head"><a href="/">← Survival Legacy Frontier</a><h1>${title}</h1></header><section id="slf-content">${markup}</section><footer>Survival Legacy Frontier · Halaman dibuat dengan SLF Studio</footer></main><script>
const CFG=${config};
document.querySelectorAll('.slf-action').forEach(button=>button.addEventListener('click',async()=>{
 const type=button.dataset.action,target=button.dataset.target,layer=button.closest('[data-layer]'),status=layer.querySelector('.slf-status')||Object.assign(document.createElement('div'),{className:'slf-status'});
 if(!status.isConnected)layer.append(status);
 const animation=button.dataset.clickAnimation;if(animation&&animation!=='none'){layer.classList.remove('slf-click-'+animation);void layer.offsetWidth;layer.classList.add('slf-click-'+animation);}
 try{
  if(type==='navigate'){if(target)location.href=target;return;}
  if(type==='external'){if(/^https:\\/\\//i.test(target))window.open(target,'_blank','noopener,noreferrer');return;}
  if(type==='scroll'){const el=document.querySelector(target.startsWith('#')?target:'#'+CSS.escape(target));el?.scrollIntoView({behavior:'smooth'});return;}
  if(type==='backend-submit'||type==='backend-read'){
   const values={};document.querySelectorAll('input[name]').forEach(input=>{if(input.name)values[input.name]=input.value;});
   const response=await fetch('/api/studio/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:type==='backend-submit'?'submit':'read',table:target,values})});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Backend request gagal.');
   if(type==='backend-submit'){status.textContent=data.message||'Data tersimpan.';document.querySelectorAll('input[name]').forEach(input=>input.value='');}
   else{status.textContent=JSON.stringify(data.rows||[],null,2);}
   return;
  }
 }catch(error){status.textContent=error.message||'Aksi gagal.';}
}));
</script></body></html>`;
}

export async function onRequestGet(context) {
  const slug=String(context.params.slug || '').toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVED.has(slug)) return context.next();
  if(!context.env.DB) return context.next();
  try {
    const page=await context.env.DB.prepare('SELECT page_name,layers_json FROM studio_pages WHERE route_path=? AND is_published=1 LIMIT 1').bind('/'+slug).first();
    if(!page) return context.next();
    return new Response(documentHtml(page),{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});
  } catch(error) {
    console.error('[SLF_STUDIO_ROUTE] render failed:',error?.message||error);
    return new Response('Halaman Studio sedang tidak tersedia.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
}
