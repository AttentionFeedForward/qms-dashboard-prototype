(() => {
  'use strict';
  const $=s=>document.querySelector(s),frame=$('#processRouteFrame'),panel=$('.process-route-panel');
  if(!frame||!panel)return;
  const catalog=window.QMS_ROUTE_CATALOG,params=new URLSearchParams(location.search);
  const state={routeId:catalog?.getRoute(params.get('route'))?.id || 'RD-R01',workshop:params.get('workshop') || ''};
  const currentRoute=()=>catalog?.getRoute(state.routeId) || window.ROCKDALE_ROUTE;
  let focused=null;
  function saveLocation(){
    const url=new URL(location.href);url.searchParams.set('project',$('#projectSelect').value);
    url.searchParams.set('production',$('#productionTabs .active').dataset.productionView);
    if($('#projectSelect').value==='rd'){url.searchParams.set('route',state.routeId);if(state.workshop)url.searchParams.set('workshop',state.workshop);else url.searchParams.delete('workshop');}
    else{url.searchParams.delete('route');url.searchParams.delete('workshop');}
    history.replaceState(null,'',url);
  }
  function open(id,context={}){
    if($('#projectSelect').value!=='rd')return;
    const routeId=catalog?.getRoute(context.routeId)?.id || state.routeId;
    const workshop=context.workshop ?? (panel.classList.contains('active') ? state.workshop : '');
    const data=context.aggregate&&catalog ? catalog.aggregate() : catalog?.scope(routeId,workshop) || currentRoute();
    const node=data.nodes.find(n=>n.id===id);if(!node)return;
    focused=document.activeElement;
    $('#drawerTitle').textContent='工序详情 · '+id+' '+node.name;
    window.QMS_ROUTE_DETAIL.mount($('#drawerBody'),node,data);
    if(context.aggregate&&node.routeStats){
      const section=document.createElement('section');section.className='rd-route-breakdown';
      const title=document.createElement('p');title.textContent='按路线查看制造进度图';section.append(title);
      node.routeStats.forEach(item=>{
        const button=document.createElement('button');button.type='button';button.dataset.rdRouteTarget=item.id;
        const text=document.createElement('span'),name=document.createElement('b'),values=document.createElement('small'),action=document.createElement('em');
        name.textContent=item.name+' · '+item.totalBoxes+' 箱';values.textContent='报验 '+item.reported+' 箱 / 验收通过 '+item.accepted+' 箱';action.textContent='查看路线 →';
        text.append(name,values);button.append(text,action);button.onclick=()=>showRoute(item.id,id);section.append(button);
      });
      $('#drawerBody .route-detail-scope')?.after(section);
    }
    const drawer=$('#drawer');drawer.dataset.routeDetail='true';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-labelledby','drawerTitle');drawer.classList.add('open');drawer.scrollTop=0;
    $('#backdrop').classList.add('open');$('#closeDrawer').focus({preventScroll:true});
  }
  function restoreFocus(){
    if($('#drawer').dataset.routeDetail!=='true')return;
    delete $('#drawer').dataset.routeDetail;$('#drawer').removeAttribute('aria-modal');$('#drawer').removeAttribute('role');
    if(focused?.isConnected)focused.focus({preventScroll:true});
    frame.contentWindow?.postMessage({type:'qms-route-focus'},location.origin);
  }
  function showRoute(routeId,nodeId){
    if(!catalog?.getRoute(routeId)||$('#projectSelect').value!=='rd')return;
    $('#drawer').classList.remove('open');$('#backdrop').classList.remove('open');restoreFocus();
    state.routeId=routeId;state.workshop='';window.QMS_PRODUCTION_TABS.activate('route');
    const url=new URL('process-demos/index.html',location.href);url.searchParams.set('embedded','1');url.searchParams.set('route',routeId);url.searchParams.set('node',nodeId);
    frame.src=url.pathname+url.search;update();saveLocation();
  }
  function update(){
    const rd=$('#projectSelect').value==='rd',active=panel.classList.contains('active');
    $('#routeUnavailable').hidden=rd;frame.hidden=!rd;
    if(rd&&active){if(!frame.getAttribute('src')){const url=new URL('process-demos/index.html',location.href);url.searchParams.set('embedded','1');url.searchParams.set('route',state.routeId);if(state.workshop)url.searchParams.set('workshop',state.workshop);frame.src=url.pathname+url.search;}else requestAnimationFrame(()=>frame.contentWindow?.postMessage({type:'qms-route-visible'},location.origin));}
    if(!rd&&$('#drawer').dataset.routeDetail==='true'){$('#drawer').classList.remove('open');$('#backdrop').classList.remove('open');restoreFocus();}
  }
  addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
    if(e.data?.type==='qms-route-select')open(e.data.id,e.data);
    if(e.data?.type==='qms-route-context'&&catalog?.getRoute(e.data.routeId)){
      state.routeId=e.data.routeId;state.workshop=typeof e.data.workshop==='string' ? e.data.workshop : '';
      if($('#drawer').dataset.routeDetail==='true'){$('#drawer').classList.remove('open');$('#backdrop').classList.remove('open');restoreFocus();}
      if($('#projectSelect').value==='rd')window.QMS_RD_DASHBOARD.render();saveLocation();
    }
    if(e.data?.type==='qms-route-height'&&Number.isFinite(e.data.height))frame.style.height=Math.max(320,Math.min(1600,e.data.height))+'px';
  });
  $('#productionTabs').addEventListener('click',()=>{update();saveLocation();});
  $('#projectSelect').addEventListener('change',()=>{update();saveLocation();});
  $('#closeDrawer').addEventListener('click',restoreFocus);$('#backdrop').addEventListener('click',restoreFocus);
  document.addEventListener('keydown',e=>{
    if($('#drawer').dataset.routeDetail!=='true')return;
    if(e.key==='Escape'){$('#drawer').classList.remove('open');$('#backdrop').classList.remove('open');restoreFocus();}
    if(e.key==='Tab'){const items=[...$('#drawer').querySelectorAll('button,input,select,[tabindex="0"]')].filter(item=>!item.disabled&&item.getClientRects().length);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}
  });
  const initial=new URLSearchParams(location.search).get('production');
  if(['manufacturing','distribution','route'].includes(initial))window.QMS_PRODUCTION_TABS.activate(initial);
  else if($('#projectSelect').value==='rd')window.QMS_PRODUCTION_TABS.activate('route');
  window.QMS_ROUTE_HOST={open,update,currentRoute};if($('#projectSelect').value==='rd')window.QMS_RD_DASHBOARD.render();update();
})();
