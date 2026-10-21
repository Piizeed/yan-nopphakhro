// Optional adapter; no external call is made unless explicitly configured.
// https://document.easyslip.com/en/v2/verify/bank/
const digits=s=>String(s||'').replace(/[^0-9]/g,'');
export function automaticPaymentsReady(){return process.env.PAYMENT_MODE==='easyslip'&&Boolean(process.env.EASYSLIP_API_KEY&&process.env.EASYSLIP_RECEIVER_ACCOUNT&&process.env.EASYSLIP_RECEIVER_BANK);}
export function validateSlipResult(result,{amount,created,now=new Date(),account=process.env.EASYSLIP_RECEIVER_ACCOUNT,bank=process.env.EASYSLIP_RECEIVER_BANK}){
  const d=result?.data,raw=d?.rawSlip;
  if(result?.success!==true||d?.isDuplicate!==false||d?.isAmountMatched!==true||d?.amountInSlip!==amount||raw?.amount?.amount!==amount)throw Error('ผลตรวจยอดหรือสถานะสลิปไม่ตรง กรุณาให้ผู้ดูแลตรวจสอบ');
  if(!account||!bank||digits(d.matchedAccount?.bankNumber)!==digits(account)||d.matchedAccount?.bank?.code!==bank||raw.countryCode!=='TH')throw Error('บัญชีผู้รับไม่ตรงกับที่กำหนด');
  if(raw.amount?.local?.currency&&raw.amount.local.currency!=='THB')throw Error('สกุลเงินไม่ตรง');
  const paidAt=new Date(raw.date),submitted=new Date(created);
  if(!Number.isFinite(paidAt.getTime())||paidAt>new Date(now.getTime()+60000)||paidAt<new Date(submitted.getTime()-86400000))throw Error('วันเวลาโอนไม่อยู่ในช่วงที่รับตรวจอัตโนมัติ');
  if(typeof raw.transRef!=='string'||!raw.transRef||raw.transRef.length>200)throw Error('ไม่พบเลขอ้างอิงธุรกรรมที่ตรวจสอบแล้ว');
  return {reference:raw.transRef,paidAt:paidAt.toISOString(),amount};
}
export async function verifySlip(payment){
  if(!automaticPaymentsReady())throw Error('ยังไม่เชื่อมบริการตรวจสลิป');
  const amount=payment.plan==='pro29'?29:69;
  const response=await fetch('https://api.easyslip.com/v2/verify/bank',{method:'POST',headers:{Authorization:`Bearer ${process.env.EASYSLIP_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({base64:payment.slip,remark:payment.id,matchAccount:true,matchAmount:amount,checkDuplicate:true}),signal:AbortSignal.timeout(20000)});
  const result=await response.json();
  if(!response.ok)throw Error(result?.error?.code==='SLIP_PENDING'?'ธนาคารยังไม่พร้อมตรวจสลิป':'บริการตรวจสลิปยังยืนยันรายการไม่ได้');
  return validateSlipResult(result,{amount,created:payment.created});
}
