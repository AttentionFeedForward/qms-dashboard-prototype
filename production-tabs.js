(function () {
  'use strict';

  const stack = document.querySelector('.production-stack');
  if (!stack || document.querySelector('#productionTabs')) return;

  const panels = [...stack.querySelectorAll(':scope > .dashboard-panel')];
  if (panels.length < 2) return;

  const definitions = [
    { key: 'route', label: '制造进度图', selector: '.process-route-panel' },
    { key: 'manufacturing', label: '工序验收进度表', selector: '.manufacturing-panel' },
    { key: 'distribution', label: '当前箱体分布图', selector: '.distribution-panel' }
  ];

  const tabs = document.createElement('nav');
  tabs.id = 'productionTabs';
  tabs.className = 'quality-tabs production-tabs';
  tabs.setAttribute('aria-label', '生产进度看板视图切换');
  tabs.innerHTML = definitions.map((item, index) =>
    `<button class="${item.key === 'manufacturing' ? 'active' : ''}" data-production-view="${item.key}">${item.label}</button>`
  ).join('');
  stack.parentElement.insertBefore(tabs, stack);

  definitions.forEach((item, index) => {
    const panel = stack.querySelector(item.selector);
    if (!panel) return;
    stack.append(panel);
    panel.classList.add('production-pane');
    panel.dataset.productionView = item.key;
    panel.classList.toggle('active', item.key === 'manufacturing');
    const number = panel.querySelector('.panel-index');
    if (number) number.textContent = String(index+1).padStart(2,'0');
  });

  function activateProductionPane(name) {
    tabs.querySelectorAll('[data-production-view]').forEach((button) => {
      const active = button.dataset.productionView === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.productionView === name));
  }

  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-production-view]');
    if (button) activateProductionPane(button.dataset.productionView);
  });

  window.QMS_PRODUCTION_TABS = { activate: activateProductionPane };
})();
