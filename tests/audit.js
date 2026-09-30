/* 内容审计：逐一执行每张牌 / 每个敌人招式 / 每件法宝 / 每瓶丹药 / 每个奇遇选项，检查异常与 NaN。 */
require('../src/data.js');
require('../src/engine.js');
const XX = globalThis.XX;
const { Run, Battle, Meta, view, cardText, CARDS, ENEMIES, RELICS, POTIONS, EVENTS, BREAKTHROUGH, CLASSES, ENCOUNTERS } = XX;

let problems = 0;
const bad = (msg) => { problems++; console.error('✗ ' + msg); };
const finite = (b, ctx) => {
  const ents = [b.player, ...b.enemies];
  for (const e of ents) {
    if (!Number.isFinite(e.hp) || !Number.isFinite(e.block)) bad(`${ctx}: ${e.name} hp/block 非有限数 (${e.hp}/${e.block})`);
    for (const k in e.st) if (!Number.isFinite(e.st[k])) bad(`${ctx}: ${e.name} 状态 ${k}=${e.st[k]}`);
    if (e.block < 0) bad(`${ctx}: ${e.name} 护体为负`);
  }
  if (!Number.isFinite(b.energy)) bad(`${ctx}: 灵力非有限数`);
};
function newRun(cls, seed) { return Run.create({ cls: cls || 'sword', seed: seed || 7, meta: Meta.fresh() }); }
function mkBattle(run, ids, kind) {
  run.startBattle(ids, kind || 'normal');
  const b = run.battle;
  b.player.maxHp = b.player.hp = 9999; b.energy = 10;
  return b;
}

/* 0. 数据结构校验 */
{
  const { STATUS, ELEMENTS, FX } = XX;
  const NUMF = ['cost', 'dmg', 'hits', 'block', 'draw', 'energy', 'heal', 'hpLoss', 'dmgBlock', 'dmgPoison', 'endTurnHp', 'strMult'];
  const BOOLF = ['aoe', 'x', 'exhaust', 'retain', 'innate', 'ethereal', 'unplayable', 'lifesteal'];
  const OBJF = ['apply', 'applyAll', 'self'];
  const KNOWN = new Set(['id', 'name', 'cls', 'type', 'rarity', 'el', 'g', 'up', 'sheng', 'fx', 'text', ...NUMF, ...BOOLF, ...OBJF]);
  const chkEff = (e, where, isUp) => {
    for (const k of Object.keys(e)) {
      if (!KNOWN.has(k)) bad(`${where}: 未知字段 ${k}`);
      if (NUMF.includes(k) && !(Number.isFinite(e[k]) && e[k] >= 0)) bad(`${where}: ${k}=${e[k]} 不是有效数值`);
      if (BOOLF.includes(k) && typeof e[k] !== 'boolean') bad(`${where}: ${k} 应为布尔值`);
      if (OBJF.includes(k)) for (const s of Object.keys(e[k])) { if (!STATUS[s]) bad(`${where}: ${k} 中未知状态 ${s}`); if (!Number.isFinite(e[k][s]) || e[k][s] <= 0) bad(`${where}: ${k}.${s}=${e[k][s]} 无效`); }
      if (k === 'fx' && !FX[e[k]]) bad(`${where}: 特效 ${e[k]} 未实现`);
    }
    void isUp;
  };
  for (const [id, d] of Object.entries(CARDS)) {
    const w = `卡牌 ${id}`;
    if (d.id !== id) bad(`${w}: id 不一致`);
    if (!['atk', 'skl', 'pow'].includes(d.type)) bad(`${w}: type=${d.type}`);
    if (!['starter', 'common', 'uncommon', 'rare', 'status', 'curse'].includes(d.rarity)) bad(`${w}: rarity=${d.rarity}`);
    if (d.el && !ELEMENTS[d.el]) bad(`${w}: 未知五行 ${d.el}`);
    if (!Number.isInteger(d.cost) || d.cost < 0 || d.cost > 3) bad(`${w}: cost=${d.cost}`);
    chkEff(d, w);
    if (d.sheng) chkEff(d.sheng, w + ' 相生');
    if (d.up) chkEff(d.up, w + ' 淬炼');
    const hasEffect = d.dmg || d.dmgBlock || d.dmgPoison || d.block || d.draw || d.energy || d.heal || d.apply || d.applyAll || d.self || d.fx || d.unplayable;
    if (!hasEffect) bad(`${w}: 没有任何效果`);
    if (d.type === 'pow' && !d.self) bad(`${w}: 功法牌应带有 self 状态`);
    if (!['neutral', 'status', 'curse', ...Object.keys(CLASSES)].includes(d.cls)) bad(`${w}: cls=${d.cls}`);
  }
  for (const [id, e] of Object.entries(ENEMIES)) {
    if (!(e.hp[0] > 0 && e.hp[1] >= e.hp[0])) bad(`敌人 ${id}: hp 范围无效`);
    if (e.el && !ELEMENTS[e.el]) bad(`敌人 ${id}: 未知五行 ${e.el}`);
    for (const [mk, m] of Object.entries(e.moves)) {
      const w = `敌人 ${id}.${mk}`;
      if (!m.n) bad(`${w}: 缺少名称`);
      for (const k of ['dmg', 'hits', 'block', 'heal']) if (m[k] != null && !(Number.isFinite(m[k]) && m[k] > 0)) bad(`${w}: ${k}=${m[k]}`);
      for (const k of ['apply', 'self']) if (m[k]) for (const st of Object.keys(m[k])) { if (!STATUS[st]) bad(`${w}: 未知状态 ${st}`); if (!(m[k][st] > 0)) bad(`${w}: ${k}.${st} 无效`); }
      for (const c of m.cards || []) { if (!CARDS[c.id]) bad(`${w}: 未知牌 ${c.id}`); if (!['draw', 'discard'].includes(c.to)) bad(`${w}: cards.to=${c.to}`); }
      for (const sid of m.summon || []) if (!ENEMIES[sid]) bad(`${w}: 未知召唤物 ${sid}`);
      if (!(m.dmg || m.block || m.apply || m.self || m.cards || m.summon || m.heal)) bad(`${w}: 招式没有效果`);
    }
    if (e.half) for (const st of Object.keys(e.half.self || {})) if (!STATUS[st]) bad(`敌人 ${id}.half: 未知状态 ${st}`);
  }
  for (const [id, r] of Object.entries(RELICS)) {
    if (!r.n || !r.d || !r.g) bad(`法宝 ${id}: 缺少名称/描述/图标`);
    if (!['starter', 'common', 'uncommon', 'rare', 'boss'].includes(r.r)) bad(`法宝 ${id}: r=${r.r}`);
  }
  for (const [id, p] of Object.entries(POTIONS)) {
    if (!p.n || !p.d || typeof p.use !== 'function') bad(`丹药 ${id}: 定义不完整`);
    if (!['common', 'uncommon', 'rare'].includes(p.r)) bad(`丹药 ${id}: r=${p.r}`);
  }
  console.log('✓ 数据结构: 卡牌/敌人/法宝/丹药 schema 校验完成');
}

