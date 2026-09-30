/* 场景截图：把状态直接摆到特定界面，检查视觉效果。 node tests/shots.js [目录] [宽x高] */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const outDir = process.argv[2] || path.join(__dirname, '..', 'shots');
const [W, H] = (process.argv[3] || '1280x800').split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push((e.stack || e.message).split('\n').slice(0, 4).join(' <- ')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  const shot = async (n) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(outDir, `${W}x${H}-${n}.png`) }); };
  const setup = (fn, arg) => page.evaluate(fn, arg);

  // 商店
  await setup(() => {
    const run = XX.Run.create({ cls: 'alch', seed: 5, meta: XX.Meta.fresh() });
    XX.ui.setRun(run); run.gold = 420; run.relics.push('lingzhi', 'dinghai', 'yinlei'); run.node = { type: 'shop' }; run.shop = run.genShop(); run.phase = 'shop'; XX.ui.render();
  });
  await shot('shop');
  // Boss 战
  await setup(() => {
    const run = XX.Run.create({ cls: 'sword', seed: 9, meta: XX.Meta.fresh() });
    XX.ui.setRun(run); run.realm = 1; run.startBattle(['bloodfiend'], 'boss'); const b = run.battle; b.addStatus(b.enemies[0], 'vuln', 2); b.addStatus(b.player, 'str', 3); b.addStatus(b.player, 'thorns', 2); XX.ui.render();
  });
  await shot('boss');
  // 多敌人 + 法修相生高亮
  await setup(() => {
    const run = XX.Run.create({ cls: 'mage', seed: 3, meta: XX.Meta.fresh() });
    XX.ui.setRun(run); run.potions[0] = 'dulong'; run.potions[1] = 'huichun'; run.realm = 2; run.startBattle(['siren', 'scorpion', 'scorpion'], 'normal');
    const b = run.battle; b.hand = b.hand.slice(0, 0);
    ['wuxingjue', 'huoqiu', 'houtu', 'lieyan', 'bingzhui', 'shunshui', 'fentian'].forEach((id, i) => b.hand.push({ u: 800 + i, id, up: i === 3 }));
    b.lastEl = '木'; b.addStatus(b.enemies[1], 'poison', 5); b.addStatus(b.enemies[2], 'weak', 2); XX.ui.render();
  });
  await shot('mage-multi');
  await page.hover('.hand .card:nth-child(2)');
  await shot('mage-hover');
  // 选择目标模式
  await page.click('.hand .card:nth-child(2)', { force: true });
  await shot('target-mode');
  // 牌库弹窗 / 丹药弹窗
  await page.keyboard.press('Escape');
  await page.click('[data-act="deck"]'); await shot('deck-modal');
  await page.keyboard.press('Escape');
  await page.click('.tb-potions .potion:first-child', { force: true }); await shot('potion-modal');
  await page.keyboard.press('Escape');
  await page.click('[data-act="pile"][data-which="draw"]', { force: true }); await shot('pile-modal');
  // 化神终局 Boss
  await page.keyboard.press('Escape');
  await setup(() => {
    const run = XX.Run.create({ cls: 'body', seed: 4, meta: XX.Meta.fresh() });
    XX.ui.setRun(run); run.realm = 4; run.startBattle(['tribulation'], 'boss'); XX.ui.render();
  });
  await shot('final-boss');
  // 飞升结算
  await setup(() => {
    const run = XX.Run.create({ cls: 'body', seed: 4, meta: XX.Meta.fresh() });
    XX.ui.setRun(run); run.realm = 4; run.stats = { fights: 22, elites: 4, bosses: 5, floors: 35 }; run.win(); XX.ui.render();
  });
  await shot('victory');
  await browser.close();
  if (errors.length) { console.error('前端错误:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('OK', outDir);
})().catch((e) => { console.error(e.stack.split('\n').slice(0, 6).join('\n')); process.exit(1); });
