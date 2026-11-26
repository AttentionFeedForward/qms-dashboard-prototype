import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const context={window:{}};
const read=file=>readFile(new URL('../process-demos/'+file,import.meta.url),'utf8');
vm.runInNewContext(await read('rockdale-route.js'),context);
const original=JSON.stringify(context.window.ROCKDALE_ROUTE);
for(const file of ['process-box-details.js','route-catalog.js'])vm.runInNewContext(await read(file),context);
const catalog=context.window.QMS_ROUTE_CATALOG,standard=catalog.getRoute('RD-R01'),sample=catalog.getRoute('RD-R02');
const plain=value=>JSON.parse(JSON.stringify(value));

test('adds three separate sample boxes and preserves the original 156-box snapshot',()=>{
  assert.equal(JSON.stringify(context.window.ROCKDALE_ROUTE),original);
  assert.equal(standard.totalBoxes,156);assert.equal(sample.totalBoxes,3);assert.equal(catalog.projectTotal,159);
  assert.equal(standard.nodes.find(node=>node.id==='ST-01').reported,121);
  assert.equal(standard.nodes.find(node=>node.id==='ST-01').accepted,121);
  assert.ok(sample.boxes.every(box=>!standard.boxes.includes(box)));
  assert.equal(new Set(sample.boxes).size,3);
});

test('sample report, self-inspection and acceptance times respect process prerequisites',()=>{
  const edges=sample.mainSequence.slice(1).map((id,index)=>[sample.mainSequence[index],id]);
  sample.groups.forEach(group=>group.members.forEach(id=>edges.push([group.source,id],[id,group.target])));
  const nodes=new Map(sample.nodes.map(node=>[node.id,node]));
  for(const node of sample.nodes){
    assert.equal(node.reported,node.records.filter(record=>record.reportedAt).length);
    assert.equal(node.accepted,node.records.filter(record=>record.acceptedAt).length);
    assert.ok(node.accepted<=node.reported && node.reported<=3);
    assert.deepEqual(plain(node.boundBoxes),plain(sample.boxes));
    for(const record of node.records){
      if(record.selfPassedAt)assert.ok(record.reportedAt<=record.selfPassedAt);
      if(record.acceptedAt){assert.ok(record.selfPassedAt<=record.acceptedAt);assert.ok(record.acceptedAt.slice(0,10)<=sample.progressSource.snapshotDate);}
    }
  }
  for(const [from,to] of edges)for(const box of sample.boxes){
    const previous=nodes.get(from).records.find(record=>record.box===box),next=nodes.get(to).records.find(record=>record.box===box);
    if(next.reportedAt){assert.ok(previous.acceptedAt,from+' must pass before '+to);assert.ok(previous.acceptedAt<next.reportedAt);}
  }
  assert.equal(catalog.completedBoxes,1);
});

test('workshop scope keeps node totals, box details and route identity consistent',()=>{
  const filtered=catalog.scope('RD-R02','结构一车间');
  assert.equal(filtered.totalBoxes,1);assert.equal(filtered.routeTotalBoxes,3);
  assert.ok(filtered.nodes.length>0 && filtered.nodes.every(node=>node.phase==='ST'));
  for(const node of filtered.nodes){
    assert.deepEqual(plain(node.boundBoxes),['YX-001']);
    const rows=context.window.QMS_PROCESS_BOXES.makeRows(node,filtered.boxOrder);
    assert.ok(rows.every(row=>row.workshop==='结构一车间'));
    assert.equal(node.totalBound,rows.length);
  }
  const both=catalog.scope('RD-R02','一车间');
  assert.equal(both.totalBoxes,1);assert.ok(both.nodes.some(node=>node.phase==='AR'));
  assert.ok(catalog.workshops('RD-R02').includes('装修三车间'));
  assert.equal(sample.nodes.length,62);assert.equal(JSON.stringify(context.window.ROCKDALE_ROUTE),original);
});

test('unknown workshop produces a true empty scope and the full route is recoverable',()=>{
  const empty=catalog.scope('RD-R01','不存在的车间');
  assert.equal(empty.totalBoxes,0);assert.equal(empty.nodes.length,0);assert.equal(empty.groups.length,0);assert.equal(empty.mainSequence.length,0);
  assert.equal(catalog.scope('RD-R01','').totalBoxes,156);
  assert.equal(catalog.scope('RD-R02','').nodes.length,62);
});
