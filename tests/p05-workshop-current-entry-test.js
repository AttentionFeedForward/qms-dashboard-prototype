const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('../index.html', 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);

assert.ok(html.includes('<script src="p05-data.js"></script><script src="p05-quality-data.js"></script><script src="data.js"></script>'));
assert.ok(scripts.indexOf('data.js') < scripts.indexOf('p05-workshop-quality-data.js'));
assert.ok(scripts.indexOf('p05-workshop-quality-data.js') < scripts.indexOf('app.js'));
assert.ok(scripts.indexOf('app.js') < scripts.indexOf('p05-workshop-integration.js'));
assert.ok(scripts.indexOf('p05-workshop-integration.js') < scripts.indexOf('two-board-integration.js'));
assert.ok(html.includes('id="workshopTable"') && html.includes('id="workshopRanking"'));

console.log('PASS 当前index.html已接入P05车间质量数据和两级看板交互脚本');
