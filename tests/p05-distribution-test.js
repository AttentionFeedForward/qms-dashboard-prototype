const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = {window: {}};
vm.runInNewContext(fs.readFileSync('../p05-data.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('../p05-quality-data.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('../data.js', 'utf8'), context);

const p05 = context.window.QMS_P05_DISTRIBUTION;
const dashboard = context.window.QMS_V2;
const app = fs.readFileSync('../app.js', 'utf8');
const html = fs.readFileSync('../index.html', 'utf8');
const styles = fs.readFileSync('../styles.css', 'utf8');

const check = (name, test) => {
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
};

check('P05项目箱体总量为1764', () => {
  assert.strictEqual(p05.totalBoxes, 1764);
  assert.strictEqual(dashboard.projects.find((item) => item.id === 'p05').units, 1764);
});

check('P05制造路线包含Excel中的17道工序', () => {
  const processes = p05.boxFlow.filter((node) => node.stage === '制造阶段');
  assert.strictEqual(processes.length, 17);
  for (const code of ['ST01', 'ST02', 'ST03', 'ST04', 'ST05', 'ST06', 'ST07', 'ST08', 'ST09', 'ST10', 'AR01', 'AR02', 'AR03', 'AR04', 'AR05', 'AR06', 'AR07']) {
    assert.ok(processes.some((node) => node.code === code), `缺少${code}`);
  }
});

check('最靠后完成工序加下一顺序工序的分布合计1764箱', () => {
  const manufacturing = p05.boxFlow.filter((node) => node.dataStatus === 'available');
  assert.strictEqual(manufacturing.reduce((sum, node) => sum + node.count, 0), 1764);
  assert.strictEqual(p05.boxRecords.length, 1764);
  const uniqueBoxes = new Set(p05.boxRecords.map((row) => row.box));
  assert.strictEqual(uniqueBoxes.size, 1764);
});

check('AR07完成后进入制造完成池', () => {
  const pool = p05.boxFlow.find((node) => node.code === 'MFG_DONE');
  assert.strictEqual(pool.count, 629);
});

check('仓储和运输节点显示暂无数据', () => {
  for (const code of ['WAREHOUSE', 'IN_TRANSIT', 'SIGNED']) {
    const node = p05.boxFlow.find((item) => item.code === code);
    assert.strictEqual(node.dataStatus, 'unavailable');
    assert.strictEqual(node.count, null);
    assert.strictEqual(node.pct, null);
  }
  assert.ok(app.includes("'暂无数据'"));
});

check('页面先加载P05分布数据', () => {
  assert.ok(html.includes('<script src="p05-data.js"></script><script src="p05-quality-data.js"></script><script src="data.js"></script>'));
  assert.strictEqual(dashboard.projectDistributions.p05, p05);
});


check('P05车间分配符合指定比例', () => {
  const structural = new Map();
  const decoration = new Map();
  for (const row of p05.boxRecords) {
    structural.set(row.structureWorkshop, (structural.get(row.structureWorkshop) ?? 0) + 1);
    decoration.set(row.decorationWorkshop, (decoration.get(row.decorationWorkshop) ?? 0) + 1);
  }
  assert.deepStrictEqual(
    Object.fromEntries(structural),
    {
      '结构车间(本厂)': 1344,
      '结构厂(辉翰)': 168,
      '结构厂(聚汇集)': 168,
      '结构厂(南方新联)': 67,
      '结构厂(博信)': 17,
    },
  );
  assert.deepStrictEqual(
    Object.fromEntries(decoration),
    {'装修车间(本厂)': 882, '装修车间(龙翔)': 882},
  );
});

check('同一箱体结构与装修工位固定且阶段切换后不同', () => {
  const structureStations = new Set();
  const decorationStations = new Set();
  for (const row of p05.boxRecords) {
    assert.match(row.structureStation, /^\d{3,4}$/);
    assert.match(row.decorationStation, /^\d{3,4}$/);
    assert.notStrictEqual(row.structureStation, row.decorationStation);
    structureStations.add(row.structureStation);
    decorationStations.add(row.decorationStation);
    const expectedWorkshop = row.flow.startsWith('ST')
      ? row.structureWorkshop
      : row.decorationWorkshop;
    const expectedStation = row.flow.startsWith('ST')
      ? row.structureStation
      : row.decorationStation;
    assert.strictEqual(row.workshop, expectedWorkshop);
    assert.strictEqual(row.station, expectedStation);
  }
  assert.strictEqual(structureStations.size, 1764);
  assert.strictEqual(decorationStations.size, 1764);
  assert.ok(structureStations.has('001'));
  assert.ok(decorationStations.has('001'));
});

check('施工单位和停留时间格式符合要求', () => {
  for (const row of p05.boxRecords) {
    assert.strictEqual(row.contractor, '/');
    assert.match(row.dwell, /^(\/|\d+天\d+小时)$/);
  }
});

check('P05抽屉全量展示且列顺序正确', () => {
  assert.ok(app.includes("project().id==='p05'?node.count:Math.min(3,node.count)"));
  assert.ok(app.includes('<span>箱体编号</span><span>车间</span><span>工位</span><span>施工单位</span><span>停留时间</span>'));
  assert.ok(app.includes('<span>${x.box}</span><span>${x.workshop}</span><span>${x.station}</span><span>${x.contractor}</span><span>${x.dwell}</span>'));
  assert.ok(styles.includes('overflow-x:hidden'));
  assert.ok(styles.includes('position:sticky'));
});

console.log(`\nP05 distribution tests completed${process.exitCode ? ' with failures' : ' successfully'}.`);
