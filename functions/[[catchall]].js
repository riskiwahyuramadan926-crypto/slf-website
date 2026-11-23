import { normalizeStudioRoute } from './_lib/studio-builder.js';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeJson=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,char=>({'<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'}[char]));
const notFound=()=>new Response('Halaman tidak ditemukan.',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
export async function onRequest(context){
  const {request,env,params}=context,url=new URL(request.url);
  if(url.pathname.startsWith('/api/')||url.pathname==='/admin'||url.pathname.startsWith('/admin/'))return context.next();
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed.',{status:405,headers:{allow:'GET, HEAD'}});
  try{
    const segments=Array.isArray(params?.catchall)?params.catchall:(params?.catchall?[params.catchall]:[]);
    if(segments.length!==1)return context.next();
    const routePath=normalizeStudioRoute('/'+segments[0]);
    const row=await env.DB.prepare('SELECT route_path,page_name,layers_json FROM studio_pages WHERE route_path=? AND is_published=1 LIMIT 1').bind(routePath).first();
    if(!row)return context.next();
    let layers;try{layers=JSON.parse(row.layers_json||'[]');}catch{return new Response('Konfigurasi halaman rusak.',{status:500});}
    const page={routePath:row.route_path,name:row.page_name,layers};
    const html='<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#100c18"><meta name="description" content="'+escapeHtml(row.page_name)+' · Survival Legacy Frontier"><title>'+escapeHtml(row.page_name)+' · SLF</title><link rel="stylesheet" href="/assets/css/studio-pages.css?v=1"><script defer src="/assets/js/studio-pages.js?v=1"></script></head><body><header class="slf-page-header"><a href="/" aria-label="SLF Beranda">✦ SURVIVAL LEGACY FRONTIER</a></header><main class="slf-page-main"><p class="slf-page-eyebrow">SURVIVAL LEGACY FRONTIER</p><h1>'+escapeHtml(row.page_name)+'</h1><section id="slf-page-layers" aria-label="Konten halaman"></section></main><footer class="slf-page-footer">Survival Legacy Frontier</footer><script type="application/json" id="slf-page-data">'+safeJson(page)+'</script></body></html>';
    if(request.method==='HEAD')return new Response(null,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
    return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});
  }catch(error){
    if(error?.message?.includes('Route harus')||error?.message?.includes('jalur khusus'))return notFound();
    console.error('[SLF_STUDIO_ROUTE] render failed:',error?.message||error);
    return new Response('Halaman sementara tidak dapat dimuat.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
}