// Read-only connection check. Never print credentials or raw provider responses.
process.loadEnvFile('.env');
const key=process.env.EASYSLIP_API_KEY;
if(!key){console.log(JSON.stringify({configured:false}));process.exit(1);}
const get=async path=>{const res=await fetch('https://api.easyslip.com/v2/'+path,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(20000)});let data;try{data=await res.json();}catch{return {http:res.status,success:false};}return {http:res.status,...data};};
try{
  const info=await get('info');
  if(info.success!==true){console.log(JSON.stringify({authenticated:false,http:info.http,errorCode:info.error?.code}));process.exitCode=1;}
  else{
    const accounts=await get('bank-accounts?limit=100');
    const normalize=s=>String(s||'').replace(/\D/g,'');
    const match=accounts.data?.items?.find(a=>normalize(a.bankNumber)===normalize(process.env.EASYSLIP_RECEIVER_ACCOUNT)&&a.bankCode===process.env.EASYSLIP_RECEIVER_BANK);
    console.log(JSON.stringify({authenticated:true,branchActive:info.data?.branch?.isActive,quota:info.data?.application?.quota,product:info.data?.product?.name,accountsHTTP:accounts.http,receiverLinked:Boolean(match),receiverNameMatches:match?match.nameTh===process.env.PAYMENT_NAME:null}));
  }
}catch{console.log(JSON.stringify({connected:false,error:'Network request failed; no credentials logged.'}));process.exitCode=1;}
