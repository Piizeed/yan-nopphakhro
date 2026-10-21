import { positionsAt, thaiLocalToUTC, validDay, todayBangkok } from './astro.js';
import { categories, evidenceFor, scoreEvidence, categoryReading, RULE_VERSION } from './rules.js';
export { todayBangkok };

export function periodDays(period,date) {
  if(!['daily','monthly'].includes(period)) throw Error('กรุณาเลือกรายวันหรือรายเดือน');
  const pattern=period==='daily'?/^\d{4}-\d{2}-\d{2}$/:/^\d{4}-\d{2}$/;
  const day=period==='daily'?date:`${date}-01`;
  if(!pattern.test(date)||!validDay(day)||day<'1900-01-01'||day>'2100-12-31') throw Error('กรุณาเลือกวันที่หรือเดือนจริง ระหว่างปี 1900–2100');
  if(period==='daily') return [day];
  const [year,month]=date.split('-').map(Number);
  const count=new Date(Date.UTC(year,month,0)).getUTCDate();
  return Array.from({length:count},(_,i)=>`${date}-${String(i+1).padStart(2,'0')}`);
}
export const forecastProvider = {
  calculate(chart,{period,date}) {
    if(chart.source!=='ephemeris'||chart.schemaVersion!==2) throw Error('กรุณาผูกดวงใหม่เพื่อใช้ผลคำนวณจริง');
    const days=periodDays(period,date);
    const samples=days.map(day=>({date:day,...positionsAt(thaiLocalToUTC(day,'12:00'))}));
    const result=categories.map(category=>{
      const daily=samples.map(sample=>{
        const evidence=evidenceFor(chart,sample.planets,category);
        return {date:sample.date,score:scoreEvidence(evidence),evidence};
      });
      const score=Math.round(daily.reduce((sum,d)=>sum+d.score,0)/daily.length);
      const combined=new Map();
      for(const day of daily) for(const event of day.evidence) {
        const existing=combined.get(event.key);
        if(!existing) combined.set(event.key,{...event,peakDate:day.date,activeDays:1});
        else {
          const activeDays=existing.activeDays+1;
          if(event.orb<existing.orb) combined.set(event.key,{...event,peakDate:day.date,activeDays});
          else existing.activeDays=activeDays;
        }
      }
      const evidence=[...combined.values()].sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)).slice(0,4);
      return {id:category.id,name:category.name,icon:category.icon,score,...categoryReading(category,score,period),evidence,
        daily:daily.map(d=>({date:d.date,score:d.score})),focus:category.focus,caution:category.caution};
    });
    const ranked=[...result].sort((a,b)=>b.score-a.score);
    const top=ranked[0],bottom=ranked.at(-1);
    const summary=period==='daily'
      ?`อ่านจากดาวจรเวลา 12:00 น. ของวันที่เลือก เทียบกับดวงกำเนิดของคุณ หมวด${top.name}มีดัชนีสูงสุดที่ ${top.score}/100 และ${bottom.name}อยู่ที่ ${bottom.score}/100`
      :`ประมวลผลดาวจรเวลา 12:00 น. ครบ ${days.length} วัน แล้วเฉลี่ยดัชนีรายวัน เดือนนี้${top.name}มีค่าเฉลี่ยสูงสุดที่ ${top.score}/100 และ${bottom.name}อยู่ที่ ${bottom.score}/100`;
    return {schemaVersion:2,source:'rule-based-transits',ruleVersion:RULE_VERSION,timezone:'Asia/Bangkok',period,date,
      title:top.score===bottom.score?'รักษาจังหวะและทบทวนแผนของตัวเอง':`สำรวจ${top.name} พร้อมดูแล${bottom.name}`,summary,
      focus:top.focus,caution:bottom.caution,categories:result,
      sampleCount:days.length,sampleTime:'12:00 Asia/Bangkok',
      samplingNote:'เป็นการอ่านจากภาพดาวเวลาเที่ยง ไม่ใช่การหาเวลามุมสนิทหรือฤกษ์แบบนาทีต่อนาที',
      uncertainty:chart.uncertainty,
      transits:samples.map(s=>({date:s.date,utc:s.utc,julianDayUT:s.julianDayUT,planets:s.planets})),
    };
  },
};
