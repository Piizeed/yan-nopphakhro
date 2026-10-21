import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createMembership} from './membership.mjs';
const root=fileURLToPath(new URL('./public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.wasm':'application/wasm','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.ttf':'font/ttf'};
export function createWebServer(membership=createMembership()){
  const timer=setInterval(()=>membership.processPending().catch(()=>{}),60000);timer.unref();
  const server=http.createServer(async(req,res)=>{
    if(await membership.handle(req,res))return;
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/healthz'){membership.db.prepare('SELECT 1').get();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end('{"ok":true}');}
      if(url.pathname==='/robots.txt'||url.pathname==='/sitemap.xml'){
        const origin=process.env.PUBLIC_ORIGIN?new URL(process.env.PUBLIC_ORIGIN).origin:null;
        if(url.pathname==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});return res.end('User-agent: *\nDisallow: /api/\n'+(origin?'Sitemap: '+origin+'/sitemap.xml\n':''));}
        if(!origin){res.writeHead(503);return res.end('Public origin not configured');}
        const safe=origin.replaceAll('&','&amp;').replaceAll('<','&lt;');res.writeHead(200,{'Content-Type':'application/xml; charset=utf-8'});return res.end('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+safe+'/</loc></url><url><loc>'+safe+'/about.html</loc></url></urlset>');
      }
      const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if(!path.startsWith(resolve(root)+'/')&&!path.startsWith(resolve(root)+'\\')){res.writeHead(403);return res.end();}
      if(url.pathname==='/forecasts.js'){res.writeHead(404);return res.end();}
      const data=await readFile(path);
      res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});res.end(data);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  server.on('close',()=>clearInterval(timer));return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
  createWebServer().listen(Number(process.env.PORT)||3000,process.env.HOST||'127.0.0.1',()=>console.log('LAKHANA ready at http://127.0.0.1:'+(Number(process.env.PORT)||3000)));
}
