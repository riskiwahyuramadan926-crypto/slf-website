import { getStudioScope, normalizeStudioLayers, normalizeStudioRoute } from './studio-builder.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeJson = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,char=>({'<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'}[char]));

export async function renderStudioPageRoute(context, routeValue) {
  const scope=getStudioScope(context.request);
  if(!scope||!context.env.DB)return null;
  let routePath;
  try { routePath=normalizeStudioRoute(routeValue); }
  catch { return null; }
  try {
    const row=await context.env.DB.prepare('SELECT route_path,page_name,layers_json FROM "'+scope.pagesTable+'" WHERE route_path=? AND is_published=1 LIMIT 1').bind(routePath).first();
    if(!row)return null;
    let rawLayers;
    try { rawLayers=JSON.parse(row.layers_json||'[]'); }
    catch { return new Response('Konfigurasi halaman rusak.',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}}); }
    const page={routePath:row.route_path,name:row.page_name,layers:normalizeStudioLayers(rawLayers,scope.tablePrefix)};
    const html='<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#100c18"><meta name="description" content="'+escapeHtml(row.page_name)+' · Survival Legacy Frontier"><title>'+escapeHtml(row.page_name)+' · SLF</title><link rel="stylesheet" href="/assets/css/studio-pages.css?v=2"><script defer src="/assets/js/studio-pages.js?v=2"></script></head><body><header class="slf-page-header"><a href="/" aria-label="SLF Beranda">✦ SURVIVAL LEGACY FRONTIER</a></header><main class="slf-page-main"><p class="slf-page-eyebrow">SURVIVAL LEGACY FRONTIER</p><h1>'+escapeHtml(row.page_name)+'</h1><section id="slf-page-layers" aria-label="Konten halaman"></section></main><footer class="slf-page-footer">Survival Legacy Frontier</footer><script type="application/json" id="slf-page-data">'+safeJson(page)+'</script></body></html>';
    const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'};
    if(context.request.method==='HEAD')return new Response(null,{status:200,headers});
    return new Response(html,{status:200,headers});
  } catch(error) {
    console.error('[SLF_STUDIO_ROUTE] render failed:',error?.message||error);
    return new Response('Halaman Studio sementara tidak dapat dimuat.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
}
