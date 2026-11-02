/* Shared by the dashboard drawer and the standalone route. Dates remain workbook-local. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DAY = 86400000;
  const dateMs = date => Date.parse(date + 'T00:00:00Z');
  const dateText = ms => new Date(ms).toISOString().slice(0,10);
  const localDate = value => value.slice(0,10).replaceAll('/','-');
  function bucketStart(date, period) {
    if (period === 'month') return date.slice(0,7) + '-01';
    if (period === 'week') {
      const ms = dateMs(date), day = new Date(ms).getUTCDay();
      return dateText(ms - ((day + 6) % 7) * DAY);
    }
    return date;
  }
  function nextBucket(date, period) {
    if (period === 'month') { const d = new Date(dateMs(date)); d.setUTCMonth(d.getUTCMonth()+1); return dateText(+d); }
    return dateText(dateMs(date) + (period === 'week' ? 7 : 1) * DAY);
  }
  function series(node, period, data = window.ROCKDALE_ROUTE) {
    const source = data.progressSource, end = source.snapshotDate;
    let first = bucketStart(source.firstRecordDate, period);
    const last = bucketStart(end, period), buckets = new Map();
    for (let d = first; d <= last; d = nextBucket(d, period)) buckets.set(d, {date:d,reportedAdded:0,acceptedAdded:0});
    for (const record of node.records || []) {
      for (const [key, field] of [['reportedAt','reportedAdded'],['acceptedAt','acceptedAdded']]) {
        if (!record[key]) continue;
        const day = localDate(record[key]);
        if (day > end) continue;
        const bucket = buckets.get(bucketStart(day,period));
        if (bucket) bucket[field]++;
      }
    }
    let reported = 0, accepted = 0;
    const points = [...buckets.values()].map(p => {
      reported += p.reportedAdded; accepted += p.acceptedAdded;
      const finish = dateText(Math.min(dateMs(nextBucket(p.date,period))-DAY,dateMs(end)));
      return {...p,reported,accepted,end:finish,label:period==='month'?p.date.slice(5,7)+'月':p.date.slice(5),range:p.date===finish?p.date:p.date+' — '+finish};
    });
    return period==='day'?points.slice(-14):period==='week'?points.slice(-12):period==='month'?points.slice(-12):points;
  }
  function html(node, data = window.ROCKDALE_ROUTE) {
    const pct = value => (value / data.totalBoxes * 100).toFixed(1) + '%';
    const stats = [
      ['箱体总量',data.totalBoxes,'箱',''],['报验箱数',node.reported,'箱','reported'],['验收通过箱数',node.accepted,'箱','accepted'],
      ['报验占比',pct(node.reported),'','reported'],['验收通过占比',pct(node.accepted),'','accepted'],['已报验未通过',node.reported-node.accepted,'箱','pending'],
    ];
    return '<section class="route-detail" data-detail-node="'+esc(node.id)+'"><h3 class="route-section-title">总体明细</h3><div class="route-overall production-summary">'+stats.map(([label,value,unit,kind])=>'<div class="'+kind+'"><span>'+label+'</span><strong>'+value+'<small>'+unit+'</small></strong></div>').join('')+'</div><div class="route-trend-head production-chart-head"><h3>数量趋势</h3><label class="route-period-label"><span class="route-sr-only">数量趋势统计周期</span><select data-route-period aria-label="数量趋势统计周期"><option value="day">日</option><option value="week" selected>周</option><option value="month">月</option><option value="all">项目全周期</option></select></label></div><div class="route-period-summary" aria-live="polite"></div><div class="route-chart-legend"><span><i class="bar reported"></i>新增报验</span><span><i class="bar accepted"></i>新增通过</span><span><i class="line reported"></i>累计报验</span><span><i class="line accepted"></i>累计通过</span></div><div class="route-combo-chart" tabindex="0" role="group" aria-label="报验与验收通过组合图，可用左右方向键查看各期数据"><div class="route-chart-tooltip" hidden></div></div></section>';
  }
  function displaySeries(node,period,data=window.ROCKDALE_ROUTE){
    const points=series(node,period,data);
    if(period!=='all')return points.slice(-6);
    const size=Math.ceil(points.length/6),result=[];
    for(let i=0;i<points.length;i+=size){
      const bucket=points.slice(i,i+size),first=bucket[0],last=bucket.at(-1);
      result.push({...last,date:first.date,label:last.end.slice(5),range:first.date===last.end?first.date:first.date+' — '+last.end,
        reportedAdded:bucket.reduce((sum,p)=>sum+p.reportedAdded,0),acceptedAdded:bucket.reduce((sum,p)=>sum+p.acceptedAdded,0)});
    }
    return result;
  }
  const scaleMax = value => 4*Math.max(1,value<=20?Math.ceil(value/4):Math.ceil(value/20)*5);
  // Monotone cubic interpolation passes through the real cumulative values without overshoot.
  function curve(points){
    const slopes=points.slice(1).map((p,i)=>(p.y-points[i].y)/(p.x-points[i].x));
    const tangents=points.map((_,i)=>i===0?slopes[0]||0:i===points.length-1?slopes.at(-1)||0:slopes[i-1]*slopes[i]<=0?0:2*slopes[i-1]*slopes[i]/(slopes[i-1]+slopes[i]));
    return points.map((p,i)=>{if(!i)return 'M'+p.x+' '+p.y;const a=points[i-1],dx=(p.x-a.x)/3;return 'C'+(a.x+dx)+' '+(a.y+tangents[i-1]*dx)+' '+(p.x-dx)+' '+(p.y-tangents[i]*dx)+' '+p.x+' '+p.y;}).join(' ');
  }
  function renderChart(root, node, period, data) {
    const points = displaySeries(node,period,data), host = root.querySelector('.route-combo-chart');
    const W=Math.max(320,Math.min(600,Math.round(host.clientWidth||innerWidth*.96-52))),H=350,L=42,R=W-48,T=28,B=288,width=R-L,step=width/Math.max(1,points.length);
    const maxAdded=scaleMax(Math.max(0,...points.map(p=>Math.max(p.reportedAdded,p.acceptedAdded)))), maxTotal=scaleMax(Math.max(node.reported,node.accepted));
    const x=i=>L+step*(i+.5), yAdd=v=>B-v/maxAdded*(B-T), yTotal=v=>B-v/maxTotal*(B-T), barWidth=Math.min(14,step*.32);
    let svg='<svg viewBox="0 0 '+W+' '+H+'" class="route-combo-svg" role="img" aria-label="'+esc(node.id+' '+(period==='all'?'项目全周期':period==='day'?'每日':period==='week'?'每周':'每月')+'新增与累计报验、验收通过箱数')+'"><text x="'+L+'" y="14" class="route-chart-unit">新增（箱）</text><text x="'+R+'" y="14" text-anchor="end" class="route-chart-unit">累计（箱）</text>';
    for(let i=0;i<=4;i++){const y=B-i/4*(B-T);svg+='<path d="M'+L+' '+y+'H'+R+'" class="route-chart-grid"/><text x="'+(L-9)+'" y="'+(y+4)+'" text-anchor="end">'+maxAdded*i/4+'</text><text x="'+(R+9)+'" y="'+(y+4)+'">'+maxTotal*i/4+'</text>';}
    const reportedCurve=curve(points.map((p,i)=>({x:x(i),y:yTotal(p.reported)})));
    svg+='<path class="route-chart-area" d="'+reportedCurve+' L'+x(points.length-1)+' '+B+' L'+x(0)+' '+B+' Z"/>';
    svg+=points.map((p,i)=>'<rect class="route-bar reported" data-value="'+p.reportedAdded+'" x="'+(x(i)-barWidth-1)+'" y="'+yAdd(p.reportedAdded)+'" width="'+barWidth+'" height="'+(B-yAdd(p.reportedAdded))+'"/><rect class="route-bar accepted" data-value="'+p.acceptedAdded+'" x="'+(x(i)+1)+'" y="'+yAdd(p.acceptedAdded)+'" width="'+barWidth+'" height="'+(B-yAdd(p.acceptedAdded))+'"/>').join('');
    for(const key of ['reported','accepted']){
      svg+='<path class="route-cumulative '+key+'" d="'+curve(points.map((p,i)=>({x:x(i),y:yTotal(p[key])})))+'"/>';
      svg+=points.map((p,i)=>'<circle class="route-chart-point '+key+'" data-value="'+p[key]+'" cx="'+x(i)+'" cy="'+yTotal(p[key])+'" r="3"/>').join('');
    }
    svg+=points.map((p,i)=>'<text class="route-x-label" x="'+x(i)+'" y="316" text-anchor="middle">'+esc(p.label)+'</text><rect class="route-chart-hit" data-chart-index="'+i+'" x="'+(L+i*step)+'" y="'+T+'" width="'+step+'" height="'+(B-T)+'"/>').join('');
    svg+='<line class="route-chart-cursor" x1="'+L+'" x2="'+L+'" y1="'+T+'" y2="'+B+'" visibility="hidden"/></svg>';
    host.querySelector('svg')?.remove();host.insertAdjacentHTML('afterbegin',svg);
    host.dataset.period=period;host.dataset.points=String(points.length);
    const addedR=points.reduce((sum,p)=>sum+p.reportedAdded,0),addedA=points.reduce((sum,p)=>sum+p.acceptedAdded,0);
    root.querySelector('.route-period-summary').innerHTML='<span>'+esc(points[0]?.date)+' — '+esc(points.at(-1)?.end)+'</span><span>区间新增 <b class="reported">报验 +'+addedR+'</b><b class="accepted">通过 +'+addedA+'</b></span>';
    const tip=host.querySelector('.route-chart-tooltip'),cursor=host.querySelector('.route-chart-cursor');let index=points.length-1;
    tip.hidden=true;delete tip.dataset.index;
    function show(i,anchor){
      index=Math.max(0,Math.min(points.length-1,i));const p=points[index];if(!p)return;
      if(tip.dataset.index!==String(index)){
        tip.innerHTML='<strong>'+esc(p.range)+'</strong><span class="reported">新增报验 <b>'+p.reportedAdded+' 箱</b></span><span class="accepted">新增通过 <b>'+p.acceptedAdded+' 箱</b></span><span class="reported">累计报验 <b>'+p.reported+' 箱</b></span><span class="accepted">累计通过 <b>'+p.accepted+' 箱</b></span>';
        tip.dataset.index=String(index);
      }
      tip.hidden=false;
      const box=host.getBoundingClientRect(),plot=host.querySelector('svg').getBoundingClientRect();
      const target=anchor||{x:plot.left-box.left+x(index)/W*plot.width,y:plot.top-box.top+yTotal(Math.max(p.reported,p.accepted))/H*plot.height};
      const gap=14,padding=6,w=tip.offsetWidth,h=tip.offsetHeight;
      let left=target.x+gap,top=target.y+gap;
      if(left+w>box.width-padding)left=target.x-w-gap;
      if(top+h>box.height-padding)top=target.y-h-gap;
      tip.style.left=Math.max(padding,Math.min(left,box.width-w-padding))+'px';
      tip.style.top=Math.max(padding,Math.min(top,box.height-h-padding))+'px';tip.style.right='auto';
      cursor.setAttribute('x1',x(index));cursor.setAttribute('x2',x(index));cursor.setAttribute('visibility','visible');
    }
    function hide(){tip.hidden=true;cursor.setAttribute('visibility','hidden');}
    function move(e){
      const plot=host.querySelector('svg').getBoundingClientRect(),box=host.getBoundingClientRect();
      const px=(e.clientX-plot.left)/plot.width*W,py=(e.clientY-plot.top)/plot.height*H;
      if(px<L||px>R||py<T||py>B+36){hide();return;}
      show(Math.floor((px-L)/step),{x:e.clientX-box.left,y:e.clientY-box.top});
    }
    host.onpointermove=move;host.onpointerdown=move;host.onpointerleave=hide;host.onblur=hide;
    host.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?0:e.key==='End'?points.length-1:index+(e.key==='ArrowRight'?1:-1));}else if(e.key==='Escape')hide();};
  }
  function mount(container,node,data=window.ROCKDALE_ROUTE){
    container.innerHTML=html(node,data);const root=container.querySelector('.route-detail'),select=root.querySelector('[data-route-period]');
    const render=()=>renderChart(root,node,select.value,data);select.onchange=render;render();
  }
  window.QMS_ROUTE_DETAIL={series,displaySeries,html,mount};
  let resizeTimer;
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
    for(const root of document.querySelectorAll('.route-detail')){const node=window.ROCKDALE_ROUTE.nodes.find(n=>n.id===root.dataset.detailNode);if(node)renderChart(root,node,root.querySelector('[data-route-period]').value,window.ROCKDALE_ROUTE);}
  },100);});
})();
