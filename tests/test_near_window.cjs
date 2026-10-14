'use strict';
const assert=require('node:assert/strict');
const m=require('../assets/monitor.js');
const now=Date.parse('2026-10-14T07:00:00Z'); // 15:00 in Beijing.
const row=(precision='Minute', extra={})=>({net:'2026-10-16T06:30:00Z',precision,status_id:1,china:true,country_code:'CHN',site:'Wenchang',hainan:true,...extra});
const near=(precision,extra={},at=now)=>m.nearWindow(row(precision,extra),at);

// Exactly 60 calendar dates, never 60*24 hours measured from the current clock.
const range=m.nearWindowRange(now);
assert.equal(range.windowStart,'2026-10-13T16:00:00.000Z');
assert.equal(range.windowEnd,'2026-12-12T16:00:00.000Z');
assert.equal(range.startDay,'2026-10-14');
assert.equal(range.endDay,'2026-12-12');
assert.equal(Date.parse(range.windowEnd)-Date.parse(range.windowStart),60*86400000);
assert.equal(range.timezone,'Asia/Shanghai');
assert.equal(m.nearWindowRange('2026-10-13T15:59:59.999Z').startDay,'2026-10-13');
assert.equal(m.nearWindowRange('2026-10-13T16:00:00Z').startDay,'2026-10-14');
assert.equal(m.nearWindowRange('2026-12-31T18:00:00Z').startDay,'2027-01-01');
assert.equal(m.nearWindowRange('2028-02-01T00:00:00Z').endDay,'2028-03-31');
assert.equal(m.nearWindowRange(0).startDay,'1970-01-01');
assert.equal(near('Minute',{},'invalid').reason,'invalid-now');

// Exact net instants are future-only, including when a supplied window_end is later.
for(const precision of ['Second','Minute','Hour']) {
  assert.equal(near(precision).eligible,true);
  assert.equal(near(precision,{net:new Date(now).toISOString()}).eligible,true);
  assert.equal(near(precision,{net:new Date(now-1).toISOString(),window_end:'2026-10-15T00:00:00Z'}).reason,'past');
  assert.equal(near(precision,{net:'2026-12-12T15:59:59.999Z'}).eligible,true);
  assert.equal(near(precision,{net:'2026-12-12T16:00:00Z'}).eligible,false);
  assert.equal(near(precision,{net:'2026-12-12T16:00:00Z'}).reason,'outside-window');
}
assert.equal(near('Minute',{net:'2026-10-13T15:59:59.999Z'}).eligible,false);
assert.equal(near('Minute',{net:'2026-10-13T16:00:00Z'},'2026-10-13T16:00:00Z').eligible,true);

// A day marker represents its full Beijing calendar date and never invents a time.
const today=near('Day',{net:'2026-10-13T16:00:00Z'});
assert.equal(today.eligible,true);
assert.equal(today.day,'2026-10-14');
assert.equal(today.intervalStart,'2026-10-13T16:00:00.000Z');
assert.equal(today.intervalEnd,'2026-10-14T16:00:00.000Z');
assert.equal(today.coarse,false);
assert.equal(near('Day',{net:'2026-10-13T15:59:59.999Z'}).reason,'past');
assert.equal(near('Day',{net:'2026-12-12T00:00:00Z'}).eligible,true);
assert.equal(near('Day',{net:'2026-12-12T16:00:00Z'}).eligible,false);
assert.equal(near('Day',{net:'2026-10-14T00:00:00Z'},'2026-10-14T15:59:59.999Z').eligible,true);
assert.equal(near('Day',{net:'2026-10-14T00:00:00Z'},'2026-10-14T16:00:00Z').eligible,false);

