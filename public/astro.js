import { SwissEphemeris, CalculationFlag, SiderealMode, HouseSystem } from './vendor/swisseph/swisseph-browser.js';
import { places } from './places.js';

export const signs = ['เมษ','พฤษภ','เมถุน','กรกฎ','สิงห์','กันย์','ตุล','พิจิก','ธนู','มกร','กุมภ์','มีน'];
export const houseNames = ['ตนุ','กดุมภะ','สหัชชะ','พันธุ','ปุตตะ','อริ','ปัตนิ','มรณะ','ศุภะ','กัมมะ','ลาภะ','วินาศ'];
export const normalize = n => ((n % 360) + 360) % 360;
export const angularDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
export function todayBangkok(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
}
export function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
}
const localFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function wallTimestamp(date) {
  const p = Object.fromEntries(localFormatter.formatToParts(date).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}
export function thaiLocalToUTC(day, time = '12:00') {
  if (!validDay(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('วันหรือเวลาไม่ถูกต้อง');
  const wall = Date.parse(`${day}T${time}:00Z`);
  let guess = wall - 7 * 3600000;
  for (let i = 0; i < 4; i++) guess += wall - wallTimestamp(new Date(guess));
  if (wallTimestamp(new Date(guess)) !== wall) throw Error('เวลานี้ไม่อยู่ในปฏิทินเวลาไทย เนื่องจากการเปลี่ยนเขตเวลาในอดีต');
  return new Date(guess);
}
let engine, initializing;
export async function initEphemeris() {
  if (engine) return engine;
  if (!initializing) initializing = (async () => {
    const swe = new SwissEphemeris();
    let wasmURL = new URL('./vendor/swisseph/swisseph.wasm', import.meta.url).href;
    // The unmodified browser WASM loader uses fetch; use a data URL in Node tests.
    if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
      const { readFile } = await import('node:fs/promises');
      wasmURL = 'data:application/wasm;base64,' + (await readFile(new URL(wasmURL))).toString('base64');
    }
    await swe.init(wasmURL);
    swe.setSiderealMode(SiderealMode.Lahiri);
    engine = swe;
    return engine;
  })().catch(error => { initializing = null; throw error; });
  return initializing;
}
export function validateBirth(input) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 60) throw Error('กรุณากรอกชื่อไม่เกิน 60 ตัวอักษร');
  if (!validDay(input.date) || input.date < '1900-01-01' || input.date > todayBangkok()) throw Error('กรุณาเลือกวันเกิดจริงตั้งแต่ปี 1900 ถึงวันนี้ (ค.ศ.)');
  if (input.unknown !== true && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')) throw Error('กรุณากรอกเวลาเกิด');
  const place = places.find(p => p.id === input.place);
  if (!place) throw Error('กรุณาเลือกจังหวัดเกิด');
  const mode = input.locationMode || 'province';
  if (!['province', 'custom'].includes(mode)) throw Error('รูปแบบพิกัดไม่ถูกต้อง');
  const custom = mode === 'custom';
  if (custom && [input.lat, input.lon].some(v => v === '' || v === null || v === undefined || !['number','string'].includes(typeof v))) throw Error('กรุณากรอกพิกัดสถานที่เกิดทั้งสองช่อง');
  const lat = custom ? Number(input.lat) : place.lat;
  const lon = custom ? Number(input.lon) : place.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 5 || lat > 21 || lon < 97 || lon > 106) throw Error('กรุณาใช้พิกัดในประเทศไทย: ละติจูด 5–21 และลองจิจูด 97–106');
  return { name: input.name.trim(), date: input.date, time: input.unknown === true ? '' : input.time,
    unknown: input.unknown === true, place: place.id, locationMode: mode, lat, lon };
}
const bodies = [
  ['sun','อาทิตย์','☉',0], ['moon','จันทร์','☽',1], ['mars','อังคาร','♂',4],
  ['mercury','พุธ','☿',2], ['jupiter','พฤหัส','♃',5], ['venus','ศุกร์','♀',3],
  ['saturn','เสาร์','♄',6], ['rahu','ราหู (โหนดเหนือเฉลี่ย)','☊',10],
];
const flags = CalculationFlag.MoshierEphemeris | CalculationFlag.Speed | CalculationFlag.Sidereal;
const positionCache = new Map();
export function positionsAt(date) {
  if (!engine) throw Error('เครื่องคำนวณยังไม่พร้อม กรุณาลองอีกครั้ง');
  const key = date.toISOString();
  if (positionCache.has(key)) return structuredClone(positionCache.get(key));
  const jd = engine.dateToJulianDay(date);
  const planets = bodies.map(([id,name,symbol,body]) => {
    const p = engine.calculatePosition(jd, body, flags);
    if (!(p.flags & CalculationFlag.MoshierEphemeris)) throw Error('เครื่องคำนวณไม่ได้ใช้ ephemeris ที่กำหนด');
    return { id,name,symbol,longitude:p.longitude,latitude:p.latitude,sign:Math.floor(p.longitude/30),
      degree:p.longitude%30,speed:p.longitudeSpeed,retrograde:p.longitudeSpeed<0,distanceAU:p.distance };
  });
  const node = planets.find(p => p.id === 'rahu');
  const longitude = normalize(node.longitude + 180);
  planets.push({ ...node, id:'south-node',name:'โหนดใต้ (ตรงข้ามราหู)',symbol:'☋',longitude,sign:Math.floor(longitude/30),degree:longitude%30 });
  const snapshot = { utc:key,julianDayUT:jd,ayanamsa:engine.getAyanamsaExUt(jd,CalculationFlag.MoshierEphemeris),planets };
  if (positionCache.size >= 450) positionCache.delete(positionCache.keys().next().value);
  positionCache.set(key, snapshot);
  return structuredClone(snapshot);
}
export async function calculateChart(input) {
  const birth = validateBirth(input);
  await initEphemeris();
  const utc = thaiLocalToUTC(birth.date, birth.unknown ? '12:00' : birth.time);
  const snapshot = positionsAt(utc);
  let ascendantLongitude = null, mcLongitude = null;
  if (!birth.unknown) {
    const houses = engine.calculateHouses(snapshot.julianDayUT, birth.lat, birth.lon, HouseSystem.WholeSign);
    // houses() returns tropical angles. Sidereal whole-sign cusps start at the
    // sign containing tropical ASC minus true Lahiri ayanamsa.
    ascendantLongitude = normalize(houses.ascendant - snapshot.ayanamsa);
    mcLongitude = normalize(houses.mc - snapshot.ayanamsa);
  }
  const ascendant = ascendantLongitude === null ? null : Math.floor(ascendantLongitude/30);
  const uncertainty = [];
  if (birth.locationMode === 'province') uncertainty.push('ใช้พิกัดกลางจังหวัดโดยประมาณ ควรใส่พิกัดสถานพยาบาลหรือจุดเกิดเพื่อความแม่นยำของลัคนา');
  if (birth.unknown) uncertainty.push('ไม่ทราบเวลาเกิด: ใช้เวลา 12:00 น. เป็นค่ากลาง แสดงช่วงตำแหน่งดาวทั้งวัน งดลัคนา เรือน และงดใช้จันทร์กำเนิดในการให้คะแนน');
  let first, last, rangeStart = '00:00';
  if (birth.unknown) {
    // A historical clock change can skip midnight. Sample the first valid
    // local minute instead of rejecting an otherwise valid birth date.
    let startUTC;
    for (let minute = 0; minute < 1440; minute++) {
      rangeStart = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      try { startUTC = thaiLocalToUTC(birth.date, rangeStart); break; } catch { /* skipped local minute */ }
    }
    if (!startUTC) throw Error('ไม่พบเวลาท้องถิ่นที่ใช้ได้ในวันเกิดนี้');
    first = positionsAt(startUTC);
    last = positionsAt(thaiLocalToUTC(birth.date, '23:59'));
    if (rangeStart !== '00:00') uncertainty.push(`วันเกิดนี้มีการเปลี่ยนเขตเวลา ช่วงตำแหน่งดาวเริ่มที่ ${rangeStart} น. ซึ่งเป็นนาทีแรกที่ใช้ได้`);
  }
  const planets = snapshot.planets.map((p,i) => ({ ...p,
    house:ascendant === null ? null : (p.sign-ascendant+12)%12+1,
    navamsaSign:Math.floor(normalize(p.longitude*9)/30),
    ...(birth.unknown ? { dayRange:{ startTime:rangeStart,endTime:'23:59',start:first.planets[i].longitude,end:last.planets[i].longitude,
      crossesSign:first.planets[i].sign!==last.planets[i].sign } } : {}),
  }));
  return { schemaVersion:2,source:'ephemeris',system:'sidereal-lahiri',timezone:'Asia/Bangkok',birth,
    ...snapshot,planets,ascendant,ascendantLongitude,mcLongitude,
    houses:ascendant===null?[]:Array.from({length:12},(_,i)=>({number:i+1,name:houseNames[i],sign:(ascendant+i)%12,cusp:normalize((ascendant+i)*30)})),
    uncertainty,metadata:{engine:'Swiss Ephemeris',engineVersion:engine.version(),wrapper:'@swisseph/browser 1.4.0',ephemeris:'Moshier',
      ayanamsa:'Lahiri',houseSystem:'Whole Sign',node:'Mean lunar node; south node = north node + 180°, not Thai Ketu',
      zodiac:'Sidereal',coordinateSource:birth.locationMode==='custom'?'user-entered':'province-centroid',
      timeSource:birth.unknown?'local-noon-assumption':'birth-input',supportedYears:'1900–2100',interpretation:'lakhana-rules-v1'} };
}
