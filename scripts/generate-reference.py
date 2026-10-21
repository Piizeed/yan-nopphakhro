"""Generate numeric reference fixtures using native pysweph, separate from WASM.
Run with PYTHONPATH=.validation-deps after installing pysweph 2.10.3.6 there.
The application itself has no Python dependency.
"""
import json
from pathlib import Path
import swisseph as swe
swe.set_sid_mode(swe.SIDM_LAHIRI)
cases = [
    ('j2000-bangkok', 2000, 1, 1, 12.0, 13.7563, 100.5018),
    ('1995-bangkok', 1995, 6, 15, 2.5, 13.7563, 100.5018),
    ('2026-nakhon', 2026, 10, 21, 5.0, 8.4325, 99.9599),
    ('1900-chiangmai', 1900, 1, 1, 5.298888888889, 18.7883, 98.9853),
    ('2100-phuket', 2100, 12, 31, 5.0, 7.8804, 98.3923),
]
result = []
for name, year, month, day, hour, lat, lon in cases:
    jd = swe.julday(year, month, day, hour)
    positions = []
    for body in [0,1,4,2,5,3,6,10]:
        computed = swe.calc_ut(jd, body, swe.FLG_MOSEPH | swe.FLG_SPEED | swe.FLG_SIDEREAL)
        positions.append({'body':body, 'longitude':computed[0][0], 'speed':computed[0][3]})
    houses = swe.houses_ex(jd, lat, lon, b'W', swe.FLG_SIDEREAL)
    cusps = list(houses[0])
    if len(cusps) == 13:  # pysweph preserves the C array's unused zero index.
        cusps = cusps[1:]
    result.append({'name':name,'jd':jd,'lat':lat,'lon':lon,'positions':positions,'ascendant':houses[1][0],'cusps':cusps})
Path('test/fixtures').mkdir(exist_ok=True)
Path('test/fixtures/ephemeris-reference.json').write_text(json.dumps({'generator':'pysweph 2.10.3.6 native Python binding','swissVersion':swe.version,'mode':'Moshier / Lahiri / Whole Sign','cases':result},indent=2),encoding='utf8')
print('Saved 5 native reference cases with 40 planet positions and ascendants.')
