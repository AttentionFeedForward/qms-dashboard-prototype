(() => {
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=window.QMS_ROUTE_CATALOG,source=window.ROCKDALE_ROUTE;
if(!source){$('#graph').innerHTML='<p class="diagram-error">路线数据未能加载，请刷新页面重试。</p>';return;}
const params=new URLSearchParams(location.search),embedded=params.get('embedded')==='1';
if(embedded){document.body.classList.add('embedded-route');document.documentElement.classList.add('embedded-document');}
const query=params.get('layout');
const state={mode:['horizontal','vertical'].includes(query)?query:'auto',orientation:'horizontal',open:new Set(),selected:null,query:'',
 routeId:catalog?.getRoute(params.get('route'))?.id || 'RD-R01',workshop:params.get('workshop') || '',phase:'ST'};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let data,nodes,groups,mains,nodeMap,groupMap;
let positions=new Map(),frames=new Map(),laneBounds=new Map(),columnWidth=0,cardWidth=160,cardHeight=132,graphWidth=0,graphHeight=0,lastFocus=null;
const get=id=>nodeMap.get(id),phaseName=p=>p==='ST'?'结构制造':'装修施工';
const quantity=v=>Number.isInteger(v)?v:'—';
function refreshData(){
 data=catalog?.scope(state.routeId,state.workshop) || source;
 nodes=data.nodes;groups=data.groups;nodeMap=new Map(nodes.map(n=>[n.id,n]));groupMap=new Map(groups.map(g=>[g.id,g]));
 mains=data.mainSequence.map(id=>get(id));
 if(!mains.some(n=>n.phase===state.phase))state.phase=mains[0]?.phase || 'ST';
}
refreshData();
function matches(n){
 const q=state.query.toLowerCase().replaceAll('-','').trim();
 return q&&(n.id+n.name).toLowerCase().replaceAll('-','').includes(q);
}
function related(g){const n=get(state.selected);return !!n&&!!g&&(n.groupId===g.id||n.id===g.source||n.id===g.target);}
function measure(g,horizontal){
 const count=g.members.length;
 if(!state.open.has(g.id))return {width:horizontal?174:cardWidth+26,height:horizontal?60:62};
 return horizontal?{width:30+count*cardWidth+(count-1)*14,height:cardHeight+64}:{width:cardWidth+26,height:60+count*cardHeight+(count-1)*10};
}
function layout(){
 const available=$('#viewport').clientWidth,horizontal=state.mode==='auto'?innerWidth>=800:state.mode==='horizontal';
 state.orientation=horizontal?'horizontal':'vertical';
 const lanes=['ST','AR'].map(phase=>mains.filter(n=>n.phase===phase)).filter(lane=>lane.length);
 cardWidth=horizontal?160:Math.max(88,Math.min(160,Math.floor((available-12-8*(lanes.length-1))/lanes.length)-36));
 cardHeight=horizontal?128:cardWidth<132?116:110;
 columnWidth=cardWidth+36;positions=new Map();frames=new Map();laneBounds=new Map();
 if(!horizontal){
  let bottom=0;
  lanes.forEach((lane,laneIndex)=>{
   const left=6+laneIndex*(columnWidth+8);let cursor=52;
   laneBounds.set(lane[0].phase,{x:left,width:columnWidth});
   for(const node of lane){
    for(const group of groups.filter(group=>group.target===node.id)){
     const frame={x:left+8,y:cursor,width:cardWidth+20,height:measure(group,false).height,phase:node.phase};
     frames.set(group.id,frame);
     if(state.open.has(group.id))group.members.forEach((id,index)=>positions.set(id,{x:frame.x+9,y:frame.y+45+index*(cardHeight+10)}));
     cursor+=frame.height+24;
    }
    positions.set(node.id,{x:left+18,y:cursor});cursor+=cardHeight+28;
   }
   bottom=Math.max(bottom,cursor+14);
  });
  graphWidth=lanes.length*columnWidth+(lanes.length-1)*8+12;graphHeight=bottom;return;
 }
 const sizes=new Map(groups.map(group=>[group.id,measure(group,true)]));
 let laneTop=0,maxWidth=0;
 for(const lane of lanes){
  const axis=lane.map((_,index)=>28+index*(cardWidth+44)),index=new Map(lane.map((node,i)=>[node.id,i]));
  const laneGroups=groups.filter(group=>index.has(group.source)&&index.has(group.target));
  for(const group of laneGroups){
   const from=index.get(group.source),to=index.get(group.target),span=axis[to]-axis[from]-cardWidth,delta=Math.max(0,sizes.get(group.id).width+32-span);
   if(delta)lane.forEach((_,i)=>{if(i>=to)axis[i]+=delta;});
  }
  lane.forEach((node,i)=>positions.set(node.id,{x:axis[i],y:laneTop+48}));
  for(const group of laneGroups){
   const size=sizes.get(group.id),a=positions.get(group.source),b=positions.get(group.target);
   const frame={x:(a.x+cardWidth+b.x-size.width)/2,y:laneTop+48+cardHeight+20,...size,phase:lane[0].phase};
   frames.set(group.id,frame);
   if(state.open.has(group.id))group.members.forEach((id,i)=>positions.set(id,{x:frame.x+15+i*(cardWidth+14),y:frame.y+48}));
  }
  maxWidth=Math.max(maxWidth,axis.at(-1)+cardWidth+60);
  laneTop=Math.max(laneTop+48+cardHeight,...laneGroups.map(group=>{const frame=frames.get(group.id);return frame.y+frame.height;}))+20;
 }
 graphWidth=maxWidth;graphHeight=laneTop;
}
function nodeHTML(n,inside=false){
 const p=positions.get(n.id),position=inside?'':'left:'+p.x+'px;top:'+p.y+'px;',hit=matches(n);
 return '<button class="node'+(state.selected===n.id?' selected':'')+(hit?' search-hit':'')+'" data-node="'+n.id+'" data-line-kind="'+n.lineKind+'" data-reported="'+quantity(n.reported)+'" data-accepted="'+quantity(n.accepted)+'" style="'+position+'width:'+cardWidth+'px;height:'+cardHeight+'px" aria-label="'+esc(n.id+' '+n.name+'，报验 '+quantity(n.reported)+' 箱，验收通过 '+quantity(n.accepted)+' 箱')+'"><div class="node-top"><span>'+n.id+'</span><span class="node-role">'+(inside?'支线工序':'主线')+'</span></div><h3 title="'+esc(n.name)+'">'+esc(n.name)+'</h3><div class="quantities"><span class="reported"><small>报验箱数</small><b>'+quantity(n.reported)+'</b></span><span class="accepted"><small>验收通过箱数</small><b>'+quantity(n.accepted)+'</b></span></div></button>';
}
function frameHTML(g){
 const f=frames.get(g.id),open=state.open.has(g.id),hit=g.members.some(id=>matches(get(id)));
 return '<section class="branch-group'+(open?' is-open':'')+(related(g)?' related':'')+(hit?' search-hit':'')+'" data-group="'+g.id+'" data-source="'+g.source+'" data-target="'+g.target+'" style="left:'+f.x+'px;top:'+f.y+'px;width:'+f.width+'px;height:'+f.height+'px" aria-label="'+g.source+'至'+g.target+'的支线框"><button class="group-header" data-toggle-group="'+g.id+'" aria-expanded="'+open+'" title="框内按工序顺序列示"><div><span class="group-kicker">支线 · '+g.members.length+' 道工序</span><strong class="group-title">'+g.source+' → '+g.target+'</strong></div><span class="group-action">'+(open?'⌃':'展开 ⌄')+'</span></button>'+(open?'<div class="group-cards">'+g.members.map(id=>nodeHTML(get(id),true)).join('')+'</div>':'')+'</section>';
}
function pathHTML(from,to,branch,d,lineId='main'){
 const n=get(state.selected),hi=branch?related(groupMap.get(lineId)):n&&n.lineKind==='main'&&get(from)?.phase===n.phase;
 return '<path class="edge '+(branch?'branch':'main')+(hi?' highlight':state.selected?' dim':'')+'" data-from="'+from+'" data-to="'+to+'" data-group-edge="'+lineId+'" d="'+d+'" '+(branch?'stroke-dasharray="6 5" ':'')+'marker-end="url(#'+(hi?'arrow-selected':branch?'arrow-branch':'arrow-main')+')"/>';
}
function connections(){
 const h=state.orientation==='horizontal',paths=[];
 mains.slice(1).forEach((n,i)=>{
  const previous=mains[i],a=positions.get(previous.id),b=positions.get(n.id);let d;
  if(previous.phase!==n.phase)return;
  if(h)d='M '+(a.x+cardWidth)+' '+(a.y+cardHeight/2)+' H '+b.x;
  else{
   const center=a.x+cardWidth/2,bottom=a.y+cardHeight,blocked=[...frames.values()].some(frame=>frame.phase===n.phase&&frame.y>=bottom&&frame.y<b.y);
   const gutter=laneBounds.get(n.phase).x+2;
   d=blocked?'M '+center+' '+bottom+' V '+(bottom+8)+' H '+gutter+' V '+(b.y-8)+' H '+(b.x+cardWidth/2)+' V '+b.y:'M '+center+' '+bottom+' V '+b.y;
  }
  paths.push(pathHTML(previous.id,n.id,false,d));
 });
 for(const g of groups){
  const a=positions.get(g.source),b=positions.get(g.target),f=frames.get(g.id),key='frame:'+g.id;let entry,exit;
  if(h){
   const sx=a.x+cardWidth,tx=b.x,sy=a.y+cardHeight*.78,ty=b.y+cardHeight*.78,fy=f.y+f.height/2;
   entry='M '+sx+' '+sy+' H '+(sx+12)+' V '+fy+' H '+f.x;
   exit='M '+(f.x+f.width)+' '+fy+' H '+(tx-12)+' V '+ty+' H '+tx;
  }else{
   const lane=laneBounds.get(get(g.source).phase),right=lane.x+lane.width-3,left=lane.x+5,fy=f.y+f.height/2;
   entry='M '+(a.x+cardWidth)+' '+(a.y+cardHeight*.6)+' H '+right+' V '+fy+' H '+(f.x+f.width);
   exit='M '+f.x+' '+fy+' H '+left+' V '+(b.y-10)+' H '+(b.x+cardWidth/2)+' V '+b.y;
  }
  paths.push(pathHTML(g.source,key,true,entry,g.id),pathHTML(key,g.target,true,exit,g.id));
 }
 return paths.join('');
}
function notifyHeight(){
 if(embedded)requestAnimationFrame(()=>parent.postMessage({type:'qms-route-height',height:Math.ceil(document.querySelector('main').getBoundingClientRect().height)+2},location.origin));
}
function renderScope(){
 const route=catalog?.getRoute(state.routeId) || data;
 $('#boxCount').textContent=route.totalBoxes+' '+(route.unit || '箱');
 $('#routeScopeSummary').innerHTML='<span>路线箱数</span><strong>'+route.totalBoxes+'</strong><small>'+(route.unit || '箱')+'</small>'+(state.workshop?'<span class="scope-match">车间匹配 '+data.totalBoxes+' '+(route.unit || '箱')+'</span>':'');

}
function render(anchorId=null){
 const vp=$('#viewport'),old={x:vp.scrollLeft,y:vp.scrollTop},oldOrientation=state.orientation,oldAnchor=anchorId&&positions.get(anchorId);
 renderScope();
 if(!mains.length){
  positions=new Map();frames=new Map();graphWidth=vp.clientWidth;graphHeight=320;
  $('#graph').style.cssText='width:100%;height:320px';
  $('#graph').innerHTML='<div class="route-no-results"><strong>没有匹配的车间或工序</strong><span>请更换车间名称，或清除车间条件查看整条路线。</span><button data-clear-workshop>清除车间条件</button></div>';
  $('#overviewSvg').innerHTML='';$('#routeCount').textContent='0 道工序';$('#expandAll').disabled=true;$('#collapseAll').disabled=true;
  vp.style.height='320px';notifyHeight();return;
 }
 layout();const h=state.orientation==='horizontal';
 document.body.classList.toggle('layout-vertical',!h);document.body.classList.toggle('layout-horizontal',h);document.body.dataset.orientation=state.orientation;
 let html='<svg class="edge-svg" width="'+graphWidth+'" height="'+graphHeight+'" aria-hidden="true"><defs>'+[['arrow-main','#93b1bc'],['arrow-branch','#90b5a5'],['arrow-selected','#75d7c2']].map(([id,color])=>'<marker id="'+id+'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="'+color+'"/></marker>').join('')+'</defs>'+connections()+'</svg>';
 for(const phase of ['ST','AR']){
  const first=mains.find(n=>n.phase===phase);if(!first)continue;
  const p=positions.get(first.id),x=h?p.x:laneBounds.get(phase).x+8,y=h?p.y-38:p.y-40;
  html+='<div class="phase-label" data-phase-label="'+phase+'" style="left:'+x+'px;top:'+y+'px;'+(!h?'width:'+(columnWidth-16)+'px':'')+'"><b>'+(phase==='ST'?'01':'02')+'</b>'+phaseName(phase)+'<small>'+nodes.filter(n=>n.phase===phase).length+' 道</small></div>';
 }
 html+=mains.map(n=>nodeHTML(n)).join('')+groups.map(frameHTML).join('');
 if(h){const end=positions.get(mains.at(-1).id);html+='<span class="route-end" style="left:'+(end.x+cardWidth+20)+'px;top:'+(end.y+cardHeight/2-7)+'px">终点</span>';}
 else for(const phase of ['ST','AR']){const last=mains.filter(node=>node.phase===phase).at(-1);if(!last)continue;const end=positions.get(last.id);html+='<span class="route-end" style="left:'+(end.x+3)+'px;top:'+(end.y+cardHeight+16)+'px">'+phaseName(phase)+'结束</span>';}
 $('#graph').style.width=graphWidth+'px';$('#graph').style.height=graphHeight+'px';$('#graph').innerHTML=html;
 vp.style.height=embedded&&h?Math.min(1200,graphHeight)+'px':'';
 $('#orientationLabel').textContent=h?'分阶段两排':'分阶段两列';
 $('#readingHint').textContent=h?'→ 结构在上，装修在下；点击支线框展开':laneBounds.size===2?'↓ 左侧结构、右侧装修；点击支线框展开':'↓ 沿工艺顺序阅读，点击支线框展开';
 $('#routeCount').textContent=nodes.length+' 道工序 · '+mains.length+' 道主线';
 $('#collapseAll').disabled=state.open.size===0;$('#expandAll').disabled=state.open.size===groups.length;
 $('#layoutMode').value=state.mode;$('#scrollHint').textContent=h?'横向滚动':'向下滚动';
 if(oldOrientation===state.orientation){
  vp.scrollLeft=old.x;vp.scrollTop=old.y;
  if(oldAnchor&&anchorId&&positions.has(anchorId)){const p=positions.get(anchorId);vp.scrollLeft+=p.x-oldAnchor.x;vp.scrollTop+=p.y-oldAnchor.y;}
 }else{vp.scrollLeft=0;vp.scrollTop=0;}
 renderOverview();updateNavigation();notifyHeight();
}
function renderOverview(){
 const h=state.orientation==='horizontal',length=h?graphWidth:graphHeight;
 $('#overviewSvg').setAttribute('viewBox','0 0 1000 28');
 $('#overviewSvg').innerHTML='<path d="M0 8 H1000 M0 20 H1000" stroke="#2c4f58"/>'+mains.map(n=>'<rect x="'+((h?positions.get(n.id).x:positions.get(n.id).y)/length*1000)+'" y="'+(n.phase==='ST'?4:16)+'" width="'+Math.max(2,(h?cardWidth:cardHeight)/length*1000)+'" height="8" rx="1" fill="'+(n.phase==='ST'?'#5a9e92':'#7593b1')+'"/>').join('');
}
function updateNavigation(){
 const vp=$('#viewport'),h=state.orientation==='horizontal';
 const length=Math.max(1,h?graphWidth:graphHeight),ratio=(h?vp.clientWidth:vp.clientHeight)/length,left=(h?vp.scrollLeft:vp.scrollTop)/length;
 $('#overviewWindow').style.width=Math.min(100,ratio*100)+'%';$('#overviewWindow').style.left=left*100+'%';
 $('#overview').setAttribute('aria-valuenow',String(Math.round(100*(h?vp.scrollLeft:vp.scrollTop)/Math.max(1,h?vp.scrollWidth-vp.clientWidth:vp.scrollHeight-vp.clientHeight))));
}
function message(text){$('#searchMessage').textContent=text;$('#searchMessage').classList.toggle('show',!!text);}
function toggleGroup(id){
 const g=groupMap.get(id);if(state.open.has(id))state.open.delete(id);else state.open.add(id);
 render(g.source);
}
function moveTo(id,behavior=reduced?'instant':'smooth'){
 const p=positions.get(id);if(!p)return;
 const vp=$('#viewport'),h=state.orientation==='horizontal';
 state.phase=get(id).phase;
 vp.scrollTo({left:h?Math.max(0,p.x-35):Math.max(0,p.x+cardWidth-vp.clientWidth+14),top:h?Math.max(0,p.y-64):Math.max(0,p.y-55),behavior});updateNavigation();
}
function locate(id,openDrawerToo=false){
 const n=get(id);if(!n)return;if(n.groupId)state.open.add(n.groupId);
 state.selected=id;render();moveTo(id);
 if(openDrawerToo)openDrawer(id);else requestAnimationFrame(()=>$('[data-node="'+id+'"]')?.focus({preventScroll:true}));
}
function visibleAnchor(){
 const vp=$('#viewport'),h=state.orientation==='horizontal',current=h?vp.scrollLeft:vp.scrollTop;
 const candidates=h?mains.filter(n=>n.phase===state.phase):mains;if(!candidates.length)return null;
 return candidates.reduce((best,n)=>Math.abs((h?positions.get(n.id).x:positions.get(n.id).y)-current)<Math.abs((h?positions.get(best.id).x:positions.get(best.id).y)-current)?n:best,candidates[0]).id;
}
function openDrawer(id){
 const n=get(id);if(!n)return;const wasOpen=$('#drawer').open;if(!wasOpen)lastFocus=document.activeElement;
 state.selected=id;state.phase=n.phase;if(n.groupId)state.open.add(n.groupId);render();
 if(embedded){parent.postMessage({type:'qms-route-select',id,routeId:state.routeId,workshop:state.workshop},location.origin);return;}
 $('#drawerTitle').textContent='工序详情 · '+n.id+' '+n.name;
 window.QMS_ROUTE_DETAIL.mount($('#drawerBody'),n,data);
 if(!wasOpen)$('#drawer').showModal();$('#drawer').scrollTop=0;$('#closeDrawer').focus({preventScroll:true});
}
function workshopOptions(){
 $('#workshopOptions').innerHTML=(catalog?.workshops(state.routeId) || []).map(name=>'<option value="'+esc(name)+'"></option>').join('');
}
function processOptions(){ $('#processOptions').innerHTML=nodes.map(node=>'<option value="'+esc(node.id)+'" label="'+esc(node.name)+'"></option>').join(''); }
function changeScope(routeId,workshop=''){
 state.routeId=routeId;state.workshop=workshop;state.selected=null;state.query='';state.open.clear();$('#search').value='';message('');
 refreshData();processOptions();$('#viewport').scrollTo({left:0,top:0,behavior:'instant'});render();
 const url=new URL(location.href);url.searchParams.set('route',state.routeId);
 if(state.workshop)url.searchParams.set('workshop',state.workshop);else url.searchParams.delete('workshop');
 history.replaceState(null,'',url);
 if(embedded)parent.postMessage({type:'qms-route-context',routeId:state.routeId,workshop:state.workshop},location.origin);
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-clear-workshop]')){$('#workshopSearch').value='';changeScope(state.routeId,'');return;}
 const toggle=event.target.closest('[data-toggle-group]');if(toggle){toggleGroup(toggle.dataset.toggleGroup);return;}
 const node=event.target.closest('[data-node]');if(node){openDrawer(node.dataset.node);return;}
});
$('#collapseAll').addEventListener('click',()=>{const anchor=visibleAnchor();state.open.clear();if(get(state.selected)?.groupId)state.selected=null;render(anchor);});
$('#expandAll').addEventListener('click',()=>{const anchor=visibleAnchor();groups.forEach(g=>state.open.add(g.id));render(anchor);});
$('#layoutMode').addEventListener('change',event=>{
 const anchor=visibleAnchor();state.mode=event.target.value;render();if(anchor)moveTo(anchor,'instant');
 const url=new URL(location.href);if(state.mode==='auto')url.searchParams.delete('layout');else url.searchParams.set('layout',state.mode);history.replaceState(null,'',url);
});
$('#search').addEventListener('input',()=>{
 state.query=$('#search').value.trim();state.selected=null;render();const hits=nodes.filter(matches);
 message(state.query?(hits.length?'找到 '+hits.length+' 道工序，按回车定位并展开所在支线。':'未找到工序，请尝试编号或名称。'):'');
 notifyHeight();
});
$('#search').addEventListener('keydown',event=>{if(event.key==='Enter'){const n=nodes.find(matches);if(n){locate(n.id);message('已定位 '+n.id+' · '+n.name);notifyHeight();}}});
$('#routeSelect').innerHTML=(catalog?.routes || [data]).map(route=>'<option value="'+route.id+'">'+esc(route.name)+' · '+route.totalBoxes+' '+(route.unit || '箱')+'</option>').join('');
$('#routeSelect').value=state.routeId;$('#workshopSearch').value=state.workshop;workshopOptions();processOptions();
$('#routeSelect').addEventListener('change',event=>{$('#workshopSearch').value='';changeScope(event.target.value);workshopOptions();});
let workshopTimer;
$('#workshopSearch').addEventListener('input',()=>{clearTimeout(workshopTimer);workshopTimer=setTimeout(()=>changeScope(state.routeId,$('#workshopSearch').value.trim()),120);});
$('#closeDrawer').addEventListener('click',()=>$('#drawer').close());
$('#drawer').addEventListener('click',event=>{if(event.target===$('#drawer')&&event.clientX<$('#drawer').getBoundingClientRect().left)$('#drawer').close();});
$('#drawer').addEventListener('close',()=>{if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});else $('[data-node="'+state.selected+'"]')?.focus({preventScroll:true});});
const vp=$('#viewport');
vp.addEventListener('scroll',updateNavigation,{passive:true});
vp.addEventListener('wheel',event=>{
 if(state.orientation==='horizontal'&&!event.ctrlKey&&Math.abs(event.deltaY)>Math.abs(event.deltaX)&&vp.scrollWidth>vp.clientWidth){
  const before=vp.scrollLeft;vp.scrollLeft+=event.deltaY;if(before!==vp.scrollLeft)event.preventDefault();
 }
},{passive:false});
let drag=null;
vp.addEventListener('pointerdown',event=>{
 if(state.orientation!=='horizontal'||event.pointerType==='touch'||event.button!==0||event.target.closest('button,select,input'))return;
 drag={x:event.clientX,y:event.clientY,sx:vp.scrollLeft,sy:vp.scrollTop};vp.setPointerCapture(event.pointerId);vp.classList.add('dragging');
});
vp.addEventListener('pointermove',event=>{if(drag){vp.scrollLeft=drag.sx-(event.clientX-drag.x);vp.scrollTop=drag.sy-(event.clientY-drag.y);}});
const endDrag=()=>{drag=null;vp.classList.remove('dragging');};
vp.addEventListener('pointerup',endDrag);vp.addEventListener('pointercancel',endDrag);vp.addEventListener('lostpointercapture',endDrag);
$('#overview').addEventListener('click',event=>{
 const r=$('#overview').getBoundingClientRect(),h=state.orientation==='horizontal';
 vp[h?'scrollLeft':'scrollTop']=(event.clientX-r.left)/r.width*(h?graphWidth:graphHeight)-(h?vp.clientWidth:vp.clientHeight)/2;
});
$('#overview').addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();const h=state.orientation==='horizontal',axis=h?'scrollLeft':'scrollTop',extent=h?'scrollWidth':'scrollHeight';
 if(event.key==='Home')vp[axis]=0;else if(event.key==='End')vp[axis]=vp[extent];else vp[axis]+=(event.key==='ArrowRight'?1:-1)*(h?vp.clientWidth:vp.clientHeight)*.6;
});
let resizeTimer,lastWidth=vp.clientWidth,lastScreenWidth=innerWidth;
addEventListener('resize',()=>{
 if(vp.clientWidth===lastWidth&&innerWidth===lastScreenWidth)return;
 clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const anchor=visibleAnchor();lastWidth=vp.clientWidth;lastScreenWidth=innerWidth;render();if(anchor)moveTo(anchor,'instant');},100);
});
addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin)return;
 if(event.data?.type==='qms-route-visible')render();
 if(event.data?.type==='qms-route-focus')$('[data-node="'+state.selected+'"]')?.focus({preventScroll:true});
});
render();
const requestedNode=params.get('node');if(requestedNode&&get(requestedNode))locate(requestedNode);
})();
