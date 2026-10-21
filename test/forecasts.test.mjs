import test from 'node:test';
import assert from 'node:assert/strict';
import { places, ephemerisProvider, validateBirth } from '../public/services.js';
import { forecastProvider, todayBangkok } from '../public/forecasts.js';

const birth = { name: 'ดาว', date: '1995-06-15', time: '09:30', unknown: false, place: 'bangkok' };

test('all 77 provinces can be used, with no duplicate names or IDs', () => {
  assert.equal(places.length, 77);
  for (const field of ['id', 'code', 'name']) assert.equal(new Set(places.map(p => p[field])).size, 77);
  for (const p of places) assert.doesNotThrow(() => validateBirth({ ...birth, place: p.id }));
  assert.equal(places.find(p => p.code === '80').name, 'นครศรีธรรมราช');
  assert.equal(places.find(p => p.code === '38').name, 'บึงกาฬ');
  for (const id of ['bangkok', 'chiangmai', 'khonkaen', 'phuket', 'songkhla']) {
    assert.ok(places.some(p => p.id === id), `Existing profile ID ${id} must still work`);
  }
});

test('daily and monthly readings are repeatable and contain four actionable summaries', async () => {
  const chart = await ephemerisProvider.calculate(birth);
  for (const options of [{ period: 'daily', date: '2026-10-21' }, { period: 'monthly', date: '2026-10' }]) {
    const a = forecastProvider.calculate(chart, options);
    assert.deepEqual(a, forecastProvider.calculate(chart, options));
    assert.equal(a.source, 'rule-based-transits');
    assert.equal(a.timezone, 'Asia/Bangkok');
    assert.equal(a.date, options.date);
    assert.deepEqual(a.categories.map(c => c.name), ['การงาน', 'การเงิน', 'ความรัก', 'พลังใจ']);
    assert.ok(a.categories.every(c => c.score >= 0 && c.score <= 100 && c.detail.length > 40));
    assert.ok(a.summary && a.focus && a.caution);
  }
});

test('selected period and birth time affect transits; display name does not', async () => {
  const chart = await ephemerisProvider.calculate(birth);
  const daily = { period: 'daily', date: '2026-10-21' };
  const a = forecastProvider.calculate(chart, daily);
  assert.notDeepEqual(a.categories, forecastProvider.calculate(chart, { ...daily, date: '2026-10-22' }).categories);
  assert.notDeepEqual(a.categories, forecastProvider.calculate(chart, { period: 'monthly', date: '2026-10' }).categories);
  const monthly = forecastProvider.calculate(chart, { period: 'monthly', date: '2026-10' });
  assert.notDeepEqual(monthly.categories, forecastProvider.calculate(chart, { period: 'monthly', date: '2026-11' }).categories);
  const other = await ephemerisProvider.calculate({ ...birth, time: '21:30' });
  assert.notDeepEqual(a.categories, forecastProvider.calculate(other, daily).categories);
  assert.deepEqual(a, forecastProvider.calculate({ ...chart, birth: { ...birth, name: 'ชื่อใหม่' } }, daily));
});

test('unknown times do not alter readings using a hidden time field', async () => {
  const chart = await ephemerisProvider.calculate({ ...birth, unknown: true });
  const other = await ephemerisProvider.calculate({ ...birth, unknown: true, time: '23:59' });
  const options = { period: 'daily', date: '2026-10-21' };
  assert.deepEqual(forecastProvider.calculate(chart, options), forecastProvider.calculate(other, options));
});

test('period dates are validated including impossible calendar days', async () => {
  const chart = await ephemerisProvider.calculate(birth);
  for (const options of [
    { period: 'yearly', date: '2026' }, { period: 'daily', date: '' },
    { period: 'daily', date: '2026-02-30' }, { period: 'daily', date: '2026-02-29' },
    { period: 'monthly', date: '2026-13' }, { period: 'monthly', date: '2026-10-01' },
    { period: 'daily', date: '1899-12-31' }, { period: 'monthly', date: '2101-01' },
  ]) assert.throws(() => forecastProvider.calculate(chart, options));
  assert.doesNotThrow(() => forecastProvider.calculate(chart, { period: 'daily', date: '2024-02-29' }));
});

test('the default day uses Bangkok midnight, including a month rollover', () => {
  assert.equal(todayBangkok(new Date('2026-10-31T16:59:59Z')), '2026-10-31');
  assert.equal(todayBangkok(new Date('2026-10-31T17:00:00Z')), '2026-11-01');
});
