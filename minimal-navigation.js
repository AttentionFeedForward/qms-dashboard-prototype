(function () {
  'use strict';

  const primary = document.querySelector('#viewTabs');
  if (!primary || primary.dataset.minimalReady === 'true') return;

  const views = {
    production: {
      index: '01',
      eyebrow: 'PRODUCTION PROGRESS',
      title: '进度看板',
      description: '查看制造阶段累计完成进度与当前箱体节点分布。'
    },
    quality: {
      index: '02',
      eyebrow: 'QUALITY INSPECTION',
      title: '质检看板',
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
  function syncProjectTitles() {
    const rd = document.querySelector('#projectSelect')?.value === 'rd';
    primary.querySelectorAll('[data-view]').forEach(button => {
      const key=button.dataset.view,item=views[key];if(!item)return;
      const title=rd ? key==='production' ? '模块箱体进度看板' : '模块箱体质检看板' : item.title;
      button.querySelector('strong').textContent=title;button.setAttribute('aria-label',title);
      const heading=document.querySelector('.view-pane[data-view="'+key+'"] > .section-head h2');if(heading)heading.textContent=title;
    });
  }
  document.querySelector('#projectSelect')?.addEventListener('change',syncProjectTitles);
  syncProjectTitles();
  syncPrimary(current);
})();
