'use strict';
const VERSION='slf-app-v9-cc39c93-fix1';
const SHELL_CACHE=VERSION;
const SHELL=['./','./index.html','./app.css?v=cc39c93-fix1','./app.js?v=cc39c93-fix1','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(SHELL_CACHE);await cache.addAll(SHELL);await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('slf-app-')&&key!==SHELL_CACHE).map(key=>caches.delete(key)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith('/app/'))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const cache=await caches.open(SHELL_CACHE);await cache.put('./index.html',response.clone());}return response;}catch{return (await caches.match('./index.html'))||new Response('SLF Mobile offline shell belum tersedia. Buka aplikasi sekali saat online.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());
  return;
 }
 event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);const cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.ok&&response.type==='basic')await cache.put(request,response.clone());return response;}catch{return new Response('',{status:504,statusText:'Offline resource unavailable'});}})());
});