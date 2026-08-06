(function () {
  'use strict';

  const app = window.QMS_V2_APP;
  if (!app) return;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const project = () => app.data.projects.find((item) => item.id === app.state.project) || app.data.projects[0];
  let productionChart = null;

  function mockTrend(finalCount, period) {
    const labels = period === 'month'
      ? ['02月', '03月', '04月', '05月', '06月', '07月']
      : period === 'week'
        ? ['第26周', '第27周', '第28周', '第29周', '第30周', '第31周']
        : ['07-26', '07-27', '07-28', '07-29', '07-30', '07-31'];
    let previous = 0;
    return labels.map((date, index) => {
      const count = index === labels.length - 1 ? finalCount : Math.round(finalCount * (0.55 + index * 0.085));
      const point = { date, count, added: Math.max(0, count - previous) };
      previous = count;
      return point;
    });
  }

  function productionData() {
    if (app.state.project === 'p05' && window.QMS_P05_PRODUCTION) return window.QMS_P05_PRODUCTION;
    const source = app.data.projectQuality?.[app.state.project]?.process || app.data.process || [];
    const total = project().units || 1;
    return {
      projectId: app.state.project,
      totalBoxes: total,
      timestamp: '模拟数据实时快照',
      processes: source
        .filter((item) => item.stage === '结构制造' || item.stage === '装修施工')
        .map((item) => {
          const count = Number(item.count || 0);
          return {
            stage: item.stage,
            code: item.code,
            name: item.name,
            count,
            pct: Number(((count / total) * 100).toFixed(1)),
            todayAdded: Math.max(0, Math.round(count * 0.03)),
            timestamp: '模拟数据实时快照',
            trends: {
              day: mockTrend(count, 'day'),
              week: mockTrend(count, 'week'),
              month: mockTrend(count, 'month')
            }
          };
        })
    };
  }

  function renderManufacturingProgress() {
    const host = $('#manufacturingProgress');
    if (!host) return;
    const data = productionData();
    const groups = ['结构制造', '装修施工'];
    host.innerHTML = groups.map((stage, stageIndex) => {
      const items = data.processes.filter((item) => item.stage === stage);
      return `<section class="manufacturing-group">
        <div class="manufacturing-group-title"><span>${String(stageIndex + 1).padStart(2, '0')}</span><h4>${stage}</h4><small>${items.length}道工序</small></div>
        <div class="manufacturing-route">${items.map((item) => `<button class="manufacturing-card" data-production-process="${item.code}">
          <span class="process-code">${item.code}</span>
          <h5>${item.name.replace(`${item.code}-`, '')}</h5>
          <strong>${item.pct}%</strong>
          <p>累计完成 <b>${item.count}箱</b></p>
          <em class="${item.todayAdded > 0 ? 'positive' : ''}">较昨日 ${item.todayAdded > 0 ? '+' : ''}${item.todayAdded}箱</em>
        </button>`).join('')}</div>
      </section>`;
    }).join('');
    $$('[data-production-process]').forEach((button) => {
      button.onclick = () => openProductionDrawer(button.dataset.productionProcess);
    });
    if ($('#manufacturingTimestamp')) $('#manufacturingTimestamp').textContent = `数据时间：${data.timestamp}`;
  }

  function formatTimestamp() {
    return app.state.project === 'p05' && window.QMS_P05_PRODUCTION
      ? window.QMS_P05_PRODUCTION.timestamp
      : '模拟数据实时快照';
  }

  function currentDistribution() {
    return app.data.projectDistributions?.[app.state.project] || { boxFlow: app.data.boxFlow };
  }

  function patchDistribution() {
    const host = $('#distribution');
    if (!host) return;
    if ($('#distributionTimestamp')) $('#distributionTimestamp').textContent = `数据时间：${formatTimestamp()}`;
    const flow = currentDistribution().boxFlow || [];
    $$('[data-flow]', host).forEach((card) => {
      const node = flow.find((item) => item.code === card.dataset.flow);
      if (!node) return;
      const strong = card.querySelector('strong');
      const small = card.querySelector('small');
      if (strong) strong.textContent = node.count === null || node.dataStatus === 'unavailable' ? '暂无数据' : `${node.count}箱`;
      if (small) small.textContent = node.count === null || node.dataStatus === 'unavailable' ? '' : '当前节点';
    });
  }

  function drawProductionChart(item, period) {
    const element = $('#manufacturingTrendChart');
    if (!element) return;
    if (productionChart) productionChart.dispose();
    const points = item.trends?.[period] || [];
    if (!window.echarts) {
      element.innerHTML = `<div class="chart-fallback">${points.map((point) => `<span>${point.date}<b>${point.count}箱</b></span>`).join('')}</div>`;
      return;
    }
    productionChart = window.echarts.init(element);
    productionChart.setOption({
      animationDuration: 500,
      grid: { left: 48, right: 24, top: 28, bottom: 42 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#10262d',
        borderColor: '#2d5b64',
        textStyle: { color: '#eef8f8' },
        formatter(params) {
          const index = params[0]?.dataIndex || 0;
          const point = points[index];
          return `${point.date}<br/>累计完成：${point.count}箱<br/>本期新增：${point.added}箱`;
        }
      },
      xAxis: { type: 'category', data: points.map((point) => point.date), axisLabel: { color: '#8ba5ad', hideOverlap: true }, axisLine: { lineStyle: { color: '#23434b' } } },
      yAxis: { type: 'value', name: '箱', nameTextStyle: { color: '#8ba5ad' }, axisLabel: { color: '#8ba5ad' }, splitLine: { lineStyle: { color: '#183139' } } },
      series: [{ type: 'line', smooth: true, symbolSize: 7, data: points.map((point) => point.count), lineStyle: { color: '#55d6d0', width: 3 }, itemStyle: { color: '#76f0e8' }, areaStyle: { color: 'rgba(85,214,208,.12)' } }]
    });
    requestAnimationFrame(() => productionChart.resize());
  }

  function openProductionDrawer(code) {
    const item = productionData().processes.find((process) => process.code === code);
    if (!item) return;
    $('#drawerTitle').textContent = `制造进度 · ${item.name}`;
    $('#drawerBody').innerHTML = `<div class="production-summary">
      <div><span>累计完成箱体数量</span><strong>${item.count}箱</strong></div>
      <div><span>项目完成占比</span><strong>${item.pct}%</strong></div>
      <div><span>较昨日新增</span><strong>+${item.todayAdded}箱</strong></div>
    </div>
    <div class="production-chart-head"><div><span class="eyebrow">CUMULATIVE TREND</span><h3>累计完成数量趋势</h3></div>
      <select id="manufacturingPeriod"><option value="day">日</option><option value="week">周</option><option value="month">月</option></select>
    </div>
    <div id="manufacturingTrendChart" class="chart drawer-chart manufacturing-trend-chart"></div>
    <p class="drawer-note">统计口径：截至每个周期末，已完成当前工序验收的去重箱体累计数量。</p>`;
    $('#backdrop').classList.add('open');
    $('#drawer').classList.add('open');
    const select = $('#manufacturingPeriod');
    const render = () => drawProductionChart(item, select.value);
    select.onchange = render;
    render();
  }

  function activateQualityPane(name) {
    $$('#qualityTabs [data-quality-view]').forEach((button) => button.classList.toggle('active', button.dataset.qualityView === name));
    $$('.quality-pane').forEach((pane) => pane.classList.toggle('active', pane.dataset.qualityView === name));
    if (name === 'process') requestAnimationFrame(() => window.QMS_CHARTS?.overall?.resize());
  }

  function bindQualityTabs() {
    $('#qualityTabs')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-quality-view]');
      if (button) activateQualityPane(button.dataset.qualityView);
    });
    $('#viewTabs')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-view]');
      if (button?.dataset.view === 'quality') requestAnimationFrame(() => window.QMS_CHARTS?.overall?.resize());
    });
  }

  function refreshProductionAfterApp() {
    window.setTimeout(() => {
      renderManufacturingProgress();
      patchDistribution();
    }, 0);
  }

  bindQualityTabs();
  $('#projectSelect')?.addEventListener('change', refreshProductionAfterApp);
  $('#rangeSelect')?.addEventListener('change', refreshProductionAfterApp);
  $('#refreshBtn')?.addEventListener('click', () => window.setTimeout(refreshProductionAfterApp, 560));
  $('#distribution')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-flow]');
    if (!card) return;
    window.setTimeout(() => {
      const node = currentDistribution().boxFlow.find((item) => item.code === card.dataset.flow);
      const value = $('#drawerBody .flow-detail-summary em');
      if (node && value) value.textContent = node.count === null ? '暂无数据' : `${node.count}箱`;
    }, 0);
  });
  renderManufacturingProgress();
  patchDistribution();
  activateQualityPane('process');
})();
