import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebServer} from '../server.mjs';
import {createMembership} from '../membership.mjs';
test('public discovery routes use configured origin and do not expose private files',async t=>{
  const db=createMembership(':memory:'),server=createWebServer(db);
  const prior=process.env.PUBLIC_ORIGIN;process.env.PUBLIC_ORIGIN='https://example.invalid';
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>{server.closeAllConnections();server.close();db.db.close();if(prior===undefined)delete process.env.PUBLIC_ORIGIN;else process.env.PUBLIC_ORIGIN=prior;});
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/healthz')).status,200);
  const sitemap=await (await fetch(base+'/sitemap.xml')).text();assert.match(sitemap,/https:\/\/example.invalid\/about.html/);assert.ok(!sitemap.includes('127.0.0.1'));
  assert.match(await (await fetch(base+'/robots.txt')).text(),/Disallow: \/api\//);
  for(const path of ['/.env','/data/members.sqlite','/membership.mjs'])assert.equal((await fetch(base+path)).status,404);
  assert.match(await (await fetch(base+'/about.html')).text(),/YAN NOPPHAKHRO/);
});
