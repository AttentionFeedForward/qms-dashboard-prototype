const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('../index.html', 'utf8');
const js = fs.readFileSync('../production-tabs.js', 'utf8');
const css = fs.readFileSync('../styles-production-tabs.css', 'utf8');

assert.ok(html.includes('styles-production-tabs.css'));
assert.ok(html.includes('production-tabs.js'));
assert.ok(js.includes("label: '箱体制造进度图'"));
assert.ok(js.includes("label: '当前箱体分布图'"));
assert.ok(js.includes('activateProductionPane'));
assert.ok(js.includes("panel.classList.add('production-pane')"));
assert.ok(css.includes('.production-pane') && css.includes('display: none'));
assert.ok(css.includes('.production-pane.active') && css.includes('display: block'));

console.log('PASS 生产进度看板两个板块使用二级标签单视图切换');
