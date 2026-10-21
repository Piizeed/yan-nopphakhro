import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSlipResult} from '../slip-verifier.mjs';
import {createMembership} from '../membership.mjs';
const options={amount:29,created:'2026-10-21T05:05:00Z',now:new Date('2026-10-21T05:10:00Z'),account:'1234567890',bank:'004'};
const valid={success:true,data:{isDuplicate:false,isAmountMatched:true,amountInSlip:29,matchedAccount:{bankNumber:'123-4-56789-0',bank:{code:'004'}},rawSlip:{transRef:'UNIQUE-123',date:'2026-10-21T05:00:00Z',countryCode:'TH',amount:{amount:29,local:{currency:'THB'}}}}};
test('automatic verification rejects wrong recipient, wrong amount, duplicates and old slips',()=>{
  assert.equal(validateSlipResult(valid,options).reference,'UNIQUE-123');
  for(const mutate of [r=>r.success=false,r=>r.data.isDuplicate=true,r=>r.data.amountInSlip=1,r=>r.data.isAmountMatched=false,r=>r.data.matchedAccount=null,r=>r.data.matchedAccount.bank.code='014',r=>r.data.matchedAccount.bankNumber='0000000000',r=>r.data.rawSlip.date='2020-01-01',r=>r.data.rawSlip.transRef='',r=>r.data.rawSlip.amount.local.currency='USD']){const r=structuredClone(valid);mutate(r);assert.throws(()=>validateSlipResult(r,options));}
});
test('automatic worker grants once, persists reference and does not grant when verification fails',async t=>{
  const keys=['PAYMENT_MODE','EASYSLIP_API_KEY','EASYSLIP_RECEIVER_ACCOUNT','EASYSLIP_RECEIVER_BANK'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{PAYMENT_MODE:'easyslip',EASYSLIP_API_KEY:'fake-for-unit-test',EASYSLIP_RECEIVER_ACCOUNT:'1234567890',EASYSLIP_RECEIVER_BANK:'004'});
  const service=createMembership(':memory:');t.after(()=>{service.db.close();for(const key of keys)if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];});
  service.db.prepare('INSERT INTO users(id,email,password) VALUES(?,?,?)').run('one','one@example.invalid','unused');
  const insert=id=>service.db.prepare('INSERT INTO payments(id,user_id,plan,reference,slip,created) VALUES(?,?,?,?,?,?)').run(id,'one','pro29','client-reference','unused',new Date().toISOString());
  insert('first');const verify=async()=>({reference:'BANK-ONE',paidAt:new Date().toISOString(),amount:29});
  await service.processPending(verify);const expiry=service.db.prepare('SELECT expires FROM users').get().expires;assert.ok(expiry);
  await service.processPending(verify);assert.equal(service.db.prepare('SELECT expires FROM users').get().expires,expiry);
  insert('second');await service.processPending(verify);assert.equal(service.db.prepare('SELECT expires FROM users').get().expires,expiry);assert.equal(service.db.prepare('SELECT COUNT(*) AS n FROM grants').get().n,1);
  insert('third');await service.processPending(async()=>{throw Error('unverified');});assert.equal(service.db.prepare("SELECT status FROM payments WHERE id='third'").get().status,'pending');
});
