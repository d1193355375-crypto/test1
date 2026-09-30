/* 端到端：用真实浏览器点击 DOM 通关流程，收集错误并截图。
   用法：node tests/e2e.js [截图目录] [视口宽x高，默认 1280x800] [职业]
   需要全局安装 playwright（NODE_PATH 指向全局 node_modules）。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const outDir = process.argv[2] || path.join(__dirname, '..', 'shots');
const [W, H] = (process.argv[3] || '1280x800').split('x').map(Number);
const CLS = process.argv[4] || 'sword';
fs.mkdirSync(outDir, { recursive: true });
const url = 'file://' + path.join(__dirname, '..', process.env.GAME_FILE || 'index.html');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.addInitScript(() => { try { if (!localStorage.getItem('xianxia.meta.v1')) localStorage.setItem('xianxia.meta.v1', JSON.stringify({ dao: 300, lv: { mage: 1, alch: 1 }, runs: 0, wins: 0, maxAsc: 5, bestRealm: 0 })); } catch (e) {} });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message).split('\n').slice(0, 5).join(' <- ')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: path.join(outDir, `${W}x${H}-${name}.png`) }); };
  const click = async (sel) => { await page.dispatchEvent(sel, 'click', undefined, { timeout: 3000 }); };
  const phase = () => page.evaluate(() => (XX.ui.run ? XX.ui.run.phase : null));
  const seen = new Set();
  const snap = async (key) => { if (!seen.has(key)) { seen.add(key); await shot(key); } };

  await shot('01-title');
  await click('[data-act="new"]');
  await shot('02-select');
  await click(`[data-act="pick-class"][data-cls="${CLS}"]`);
  await click('[data-act="start"]');
  await snap('03-map');

  let steps = 0;
  while (steps++ < 600) {
    const ph = await phase();
    globalThis.__ph = ph;
    if (ph === 'over') break;
    await snap('phase-' + ph);
    if (ph === 'map') {
      const nodes = await page.$$('.node.avail');
      if (!nodes.length) throw new Error('map has no available node');
      await nodes[Math.floor(Math.random() * nodes.length)].click();
    } else if (ph === 'battle') {
      // 玩若干张牌，然后结束回合
      for (let k = 0; k < 8; k++) {
        const st = await page.evaluate(() => { const b = XX.ui.run.battle; return b ? { over: b.phase === 'over', mine: b.phase === 'player' && !XX.ui.ui.busy } : { over: true, mine: false }; });
        if (st.over || !st.mine) break;
        const cards = await page.$$('.hand .card:not(.dim)');
        if (!cards.length) break;
        await cards[Math.floor(Math.random() * cards.length)].dispatchEvent('click');
        const tgt = await page.$('.enemy.targetable:not(.dead)');
        if (tgt) await tgt.dispatchEvent('click');
        await page.waitForTimeout(60);
        if (k === 2) await snap('battle-mid');
      }
      const can = await page.evaluate(() => XX.ui.run.battle && XX.ui.run.battle.phase === 'player' && !XX.ui.ui.busy);
      if (can) await page.dispatchEvent('[data-act="end"]', 'click');
      // 等待敌方行动结束
      for (let w = 0; w < 60; w++) {
        const s = await page.evaluate(() => { const r = XX.ui.run; return r.phase !== 'battle' || (r.battle && r.battle.phase === 'player' && !XX.ui.ui.busy); });
        if (s) break;
        await page.waitForTimeout(150);
      }
    } else if (ph === 'reward') {
      const c = await page.$('[data-act="rw-card"]'); if (c) await c.click();
      const p = await page.$('[data-act="rw-potion"]:not([disabled])'); if (p) await p.click();
      const r = await page.$('[data-act="rw-relic"]:not([disabled])'); if (r) await r.click();
      await page.waitForTimeout(80);
      await click('[data-act="rw-leave"]');
    } else if (ph === 'shop') { await page.waitForTimeout(100); await click('[data-act="shop-leave"]'); }
    else if (ph === 'rest') { await click(Math.random() < 0.5 ? '[data-act="rest-heal"]' : '[data-act="rest-up"]'); }
    else if (ph === 'event') {
      const has = await page.evaluate(() => !!XX.ui.run.event.outcome);
      if (has) await click('[data-act="ev-go"]');
      else { const opts = await page.$$('[data-act="ev-choice"]:not([disabled])'); await opts[opts.length - 1].click(); }
    } else if (ph === 'chest') { await click('[data-act="chest-open"]'); await snap('chest-open'); await click('[data-act="chest-leave"]'); }
    else if (ph === 'pick') {
      const cards = await page.$$('[data-act="pick-card"]');
      if (cards.length) { await cards[0].click(); await page.waitForTimeout(50); await snap('pick-sel'); await click('[data-act="pick-ok"]'); } else await click('[data-act="pick-skip"]');
    } else if (ph === 'cards') { await click('[data-act="offer"]'); }
    else if (ph === 'breakthrough') { await snap('breakthrough'); await click('[data-act="bt"]'); }
    else throw new Error('unexpected phase ' + ph);
    if (errors.length) break;
  }
  if (steps >= 600) {
    const dbg = await page.evaluate(() => { const r = XX.ui.run; const b = r.battle; return { phase: r.phase, realm: r.realm, hp: r.hp, node: r.node && r.node.type, battle: b && { phase: b.phase, turn: b.turn, energy: b.energy, hand: b.hand.map((c) => c.id), busy: XX.ui.ui.busy, enemies: b.enemies.map((e) => e.id + ':' + e.hp) } }; });
    console.error('卡住:', JSON.stringify(dbg));
    await shot('stuck');
  }
  if (errors.length) { console.error('发现前端错误:\n' + [...new Set(errors)].join('\n')); await shot('error'); await browser.close(); process.exit(1); }
  const final = await page.evaluate(() => ({ phase: XX.ui.run.phase, realm: XX.ui.run.realm, outcome: XX.ui.run.outcome, hp: XX.ui.run.hp, floors: XX.ui.run.stats.floors }));
  await snap('over');
  // 传承、玩法弹窗
  await click('[data-act="title"]'); await click('[data-act="meta"]'); await shot('meta');
  await click('[data-act="title"]'); await click('[data-act="help"]'); await shot('help');
  console.log('结果:', JSON.stringify(final), '步数:', steps);
  await browser.close();
  if (errors.length) { console.error('发现前端错误:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('无前端错误。截图目录:', outDir);
})().catch((e) => { console.error('E2E 失败(阶段 ' + globalThis.__ph + '):', e.stack.split('\n').slice(0, 6).join('\n')); process.exit(1); });
