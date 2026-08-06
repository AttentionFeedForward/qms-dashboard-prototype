const fs=require('fs');const vm=require('vm');const assert=require('assert');
const app=fs.readFileSync('../app.js','utf8');const css=fs.readFileSync('../styles.css','utf8');const c={window:{}};vm.runInNewContext(fs.readFileSync('../data.js','utf8'),c);const d=c.window.QMS_V2;
const check=(n,fn)=>{try{fn();console.log('PASS '+n)}catch(e){console.error('FAIL '+n+': '+e.message);process.exitCode=1}};
check('每行10个固定宽度工序卡片',()=>{assert.ok(css.includes('repeat(10,128px)'));assert.ok(css.includes('grid-auto-rows:108px'));});
check('制造仓储运输阶段顺序完整',()=>{for(const x of ['制造阶段','仓储阶段','运输阶段'])assert.ok(app.includes(x));assert.ok(app.indexOf('制造阶段')<app.indexOf('仓储阶段')&&app.indexOf('仓储阶段')<app.indexOf('运输阶段'));});
check('三个池使用浅色卡片',()=>{assert.ok(app.includes('pool-light'));for(const x of ['MFG_DONE','WAREHOUSE','SIGNED'])assert.ok(d.boxFlow.some(n=>n.code===x));});
check('所有工序与池比例合计100%',()=>assert.strictEqual(d.boxFlow.reduce((s,x)=>s+x.pct,0),100));
console.log(`\nDistribution layout tests completed${process.exitCode?' with failures':' successfully'}.`);
