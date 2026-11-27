/* In-page comboboxes always open below their input; no native datalist popup. */
(() => {
  'use strict';
  const controls=new Set();
  const normalize=value=>String(value??'').toLowerCase().replace(/[-\s]/g,'');
  function create(input,{listId,onSelect=()=>{},selectionOnly=false}){
    input.removeAttribute('list');
    const wrapper=document.createElement('div');wrapper.className='route-combobox';
    input.before(wrapper);wrapper.append(input);
    const toggle=document.createElement('button');toggle.type='button';toggle.tabIndex=-1;toggle.className='route-combobox-toggle';
    toggle.setAttribute('aria-label','展开'+(selectionOnly?'工艺路线':input.id==='search'?'工序':'车间')+'候选列表');
    toggle.innerHTML='<svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    wrapper.append(toggle);
    const panel=document.createElement('div');panel.className='route-combobox-panel';panel.hidden=true;
    const list=document.createElement('div');list.className='route-combobox-list';list.id=listId;list.setAttribute('role','listbox');list.setAttribute('aria-label',input.getAttribute('aria-label')+'候选');
    panel.append(list);document.body.append(panel);
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete',selectionOnly?'none':'list');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-controls',listId);input.setAttribute('aria-expanded','false');
    let options=[],visible=[],active=-1,showAll=false;
    const isOpen=()=>!panel.hidden;
    function close(){panel.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
    function position(){
      if(!isOpen())return;
      const rect=input.getBoundingClientRect(),width=Math.min(innerWidth-16,Math.max(220,rect.width)),top=rect.bottom+8;
      panel.style.left=Math.max(8,Math.min(rect.left,innerWidth-width-8))+'px';panel.style.top=top+'px';panel.style.width=width+'px';
      list.style.maxHeight=Math.max(100,Math.min(260,innerHeight-top-12))+'px';
      panel.style.setProperty('--combo-arrow-left',Math.max(16,Math.min(width-24,rect.left+28-parseFloat(panel.style.left)))+'px');
    }
    function setActive(index,scroll=true){
      active=index;
      [...list.querySelectorAll('[role="option"]')].forEach((element,i)=>{element.setAttribute('aria-selected',String(i===active));element.classList.toggle('active',i===active);});
      const option=list.querySelector('[data-option-index="'+active+'"]');
      if(!option){input.removeAttribute('aria-activedescendant');return;}
      input.setAttribute('aria-activedescendant',option.id);
      if(scroll){if(option.offsetTop<list.scrollTop)list.scrollTop=option.offsetTop;else if(option.offsetTop+option.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=option.offsetTop+option.offsetHeight-list.clientHeight;}
    }
    function choose(index){
      const option=visible[index];if(!option)return;
      input.value=option.display??option.value;if(!selectionOnly)input.dispatchEvent(new Event('input',{bubbles:true}));close();onSelect(option);
    }
    function render(){
      const query=showAll?'':normalize(input.value);
      visible=options.filter(option=>!query||normalize(option.value+' '+(option.title||'')+' '+(option.label||'')).includes(query));
      list.replaceChildren();
      if(!visible.length){const empty=document.createElement('p');empty.className='route-combobox-empty';empty.textContent='没有匹配结果';empty.setAttribute('role','status');list.append(empty);active=-1;input.removeAttribute('aria-activedescendant');return;}
      visible.forEach((option,index)=>{
        const row=document.createElement('div');row.className='route-combobox-option';row.id=listId+'-option-'+index;row.dataset.optionIndex=index;row.dataset.value=option.value;row.setAttribute('role','option');
        const title=document.createElement('span');title.className='route-combobox-value';title.textContent=option.title??option.value;row.append(title);
        if(option.label){const label=document.createElement('span');label.className='route-combobox-label';label.textContent=option.label;row.append(label);}
        row.addEventListener('pointerdown',event=>event.preventDefault());row.addEventListener('pointermove',()=>setActive(index,false));row.addEventListener('click',()=>choose(index));list.append(row);
      });
      list.scrollTop=0;setActive(0,false);
    }
    function open(all=false){
      const first=!isOpen();for(const control of controls)if(control!==api)control.close();
      showAll=all||selectionOnly;panel.hidden=false;input.setAttribute('aria-expanded','true');render();position();
      if(first&&window.parent!==window)parent.postMessage({type:'qms-route-dropdown-space',bottom:input.getBoundingClientRect().bottom+8+panel.offsetHeight},location.origin);
    }
    input.addEventListener('focus',()=>open());
    input.addEventListener('click',()=>{if(!isOpen())open();});
    input.addEventListener('input',()=>open());
    input.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==input)close();},0));
    input.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();const wasOpen=isOpen();if(!wasOpen)open(true);
        if(visible.length)setActive(wasOpen?Math.max(0,Math.min(visible.length-1,active+(event.key==='ArrowDown'?1:-1))):event.key==='ArrowDown'?0:visible.length-1);
      }else if((event.key==='Enter'||selectionOnly&&event.key===' ')&&isOpen()&&active>=0){event.preventDefault();event.stopImmediatePropagation();choose(active);}
      else if(selectionOnly&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open(true);}
      else if(event.key==='Escape'&&isOpen()){event.preventDefault();close();}
      else if(event.key==='Tab')close();
    });
    toggle.addEventListener('pointerdown',event=>event.preventDefault());
    toggle.addEventListener('click',()=>{const wasOpen=isOpen();input.focus({preventScroll:true});if(wasOpen)close();else open(true);});
    document.addEventListener('pointerdown',event=>{if(!wrapper.contains(event.target)&&!panel.contains(event.target))close();});
    addEventListener('resize',position);addEventListener('scroll',position,true);addEventListener('blur',close);
    try{if(parent!==window)parent.addEventListener('scroll',position,{passive:true});}catch{}
    addEventListener('message',event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.type==='qms-route-dismiss-dropdowns')close();});
    const api={close,isOpen,setOptions(items){options=items.map(item=>typeof item==='string'?{value:item}:item);if(isOpen()){render();position();}}};
    controls.add(api);return api;
  }
  function createSelect(select,{listId,options}){
    const input=document.createElement('input');input.id=select.id+'Trigger';input.type='text';input.readOnly=true;input.autocomplete='off';input.className='route-select-trigger';
    input.setAttribute('aria-label',select.getAttribute('aria-label'));select.after(input);
    const api=create(input,{listId,selectionOnly:true,onSelect:option=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));}});
    const sync=()=>{input.value=select.selectedOptions[0]?.textContent || '';};
    api.setOptions(options);sync();select.addEventListener('change',sync);select.hidden=true;
    return api;
  }
  window.QMS_ROUTE_DROPDOWNS={create,createSelect};
})();
