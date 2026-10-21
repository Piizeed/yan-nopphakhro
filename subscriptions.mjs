export function thailandDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
// Exclusive cutoff: joining October 21 lasts through November 21 in Thailand.
export function subscriptionEnd(start=new Date(),existingExpiry=null){
  const active=existingExpiry&&new Date(existingExpiry)>start;
  const anchor=active?new Date(new Date(existingExpiry).getTime()-1):start;
  const [year,month,day]=thailandDay(anchor).split('-').map(Number);
  const next=new Date(Date.UTC(year,month,1));
  const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
  next.setUTCDate(Math.min(day,last)+1);
  return new Date(next.getTime()-7*3600000).toISOString();
}
