const assert=require('node:assert/strict');
const m=require('../assets/monitor.js');
const now=Date.parse('2026-10-13T00:00:00Z');
function row(p='Minute',extras={}){return {net:'2027-04-02T08:30:00Z',precision:p,status_id:1,hainan:true,country_code:'CHN',...extras};}
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
assert.equal(m.relevantChange({china:true,country_code:'CHN',before:{net:'2027-04-02T00:00:00Z'}},[]),true);
assert.equal(m.relevantChange({china:false,before:{net:'2027-04-02T00:00:00Z'}},[]),false);
console.log('China-only 2027 tourism scope and change filtering assertions passed');

assert.equal(m.relevantChange({id:'a',china:true,country_code:'CHN',before:{net:'2027-04-02T00:00:00Z'}},[{id:'a',...row('Year',{china:true,net:'2028-12-31T00:00:00Z'})}]),true);
assert.equal(m.relevantChange({china:true,country_code:'CHN',net:'2027-12-31T00:00:00Z',precision:'Year'},[]),true);

assert.equal(m.tourismScope(row('Year',{china:true,country_code:'USA'})),false);

assert.match(m.localized("Long March 5 | Chang'e 7"), /嫦娥七号/);

assert.equal(m.tourismScope(row('Year',{china:true,country_code:'',site:'Unknown'})),false);
assert.equal(m.tourismScope(row('Year',{china:true,country_code:'',site:'Jiuquan Satellite Launch Center'})),true);

assert.equal(m.relevantChange({china:true,country_code:'USA',before:{net:'2027-04-02T00:00:00Z'}},[]),false);
assert.equal(m.relevantChange({china:true,site:'Unknown',before:{net:'2027-04-02T00:00:00Z'}},[]),false);

assert.match(m.trip(row('Minute',{net:'2027-04-01T18:00:00Z'}),now).text,/赶不上/);
assert.doesNotMatch(m.trip(row('Minute',{net:'2027-04-01T18:00:00Z'}),now).text,/优先/);
assert.match(m.trip(row('Day'),now).text,/时刻未定/);
const ex=require('../assets/explorer.js');
const fs=require('node:fs');
const ed=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/editorial.json'),'utf8'));
const snap=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/launches.json'),'utf8'));
const records=ex.combine(snap,ed);
assert.equal(records.filter(r=>r.name.includes('嫦娥七号')).length,1);
assert.ok(records.some(r=>ex.matches(r,{q:'轻舟'})));
assert.ok(records.some(r=>ex.matches(r,{q:'酒泉'})));
assert.equal(records.find(r=>r.name.includes('轻舟')).siteKey,'unknown');
assert.deepEqual(ex.destinations({q:'西昌'}),['xichang']);
assert.deepEqual(ex.destinations({site:'jiuquan',q:'no-record'}),['jiuquan']);
assert.equal(ex.combine({items:[row('Year',{id:'foreign',china:true,country_code:'USA'})]},{}).length,0);
assert.equal(ex.safeUrl('javascript:alert(1)'),'');
assert.ok(records.findIndex(r=>r.group==='commercial')>records.findLastIndex(r=>r.group==='national'));
console.log('Unified discovery, deduplication, destination fallback and early-window tests passed');

assert.ok(records.some(r=>r.name.includes('力鸿二号')&&ex.matches(r,{q:'中科宇航'})));
assert.equal(ex.combine({items:[row('Year',{id:'uncategorized',name:'Unknown ownership',china:true,country_code:'CHN',category:'unknown'})]},{} )[0].group,'other');
assert.equal(ex.combine({items:[row('Year',{id:'state-linked',name:'State linked',china:true,country_code:'CHN',category:'state-linked'})]},{} )[0].group,'other');
const guide=require('../assets/guide.js');
assert.equal(guide.travelWeek('2027-04-05','late').ok,false);
assert.equal(guide.travelWeek('2027-04-06','late').ok,false);
assert.equal(guide.travelWeek('2027-04-02','early').ok,false);
assert.equal(guide.travelWeek('2027-02-29','late').ok,false);
assert.equal(guide.travelWeek('2027-04-02','late').start,'2027-04-01');
assert.equal(guide.travelWeek('2027-01-01','late').start,'2026-12-31');
assert.equal(guide.travelWeek('2027-12-31','late').end,'2028-01-03');
assert.notEqual(guide.storageKey({site:'hainan',mission:'A',launch:''}),guide.storageKey({site:'hainan',mission:'B',launch:''}));
assert.notEqual(guide.storageKey({site:'hainan',mission:'A',launch:'2027-04-02'}),guide.storageKey({site:'hainan',mission:'A',launch:'2027-04-03'}));
assert.equal(guide.safeHomeReturn('https://evil.example/','https://example.com/repo/guide.html'),'https://example.com/repo/');
assert.equal(guide.safeHomeReturn('/repo/?q=test','https://example.com/repo/guide.html'),'https://example.com/repo/?q=test');
console.log('Guide chronology, scoped persistence keys and safe return tests passed');
