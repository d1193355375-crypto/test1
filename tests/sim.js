/* 无头模拟：让启发式机器人打完整局，用来抓引擎 bug 并粗测平衡。
   用法：node tests/sim.js [每职业局数=40] [劫数=0] [种子偏移=0] */
require('../src/data.js');
require('../src/engine.js');
const XX = globalThis.XX;
const { Run, Meta, view, CARDS, POTIONS, RELICS, BREAKTHROUGH } = XX;

const N = +process.argv[2] || 40, ASC = +process.argv[3] || 0, OFF = +process.argv[4] || 0;
const RANK = { starter: 0, common: 1, uncommon: 2, rare: 3, status: -9, curse: -9 };

/* ---------- 机器人：战斗 ---------- */
function incoming(b) {
  let sum = 0;
  for (const e of b.alive()) {
    if (e.st.stun > 0) continue;
    const it = b.intentOf(e);
    if (it.dmg != null) sum += it.dmg * it.hits;
  }
  return sum;
}
function cardScore(b, c, need) {
  const v = view(c.id, c.up);
  if (!b.canPlay(b.hand.indexOf(c)).ok) return -1;
  const cost = b.cardCost(c) === 'X' ? Math.max(1, b.energy) : b.cardCost(c);
  const al = b.alive().length;
  let s = 0;
  const sheng = b.shengActive(c) ? 1.3 : 1;
  if (v.dmg) s += v.dmg * (v.hits || 1) * (v.aoe ? Math.min(al, 3) : 1) * (v.x ? Math.max(1, b.energy) : 1) * sheng;
  if (v.dmgBlock) s += b.player.block * (v.aoe ? al : 1);
  if (v.dmgPoison) s += Math.max(...b.alive().map((e) => e.st.poison || 0));
  if (v.block) s += Math.min(v.block, Math.max(0, need)) * 1.4 + (need > 0 ? 0 : 1);
  if (v.heal) s += v.heal * ((b.player.maxHp - b.player.hp) > 10 ? 1 : 0.2);
  if (v.draw) s += v.draw * 4;
  if (v.energy) s += 6;
  for (const k of ['apply', 'applyAll']) if (v[k]) for (const x in v[k]) s += v[k][x] * (x === 'poison' ? 2.5 : x === 'burn' ? 1.5 : x === 'stun' ? 12 : 3) * (k === 'applyAll' || v.aoe ? al : 1);
  if (v.self) for (const x in v.self) { if (x !== 'strDown') s += v.self[x] * (x === 'str' ? 9 : x === 'nextSheng' ? 2 : 7); }
  if (v.type === 'pow') s += b.turn <= 2 ? 25 : 8;
  if (v.hpLoss && b.player.hp <= v.hpLoss + 6) s -= 50;
  if (v.fx === 'doublePoison') s += Math.max(...b.alive().map((e) => e.st.poison || 0)) * 1.5;
  if (v.fx === 'gainPotion') s += 4;
  if (sheng > 1 && (v.block || v.draw || v.apply || v.self)) s *= 1.4;
  return s / Math.max(0.6, cost);
}
function pickTarget(b) {
  const al = b.alive();
  return al.slice().sort((x, y) => (x.hp + x.block) - (y.hp + y.block))[0];
}
function playBattle(run) {
  const b = run.battle; let guard = 0;
  while (b.phase !== 'over' && guard++ < 3000) {
    if (b.phase === 'player') {
      // 丹药
      const boss = b.kind !== 'normal';
      for (let i = 0; i < run.potions.length; i++) {
        const id = run.potions[i]; if (!id) continue;
        const danger = incoming(b) - b.player.block >= b.player.hp * 0.7 || b.player.hp < b.player.maxHp * 0.35;
        if ((boss && b.turn <= 3) || danger) {
          const t = POTIONS[id].target ? pickTarget(b) : null;
          if (id === 'huichun' && b.player.hp > b.player.maxHp * 0.6) continue;
          if (id === 'peiyuan') { b.usePotion(i, t); continue; }
          b.usePotion(i, t);
          if (b.phase === 'over') break;
        }
      }
      let played = false;
      for (let k = 0; k < 40 && b.phase === 'player'; k++) {
        const need = incoming(b) - b.player.block;
        let best = null, bs = 0.5;
        for (const c of b.hand) { const sc = cardScore(b, c, need); if (sc > bs) { bs = sc; best = c; } }
        if (!best) break;
        const idx = b.hand.indexOf(best);
        const r = b.playCard(idx, b.needsTarget(best) ? pickTarget(b) : null);
        if (!r.ok) throw new Error('playCard failed: ' + best.id + ' ' + JSON.stringify(r));
        played = true;
        if (b.phase === 'over') break;
      }
      void played;
      if (b.phase === 'player') b.endTurn();
    } else if (b.phase === 'enemy') {
      let r;
      do { r = b.stepEnemy(); } while (r === 'more');
    }
  }
  if (guard >= 3000) throw new Error('battle infinite loop');
  return b.result;
}

