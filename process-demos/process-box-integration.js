/* Append-only integration: keep the existing detail markup, chart and dimensions. */
(() => {
  'use strict';
  const detail = window.QMS_ROUTE_DETAIL,boxes = window.QMS_PROCESS_BOXES;
  if (!detail || !boxes || detail.boxDetailsAttached) return;
  const originalMount = detail.mount;
  detail.mount = function(container,node,data = window.ROCKDALE_ROUTE) {
    originalMount(container,node,data);
    if (!Array.isArray(data?.nodes)) return;
    const boxOrder = data.boxOrder || [...new Set(data.nodes.flatMap(item => (item.records || []).map(record => record.box)))].sort();
    const boundBoxes = node.boundBoxes || boxOrder;
    const section = document.createElement('section');section.className = 'pbd';section.setAttribute('aria-label','工序箱号明细');
    container.append(section);
    boxes.mount(section,{...node,boundBoxes},{spanMode:'range',boxOrder,totalBound:node.totalBound ?? node.boundBoxes?.length ?? data.totalBoxes,exportContext:{project:typeof data.project === 'string' ? data.project : data.project?.name || 'RD-Rockdale',route:data.name,routeId:data.routeId,scopeWorkshop:data.workshopQuery || ''}});
    if(data.routeId){const context=document.createElement('p');context.className='route-detail-scope';context.style.cssText='margin:14px 0 0;color:#9cbdc4;font-size:13px;line-height:1.7';context.textContent=data.name+' · '+data.routeTotalBoxes+' '+(data.unit || '箱')+(data.workshopQuery ? ' / 车间：'+data.workshopQuery+' · 匹配 '+data.totalBoxes+' 箱' : '');container.prepend(context);}
  };
  detail.boxDetailsAttached = true;
})();
