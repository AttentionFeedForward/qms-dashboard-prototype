"""Exercise route scope, two phase rows, workshop search, details and XLSX export."""
import json,sys
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,parse_qs
from playwright.sync_api import sync_playwright,expect
from openpyxl import load_workbook

url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8788/.sites-checkout/public/dashboard/index.html'
delivery=Path(__file__).resolve().parents[2]
checks=[]
def address(query):
    parts=urlsplit(url)
    return urlunsplit((parts.scheme,parts.netloc,parts.path,query,''))
def no_node_overlap(frame):
    overlaps=frame.locator('#graph').evaluate('''root => {
      const nodes=[...root.querySelectorAll('.node')].map(e=>({id:e.dataset.node,r:e.getBoundingClientRect()})),bad=[];
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i],b=nodes[j];if(Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1)bad.push([a.id,b.id]);
      }return bad;
    }''')
    assert not overlaps,overlaps

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1484,'height':1000},accept_downloads=True)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('https://cdn.jsdelivr.net/**',lambda route:route.abort())
    response=page.goto(address('project=rd&production=route'),wait_until='domcontentloaded')
    assert response.status==200,response.status
    frame=page.frame_locator('#processRouteFrame')
    expect(frame.locator('#routeSelect')).to_have_value('RD-R01')
    assert page.locator('#viewTabs strong').all_text_contents()==['进度看板','质检看板']
    assert page.locator('#productionTabs button').all_text_contents()==['制造进度图','工序验收进度表','当前箱体分布图']
    expect(frame.locator('#routeScopeSummary strong')).to_have_text('156')
    expect(frame.locator('[data-node="ST-01"]')).to_have_attribute('data-reported','121')
    expect(frame.locator('[data-node="ST-01"]')).to_have_attribute('data-accepted','121')
    assert float(frame.locator('[data-node="ST-02"] .node-top>span').first.evaluate('(e)=>getComputedStyle(e).fontSize').removesuffix('px'))>=14
    phase=frame.locator('#graph').evaluate('''root=>Object.fromEntries([...root.querySelectorAll('[data-phase-label]')].map(e=>[e.dataset.phaseLabel,e.offsetTop]))''')
    assert phase['AR']>phase['ST']+250,phase
    no_node_overlap(frame)
    frame.locator('.route-filters').scroll_into_view_if_needed()
    page.screenshot(path=str(delivery/'nov26-two-row-verified.png'),full_page=True)
    checks.append('navigation, original counts, larger codes and separate phase rows')

    frame.locator('#routeSelect').select_option('RD-R02')
    expect(frame.locator('#routeScopeSummary strong')).to_have_text('3')
    expect(frame.locator('[data-node="ST-01"]')).to_have_attribute('data-reported','3')
    expect(frame.locator('[data-node="ST-01"]')).to_have_attribute('data-accepted','3')
    expect(page.locator('#manufacturingTimestamp')).to_contain_text('样箱')
    assert parse_qs(urlsplit(page.url).query)['route']==['RD-R02']
    frame.locator('[data-node="ST-01"]').press('Enter')
    expect(page.locator('#drawer')).to_have_css('transform','none')
    expect(page.locator('[data-box-count]')).to_have_text('3')
    assert page.locator('.pbd-table tbody th').all_text_contents()==['YX-001','YX-002','YX-003']
    with page.expect_download() as info:page.locator('[data-box-export]').click()
    export=delivery/'nov26-sample-export.xlsx';info.value.save_as(str(export))
    workbook=load_workbook(export,read_only=True,data_only=True)
    assert [row[1] for row in list(workbook.worksheets[0].values)[1:]]==['YX-001','YX-002','YX-003']
    criteria=dict(list(workbook.worksheets[1].values)[1:])
    assert criteria['工艺路线']=='RD-R02 样箱',criteria
    page.locator('#closeDrawer').click()

    frame.locator('#workshopSearch').fill('结构二车间')
    expect(frame.locator('.scope-match')).to_have_text('车间匹配 1 台')
    expect(frame.locator('[data-node="ST-01"]')).to_have_attribute('data-accepted','1')
    assert frame.locator('[data-phase-label="AR"]').count()==0
    page.reload(wait_until='domcontentloaded')
    frame=page.frame_locator('#processRouteFrame')
    expect(frame.locator('#routeSelect')).to_have_value('RD-R02')
    expect(frame.locator('#workshopSearch')).to_have_value('结构二车间')
    expect(page.locator('#manufacturingTimestamp')).to_contain_text('样箱')
    frame.locator('[data-node="ST-01"]').press('Enter')
    expect(page.locator('[data-box-count]')).to_have_text('1')
    assert page.locator('.pbd-table tbody th').all_text_contents()==['YX-002']
    with page.expect_download() as info:page.locator('[data-box-export]').click()
    export=delivery/'nov26-workshop-export.xlsx';info.value.save_as(str(export))
    workbook=load_workbook(export,read_only=True,data_only=True)
    exported_rows=list(workbook.worksheets[0].values)
    assert len(exported_rows)==2 and exported_rows[1][1]=='YX-002',exported_rows
    assert dict(list(workbook.worksheets[1].values)[1:])['路线车间筛选']=='结构二车间'
    page.locator('#closeDrawer').click()
    frame.locator('#workshopSearch').fill('不存在的车间')
    expect(frame.locator('.route-no-results')).to_be_visible()
    frame.locator('[data-clear-workshop]').click()
    expect(frame.locator('#workshopSearch')).to_have_value('')
    expect(frame.locator('[data-node="ST-01"]')).to_have_attribute('data-accepted','3')
    checks.append('sample route, workshop quantities, refresh persistence and isolated Excel exports')

    branch=frame.locator('#graph').evaluate('()=>window.QMS_ROUTE_CATALOG.getRoute("RD-R02").groups[0].members[0]')
    frame.locator('#search').fill(branch);frame.locator('#search').press('Enter')
    expect(frame.locator('[data-node="'+branch+'"]')).to_be_visible()
    frame.locator('#expandAll').click()
    expect(frame.locator('[data-node]')).to_have_count(62)
    no_node_overlap(frame)
    frame.locator('#collapseAll').click()
    frame.locator('#routeSelect').select_option('RD-R01')
    expect(frame.locator('[data-node="ST-01"]')).to_have_attribute('data-accepted','121')
    page.locator('#productionTabs button[data-production-view="manufacturing"]').click()
    expect(page.locator('#manufacturingTimestamp')).to_contain_text('标准工艺路线')
    expect(page.locator('[data-rd-process="ST-01"]')).to_contain_text('121 箱')
    checks.append('search, branch expansion without overlaps and acceptance-view route context')

    for width in [623,390,320]:
        page.set_viewport_size({'width':width,'height':900})
        page.goto(address('project=rd&production=route&route=RD-R02'),wait_until='domcontentloaded')
        frame=page.frame_locator('#processRouteFrame')
        expect(frame.locator('#routeSelect')).to_have_value('RD-R02')
        expect(frame.locator('body')).to_have_attribute('data-orientation','vertical')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        frame.locator('[data-node="ST-01"]').press('Enter')
        expect(page.locator('#drawer')).to_have_css('transform','none')
        metrics=page.locator('#drawer').evaluate('''drawer=>{const table=drawer.querySelector('.pbd-table-wrap');return {width:drawer.getBoundingClientRect().width,scroll:drawer.scrollWidth,client:drawer.clientWidth,tableScroll:table.scrollWidth,tableClient:table.clientWidth}}''')
        assert abs(metrics['width']-min(560,width*.92))<1,metrics
        assert metrics['scroll']<=metrics['client']+1 and metrics['tableScroll']<=metrics['tableClient']+1,metrics
        expect(page.locator('[data-box-count]')).to_have_text('3')
        if width==390:page.screenshot(path=str(delivery/'nov26-mobile-drawer.png'))
    checks.append('phone layout and MOS-width drawers without horizontal overflow')
    page.set_viewport_size({'width':1484,'height':1000})
    page.goto(address('project=mos&production=manufacturing'),wait_until='domcontentloaded')
    expect(page.locator('.manufacturing-panel')).to_have_class('dashboard-panel manufacturing-panel production-pane active')
    assert page.locator('#manufacturingProgress [data-production-process]').count()>0
    page.locator('#productionTabs button[data-production-view="distribution"]').click()
    expect(page.locator('.distribution-panel')).to_have_class('dashboard-panel distribution-panel production-pane active')
    page.locator('#viewTabs button[data-view="quality"]').click()
    expect(page.locator('.view-pane[data-view="quality"]')).to_have_class('view-pane active')
    checks.append('MOS progress, distribution and quality navigation remain accessible')
    assert not errors,errors
    result={'url':url,'checks':checks,'errors':errors}
    (delivery/'nov26-browser-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True))
    browser.close()
