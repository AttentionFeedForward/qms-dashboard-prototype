import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const context = { window: {} };
vm.runInNewContext(await readFile(new URL('../process-demos/rockdale-route.js', import.meta.url), 'utf8'), context);
const data = JSON.parse(JSON.stringify(context.window.ROCKDALE_ROUTE));

test('imports all 62 process quantity pairs from the 156-box November 2 snapshot', () => {
  assert.equal(data.totalBoxes, 156);
  assert.equal(data.progressSource.snapshotDate, '2026-11-02');
  assert.equal(data.nodes.length, 62);
  const expected = {
    'ST-01': [121,121], 'ST-02': [120,120], 'ST-03': [116,116],
    'ST-03a': [120,120], 'ST-03b': [121,116], 'ST-04': [106,105],
    'ST-05': [86,86], 'ST-06': [73,71], 'ST-07': [68,66], 'ST-08': [59,59],
    'AR-01': [57,56], 'AR-02': [56,55], 'AR-03': [40,40], 'AR-04': [43,43],
    'AR-05': [37,36], 'AR-06': [34,32], 'AR-07': [31,30], 'AR-08': [18,17],
  };
  for (const n of data.nodes) {
    assert.deepEqual([n.reported,n.accepted], expected[n.id] ?? [0,0], n.id);
    assert.equal(new Set(n.records.map(r => r.box)).size, n.records.length, n.id + ' distinct boxes');
    assert.equal(n.records.filter(r => r.reportedAt).length, n.reported, n.id + ' reported records');
    assert.equal(n.records.filter(r => r.reportedAt && r.acceptedAt).length, n.accepted, n.id + ' accepted records');
    for (const r of n.records) {
      assert.ok(r.row >= 3 && r.row <= 158);
      assert.ok(r.reportedAt);
      assert.match(r.reportedAt, /^\d{4}\/\d{2}\/\d{2}-\d{2}:\d{2}:\d{2}$/);
      if (r.acceptedAt) assert.ok(r.acceptedAt >= r.reportedAt);
    }
  }
});

test('retains the workbook route topology and keeps counts separate from line roles', () => {
  assert.equal(data.mainSequence.length, 19);
  assert.equal(data.groups.length, 10);
  const branch = data.nodes.find(n => n.id === 'ST-03b');
  assert.equal(branch.lineKind, 'branch');
  const group = data.groups.find(g => g.id === branch.groupId);
  assert.equal(group.source, 'ST-01');
  assert.equal(group.target, 'ST-04');
  assert.equal(group.internalOrder, 'unspecified');
  assert.equal(data.nodes.find(n => n.id === 'AR-02').lineKind, 'branch');
});