/* ---------- 机器人：其他阶段 ---------- */
function deckValue(run, id) {
  const d = CARDS[id];
  let v = RANK[d.rarity] * 2 + (d.cls === run.cls ? 2 : 0);
  if (d.cls === 'neutral' && d.rarity === 'common') v -= 1;
  return v;
}
function stepRun(run, log) {
  switch (run.phase) {
    case 'map': {
      const nodes = run.availableNodes();
      const score = (n) => ({ battle: 3, event: 3, shop: 2, rest: run.hp < run.maxHp * 0.6 ? 6 : 2, elite: run.hp > run.maxHp * 0.7 ? 4 : 0, chest: 5, boss: 9 }[n.type] || 1) + run.rng.next();
      const n = nodes.sort((a, b) => score(b) - score(a))[0];
      if (!run.enterNode(n.r, n.c)) throw new Error('enterNode failed');
      break;
    }
    case 'battle': {
      const res = playBattle(run);
      run.finishBattle();
      log.battles++;
      void res;
      break;
    }
    case 'reward': {
      const rw = run.reward;
      if (rw.potion) run.rewardTakePotion();
      if (rw.relics.length) run.rewardTakeRelic(0);
      const ids = rw.cards.map((id, i) => ({ id, i })).sort((a, b) => deckValue(run, b.id) - deckValue(run, a.id));
      const want = run.deck.length < 22 ? ids[0] : null;
      if (want && deckValue(run, want.id) >= 4) run.rewardPickCard(want.i); else run.rewardSkipCards();
      run.rewardLeave();
      break;
    }
    case 'pick': {
      const el = run.pickEligible();
      if (!el.length) { run.pickSkip(); break; }
      if (run.pickInfo.mode === 'remove') {
        el.sort((a, b) => deckValue(run, a.id) - deckValue(run, b.id));
        run.pickChoose(el[0].u);
      } else {
        el.sort((a, b) => deckValue(run, b.id) - deckValue(run, a.id));
        run.pickChoose(el[0].u);
      }
      break;
    }
    case 'cards': {
      const o = run.offer.ids.map((id, i) => ({ id, i })).sort((a, b) => deckValue(run, b.id) - deckValue(run, a.id))[0];
      if (o) run.offerChoose(o.i); else run.offerSkip();
      break;
    }
    case 'breakthrough': run.breakthroughChoose(run.btOptions[0]); break;
    case 'event': {
      const ev = run.event;
      if (!ev.outcome) {
        const ok = ev.choices.map((c, i) => ({ c, i })).filter((x) => !x.c.can || x.c.can());
        run.eventChoose(run.rng.pick(ok).i);
      } else run.eventContinue();
      break;
    }
    case 'rest':
      if (run.hp < run.maxHp * 0.7 && run.canRestHeal()) run.restHeal(); else run.restUpgrade();
      break;
    case 'chest': run.openChest(); run.chestLeave(); break;
    case 'shop': {
      const s = run.shop;
      s.relics.forEach((r, i) => { if (!r.sold && run.gold >= r.price) run.shopBuy('relics', i); });
      const cs = s.cards.map((c, i) => ({ c, i })).filter((x) => !x.c.sold && CARDS[x.c.id].rarity !== 'common' && CARDS[x.c.id].cls === run.cls).sort((a, b) => b.c.price - a.c.price);
      for (const x of cs) if (run.gold >= x.c.price + 40) run.shopBuy('cards', x.i);
      s.potions.forEach((p, i) => { if (!p.sold && run.gold >= p.price + 60 && run.canGainPotion()) run.shopBuy('potions', i); });
      if (run.gold >= s.removeCost) { if (run.shopRemove()) { stepRun(run, log); break; } }
      run.shopLeave();
      break;
    }
    default: throw new Error('unknown phase ' + run.phase);
  }
}

function playRun(cls, seed) {
  const meta = Meta.fresh();
  const run = Run.create({ cls, seed, asc: ASC, meta });
  const log = { battles: 0 };
  let steps = 0;
  while (run.phase !== 'over' && steps++ < 4000) {
    stepRun(run, log);
    // 存档往返检查
    if (run.phase === 'map' && steps % 7 === 0) {
      const back = Run.fromJSON(JSON.parse(JSON.stringify(run)));
      if (JSON.stringify(back) !== JSON.stringify(run)) throw new Error('save round-trip mismatch');
    }
  }
  if (steps >= 4000) throw new Error('run did not terminate; phase=' + run.phase);
  return { run, log };
}

/* ---------- 汇总 ---------- */
const classes = Object.keys(XX.CLASSES);
console.log(`模拟：每职业 ${N} 局，劫数 ${ASC}`);
let failures = 0;
for (const cls of classes) {
  let wins = 0, realmSum = 0, hpAtEnd = 0, deck = 0;
  const deathRealm = [0, 0, 0, 0, 0], killers = {};
  for (let i = 0; i < N; i++) {
    try {
      const { run } = playRun(cls, 1000 + OFF + i * 7919);
      if (run.outcome === 'win') wins++; else { deathRealm[run.realm]++; killers[run.killedBy] = (killers[run.killedBy] || 0) + 1; }
      realmSum += run.realm + (run.outcome === 'win' ? 1 : 0);
      deck += run.deck.length; hpAtEnd += run.maxHp;
    } catch (e) {
      failures++;
      console.error(`[${cls}#${i}] 崩溃:`, e.stack.split('\n').slice(0, 4).join('\n'));
      if (failures > 5) process.exit(1);
    }
  }
  console.log(`${XX.CLASSES[cls].name.padEnd(3)} 通关 ${String(wins).padStart(3)}/${N}  平均到达境界 ${(realmSum / N).toFixed(2)}  陨落分布(练气→化神) ${deathRealm.join('/')}  平均牌库 ${(deck / N).toFixed(1)}  平均最大气血 ${(hpAtEnd / N).toFixed(0)}`);
  if (process.env.KILLERS) console.log('   死因 Top5:', Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}×${v}`).join('  '));
}
if (failures) { console.error('存在崩溃：', failures); process.exit(1); }
console.log('全部模拟完成，无崩溃。');