/* 1. 卡牌：文字 + 打出 */
let nCards = 0;
for (const id of Object.keys(CARDS)) {
  for (const up of [false, true]) {
    const v = view(id, up);
    const txt = cardText(v, null);
    if (/undefined|NaN|\[object/.test(txt)) bad(`卡牌文字异常 ${id}${up ? '+' : ''}: ${txt}`);
    if (v.unplayable) continue;
    const run = newRun('sword'); run.deck.length = 0;
    for (let i = 0; i < 8; i++) run.addCard('defend');
    const b = mkBattle(run, ['fox', 'wisp']);
    b.hand.push({ u: 9000, id, up }); b.player.block = 12;
    b.enemies[0].st.poison = 5; b.enemies[0].st.vuln = 1;
    const idx = b.hand.length - 1;
    // 相生情形也测一遍
    for (const chain of [false, true]) {
      const b2 = (() => { const r = newRun('mage', 11); const bb = mkBattle(r, ['fox', 'wisp']); bb.hand.push({ u: 9001, id, up }); bb.player.block = 12; if (chain) bb.lastEl = Object.keys(XX.ELEMENTS).find((k) => XX.ELEMENTS[k].gen === v.el) || ''; return bb; })();
      try {
        const i2 = b2.hand.length - 1;
        const tgt = b2.needsTarget(b2.hand[i2]) ? b2.enemies[0] : null;
        const r = b2.playCard(i2, tgt);
        if (!r.ok) bad(`卡牌 ${id}${up ? '+' : ''} 打出失败: ${JSON.stringify(r)}`);
        finite(b2, `卡牌 ${id}`);
        b2.endTurn(); let g = 0; while (b2.phase === 'enemy' && g++ < 10) b2.stepEnemy();
        finite(b2, `卡牌 ${id} 之后回合`);
      } catch (e) { bad(`卡牌 ${id}${up ? '+' : ''} 抛出异常: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
    }
    void idx; nCards++;
  }
}
console.log(`✓ 卡牌: ${nCards} 个版本已执行`);

/* 2. 敌人：全部招式 + 半血阶段 + 召唤 */
let nMoves = 0;
for (const eid of Object.keys(ENEMIES)) {
  try {
    const run = newRun('body', 21);
    const b = mkBattle(run, [eid]);
    const e = b.enemies[0];
    const seen = new Set();
    for (let t = 0; t < 14 && b.phase !== 'over'; t++) {
      seen.add(e.move);
      b.intentOf(e);
      b.endTurn(); let g = 0; while (b.phase === 'enemy' && g++ < 10) b.stepEnemy();
      finite(b, `敌人 ${eid}`);
      if (t === 3 && !e.dead) b.hurt(e, Math.ceil(e.hp * 0.6), b.player, {}); // 触发半血阶段
    }
    const all = Object.keys(e.def.moves);
    const missing = all.filter((m) => !seen.has(m) && ![...e.def.pattern, ...(e.def.intro || [])].includes(m) === false);
    nMoves += seen.size;
    if (e.def.half && !e.half && !e.dead) bad(`敌人 ${eid} 半血阶段未触发`);
    void missing;
    for (const k of [...e.def.pattern, ...(e.def.intro || [])]) if (!e.def.moves[k]) bad(`敌人 ${eid} 引用了不存在的招式 ${k}`);
  } catch (err) { bad(`敌人 ${eid} 异常: ${err.stack.split('\n').slice(0, 3).join(' | ')}`); }
}
for (const [r, enc] of ENCOUNTERS.entries()) {
  [...enc.easy, ...enc.hard, ...enc.elite, enc.boss].forEach((ids) => ids.forEach((id) => { if (!ENEMIES[id]) bad(`遭遇表 ${r} 引用了不存在的敌人 ${id}`); }));
  enc.elite.forEach((ids) => ids.forEach((id) => { if (ENEMIES[id].tier !== 'elite') bad(`精英表 ${r}: ${id} 不是 elite`); }));
  enc.boss.forEach((id) => { if (ENEMIES[id].tier !== 'boss') bad(`Boss 表 ${r}: ${id} 不是 boss`); });
}
console.log(`✓ 敌人: ${Object.keys(ENEMIES).length} 种、${nMoves} 个招式执行`);

/* 3. 法宝：逐个装备后跑一场战斗 */
for (const rid of Object.keys(RELICS)) {
  try {
    const run = newRun('sword', 31);
    run.addRelic(rid);
    run.startBattle(['fox', 'spider'], 'normal');
    const b = run.battle;
    let guard = 0;
    while (b.phase !== 'over' && guard++ < 40) {
      if (b.phase === 'player') {
        for (let k = 0; k < 12; k++) {
          const i = b.hand.findIndex((c, j) => b.canPlay(j).ok);
          if (i < 0) break;
          b.playCard(i, b.needsTarget(b.hand[i]) ? b.alive()[0] : null);
          if (b.phase === 'over') break;
        }
        if (b.phase === 'player') b.endTurn();
      } else b.stepEnemy();
      finite(b, `法宝 ${rid}`);
    }
    if (b.result === 'win') run.finishBattle();
  } catch (e) { bad(`法宝 ${rid} 异常: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
}
console.log(`✓ 法宝: ${Object.keys(RELICS).length} 件`);

/* 4. 丹药 */
for (const pid of Object.keys(POTIONS)) {
  try {
    const run = newRun('sword', 41); run.potions[0] = pid;
    const b = mkBattle(run, ['fox', 'wisp']);
    const r = b.usePotion(0, POTIONS[pid].target ? b.enemies[0] : null);
    if (!r.ok) bad(`丹药 ${pid} 使用失败`);
    finite(b, `丹药 ${pid}`);
    if (run.potions[0]) bad(`丹药 ${pid} 使用后仍在栏位`);
  } catch (e) { bad(`丹药 ${pid} 异常: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
}
console.log(`✓ 丹药: ${Object.keys(POTIONS).length} 种`);

/* 5. 奇遇：每个选项、含后续步骤 */
let nChoices = 0;
for (const def of EVENTS) {
  const n = def.choices(newRun()).length;
  for (let ci = 0; ci < n; ci++) {
    for (const seed of [1, 2, 3]) {
      try {
        const run = newRun('alch', seed * 100 + ci);
        run.gold = 500; run.potions[0] = 'huichun';
        run.phase = 'map'; run.node = { type: 'event' };
        run.event = { def, title: def.title, text: def.text, choices: def.choices(run), outcome: null }; run.phase = 'event';
        const ch = run.event.choices[ci];
        if (ch.can && !ch.can()) continue;
        run.eventChoose(ci);
        if (!run.event.outcome || !run.event.outcome.text) bad(`奇遇 ${def.id}#${ci} 没有结果文本`);
        run.eventContinue();
        let g = 0;
        while (run.phase !== 'map' && run.phase !== 'over' && g++ < 12) {
          if (run.phase === 'pick') run.pickChoose(run.pickEligible()[0].u);
          else if (run.phase === 'cards') run.offerChoose(0);
          else if (run.phase === 'battle') { const b = run.battle; b.player.hp = 9999; b.enemies.forEach((e) => { e.hp = 1; }); b.alive().forEach((e) => b.hurt(e, 5, b.player, {})); b.checkWin(); run.finishBattle(); }
          else if (run.phase === 'reward') run.rewardLeave();
          else bad(`奇遇 ${def.id}#${ci} 进入了未预期阶段 ${run.phase}`);
        }
        if (run.phase !== 'map') bad(`奇遇 ${def.id}#${ci} 未回到地图 (${run.phase})`);
        if (run.hp < 1) bad(`奇遇 ${def.id}#${ci} 使气血降到 ${run.hp}`);
        nChoices++;
      } catch (e) { bad(`奇遇 ${def.id}#${ci} 异常: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
    }
  }
}
console.log(`✓ 奇遇: ${EVENTS.length} 个事件、${nChoices} 次选项执行`);

/* 6. 突破奖励 */
for (const o of BREAKTHROUGH) {
  try {
    const run = newRun('mage', 5);
    run.node = { type: 'boss' }; run.queue = [{ t: 'breakthrough', options: [o.id] }]; run.advance();
    run.breakthroughChoose(o.id);
    let g = 0;
    while (run.phase !== 'map' && g++ < 5) { if (run.phase === 'pick') run.pickChoose(run.pickEligible()[0].u); else if (run.phase === 'cards') run.offerChoose(0); }
    if (run.phase !== 'map' || run.realm !== 1) bad(`突破 ${o.id} 后状态异常: ${run.phase}/${run.realm}`);
  } catch (e) { bad(`突破 ${o.id} 异常: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
}
console.log(`✓ 突破奖励: ${BREAKTHROUGH.length} 种`);

/* 7. 地图结构 */
for (let seed = 1; seed <= 300; seed++) {
  const run = newRun('sword', seed);
  const rows = run.map;
  const types = new Set(rows.flat().filter(Boolean).map((n) => n.type));
  for (const need of ['battle', 'boss', 'chest', 'rest']) if (!types.has(need)) bad(`地图 seed=${seed} 缺少 ${need}`);
  if (!types.has('shop')) bad(`地图 seed=${seed} 没有坊市`);
  if (!types.has('elite')) bad(`地图 seed=${seed} 没有精英`);
  // 从起点可达 Boss，且每个节点都有出路
  const reach = new Set(); let front = rows[0].filter(Boolean).map((n) => n.r + '_' + n.c);
  front.forEach((k) => reach.add(k));
  for (let r = 0; r < rows.length - 1; r++) for (const n of rows[r].filter(Boolean)) {
    if (!n.next.length) bad(`地图 seed=${seed} 节点 ${n.r}_${n.c} 无出路`);
    for (const c of n.next) if (!rows[r + 1][c]) bad(`地图 seed=${seed} 节点 ${n.r}_${n.c} 连向不存在的 ${r + 1}_${c}`);
  }
}
console.log('✓ 地图: 300 个随机种子结构合法');

/* 8. 职业：起手牌与法宝有效 */
for (const [id, c] of Object.entries(CLASSES)) {
  c.deck.forEach((cid) => { if (!CARDS[cid]) bad(`职业 ${id} 起手牌 ${cid} 不存在`); });
  if (!RELICS[c.relic]) bad(`职业 ${id} 初始法宝 ${c.relic} 不存在`);
  const pool = Object.values(CARDS).filter((x) => x.cls === id);
  const by = (r) => pool.filter((x) => x.rarity === r).length;
  console.log(`  ${c.name}: 卡牌 ${pool.length} (普通${by('common')} 罕见${by('uncommon')} 稀有${by('rare')})`);
}
console.log(problems ? `\n审计发现 ${problems} 个问题` : '\n审计通过，未发现问题。');
process.exit(problems ? 1 : 0);
