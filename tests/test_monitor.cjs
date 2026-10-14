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

// A constellation satellite target is a searchable topic, not a dated domestic launch.
const lingjing=records.find(r=>r.id==='editorial-lingjing');
assert.ok(lingjing);
assert.equal(lingjing.kind,'topic');
assert.equal(lingjing.stage,'topic');
assert.equal(lingjing.siteKey,'unknown');
assert.equal(lingjing.day,null);
assert.ok(ex.matches(lingjing,{q:'杭州四维'}));
assert.equal(ex.matches(lingjing,{site:'hainan'}),false);
assert.match(lingjing.note,/9颗是卫星数量，不代表9次发射/);
assert.ok(records.find(r=>r.id==='editorial-lijian-1-orders').sources.some(s=>s.url==='https://www.cas-space.com/article/605.html'));
console.log('Commercial provenance and unknown-site constellation boundaries passed');

require('./test_near_window.cjs');

const nearEd={near_term:[{id:'lijian-2-y2',name:'Test official monthly lead',planned_month:'2026-10',assessment:'Fixture analysis',confidence:'中',missing_confirmations:['window'],review_by:'2026-10-15T04:00:00Z'},{id:'shenzhou-24-assessment',ll2_id:'c9605b67-8a53-4239-a8ae-577fe3b79799',name:'Test inference',assessment_month:'2026-11',site_key:'jiuquan',assessment:'Fixture analysis',confidence:'中低',missing_confirmations:['window'],review_by:'2026-10-15T04:00:00Z'}]};
const nearSnap={items:[row('Year Half 2',{id:'c9605b67-8a53-4239-a8ae-577fe3b79799',china:true,country_code:'CHN',site:'Jiuquan',hainan:false,net:'2026-12-31T00:00:00Z'})]};
const near=ex.combine(nearSnap,nearEd,{horizon:'60',now:Date.parse('2026-10-14T07:00:00Z')});
const officialNear=near.find(r=>r.id==='editorial-lijian-2-y2');
assert.ok(officialNear);assert.equal(officialNear.siteKey,'unknown');assert.equal(officialNear.day,null);assert.equal(officialNear.stage,'inference');
assert.equal(ex.matches(officialNear,{site:'jiuquan'}),false);
assert.equal(ex.combine(nearSnap,nearEd,{horizon:'60',now:Date.parse('2026-11-01T00:00:00Z')}).some(r=>r.id==='editorial-lijian-2-y2'),false);
assert.ok(!near.some(r=>r.name.includes('嫦娥七号')));

const nearNow=Date.parse('2026-10-14T07:00:00Z');
const unknownNear=ex.combine({items:[row('Day',{id:'unknownsite',china:true,country_code:'CHN',site:'Unknown',hainan:false,net:'2026-10-16T00:00:00Z'})]}, {},{horizon:'60',now:nearNow})[0];
assert.equal(unknownNear.siteKey,'unknown');assert.match(unknownNear.siteStatus,/具体发射场址未知/);
assert.equal(ex.nearChange({china:true,country_code:'CHN',site:'Jiuquan',net:'2027-03-01T00:00:00Z',precision:'Day',before:{net:'2026-10-18T00:00:00Z'}},[],nearNow),true);
assert.equal(ex.nearChange({china:true,country_code:'USA',net:'2027-03-01T00:00:00Z',precision:'Day',before:{net:'2026-10-18T00:00:00Z'}},[],nearNow),false);

assert.equal(guide.validDate('2028-01-02'),true);
assert.equal(guide.tripContext('https://example.com/guide.html?site=hainan&launch=2028-01-02').launch,'2028-01-02');

assert.equal(m.nearWindow({china:true,country_code:'CHN',net:'2026-10-16T00:00:00Z',precision:'Day',status_id:6},nearNow).eligible,false);

const inferred=near.find(r=>r.id==='editorial-shenzhou-24-assessment');
assert.ok(inferred);assert.equal(inferred.stage,'inference');assert.equal(inferred.day,null);
assert.equal(near.filter(r=>r.id==='ll2-c9605b67-8a53-4239-a8ae-577fe3b79799').length,0);
assert.ok(inferred.confidence.includes('中低'));assert.ok(inferred.missing.length);assert.ok(inferred.reviewBy);
const expired=ex.combine(nearSnap,nearEd,{horizon:'60',now:Date.parse('2026-10-16T07:00:00Z')});
assert.equal(expired.some(r=>r.stage==='inference'),false);
const completedSnap={items:nearSnap.items.map(r=>r.id==='c9605b67-8a53-4239-a8ae-577fe3b79799'?{...r,status_id:3}:r)};
assert.equal(ex.combine(completedSnap,nearEd,{horizon:'60',now:nearNow}).some(r=>r.id==='editorial-shenzhou-24-assessment'),false);

for(const update of [{precision:'Day',net:'2026-11-03T00:00:00Z',status_id:1},{status_id:5},{precision:'Month',net:'2027-01-31T00:00:00Z'}]){
 const changed={items:nearSnap.items.map(r=>({...r,...update}))};
 const result=ex.combine(changed,nearEd,{horizon:'60',now:nearNow});
 assert.equal(result.some(r=>r.id==='editorial-shenzhou-24-assessment'),false);
 if(update.precision==='Day')assert.equal(result.find(r=>r.id.startsWith('ll2-')).day,'2026-11-03');
}

assert.equal(ex.combine({items:nearSnap.items.map(r=>({...r,site:'Wenchang',hainan:true}))},nearEd,{horizon:'60',now:nearNow}).some(r=>r.id==='editorial-shenzhou-24-assessment'),false);

assert.equal(expired.find(r=>r.id==='editorial-lijian-2-y2').stage,'overlap');

for(const precision of ['Year','Quarter 4','Unknown']){
 const broader={items:nearSnap.items.map(r=>({...r,precision}))};
 assert.equal(ex.combine(broader,nearEd,{horizon:'60',now:nearNow}).some(r=>r.id==='editorial-shenzhou-24-assessment'),true);
}
