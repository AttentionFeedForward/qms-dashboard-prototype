(() => {
  'use strict';
  const $=s=>document.querySelector(s),frame=$('#processRouteFrame'),panel=$('.process-route-panel');
  if(!frame||!panel)return;
  let focused=null;
  function open(id){
    if($('#projectSelect').value!=='rd')return;
    const node=window.ROCKDALE_ROUTE.nodes.find(n=>n.id===id);if(!node)return;
    focused=document.activeElement;
    $('#drawerTitle').textContent='工序详情 · '+id+' '+node.name;
    window.QMS_ROUTE_DETAIL.mount($('#drawerBody'),node);
    const drawer=$('#drawer');drawer.dataset.routeDetail='true';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-labelledby','drawerTitle');drawer.classList.add('open');drawer.scrollTop=0;
    $('#backdrop').classList.add('open');$('#closeDrawer').focus({preventScroll:true});
  }
  function restoreFocus(){
    if($('#drawer').dataset.routeDetail!=='true')return;
    delete $('#drawer').dataset.routeDetail;$('#drawer').removeAttribute('aria-modal');$('#drawer').removeAttribute('role');
    if(focused?.isConnected)focused.focus({preventScroll:true});
    frame.contentWindow?.postMessage({type:'qms-route-focus'},location.origin);
  }
  function update(){
    const rd=$('#projectSelect').value==='rd',active=panel.classList.contains('active');
    $('#routeUnavailable').hidden=rd;frame.hidden=!rd;
    if(rd&&active){if(!frame.getAttribute('src'))frame.src='process-demos/index.html?embedded=1';else requestAnimationFrame(()=>frame.contentWindow?.postMessage({type:'qms-route-visible'},location.origin));}
    if(!rd&&$('#drawer').dataset.routeDetail==='true'){$('#drawer').classList.remove('open');$('#backdrop').classList.remove('open');restoreFocus();}
  }
  addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
    if(e.data?.type==='qms-route-select')open(e.data.id);
    if(e.data?.type==='qms-route-height'&&Number.isFinite(e.data.height))frame.style.height=Math.max(500,Math.min(1000,e.data.height))+'px';
  });
  $('#productionTabs').addEventListener('click',()=>{update();const url=new URL(location.href);url.searchParams.set('production',$('#productionTabs .active').dataset.productionView);history.replaceState(null,'',url);});
  $('#projectSelect').addEventListener('change',()=>{update();const url=new URL(location.href);url.searchParams.set('project',$('#projectSelect').value);history.replaceState(null,'',url);});
  $('#closeDrawer').addEventListener('click',restoreFocus);$('#backdrop').addEventListener('click',restoreFocus);
  document.addEventListener('keydown',e=>{
    if($('#drawer').dataset.routeDetail!=='true')return;
    if(e.key==='Escape'){$('#drawer').classList.remove('open');$('#backdrop').classList.remove('open');restoreFocus();}
    if(e.key==='Tab'){const items=[...$('#drawer').querySelectorAll('button,select,[tabindex="0"]')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}
  });
  const initial=new URLSearchParams(location.search).get('production');
  if(['manufacturing','distribution','route'].includes(initial))window.QMS_PRODUCTION_TABS.activate(initial);
  window.QMS_ROUTE_HOST={open,update};update();
})();
