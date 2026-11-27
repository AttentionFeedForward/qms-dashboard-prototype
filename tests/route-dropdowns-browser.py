"""All three route dropdowns use matching in-page panels anchored below the input."""
import json,sys
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
from playwright.sync_api import sync_playwright,expect

url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8788/.sites-checkout/public/dashboard/index.html'
parts=urlsplit(url);address=urlunsplit((parts.scheme,parts.netloc,parts.path,'project=rd&production=route',''))
delivery=Path(__file__).resolve().parents[2]
def panel_geometry(frame,field,list_id):
    return frame.locator('#'+field).evaluate('''(input,listId)=>{
      const list=document.getElementById(listId),panel=list.parentElement,a=input.getBoundingClientRect(),b=panel.getBoundingClientRect(),s=getComputedStyle(panel);
      return {inputBottom:a.bottom,panelTop:b.top,panelLeft:b.left,panelRight:b.right,viewport:innerWidth,height:b.height,color:s.backgroundColor,radius:s.borderRadius,scroll:list.scrollHeight>list.clientHeight};
    }''',list_id)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1484,'height':900})
    page.route('https://cdn.jsdelivr.net/**',lambda route:route.abort())
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(url,wait_until='domcontentloaded');expect(page.locator('#projectSelect')).to_have_value('rd')
    page.goto(address,wait_until='domcontentloaded');frame=page.frame_locator('#processRouteFrame')
    expect(frame.locator('#routeSelect')).to_have_value('RD-R01')
    styles=[]
    for field,list_id in [('routeSelectTrigger','routeOptions'),('workshopSearch','workshopOptions'),('search','processOptions')]:
        assert frame.locator('#'+field).get_attribute('list') is None
        frame.locator('#'+field).click()
        expect(frame.locator('#'+list_id)).to_be_visible()
        expect(frame.locator('#'+field)).to_have_attribute('aria-expanded','true')
        geometry=panel_geometry(frame,field,list_id)
        assert geometry['panelTop']>=geometry['inputBottom']+6,geometry
        assert geometry['height']<=276 and geometry['panelLeft']>=0 and geometry['panelRight']<=geometry['viewport'],geometry
        assert geometry['color']=='rgb(255, 255, 255)' and geometry['radius']=='12px',geometry
        styles.append(geometry)
        frame.locator('#'+field).press('Escape')
        expect(frame.locator('#'+list_id)).to_be_hidden()
    assert frame.locator('#routeSelect').is_hidden()
    frame.locator('#routeSelectTrigger').click()
    frame.locator('#routeOptions [data-value="RD-R02"]').click()
    expect(frame.locator('#routeSelectTrigger')).to_have_value('样箱 · 3 台')
    expect(frame.locator('#routeScopeSummary strong')).to_have_text('3')
    expect(frame.locator('[data-node="ST-01"]')).to_have_attribute('data-accepted','3')
    frame.locator('#routeSelectTrigger').click();frame.locator('#routeSelectTrigger').press('Enter')
    expect(frame.locator('#routeSelectTrigger')).to_have_value('标准工艺路线 · 156 箱')
    expect(frame.locator('#routeScopeSummary strong')).to_have_text('156')
    frame.locator('#search').click()
    expect(frame.locator('#processOptions [role="option"]')).to_have_count(62)
    assert panel_geometry(frame,'search','processOptions')['scroll']
    assert frame.locator('#processOptions [data-value="ST-01"] .route-combobox-label').inner_text()=='箱体总装'
    page.screenshot(path=str(delivery/'rd-process-dropdown-below.png'))
    frame.locator('#processOptions [data-value="ST-02"]').click()
    expect(frame.locator('#search')).to_have_value('ST-02')
    expect(frame.locator('[data-node="ST-02"]')).to_have_class(__import__('re').compile(r'\bselected\b'))
    expect(frame.locator('#processOptions')).to_be_hidden()

    frame.locator('#workshopSearch').click()
    frame.locator('#workshopOptions [data-value="结构一车间"]').click()
    expect(frame.locator('.scope-match')).to_contain_text('41')
    expect(frame.locator('#workshopOptions')).to_be_hidden()
    frame.locator('#search').click()
    expect(frame.locator('#processOptions [role="option"]')).to_have_count(10)
    frame.locator('#search').fill('不存在的工序')
    expect(frame.locator('#processOptions .route-combobox-empty')).to_have_text('没有匹配结果')
    frame.locator('#search').press('Escape')
    frame.locator('#workshopSearch').fill('')
    expect(frame.locator('[data-phase-label="AR"]')).to_be_visible()
    frame.locator('#search').fill('箱体验焊')
    expect(frame.locator('#processOptions [role="option"]')).to_have_count(1)
    frame.locator('#search').press('Enter')
    expect(frame.locator('#search')).to_have_value('ST-02')
    frame.locator('#search').fill('');frame.locator('#search').press('ArrowDown');frame.locator('#search').press('Enter')
    expect(frame.locator('#search')).to_have_value('ST-02')

    page.set_viewport_size({'width':1484,'height':600})
    frame.locator('#search').press('Escape');frame.locator('#search').click()
    expect(frame.locator('#processOptions')).to_be_visible()
    page.wait_for_timeout(100)
    bounds=frame.locator('#processOptions').bounding_box();assert bounds['y']+bounds['height']<=601,bounds
    frame.locator('#search').press('Escape')
    for width in [390,320]:
        page.set_viewport_size({'width':width,'height':900});page.goto(address,wait_until='domcontentloaded');frame=page.frame_locator('#processRouteFrame')
        for field,list_id in [('routeSelectTrigger','routeOptions'),('workshopSearch','workshopOptions'),('search','processOptions')]:
            frame.locator('#'+field).click();expect(frame.locator('#'+list_id)).to_be_visible()
            geometry=panel_geometry(frame,field,list_id)
            assert geometry['panelTop']>=geometry['inputBottom']+6 and geometry['panelRight']<=geometry['viewport'] and geometry['panelLeft']>=0,geometry
            if width==390 and field=='search':page.screenshot(path=str(delivery/'rd-dropdown-mobile.png'))
            frame.locator('#'+field).press('Escape')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    spacing=[]
    for width in [1484,1024,623,390,320]:
        page.set_viewport_size({'width':width,'height':1000});page.goto(address,wait_until='domcontentloaded');frame=page.frame_locator('#processRouteFrame')
        frame.locator('#layoutMode').select_option('vertical')
        geometry=frame.locator('#graph').evaluate('''graph=>{
          const [st,ar]=['ST','AR'].map(phase=>graph.querySelector('[data-phase-label="'+phase+'"]').getBoundingClientRect());
          const g=graph.getBoundingClientRect(),vp=document.querySelector('#viewport');
          return {gap:ar.left-st.right-16,left:st.left-g.left-8,right:g.right-ar.right-8,graph:g.width,viewport:vp.clientWidth};
        }''')
        assert 16<=geometry['gap']<=112 and abs(geometry['left']-geometry['right'])<1,geometry
        assert geometry['graph']<=geometry['viewport']+1,geometry
        frame.locator('#expandAll').click()
        overlaps=frame.locator('#graph').evaluate('''graph=>{
          const nodes=[...graph.querySelectorAll('.node')].map(e=>({id:e.dataset.node,r:e.getBoundingClientRect()})),bad=[];
          for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];if(Math.min(a.r.right,b.r.right)>Math.max(a.r.left,b.r.left)+1&&Math.min(a.r.bottom,b.r.bottom)>Math.max(a.r.top,b.r.top)+1)bad.push([a.id,b.id]);}
          return bad;
        }''')
        assert not overlaps,overlaps
        frame.locator('#collapseAll').click();frame.locator('.route-tools').scroll_into_view_if_needed()
        if width in [1484,623,390]:page.screenshot(path=str(delivery/('rd-spaced-vertical-'+str(width)+'.png')))
        spacing.append({'width':width,**geometry})
    assert spacing[0]['gap']>spacing[-1]['gap']
    assert not errors,errors
    result={'url':url,'defaultProject':'rd','dropdowns':styles,'direction':'below','pointerAndKeyboard':'passed','mobileWidths':[390,320],'verticalSpacing':spacing,'errors':errors}
    (delivery/'rd-dropdown-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True));browser.close()
