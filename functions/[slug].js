import { renderStudioPageRoute } from './_lib/studio-page-response.js';

export async function onRequestGet(context) {
  const response=await renderStudioPageRoute(context,'/'+String(context.params.slug||''));
  return response || context.next();
}

export async function onRequestHead(context) {
  const response=await renderStudioPageRoute(context,'/'+String(context.params.slug||''));
  return response || context.next();
}
