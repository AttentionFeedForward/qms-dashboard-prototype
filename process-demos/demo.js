(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const views = {
 route:{n:'01',title:'工艺路线图',copy:'从左向右读工艺；分叉、汇合直接连接，不再依赖编号猜顺序。',insight:'主线居中，支线在下方展开。缩略导航保留全局位置，长流程横向延伸，不再换行堆叠。'},
 lanes:{n:'02',title:'主支线泳道',copy:'每条路线独占一行；横向位置表达推进顺序，不是日期或工时。',insight:'固定左侧泳道名称，主线与支线分行对齐。跨行连线明确从哪里分出、在哪里汇合。'},
 hierarchy:{n:'03',title:'分层工艺导航',copy:'先看阶段，再进入局部路线；左侧目录与搜索帮助快速定位。',insight:'概览保留结构与装修的衔接，阶段内再展开主支线。切换到 60 道工序，体验目录与搜索定位。'}
};
const status = {normal:'正常',risk:'异常',attention:'关注',waiting:'未开始'};
const state = {view:new URLSearchParams(location.search).get('view') || 'route',size:22,metric:'reported',stMode:'parallel',zoom:1,branches:true,stage:'all',selected:null,query:'',period:'day'};
if(!views[state.view]) state.view='route';
let nodes=[], edges=[], positions=new Map(), drawWidth=0, drawHeight=0, lastFocus=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mainNames=['箱体总装','箱体总焊','尺寸检验','打砂','底漆施工','防火施工','面漆施工','闭水试验','调平放线','天花折弯件安装','天花施工','墙板折弯件安装','墙板安装','装修终箱验收','打包'];
const counts=[500,480,461,420,400,360,330,300,260,220,190,140,98,0,0];
function makeData(){
 nodes=mainNames.map((name,i)=>({id:(i<8?'ST-':'AR-')+String(i<8?i+1:i-7).padStart(2,'0'),name,phase:i<8?'ST':'AR',lineKind:'main',lineId:'main',branch:0,row:0,col:i,count:counts[i],today:counts[i]?Math.max(2,18-i):0,status:i===10?'attention':counts[i]?'normal':'waiting'}));
 if(state.size===60)for(let i=8;i<=45;i++)nodes.push({id:'AR-'+String(i).padStart(2,'0'),name:'装修扩展示例 '+(i-7),phase:'AR',lineKind:'main',lineId:'main',branch:0,row:0,col:i+7,count:0,today:0,status:'waiting'});
 const mains=[...nodes];
 edges=mains.slice(1).map((n,i)=>({from:mains[i].id,to:n.id,branch:false}));
 for(const g of branchDefinitions()){
  const from=mains.find(n=>n.id===g.source),to=mains.find(n=>n.id===g.target);
  g.items.forEach(([id,name,count,today,status],row)=>nodes.push({id,name,count,today,status,phase:g.phase,lineKind:'branch',lineId:g.id,branch:g.branch,row:g.mode==='serial'?0:row,col:from.col+(to.col-from.col)*(g.mode==='serial'?(row+1)/(g.items.length+1):.5)}));
  if(g.mode==='parallel')g.items.forEach(([id])=>edges.push({from:g.source,to:id,branch:true,lineId:g.id},{from:id,to:g.target,branch:true,lineId:g.id}));
  else{const chain=[g.source,...g.items.map(item=>item[0]),g.target];chain.slice(1).forEach((id,i)=>edges.push({from:chain[i],to:id,branch:true,lineId:g.id}));}
 }
 nodes.forEach(n=>{n.reported=n.count;n.accepted=Math.floor(n.count*(n.status==='risk'?.86:n.status==='attention'?.9:.97));n.reportedToday=n.today;n.acceptedToday=Math.floor(n.today*.6);});
}
function branchDefinitions(){
 return [
  {id:'structure',phase:'ST',branch:1,source:'ST-01',target:'ST-04',label:'结构支线',mode:state.stMode,items:[['ST-03a','结构支线工序 A',450,8,'normal'],['ST-03b','结构支线工序 B',440,0,'risk']]},
  {id:'renovation-1',phase:'AR',branch:2,source:'AR-01',target:'AR-04',label:'装修支线①',mode:'parallel',items:[['AR-03a','电气预埋（示例）',182,6,'normal'],['AR-03b','给排水预埋（示例）',176,5,'normal']]},
  {id:'renovation-2',phase:'AR',branch:3,source:'AR-02',target:'AR-05',label:'装修支线②',mode:'parallel',items:[['AR-04a','电气安装（示例）',132,5,'normal'],['AR-04b','给排水安装（示例）',126,4,'normal'],['AR-04c','保温施工（示例）',118,3,'normal']]}
 ];
}
function quantity(n){return n[state.metric];}
function increment(n){return n[state.metric==='reported'?'reportedToday':'acceptedToday'];}
function metricLabel(){return state.metric==='reported'?'报验箱数':'验收通过箱数';}
function metricDefinition(){return state.metric==='reported'?'生产完成后已报验的去重箱体数量':'已报验且验收通过的去重箱体数量';}
function metricSwitchHTML(){return '<div class="metric-toggle" role="group" aria-label="数量统计口径"><button data-metric="reported" aria-pressed="'+(state.metric==='reported')+'" class="'+(state.metric==='reported'?'active':'')+'">报验箱数</button><button data-metric="accepted" aria-pressed="'+(state.metric==='accepted')+'" class="'+(state.metric==='accepted'?'active':'')+'">验收通过箱数</button></div>';}
function branchGroups(subset=nodes){
 return branchDefinitions().map(g=>({...g,items:subset.filter(n=>n.lineId===g.id)})).filter(g=>g.items.length);
}
const get=id=>nodes.find(n=>n.id===id);
const phaseName=p=>p==='ST'?'结构制造':'装修施工';
const routeName=n=>n.lineKind==='main'?'主线':branchDefinitions().find(g=>g.id===n.lineId).label;
function relation(id,dir){return edges.filter(e=>e[dir==='prev'?'to':'from']===id).map(e=>get(e[dir==='prev'?'from':'to']));}
function matching(n){const q=state.query.toLowerCase().replaceAll('-','').trim();return q && (n.id+n.name).toLowerCase().replaceAll('-','').includes(q);}
function neighbors(){
 const n=get(state.selected),near=new Set([state.selected,...edges.filter(e=>e.from===state.selected||e.to===state.selected).flatMap(e=>[e.from,e.to])]);
 if(!n)return near;
 if(n.lineKind==='branch'){
  const g=branchGroups().find(g=>g.id===n.lineId);near.add(g.source);near.add(g.target);
  if(g.mode==='serial')g.items.forEach(item=>near.add(item.id));
 }else{
  nodes.filter(item=>item.lineKind==='main'&&item.phase===n.phase).forEach(item=>near.add(item.id));
  for(const g of branchGroups())if(g.target===n.id||g.source===n.id)g.items.forEach(item=>near.add(item.id));
 }
 return near;
}
function nodeHTML(n,x,y){
 const near=neighbors(),dim=state.selected&&!near.has(n.id),value=quantity(n),pct=value/5,pre=relation(n.id,'prev');
 const join=pre.length>1?'<span class="join-note">AND · 全部 '+pre.length+' 道前置满足后开工</span>':'';
 return '<button class="node '+n.status+(state.selected===n.id?' selected':'')+(dim?' dim':'')+(matching(n)?' search-hit':'')+'" data-line-kind="'+n.lineKind+'" data-node="'+n.id+'" data-quantity="'+value+'" style="left:'+x+'px;top:'+y+'px" aria-label="'+n.id+' '+n.name+'，'+routeName(n)+'，'+metricLabel()+value+'箱，'+status[n.status]+'"><span class="node-top"><span>'+n.id+'</span><span class="node-status">'+(n.status==='risk'?'! ':n.status==='normal'?'● ':'')+status[n.status]+'</span></span><h4>'+n.name+'</h4><div class="node-numbers"><b>'+value+'</b><small>/ 500 箱</small><em>'+pct+'%</em></div><span class="progress"><i style="width:'+pct+'%"></i></span>'+join+'</button>';
}
function edgeHTML(e){
 const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)return '';
 const aMain=get(e.from)?.lineKind==='main',bMain=get(e.to)?.lineKind==='main';
 let d;
 if(!e.branch)d='M '+(a.x+150)+' '+(a.y+54)+' H '+b.x;
 else if(aMain){
  const sx=a.x+75,sy=a.y+108,rail=sy+16;
  d='M '+sx+' '+sy+' V '+rail+' H '+(b.x-18)+' V '+(b.y+54)+' H '+b.x;
 }else if(bMain){
  const tx=b.x+75,ty=b.y+108,rail=ty+32;
  d='M '+(a.x+150)+' '+(a.y+54)+' H '+(a.x+168)+' V '+rail+' H '+tx+' V '+ty;
 }else d='M '+(a.x+150)+' '+(a.y+54)+' H '+b.x;
 const near=neighbors(),hi=state.selected&&near.has(e.from)&&near.has(e.to);
 return '<path data-from="'+e.from+'" data-to="'+e.to+'" data-line-id="'+(e.lineId||'main')+'" class="edge '+(e.branch?'branch':'main')+(hi?' highlight':state.selected?' dim':'')+'" d="'+d+'" '+(e.branch?'stroke-dasharray="7 6" ':'')+'marker-end="url(#'+(hi?'arrow-highlight':e.branch?'arrow-branch':'arrow')+')"/>';
}
function phaseBands(subset,lane){
 let out='';
 for(const p of ['ST','AR']){
  const items=subset.filter(n=>n.phase===p&&!n.branch);if(!items.length)continue;
  const start=positions.get(items[0].id).x-28,end=positions.get(items.at(-1).id).x+178,w=end-start;
  out+=lane?'<div class="lane-phase" style="left:'+start+'px;width:'+w+'px">'+p+' / '+phaseName(p)+' <small> → 工艺推进方向</small></div>':'<div class="phase-band '+(p==='AR'?'ar':'')+'" style="left:'+start+'px;width:'+w+'px"><span class="phase-name"><b>'+p+'</b>'+phaseName(p)+'<small>'+subset.filter(n=>n.phase===p).length+' 道工序</small></span></div>';
 }
 return out;
}
function canvasHTML(lane=false,phase='all'){
 const subset=nodes.filter(n=>phase==='all'||n.phase===phase),base=Math.min(...subset.map(n=>n.col)),groups=branchGroups(subset),mainY=lane?103:142;
 positions=new Map();
 subset.forEach(n=>{if(state.branches||n.lineKind==='main')positions.set(n.id,{x:60+(n.col-base)*190,y:n.lineKind==='branch'?(lane?280:310)+n.row*128:mainY});});
 drawWidth=Math.max(...subset.map(n=>60+(n.col-base)*190))+210;
 drawHeight=lane?664:712;
 let inside='';
 if(lane)inside='<div class="lane-row" style="top:49px;height:221px"></div>'+[0,1,2].map(row=>'<div class="lane-row" style="top:'+(270+row*128)+'px;height:128px"></div>').join('');
 inside+=phaseBands(subset,lane);
 if(lane)inside+=subset.filter(n=>n.lineKind==='main').map(n=>'<span class="lane-step" style="left:'+positions.get(n.id).x+'px">MAIN '+n.id+'</span>').join('');
 else inside+='<span class="route-label" style="left:60px;top:110px"><strong>主线</strong> / 实线保持连续 →</span>';
 if(state.branches){
  for(const g of groups){
   const first=positions.get(g.items[0].id),caption=g.label+' · '+g.source+' → '+g.target;
   inside+='<span class="route-label branch-caption" style="left:'+first.x+'px;top:'+(lane?258:288)+'px" title="'+caption+' · '+(g.mode==='parallel'?'并行':'串行')+'">'+caption+'</span>';
  }
 }
 if(phase==='AR'&&!lane)inside+='<span class="stage-transition" style="left:60px">阶段入口：ST-08 → AR-01</span>';
 if(phase==='ST'&&!lane)inside+='<span class="stage-transition" style="left:'+(drawWidth-330)+'px">阶段出口：ST-08 → AR-01</span>';
 let visibleEdges=edges;
 if(!state.branches){
  visibleEdges=edges.filter(e=>!e.branch);
  for(const g of groups){
   const from=get(g.source),to=get(g.target),key='group:'+g.target,x=60+((from.col+to.col)/2-base)*190,y=lane?280:310;
   positions.set(key,{x,y});
   visibleEdges.push({from:g.source,to:key,branch:true,lineId:g.id},{from:key,to:g.target,branch:true,lineId:g.id});
   inside+='<button class="parallel-fold" data-action="branches" style="left:'+x+'px;top:'+y+'px" aria-label="展开'+g.label+'"><span>＋ '+g.label+' · '+g.items.length+' 道工序</span><b>'+g.source+' → '+g.target+'</b><small>'+(g.mode==='parallel'?'支线内部并行':'支线内部串行')+' · 汇入前须满足</small></button>';
  }
 }
 inside+='<svg class="edge-svg" width="'+drawWidth+'" height="'+drawHeight+'" aria-hidden="true"><defs>'+[['arrow','#8cadb5'],['arrow-branch','#89a8a7'],['arrow-highlight','#62dfcc']].map(([id,color])=>'<marker id="'+id+'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="'+color+'"/></marker>').join('')+'</defs>'+visibleEdges.map(edgeHTML).join('')+'</svg>';
 inside+=subset.filter(n=>positions.has(n.id)).map(n=>{const p=positions.get(n.id);return nodeHTML(n,p.x,p.y);}).join('');
 return '<div class="viewport" tabindex="0" role="region" aria-label="可滚动工艺画布"><div class="scaled-space" style="width:'+drawWidth*state.zoom+'px;height:'+drawHeight*state.zoom+'px"><div class="canvas" style="width:'+drawWidth+'px;height:'+drawHeight+'px;transform:scale('+state.zoom+')">'+inside+'</div></div></div>';
}
function minimapHTML(){
 const circles=[...positions].map(([id,p])=>'<rect x="'+(p.x/drawWidth*1000)+'" y="'+(p.y/drawHeight*26)+'" width="'+Math.max(1,110/drawWidth*1000)+'" height="4" rx="1" fill="'+(get(id)?.status==='risk'?'#fa8585':get(id)?.status==='attention'?'#f2c26a':'#548b88')+'"/>').join('');
 return '<div class="minimap-wrap"><span>全流程导航</span><div class="minimap" role="slider" tabindex="0" aria-label="画布水平位置" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><svg viewBox="0 0 1000 26" preserveAspectRatio="none" aria-hidden="true">'+circles+'</svg><div class="minimap-window"></div></div><span>点击跳转</span></div>';
}
function directoryHTML(){
 const entry=n=>'<button class="dir-process '+(n.lineKind==='branch'?'branch-item ':'')+(n.id===state.selected?'active':'')+'" data-directory-node="'+n.id+'"><i class="dot '+n.status+'"></i><span class="dir-code">'+n.id+'</span><strong>'+n.name+'</strong></button>';
 return '<aside class="directory" aria-label="工序目录"><p class="directory-title">PROCESS DIRECTORY</p><button data-phase="all" class="'+(state.stage==='all'?'active':'')+'">全部阶段 <small>'+nodes.length+'</small></button>'+['ST','AR'].map(p=>{
  const all=nodes.filter(n=>n.phase===p);
  return '<button data-phase="'+p+'" class="'+(state.stage===p?'active':'')+'">'+(p==='ST'?'01':'02')+' '+phaseName(p)+'<small>'+all.length+'</small></button>'+(state.stage===p?'<p class="directory-group">主线 · 实线</p>'+all.filter(n=>n.lineKind==='main').map(entry).join('')+branchGroups(all).map(g=>'<p class="directory-group">'+g.label+' · 虚线<small>'+g.source+' → '+g.target+'</small></p>'+g.items.map(entry).join('')).join(''):'');
 }).join('<hr>')+'</aside>';
}
function overviewHTML(){
 return '<div class="overview"><h3 class="overview-title">先看全局，再进入细节。</h3><p class="overview-copy">主线实线贯通，支线以虚线独立分出和汇入；支线内部可并行或串行。</p><div class="stage-cards">'+['ST','AR'].map((p,i)=>{
 const all=nodes.filter(n=>n.phase===p),last=all.filter(n=>!n.branch).at(-1);
 return (i?'<span class="stage-arrow">→</span>':'')+'<article class="stage-card '+(i?'second':'')+'"><span>PHASE 0'+(i+1)+' / '+p+'</span><h3>'+phaseName(p)+'</h3><p>'+(i?'支线① AR-01 → AR-04；支线② AR-02 → AR-05':'ST-01 分出支线，与 ST-02、ST-03 并行，汇入 ST-04')+'</p><div class="stage-stat"><div><b>'+all.filter(n=>!n.branch).length+'</b><small>主线工序</small></div><div><b>'+all.filter(n=>n.branch).length+'</b><small>前置支线工序</small></div><div><b>'+quantity(last)+'</b><small>末道'+(state.metric==='reported'?'报验':'通过')+' / 箱</small></div></div><button data-phase="'+p+'">展开阶段路线 →</button></article>';
 }).join('')+'</div><p class="overview-note">阶段衔接：ST-08 闭水试验 → AR-01 调平放线<br>主支线身份、分出点和汇入点分别配置，编号用于识别工序。虚线表达支线路径，前置约束仍保留。</p></div>';
}
function render(keep=false){
 const prev=$('.viewport'),oldScroll=prev?{x:prev.scrollLeft,y:prev.scrollTop}:null;
 const view=views[state.view];
 $('#stage').classList.toggle('lane-stage',state.view==='lanes');
 $('#viewIndex').textContent=view.n;$('#viewTitle').textContent=view.title;$('#viewCopy').textContent=view.copy;$('#insightNumber').textContent=view.n+' / DESIGN NOTE';$('#insight').textContent=view.insight;
 $('#nodeCount').innerHTML=nodes.length+' <small>道</small>';
 $('#summaryMetric').textContent=metricLabel()+' / 项目总箱数';
 $('#metricDefinitionText').textContent=metricLabel()+'：'+metricDefinition();
 $('#ruleDescription').textContent=state.stMode==='parallel'?'支线：ST-01 ⇢ { a ∥ b } ⇢ ST-04；主线 ST-01 → ST-02 → ST-03 → ST-04':'支线：ST-01 ⇢ a ⇢ b ⇢ ST-04；主线保持连续';
 $('#stMode').value=state.stMode;
 $$('.design-tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-pressed',String(b.dataset.view===state.view));});
 $$('[data-metric]').forEach(b=>{b.classList.toggle('active',b.dataset.metric===state.metric);b.setAttribute('aria-pressed',String(b.dataset.metric===state.metric));});
 $('#zoomLabel').textContent=Math.round(state.zoom*100)+'%';$('#branchToggle').textContent='支线：'+(state.branches?'展开':'折叠');$('#branchToggle').setAttribute('aria-pressed',String(state.branches));
 const overview=state.view==='hierarchy'&&state.stage==='all';
 $$('[data-action="zoom-out"],[data-action="zoom-in"]').forEach(b=>b.disabled=overview);
 if(state.view==='route')$('#stage').innerHTML=canvasHTML()+minimapHTML();
 else if(state.view==='lanes')$('#stage').innerHTML='<div class="lane-layout"><aside class="lane-labels"><div class="lane-label"><span class="lane-number">MAIN ROUTE</span><strong>制造主线</strong><small>结构 → 装修<br>主线使用实线<br>从起点到终点持续贯通</small></div><div class="lane-label"><span class="lane-number">BRANCH A</span><strong>支线泳道 A</strong><small>ST-01 分出结构支线<br>串行时同道依序</small></div><div class="lane-label"><span class="lane-number">BRANCH B</span><strong>支线泳道 B</strong><small>与主线并行的支线<br>虚线连接分出点和汇入点</small></div><div class="lane-label"><span class="lane-number">BRANCH C</span><strong>支线泳道 C</strong><small>装修支线②<br>从 AR-02 分出，汇入 AR-05</small></div></aside>'+canvasHTML(true)+'</div>';
 else $('#stage').innerHTML='<div class="hierarchy-layout">'+directoryHTML()+'<div class="hierarchy-content"><div class="breadcrumbs"><button data-phase="all">全部阶段</button>'+(overview?' / 工艺概览':' / '+phaseName(state.stage)+'<span class="stage-navigation"><button data-phase="'+(state.stage==='ST'?'AR':'ST')+'">'+(state.stage==='ST'?'下一阶段 →':'← 上一阶段')+'</button></span>')+'</div>'+(overview?overviewHTML():canvasHTML(false,state.stage)+minimapHTML())+'</div></div>';
 $('#interactionHint').textContent=state.view==='lanes'?'泳道名称固定 · 并行单工序分行对齐 · 点击查看详情':overview?'点击阶段展开路线 · 搜索直接定位工序':'实线主线 · 虚线支线 · 支线与主线并行推进';
 bindCanvas();
 if(keep&&oldScroll&&$('.viewport')){$('.viewport').scrollLeft=oldScroll.x;$('.viewport').scrollTop=oldScroll.y;}
 updateMinimap();
}
function updateMinimap(){
 const vp=$('.viewport'),map=$('.minimap-window');if(!vp||!map)return;
 map.style.left=100*vp.scrollLeft/vp.scrollWidth+'%';map.style.width=Math.min(100,100*vp.clientWidth/vp.scrollWidth)+'%';
 const slider=$('.minimap');slider.setAttribute('aria-valuenow',String(Math.round(100*vp.scrollLeft/Math.max(1,vp.scrollWidth-vp.clientWidth))));
}
function bindCanvas(){
 const vp=$('.viewport');if(!vp)return;
 vp.addEventListener('scroll',updateMinimap,{passive:true});
 let drag=null;
 vp.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0||e.target.closest('button'))return;drag={x:e.clientX,y:e.clientY,sx:vp.scrollLeft,sy:vp.scrollTop};vp.setPointerCapture(e.pointerId);vp.classList.add('dragging');});
 vp.addEventListener('pointermove',e=>{if(!drag)return;vp.scrollLeft=drag.sx-(e.clientX-drag.x);vp.scrollTop=drag.sy-(e.clientY-drag.y);});
 const end=()=>{drag=null;vp.classList.remove('dragging');};vp.addEventListener('pointerup',end);vp.addEventListener('pointercancel',end);vp.addEventListener('lostpointercapture',end);
 const map=$('.minimap');if(map){
 map.addEventListener('click',e=>{const r=map.getBoundingClientRect();vp.scrollLeft=(e.clientX-r.left)/r.width*vp.scrollWidth-vp.clientWidth/2;});
 map.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();vp.scrollLeft+=(e.key==='ArrowRight'?1:-1)*vp.clientWidth*.5;}else if(e.key==='Home'){e.preventDefault();vp.scrollLeft=0;}else if(e.key==='End'){e.preventDefault();vp.scrollLeft=vp.scrollWidth;}});
 }
}
function locate(id,open=false){
 const n=get(id);if(!n)return;
 if(n.branch)state.branches=true;
 if(state.view==='hierarchy')state.stage=n.phase;
 state.selected=id;render(true);
 const p=positions.get(id),vp=$('.viewport');
 if(p&&vp){vp.scrollTo({left:p.x*state.zoom-vp.clientWidth/2+75*state.zoom,top:p.y*state.zoom-vp.clientHeight/2+54*state.zoom,behavior:reduced?'instant':'smooth'});}
 if(open)openDrawer(id);
 else requestAnimationFrame(()=>{const el=$('[data-node="'+id+'"]');if(el)el.focus({preventScroll:true});});
}
function message(s){$('#searchMessage').textContent=s;$('#searchMessage').classList.toggle('show',!!s);}
function search(){
 state.query=$('#search').value.trim();
 const hits=nodes.filter(matching);state.selected=null;
 render(true);
 message(state.query?(hits.length?'找到 '+hits.length+' 道工序，按回车定位首个匹配结果。':'未找到工序；请尝试 ST-03、AR-03 或工序名称。'):'');
 return hits;
}
function drawerRelations(list){return list.length?list.map(n=>'<button data-relation="'+n.id+'">'+n.id+' '+n.name+'</button>').join(''):'<span>—</span>';}
function lineDetailsHTML(n){
 if(n.lineKind!=='branch')return '';
 const g=branchDefinitions().find(g=>g.id===n.lineId);
 return '<div class="detail-relation"><span>分出工序</span><div>'+drawerRelations([get(g.source)])+'</div></div><div class="detail-relation"><span>汇入工序</span><div>'+drawerRelations([get(g.target)])+'</div></div><p class="branch-detail-note">虚线支线 · 与主线并行推进 · 支线内部'+(g.mode==='parallel'?'并行':'串行')+'</p>';
}
function openDrawer(id,preserve=false){
 const n=get(id);if(!n)return;
 state.selected=id;render(true);if(!preserve)state.period='day';
 $('#drawerBody').innerHTML='<span class="detail-code">'+n.id+'</span><h2 class="detail-title" id="drawerTitle">'+n.name+'</h2><div class="detail-meta"><span class="status-badge '+n.status+'">'+status[n.status]+'</span><span>'+phaseName(n.phase)+' / '+routeName(n)+'</span></div>'+metricSwitchHTML()+'<p class="metric-definition">'+metricDefinition()+'</p><div class="drawer-stats"><div>累计'+metricLabel()+'<b data-detail-quantity>'+quantity(n)+' <small>箱</small></b></div><div>项目箱体占比<b data-detail-pct>'+quantity(n)/5+'%</b></div><div>较昨日新增<b data-detail-increment>+'+increment(n)+' <small>箱</small></b></div></div><section class="detail-section"><div class="chart-toolbar"><h3>累计'+metricLabel()+'趋势</h3><div class="chart-tabs"><button data-period="day">日</button><button data-period="week">周</button><button data-period="month">月</button></div></div><div id="trendContent"></div><p>统计口径：'+metricDefinition()+'，按周期末累计统计。趋势为演示数据。</p></section><section class="detail-section"><h3>工艺关系</h3><div class="detail-relation"><span>所属路线</span><div>'+routeName(n)+'</div></div>'+lineDetailsHTML(n)+'<div class="detail-relation"><span>主线前序</span><div>'+drawerRelations(relation(id,'prev').filter(item=>item.lineKind==='main'))+'</div></div><div class="detail-relation"><span>支线前序</span><div>'+drawerRelations(relation(id,'prev').filter(item=>item.lineKind==='branch'))+'</div></div><div class="detail-relation"><span>直接后序</span><div>'+drawerRelations(relation(id,'next'))+'</div></div>'+(relation(id,'prev').length>1?'<p class="prerequisite-note">AND 汇合：全部 '+relation(id,'prev').length+' 道前置工序满足后，当前工序才可开始施工。</p>':'')+'</section>'+(n.status==='risk'||n.status==='attention'?'<section class="detail-section"><h3>示例'+(n.status==='risk'?'异常':'关注')+'说明</h3><div class="risk-note">'+(n.status==='risk'?'结构支线工序 B 存在示例验收异常。该支线从 ST-01 分出、汇入 ST-04，与 ST-02、ST-03 并行推进。':'示例工序推进较慢，建议关注施工和验收衔接。此提示仅用于体验异常定位。')+'</div></section>':'')+'<p class="detail-note">交互 Demo · 数量、趋势、状态及具体工艺连线为示例。验收通过箱数不大于报验箱数；两种数量均按箱体去重。</p>';
 drawTrend(n);
 if(!$('#drawer').open){lastFocus=document.activeElement;$('#drawer').showModal();}
 if(!preserve)$('#closeDrawer').focus({preventScroll:true});
}
function drawTrend(n){
 const labels=state.period==='day'?['10-14','10-15','10-16','10-17','10-18','10-19']:state.period==='week'?['W38','W39','W40','W41','W42','W43']:['05月','06月','07月','08月','09月','10月'];
 const value=quantity(n),added=increment(n);
 const factors=state.period==='day'?[.77,.82,.88,.93,(value-added)/Math.max(1,value),1]:state.period==='week'?[.25,.4,.52,.7,.88,1]:[.08,.22,.43,.63,.8,1];
 const values=factors.map(f=>Math.round(value*f)),max=Math.max(1,value);
 $('#trendContent').innerHTML='<div class="trend" role="img" aria-label="'+metricLabel()+'：'+labels.map((l,i)=>l+'累计'+values[i]+'箱').join('，')+'">'+values.map(v=>'<div class="trend-col"><b>'+v+'</b><i style="height:'+Math.max(1,v/max*112)+'px"></i></div>').join('')+'</div><div class="trend-labels">'+labels.map(l=>'<span>'+l+'</span>').join('')+'</div>';
 $$('.chart-tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.period===state.period);b.setAttribute('aria-pressed',String(b.dataset.period===state.period));});
}
function closeDrawer(){$('#drawer').close();}
$('#drawer').addEventListener('close',()=>{if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});else $('[data-node="'+state.selected+'"]')?.focus({preventScroll:true});});
$('#closeDrawer').addEventListener('click',closeDrawer);
$('#drawer').addEventListener('click',e=>{if(e.target===$('#drawer')&&e.clientX<$('#drawer').getBoundingClientRect().left)closeDrawer();const rel=e.target.closest('[data-relation]');if(rel){locate(rel.dataset.relation);openDrawer(rel.dataset.relation);}const period=e.target.closest('[data-period]');if(period){state.period=period.dataset.period;drawTrend(get(state.selected));}});
document.addEventListener('click',e=>{
 const metric=e.target.closest('[data-metric]');if(metric){
  state.metric=metric.dataset.metric;render(true);
  if($('#drawer').open){const y=$('#drawer').scrollTop;openDrawer(state.selected,true);$('#drawer').scrollTop=y;$('#drawer [data-metric="'+state.metric+'"]').focus({preventScroll:true});}
  else $('.tools [data-metric="'+state.metric+'"]').focus({preventScroll:true});
  return;
 }

 const tab=e.target.closest('[data-view]');if(tab){state.view=tab.dataset.view;state.selected=null;state.zoom=1;state.stage='all';state.query='';$('#search').value='';message('');const url=new URL(location.href);url.searchParams.set('view',state.view);history.replaceState(null,'',url);render();return;}
 const phase=e.target.closest('[data-phase]');if(phase){state.stage=phase.dataset.phase;state.selected=null;state.zoom=1;render();return;}
 const dir=e.target.closest('[data-directory-node]');if(dir){locate(dir.dataset.directoryNode,true);return;}
 const node=e.target.closest('[data-node]');if(node){openDrawer(node.dataset.node);return;}
 const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
 if(action==='branches'){state.branches=!state.branches;if(!state.branches&&get(state.selected)?.branch)state.selected=null;render(true);}
 if(action==='issue'){const issues=nodes.filter(n=>n.status==='risk'||n.status==='attention').sort((a,b)=>(a.status==='risk'?0:1)-(b.status==='risk'?0:1)),next=issues[(issues.findIndex(n=>n.id===state.selected)+1)%issues.length];locate(next.id);message('已定位 '+next.id+' '+next.name+'；再次点击可切换到下一道需关注工序。');}
 if(action==='zoom-in'||action==='zoom-out'){
  const vp=$('.viewport'),old=state.zoom,center=vp?(vp.scrollLeft+vp.clientWidth/2)/old:0;
  state.zoom=Math.min(1.4,Math.max(.55,Math.round((old+(action==='zoom-in'?.15:-.15))*100)/100));render(true);
  if($('.viewport'))$('.viewport').scrollLeft=center*state.zoom-$('.viewport').clientWidth/2;
 }
 if(action==='reset'){state.zoom=1;state.selected=null;state.query='';$('#search').value='';message('');render();}
});
$('#search').addEventListener('input',search);
$('#search').addEventListener('keydown',e=>{if(e.key==='Enter'){const hits=nodes.filter(matching);if(hits.length){locate(hits[0].id);message('已定位 '+hits[0].id+' '+hits[0].name+'，点击节点查看详情。');}}});
$('#dataset').addEventListener('change',e=>{state.size=Number(e.target.value);state.selected=null;state.zoom=1;state.stage='all';state.query='';$('#search').value='';message('');makeData();render();});
$('#stMode').addEventListener('change',e=>{state.stMode=e.target.value;makeData();render(true);if($('#drawer').open)openDrawer(state.selected,true);});
addEventListener('resize',updateMinimap);
makeData();render();
})();