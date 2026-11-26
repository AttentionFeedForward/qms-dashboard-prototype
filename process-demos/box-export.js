/* Small dependency-free XLSX writer. Strings remain strings, including box IDs. */
(() => {
  'use strict';
  const encoder = new TextEncoder();
  const xml = value => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const crcTable = Array.from({length:256},(_,index) => {let c = index;for (let bit = 0;bit < 8;bit++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1;return c >>> 0;});
  function crc32(bytes) {let crc = 0xffffffff;for (const byte of bytes) crc = crcTable[(crc^byte)&255] ^ crc >>> 8;return (crc^0xffffffff) >>> 0;}
  function join(chunks) {const bytes = new Uint8Array(chunks.reduce((sum,item) => sum+item.length,0));let offset = 0;for (const chunk of chunks) {bytes.set(chunk,offset);offset += chunk.length;}return bytes;}
  function zip(entries) {
    const locals = [],central = [];let offset = 0;
    for (const [name,text] of entries) {
      const filename = encoder.encode(name),data = encoder.encode(text),crc = crc32(data);
      const header = new Uint8Array(30+filename.length),view = new DataView(header.buffer);
      view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(12,33,true);view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,filename.length,true);header.set(filename,30);
      locals.push(header,data);
      const record = new Uint8Array(46+filename.length),directory = new DataView(record.buffer);
      directory.setUint32(0,0x02014b50,true);directory.setUint16(4,20,true);directory.setUint16(6,20,true);directory.setUint16(14,33,true);directory.setUint32(16,crc,true);directory.setUint32(20,data.length,true);directory.setUint32(24,data.length,true);directory.setUint16(28,filename.length,true);directory.setUint32(42,offset,true);record.set(filename,46);central.push(record);offset += header.length+data.length;
    }
    const directory = join(central),end = new Uint8Array(22),view = new DataView(end.buffer);
    view.setUint32(0,0x06054b50,true);view.setUint16(8,entries.length,true);view.setUint16(10,entries.length,true);view.setUint32(12,directory.length,true);view.setUint32(16,offset,true);
    return join([...locals,directory,end]);
  }
  const stringCell = (address,value,style = 2) => '<c r="'+address+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
  const numberCell = (address,value,style = 2) => '<c r="'+address+'" s="'+style+'"><v>'+value+'</v></c>';
  function dateCell(address,value) {
    const ms = window.QMS_PROCESS_BOXES.timestampMs(value);
    return ms === null ? stringCell(address,'') : numberCell(address,(ms-Date.UTC(1899,11,30))/86400000,3);
  }
  function worksheet(rows,widths,freeze = true) {
    const columns = widths.map((width,index) => '<col min="'+(index+1)+'" max="'+(index+1)+'" width="'+width+'" customWidth="1"/>').join('');
    return declaration+'<worksheet xmlns="'+namespace+'"><sheetViews><sheetView workbookViewId="0">'+(freeze?'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>':'')+'</sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>'+columns+'</cols><sheetData>'+rows.map((cells,index) => '<row r="'+(index+1)+'"'+(index === 0?' ht="26" customHeight="1"':'')+'>'+cells.join('')+'</row>').join('')+'</sheetData>'+(freeze?'<autoFilter ref="A1:F'+rows.length+'"/>':'')+'</worksheet>';
  }
  function createWorkbook(rows,context = {}) {
    const headings = ['序号','箱号','所在车间','报验通过时间','自检通过时间','质检通过时间'];
    const data = [headings.map((value,index) => stringCell(String.fromCharCode(65+index)+'1',value,1)),...rows.map((row,index) => {
      const n = index+2;
      return [numberCell('A'+n,index+1),stringCell('B'+n,row.box),stringCell('C'+n,row.workshop),dateCell('D'+n,row.reportedPassedAt),dateCell('E'+n,row.selfPassedAt),dateCell('F'+n,row.qualityPassedAt)];
    })];
    const periodNames = {day:'日累计',week:'最近一周',month:'最近一月',custom:'自定义区间'};
    const criteria = [['筛选条件','内容'],['项目',context.project || ''],['工艺路线',[context.routeId,context.route].filter(Boolean).join(' ')],['路线车间筛选',context.scopeWorkshop || '全部车间'],['工序',(context.nodeId || '')+' '+(context.nodeName || '')],['所在车间',context.workshop === 'all' ? '全部车间' : context.workshop || '全部车间'],['搜索箱号',context.query || ''],['统计方式',periodNames[context.period] || ''],['开始时间',context.start || '项目开始'],['结束时间',context.end || ''],['导出箱体数量',String(rows.length)],['导出时间',context.exportedAt || '']];
    const metadata = criteria.map((row,index) => row.map((value,column) => stringCell((column?'B':'A')+(index+1),value,index?2:1)));
    const styles = declaration+'<styleSheet xmlns="'+namespace+'"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17343E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD5E2E7"/></left><right style="thin"><color rgb="FFD5E2E7"/></right><top style="thin"><color rgb="FFD5E2E7"/></top><bottom style="thin"><color rgb="FFD5E2E7"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    return zip([
      ['[Content_Types].xml',declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels',declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml',declaration+'<workbook xmlns="'+namespace+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="箱号明细" sheetId="1" r:id="rId1"/><sheet name="筛选条件" sheetId="2" r:id="rId2"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels',declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml',worksheet(data,[8,20,22,25,25,25])],['xl/worksheets/sheet2.xml',worksheet(metadata,[22,58],false)],['xl/styles.xml',styles]
    ]);
  }
  function download(rows,context = {}) {
    const bytes = createWorkbook(rows,context),blob = new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob),link = document.createElement('a');
    const name = [context.project || 'QMS',context.routeId,context.nodeId || '工序','箱号明细',(context.exportedAt || '').replace(/\D/g,'')].filter(Boolean).join('_').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,180);
    link.href = url;link.download = name+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  window.QMS_BOX_EXPORT = {createWorkbook,download};
})();
