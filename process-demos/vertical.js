(() => {
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=window.ROCKDALE_ROUTE;
if(!data){$('#graph').innerHTML='<p class="diagram-error">路线数据未能加载，请刷新页面重试。</p>';return;}
const nodes=data.nodes,groups=data.groups,mains=data.mainSequence.map(id=>nodes.find(n=>n.id===id)),nodeMap=new Map(nodes.map(n=>[n.id,n])),groupMap=new Map(groups.map(g=>[g.id,g]));
const params=new URLSearchParams(location.search),embedded=params.get('embedded')==='1';
if(embedded){document.body.classList.add('embedded-route');document.documentElement.classList.add('embedded-document');}
const query=params.get('layout');
const state={mode:['horizontal','vertical'].includes(query)?query:'auto',orientation:'horizontal',open:new Set(),selected:null,query:''};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let positions=new Map(),frames=new Map(),cardWidth=160,cardHeight=124,graphWidth=0,graphHeight=0,lastFocus=null;
const get=id=>nodeMap.get(id),phaseName=p=>p==='ST'?'结构制造':'装修施工';
const quantity=v=>Number.isInteger(v)?v:'—';
const percent=v=>Number.isInteger(v)&&data.totalBoxes?(v/data.totalBoxes*100).toFixed(1)+'%':'—';
const allEdges=mains.slice(1).map((n,i)=>({from:mains[i].id,to:n.id,branch:false}));
groups.forEach(g=>g.members.forEach(id=>allEdges.push({from:g.source,to:id,branch:true},{from:id,to:g.target,branch:true})));
const relation=(id,dir)=>allEdges.filter(e=>e[dir==='prev'?'to':'from']===id).map(e=>get(e[dir==='prev'?'from':'to']));
function matches(n){const q=state.query.toLowerCase().replaceAll('-','').trim();return q&&(n.id+n.name).toLowerCase().replaceAll('-','').includes(q);}
function related(g){const n=get(state.selected);return !!n&&(n.groupId===g.id||n.id===g.source||n.id===g.target);}
function measure(g,horizontal){
 const open=state.open.has(g.id),count=g.members.length;
 if(!open)return {width:horizontal?174:cardWidth+26,height:76};
 return horizontal?{width:30+count*cardWidth+(count-1)*14,height:cardHeight+72}:{width:cardWidth+26,height:72+count*cardHeight+(count-1)*14};
}
function layout(){
 const available=$('#viewport').clientWidth,horizontal=state.mode==='auto'?innerWidth>=800:state.mode==='horizontal';
 state.orientation=horizontal?'horizontal':'vertical';
 cardWidth=horizontal?160:Math.max(96,Math.min(160,Math.floor((available-72)/2)));
 const step=horizontal?cardWidth+44:cardHeight+64,start=horizontal?28:64;
 const axis=mains.map((n,i)=>start+i*step+(n.phase==='AR'?72:0)),index=new Map(mains.map((n,i)=>[n.id,i]));
 const sizes=new Map(groups.map(g=>[g.id,measure(g,horizontal)]));
 for(const g of groups){
  const s=index.get(g.source),t=index.get(g.target),extent=horizontal?sizes.get(g.id).width:sizes.get(g.id).height;
  const nodeExtent=horizontal?cardWidth:cardHeight,span=axis[t]-axis[s]-nodeExtent,delta=Math.max(0,extent+32-span);
  if(delta)mains.forEach((_,i)=>{if(i>=t)axis[i]+=delta;});
 }
 positions=new Map();frames=new Map();
 mains.forEach((n,i)=>positions.set(n.id,horizontal?{x:axis[i],y:64}:{x:12,y:axis[i]}));
 for(const g of groups){
  const size=sizes.get(g.id),a=positions.get(g.source),b=positions.get(g.target),startPort=(horizontal?a.x:a.y)+(horizontal?cardWidth:cardHeight),endPort=(horizontal?b.x:b.y);
  const frame=horizontal?{x:(startPort+endPort-size.width)/2,y:64+cardHeight+40,...size}:{x:12+cardWidth+22,y:(startPort+endPort-size.height)/2,...size};
  frames.set(g.id,frame);
  if(state.open.has(g.id))g.members.forEach((id,i)=>positions.set(id,horizontal?{x:frame.x+15+i*(cardWidth+14),y:frame.y+57}:{x:frame.x+13,y:frame.y+57+i*(cardHeight+14)}));
 }
 if(horizontal){graphWidth=axis.at(-1)+cardWidth+60;graphHeight=Math.max(...[...frames.values()].map(f=>f.y+f.height))+32;}
 else{graphWidth=2*cardWidth+72;graphHeight=Math.max(axis.at(-1)+cardHeight,...[...frames.values()].map(f=>f.y+f.height))+70;}
}
function nodeHTML(n,inside=false){
 const p=positions.get(n.id),position=inside?'':'left:'+p.x+'px;top:'+p.y+'px;',hit=matches(n);
 return '<button class="node'+(state.selected===n.id?' selected':'')+(hit?' search-hit':'')+'" data-node="'+n.id+'" data-line-kind="'+n.lineKind+'" data-reported="'+quantity(n.reported)+'" data-accepted="'+quantity(n.accepted)+'" style="'+position+'width:'+cardWidth+'px;height:'+cardHeight+'px" aria-label="'+esc(n.id+' '+n.name+'，报验 '+quantity(n.reported)+' 箱，验收通过 '+quantity(n.accepted)+' 箱')+'"><div class="node-top"><span>'+n.id+'</span><span class="node-role">'+(inside?'支线工序':'主线')+'</span></div><h3 title="'+esc(n.name)+'">'+esc(n.name)+'</h3><div class="quantities"><span class="reported"><small>报验箱数</small><b>'+quantity(n.reported)+'</b></span><span class="accepted"><small>验收通过箱数</small><b>'+quantity(n.accepted)+'</b></span></div></button>';
}
function frameHTML(g){
 const f=frames.get(g.id),open=state.open.has(g.id),hit=g.members.some(id=>matches(get(id)));
 return '<section class="branch-group'+(open?' is-open':'')+(related(g)?' related':'')+(hit?' search-hit':'')+'" data-group="'+g.id+'" data-source="'+g.source+'" data-target="'+g.target+'" style="left:'+f.x+'px;top:'+f.y+'px;width:'+f.width+'px;height:'+f.height+'px" aria-label="'+g.source+'至'+g.target+'的支线框"><button class="group-header" data-toggle-group="'+g.id+'" aria-expanded="'+open+'" title="表格只标注分出和汇入关系；框内按表格顺序列示，内部先后未标注"><div><span class="group-kicker">支线 · '+g.members.length+' 道工序</span><strong class="group-title">'+g.source+' → '+g.target+'</strong></div><span class="group-action">'+(open?'⌃':'展开 ⌄')+'</span></button>'+(open?'<div class="group-cards">'+g.members.map(id=>nodeHTML(get(id),true)).join('')+'</div>':'')+'</section>';
}
function pathHTML(from,to,branch,d,lineId='main'){
 const g=groupMap.get(lineId),n=get(state.selected),hi=branch?related(g):n&&n.lineKind==='main'&&get(from).phase===n.phase;
 return '<path class="edge '+(branch?'branch':'main')+(hi?' highlight':state.selected?' dim':'')+'" data-from="'+from+'" data-to="'+to+'" data-group-edge="'+lineId+'" d="'+d+'" '+(branch?'stroke-dasharray="6 5" ':'')+'marker-end="url(#'+(hi?'arrow-selected':branch?'arrow-branch':'arrow-main')+')"/>';
}
function connections(){
 const h=state.orientation==='horizontal',paths=[];
 mains.slice(1).forEach((n,i)=>{const a=positions.get(mains[i].id),b=positions.get(n.id),d=h?'M '+(a.x+cardWidth)+' '+(a.y+cardHeight/2)+' H '+b.x:'M '+(a.x+cardWidth/2)+' '+(a.y+cardHeight)+' V '+b.y;paths.push(pathHTML(mains[i].id,n.id,false,d));});
 for(const g of groups){
  const a=positions.get(g.source),b=positions.get(g.target),f=frames.get(g.id),key='frame:'+g.id;
  let entry,exit;
  if(h){
   const sx=a.x+cardWidth,tx=b.x,sy=a.y+cardHeight*.78,ty=b.y+cardHeight*.78,fy=f.y+f.height/2;
   entry='M '+sx+' '+sy+' H '+(sx+12)+' V '+fy+' H '+f.x;
   exit='M '+(f.x+f.width)+' '+fy+' H '+(tx-12)+' V '+ty+' H '+tx;
  }else{
   const sx=a.x+cardWidth*.78,tx=b.x+cardWidth*.78,sy=a.y+cardHeight,ty=b.y,cx=f.x+f.width/2;
   entry='M '+sx+' '+sy+' V '+(sy+12)+' H '+cx+' V '+f.y;
   exit='M '+cx+' '+(f.y+f.height)+' V '+(ty-12)+' H '+tx+' V '+ty;
  }
  paths.push(pathHTML(g.source,key,true,entry,g.id),pathHTML(key,g.target,true,exit,g.id));
 }
 return paths.join('');
}
function render(anchorId=null){
 const vp=$('#viewport'),old={x:vp.scrollLeft,y:vp.scrollTop},oldOrientation=state.orientation,oldAnchor=anchorId&&positions.get(anchorId);
 layout();const h=state.orientation==='horizontal';
 document.body.classList.toggle('layout-vertical',!h);document.body.classList.toggle('layout-horizontal',h);document.body.dataset.orientation=state.orientation;
 let html='<svg class="edge-svg" width="'+graphWidth+'" height="'+graphHeight+'" aria-hidden="true"><defs>'+[['arrow-main','#93b1bc'],['arrow-branch','#90b5a5'],['arrow-selected','#75d7c2']].map(([id,color])=>'<marker id="'+id+'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="'+color+'"/></marker>').join('')+'</defs>'+connections()+'</svg>';
 for(const phase of ['ST','AR']){
  const first=mains.find(n=>n.phase===phase),p=positions.get(first.id),x=h?p.x:12+cardWidth+22,y=h?26:p.y-48;
  html+='<div class="phase-label" data-phase-label="'+phase+'" style="left:'+x+'px;top:'+y+'px;'+(!h?'width:'+(cardWidth+26)+'px':'')+'"><b>'+(phase==='ST'?'01':'02')+'</b>'+phaseName(phase)+'<small>'+nodes.filter(n=>n.phase===phase).length+' 道</small></div>';
 }
 html+=mains.map(n=>nodeHTML(n)).join('')+groups.map(frameHTML).join('');
 const end=positions.get(mains.at(-1).id);
 html+='<span class="route-end" style="left:'+(h?end.x+cardWidth+20:end.x+8)+'px;top:'+(h?end.y+cardHeight/2-7:end.y+cardHeight+30)+'px">'+(h?'终点':'制造路线结束')+'</span>';
 $('#graph').style.width=graphWidth+'px';$('#graph').style.height=graphHeight+'px';$('#graph').innerHTML=html;
 $('#orientationLabel').textContent=h?'电脑横排':'手机竖排';
 $('#readingHint').textContent=h?'→ 沿工艺顺序阅读，点击支线框展开':'↓ 沿工艺顺序阅读，点击支线框展开';
 $('#routeCount').textContent=nodes.length+' 道工序 · '+mains.length+' 道主线';$('#collapseAll').disabled=state.open.size===0;$('#expandAll').disabled=state.open.size===groups.length;
 $('#layoutMode').value=state.mode;$('#scrollHint').textContent=h?'横向滚动':'向下滚动';
 if(oldOrientation===state.orientation){vp.scrollLeft=old.x;vp.scrollTop=old.y;if(oldAnchor&&anchorId){const p=positions.get(anchorId);vp.scrollLeft+=p.x-oldAnchor.x;vp.scrollTop+=p.y-oldAnchor.y;}}
 else{vp.scrollLeft=0;vp.scrollTop=0;}
 renderOverview();updateNavigation();
 if(embedded)requestAnimationFrame(()=>parent.postMessage({type:'qms-route-height',height:Math.ceil(document.querySelector('main').getBoundingClientRect().height)+2},location.origin));
}
function renderOverview(){
 const axisLength=graphWidth;
 $('#overviewSvg').setAttribute('viewBox','0 0 1000 18');
 $('#overviewSvg').innerHTML='<path d="M0 9 H1000" stroke="#2c4f58"/>'+mains.map(n=>'<rect x="'+(positions.get(n.id).x/axisLength*1000)+'" y="5" width="'+Math.max(2,cardWidth/axisLength*1000)+'" height="8" rx="1" fill="'+(n.phase==='ST'?'#5a9e92':'#7593b1')+'"/>').join('');
}
function updateNavigation(){
 const vp=$('#viewport'),h=state.orientation==='horizontal',p=positions.get('AR-01');if(!p)return;
 const phase=(h?vp.scrollLeft+vp.clientWidth*.25>=p.x:vp.scrollTop+vp.clientHeight*.25>=p.y)?'AR':'ST';
 $$('.phase-nav button').forEach(b=>{const active=b.dataset.phase===phase;b.classList.toggle('active',active);b.setAttribute('aria-current',String(active));});
 const ratio=vp.clientWidth/Math.max(1,graphWidth),left=vp.scrollLeft/Math.max(1,graphWidth);
 $('#overviewWindow').style.width=Math.min(100,ratio*100)+'%';$('#overviewWindow').style.left=left*100+'%';
 $('#overview').setAttribute('aria-valuenow',String(Math.round(100*vp.scrollLeft/Math.max(1,vp.scrollWidth-vp.clientWidth))));
}
function message(text){$('#searchMessage').textContent=text;$('#searchMessage').classList.toggle('show',!!text);}
function toggleGroup(id){
 const g=groupMap.get(id);if(state.open.has(id))state.open.delete(id);else state.open.add(id);
 render(g.source);
}
function moveTo(id,behavior=reduced?'instant':'smooth'){
 const p=positions.get(id);if(!p)return;
 const vp=$('#viewport'),h=state.orientation==='horizontal';
 vp.scrollTo({left:h?Math.max(0,p.x-35):0,top:h?0:Math.max(0,p.y-55),behavior});
}
function locate(id,openDrawerToo=false){
 const n=get(id);if(!n)return;if(n.groupId)state.open.add(n.groupId);
 state.selected=id;render();moveTo(id);
 if(openDrawerToo)openDrawer(id);else requestAnimationFrame(()=>$('[data-node="'+id+'"]')?.focus({preventScroll:true}));
}
function visibleAnchor(){
 const vp=$('#viewport'),h=state.orientation==='horizontal',current=h?vp.scrollLeft:vp.scrollTop;
 return mains.reduce((best,n)=>Math.abs((h?positions.get(n.id).x:positions.get(n.id).y)-current)<Math.abs((h?positions.get(best.id).x:positions.get(best.id).y)-current)?n:best,mains[0]).id;
}
function relationsHTML(list){return list.length?list.map(n=>'<button data-relation="'+n.id+'">'+n.id+' '+esc(n.name)+'</button>').join(''):'<span>—</span>';}
function openDrawer(id){
 const n=get(id);if(!n)return;const wasOpen=$('#drawer').open;if(!wasOpen)lastFocus=document.activeElement;
 state.selected=id;if(n.groupId)state.open.add(n.groupId);render();
 if(embedded){parent.postMessage({type:'qms-route-select',id},location.origin);return;}
 $('#drawerTitle').textContent='工序详情 · '+n.id+' '+n.name;
 window.QMS_ROUTE_DETAIL.mount($('#drawerBody'),n,data);
 if(!wasOpen)$('#drawer').showModal();$('#drawer').scrollTop=0;$('#closeDrawer').focus({preventScroll:true});
}
document.addEventListener('click',e=>{
 const toggle=e.target.closest('[data-toggle-group]');if(toggle){toggleGroup(toggle.dataset.toggleGroup);return;}
 const n=e.target.closest('[data-node]');if(n){openDrawer(n.dataset.node);return;}
 const rel=e.target.closest('[data-relation]');if(rel){locate(rel.dataset.relation,true);return;}
 const phase=e.target.closest('[data-phase]');if(phase){moveTo(phase.dataset.phase==='ST'?'ST-01':'AR-01');}
});
$('#collapseAll').addEventListener('click',()=>{const anchor=visibleAnchor();state.open.clear();if(get(state.selected)?.groupId)state.selected=null;render(anchor);});
$('#expandAll').addEventListener('click',()=>{const anchor=visibleAnchor();groups.forEach(g=>state.open.add(g.id));render(anchor);});
$('#layoutMode').addEventListener('change',e=>{const anchor=visibleAnchor();state.mode=e.target.value;render();moveTo(anchor,'instant');const url=new URL(location.href);if(state.mode==='auto')url.searchParams.delete('layout');else url.searchParams.set('layout',state.mode);history.replaceState(null,'',url);});
$('#search').addEventListener('input',()=>{state.query=$('#search').value.trim();state.selected=null;render();const hits=nodes.filter(matches);message(state.query?(hits.length?'找到 '+hits.length+' 道工序，按回车定位并展开所在支线。':'未找到工序，请尝试编号或名称。'):'');});
$('#search').addEventListener('keydown',e=>{if(e.key==='Enter'){const n=nodes.find(matches);if(n){locate(n.id);message('已定位 '+n.id+' · '+n.name);}}});
$('#closeDrawer').addEventListener('click',()=>$('#drawer').close());
$('#drawer').addEventListener('click',e=>{if(e.target===$('#drawer')&&e.clientX<$('#drawer').getBoundingClientRect().left)$('#drawer').close();});
$('#drawer').addEventListener('close',()=>{if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});else $('[data-node="'+state.selected+'"]')?.focus({preventScroll:true});});
const vp=$('#viewport');vp.addEventListener('scroll',updateNavigation,{passive:true});
vp.addEventListener('wheel',e=>{if(state.orientation==='horizontal'&&!e.ctrlKey&&Math.abs(e.deltaY)>Math.abs(e.deltaX)&&vp.scrollWidth>vp.clientWidth){const before=vp.scrollLeft;vp.scrollLeft+=e.deltaY;if(before!==vp.scrollLeft)e.preventDefault();}},{passive:false});
let drag=null;
vp.addEventListener('pointerdown',e=>{if(state.orientation!=='horizontal'||e.pointerType==='touch'||e.button!==0||e.target.closest('button,select,input'))return;drag={x:e.clientX,y:e.clientY,sx:vp.scrollLeft,sy:vp.scrollTop};vp.setPointerCapture(e.pointerId);vp.classList.add('dragging');});
vp.addEventListener('pointermove',e=>{if(drag){vp.scrollLeft=drag.sx-(e.clientX-drag.x);vp.scrollTop=drag.sy-(e.clientY-drag.y);}});
const endDrag=()=>{drag=null;vp.classList.remove('dragging');};vp.addEventListener('pointerup',endDrag);vp.addEventListener('pointercancel',endDrag);vp.addEventListener('lostpointercapture',endDrag);
$('#overview').addEventListener('click',e=>{const r=$('#overview').getBoundingClientRect();vp.scrollLeft=(e.clientX-r.left)/r.width*graphWidth-vp.clientWidth/2;});
$('#overview').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='Home')vp.scrollLeft=0;else if(e.key==='End')vp.scrollLeft=vp.scrollWidth;else vp.scrollLeft+=(e.key==='ArrowRight'?1:-1)*vp.clientWidth*.6;}});
let resizeTimer,lastWidth=vp.clientWidth,lastScreenWidth=innerWidth;
addEventListener('resize',()=>{if(vp.clientWidth===lastWidth&&innerWidth===lastScreenWidth)return;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const anchor=visibleAnchor();lastWidth=vp.clientWidth;lastScreenWidth=innerWidth;render();moveTo(anchor,'instant');},100);});
$('#boxCount').textContent=data.totalBoxes+' 箱';

addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;if(e.data?.type==='qms-route-visible'){render();}if(e.data?.type==='qms-route-focus')$('[data-node="'+state.selected+'"]')?.focus({preventScroll:true});});
render();
})();