// Coarse UTC markers use the source month, even if the instant falls in the next
// Beijing month. Their full period overlaps; no placeholder day is exposed.
const october=near('Month',{net:'2026-10-31T23:59:59Z'});
assert.equal(october.eligible,true);
assert.equal(october.reason,'coarse-overlap');
assert.equal(october.coarse,true);
assert.equal(october.day,null);
assert.equal(october.intervalStart,'2026-09-30T16:00:00.000Z');
assert.equal(october.intervalEnd,'2026-10-31T16:00:00.000Z');
assert.equal(october.targetLabel,'2026年10月目标');
assert.equal(near('Month',{net:'2026-09-30T23:59:59Z'}).reason,'past');
assert.equal(near('Month',{net:'2026-12-31T00:00:00Z'}).eligible,true);
assert.equal(near('Month',{net:'2027-01-31T00:00:00Z'}).eligible,false);
assert.equal(near('Month',{net:'2026-09-30T00:00:00Z'},'2026-09-30T16:00:00Z').eligible,false);
assert.equal(near('Month',{net:'2026-12-31T00:00:00Z'},'2026-10-01T16:00:00Z').eligible,false); // End exactly Dec 1.
for(const precision of ['Quarter','Quarter 4','Quarter4',' quarter 4 ']) {
  const q=near(precision,{net:'2026-12-31T23:59:59Z'});
  assert.equal(q.eligible,true);
  assert.equal(q.precision,'quarter');
  assert.equal(q.day,null);
  assert.equal(q.intervalStart,'2026-09-30T16:00:00.000Z');
  assert.equal(q.intervalEnd,'2026-12-31T16:00:00.000Z');
  assert.equal(q.targetLabel,'2026年Q4目标');
}
const q1=near('Quarter1',{net:'2027-03-31T23:59:59Z'},'2026-12-14T00:00:00Z');
assert.equal(q1.eligible,true);
assert.equal(q1.intervalStart,'2026-12-31T16:00:00.000Z');
assert.equal(q1.intervalEnd,'2027-03-31T16:00:00.000Z');
assert.equal(near('Quarter 3',{net:'2026-09-30T00:00:00Z'}).eligible,false);
for(const precision of ['Year Half 2','Year Half2','Half Year','Half-Year 2']) {
  const half=near(precision,{net:'2026-12-31T23:59:59Z'});
  assert.equal(half.eligible,true);
  assert.equal(half.precision,'half year');
  assert.equal(half.intervalStart,'2026-06-30T16:00:00.000Z');
  assert.equal(half.intervalEnd,'2026-12-31T16:00:00.000Z');
  assert.equal(half.targetLabel,'2026年下半年目标');
}
assert.equal(near('Year Half 1',{net:'2026-06-30T00:00:00Z'}).eligible,false);
assert.equal(near('Year Half1',{net:'2027-06-30T00:00:00Z'},'2026-12-14T00:00:00Z').eligible,true);

// Never promote annual or unknown targets to a nearer-term promise.
assert.equal(near('Year',{net:'2026-10-20T00:00:00Z'}).reason,'year-only');
for(const precision of [null,'','Unknown','Fiscal Year','Decade','Quarter 5','Year Half 3']) {
  assert.equal(near(precision).eligible,false);
  assert.equal(near(precision).reason,'unknown-precision');
  assert.equal(near(precision).day,null);
}
for(const net of [null,'','not-a-date']) assert.equal(near('Minute',{net}).reason,'invalid-date');

// Physical launch location and China flag must both match; explicit foreign
// country evidence wins over a domestic-looking site name or Hainan flag.
assert.equal(near('Minute',{china:false}).reason,'outside-china');
assert.equal(near('Minute',{country_code:'USA',site:'Wenchang'}).reason,'outside-china');
assert.equal(near('Minute',{country_code:'',site:'Unknown'}).reason,'outside-china');
assert.equal(near('Minute',{country_code:'',site:'Jiuquan Satellite Launch Center'}).eligible,true);
assert.equal(near('Minute',{country_code:'',site:'海阳近海'}).eligible,true);
for(const status_id of [3,4,7,'3','4','7']) assert.equal(near('Minute',{status_id}).reason,'completed');
for(const status_id of [2,5,8]) assert.equal(near('Month',{status_id}).eligible,true);
assert.equal(near('Minute',{status_id:2}).eligible,true);
assert.equal(m.timing(row('Minute',{status_id:2}),now).known,false);

// Existing 2027 tourism scope is unchanged; future 2026 trip dates now work.
assert.equal(m.tourismScope(row('Minute')),false);
assert.equal(m.tourismScope(row('Minute',{net:'2027-04-02T08:30:00Z'})),true);
assert.equal(m.trip(row('Minute'),now).date,'2026-10-16');
assert.match(m.trip(row('Minute'),now).text,/周五/);
assert.doesNotMatch(m.trip(row('Minute'),now).text,/2027/);
assert.equal(m.trip(row('Day',{net:'2026-10-13T00:00:00Z'}),now).date,null);
const frozen=Object.freeze(row('Month',{net:'2026-10-31T23:59:59Z'}));
assert.equal(m.nearWindow(frozen,now).eligible,true);
console.log('Rolling 60-day Beijing boundaries, coarse precision, geography, status and trip tests passed');
