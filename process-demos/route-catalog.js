/* Shared route bindings. The original workbook snapshot stays unchanged. */
(() => {
  'use strict';
  const source = window.ROCKDALE_ROUTE;
  if (!source) return;
  const knownBoxes = [...new Set(source.nodes.flatMap(node => (node.records || []).map(record => record.box)))].sort();
  const standard = {
    ...source, id:'RD-R01', routeId:'RD-R01', name:'标准工艺路线', unit:'箱',
    boxes:knownBoxes, boxOrder:knownBoxes, routeTotalBoxes:source.totalBoxes,
    nodes:source.nodes.map(node => ({...node,routeId:'RD-R01',boundBoxes:[...knownBoxes],totalBound:source.totalBoxes}))
  };
  const sampleBoxes = ['YX-001','YX-002','YX-003'];
  // A topological order keeps every simulated downstream approval after its prerequisites.
  const edges = source.mainSequence.slice(1).map((id,index) => [source.mainSequence[index],id]);
  source.groups.forEach(group => group.members.forEach(id => edges.push([group.source,id],[id,group.target])));
  const pending = new Set(source.nodes.map(node => node.id)), order = [];
  while (pending.size) {
    const ready = source.nodes.find(node => pending.has(node.id) && edges.every(([from,to]) => to !== node.id || !pending.has(from)));
    if (!ready) throw new Error('The process route contains a cycle');
    order.push(ready.id);pending.delete(ready.id);
  }
  const text = ms => new Date(ms).toISOString().slice(0,19).replace('T',' ');
  const sampleNodes = source.nodes.map(node => {
    const rank = order.indexOf(node.id);
    const records = sampleBoxes.map((box,index) => {
      const completed = [order.length,35,13][index], reported = rank < completed+(index ? 1 : 0);
      const start = Date.UTC(2026,10,2+index,8,30)+rank*7*60*60*1000;
      return {box,workshop:(node.phase === 'ST' ? '结构' : '装修')+['一','二','三'][index]+'车间',
        reportedAt:reported ? text(start) : null,
        selfPassedAt:reported ? text(start+40*60*1000) : null,
        acceptedAt:rank < completed ? text(start+90*60*1000) : null};
    });
    return {...node,routeId:'RD-R02',boundBoxes:[...sampleBoxes],totalBound:3,records,
      reported:records.filter(record => record.reportedAt).length,
      accepted:records.filter(record => record.acceptedAt).length};
  });
  const sample = {...source,id:'RD-R02',routeId:'RD-R02',name:'样箱',unit:'台',totalBoxes:3,routeTotalBoxes:3,
    boxes:sampleBoxes,boxOrder:sampleBoxes,nodes:sampleNodes,
    progressSource:{...source.progressSource,firstRecordDate:'2026-11-02',snapshotDate:'2026-11-26'}};
  const routes = [standard,sample];
  const getRoute = id => routes.find(route => route.id === id);
  function workshopFor(route,node,box) {
    const record = node.records.find(item => item.box === box);
    return record?.workshop || (node.phase === 'ST' ? '结构' : '装修')+['一','二','三'][Math.max(0,route.boxOrder.indexOf(box))%3]+'车间';
  }
  function scope(id,query = '') {
    const route = getRoute(id) || standard, text = String(query).trim().toLowerCase();
    if (!text) return route;
    const nodes = route.nodes.map(node => {
      const boundBoxes = node.boundBoxes.filter(box => workshopFor(route,node,box).toLowerCase().includes(text));
      const allowed = new Set(boundBoxes), records = node.records.filter(record => allowed.has(record.box));
      return {...node,boundBoxes,totalBound:boundBoxes.length,records,
        reported:records.filter(record => record.reportedAt).length,
        accepted:records.filter(record => record.acceptedAt).length};
    }).filter(node => node.boundBoxes.length);
    const ids = new Set(nodes.map(node => node.id)), boxes = [...new Set(nodes.flatMap(node => node.boundBoxes))];
    return {...route,workshopQuery:query,boxes,totalBoxes:boxes.length,nodes,
      mainSequence:route.mainSequence.filter(id => ids.has(id)),
      groups:route.groups.filter(group => ids.has(group.source) && ids.has(group.target)).map(group => ({...group,members:group.members.filter(id => ids.has(id))})).filter(group => group.members.length)};
  }
  function workshops(id) {
    const route = getRoute(id) || standard;
    return [...new Set(route.nodes.flatMap(node => node.boundBoxes.map(box => workshopFor(route,node,box))))].sort((a,b) => a.localeCompare(b,'zh-CN'));
  }
  let aggregateCache;
  function aggregate() {
    if (aggregateCache) return aggregateCache;
    const ids=[...new Set(routes.flatMap(route=>route.nodes.map(node=>node.id)))];
    const nodes=ids.map(id=>{
      const entries=routes.map(route=>({route,node:route.nodes.find(node=>node.id===id)})).filter(entry=>entry.node);
      const boundBoxes=[...new Set(entries.flatMap(entry=>entry.node.boundBoxes))],records=new Map();
      for(const {route,node} of entries)for(const record of node.records){
        const candidate={...record,routeId:route.id,routeName:route.name,workshop:workshopFor(route,node,record.box)};
        const previous=records.get(record.box),score=item=>item?.acceptedAt?2:item?.reportedAt?1:0;
        if(!previous||score(candidate)>score(previous))records.set(record.box,candidate);
      }
      const totalBound=boundBoxes.length+entries.reduce((sum,{node,route})=>sum+Math.max(0,(node.totalBound ?? route.totalBoxes)-node.boundBoxes.length),0);
      const combined=[...records.values()];
      return {...entries[0].node,routeId:'all',boundBoxes,totalBound,records:combined,
        reported:combined.filter(record=>record.reportedAt).length,accepted:combined.filter(record=>record.acceptedAt).length,
        routeStats:entries.map(({route,node})=>({id:route.id,name:route.name,totalBoxes:node.totalBound ?? route.totalBoxes,reported:node.reported,accepted:node.accepted}))};
    });
    const totalBoxes=source.totalBoxes+sample.totalBoxes;
    aggregateCache={...source,id:'all',routeId:'all',name:'全部工艺路线',unit:'箱',totalBoxes,routeTotalBoxes:totalBoxes,nodes,
      boxes:[...new Set(routes.flatMap(route=>route.boxes))],boxOrder:[...new Set(routes.flatMap(route=>route.boxOrder))],
      progressSource:{...source.progressSource,firstRecordDate:routes.map(route=>route.progressSource.firstRecordDate).sort()[0],snapshotDate:routes.map(route=>route.progressSource.snapshotDate).sort().at(-1)}};
    return aggregateCache;
  }
  window.QMS_ROUTE_CATALOG = {routes,getRoute,scope,workshops,workshopFor,aggregate,projectTotal:source.totalBoxes+sample.totalBoxes,
    completedBoxes:routes.reduce((sum,route) => sum+(route.nodes.find(node => node.id === route.mainSequence.at(-1))?.accepted || 0),0)};
})();
