(() => {
  const d = window.QMS_V2;
  const state = { project:'mos', range:'30', processFilter:'all', period:'all', overallMetric:'fpy', workshopMetric:'count', drawerChart:null };
  const initialProject=new URLSearchParams(location.search).get('project');
  if(d.projects.some(p=>p.id===initialProject))state.project=initialProject;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const metric = k => d.metrics[k];
  const project = () => d.projects.find(x => x.id === state.project) || d.projects[0];
  const distributionData = () => d.projectDistributions?.[state.project] || { boxFlow:d.boxFlow, boxRecords:d.boxRecords };
  const qualityData = () => d.projectQuality?.[state.project] || null;
  const processData = () => qualityData()?.process || d.process;
  const isNumber = value => typeof value === 'number' && Number.isFinite(value);
  const formatPct = value => Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(1);
  const fmt = (v,k) => isNumber(v) ? `${Number(v).toFixed(1)}${metric(k)?.unit || ''}` : '--';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const metricKeys = Object.keys(d.metrics);
  const trend = (k, offset=0) => { const m=metric(k); const base=m.base+offset; return [0.91,0.94,0.97,0.95,0.99,1].map((x,i)=>Number((base*x+(i%2?.25:-.15)).toFixed(1))); };
  const offset = () => project().id === 'p05' ? -8 : project().id === 'model' ? 4 : 0;

  function init(){
    $('#projectSelect').innerHTML=d.projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); $('#projectSelect').value=state.project;
    $('#projectSelect').onchange=e=>{state.project=e.target.value;renderAll()}; $('#viewTabs').onclick=e=>{const b=e.target.closest('button'); if(!b)return; activateView(b.dataset.view)}; $('#rangeSelect').onchange=e=>{state.range=e.target.value;renderAll()};
    $('#processFilter').onchange=e=>{state.processFilter=e.target.value;renderProcess()}; $('#processPeriod').onchange=e=>{state.period=e.target.value;renderProcess();renderOverallChart()};
    $('#overallMetricSelect').onchange=e=>{state.overallMetric=e.target.value;renderOverallChart()}; $('#workshopMetricSelect').onchange=e=>{state.workshopMetric=e.target.value;renderWorkshops()};
    $('#refreshBtn').onclick=()=>{ $('#syncStatus').textContent='● 正在刷新'; setTimeout(()=>{ $('#syncStatus').textContent='● 数据已同步'; renderAll(); },500); };
    $('#closeDrawer').onclick=closeDrawer; $('#backdrop').onclick=closeDrawer; renderAll(); window.onresize=()=>Object.values(window.QMS_CHARTS||{}).forEach(c=>c.resize());
  }
  function renderAll(){
    document.body.dataset.project=state.project;
    $('#rangeSelect').disabled=state.project==='rd';
    if(state.project==='rd'){state.range='all';$('#rangeSelect').value='all';window.QMS_RD_DASHBOARD.render();activateView(document.querySelector('#viewTabs .active')?.dataset.view||'production');return;}
    renderHeader(); renderKpis(); renderProcess(); renderDistribution(); renderOverallMetrics(); renderOverallChart(); renderWorkshops(); activateView(document.querySelector('#viewTabs .active')?.dataset.view||'production');
  }
  function activateView(view){
    $$('#viewTabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $$('.view-pane').forEach(p=>p.classList.toggle('active',p.dataset.view===view));
    if(view==='process') requestAnimationFrame(renderOverallChart);
  }
  function renderHeader(){ const p=project(); if($('#heroProject'))$('#heroProject').textContent=p.name; if($('#heroRange'))$('#heroRange').textContent=d.ranges[state.range]; if($('#heroUnits'))$('#heroUnits').textContent=`${p.units} 箱`; $('#syncStatus').textContent=p.status==='delayed'?'● 数据有延迟':'● 数据已同步'; }
  function score(){ const o=offset(); const f=d.metrics.fpy.base+o, docs=d.metrics.reportDocs.base+o*.4, rw=d.metrics.rework.base-o*.2; return (f*.5+docs*.2+(100-rw)*.3).toFixed(1); }
  function renderKpis(){
    const o=offset();
    const p=project();
    const q=qualityData();
    let completed=Math.round(p.units*.76);
    let fpyValue=d.metrics.fpy.base+o;
    let docsValue=d.metrics.reportDocs.base+o*.4;
    let acceptValue=91+o*.2;
    if(q){
      completed=distributionData().boxFlow.find(x=>x.code==='MFG_DONE')?.count ?? 0;
      fpyValue=q.overall.metrics.fpy;
      docsValue=q.overall.metrics.reportDocs;
      acceptValue=q.overall.accept;
    }
    const items=[
      ['当前项目',p.name,'','teal'],
      ['统计范围',d.ranges[state.range],'','blue'],
      ['箱体总量',p.units,'箱','teal'],
      ['累计完成箱体数量',completed,'箱','teal'],
      ['全流程一次通过率',fmt(fpyValue,'fpy'),'','blue'],
      ['资料完成率',fmt(docsValue,'reportDocs'),'','amber'],
      ['验收完成率',fmt(acceptValue,'fpy'),'','green']
    ];
    $('#summaryRow').innerHTML=items.map(x=>`<article class="summary-item ${x[3]}"><span>${x[0]}</span><strong>${x[1]}<small>${x[2]}</small></strong></article>`).join('');
  }
  const formulaMap={"self": "首次自检通过工序数量 ÷ 首次自检验收工序数量", "special": "首次专检通过工序数量 ÷ 首次专检验收工序数量", "three": "首次三检通过工序数量 ÷ 首次三检验收工序数量", "fpy": "全流程一次通过工序数 ÷ 进入验收工序总数", "rework": "发生整改工序数 ÷ 验收工序总数", "fix": "整改总次数 ÷ 发生整改工序数", "acceptHours": "Σ（最终通过时间－首次报验时间） ÷ 最终通过工序数", "fixHours": "整改总耗时 ÷ 整改次数", "buildHours": "Σ（上道工序验收时间－下道工序报验时间） ÷ 工序数", "reportDocs": "资料完整的报验工序数 ÷ 报验总工序数", "selfDocs": "资料完整的自检工序数 ÷ 自检总工序数", "specialDocs": "资料完整的专检工序数 ÷ 专检总工序数"};
  function formulaFor(key,item=null){
    const q=qualityData();
    if(q && (!item || item.metrics) && q.formulas?.[key]) return q.formulas[key];
    return formulaMap[key] || '暂无公式';
  }
  function sampleTitle(item,key){
    const sample=item?.metricSamples?.[key];
    if(!sample || !sample.sample) return '暂无可计算样本';
    const numerator=sample.numerator===null?'--':sample.numerator;
    const denominator=sample.denominator===null?'--':sample.denominator;
    return `分子：${numerator}；分母：${denominator}；样本量：${sample.sample}`;
  }
  function lightLevel(item){
    if((isNumber(item.fpy)&&item.fpy<60)||(isNumber(item.accept)&&item.accept<75)||(isNumber(item.rework)&&item.rework>30)) return 'red';
    if((isNumber(item.fpy)&&item.fpy<80)||(isNumber(item.docs)&&item.docs<90)||(isNumber(item.accept)&&item.accept<85)) return 'amber';
    return 'green';
  }
  function lightReason(item){
    const level=lightLevel(item);
    const reasons=[];
    if(isNumber(item.fpy)&&item.fpy<60) reasons.push(`FPY低于60%，当前${item.fpy}%`);
    else if(isNumber(item.fpy)&&item.fpy<80) reasons.push(`FPY低于80%关注线，当前${item.fpy}%`);
    if(isNumber(item.rework)&&item.rework>30) reasons.push(`返工率超过30%，当前${item.rework}%`);
    if(isNumber(item.docs)&&item.docs<90) reasons.push(`资料完整率低于90%，当前${item.docs}%`);
    if(isNumber(item.accept)&&item.accept<75) reasons.push(`验收完成率低于75%，当前${item.accept}%`);
    else if(isNumber(item.accept)&&item.accept<85) reasons.push(`验收完成率低于85%关注线，当前${item.accept}%`);
    if(reasons.length) return reasons.join('；');
    if(!isNumber(item.docs)) return '当前可用指标未触发亮灯；资料完整率暂无数据，不参与亮灯';
    return level==='green'?'当前指标均未触发亮灯规则':'当前指标需要关注';
  }
  function renderProcess(){
    const rows=processData().filter(x=>state.processFilter==='itp'?x.itp:true);
    const heads=['亮灯','工序编码','工序名称','ITP','累计完成箱体数量','FPY','资料完成率','验收完成率'];
    const body=['结构制造','装修施工'].map(group=>{
      const groupRows=rows.filter(x=>x.stage===group);
      if(!groupRows.length) return '';
      return `<tr class="group-row"><th colspan="8">${group}</th></tr>`+groupRows.map(x=>{
        const level=lightLevel(x);
        const docsText=isNumber(x.docs)?`${x.docs}%`:'--';
        const docsTitle=isNumber(x.docs)?sampleTitle(x,'reportDocs'):'源数据未包含资料及附件完整性字段，不参与亮灯';
        return `<tr class="quality-row ${level}" data-process-row="${esc(x.code)}"><td><span class="status-icon ${level}" title="${esc(lightReason(x))}" aria-label="${esc(lightReason(x))}">${level==='green'?'✓':'!'}</span></td><td>${esc(x.code)}</td><td title="${esc(x.name)}"><b>${esc(x.name)}</b></td><td><span class="itp-tag ${x.itp?'yes':''}">${x.itp?'ITP':'—'}</span></td><td title="已到达该工序${x.reached??x.sample}箱">${x.count}箱</td><td class="${isNumber(x.fpy)&&x.fpy<60?'danger-text':''}" title="${esc(sampleTitle(x,'fpy'))}">${fmt(x.fpy,'fpy')}</td><td class="${isNumber(x.docs)&&x.docs<90?'warning-text':'missing-text'}" title="${esc(docsTitle)}">${docsText}</td><td title="累计完成${x.count}箱 ÷ 已到达${x.reached??'--'}箱">${fmt(x.accept,'fpy')}</td></tr>`;
      }).join('');
    }).join('');
    $('#processTable').innerHTML=`<thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody>`;
    $$('#processTable [data-process-row]').forEach(r=>r.onclick=()=>openProcess(r.dataset.processRow));
  }
  function renderOverallMetrics(){
    const o=offset();
    const q=qualityData();
    const keys=['self','special','three','fpy','rework','fix','reportDocs','selfDocs','specialDocs'];
    const valueFor=key=>q?q.overall.metrics[key]:metric(key).base+o*.2;
    if(q&&!isNumber(valueFor(state.overallMetric))) state.overallMetric='fpy';
    $('#overallMetrics').innerHTML=keys.map(k=>{
      const value=valueFor(k);
      const title=q?sampleTitle(q.overall,k):'';
      return `<div class="metric" title="${esc(title)}"><span>${metric(k).name}</span><b class="${isNumber(value)?'':'missing'}">${fmt(value,k)}</b></div>`;
    }).join('');
    $('#overallMetricSelect').innerHTML=metricKeys.map(k=>{
      const unavailable=q&&!isNumber(valueFor(k));
      return `<option value="${k}" ${unavailable?'disabled':''}>${metric(k).name}${unavailable?'（暂无数据）':''}</option>`;
    }).join('');
    $('#overallMetricSelect').value=state.overallMetric;
  }
  function seriesFor(key,item=null){
    const q=qualityData();
    if(q&&(!item||item.metrics)){
      const period=state.period==='all'?'day':state.period;
      return (item?.trends||q.overall.trends)?.[period]?.[key]||[];
    }
    const values=trend(key,item?((item.fpy||86.4)-86.4)*.2:offset());
    return values.map((value,index)=>({date:['07-13','07-14','07-15','07-16','07-17','07-18'][index],value,numerator:null,denominator:null,sample:null}));
  }
  function drawSvgChart(el,key,title,off=0,item=null){
    const series=seriesFor(key,item);
    if(!series.length){
      el.innerHTML='<div class="no-chart">当前指标暂无可展示趋势数据</div>';
      return {resize(){},dispose(){el.innerHTML=''}};
    }
    const values=series.map(point=>point.value);
    const threshold=metric(key).threshold;
    const all=[...values,threshold];
    const min=Math.min(...all), max=Math.max(...all);
    const spread=Math.max(max-min,1);
    const low=min-spread*.18, high=max+spread*.18;
    const step=series.length>1?420/(series.length-1):0;
    const points=series.map((point,index)=>({x:58+index*step,y:190-(point.value-low)/(high-low)*142,...point}));
    const thresholdY=190-(threshold-low)/(high-low)*142;
    const line=points.map(point=>`${point.x},${point.y}`).join(' ');
    const lastX=points[points.length-1].x;
    const area=`58,190 ${line} ${lastX},190`;
    const labelEvery=Math.max(1,Math.ceil(points.length/7));
    el.innerHTML=`<div class="svg-chart" role="img" aria-label="${esc(title)}趋势图">
      <svg viewBox="0 0 520 230" preserveAspectRatio="none">
        <defs><linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55d6d0" stop-opacity=".28"/><stop offset="1" stop-color="#55d6d0" stop-opacity=".02"/></linearGradient></defs>
        ${[48,95,142,190].map(y=>`<line x1="50" y1="${y}" x2="490" y2="${y}" class="chart-grid"/>`).join('')}
        <line x1="50" y1="${thresholdY}" x2="490" y2="${thresholdY}" class="chart-threshold"/>
        <text x="486" y="${Math.max(thresholdY-6,12)}" text-anchor="end" class="chart-threshold-label">预警 ${threshold}${metric(key).unit}</text>
        <polygon points="${area}" fill="url(#trendArea)"/>
        <polyline points="${line}" class="chart-line"/>
        ${points.map((point,index)=>`<g><title>${esc(`${point.date}；${title}：${point.value}${metric(key).unit}；样本量：${point.sample??'--'}`)}</title><circle cx="${point.x}" cy="${point.y}" r="4" class="chart-point"/>${index%labelEvery===0||index===points.length-1?`<text x="${point.x}" y="${point.y-10}" text-anchor="middle" class="chart-value">${point.value}</text><text x="${point.x}" y="214" text-anchor="middle" class="chart-date">${esc(point.date.slice(5)||point.date)}</text>`:''}</g>`).join('')}
      </svg>
    </div>`;
    return {resize(){},dispose(){el.innerHTML=''}};
  }
  function drawChart(el,key,title,off=0,item=null){
    if(!el) return null;
    const points=seriesFor(key,item);
    if(!points.length) return drawSvgChart(el,key,title,off,item);
    if(!window.echarts) return drawSvgChart(el,key,title,off,item);
    try{
      const old=window.echarts.getInstanceByDom(el);
      if(old) old.dispose();
      const chart=window.echarts.init(el);
      const threshold=metric(key).threshold;
      chart.setOption({
        grid:{left:42,right:18,top:30,bottom:35},
        tooltip:{trigger:'axis',formatter:params=>{
          const point=points[params[0].dataIndex];
          return `${point.date}<br>${title}：${point.value}${metric(key).unit}<br>分子：${point.numerator??'--'}<br>分母：${point.denominator??'--'}<br>样本量：${point.sample??'--'}`;
        }},
        xAxis:{type:'category',data:points.map(point=>point.date),axisLabel:{color:'#8ba5ad',hideOverlap:true}},
        yAxis:{type:'value',axisLabel:{color:'#8ba5ad'},splitLine:{lineStyle:{color:'#19343b'}}},
        series:[{name:title,type:'line',smooth:true,data:points.map(point=>point.value),lineStyle:{color:'#55d6d0',width:3},areaStyle:{color:'rgba(85,214,208,.1)'},markLine:{silent:true,data:[{yAxis:threshold,name:'预警阈值'}],label:{color:'#ff9b9b'},lineStyle:{color:'#ff6d6d',type:'dashed'}}}]
      });
      requestAnimationFrame(()=>chart.resize());
      return chart;
    }catch(error){
      return drawSvgChart(el,key,title,off,item);
    }
  }
  function renderOverallChart(){
    const el=$('#overallChart');
    if(!el) return;
    window.QMS_CHARTS=window.QMS_CHARTS||{};
    if(window.QMS_CHARTS.overall) window.QMS_CHARTS.overall.dispose();
    $('#overallChartTitle').textContent=metric(state.overallMetric).name;
    $('#overallFormula').innerHTML=`<span>计算公式</span><b>${esc(formulaFor(state.overallMetric))}</b>`;
    window.QMS_CHARTS.overall=drawChart(el,state.overallMetric,metric(state.overallMetric).name,offset(),null);
  }
  function renderDistribution(){
    const dist=distributionData();
    const flow=dist.boxFlow;
    const unavailable=x=>x.dataStatus==='unavailable'||x.count===null||x.pct===null;
    const pctText=value=>`${formatPct(value)}%`;
    const card=x=>{const noData=unavailable(x);const light=['MFG_DONE','WAREHOUSE','SIGNED'].includes(x.code)?'pool-light':'';return `<button class="dist-process ${x.alert} ${light} ${noData?'unavailable':''}" ${noData?'disabled aria-disabled="true"':`data-flow="${x.code}"`}><i class="light ${noData?'muted':x.alert}"></i><span>${x.name}</span><strong>${noData?'暂无数据':pctText(x.pct)}</strong><small>${noData?'':`${x.count}箱`}</small></button>`};
    const stageNodes=name=>flow.filter(x=>x.stage===name);
    const stageTotal=name=>stageNodes(name).filter(x=>!unavailable(x)).reduce((s,x)=>s+x.pct,0);
    const stageValue=name=>{const nodes=stageNodes(name);return nodes.length&&nodes.every(unavailable)?'暂无数据':pctText(stageTotal(name))};
    const sub=(stage,name)=>flow.filter(x=>x.stage===stage&&x.substage===name);
    const structure=sub('制造阶段','结构制造');
    const decoration=sub('制造阶段','装修施工');
    const mfgPool=flow.find(x=>x.code==='MFG_DONE');
    const warehouse=flow.filter(x=>x.stage==='仓储阶段');
    const transport=flow.filter(x=>x.stage==='运输阶段');
    const poolCard=x=>{const noData=unavailable(x);return `<button class="fixed-pool pool-light ${x.alert} ${noData?'unavailable':''}" ${noData?'disabled aria-disabled="true"':`data-flow="${x.code}"`}><i class="light ${noData?'muted':x.alert}"></i><span>${x.name}</span><strong>${noData?'暂无数据':pctText(x.pct)}</strong><small>${noData?'':`${x.count}箱`}</small></button>`};
    const manufacturingPct=structure.reduce((s,x)=>s+x.pct,0)+decoration.reduce((s,x)=>s+x.pct,0)+(mfgPool?.pct||0);
    const decorationPct=decoration.reduce((s,x)=>s+x.pct,0)+(mfgPool?.pct||0);
    const allNodesAvailable=flow.every(x=>!unavailable(x));
    const totalLabel=allNodesAvailable?'制造、仓储、运输全部节点合计':'制造阶段箱体分布合计';
    $('#distribution').innerHTML=`<div class="dist-stage"><div class="dist-stage-title"><span class="stage-dot blue"></span><h3>一、制造阶段</h3><b>${pctText(manufacturingPct)}</b></div><div class="dist-substage"><div class="dist-substage-title">结构制造 <span>${pctText(structure.reduce((s,x)=>s+x.pct,0))}</span></div><div class="dist-route">${structure.map(card).join('')}</div></div><div class="dist-substage"><div class="dist-substage-title">装修施工 <span>${pctText(decorationPct)}</span></div><div class="dist-route">${decoration.map(card).join('')}${mfgPool?poolCard(mfgPool):''}</div></div></div><div class="dist-stage compact-stage"><div class="dist-stage-title"><span class="stage-dot green"></span><h3>二、仓储阶段</h3><b>${stageValue('仓储阶段')}</b></div><div class="fixed-pool-row">${warehouse.map(poolCard).join('')}</div></div><div class="dist-stage compact-stage"><div class="dist-stage-title"><span class="stage-dot amber"></span><h3>三、运输阶段</h3><b>${stageValue('运输阶段')}</b></div><div class="fixed-pool-row">${transport.map(poolCard).join('')}</div></div><div class="flow-total">${totalLabel} <strong>${pctText(manufacturingPct)}</strong></div>`;
    $$('#distribution [data-flow]').forEach(b=>b.onclick=()=>openFlow(b.dataset.flow));
  }
  function projectBoxPrefix(){
    if(project().id==='mos') return 'MOS';
    if(project().id==='p05') return 'P05';
    if(project().id==='model') return '1899';
    return project().id.toUpperCase();
  }
  function nodeWorkshopNames(node){
    const group=node.substage==='结构制造'?'结构车间':node.substage==='装修施工'?'装修车间':'';
    return group?d.workshops.filter(w=>w.group===group).map(w=>w.name):[];
  }
  function renderBoxRows(code){
    const dist=distributionData();
    const node=dist.boxFlow.find(x=>x.code===code);
    if(!node||node.dataStatus==='unavailable'||node.count===null) return '<p class="empty">暂无数据。</p>';
    const nodeIndex=dist.boxFlow.findIndex(x=>x.code===code);
    const priorPct=dist.boxFlow.slice(0,nodeIndex).filter(x=>x.pct!==null).reduce((sum,x)=>sum+x.pct,0);
    const startNo=Math.round(project().units*priorPct/100)+1;
    const sourceRows=dist.boxRecords.filter(x=>x.flow===code);
    const workshopNames=nodeWorkshopNames(node);
    const rowCount=project().id==='p05'?node.count:Math.min(3,node.count);
    const rows=Array.from({length:rowCount},(_,i)=>{
      const source=sourceRows[i]||{};
      const useExtracted=project().id==='p05'&&Boolean(source.box);
      return {
        box:useExtracted?source.box:`${projectBoxPrefix()}-${String(startNo+i).padStart(4,'0')}`,
        station:useExtracted?(source.station||'/'):String(i+1).padStart(3,'0'),
        workshop:useExtracted?(source.workshop||'/'):(workshopNames.length?workshopNames[i%workshopNames.length]:(source.workshop||node.name)),
        contractor:useExtracted?(source.contractor||'/'):'/',
        dwell:useExtracted?(source.dwell||'/'):(source.dwell||`${i+1}小时`)
      };
    });
    return `<div class="box-table"><div class="box-table-head"><span>箱体编号</span><span>车间</span><span>工位</span><span>施工单位</span><span>停留时间</span></div>${rows.map(x=>`<div class="box-table-row"><span>${x.box}</span><span>${x.workshop}</span><span>${x.station}</span><span>${x.contractor}</span><span>${x.dwell}</span></div>`).join('')}</div>`;
  }
  function openFlow(code){ const node=distributionData().boxFlow.find(x=>x.code===code); if(!node)return; const value=node.dataStatus==='unavailable'?'暂无数据':`${formatPct(node.pct)}% · ${node.count}箱`; openDrawer(`箱体信息 · ${node.name}`,`<div class="flow-detail-summary"><span>当前节点</span><strong>${node.name}</strong><em>${value}</em></div><h3 class="drawer-section-title">处于该验收阶段的箱体</h3>${renderBoxRows(code)}`); }
  function workshopValue(w,k){ return k==='count'?w.count:k==='fpy'?w.fpy:k==='docs'?w.docs:w.accept; }
  function renderWorkshops(){
    const groups=['结构车间','装修车间'];
    const heads=['亮灯','车间名称','累计完成箱体数量','FPY','资料完成率','验收完成率'];
    const body=groups.map(g=>{
      const rows=d.workshops.filter(w=>w.group===g);
      return `<tr class="group-row"><th colspan="6">${g}</th></tr>`+rows.map(w=>{
        const level=lightLevel(w);
        return `<tr class="quality-row ${level}" data-workshop-row="${w.name}"><td><span class="status-icon ${level}" title="${lightReason(w)}" aria-label="${lightReason(w)}">${level==='green'?'✓':'!'}</span></td><td><b>${w.name}</b></td><td>${w.count}箱</td><td class="${w.fpy<60?'danger-text':''}">${w.fpy}%</td><td class="${w.docs<90?'warning-text':''}">${w.docs}%</td><td>${w.accept}%</td></tr>`;
      }).join('');
    }).join('');
    $('#workshopTable').innerHTML=`<thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody>`;
    $$('#workshopTable [data-workshop-row]').forEach(r=>r.onclick=()=>openWorkshop(r.dataset.workshopRow));
    const sorted=[...d.workshops].sort((a,b)=>workshopValue(b,state.workshopMetric)-workshopValue(a,state.workshopMetric));
    const names={count:'累计完成箱体数量',fpy:'FPY',docs:'资料完成率',accept:'验收完成率'};
    $('#rankingTitle').textContent=`车间${names[state.workshopMetric]}排名`;
    $('#workshopRanking').innerHTML=sorted.map((w,i)=>`<div class="rank-row"><b>${String(i+1).padStart(2,'0')}</b><span>${w.name}</span><strong>${workshopValue(w,state.workshopMetric)}${state.workshopMetric==='count'?'箱':'%'}</strong></div>`).join('');
  }
  function renderLights(){ const items=[...d.process.map(x=>({name:x.name,type:'工序',level:x.alert})),...d.workshops.map(x=>({name:x.name,type:'车间',level:x.alert}))]; const count=l=>items.filter(x=>x.level===l).length; $('#lightSummary').innerHTML=`<div class="light-count red"><i></i><strong>${count('red')}</strong><span>风险亮灯</span></div><div class="light-count amber"><i></i><strong>${count('amber')}</strong><span>关注亮灯</span></div><div class="light-count green"><i></i><strong>${count('green')}</strong><span>正常</span></div><p>红灯：FPY低于60%或返工率超过30%；黄灯：资料完整率低于90%或验收存在超期；绿灯：当前未触发亮灯规则。</p>`; }
  function itemMetricValue(item,key){
    if(item?.metrics&&Object.prototype.hasOwnProperty.call(item.metrics,key)) return item.metrics[key];
    const off=((item?.fpy??86.4)-86.4)*.2;
    return metric(key).base+off;
  }
  function detailMetrics(item){
    const keys=['self','special','three','fpy','rework','fix','acceptHours','fixHours','buildHours','reportDocs','selfDocs','specialDocs'];
    return `<div class="drawer-metrics">${keys.map(k=>{
      const value=itemMetricValue(item,k);
      return `<div title="${esc(item?.metrics?sampleTitle(item,k):'')}"><span>${metric(k).name}</span><b class="${isNumber(value)?'':'missing'}">${fmt(value,k)}</b></div>`;
    }).join('')}</div>`;
  }
  function metricOptions(item,useProjectMetrics=false){
    return metricKeys.map(k=>{
      const unavailable=useProjectMetrics&&!isNumber(item?.metrics?.[k]);
      return `<option value="${k}" ${k==='fpy'?'selected':''} ${unavailable?'disabled':''}>${metric(k).name}${unavailable?'（暂无数据）':''}</option>`;
    }).join('');
  }
  function openProcess(code){
    const item=processData().find(x=>x.code===code);
    if(!item) return;
    if(item.metrics){
      const reasons=item.failureReasons?.length
        ? `<div class="reason-list">${item.failureReasons.map(reason=>`<span>${esc(reason.reason)}<b>${reason.count}次</b></span>`).join('')}</div>`
        : '<p class="empty">当前工序没有不合格原因记录。</p>';
      const exceptions=item.exceptions?.length
        ? item.exceptions.slice(0,30).map(record=>`<div class="unit-row"><span>${esc(record.box)}</span><b title="${esc(record.reason)}">${esc(record.inspectionType)} · ${esc(record.reason)}</b><small>${esc(record.workshop)}</small></div>`).join('')
        : '<p class="empty">当前工序没有不合格验收记录。</p>';
      openDrawer(`工序详情 · ${item.name}`,detailMetrics(item)+`<h3 class="drawer-section-title">指标趋势</h3><select class="drawer-select" data-drawer-metric>${metricOptions(item,true)}</select><div class="formula-box" id="drawerFormula"></div><div id="drawerChart" class="chart drawer-chart"></div><h3 class="drawer-section-title">不合格原因TOP5</h3>${reasons}<h3 class="drawer-section-title">不合格验收记录</h3>${exceptions}`,item);
      return;
    }
    const units=d.units.filter(u=>u.route.includes(item.name.split(' ')[1]||item.name));
    openDrawer(`工序详情 · ${item.name}`,detailMetrics(item)+`<h3 class="drawer-section-title">指标趋势</h3><select class="drawer-select" data-drawer-metric>${metricOptions(item,false)}</select><div class="formula-box" id="drawerFormula"></div><div id="drawerChart" class="chart drawer-chart"></div><h3 class="drawer-section-title">模块箱体</h3>${units.map(u=>`<div class="unit-row"><span>${u.id}</span><b>${u.state}</b><small>${u.owner}</small></div>`).join('')||'<p class="empty">当前工序暂无异常箱体。</p>'}`,item);
  }
  function openWorkshop(name){
    const item=d.workshops.find(x=>x.name===name);
    openDrawer(`车间详情 · ${name}`,detailMetrics(item)+`<h3 class="drawer-section-title">指标趋势</h3><select class="drawer-select" data-drawer-metric>${metricOptions(item,false)}</select><div class="formula-box" id="drawerFormula"></div><div id="drawerChart" class="chart drawer-chart"></div><div class="drawer-note">样本量：${item.sample}条验收记录；当前亮灯：${item.alert==='green'?'正常':item.alert==='red'?'风险':'关注'}</div>`,item);
  }
  function openDrawer(title,body,item){
    $('#drawerTitle').textContent=title;
    $('#drawerBody').innerHTML=body;
    $('#backdrop').classList.add('open');
    $('#drawer').classList.add('open');
    const select=$('[data-drawer-metric]');
    const render=()=>{
      $('#drawerFormula').innerHTML=`<span>计算公式</span><b>${esc(formulaFor(select.value,item))}</b>`;
      if(window.QMS_CHARTS?.drawer)window.QMS_CHARTS.drawer.dispose();
      window.QMS_CHARTS=window.QMS_CHARTS||{};
      window.QMS_CHARTS.drawer=drawChart($('#drawerChart'),select.value,metric(select.value).name,((item?.fpy??86.4)-86.4)*.2,item);
    };
    if(select){select.onchange=render;render();}
  }
  function closeDrawer(){ $('#backdrop').classList.remove('open'); $('#drawer').classList.remove('open'); }
  window.QMS_V2_APP={state:d?state:null,data:d,renderAll,score,workshopValue}; init();
})();
