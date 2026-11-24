'use strict';
const VERSION='slf-app-v10-hotfix-20261124a';
const SHELL_CACHE=VERSION;
const SHELL=['./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(SHELL_CACHE);await cache.addAll(SHELL);await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('slf-app-')&&key!==SHELL_CACHE).map(key=>caches.delete(key)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith('/app/'))return;
 const path=url.pathname;
 if(request.mode==='navigate'||path.endsWith('/index.html')||path.endsWith('/app.js')||path.endsWith('/app.css')){
  event.respondWith(fetch(request));
  return;
 }
 event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);const cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.ok&&response.type==='basic')await cache.put(request,response.clone());return response;}catch{return new Response('',{status:504,statusText:'Offline resource unavailable'});}})());
});
