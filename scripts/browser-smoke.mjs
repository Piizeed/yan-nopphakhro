// Isolated in-memory membership database. Never creates users in the live app.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createWebServer} from '../server.mjs';
import {createMembership} from '../membership.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const service=createMembership(':memory:'),server=createWebServer(service);
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
try{
  await mkdir('artifacts',{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'Asia/Bangkok'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#birth');await page.locator('#login-form').waitFor();
  await page.screenshot({path:'artifacts/member-login.png',fullPage:true});
  await page.locator('[name=email]').fill('browser-test@example.invalid');await page.locator('[name=password]').fill('browser-test-password');await page.getByRole('button',{name:'สมัครบัญชีฟรี',exact:true}).click();
  await page.waitForURL('**/#account');await page.locator('#logout').waitFor();
  await page.goto(base+'/#birth');await page.locator('#birth-place').waitFor();assert.equal(await page.locator('#birth-place option').count(),78);
  await page.getByLabel('ชื่อ / ชื่อเล่น',{exact:true}).fill('ผู้ทดลอง');await page.getByLabel('วันเกิด (ค.ศ.)',{exact:true}).fill('1995-06-15');await page.getByLabel('เวลาเกิด (เวลาท้องถิ่นไทย)',{exact:true}).fill('09:30');await page.getByLabel('จังหวัดเกิด',{exact:true}).selectOption('province-80');await page.locator('[name=consent]').check();await page.getByRole('button',{name:'คำนวณดวงของฉัน ✧'}).click();
  await page.waitForURL('**/#result');await page.locator('[data-load-forecast]').click();await page.locator('.forecast-category').first().waitFor();assert.equal(await page.locator('.forecast-category').count(),4);assert.equal(await page.locator('.forecast-evidence').count(),0);
  for(const date of ['2026-11-01','2026-11-02']){await page.locator('#forecast-date').fill(date);await page.locator('[data-load-forecast]').click();await page.locator('.forecast-category').first().waitFor();}
  await page.locator('#forecast-date').fill('2026-11-03');await page.locator('[data-load-forecast]').click();await page.getByText(/ใช้ครบ 3 ครั้ง/).waitFor();
  await page.locator('[data-forecast-period=monthly]').click();await page.locator('[data-load-forecast]').click();await page.locator('#forecast-body [role=alert]').waitFor();
  const user=service.db.prepare('SELECT * FROM users WHERE email=?').get('browser-test@example.invalid');
  service.db.prepare('UPDATE users SET plan=?,started=?,expires=? WHERE id=?').run('pro29',new Date().toISOString(),'2099-11-21T17:00:00Z',user.id);
  await page.reload();await page.locator('[data-forecast-period=monthly]').click();await page.locator('#forecast-date').fill('2026-11');await page.locator('[data-load-forecast]').click();await page.locator('.forecast-category').first().waitFor();assert.equal(await page.locator('.forecast-evidence').count(),4);assert.equal(await page.locator('.monthly-daily-table tbody tr').count(),30);
  await page.locator('[data-premium]').click();await page.locator('#premium-body').getByText(/สำหรับ Pro 69/).waitFor();
  service.db.prepare('UPDATE users SET plan=? WHERE id=?').run('pro69',user.id);
  await page.reload();await page.locator('[data-forecast-period=monthly]').click();await page.locator('[data-load-forecast]').click();await page.locator('.forecast-category').first().waitFor();await page.locator('[data-premium]').click();await page.locator('.tarot-card').first().waitFor();assert.equal(await page.locator('.tarot-card').count(),3);
  await page.locator('#premium-body').screenshot({path:'artifacts/member-pro69.png'});
  await page.locator('#save-chart').click();await page.goto(base+'/#account');await page.locator('[data-open-profile]').waitFor();assert.match(await page.locator('#app').innerText(),/23:59:59/);
  await page.locator('#logout').click();await page.locator('#login-form').waitFor();await page.locator('[name=email]').fill('second@example.invalid');await page.locator('[name=password]').fill('second-test-password');await page.getByRole('button',{name:'สมัครบัญชีฟรี',exact:true}).click();await page.locator('#logout').waitFor();assert.equal(await page.locator('[data-open-profile]').count(),0);
  await page.goto(base+'/#pricing');await page.getByRole('heading',{name:'เลือกจังหวะที่ใช่สำหรับคุณ'}).waitFor();await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));await page.screenshot({path:'artifacts/member-pricing.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/member-pricing-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  process.env.PAYMENT_ACCOUNT='0000000000';process.env.PAYMENT_NAME='บัญชีทดสอบเท่านั้น';
  await page.goto(base+'/#payment-pro29');await page.locator('#payment-form').waitFor();await page.locator('[name=reference]').fill('TEST-TRANSFER-123');await page.locator('[name=slip]').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});await page.locator('#payment-form [type=checkbox]').check();await page.locator('#payment-form button').click();await page.locator('#payment-history').getByText(/รอตรวจสอบ/).waitFor();
  service.db.prepare('UPDATE users SET is_admin=1 WHERE email=?').run('second@example.invalid');await page.goto(base+'/#admin');await page.locator('[data-review]').first().waitFor();page.on('dialog',dialog=>dialog.accept());await page.locator('[data-action=approve]').click();await page.locator('#admin-list').getByText(/อนุมัติแล้ว/).waitFor();await page.goto(base+'/#account');await page.getByText(/Pro 29 · เริ่ม/).waitFor();
  delete process.env.PAYMENT_ACCOUNT;delete process.env.PAYMENT_NAME;
  assert.deepEqual(errors,[]);console.log('Browser passed: login, quota, all paid gates, tarot/graph, account isolation, mobile, slip upload, admin approval and expiry, no page errors.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));service.db.close();}
