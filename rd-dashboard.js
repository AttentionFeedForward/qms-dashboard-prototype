(() => {
  'use strict';
  const source=window.ROCKDALE_ROUTE,$=selector=>document.querySelector(selector);
  if(!source)return;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const empty=message=>'<div class="rd-empty-state">'+message+'</div>';
  let metric='accepted';
  const aggregate=()=>window.QMS_ROUTE_CATALOG?.aggregate() || source;
  function renderProgress(){
    const data=aggregate(),label=metric==='reported'?'报验箱数':'验收通过箱数';
    $('#manufacturingTimestamp').textContent='全部工艺路线 · '+(window.QMS_ROUTE_CATALOG?.routes.length || 1)+' 条路线 · '+data.totalBoxes+' 箱';
    $('#manufacturingProgress').innerHTML='<div class="rd-progress-toolbar"><p>汇总全部工艺路线，按箱号去重统计各工序进度</p><div class="rd-progress-switch" role="group" aria-label="工序完成数量切换">'+[['reported','报验箱数'],['accepted','验收通过箱数']].map(([key,text])=>'<button type="button" data-rd-metric="'+key+'" aria-pressed="'+(metric===key)+'">'+text+'</button>').join('')+'</div></div>'+
      ['ST','AR'].map((phase,index)=>'<section class="manufacturing-group"><div class="manufacturing-group-title"><span>0'+(index+1)+'</span><h4>'+(phase==='ST'?'结构制造':'装修施工')+'</h4></div><div class="manufacturing-route">'+data.nodes.filter(node=>node.phase===phase).map(node=>{
        const total=node.totalBound ?? data.totalBoxes,count=node[metric],ratio=total?count/total*100:0,pct=total?ratio.toFixed(1)+'%':'—';
        return '<button class="manufacturing-card" data-rd-process="'+node.id+'" data-metric="'+metric+'" data-total-boxes="'+total+'" data-completed="'+count+'" aria-label="'+esc(node.id+' '+node.name+'，箱体总量 '+total+' 箱，'+label+' '+count+' 箱，完成比例 '+pct)+'"><span class="process-code">'+node.id+'</span><h5 title="'+esc(node.name)+'">'+esc(node.name)+'</h5><div class="rd-card-count"><span>'+label+'</span><strong>'+count+'<small>箱</small></strong></div><dl class="rd-card-stats"><div><dt>箱体总量</dt><dd>'+total+' 箱</dd></div><div><dt>完成比例</dt><dd>'+pct+'</dd></div></dl><span class="rd-card-bar" aria-hidden="true"><i style="width:'+Math.min(100,ratio)+'%"></i></span></button>';
      }).join('')+'</div></section>').join('');
    $('#manufacturingProgress').querySelectorAll('[data-rd-metric]').forEach(button=>button.onclick=()=>{
      metric=button.dataset.rdMetric;renderProgress();
      $('#manufacturingProgress [data-rd-metric="'+metric+'"]').focus({preventScroll:true});
    });
    $('#manufacturingProgress').querySelectorAll('[data-rd-process]').forEach(button=>button.onclick=()=>window.QMS_ROUTE_HOST?.open(button.dataset.rdProcess,{aggregate:true}));
  }
  function render(){
    const data=aggregate(),catalog=window.QMS_ROUTE_CATALOG;
    const final=data.nodes.find(node=>node.id===data.mainSequence.at(-1));
    const items=[['当前项目','RD-Rockdale项目',''],['统计范围','项目全周期',''],['箱体总量',catalog?.projectTotal ?? data.totalBoxes,'箱'],['累计完成箱体数量',catalog?.completedBoxes ?? final.accepted,'箱'],['全流程一次通过率','—',''],['资料完成率','—',''],['验收完成率','—','']];
    $('#summaryRow').innerHTML=items.map(([label,value,unit])=>'<article class="summary-item"><span>'+label+'</span><strong>'+value+'<small>'+unit+'</small></strong></article>').join('');
    $('#syncStatus').textContent='● 数据已同步';
    $('#distribution').innerHTML=empty('当前项目暂无箱体分布数据');
    $('#distributionTimestamp').textContent='';
    renderProgress();
    if(!$('.rd-quality-empty')){const div=document.createElement('div');div.className='rd-quality-empty';div.innerHTML=empty('当前项目暂无质检指标数据');$('#qualityTabs').insertAdjacentElement('afterend',div);}
  }
  window.QMS_RD_DASHBOARD={render};
})();
