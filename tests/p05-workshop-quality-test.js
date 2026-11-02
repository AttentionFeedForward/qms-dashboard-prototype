const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = {window: {}};
vm.runInNewContext(fs.readFileSync('../p05-data.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('../p05-quality-data.js', 'utf8'), context);
vm.runInNewContext(
  fs.readFileSync('../p05-workshop-quality-data.js', 'utf8'),
  context,
);

const distribution = context.window.QMS_P05_DISTRIBUTION;
const quality = context.window.QMS_P05_QUALITY;
const workshops = context.window.QMS_P05_WORKSHOP_QUALITY.workshops;
const index = fs.readFileSync('../index.html', 'utf8');
const integration = fs.readFileSync('../p05-workshop-integration.js', 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

test('P05展示5个结构车间和2个装修车间', () => {
  assert.strictEqual(workshops.length, 7);
  assert.strictEqual(workshops.filter(x => x.group === '结构车间').length, 5);
  assert.strictEqual(workshops.filter(x => x.group === '装修车间').length, 2);
});

test('车间分配箱数与P05箱号数据一致', () => {
  const expected = {
    '结构车间(本厂)': 1344,
    '结构厂(辉翰)': 168,
    '结构厂(聚汇集)': 168,
    '结构厂(南方新联)': 67,
    '结构厂(博信)': 17,
    '装修车间(本厂)': 882,
    '装修车间(龙翔)': 882,
  };
  for (const [name, count] of Object.entries(expected)) {
    assert.strictEqual(
      workshops.find(item => item.name === name).assignedBoxes,
      count,
    );
  }
  assert.strictEqual(distribution.boxRecords.length, 1764);
});

test('累计完成箱数对应箱体跨出责任阶段', () => {
  assert.strictEqual(
    workshops
      .filter(x => x.group === '结构车间')
      .reduce((sum, x) => sum + x.count, 0),
    793,
  );
  assert.strictEqual(
    workshops
      .filter(x => x.group === '装修车间')
      .reduce((sum, x) => sum + x.count, 0),
    629,
  );
});

test('车间验收完成箱次与已到达箱次勾稽项目总计', () => {
  assert.strictEqual(
    workshops.reduce((sum, x) => sum + x.completedProcessBoxes, 0),
    quality.overall.completedProcessBoxes,
  );
  assert.strictEqual(
    workshops.reduce((sum, x) => sum + x.reachedProcessBoxes, 0),
    quality.overall.reachedProcessBoxes,
  );
});

test('车间FPY样本完整覆盖项目FPY样本', () => {
  assert.strictEqual(
    workshops.reduce((sum, x) => sum + x.metricSamples.fpy.sample, 0),
    quality.overall.metricSamples.fpy.sample,
  );
});

test('资料指标不伪造且不产生样本', () => {
  for (const item of workshops) {
    assert.strictEqual(item.docs, null);
    assert.strictEqual(item.metrics.reportDocs, null);
    assert.strictEqual(item.metricSamples.reportDocs.sample, 0);
  }
});

test('所有车间生成日周月趋势和亮灯结果', () => {
  for (const item of workshops) {
    assert.ok(item.trends.day.fpy.length > 0);
    assert.ok(item.trends.week.fpy.length > 0);
    assert.ok(item.trends.month.fpy.length > 0);
    assert.ok(['red', 'amber', 'green'].includes(item.alert));
  }
});

test('入口脚本加载顺序正确', () => {
  const scripts = [...index.matchAll(/<script src="([^"]+)"/g)]
    .map(match => match[1]);
  assert.ok(
    scripts.indexOf('p05-quality-data.js')
      < scripts.indexOf('p05-workshop-quality-data.js'),
  );
  assert.ok(
    scripts.indexOf('data.js')
      < scripts.indexOf('p05-workshop-quality-data.js'),
  );
  assert.ok(scripts.indexOf('data.js') < scripts.indexOf('app.js'));
  assert.ok(
    scripts.indexOf('app.js')
      < scripts.indexOf('p05-workshop-integration.js'),
  );
});

test('集成脚本支持项目切换、资料缺失和排名样本量', () => {
  assert.ok(integration.includes("projectSelect.value === 'p05'"));
  assert.ok(integration.includes("docsCell.textContent = '--'"));
  assert.ok(integration.includes('样本量：${metricSample(item, key)}'));
  assert.ok(integration.includes('dashboard.workshops ='));
});

if (!process.exitCode) {
  console.log('\nP05 workshop quality verification completed successfully.');
}
