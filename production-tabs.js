(function () {
  'use strict';

  const stack = document.querySelector('.production-stack');
  if (!stack || document.querySelector('#productionTabs')) return;

  const panels = [...stack.querySelectorAll(':scope > .dashboard-panel')];
  if (panels.length < 2) return;

  const definitions = [
    { key: 'manufacturing', label: '箱体制造进度图' },
    { key: 'distribution', label: '当前箱体分布图' }
  ];

  const tabs = document.createElement('nav');
  tabs.id = 'productionTabs';
  tabs.className = 'quality-tabs production-tabs';
  tabs.setAttribute('aria-label', '生产进度看板视图切换');
  tabs.innerHTML = definitions.map((item, index) =>
    `<button class="${index === 0 ? 'active' : ''}" data-production-view="${item.key}">${item.label}</button>`
  ).join('');
  stack.parentElement.insertBefore(tabs, stack);

  panels.forEach((panel, index) => {
    panel.classList.add('production-pane');
    panel.dataset.productionView = definitions[index].key;
    panel.classList.toggle('active', index === 0);
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
