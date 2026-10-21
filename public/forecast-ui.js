import { todayBangkok } from './astro.js';
import {api,member,escapeHTML} from './member-ui.js';
let currentForecast=null,detailed=false,requestVersion=0;

let period = 'daily';
let selectedDay = todayBangkok();
let selectedMonth = selectedDay.slice(0, 7);
const selectedDate = () => period === 'daily' ? selectedDay : selectedMonth;

function controls() {
  const daily = period === 'daily';
  return `<label for="forecast-date">${daily ? 'เลือกวันที่ต้องการอ่าน (ค.ศ.)' : 'เลือกเดือนที่ต้องการอ่าน (ค.ศ.)'}</label>
    <div class="forecast-date-row"><input id="forecast-date" type="${daily ? 'date' : 'month'}"
      value="${selectedDate()}" min="${daily ? '1900-01-01' : '1900-01'}"
      max="${daily ? '2100-12-31' : '2100-12'}" required>
    <button type="button" class="outline" data-forecast-today>${daily ? 'วันนี้' : 'เดือนนี้'}</button></div>`;
}

function body(chart) {
  const forecast = currentForecast;
  if(!forecast)return `<p>${period==='monthly'&&member.plan==='free'?'รายเดือนสำหรับ Pro 29 และ Pro 69':member.plan==='free'?'กดเปิดบทอ่านเพื่อใช้สิทธิ์ รายวัน Free เหลือ '+Math.max(0,3-member.used)+' ครั้งในสัปดาห์นี้ เปิดดวงเดิมวันเดิมซ้ำไม่เสียสิทธิ์':'แพ็กเกจของคุณเปิดรายวันและรายเดือนได้ไม่จำกัด'}</p><button class="primary" data-load-forecast>เปิดบทอ่าน${period==='daily'?'รายวัน':'รายเดือน'}</button> <a href="#pricing">ดูแพ็กเกจ</a>`;
  const date = new Date(`${period === 'daily' ? forecast.date : forecast.date + '-01'}T12:00:00+07:00`);
  const dateLabel = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: 'long',
    ...(period === 'daily' ? { day: 'numeric', weekday: 'long' } : {}),
  }).format(date);
  return `<div class="forecast-intro"><span class="eyebrow">${period === 'daily' ? 'DAILY' : 'MONTHLY'} TRANSITS · จากดาวจรจริง</span>
    <p class="forecast-date-label">${dateLabel}</p><h3>${forecast.title}</h3><p>${forecast.summary}</p></div>
    <div class="forecast-grid">${forecast.categories.map(category => `<article class="forecast-category">
      <div class="forecast-category-heading"><h3><span>${category.icon}</span> ${category.name}</h3>
        <strong>${category.score}<small> / 100</small></strong></div>
      <span class="forecast-mood">${category.label}</span><p>${category.detail}</p>
      ${detailed?`${category.evidence.length?`<p class="evidence-highlight">✧ ${category.evidence[0].description}</p>`:'<p class="evidence-highlight">ไม่มีมุมหลักในออร์บที่กำหนด ใช้ดัชนีกลาง 50</p>'}
      <details class="forecast-evidence"><summary>ดูเหตุผลจากมุมดาว</summary><ul>${category.evidence.map(e=>`<li><strong>${e.description}</strong><br>ห่างมุมสนิท ${e.orb.toFixed(2)}°${e.house?` · ดาวจรอยู่เรือน ${e.house}`:''}${period==='monthly'?`<br>พบ ${e.activeDays} วัน · ใกล้ที่สุดในชุดตัวอย่าง ${e.peakDate}`:''}</li>`).join('')}</ul><small>ออร์บสูงสุด 6° · แสดงเหตุผลเด่นไม่เกิน 4 รายการ <a href="#method">ดูสูตรดัชนี</a></small></details>`:'<p class="fine">Pro เพิ่มเหตุผลจากมุมดาวและแผนรายเดือน <a href="#pricing">ดูแพ็กเกจ</a></p>'}
      </article>`).join('')}</div>
    <div class="forecast-takeaways"><div><span>✧ ลองให้เวลากับ</span><p>${forecast.focus}</p></div>
      <div><span>☽ ข้อควรใส่ใจ</span><p>${forecast.caution}</p></div></div>
    ${period==='monthly'?`<details class="monthly-daily-table"><summary>ดูดัชนีรายวันทั้งเดือน (${forecast.sampleCount} วัน)</summary><div class="table-wrap"><table><thead><tr><th>วันที่ (ค.ศ.)</th>${forecast.categories.map(c=>`<th>${c.name}</th>`).join('')}</tr></thead><tbody>${forecast.categories[0].daily.map((d,i)=>`<tr><td><button class="text-link" data-forecast-day="${d.date}">${d.date} ↗</button></td>${forecast.categories.map(c=>`<td>${c.daily[i].score}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`:''}
    <p class="forecast-note">ดัชนีเป็นการตีความตามกฎของญาณนพเคราะห์ ไม่ใช่โอกาสสำเร็จหรือการรับรองเหตุการณ์ ${forecast.samplingNote}</p>
    ${chart.birth.unknown?'<p class="forecast-note">ไม่ทราบเวลาเกิด: งดใช้จันทร์กำเนิดและเรือนในการอ่าน ใช้ดาวกำเนิดเวลาเที่ยงโดยประมาณ</p>':''}
    <button type="button" class="text-link" data-export-forecast>ดาวน์โหลดบทอ่านและข้อมูลดาวจร JSON ↓</button>`;
}

export function forecastMarkup(chart) {
  currentForecast=null;requestVersion++;
  return `<section class="card forecast-section" aria-labelledby="forecast-heading">
    <div class="forecast-top"><div><span class="eyebrow">YOUR RHYTHM, DAY BY DAY</span>
      <h2 id="forecast-heading">จังหวะชีวิตรายวัน · รายเดือน</h2>
      <p>เทียบดาวจรกับดวงกำเนิด พร้อมมุมดาวที่ใช้ประกอบบทอ่าน</p></div>
      <div class="forecast-switch" role="group" aria-label="เลือกรูปแบบบทอ่าน">
        <button type="button" data-forecast-period="daily" aria-pressed="${period === 'daily'}">รายวัน</button>
        <button type="button" data-forecast-period="monthly" aria-pressed="${period === 'monthly'}">รายเดือน</button>
      </div></div><div id="forecast-controls">${controls()}</div>
    <div id="forecast-body" aria-live="polite" aria-atomic="true">${body(chart)}</div><hr><h3>ไพ่ · กราฟชีวิต · แนวทางทำบุญ</h3><p>Pro 69 อ่านไพ่ของวันหรือเดือนที่เลือก พร้อมกราฟ 12 เดือน</p><button class="outline" data-premium>เปิดพื้นที่ Pro 69</button><div id="premium-body" aria-live="polite"></div></section>`;
}

export function wireForecast(chart) {
  const section = document.querySelector('.forecast-section');
  if (!section || !chart) return;
  const refresh = () => {
    const target = section.querySelector('#forecast-body');
    try { target.innerHTML = body(chart); }
    catch (error) {
      target.replaceChildren();
      const message = document.createElement('p');
      message.className = 'forecast-error';
      message.setAttribute('role', 'alert');
      message.textContent = error.message;
      target.append(message);
    }
  };
  section.addEventListener('click', async event => {
    if(event.target.closest('[data-load-forecast]')){const token=++requestVersion;const btn=event.target.closest('button');btn.disabled=true;try{const r=await api('forecast',{birth:chart.birth,period,date:selectedDate()});if(token!==requestVersion)return;currentForecast=r.forecast;detailed=r.detailed;refresh();}catch(e){if(token===requestVersion){refresh();const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=e.message;section.querySelector('#forecast-body').prepend(p);}}return;}
    if(event.target.closest('[data-premium]')){const target=section.querySelector('#premium-body'),token=requestVersion;target.textContent='กำลังเปิดไพ่และคำนวณกราฟ…';try{const r=await api('premium',{birth:chart.birth,period,date:selectedDate()});if(token!==requestVersion)return;target.innerHTML=premiumMarkup(r);}catch(e){if(token===requestVersion)target.textContent=e.message;}return;}
    if(event.target.closest('[data-export-forecast]')) {
      const forecast=currentForecast;if(!forecast)return;
      const url=URL.createObjectURL(new Blob([JSON.stringify({birth:chart.birth,chartMetadata:chart.metadata,...forecast},null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`lakhana-${period}-${selectedDate()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
    }
    const day=event.target.closest('[data-forecast-day]');
    const tab = event.target.closest('[data-forecast-period]');
    const today = event.target.closest('[data-forecast-today]');
    if (!tab && !today && !day) return;
    currentForecast=null;requestVersion++;section.querySelector('#premium-body').replaceChildren();
    if(day) {period='daily';selectedDay=day.dataset.forecastDay;}
    if (tab) period = tab.dataset.forecastPeriod;
    if (today) {
      if (period === 'daily') selectedDay = todayBangkok();
      else selectedMonth = todayBangkok().slice(0, 7);
    }
    section.querySelectorAll('[data-forecast-period]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.forecastPeriod === period));
    });
    section.querySelector('#forecast-controls').innerHTML = controls();
    refresh();
    if (today) section.querySelector('[data-forecast-today]').focus();
    if(day) {section.querySelector('#forecast-date').focus();section.querySelector('.forecast-top').scrollIntoView({block:'start'});}
  });
  section.addEventListener('change', event => {
    if (event.target.id !== 'forecast-date') return;
    const input = event.target;
    // Keep the last valid date when a native date/month input is cleared.
    if (!input.value || !input.checkValidity()) {
      input.reportValidity();
      input.value = selectedDate();
      return;
    }
    currentForecast=null;requestVersion++;section.querySelector('#premium-body').replaceChildren();
    if (period === 'daily') selectedDay = input.value;
    else selectedMonth = input.value;
    refresh();
  });
}

function premiumMarkup(r){const points=r.graph.map((p,i)=>(30+i*48)+','+(190-p.score*1.6)).join(' ');return '<div class="forecast-grid">'+r.cards.map((c,i)=>'<article class="card tarot-card"><span class="eyebrow">'+['สิ่งที่ให้ความสำคัญ','สิ่งที่ควรทบทวน','แนวทางลงมือ'][i]+'</span><div class="tarot-symbol">✧</div><h3>'+escapeHTML(c.name)+' · '+escapeHTML(c.title)+'</h3><p>'+escapeHTML(c.text)+'</p></article>').join('')+'</div><h3>'+escapeHTML(r.graphLabel)+'</h3><svg viewBox="0 0 600 230" role="img" aria-label="กราฟดัชนีรายเดือน มีตารางข้อมูลด้านล่าง" style="width:100%"><path d="M30 30V190H580" fill="none" stroke="#a2b7a4"/><polyline points="'+points+'" fill="none" stroke="#163e36" stroke-width="3"/>'+r.graph.map((p,i)=>'<circle cx="'+(30+i*48)+'" cy="'+(190-p.score*1.6)+'" r="4" fill="#b5894e"/><text x="'+(30+i*48)+'" y="215" font-size="12">'+(i+1)+'</text>').join('')+'</svg><details><summary>ดูค่าดัชนีทุกเดือน</summary><div class="table-wrap"><table><thead><tr><th>เดือน</th><th>เฉลี่ย</th>'+r.graph[0].categories.map(c=>'<th>'+c.name+'</th>').join('')+'</tr></thead><tbody>'+r.graph.map(p=>'<tr><td>'+p.month+'</td><td>'+p.score+'</td>'+p.categories.map(c=>'<td>'+c.score+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details><p class="fine">'+escapeHTML(r.note)+'</p><div class="forecast-grid">'+r.rituals.map(x=>'<article class="card"><h3>'+escapeHTML(x.title)+'</h3><p>'+escapeHTML(x.text)+'</p></article>').join('')+'</div>';}
