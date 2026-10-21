import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ephemerisProvider,interpretationProvider,validateBirth,places} from '../public/services.js';
import {initEphemeris,positionsAt,normalize,thaiLocalToUTC,angularDistance} from '../public/astro.js';
import {forecastProvider,periodDays} from '../public/forecasts.js';
import {aspectBetween} from '../public/rules.js';
const birth={name:'ดาว',date:'1995-06-15',time:'09:30',unknown:false,place:'bangkok',locationMode:'custom',lat:13.7563,lon:100.5018};

test('WASM positions and sidereal ascendants match native reference at five epochs',async()=>{
  const reference=JSON.parse(await readFile(new URL('./fixtures/ephemeris-reference.json',import.meta.url),'utf8'));
  const swe=await initEphemeris();
  for(const c of reference.cases){
    const utc=new Date(Math.round((c.jd-2440587.5)*86400000));
    const result=positionsAt(utc);
    for(let i=0;i<c.positions.length;i++){
      assert.ok(angularDistance(result.planets[i].longitude,c.positions[i].longitude)<0.00002,`${c.name}: longitude ${i}`);
      assert.ok(Math.abs(result.planets[i].speed-c.positions[i].speed)<0.00002,`${c.name}: speed ${i}`);
    }
    const houses=swe.calculateHouses(c.jd,c.lat,c.lon,'W');
    const asc=normalize(houses.ascendant-swe.getAyanamsaExUt(c.jd,4));
    assert.ok(angularDistance(asc,c.ascendant)<0.00002,`${c.name}: ascendant ${asc} vs ${c.ascendant}`);
    const first=Math.floor(asc/30)*30;
    c.cusps.forEach((cusp,i)=>assert.ok(angularDistance(normalize(first+i*30),cusp)<0.00002));
  }
});
test('real chart contains provenance, houses, speeds and opposing nodes',async()=>{
  const a=await ephemerisProvider.calculate(birth);
  assert.deepEqual(a,await ephemerisProvider.calculate(birth));
  assert.equal(a.source,'ephemeris');assert.equal(a.metadata.ephemeris,'Moshier');
  assert.equal(a.utc,'1995-06-15T02:30:00.000Z');assert.equal(a.houses.length,12);
  assert.equal(a.planets.length,9);
  assert.ok(a.planets.every(p=>p.longitude>=0&&p.longitude<360&&p.house>=1&&p.house<=12&&p.navamsaSign>=0&&p.navamsaSign<12));
  assert.ok(Math.abs(angularDistance(a.planets[7].longitude,a.planets[8].longitude)-180)<1e-8);
  assert.equal((await interpretationProvider.interpret(a)).source,'rule-based');
});
test('same instant gives same geocentric planets, birthplace changes ascendant',async()=>{
  const a=await ephemerisProvider.calculate(birth);
  const b=await ephemerisProvider.calculate({...birth,lat:18.7883,lon:98.9853});
  assert.deepEqual(a.planets.map(p=>p.longitude),b.planets.map(p=>p.longitude));
  assert.ok(angularDistance(a.ascendantLongitude,b.ascendantLongitude)>0.1);
});
test('unknown time suppresses houses and natal Moon scoring and exposes daily ranges',async()=>{
  const chart=await ephemerisProvider.calculate({...birth,unknown:true,time:''});
  assert.equal(chart.ascendant,null);assert.deepEqual(chart.houses,[]);
  assert.ok(chart.planets.every(p=>p.house===null&&p.dayRange));
  assert.ok(chart.scores.every(c=>c.evidence.every(e=>e.natal!=='moon'&&e.transit!=='moon')));
  const forecast=forecastProvider.calculate(chart,{period:'daily',date:'2026-10-21'});
  assert.ok(forecast.categories.every(c=>c.evidence.every(e=>e.natal!=='moon'&&e.house===null)));
});
test('dates and coordinates reject invalid values instead of normalizing silently',()=>{
  for(const patch of [{date:'1995-02-30'},{date:'2025-02-29'},{date:'2099-01-01'},{time:'25:00'},{place:'unknown'},{name:''},{lat:''},{lat:NaN},{lon:180},{locationMode:'guess'}]) assert.throws(()=>validateBirth({...birth,...patch}));
  for(const p of places) assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon));
});
test('time conversion respects Bangkok historic offset and nonexistent clock time',()=>{
  assert.equal(thaiLocalToUTC('2000-01-01','19:00').toISOString(),'2000-01-01T12:00:00.000Z');
  assert.equal(thaiLocalToUTC('1900-01-01','12:00').toISOString(),'1900-01-01T05:17:56.000Z');
  assert.throws(()=>thaiLocalToUTC('1920-04-01','00:05'));
});
test('unknown time on a historical clock-change day uses the first valid minute',async()=>{
  const chart=await ephemerisProvider.calculate({...birth,date:'1920-04-01',unknown:true,time:''});
  assert.equal(chart.ascendant,null);
  assert.equal(chart.planets[0].dayRange.startTime,'00:18');
  assert.ok(chart.uncertainty.some(text=>text.includes('00:18')));
});
test('monthly forecast samples every calendar day and averages daily scores',async()=>{
  const chart=await ephemerisProvider.calculate(birth);
  const f=forecastProvider.calculate(chart,{period:'monthly',date:'2024-02'});
  assert.equal(periodDays('monthly','2024-02').length,29);assert.equal(f.sampleCount,29);
  assert.equal(f.transits[0].utc,'2024-02-01T05:00:00.000Z');
  for(const c of f.categories){assert.equal(c.score,Math.round(c.daily.reduce((n,d)=>n+d.score,0)/29));assert.ok(c.evidence.every(e=>e.activeDays<=29));}
  const last=forecastProvider.calculate(chart,{period:'daily',date:'2024-02-29'});
  f.categories.forEach((c,i)=>assert.equal(c.daily.at(-1).score,last.categories[i].score));
});
test('aspect evidence uses actual angular separation including zodiac wrap',()=>{
  assert.equal(aspectBetween(359,1).angle,0);assert.equal(aspectBetween(359,1).orb,2);
  assert.equal(aspectBetween(0,90).angle,90);assert.equal(aspectBetween(0,30),null);
});
