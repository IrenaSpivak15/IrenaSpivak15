const CACHE='aya-serzh-v1';
const ASSETS=['./','index.html','manifest.json','icon.svg','img/cover.jpg','img/mountain.jpg','img/p2.jpg','img/p3.jpg','img/p4.jpg','img/p5.jpg','img/p6.jpg','img/p7.jpg','img/p9.jpg','img/p10.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok&&new URL(e.request.url).origin===location.origin){const c=res.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}
    return res;
  }).catch(()=>caches.match('index.html'))));
});
