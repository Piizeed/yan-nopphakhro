import { angularDistance, signs, houseNames } from './astro.js';
// Product-owned interpretation rules, not a validated probability or a claim of causation.
export const RULE_VERSION = 'lakhana-rules-v1';
export const categories = [
  {id:'work',name:'การงาน',icon:'↗',anchors:['mercury','sun','saturn'],houses:[6,10],
    supportive:'ใช้จังหวะนี้จัดระบบงาน นำเสนอสิ่งที่เตรียมไว้ และขอความคิดเห็นให้ชัดเจน',
    balanced:'เลือกงานหลักหนึ่งเรื่องแล้วทำให้จบ สรุปข้อตกลงและเผื่อเวลาตรวจรายละเอียด',
    demanding:'ลดการรับงานซ้อน ทบทวนกำหนดส่ง และคุยขอบเขตความรับผิดชอบก่อนตัดสินใจ',focus:'เตรียมข้อมูลและนัดคุยเรื่องงาน',caution:'รับปากงานโดยยังไม่ประเมินเวลาที่มี'},
  {id:'money',name:'การเงิน',icon:'◈',anchors:['venus','jupiter','mercury'],houses:[2,11],
    supportive:'ใช้เวลาจัดรายการรับจ่ายและทบทวนแผนที่มี ให้ความสำคัญกับข้อมูลที่ตรวจสอบได้ก่อนใช้เงิน',
    balanced:'ตรวจยอดที่ต้องจ่ายและจดรายจ่ายเล็ก ๆ เพื่อให้เห็นภาพการใช้เงินของตัวเอง',
    demanding:'ชะลอการซื้อที่ไม่ได้วางแผน ตรวจเงื่อนไขและยอดรวมให้ครบก่อนตกลง',focus:'จัดระเบียบรายรับรายจ่าย',caution:'ใช้คะแนนดวงเป็นเหตุผลเดียวในการใช้เงิน'},
  {id:'love',name:'ความรัก',icon:'♡',anchors:['venus','moon'],houses:[5,7],
    supportive:'แบ่งเวลาให้บทสนทนาที่ตั้งใจฟัง แสดงความใส่ใจโดยไม่เร่งคำตอบหรือสถานะของอีกฝ่าย',
    balanced:'คุยเรื่องที่อยากให้เข้าใจด้วยถ้อยคำตรงไปตรงมา พร้อมรับฟังความต้องการของอีกฝ่าย',
    demanding:'เว้นระยะก่อนตอบเมื่อรู้สึกกดดัน อย่ารีบสรุปเจตนาจากข้อความสั้น ๆ',focus:'ฟังและบอกความต้องการอย่างอ่อนโยน',caution:'คาดหวังให้อีกฝ่ายรู้โดยไม่พูด'},
  {id:'energy',name:'พลังใจ',icon:'☀',anchors:['sun','moon','mars'],houses:[1,4],
    supportive:'นำความตั้งใจไปทำสิ่งที่มีความหมายกับตัวเอง ตั้งเป้าหมายเล็ก ๆ และเผื่อเวลาพัก',
    balanced:'จัดตารางให้มีทั้งหน้าที่และเวลาส่วนตัว สังเกตว่ากิจกรรมใดช่วยให้กลับมามีสมาธิ',
    demanding:'ลดสิ่งที่ต้องทำให้เหลือเท่าที่ไหว อย่าใช้ความสำเร็จของคนอื่นเป็นมาตรวัดตัวเอง',focus:'จัดเวลาส่วนตัวให้เป็นรูปธรรม',caution:'เร่งทำทุกอย่างจนไม่ได้พัก'},
];
export const aspects = [{angle:0,name:'กุม',effect:0},{angle:60,name:'โยค 60°',effect:1},{angle:90,name:'ฉาก 90°',effect:-1},{angle:120,name:'ตรีโกณ 120°',effect:1},{angle:180,name:'เล็ง 180°',effect:-1}];
const weights = {sun:5,moon:4,mars:7,mercury:5,jupiter:8,venus:6,saturn:8};
export function aspectBetween(a,b,orbLimit=6) {
  const separation = angularDistance(a,b);
  const aspect = aspects.map(x=>({...x,orb:Math.abs(separation-x.angle)})).sort((x,y)=>x.orb-y.orb)[0];
  return aspect.orb <= orbLimit ? {...aspect,separation} : null;
}
export function evidenceFor(chart, transits, category, natal=false) {
  const anchors=chart.planets.filter(p=>category.anchors.includes(p.id)&&!(chart.birth.unknown&&p.id==='moon'));
  const candidates=transits.filter(p=>weights[p.id]&&!(natal&&chart.birth.unknown&&p.id==='moon'));
  const evidence=[]; const seen=new Set();
  for(const transit of candidates) for(const anchor of anchors) {
    if(natal && transit.id===anchor.id) continue;
    const pair=natal?[transit.id,anchor.id].sort().join('|'):`${transit.id}|${anchor.id}`;
    if(seen.has(pair)) continue;
    const aspect=aspectBetween(transit.longitude,anchor.longitude);
    if(!aspect) continue;
    seen.add(pair);
    const effect=aspect.angle===0?(['venus','jupiter'].includes(transit.id)?1:['saturn','mars'].includes(transit.id)?-0.7:0.35):aspect.effect;
    const contribution=effect*weights[transit.id]*(1-aspect.orb/6);
    evidence.push({key:`${pair}|${aspect.angle}`,transit:transit.id,transitName:transit.name,natal:anchor.id,natalName:anchor.name,
      angle:aspect.angle,aspect:aspect.name,orb:aspect.orb,contribution,transitLongitude:transit.longitude,natalLongitude:anchor.longitude,
      description:`${transit.name}${natal?'กำเนิด':'จร'} ${aspect.name} ${anchor.name}กำเนิด`,
      house:chart.ascendant===null?null:(transit.sign-chart.ascendant+12)%12+1 });
  }
  return evidence.sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution));
}
export function scoreEvidence(evidence) {
  return Math.round(Math.max(10,Math.min(90,50+evidence.slice(0,5).reduce((sum,e)=>sum+e.contribution,0)*2)));
}
export function categoryReading(category,score,period='daily') {
  const level=score>=60?'supportive':score<45?'demanding':'balanced';
  return {label:{supportive:'จังหวะสนับสนุน',balanced:'รักษาสมดุล',demanding:'ค่อยเป็นค่อยไป'}[level],detail:(period==='monthly'?'ภาพรวมเดือนนี้: ':'')+category[level]};
}
export function natalScores(chart) {
  return categories.map(c=>{const evidence=evidenceFor(chart,chart.planets,c,true);return {...c,value:scoreEvidence(evidence),evidence,ruleVersion:RULE_VERSION};});
}
const elementText=['เน้นการริเริ่มและลงมือทำ ควรเผื่อจังหวะรับฟังและทบทวนก่อนเร่งไปข้างหน้า','ให้ความสำคัญกับความเป็นรูปธรรมและความสม่ำเสมอ ลองเปิดพื้นที่ให้วิธีใหม่เมื่อแผนเดิมไม่ตอบโจทย์','สนใจความคิด การแลกเปลี่ยน และการมองหลายมุม การเลือกสิ่งสำคัญช่วยให้ไม่กระจายแรงมากเกินไป','ให้ความสำคัญกับความรู้สึกและความผูกพัน การบอกขอบเขตของตัวเองช่วยให้ดูแลความสัมพันธ์ได้พอดี'];
export function interpretNatal(chart) {
  const sun=chart.planets.find(p=>p.id==='sun');
  const moon=chart.planets.find(p=>p.id==='moon');
  const sections=[{title:`อาทิตย์ในราศี${signs[sun.sign]}`,text:`ตามกรอบการอ่านเชิงสัญลักษณ์ ราศีนี้${elementText[sun.sign%4]}`}];
  if(!chart.birth.unknown) {
    sections.push({title:`ลัคนาราศี${signs[chart.ascendant]}`,text:`อ่านเป็นวิธีเริ่มต้นและแสดงตัวตน: ${elementText[chart.ascendant%4]}`});
    sections.push({title:`จันทร์ในราศี${signs[moon.sign]}`,text:`ใช้สำรวจด้านความรู้สึกและความคุ้นเคย: ${elementText[moon.sign%4]}`});
  }
  for(const c of categories) {
    const p=chart.planets.find(p=>p.id===c.anchors[0]);
    sections.push({title:c.name,text:`จุดอ้างอิงหลักคือ${p.name}กำเนิดในราศี${signs[p.sign]}${p.house?` เรือนที่ ${p.house} (${houseNames[p.house-1]})`:''} — ${c.balanced}`});
  }
  return {source:'rule-based',ruleVersion:RULE_VERSION,title:'พื้นดวงของคุณ จากตำแหน่งดาวที่คำนวณได้',
    text:'บทอ่านนี้ใช้ตำแหน่งดาว ราศี และเรือนเป็นกรอบทบทวนตัวเอง เป็นการตีความตามกฎที่เปิดเผย ไม่ใช่ข้อสรุปทางวิทยาศาสตร์เกี่ยวกับบุคลิกหรืออนาคต',sections};
}
