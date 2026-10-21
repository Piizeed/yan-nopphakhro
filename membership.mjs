import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { calculateChart, todayBangkok } from './public/astro.js';
import { forecastProvider, periodDays } from './public/forecasts.js';
import { premiumReading } from './premium.mjs';
import { subscriptionEnd } from './subscriptions.mjs';
import { automaticPaymentsReady, verifySlip } from './slip-verifier.mjs';
const derive=promisify(scrypt), hash=s=>createHash('sha256').update(s).digest('hex');
export function weekKey(now=new Date()) {
  const day=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)+'T00:00:00Z');
  day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7));return day.toISOString().slice(0,10);
}
export function createMembership(file=process.env.DATABASE_PATH||'data/members.sqlite') {
  if(file!==':memory:')mkdirSync(dirname(resolve(file)),{recursive:true});
  const db=new DatabaseSync(file);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,plan TEXT NOT NULL DEFAULT 'free',expires TEXT);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires INTEGER);
    CREATE TABLE IF NOT EXISTS usage(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,week TEXT,reading_key TEXT,result TEXT,PRIMARY KEY(user_id,week,reading_key));
    CREATE TABLE IF NOT EXISTS cards(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,reading_key TEXT,result TEXT,PRIMARY KEY(user_id,reading_key));
    CREATE TABLE IF NOT EXISTS grants(id TEXT PRIMARY KEY,user_id TEXT,plan TEXT,expires TEXT,created TEXT);
    CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),plan TEXT,reference TEXT,slip TEXT,status TEXT DEFAULT 'pending',created TEXT,reviewed TEXT);
    CREATE TABLE IF NOT EXISTS verified_transactions(reference TEXT PRIMARY KEY,payment_id TEXT UNIQUE,amount INTEGER,paid_at TEXT);
  `);
  for(const column of ['created','started'])if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name===column))db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT`);
  if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='is_admin'))db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  for(const [column,type] of [['attempts','INTEGER DEFAULT 0'],['last_check','TEXT'],['check_note','TEXT']])if(!db.prepare('PRAGMA table_info(payments)').all().some(c=>c.name===column))db.exec(`ALTER TABLE payments ADD COLUMN ${column} ${type}`);
  const attempts=new Map();
  const planOf=u=>u.plan!=='free'&&u.expires&&new Date(u.expires)>new Date()?u.plan:'free';
  const isAdmin=u=>u.is_admin===1;
  const billing=()=>({ready:Boolean(process.env.PAYMENT_ACCOUNT&&process.env.PAYMENT_NAME)&&(process.env.PAYMENT_MODE!=='easyslip'||automaticPaymentsReady()),automatic:automaticPaymentsReady(),account:process.env.PAYMENT_ACCOUNT||'',name:process.env.PAYMENT_NAME||'',bank:process.env.PAYMENT_BANK||'PromptPay'});
  const publicUser=u=>({id:u.id,email:u.email,plan:planOf(u),created:u.created,started:u.started,expires:u.expires,used:db.prepare('SELECT COUNT(*) AS n FROM usage WHERE user_id=? AND week=?').get(u.id,weekKey()).n,week:weekKey(),admin:isAdmin(u),billing:billing()});
  const fail=(status,message)=>Object.assign(Error(message),{status});
  async function body(req){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>4200000)throw fail(413,'ข้อมูลยาวเกินไป (สลิปไม่เกิน 3 MB)');}try{return JSON.parse(data||'{}');}catch{throw fail(400,'ข้อมูลไม่ถูกต้อง');}}
  function session(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('lakhana_session='))?.slice(16);if(!token)return null;return db.prepare('SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(hash(token),Date.now());}
  function cookie(req,token,age=604800){return `lakhana_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${process.env.COOKIE_SECURE==='1'?'; Secure':''}`;}
  function rate(req){const key=req.socket.remoteAddress;const now=Date.now();for(const [k,v] of attempts)if(now-v.start>900000)attempts.delete(k);let a=attempts.get(key)||{start:now,n:0};a.n++;attempts.set(key,a);if(a.n>30)throw fail(429,'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที');}
  async function handle(req,res){
    const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/api/'))return false;
    const reply=(status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
    try{
      if(!['GET','POST'].includes(req.method))throw fail(405,'ไม่รองรับคำขอนี้');
      if(req.method==='POST'){
        if(!req.headers['content-type']?.startsWith('application/json'))throw fail(415,'ใช้ข้อมูล JSON');
        const origin=req.headers.origin;
        if(origin && new URL(origin).host!==req.headers.host)throw fail(403,'แหล่งคำขอไม่ถูกต้อง');
        if(req.headers['sec-fetch-site']==='cross-site')throw fail(403,'แหล่งคำขอไม่ถูกต้อง');
      }
      const u=session(req);
      if(path==='/api/me'&&req.method==='GET'){reply(200,{user:u?publicUser(u):null});return true;}
      if(['/api/register','/api/login'].includes(path)&&req.method==='POST'){
        rate(req);const data=await body(req),email=String(data.email||'').trim().toLowerCase(),password=data.password;
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<10||password.length>128)throw fail(400,'กรอกอีเมลและรหัสผ่าน 10–128 ตัวอักษร');
        let user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if(path==='/api/register'){
          if(user)throw fail(409,'ไม่สามารถสมัครด้วยอีเมลนี้ได้ กรุณาลองเข้าสู่ระบบ');
          const salt=randomBytes(16).toString('hex'),digest=(await derive(password,salt,64)).toString('hex'),id=randomBytes(16).toString('hex');
          try{db.prepare('INSERT INTO users(id,email,password,created) VALUES(?,?,?,?)').run(id,email,`${salt}:${digest}`,new Date().toISOString());}catch{throw fail(409,'ไม่สามารถสมัครด้วยอีเมลนี้ได้');}
          user=db.prepare('SELECT * FROM users WHERE id=?').get(id);
        }else{
          const [salt,digest]=(user?.password||'invalid:'+ '0'.repeat(128)).split(':');const calculated=await derive(password,salt,64);
          if(!user||!timingSafeEqual(Buffer.from(digest,'hex'),calculated))throw fail(401,'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
        const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,Date.now()+604800000);
        reply(200,{user:publicUser(user)},{'Set-Cookie':cookie(req,token)});return true;
      }
      if(!u)throw fail(401,'กรุณาเข้าสู่ระบบก่อนใช้งาน');
      if(path==='/api/admin/users'&&req.method==='GET'){
        if(!isAdmin(u))throw fail(403,'เฉพาะผู้ดูแล');
        reply(200,{users:db.prepare('SELECT * FROM users ORDER BY created DESC LIMIT 200').all().map(publicUser)});return true;
      }
      if(path==='/api/payments'&&req.method==='GET'){reply(200,{payments:db.prepare('SELECT id,plan,status,created,reviewed,check_note FROM payments WHERE user_id=? ORDER BY created DESC').all(u.id)});return true;}
      if(path==='/api/payments'&&req.method==='POST'){
        if(!billing().ready)throw fail(503,'ผู้ดูแลยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณารอเปิดรับสมัคร');
        const data=await body(req);
        if(!['pro29','pro69'].includes(data.plan)||typeof data.reference!=='string'||data.reference.trim().length<5||data.reference.length>200)throw fail(400,'เลือกแพ็กเกจและระบุวันเวลา/เลขอ้างอิงการโอน');
        if(db.prepare("SELECT id FROM payments WHERE user_id=? AND status='pending'").get(u.id))throw fail(409,'มีคำขอรอตรวจสอบแล้ว');
        if(typeof data.slip!=='string'||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(data.slip))throw fail(400,'แนบสลิป PNG หรือ JPEG');
        const bytes=Buffer.from(data.slip.split(',')[1],'base64');
        if(bytes.length>3*1024*1024||!((bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))))throw fail(400,'รูปสลิปไม่ถูกต้องหรือใหญ่เกิน 3 MB');
        db.prepare('INSERT INTO payments(id,user_id,plan,reference,slip,created) VALUES(?,?,?,?,?,?)').run(randomBytes(16).toString('hex'),u.id,data.plan,data.reference.trim(),data.slip,new Date().toISOString());reply(200,{ok:true});return true;
      }
      if(path==='/api/admin/payments'&&req.method==='GET'){
        if(!isAdmin(u))throw fail(403,'เฉพาะผู้ดูแล');reply(200,{payments:db.prepare('SELECT p.*,u.email FROM payments p JOIN users u ON p.user_id=u.id ORDER BY p.created DESC LIMIT 100').all()});return true;
      }
      if(path==='/api/admin/review'&&req.method==='POST'){
        if(!isAdmin(u))throw fail(403,'เฉพาะผู้ดูแล');const data=await body(req);if(!['approve','reject'].includes(data.action))throw fail(400,'เลือกผลการตรวจ');
        db.exec('BEGIN IMMEDIATE');try{
          const p=db.prepare('SELECT * FROM payments WHERE id=?').get(String(data.id));if(!p||p.status!=='pending')throw fail(409,'คำขอนี้ถูกดำเนินการแล้ว');
          if(data.action==='approve'){
            const member=db.prepare('SELECT * FROM users WHERE id=?').get(p.user_id);
            if(planOf(member)!=='free'&&planOf(member)!==p.plan)throw fail(409,'บัญชีมีแพ็กเกจอื่นที่ยังไม่หมดอายุ ให้ติดต่อผู้ใช้และคืนเงินก่อนปฏิเสธคำขอ');
            const now=new Date(),expires=subscriptionEnd(now,member.expires);
            db.prepare('UPDATE users SET plan=?,expires=?,started=? WHERE id=?').run(p.plan,expires,planOf(member)==='free'?now.toISOString():member.started,p.user_id);
            db.prepare('INSERT INTO grants VALUES(?,?,?,?,?)').run(p.id,p.user_id,p.plan,expires,now.toISOString());
          }
          db.prepare('UPDATE payments SET status=?,reviewed=? WHERE id=?').run(data.action==='approve'?'approved':'rejected',new Date().toISOString(),p.id);db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e;}reply(200,{ok:true});return true;
      }
      if(path==='/api/logout'&&req.method==='POST'){
        const token=(req.headers.cookie||'').match(/(?:^|;\s*)lakhana_session=([^;]+)/)?.[1];if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));reply(200,{ok:true},{'Set-Cookie':cookie(req,'',0)});return true;
      }
      if(path==='/api/forecast'&&req.method==='POST'){
        const data=await body(req);periodDays(data.period,data.date);const plan=planOf(u);
        if(data.period==='monthly'&&plan==='free')throw fail(403,'รายเดือนและบทอ่านละเอียดสำหรับ Pro 29 หรือ Pro 69');
        const chart=await calculateChart(data.birth);
        const {name,...identity}=chart.birth;const key=hash(JSON.stringify({identity,date:data.date,period:data.period}));const week=weekKey();
        // Calculation finishes before a synchronous transaction: concurrent requests cannot overspend quota.
        const forecast=forecastProvider.calculate(chart,{period:data.period,date:data.date});
        if(plan==='free'){
          forecast.categories=forecast.categories.map(({daily,evidence,...c})=>({...c,evidence:[]}));delete forecast.transits;
        }
        if(plan==='free'){
          db.exec('BEGIN IMMEDIATE');try{
            const existing=db.prepare('SELECT result FROM usage WHERE user_id=? AND week=? AND reading_key=?').get(u.id,week,key);
            if(!existing){const used=db.prepare('SELECT COUNT(*) AS n FROM usage WHERE user_id=? AND week=?').get(u.id,week).n;if(used>=3)throw fail(403,'ใช้ครบ 3 ครั้งในสัปดาห์นี้แล้ว เริ่มสิทธิ์ใหม่วันจันทร์ 00:00 น. เวลาไทย หรือสมัคร Pro');db.prepare('INSERT INTO usage VALUES(?,?,?,?)').run(u.id,week,key,JSON.stringify(forecast));}
            db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
        }
        reply(200,{forecast,user:publicUser(u),detailed:plan!=='free'});return true;
      }
      if(path==='/api/premium'&&req.method==='POST'){
        if(planOf(u)!=='pro69')throw fail(403,'ไพ่ กราฟชีวิต และแนวทางทำบุญ สำหรับ Pro 69');
        const data=await body(req);periodDays(data.period,data.date);const chart=await calculateChart(data.birth);
        const key=JSON.stringify({period:data.period,date:data.date});const saved=db.prepare('SELECT result FROM cards WHERE user_id=? AND reading_key=?').get(u.id,key);
        const result=premiumReading(chart,data,saved?JSON.parse(saved.result):null);
        if(!saved)db.prepare('INSERT OR IGNORE INTO cards VALUES(?,?,?)').run(u.id,key,JSON.stringify(result.cards));
        reply(200,result);return true;
      }
      throw fail(404,'ไม่พบรายการนี้');
    }catch(error){reply(error.status||400,{error:error.status?error.message:'ประมวลผลไม่สำเร็จ กรุณาตรวจข้อมูลและลองอีกครั้ง'});}return true;
  }
  let processing=false;
  async function processPending(verifier=verifySlip){
    if(processing||!automaticPaymentsReady())return;processing=true;
    try{
      const rows=db.prepare("SELECT * FROM payments WHERE status='pending' AND attempts<3 AND (last_check IS NULL OR last_check<?) ORDER BY created LIMIT 10").all(new Date(Date.now()-180000).toISOString());
      for(const payment of rows){
        db.prepare('UPDATE payments SET attempts=attempts+1,last_check=? WHERE id=?').run(new Date().toISOString(),payment.id);
        try{
          const verified=await verifier(payment);
          db.exec('BEGIN IMMEDIATE');try{
            const current=db.prepare('SELECT status FROM payments WHERE id=?').get(payment.id);
            if(current.status!=='pending'){db.exec('ROLLBACK');continue;}
            const user=db.prepare('SELECT * FROM users WHERE id=?').get(payment.user_id);
            if(planOf(user)!=='free'&&planOf(user)!==payment.plan)throw Error('แพ็กเกจเดิมยังไม่หมดอายุ กรุณาให้ผู้ดูแลตรวจสอบ');
            if(db.prepare('SELECT reference FROM verified_transactions WHERE reference=?').get(verified.reference))throw Error('เลขอ้างอิงธุรกรรมนี้ใช้แล้ว');
            const now=new Date(),expires=subscriptionEnd(now,user.expires);
            db.prepare('INSERT INTO verified_transactions VALUES(?,?,?,?)').run(verified.reference,payment.id,verified.amount,verified.paidAt);
            db.prepare('UPDATE users SET plan=?,expires=?,started=? WHERE id=?').run(payment.plan,expires,planOf(user)==='free'?now.toISOString():user.started,user.id);
            db.prepare('INSERT INTO grants VALUES(?,?,?,?,?)').run(payment.id,user.id,payment.plan,expires,now.toISOString());
            db.prepare("UPDATE payments SET status='approved',reviewed=?,check_note=? WHERE id=?").run(now.toISOString(),'ยืนยันยอดและบัญชีผู้รับด้วยบริการตรวจสลิปแล้ว',payment.id);db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
        }catch(e){db.prepare('UPDATE payments SET check_note=? WHERE id=?').run('ยังไม่เปิดสิทธิ์: '+e.message+' · หากเกิน 10 นาทีให้ติดต่อผู้ดูแล',payment.id);}
      }
    }finally{processing=false;}
  }
  return {handle,db,publicUser,processPending};
}
