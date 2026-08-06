const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('../index.html', 'utf8');
const js = fs.readFileSync('../minimal-navigation.js', 'utf8');
const css = fs.readFileSync('../styles-minimal-navigation.css', 'utf8');

assert.ok(html.includes('styles-minimal-navigation.css'));
assert.ok(html.includes('minimal-navigation.js'));
assert.ok(html.indexOf('production-tabs.js') < html.indexOf('minimal-navigation.js'));
assert.ok(js.includes('01') && js.includes('PRODUCTION PROGRESS'));
assert.ok(js.includes('02') && js.includes('QUALITY INSPECTION'));
assert.ok(js.includes('nav-context-copy'));
assert.ok(js.includes("productionTabs?.classList.add('minimal-subtabs')"));
assert.ok(js.includes("qualityTabs?.classList.add('minimal-subtabs')"));
assert.ok(css.includes('.view-pane > .section-head') && css.includes('display: none'));
assert.ok(css.includes('border-radius: 0'));
assert.ok(css.includes('transform: scaleX(1)'));

console.log('PASS 一级标题导航与二级无框下划线分页符合确认方案');
