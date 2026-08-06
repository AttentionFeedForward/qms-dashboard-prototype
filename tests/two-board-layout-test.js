const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('../index.html', 'utf8');
const css = fs.readFileSync('../styles-two-board.css', 'utf8');
const integration = fs.readFileSync('../two-board-integration.js', 'utf8');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('../p05-production-data.js', 'utf8'), context);
const production = context.window.QMS_P05_PRODUCTION;

assert.strictEqual((html.match(/data-view="production"/g) || []).length, 2);
assert.strictEqual((html.match(/data-view="quality"/g) || []).length, 2);
assert.ok(html.includes('manufacturingTimestamp') && html.includes('distributionTimestamp'));
assert.strictEqual(production.processes.length, 17);
assert.ok(production.processes.every(item => ['结构制造', '装修施工'].includes(item.stage)));
assert.ok(production.processes.every(item => !['MFG_DONE', 'WAREHOUSE', 'IN_TRANSIT', 'SIGNED'].includes(item.code)));
for (const item of production.processes) {
  for (const period of ['day', 'week', 'month']) {
    assert.ok(Array.isArray(item.trends[period]) && item.trends[period].length > 0);
    assert.strictEqual(item.trends[period].at(-1).count, item.count);
  }
}
assert.ok(integration.includes('较昨日') && integration.includes('累计完成数量趋势'));
assert.ok(integration.includes('patchDistribution'));
assert.ok(css.includes('#distribution .dist-stage-title > b') && css.includes('display: none !important'));
assert.ok(html.indexOf('p05-production-data.js') < html.indexOf('app.js'));
assert.ok(html.indexOf('p05-workshop-integration.js') < html.indexOf('two-board-integration.js'));

console.log('PASS 两级看板结构、制造累计趋势和分布数量口径验证通过');
