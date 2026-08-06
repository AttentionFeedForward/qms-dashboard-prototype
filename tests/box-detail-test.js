const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const app=fs.readFileSync('../app.js','utf8');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('../data.js','utf8'),context);
const data=context.window.QMS_V2;
const check=(name,fn)=>{try{fn();console.log(`PASS ${name}`)}catch(error){console.error(`FAIL ${name}: ${error.message}`);process.exitCode=1}};

check('箱体编号按项目使用四位流水号',()=>{
  assert.ok(app.includes("if(project().id==='mos') return 'MOS'"));
  assert.ok(app.includes("if(project().id==='p05') return 'P05'"));
  assert.ok(app.includes("padStart(4,'0')"));
});
check('MOS工位使用三位数字编号且P05使用源数据',()=>{
  assert.ok(app.includes("String(i+1).padStart(3,'0')"));
  assert.ok(app.includes("source.station||'/'"));
});
check('制造阶段车间名称复用看板三清单',()=>{
  assert.ok(app.includes("node.substage==='结构制造'?'结构车间'"));
  assert.ok(app.includes("node.substage==='装修施工'?'装修车间'"));
  assert.strictEqual(data.workshops.filter(x=>x.group==='结构车间').length,5);
  assert.strictEqual(data.workshops.filter(x=>x.group==='装修车间').length,3);
});
check('施工单位缺失时以斜杠展示',()=>{
  assert.ok(app.includes("source.contractor||'/'"));
  assert.ok(app.includes(":'/'"));
});
check('流水号按节点占比连续分配且不超过项目箱体总量',()=>{
  const pct=data.boxFlow.reduce((sum,x)=>sum+x.pct,0);
  assert.strictEqual(pct,100);
  for(const project of data.projects){
    const lastStart=Math.round(project.units*(100-data.boxFlow.at(-1).pct)/100)+1;
    assert.ok(lastStart<=project.units);
  }
});

console.log(`\nBox detail tests completed${process.exitCode?' with failures':' successfully'}.`);
