/* Process-level box details use workbook-local calendar timestamps. */
(() => {
  'use strict';
  const MINUTE = 60000, DAY = 86400000;
  function timestampMs(value) {
    if (typeof value !== 'string') return null;
    const parts = value.trim().match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T\s-](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!parts) return null;
    const [,year,month,day,hour,minute,second = '00'] = parts;
    const ms = Date.UTC(+year,+month-1,+day,+hour,+minute,+second);
    const date = new Date(ms);
    return date.getUTCFullYear() === +year && date.getUTCMonth() === +month-1 && date.getUTCDate() === +day && date.getUTCHours() === +hour && date.getUTCMinutes() === +minute && date.getUTCSeconds() === +second ? ms : null;
  }
  const timestampText = ms => Number.isFinite(ms) ? new Date(ms).toISOString().slice(0,19).replace('T',' ') : null;
  const normalizeTimestamp = value => {const ms = timestampMs(value);return ms === null ? null : timestampText(ms);};
  function makeRows(node,boxOrder = window.QMS_MULTI_ROUTE?.boxes || node.boundBoxes) {
    const records = new Map((node.records || []).map(record => [record.box,record]));
    return [...new Set(node.boundBoxes)].map(box => {
      const record = records.get(box);
      const reportedPassedAt = normalizeTimestamp(record?.reportedPassedAt || record?.reportedAt);
      const qualityPassedAt = normalizeTimestamp(record?.qualityPassedAt || record?.acceptedAt);
      const reportedMs = timestampMs(reportedPassedAt), qualityMs = timestampMs(qualityPassedAt);
      // Place missing self-inspection approval between report approval and quality approval.
      const selfMs = reportedMs === null ? null : qualityMs === null ? reportedMs+45*MINUTE : reportedMs+Math.min(120*MINUTE,Math.max(0,Math.floor((qualityMs-reportedMs)/2000)*1000));
      const selfPassedAt = normalizeTimestamp(record?.selfPassedAt) || (selfMs === null ? null : timestampText(selfMs));
      const workshopIndex = Math.max(0,boxOrder.indexOf(box)) % 3;
      const workshop = record?.workshop || (node.phase === 'ST' ? '结构' : '装修')+['一','二','三'][workshopIndex]+'车间';
      return {box,workshop,reportedPassedAt,selfPassedAt,qualityPassedAt};
    });
  }
  function dateBoundary(value,isEnd = false) {
    if (!value) return null;
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const ms = timestampMs(dateOnly ? value+' 00:00:00' : value);
    return ms === null ? NaN : ms+(isEnd ? dateOnly ? DAY : 1000 : 0);
  }
  function filterRows(rows,{workshop = 'all',query = '',start = '',end = ''} = {}) {
    const from = dateBoundary(start),until = dateBoundary(end,true);
    const error = Number.isNaN(from) || Number.isNaN(until) ? '请选择有效的时间' : from !== null && until !== null && from >= until ? '开始时间不能晚于结束时间' : '';
    if (error) return {rows:[],count:0,error};
    const text = query.trim().toLowerCase(),seen = new Set();
    const filtered = rows.filter(row => {
      const quality = timestampMs(row.qualityPassedAt);
      if (quality === null || seen.has(row.box) || workshop !== 'all' && row.workshop !== workshop || !row.box.toLowerCase().includes(text)) return false;
      if (from !== null && quality < from || until !== null && quality >= until) return false;
      seen.add(row.box);return true;
    });
    return {rows:filtered,count:filtered.length,error:''};
  }
  function currentTimestamp() {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type,part.value]));
    return values.year+'-'+values.month+'-'+values.day+' '+values.hour+':'+values.minute+':'+values.second;
  }
  function rollingRange(period,reference = currentTimestamp()) {
    const endMs = timestampMs(reference);
    if (endMs === null) throw new Error('Invalid reference timestamp');
    let startMs;
    if (period === 'week') startMs = endMs-7*DAY;
    else if (period === 'month') {
      const date = new Date(endMs),day = date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-1);
      const lastDay = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,lastDay));startMs = +date;
    } else throw new Error('Unsupported rolling period');
    return {start:timestampText(startMs),end:timestampText(endMs)};
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(container,node,{query = '',spanMode,now = currentTimestamp,boxOrder,totalBound:requestedTotal,exportContext = {}} = {}) {
    if (!['range','cumulative'].includes(spanMode)) throw new Error('Process box detail time scope must be explicit');
    const rows = makeRows(node,boxOrder),workshops = [...new Set(rows.map(row => row.workshop))];
    const totalBound = Math.max(rows.length,Number(requestedTotal)||0);
    const initialNow = now();
    const state = {period:'day',workshop:'all',query,start:'',end:initialNow.slice(0,10)};
    container.classList.add('pbd');
    container.innerHTML = '<div class="pbd-heading"><div class="pbd-title"><h3>箱号明细</h3><span>筛选仅影响明细</span></div><div class="pbd-heading-actions"><div class="pbd-result" aria-live="polite"><span>符合条件</span><strong data-box-count></strong><span>箱</span><small>/ 绑定 '+totalBound+' 箱</small></div><button type="button" class="pbd-export" data-box-export title="导出当前筛选结果（Excel）">导出表格</button></div></div>'+
      '<div class="pbd-filters"><div class="pbd-filter-grid"><label><span class="mr-sr-only">所在车间</span><select data-box-workshop aria-label="筛选所在车间"><option value="all">全部车间</option>'+workshops.map(workshop => '<option value="'+esc(workshop)+'">'+esc(workshop)+'</option>').join('')+'</select></label><label class="pbd-search"><span class="mr-sr-only">搜索箱号</span><input type="search" data-box-list-search aria-label="搜索绑定箱号" placeholder="搜索箱号"></label></div>'+
      '<div class="pbd-time-controls"><div class="pbd-periods" role="group" aria-label="箱号明细时间维度">'+[['day','日'],['week','周'],['month','月'],['custom','自定义']].map(([key,label]) => '<button type="button" data-box-period="'+key+'" aria-pressed="'+(key === 'day')+'" class="'+(key === 'day' ? 'active' : '')+'">'+label+'</button>').join('')+'</div><div class="pbd-date-fields" data-box-dates></div><button class="pbd-reset" type="button" data-box-reset>重置</button></div>'+
      '<div class="pbd-hints"><p class="pbd-time-note" data-box-time-note></p><p data-box-count-note hidden></p></div></div>'+
      '<p class="pbd-error" data-box-error role="alert" hidden></p><div class="pbd-table-wrap"><table class="pbd-table"><caption class="mr-sr-only">工序绑定箱号及报验、自检、质检通过时间</caption><colgroup><col class="pbd-col-index"><col class="pbd-col-box"><col class="pbd-col-workshop"><col class="pbd-col-times"></colgroup><thead><tr><th scope="col">序号</th><th scope="col">箱号</th><th scope="col">所在车间</th><th scope="col">箱体报验/自检/质检时间</th></tr></thead><tbody></tbody></table></div>';
    const $ = selector => container.querySelector(selector),input = $('[data-box-list-search]');input.value = query;
    let currentResult = {rows:[],count:0,error:''};
    function renderRows() {
      const missingDate = !state.end || state.period !== 'day' && !state.start;
      const result = missingDate ? {rows:[],count:0,error:state.period === 'day' ? '请选择截止日期' : '请选择完整的起止时间'} : filterRows(rows,{workshop:state.workshop,query:state.query,start:spanMode === 'cumulative' || state.period === 'day' ? '' : state.start,end:state.end});
      $('[data-box-count]').textContent = result.count;
      currentResult = result;
      $('[data-box-export]').disabled = !result.count || !!result.error;
      const missing = totalBound-rows.filter(row => row.qualityPassedAt).length;
      $('[data-box-count-note]').textContent = missing ? '未质检通过 '+missing+' 箱未计入' : '';
      $('[data-box-count-note]').hidden = !missing;
      const error = $('[data-box-error]');error.textContent = result.error;error.hidden = !result.error;
      $('tbody').innerHTML = result.rows.length ? result.rows.map((row,index) => '<tr><td class="pbd-index">'+(index+1)+'</td><th scope="row"><span class="pbd-box">'+esc(row.box)+'</span></th><td>'+esc(row.workshop)+'</td><td class="pbd-times">'+[['报验',row.reportedPassedAt],['自检',row.selfPassedAt],['质检',row.qualityPassedAt]].map(([label,time]) => '<div><span>'+label+'</span><time'+(time ? ' datetime="'+time.replace(' ','T')+'+08:00"' : '')+'><span>'+esc(time ? time.slice(0,10) : '—')+'</span>'+(time ? ' <span>'+esc(time.slice(11))+'</span>' : '')+'</time></div>').join('')+'</td></tr>').join('') : '<tr><td colspan="4" class="pbd-empty">'+(result.error || '当前筛选条件下没有符合要求的箱体')+'</td></tr>';
    }
    function updateTimeNote() {
      $('[data-box-time-note]').textContent = state.period === 'day' ? '按质检通过时间 · 累计至当日 24:00' : spanMode === 'cumulative' ? '按质检通过时间 · 累计至结束时间' : '按质检通过时间 · 所选区间内统计';
      container.querySelectorAll('[data-box-period]').forEach(button => {const active = button.dataset.boxPeriod === state.period;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    }
    function renderDateFields() {
      const fields = $('[data-box-dates]');
      fields.classList.toggle('is-range',state.period !== 'day');
      if (state.period === 'day') fields.innerHTML = '<label class="pbd-cutoff"><span>截至</span><input type="date" data-box-end aria-label="箱号明细截止日期" value="'+esc(state.end)+'"></label>';
      else fields.innerHTML = '<label><span class="mr-sr-only">开始时间</span><input type="datetime-local" step="1" data-box-start aria-label="箱号明细开始时间" value="'+esc(state.start.replace(' ','T'))+'"></label><span class="pbd-range-separator">至</span><label><span class="mr-sr-only">结束时间</span><input type="datetime-local" step="1" data-box-end aria-label="箱号明细结束时间" value="'+esc(state.end.replace(' ','T'))+'"></label>';
      fields.querySelectorAll('input').forEach(field => field.addEventListener('change',() => {
        state[field.hasAttribute('data-box-start') ? 'start' : 'end'] = field.value.replace('T',' ');
        if (state.period !== 'day') state.period = 'custom';
        updateTimeNote();renderRows();
      }));
      updateTimeNote();
    }
    input.addEventListener('input',() => {state.query = input.value;renderRows();});
    $('[data-box-workshop]').addEventListener('change',event => {state.workshop = event.target.value;renderRows();});
    $('[data-box-export]').addEventListener('click',() => {
      if (!currentResult.count || currentResult.error) return;
      const button = $('[data-box-export]');button.disabled = true;button.textContent = '正在导出';
      try {
        window.QMS_BOX_EXPORT.download(currentResult.rows,{...exportContext,nodeId:node.id,nodeName:node.name,workshop:state.workshop,query:state.query,period:state.period,start:state.period === 'day' ? '' : state.start,end:state.end,exportedAt:now()});
      } catch {
        $('[data-box-error]').textContent = '导出失败，请稍后重试';$('[data-box-error]').hidden = false;
      } finally {button.textContent = '导出表格';button.disabled = !currentResult.count || !!currentResult.error;}
    });
    container.querySelectorAll('[data-box-period]').forEach(button => button.addEventListener('click',() => {
      const previous = state.period;state.period = button.dataset.boxPeriod;
      if (state.period === 'day') {state.start = '';state.end = now().slice(0,10);}
      else if (state.period !== 'custom' || previous === 'day') Object.assign(state,rollingRange(state.period === 'custom' ? 'week' : state.period,now()));
      renderDateFields();renderRows();
    }));
    $('[data-box-reset]').addEventListener('click',() => {Object.assign(state,{period:'day',workshop:'all',query:'',start:'',end:now().slice(0,10)});input.value = '';$('[data-box-workshop]').value = 'all';renderDateFields();renderRows();});
    renderDateFields();renderRows();
  }
  window.QMS_PROCESS_BOXES = {makeRows,timestampMs,timestampText,normalizeTimestamp,dateBoundary,filterRows,currentTimestamp,rollingRange,mount};
})();
