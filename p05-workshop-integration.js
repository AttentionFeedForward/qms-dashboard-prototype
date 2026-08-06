(() => {
  const dashboard = window.QMS_V2;
  const app = window.QMS_V2_APP;
  const source = window.QMS_P05_WORKSHOP_QUALITY;
  if (!dashboard || !app || !source) return;

  const originalWorkshops = dashboard.workshops.map(item => ({...item}));
  const p05Workshops = source.workshops;
  const projectSelect = document.querySelector('#projectSelect');
  const metricSelect = document.querySelector('#workshopMetricSelect');
  const refreshButton = document.querySelector('#refreshBtn');
  const isNumber = value => typeof value === 'number' && Number.isFinite(value);
  const escapeHtml = value => String(value ?? '').replace(
    /[&<>"']/g,
    char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]),
  );

  function metricValue(item, key) {
    if (key === 'count') return item.count;
    if (key === 'fpy') return item.fpy;
    if (key === 'docs') return item.docs;
    return item.accept;
  }

  function metricSample(item, key) {
    if (key === 'count') return item.assignedBoxes;
    if (key === 'accept') return item.reachedProcessBoxes;
    const metricKey = key === 'docs' ? 'reportDocs' : key;
    return item.metricSamples?.[metricKey]?.sample ?? 0;
  }

  function formatValue(value, key) {
    if (!isNumber(value)) return '--';
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return `${formatted}${key === 'count' ? '箱' : '%'}`;
  }

  function patchWorkshopTable() {
    if (projectSelect.value !== 'p05') return;
    document
      .querySelectorAll('#workshopTable [data-workshop-row]')
      .forEach(row => {
        const docsCell = row.querySelector('td:nth-child(5)');
        if (!docsCell) return;
        docsCell.textContent = '--';
        docsCell.classList.remove('warning-text');
        docsCell.classList.add('missing-text');
        docsCell.title = '质量源表缺少资料及附件完整性字段，不参与亮灯';
      });
  }

  function patchWorkshopRanking() {
    if (projectSelect.value !== 'p05') return;
    const key = metricSelect.value;
    const names = {
      count: '累计完成箱体数量',
      fpy: 'FPY',
      docs: '资料完成率',
      accept: '验收完成率',
    };
    const rows = [...p05Workshops].sort((left, right) => {
      const leftValue = metricValue(left, key);
      const rightValue = metricValue(right, key);
      if (!isNumber(leftValue) && !isNumber(rightValue)) return 0;
      if (!isNumber(leftValue)) return 1;
      if (!isNumber(rightValue)) return -1;
      return rightValue - leftValue;
    });
    document.querySelector('#rankingTitle').textContent = `车间${names[key]}排名`;
    document.querySelector('#workshopRanking').innerHTML = rows.map((item, index) => `
      <div class="rank-row">
        <b>${String(index + 1).padStart(2, '0')}</b>
        <span>${escapeHtml(item.name)}</span>
        <strong>${formatValue(metricValue(item, key), key)}</strong>
        <small>样本量：${metricSample(item, key)}</small>
      </div>
    `).join('');
  }

  function patchWorkshopView() {
    patchWorkshopTable();
    patchWorkshopRanking();
  }

  function applyProjectWorkshops() {
    dashboard.workshops = projectSelect.value === 'p05'
      ? p05Workshops
      : originalWorkshops;
    app.renderAll();
    patchWorkshopView();
  }

  projectSelect.addEventListener('change', () => {
    applyProjectWorkshops();
  });
  metricSelect.addEventListener('change', () => {
    patchWorkshopRanking();
  });
  refreshButton.addEventListener('click', () => {
    window.setTimeout(patchWorkshopView, 550);
  });

  applyProjectWorkshops();
})();
