const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = {window: {}};
vm.runInNewContext(fs.readFileSync('../p05-data.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('../p05-quality-data.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('../data.js', 'utf8'), context);

const quality = context.window.QMS_P05_QUALITY;
const dashboard = context.window.QMS_V2;
const app = fs.readFileSync('../app.js', 'utf8');
const html = fs.readFileSync('../index.html', 'utf8');

const check = (name, test) => {
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
};

const expectedProcesses = [
  'ST01-箱体总装',
  'ST02-箱体总焊',
  'ST03-打磨及焊缝探伤',
  'ST04-尺寸检验',
  'ST05-打砂',
  'ST06-底漆施工',
  'ST07-防火施工',
  'ST08-面漆施工',
  'ST09-闭水试验',
  'ST10-结构终箱验收',
  'AR01-调平放线',
  'AR02-折弯件安装(天花)',
  'AR03-天花安装',
  'AR04-折弯件安装(墙板)',
  'AR05-墙板安装',
  'AR06-门框安装',
  'AR07-装修终箱验收',
];

check('P05工序名称和数量完全来自质量Excel', () => {
  assert.strictEqual(quality.process.length, 17);
  assert.strictEqual(
    JSON.stringify(quality.process.map((item) => item.name)),
    JSON.stringify(expectedProcesses),
  );
  assert.strictEqual(quality.sourceMeta.sourceRows, 15127);
  assert.strictEqual(quality.sourceMeta.uniqueBoxes, 1764);
  assert.strictEqual(quality.sourceMeta.uniqueBoxProcesses, 15093);
});

check('仅ST01和ST02为非ITP工序', () => {
  const nonItp = quality.process.filter((item) => !item.itp).map((item) => item.code);
  const itp = quality.process.filter((item) => item.itp).map((item) => item.code);
  assert.strictEqual(JSON.stringify(nonItp), JSON.stringify(['ST01', 'ST02']));
  assert.strictEqual(itp.length, 15);
  for (const code of ['ST03', 'ST10', 'AR01', 'AR07']) {
    assert.ok(itp.includes(code));
  }
});

check('非ITP取自检FPY，ITP取专检FPY', () => {
  for (const item of quality.process) {
    if (item.itp) {
      assert.strictEqual(item.metrics.fpy, item.metrics.special, item.code);
    } else {
      assert.strictEqual(item.metrics.fpy, item.metrics.self, item.code);
    }
  }
  assert.strictEqual(quality.process.find((item) => item.code === 'ST01').count, 1441);
  assert.strictEqual(quality.process.find((item) => item.code === 'AR07').count, 628);
});

check('资料和三检缺失使用null且不伪造数据', () => {
  for (const item of quality.process) {
    assert.strictEqual(item.docs, null);
    assert.strictEqual(item.metrics.reportDocs, null);
    assert.strictEqual(item.metrics.selfDocs, null);
    assert.strictEqual(item.metrics.specialDocs, null);
    assert.strictEqual(item.metrics.three, null);
  }
  assert.strictEqual(quality.overall.metrics.three, null);
  assert.strictEqual(quality.overall.metrics.reportDocs, null);
});

check('验收完成率使用已到达工序箱体作为分母', () => {
  for (const item of quality.process) {
    assert.ok(item.count <= item.reached, `${item.code}完成数超过已到达数`);
    assert.strictEqual(item.accept, Number((item.count / item.reached * 100).toFixed(1)));
  }
});

check('日周月趋势均生成且包含样本信息', () => {
  for (const period of ['day', 'week', 'month']) {
    const points = quality.overall.trends[period].fpy;
    assert.ok(points.length > 0, `${period}无FPY趋势`);
    for (const point of points) {
      assert.ok(typeof point.value === 'number');
      assert.ok(point.denominator > 0);
      assert.strictEqual(point.sample, point.denominator);
    }
  }
});

check('P05质量数据接入工序表且车间仍使用现有数据', () => {
  assert.strictEqual(dashboard.projectQuality.p05, quality);
  assert.ok(app.includes('const processData = () => qualityData()?.process || d.process'));
  assert.ok(app.includes('const rows=processData().filter'));
  assert.ok(app.includes('const rows=d.workshops.filter'));
  assert.strictEqual(dashboard.workshops.length, 8);
});

check('页面按正确顺序加载P05两个数据文件', () => {
  assert.ok(
    html.includes(
      '<script src="p05-data.js"></script><script src="p05-quality-data.js"></script><script src="data.js"></script>',
    ),
  );
});

check('缺失资料不参与亮灯且趋势支持真实分子分母', () => {
  assert.ok(app.includes('isNumber(item.docs)&&item.docs<90'));
  assert.ok(app.includes('资料完整率暂无数据，不参与亮灯'));
  assert.ok(app.includes('point.numerator'));
  assert.ok(app.includes('point.denominator'));
});

console.log(`\nP05 quality tests completed${process.exitCode ? ' with failures' : ' successfully'}.`);
