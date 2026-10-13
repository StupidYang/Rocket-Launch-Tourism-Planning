const assert=require('node:assert/strict');
const m=require('../assets/monitor.js');
const now=Date.parse('2026-10-13T00:00:00Z');
function row(p='Minute',extras={}){return {net:'2027-04-02T08:30:00Z',precision:p,status_id:1,hainan:true,...extras};}
assert.equal(m.timing(row(),now).label,'2027-04-02 16:30');
assert.equal(m.timing(row('Year'),now).label,'待定');
assert.equal(m.timing(row('Year'),now).detail,'2027年目标');
assert.equal(m.timing(row('Month'),now).label,'待定');
assert.equal(m.timing(row(null),now).label,'待定');
assert.equal(m.timing(row('Second',{net:null}),now).label,'待定');
assert.equal(m.timing(row('Second',{status_id:2}),now).label,'待定');
assert.equal(m.timing(row('Second',{status_id:5}),now).label,'待定');
assert.equal(m.timing(row('Day'),now).label,'2027-04-02 （时刻待定）');
assert.equal(m.timing(row('Hour'),now).label,'2027-04-02 16时左右');
assert.equal(m.dateText('2026-12-31T18:30:00Z'),'2027-01-01');
assert.equal(m.yearOf(row('Year',{net:'2027-12-31T23:59:59Z'})),'2027');
assert.equal(m.yearOf(row('Minute',{net:'2026-12-31T18:30:00Z'})),'2027');
assert.match(m.trip(row(),now).text,/周五/);
assert.equal(m.trip(row('Year'),now).date,null);
assert.equal(m.trip(row('Minute',{hainan:false}),now).date,null);
assert.equal(m.trip(row('Minute',{net:'2026-04-02T00:00:00Z'}),now).date,null);
assert.equal(m.sourceLink('javascript:alert(1)'),'#monitor-sources');
assert.equal(m.sourceLink('https://evil.example/'),'#monitor-sources');
assert.equal(m.escape('<script>'), '&lt;script&gt;');
console.log('20 frontend date, precision, timezone, safety and trip assertions passed');


assert.equal(m.tourismScope(row('Year',{china:true})),true);
assert.equal(m.tourismScope(row('Year',{china:false})),false);
assert.equal(m.tourismScope(row('Year',{china:true,net:'2026-12-31T00:00:00Z'})),false);
assert.equal(m.tourismScope(row('Minute',{china:true,net:'2026-12-31T18:30:00Z'})),true);
assert.equal(m.tourismScope(row('Year',{china:true,hainan:false}),'hainan'),false);
assert.equal(m.relevantChange({id:'a',china:true},[{id:'a',...row('Year',{china:true})}]),true);
assert.equal(m.relevantChange({china:true,before:{net:'2027-04-02T00:00:00Z'}},[]),true);
assert.equal(m.relevantChange({china:false,before:{net:'2027-04-02T00:00:00Z'}},[]),false);
console.log('China-only 2027 tourism scope and change filtering assertions passed');

assert.equal(m.relevantChange({id:'a',china:true,before:{net:'2027-04-02T00:00:00Z'}},[{id:'a',...row('Year',{china:true,net:'2028-12-31T00:00:00Z'})}]),true);
assert.equal(m.relevantChange({china:true,net:'2027-12-31T00:00:00Z',precision:'Year'},[]),true);

assert.equal(m.tourismScope(row('Year',{china:true,country_code:'USA'})),false);
