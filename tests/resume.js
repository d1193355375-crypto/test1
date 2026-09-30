/* 存档/继续：刷新页面后从地图存档恢复；战斗中刷新回到进入节点之前。 */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = 'file://' + path.join(__dirname, '..', process.env.GAME_FILE || 'index.html');
  const fail = (m) => { console.error('✗ ' + m); process.exit(1); };
  const snap = () => page.evaluate(() => { const r = XX.ui.run; return JSON.stringify({ hp: r.hp, gold: r.gold, deck: r.deck.map((c) => c.id + c.up), relics: r.relics, cur: r.cur, path: r.path, rng: r.rng.s, map: r.map, realm: r.realm }); });
  await page.goto(url);
  if (await page.$('[data-act="continue"]')) fail('全新环境不应出现继续按钮');
  await page.dispatchEvent('[data-act="new"]', 'click');
  await page.dispatchEvent('[data-act="start"]', 'click');
  const s0 = await snap();
  // 进入战斗并打赢，回到地图
  await page.click('.node.avail');
  await page.waitForFunction(() => XX.ui.run.phase === 'battle');
  await page.evaluate(() => { const b = XX.ui.run.battle; b.enemies.forEach((e) => b.hurt(e, 9999, b.player, {})); b.checkWin(); XX.ui.run.finishBattle(); XX.ui.render(); });
  await page.waitForFunction(() => XX.ui.run.phase === 'reward', null, { timeout: 5000 });
  await page.dispatchEvent('[data-act="rw-skip"]', 'click');
  await page.dispatchEvent('[data-act="rw-leave"]', 'click');
  await page.waitForFunction(() => XX.ui.run.phase === 'map');
  const s1 = await snap();
  if (s0 === s1) fail('打完一场战斗后状态应有变化');
  // 刷新 → 继续
  await page.reload();
  await page.dispatchEvent('[data-act="continue"]', 'click');
  const s2 = await snap();
  if (s1 !== s2) fail('刷新后继续，状态与存档前不一致');
  console.log('✓ 地图存档在刷新后完整恢复（含随机数状态与地图）');
  // 进入战斗后刷新：回到进入节点之前
  await page.click('.node.avail');
  await page.waitForFunction(() => XX.ui.run.phase === 'battle' || XX.ui.run.phase !== 'map');
  await page.reload();
  await page.dispatchEvent('[data-act="continue"]', 'click');
  const s3 = await snap();
  if (s3 !== s1) fail('战斗中刷新后应回到进入节点之前的存档');
  console.log('✓ 战斗/节点中途刷新回到进入前的存档');
  // 陨落后存档被清除
  await page.dispatchEvent('[data-act="menu"]', 'click');
  await page.dispatchEvent('[data-act="abandon"]', 'click');
  if (!(await page.$('[data-act="abandon-yes"]'))) fail('放弃此世应弹出页内确认框');
  await page.dispatchEvent('[data-act="modal-close"]', 'click');
  if ((await page.evaluate(() => XX.ui.run.phase)) === 'over') fail('取消确认后不应结束本世');
  await page.dispatchEvent('[data-act="menu"]', 'click');
  await page.dispatchEvent('[data-act="abandon"]', 'click');
  await page.dispatchEvent('[data-act="abandon-yes"]', 'click');
  if ((await page.evaluate(() => XX.ui.run.phase)) !== 'over') fail('确认放弃后应进入结算');
  await page.reload();
  if (await page.$('[data-act="continue"]')) fail('陨落后不应再有可继续的存档');
  console.log('✓ 陨落后存档被清除，道果已结算');
  const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('xianxia.meta.v1')));
  if (!(meta.runs === 1 && meta.dao > 0)) fail('传承数据未正确保存: ' + JSON.stringify(meta));
  await browser.close();
  if (errors.length) fail('前端错误: ' + errors.join('; '));
  console.log('存档流程全部通过');
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
