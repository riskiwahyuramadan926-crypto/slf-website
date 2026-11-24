import { renderStudioPageRoute } from './_lib/studio-page-response.js';

export async function onRequest(context) {
  const {request,params}=context;
  if(request.method!=='GET'&&request.method!=='HEAD')return context.next();
  const segments=Array.isArray(params?.catchall)?params.catchall:(params?.catchall?[params.catchall]:[]);
  if(segments.length!==1)return context.next();
  const response=await renderStudioPageRoute(context,'/'+segments[0]);
  return response || context.next();
}
