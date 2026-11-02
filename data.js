window.QMS_V2 = {
  projects: [
    { id: 'rd', name: 'RD-Rockdale项目', units: 156, status: 'synced' },
    { id: 'mos', name: 'MOS-马鞍山项目', units: 500, status: 'synced' },
    { id: 'p05', name: 'P05-货柜模块项目', units: 1764, status: 'synced' },
    { id: 'model', name: '1899-样板项目', units: 180, status: 'delayed' }
  ],
  ranges: { '7': '最近7天', '30': '最近30天', '90': '最近90天', all: '项目全周期' },
  projectDistributions: {
    p05: window.QMS_P05_DISTRIBUTION
  },
  projectQuality: {
    p05: window.QMS_P05_QUALITY
  },
  metrics: {
    self: { name: '自检一次通过率', unit: '%', base: 91.2, target: 92, threshold: 80, delta: 1.8 },
    special: { name: '专检一次通过率', unit: '%', base: 88.7, target: 90, threshold: 78, delta: 2.1 },
    three: { name: '三检一次通过率', unit: '%', base: 87.6, target: 88, threshold: 75, delta: 1.2 },
    fpy: { name: '全流程一次通过率（FPY）', unit: '%', base: 86.4, target: 85, threshold: 60, delta: 2.6 },
    rework: { name: '返工率', unit: '%', base: 16.8, target: 18, threshold: 30, delta: -2.4 },
    fix: { name: '平均整改次数', unit: '次', base: 1.8, target: 2, threshold: 3, delta: -0.3 },
    acceptHours: { name: '平均验收时长', unit: '小时', base: 21.6, target: 24, threshold: 48, delta: -3.4 },
    fixHours: { name: '平均整改时长', unit: '小时', base: 43.8, target: 48, threshold: 72, delta: -5.1 },
    buildHours: { name: '平均施工时长', unit: '小时', base: 112.4, target: 120, threshold: 168, delta: -4.5 },
    reportDocs: { name: '报验资料完整率', unit: '%', base: 96.7, target: 98, threshold: 90, delta: 0.8 },
    selfDocs: { name: '自检资料完整率', unit: '%', base: 95.8, target: 98, threshold: 90, delta: 1.2 },
    specialDocs: { name: '专检资料完整率', unit: '%', base: 94.6, target: 98, threshold: 90, delta: 0.4 }
  },
  categories: {
    pass: { name: '质检合格率', default: 'fpy', dir: 'asc', metrics: ['self','special','three','fpy'] },
    nonconformance: { name: '质量不合格', default: 'rework', dir: 'desc', metrics: ['rework','fix'] },
    efficiency: { name: '质量效率', default: 'acceptHours', dir: 'desc', metrics: ['acceptHours','fixHours','buildHours'] },
    docs: { name: '资料完整性', default: 'reportDocs', dir: 'asc', metrics: ['reportDocs','selfDocs','specialDocs'] }
  },
  process: [
    { stage: '结构制造', code: 'ST01', name: 'ST01-箱体总装', itp: false, pct: 3, count: 15, fpy: 90, docs: 98, accept: 94, sample: 45, alert: 'green' },
    { stage: '结构制造', code: 'ST02', name: 'ST02-箱体总焊', itp: false, pct: 2, count: 10, fpy: 88, docs: 96, accept: 92, sample: 42, alert: 'green' },
    { stage: '结构制造', code: 'ST03', name: 'ST03-尺寸检验', itp: true, pct: 5, count: 25, fpy: 82, docs: 95, accept: 89, sample: 68, alert: 'amber' },
    { stage: '结构制造', code: 'ST04', name: 'ST04-打砂', itp: true, pct: 3, count: 15, fpy: 86, docs: 94, accept: 91, sample: 54, alert: 'green' },
    { stage: '结构制造', code: 'ST05', name: 'ST05-底漆施工', itp: true, pct: 4, count: 20, fpy: 84, docs: 93, accept: 88, sample: 61, alert: 'amber' },
    { stage: '结构制造', code: 'ST06', name: 'ST06-防火施工', itp: true, pct: 5, count: 25, fpy: 81, docs: 92, accept: 86, sample: 64, alert: 'amber' },
    { stage: '结构制造', code: 'ST07', name: 'ST07-面漆施工', itp: true, pct: 6, count: 30, fpy: 79, docs: 91, accept: 84, sample: 57, alert: 'amber' },
    { stage: '结构制造', code: 'ST08', name: 'ST08-闭水试验', itp: true, pct: 4, count: 20, fpy: 76, docs: 90, accept: 82, sample: 50, alert: 'amber' },
    { stage: '装修施工', code: 'AR01', name: 'AR01-调平放线', itp: true, pct: 8, count: 40, fpy: 81, docs: 94, accept: 87, sample: 51, alert: 'amber' },
    { stage: '装修施工', code: 'AR02', name: 'AR02-天花折弯件安装', itp: true, pct: 12, count: 60, fpy: 74, docs: 92, accept: 82, sample: 72, alert: 'amber' },
    { stage: '装修施工', code: 'AR03', name: 'AR03-天花施工', itp: true, pct: 15, count: 75, fpy: 68, docs: 91, accept: 79, sample: 76, alert: 'amber' },
    { stage: '装修施工', code: 'AR04', name: 'AR04-墙板折弯件安装', itp: true, pct: 10, count: 50, fpy: 63, docs: 90, accept: 76, sample: 64, alert: 'amber' },
    { stage: '装修施工', code: 'AR05', name: 'AR05-墙板安装', itp: true, pct: 12, count: 60, fpy: 48, docs: 87, accept: 70, sample: 68, alert: 'red', reason: '平整度不符合要求' },
    { stage: '装修施工', code: 'AR06', name: 'AR06-装修终箱验收', itp: true, pct: 6, count: 30, fpy: 74, docs: 89, accept: 73, sample: 58, alert: 'red' },
    { stage: '装修施工', code: 'AR07', name: 'AR07-打包', itp: false, pct: 5, count: 25, fpy: 79, docs: 93, accept: 81, sample: 47, alert: 'amber' }
  ],
boxFlow: [
    { stage: '制造阶段', substage: '结构制造', code: 'ST01', name: 'ST01-箱体总装', pct: 3, count: 15, alert: 'green' },
    { stage: '制造阶段', substage: '结构制造', code: 'ST02', name: 'ST02-箱体总焊', pct: 2, count: 10, alert: 'green' },
    { stage: '制造阶段', substage: '结构制造', code: 'ST03', name: 'ST03-尺寸检验', pct: 3, count: 15, alert: 'amber' },
    { stage: '制造阶段', substage: '结构制造', code: 'ST04', name: 'ST04-打砂', pct: 3, count: 15, alert: 'green' },
    { stage: '制造阶段', substage: '结构制造', code: 'ST05', name: 'ST05-底漆施工', pct: 3, count: 15, alert: 'amber' },
    { stage: '制造阶段', substage: '结构制造', code: 'ST06', name: 'ST06-防火施工', pct: 3, count: 15, alert: 'amber' },
    { stage: '制造阶段', substage: '结构制造', code: 'ST07', name: 'ST07-面漆施工', pct: 3, count: 15, alert: 'amber' },
    { stage: '制造阶段', substage: '结构制造', code: 'ST08', name: 'ST08-闭水试验', pct: 3, count: 15, alert: 'amber' },
    { stage: '制造阶段', substage: '装修施工', code: 'AR01', name: 'AR01-调平放线', pct: 6, count: 30, alert: 'amber' },
    { stage: '制造阶段', substage: '装修施工', code: 'AR02', name: 'AR02-天花折弯件安装', pct: 8, count: 40, alert: 'amber' },
    { stage: '制造阶段', substage: '装修施工', code: 'AR03', name: 'AR03-天花施工', pct: 5, count: 25, alert: 'amber' },
    { stage: '制造阶段', substage: '装修施工', code: 'AR04', name: 'AR04-墙板折弯件安装', pct: 8, count: 40, alert: 'amber' },
    { stage: '制造阶段', substage: '装修施工', code: 'AR05', name: 'AR05-墙板安装', pct: 8, count: 40, alert: 'red' },
    { stage: '制造阶段', substage: '装修施工', code: 'AR06', name: 'AR06-装修终箱验收', pct: 5, count: 25, alert: 'red' },
    { stage: '制造阶段', substage: '装修施工', code: 'AR07', name: 'AR07-打包', pct: 4, count: 20, alert: 'amber' },
    { stage: '制造完成池', substage: '', code: 'MFG_DONE', name: '制造完成池', pct: 7, count: 35, alert: 'green' },
    { stage: '仓储阶段', substage: '', code: 'WAREHOUSE', name: '成品箱库', pct: 12, count: 60, alert: 'green' },
    { stage: '运输阶段', substage: '', code: 'IN_TRANSIT', name: '箱体在途运输', pct: 8, count: 40, alert: 'amber' },
    { stage: '运输阶段', substage: '', code: 'SIGNED', name: '箱体签收池', pct: 6, count: 30, alert: 'green' }
  ],
  boxRecords: [
    { flow: 'AR05', box: 'MOS-A02-023', station: '装修5线', workshop: '装修车间(双惠)', contractor: '双惠施工单位', dwell: '18小时' },
    { flow: 'AR05', box: 'MOS-A02-024', station: '装修5线', workshop: '装修车间(双惠)', contractor: '双惠施工单位', dwell: '12小时' },
    { flow: 'ST03', box: 'MOS-S01-008', station: '结构3线', workshop: '结构厂(博信)', contractor: '博信施工单位', dwell: '9小时' },
    { flow: 'WAREHOUSE', box: 'MOS-W01-012', station: '成品库A区', workshop: '仓储中心', contractor: '内部物流', dwell: '2天' },
    { flow: 'IN_TRANSIT', box: 'MOS-L01-007', station: '运输编组1', workshop: '物流中心', contractor: '运输单位A', dwell: '14小时' },
    { flow: 'SIGNED', box: 'MOS-D01-003', station: '项目交付点', workshop: '交付中心', contractor: '项目交付单位', dwell: '已签收' }
  ],
  workshops: [
    { group: '结构车间', name: '结构车间(本厂)', count: 86, fpy: 91, docs: 97, accept: 92, sample: 160, alert: 'green' },
    { group: '结构车间', name: '结构厂(辉翰)', count: 74, fpy: 88, docs: 95, accept: 89, sample: 146, alert: 'green' },
    { group: '结构车间', name: '结构厂(聚汇集)', count: 63, fpy: 82, docs: 93, accept: 86, sample: 124, alert: 'amber' },
    { group: '结构车间', name: '结构厂(南方新联)', count: 51, fpy: 78, docs: 91, accept: 81, sample: 112, alert: 'amber' },
    { group: '结构车间', name: '结构厂(博信)', count: 42, fpy: 71, docs: 88, accept: 76, sample: 98, alert: 'red' },
    { group: '装修车间', name: '装修车间(本厂)', count: 82, fpy: 84, docs: 95, accept: 88, sample: 152, alert: 'amber' },
    { group: '装修车间', name: '装修车间(龙翔)', count: 61, fpy: 79, docs: 92, accept: 83, sample: 118, alert: 'amber' },
    { group: '装修车间', name: '装修车间(双惠)', count: 41, fpy: 62, docs: 87, accept: 72, sample: 96, alert: 'red' }
  ],
  units: [
    { id: 'MOS-A02-023', state: '整改中', last: '2026-07-18 13:48', owner: '装修车间(双惠)', route: '装修施工 / AR05 墙板安装', reason: '平整度不符合要求', fixes: 4 },
    { id: 'MOS-A02-024', state: '待复验', last: '2026-07-18 12:20', owner: '装修车间(双惠)', route: '装修施工 / AR05 墙板安装', reason: '接缝宽度超差', fixes: 3 },
    { id: 'MOS-S01-008', state: '待验收', last: '2026-07-18 10:36', owner: '结构厂(博信)', route: '结构制造 / ST03 尺寸检验', reason: '焊缝外观不符合', fixes: 1 }
  ],
  risks: [
    { id:'R01', name:'FPY低风险', level:'red', target:'工序/车间', current:'48%', threshold:'<60%', action:'查看FPY趋势' },
    { id:'R02', name:'高返工风险', level:'red', target:'工序/车间', current:'46%', threshold:'>30%', action:'查看整改记录' },
    { id:'R03', name:'资料完整率不足', level:'amber', target:'车间', current:'87%', threshold:'<90%', action:'查看资料明细' },
    { id:'R04', name:'验收超期风险', level:'amber', target:'工序', current:'58小时', threshold:'>48小时', action:'查看待验收箱体' }
  ]
};
