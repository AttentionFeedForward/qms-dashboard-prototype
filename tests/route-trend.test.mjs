import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const scope={window:{},addEventListener(){}};
for(const file of ['rockdale-route.js','route-detail.js'])vm.runInNewContext(await readFile(new URL('../process-demos/'+file,import.meta.url),'utf8'),scope);
const data=scope.window.ROCKDALE_ROUTE,series=(node,period,source=data)=>JSON.parse(JSON.stringify(scope.window.QMS_ROUTE_DETAIL.series(node,period,source)));
const display=(node,period)=>JSON.parse(JSON.stringify(scope.window.QMS_ROUTE_DETAIL.displaySeries(node,period,data)));

test('all periods reconcile with each process while short views retain earlier cumulative quantities',()=>{
  for(const n of data.nodes)for(const period of ['day','week','month','all']){
    const points=series(n,period);
    assert.equal(points.at(-1).reported,n.reported,n.id+' '+period);
    assert.equal(points.at(-1).accepted,n.accepted,n.id+' '+period);
    for(let i=1;i<points.length;i++){
      assert.equal(points[i].reported-points[i-1].reported,points[i].reportedAdded);
      assert.equal(points[i].accepted-points[i-1].accepted,points[i].acceptedAdded);
    }
    if(period==='day')assert.equal(points.length,14);
    if(period==='all'){
      assert.equal(points.reduce((s,p)=>s+p.reportedAdded,0),n.reported);
      assert.equal(points.reduce((s,p)=>s+p.acceptedAdded,0),n.accepted);
    }
  }
});

test('six-point chart view preserves full-cycle additions and the real cumulative endpoints',()=>{
  for(const node of data.nodes)for(const period of ['day','week','month','all']){
    const points=display(node,period);
    assert.ok(points.length>0&&points.length<=6);
    assert.equal(points.at(-1).reported,node.reported);
    assert.equal(points.at(-1).accepted,node.accepted);
    if(period==='all'){
      assert.equal(points[0].date,data.progressSource.firstRecordDate);
      assert.equal(points.at(-1).end,data.progressSource.snapshotDate);
      assert.equal(points.reduce((s,p)=>s+p.reportedAdded,0),node.reported);
      assert.equal(points.reduce((s,p)=>s+p.acceptedAdded,0),node.accepted);
      for(let i=1;i<points.length;i++){
        assert.equal(points[i].reported-points[i-1].reported,points[i].reportedAdded);
        assert.equal(points[i].accepted-points[i-1].accepted,points[i].acceptedAdded);
      }
    }
  }
  const branch=data.nodes.find(n=>n.id==='ST-03b'),weeks=display(branch,'week');
  assert.deepEqual(weeks.map(p=>p.reportedAdded),[7,14,26,25,4,0]);
  assert.deepEqual(weeks.map(p=>p.acceptedAdded),[16,18,15,22,33,1]);
  assert.deepEqual(weeks.map(p=>p.reported),[52,66,92,117,121,121]);
  assert.deepEqual(weeks.map(p=>p.accepted),[27,45,60,82,115,116]);
});

test('local dates, Monday week boundaries, month crossings, and zero-filled periods remain correct',()=>{
  const fixture={progressSource:{firstRecordDate:'2026-09-01',snapshotDate:'2026-11-02'}};
  const node={records:[
    {reportedAt:'2026/09/01-23:59:59',acceptedAt:'2026/09/02-00:00:00'},
    {reportedAt:'2026/10/31-23:59:59',acceptedAt:'2026/11/01-00:00:00'},
    {reportedAt:'2026/11/02-00:00:00',acceptedAt:null},
  ]};
  const months=series(node,'month',fixture);
  assert.deepEqual(months.map(p=>[p.reportedAdded,p.acceptedAdded]),[[1,1],[1,0],[1,1]]);
  const weeks=series(node,'week',fixture);
  assert.equal(weeks.at(-1).date,'2026-11-02');assert.equal(weeks.at(-2).date,'2026-10-26');
  assert.deepEqual([weeks.at(-2).reportedAdded,weeks.at(-2).acceptedAdded],[1,1]);
  const days=series(node,'day',fixture);
  assert.equal(days[0].date,'2026-10-20');assert.equal(days[0].reported,1);
  assert.equal(days.find(p=>p.date==='2026-11-01').acceptedAdded,1);
  assert.equal(days.find(p=>p.date==='2026-11-02').reportedAdded,1);
});
