(() => {
  'use strict';
  const data=window.ROCKDALE_ROUTE,$=s=>document.querySelector(s);
  if(!data)return;
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const empty=message=>'<div class="rd-empty-state">'+message+'</div>';
  function render(){
    const final=data.nodes.find(n=>n.id===data.mainSequence.at(-1));
    const items=[['当前项目','RD-Rockdale项目',''],['统计范围','项目全周期',''],['箱体总量',data.totalBoxes,'箱'],['累计完成箱体数量',final.accepted,'箱'],['全流程一次通过率','—',''],['资料完成率','—',''],['验收完成率','—','']];
    $('#summaryRow').innerHTML=items.map(([label,value,unit])=>'<article class="summary-item"><span>'+label+'</span><strong>'+value+'<small>'+unit+'</small></strong></article>').join('');
    $('#syncStatus').textContent='● 数据已同步';
    $('#distribution').innerHTML=empty('当前项目暂无箱体分布数据');
    $('#distributionTimestamp').textContent='';$('#manufacturingTimestamp').textContent='';
    $('#manufacturingProgress').innerHTML=['ST','AR'].map((phase,index)=>'<section class="manufacturing-group"><div class="manufacturing-group-title"><span>0'+(index+1)+'</span><h4>'+(phase==='ST'?'结构制造':'装修施工')+'</h4></div><div class="manufacturing-route">'+data.nodes.filter(n=>n.phase===phase).map(n=>{
      const added=n.records.filter(r=>r.acceptedAt?.slice(0,10).replaceAll('/','-')===data.progressSource.snapshotDate).length;
      return '<button class="manufacturing-card" data-rd-process="'+n.id+'"><span class="process-code">'+n.id+'</span><h5>'+esc(n.name)+'</h5><strong>'+(n.accepted/data.totalBoxes*100).toFixed(1)+'%</strong><p>验收通过 <b>'+n.accepted+' 箱</b></p><em>当日新增 +'+added+' 箱</em></button>';
    }).join('')+'</div></section>').join('');
    $('#manufacturingProgress').querySelectorAll('[data-rd-process]').forEach(button=>button.onclick=()=>window.QMS_ROUTE_HOST?.open(button.dataset.rdProcess));
    if(!$('.rd-quality-empty')){const div=document.createElement('div');div.className='rd-quality-empty';div.innerHTML=empty('当前项目暂无质检指标数据');$('#qualityTabs').insertAdjacentElement('afterend',div);}
  }
  window.QMS_RD_DASHBOARD={render};
})();
