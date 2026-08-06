(function () {
  'use strict';

  const primary = document.querySelector('#viewTabs');
  if (!primary || primary.dataset.minimalReady === 'true') return;

  const views = {
    production: {
      index: '01',
      eyebrow: 'PRODUCTION PROGRESS',
      title: '模块箱体生产进度看板',
      description: '查看制造阶段累计完成进度与当前箱体节点分布。'
    },
    quality: {
      index: '02',
      eyebrow: 'QUALITY INSPECTION',
      title: '模块箱体质检看板',
      description: '从工序、车间、班组和工人四个维度查看质检表现。'
    }
  };

  primary.classList.add('minimal-primary-tabs');
  primary.dataset.minimalReady = 'true';

  primary.querySelectorAll('[data-view]').forEach((button) => {
    const item = views[button.dataset.view];
    if (!item) return;
    button.innerHTML = `<span>${item.index} / ${item.eyebrow}</span><strong>${item.title}</strong>`;
    button.setAttribute('aria-label', item.title);
  });

  const description = document.createElement('p');
  description.className = 'nav-context-copy';
  primary.insertAdjacentElement('afterend', description);

  function syncPrimary(name) {
    const item = views[name];
    if (!item) return;
    description.textContent = item.description;
    primary.querySelectorAll('[data-view]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.view === name));
    });
  }

  primary.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (button) syncPrimary(button.dataset.view);
  });

  const productionTabs = document.querySelector('#productionTabs');
  const qualityTabs = document.querySelector('#qualityTabs');
  productionTabs?.classList.add('minimal-subtabs');
  qualityTabs?.classList.add('minimal-subtabs');

  const current = primary.querySelector('[data-view].active')?.dataset.view || 'production';
  syncPrimary(current);
})();
