"""RD-only acceptance summary, metric toggle, route drilldown and compact layout."""
import json,re,sys
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
from playwright.sync_api import sync_playwright,expect

url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8788/.sites-checkout/public/dashboard/index.html'
baseline=sys.argv[2] if len(sys.argv)>2 else 'http://127.0.0.1:8788/rd-only-baseline-v18/index.html'
delivery=Path(__file__).resolve().parents[2]
def address(base,project,view='manufacturing'):
    parts=urlsplit(base)
    return urlunsplit((parts.scheme,parts.netloc,parts.path,'project='+project+'&production='+view,''))
def snapshot(page):
    return page.evaluate('''()=>{
      const selectors=['#viewTabs','#productionTabs','#summaryRow','#manufacturingProgress','#manufacturingTimestamp','#qualityTabs','#processTable','#workshopTable'];
      const content=Object.fromEntries(selectors.map(selector=>[selector,document.querySelector(selector)?.outerHTML]));
      const card=document.querySelector('.manufacturing-card'),s=getComputedStyle(card),r=card.getBoundingClientRect();
      return {content,card:{width:Math.round(r.width*100)/100,height:Math.round(r.height*100)/100,font:s.fontSize,color:s.color,background:s.backgroundColor,padding:s.padding}};
    }''')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    context=browser.new_context(viewport={'width':1484,'height':1000})
    context.route('https://cdn.jsdelivr.net/**',lambda route:route.abort())
    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(address(url,'rd'),wait_until='domcontentloaded')
    assert page.locator('#viewTabs strong').all_text_contents()==['模块箱体进度看板','模块箱体质检看板']
    expect(page.locator('#manufacturingTimestamp')).to_contain_text('全部工艺路线')
    expect(page.locator('#manufacturingTimestamp')).to_contain_text('159 箱')
    first=page.locator('[data-rd-process="ST-01"]');fourth=page.locator('[data-rd-process="ST-04"]')
    expect(first).to_have_attribute('data-total-boxes','159');expect(first).to_have_attribute('data-completed','124')
    expect(fourth).to_have_attribute('data-completed','108');expect(fourth.locator('.rd-card-stats')).to_contain_text('67.9%')
    page.locator('[data-rd-metric="reported"]').click()
    expect(page.locator('[data-rd-metric="reported"]')).to_have_attribute('aria-pressed','true')
    expect(fourth).to_have_attribute('data-completed','109');expect(fourth.locator('.rd-card-stats')).to_contain_text('68.6%')
    page.locator('[data-rd-metric="accepted"]').click();expect(fourth).to_have_attribute('data-completed','108')
    page.locator('.manufacturing-group').first.screenshot(path=str(delivery/'rd-aggregate-cards.png'))
    fourth.click();expect(page.locator('#drawer')).to_have_css('transform','none')
    expect(page.locator('.route-overall>div').first).to_contain_text(re.compile(r'159\s*箱'))
    expect(page.locator('.rd-route-breakdown button')).to_have_count(2)
    page.locator('[data-rd-route-target="RD-R02"]').click()
    expect(page.locator('.process-route-panel')).to_have_class('dashboard-panel process-route-panel production-pane active')
    frame=page.frame_locator('#processRouteFrame')
    expect(frame.locator('#routeSelect')).to_have_value('RD-R02')
    expect(frame.locator('[data-node="ST-04"]')).to_have_class(re.compile(r'\bselected\b'))
    expect(frame.locator('#routeScopeSummary strong')).to_have_text('3')
    layout=frame.locator('#graph').evaluate('''graph=>{
      const controls=['#routeSelectTrigger','#workshopSearch','#search','#routeScopeSummary'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,center:r.top+r.height/2}});
      const links=[...graph.querySelectorAll('.edge.main')].filter(e=>e.dataset.from.startsWith('ST-')&&e.dataset.to.startsWith('AR-'));
      const searches=['#workshopSearch','#search'].map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {height:r.height,font:s.font,border:s.border,background:s.backgroundColor,type:e.type}});
      const actionsOutside=['#expandAll','#collapseAll','#layoutMode'].every(selector=>!document.querySelector(selector).closest('.route-tools'));
      return {height:graph.offsetHeight,toolsHeight:document.querySelector('.route-tools').offsetHeight,controls,stageLinks:links.length,searches,actionsOutside,phaseButtons:document.querySelectorAll('[data-phase]').length};
    }''')
    assert layout['height']<600,layout
    assert layout['toolsHeight']<=64,layout
    centers=[item['center'] for item in layout['controls']];assert max(centers)-min(centers)<2,layout
    assert layout['stageLinks']==0,layout
    assert layout['searches'][0]==layout['searches'][1],layout
    assert layout['actionsOutside'] and layout['phaseButtons']==0,layout
    frame.locator('#routeSelectTrigger').click();frame.locator('#routeOptions [data-value="RD-R01"]').click()
    frame.locator('.route-tools').scroll_into_view_if_needed()
    page.screenshot(path=str(delivery/'rd-compact-manufacturing.png'),full_page=True)
    frame.locator('#expandAll').click();expect(frame.locator('.node')).to_have_count(62)
    clipped=frame.locator('.branch-group.is-open').evaluate_all('''groups=>groups.flatMap(group=>{
      const b=group.getBoundingClientRect();return [...group.querySelectorAll('.node')].filter(node=>{const r=node.getBoundingClientRect();return r.bottom>b.bottom+1||r.right>b.right+1||r.left<b.left-1;}).map(node=>node.dataset.node);
    })''')
    assert not clipped,clipped
    frame.locator('#layoutMode').select_option('vertical')
    columns=frame.locator('#graph').evaluate('''graph=>{
      const phases=Object.fromEntries([...graph.querySelectorAll('[data-phase-label]')].map(e=>[e.dataset.phaseLabel,{x:e.offsetLeft,y:e.offsetTop}]));
      const nodes=[...graph.querySelectorAll('.node')].map(e=>({id:e.dataset.node,r:e.getBoundingClientRect()})),overlaps=[];
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];if(Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1)overlaps.push([a.id,b.id]);}
      return {phases,overlaps};
    }''')
    assert columns['phases']['AR']['x']>columns['phases']['ST']['x']+80,columns
    assert abs(columns['phases']['AR']['y']-columns['phases']['ST']['y'])<1,columns
    assert not columns['overlaps'],columns
    frame.locator('#collapseAll').click()
    frame.locator('#search').fill('AR-08');frame.locator('#search').press('Enter')
    expect(frame.locator('[data-node="AR-08"]')).to_have_class(re.compile(r'\bselected\b'))
    frame.locator('.route-tools').scroll_into_view_if_needed()
    page.screenshot(path=str(delivery/'rd-vertical-two-columns.png'))
    page.locator('#productionTabs button[data-production-view="manufacturing"]').click()
    expect(first).to_have_attribute('data-total-boxes','159');expect(first).to_have_attribute('data-completed','124')

    projects=page.locator('#projectSelect option').evaluate_all("items=>items.map(e=>e.value).filter(value=>value!=='rd')")
    compared=[]
    if baseline!='skip':
        old=context.new_page();old.on('pageerror',lambda error:errors.append('baseline: '+str(error)))
        for project in projects:
            old.goto(address(baseline,project),wait_until='domcontentloaded')
            page.goto(address(url,project),wait_until='domcontentloaded')
            before,after=snapshot(old),snapshot(page)
            assert before==after,{'project':project,'changedSelectors':[key for key in before['content'] if before['content'][key]!=after['content'][key]],'beforeCard':before['card'],'afterCard':after['card']}
            page.locator('#projectSelect').select_option('rd')
            page.locator('#projectSelect').select_option(project)
            old.locator('#projectSelect').select_option('rd')
            old.locator('#projectSelect').select_option(project)
            switched_before,switched_after=snapshot(old),snapshot(page)
            assert switched_after==switched_before,{'project':project,'changedAfterSwitch':[key for key in switched_before['content'] if switched_before['content'][key]!=switched_after['content'][key]],'beforeCard':switched_before['card'],'afterCard':switched_after['card']}
            compared.append(project)
        old.close()
    else:
        for project in projects:
            page.goto(address(url,project),wait_until='domcontentloaded')
            assert page.locator('[data-rd-metric]').count()==0
            assert page.locator('#viewTabs strong').all_text_contents()==['进度看板','质检看板']
            compared.append(project)
    for width in [623,390,320]:
        page.set_viewport_size({'width':width,'height':900})
        page.goto(address(url,'rd'),wait_until='domcontentloaded')
        expect(page.locator('[data-rd-process="ST-01"]')).to_have_attribute('data-completed','124')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        page.locator('[data-rd-metric="reported"]').click()
        expect(page.locator('[data-rd-process="ST-04"]')).to_have_attribute('data-completed','109')
    assert not errors,errors
    result={'url':url,'aggregate':'159 total; ST-01 124 completed; ST-04 report 109 / acceptance 108','layout':layout,'unchangedOtherProjects':compared,'pageErrors':errors}
    (delivery/'rd-only-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True))
    browser.close()
