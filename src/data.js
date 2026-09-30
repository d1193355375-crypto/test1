/* 问道长生 - 静态数据：五行、状态、卡牌、法宝、丹药、敌人、奇遇、传承 */
(function (G) {
  'use strict';
  const XX = (G.XX = G.XX || {});

  /* ---------------- 五行 ----------------
     gen：我所生（木生火…）  over：我所克（金克木…） */
  const ELEMENTS = {
    '金': { color: '#e3c15f', gen: '水', over: '木' },
    '木': { color: '#68b774', gen: '火', over: '土' },
    '水': { color: '#5aa7dd', gen: '木', over: '火' },
    '火': { color: '#e4674a', gen: '土', over: '金' },
    '土': { color: '#bf9560', gen: '金', over: '水' },
  };
  const SHENG_BONUS = 0.5; // 相生：伤害/护体 +50%（五行归一每层再 +50%）
  const KE_BONUS = 0.3; // 相克：对被克制属性的敌人伤害 +30%

  /* ---------------- 状态 ---------------- */
  const STATUS = {
    str: { n: '剑意', g: '剑', good: 1, d: '攻击伤害 +N。' },
    dex: { n: '身法', g: '步', good: 1, d: '获得的护体 +N。' },
    thorns: { n: '反震', g: '荆', good: 1, d: '被攻击时，对攻击者造成 N 点伤害。' },
    regen: { n: '灵愈', g: '愈', good: 1, d: '回合结束时回复 N 点气血。' },
    plated: { n: '金身', g: '甲', good: 1, d: '回合结束时获得 N 点护体。' },
    growth: { n: '悟道', g: '悟', good: 1, d: '回合开始时获得 N 点剑意。' },
    array: { n: '剑阵', g: '阵', good: 1, d: '回合开始时，对所有敌人造成 N 点伤害。' },
    envenom: { n: '附毒', g: '淬', good: 1, d: '攻击造成气血伤害时，施加 N 层中毒。' },
    plague: { n: '毒经', g: '经', good: 1, d: '回合开始时，对所有敌人施加 N 层中毒。' },
    flow: { n: '灵脉', g: '脉', good: 1, d: '回合开始时额外获得 N 点灵力。' },
    harmony: { n: '五行归一', g: '一', good: 1, d: '相生加成额外提高 N × 50%。' },
    nextDouble: { n: '心剑', g: '双', good: 1, d: '接下来 N 张攻击牌会打出两次。' },
    nextSheng: { n: '顺势', g: '顺', good: 1, d: '接下来 N 张带五行的牌视为相生。' },
    barricade: { n: '不坏', g: '山', good: 1, d: '护体不再于回合开始时消失。' },
    energyNext: { n: '灵潮', g: '潮', good: 1, d: '下回合额外获得 N 点灵力。' },
    drawNext: { n: '神识', g: '识', good: 1, d: '下回合额外抽 N 张牌。' },
    strDown: { n: '蓄势', g: '衰', good: 0, d: '回合结束时失去 N 点剑意。' },
    weak: { n: '虚弱', g: '弱', good: 0, d: '造成的攻击伤害 -25%，持续 N 回合。' },
    vuln: { n: '易伤', g: '伤', good: 0, d: '受到的攻击伤害 +50%，持续 N 回合。' },
    frail: { n: '破防', g: '破', good: 0, d: '获得的护体 -25%，持续 N 回合。' },
    poison: { n: '中毒', g: '毒', good: 0, d: '回合开始时失去 N 点气血（无视护体），随后层数 -1。' },
    burn: { n: '灼烧', g: '灼', good: 0, d: '回合结束时受到 N 点伤害，随后层数减少三分之一（向上取整）。' },
    stun: { n: '眩晕', g: '晕', good: 0, d: '跳过下 N 个回合的行动。' },
  };

  /* ---------------- 卡牌 ----------------
     字段：dmg hits aoe block draw energy heal hpLoss lifesteal
           apply(目标) applyAll(全体敌人) self(自身状态)
           dmgBlock(伤害=护体×n) dmgPoison(伤害=目标中毒×n)
           x(消耗全部灵力，效果次数=灵力) exhaust retain innate ethereal unplayable
           sheng(相生附加效果) fx(特殊) text(补充描述) up(淬炼后覆盖字段) */
  const CARDS = {};
  function C(id, name, cls, type, cost, rarity, el, o) {
    CARDS[id] = Object.assign({ id, name, cls, type, cost, rarity, el: el || '' }, o || {});
  }

  // 通用
  C('defend', '护体', 'neutral', 'skl', 1, 'starter', '', { block: 5 });

  // ── 剑修 ──
  C('jianqi', '剑气斩', 'sword', 'atk', 1, 'starter', '金', { dmg: 6 });
  C('yujian', '御剑诀', 'sword', 'atk', 2, 'starter', '金', { dmg: 8, apply: { vuln: 2 } });
  C('jifeng', '疾风剑', 'sword', 'atk', 1, 'common', '金', { dmg: 4, hits: 2 });
  C('fuliu', '拂柳剑', 'sword', 'atk', 1, 'common', '金', { dmg: 5, block: 4 });
  C('zongheng', '剑气纵横', 'sword', 'atk', 1, 'common', '金', { dmg: 7, aoe: true });
  C('bajian', '拔剑术', 'sword', 'atk', 0, 'common', '金', { dmg: 4 });
  C('xushi', '蓄势', 'sword', 'skl', 0, 'common', '金', { self: { str: 2, strDown: 2 } });
  C('wanjian', '万剑归宗', 'sword', 'atk', 2, 'uncommon', '金', { dmg: 11, aoe: true });
  C('lianning', '剑意凝练', 'sword', 'pow', 1, 'uncommon', '金', { self: { str: 2 } });
  C('jianzhen', '剑阵', 'sword', 'pow', 2, 'uncommon', '金', { self: { array: 3 } });
  C('xinjian', '心剑合一', 'sword', 'skl', 1, 'uncommon', '金', { self: { nextDouble: 1 }, up: { cost: 0 } });
  C('poshui', '断水式', 'sword', 'atk', 1, 'uncommon', '水', { dmg: 9, sheng: { apply: { vuln: 1 } } });
  C('renjian', '人剑合一', 'sword', 'pow', 2, 'rare', '金', { self: { growth: 1 }, up: { cost: 1 } });
  C('chaozong', '万剑朝宗', 'sword', 'atk', 1, 'rare', '金', { dmg: 8, aoe: true, x: true });
  C('feixian', '天外飞仙', 'sword', 'atk', 3, 'rare', '金', { dmg: 32, exhaust: true, up: { dmg: 44 } });

  // ── 体修 ──
  C('kaibei', '开碑手', 'body', 'atk', 1, 'starter', '土', { dmg: 6 });
  C('tieshan', '铁山靠', 'body', 'atk', 1, 'starter', '土', { dmgBlock: 1, up: { cost: 0 } });
  C('jingang', '金刚掌', 'body', 'atk', 1, 'common', '土', { dmg: 7, block: 3 });
  C('tongpi', '铜皮铁骨', 'body', 'skl', 1, 'common', '土', { block: 9 });
  C('fanzhen', '反震', 'body', 'skl', 1, 'common', '土', { block: 6, self: { thorns: 2 } });
  C('gangqi', '罡气护体', 'body', 'skl', 2, 'common', '金', { block: 16, retain: true });
  C('xueqi', '血气翻涌', 'body', 'skl', 0, 'common', '火', { hpLoss: 3, energy: 2, up: { hpLoss: 2 } });
  C('zhenshan', '震山撼岳', 'body', 'atk', 2, 'common', '土', { dmg: 9, aoe: true, apply: { vuln: 1 } });
  C('jinshen', '金身', 'body', 'pow', 1, 'uncommon', '土', { self: { plated: 3 } });
  C('yangxue', '以血养身', 'body', 'skl', 1, 'uncommon', '火', { hpLoss: 4, block: 14 });
  C('jingci', '荆棘之躯', 'body', 'pow', 1, 'uncommon', '木', { self: { thorns: 3 } });
  C('lianti', '炼体', 'body', 'pow', 1, 'uncommon', '土', { self: { dex: 2 } });
  C('numu', '怒目金刚', 'body', 'atk', 1, 'uncommon', '火', { dmg: 8, apply: { weak: 1, vuln: 1 } });
  C('bujing', '不动如山', 'body', 'pow', 3, 'rare', '土', { self: { barricade: 1 }, up: { cost: 2 } });
  C('shanyue', '山岳崩', 'body', 'atk', 2, 'rare', '土', { dmgBlock: 1, aoe: true, exhaust: true, up: { cost: 1 } });
  C('xueyin', '血饮狂刀', 'body', 'atk', 2, 'rare', '火', { dmg: 14, lifesteal: true, exhaust: true });

  // ── 法修 ──
  C('huoqiu', '火球术', 'mage', 'atk', 1, 'starter', '火', { dmg: 6 });
  C('wuxingjue', '五行诀', 'mage', 'skl', 1, 'starter', '木', { block: 5, sheng: { draw: 1 } });
  C('qingteng', '青藤缠', 'mage', 'atk', 1, 'common', '木', { dmg: 5, apply: { weak: 1 }, sheng: { apply: { weak: 1 } } });
  C('huofu', '火焰符', 'mage', 'atk', 1, 'common', '火', { dmg: 5, apply: { burn: 3 }, sheng: { apply: { burn: 2 } } });
  C('bingzhui', '冰锥术', 'mage', 'atk', 1, 'common', '水', { dmg: 5, apply: { weak: 1 }, sheng: { draw: 1 } });
  C('jinzhen', '金针', 'mage', 'atk', 0, 'common', '金', { dmg: 3, sheng: { draw: 1 } });
  C('houtu', '厚土诀', 'mage', 'skl', 1, 'common', '土', { block: 8, sheng: { self: { dex: 1 } } });
  C('shunshui', '顺水推舟', 'mage', 'skl', 0, 'uncommon', '', { self: { nextSheng: 1 } });
  C('lieyan', '烈焰风暴', 'mage', 'atk', 2, 'uncommon', '火', { dmg: 8, aoe: true, applyAll: { burn: 3 } });
  C('tianlei', '天雷引', 'mage', 'atk', 2, 'uncommon', '火', { dmg: 14, sheng: { dmg: 6 } });
  C('hanshuang', '寒霜降', 'mage', 'skl', 1, 'uncommon', '水', { block: 6, applyAll: { weak: 1, vuln: 1 } });
  C('wuxinggui', '五行归一', 'mage', 'pow', 1, 'uncommon', '', { self: { harmony: 1 }, up: { cost: 0 } });
  C('muling', '木灵之体', 'mage', 'pow', 2, 'rare', '木', { self: { regen: 2 } });
  C('fentian', '焚天', 'mage', 'atk', 3, 'rare', '火', { dmg: 18, aoe: true, applyAll: { burn: 6 }, exhaust: true });
  C('fengbing', '冰封千里', 'mage', 'skl', 2, 'rare', '水', { block: 10, apply: { stun: 1, weak: 2 }, exhaust: true, up: { block: 14, cost: 1 } });
  C('lingmai', '天地灵脉', 'mage', 'pow', 3, 'rare', '', { self: { flow: 1 }, up: { cost: 2 } });

  // ── 丹修 ──
  C('dusha', '毒砂掌', 'alch', 'atk', 1, 'starter', '木', { dmg: 6 });
  C('cudu', '淬毒', 'alch', 'skl', 1, 'starter', '木', { apply: { poison: 5 } });
  C('shigu', '蚀骨散', 'alch', 'skl', 1, 'common', '木', { apply: { poison: 6 } });
  C('duwu', '毒雾', 'alch', 'skl', 1, 'common', '木', { applyAll: { poison: 4 } });
  C('dulong', '毒龙钻', 'alch', 'atk', 1, 'common', '木', { dmg: 5, apply: { poison: 3 } });
  C('jinchuang', '金疮药', 'alch', 'skl', 1, 'common', '木', { block: 6, heal: 2 });
  C('caiyao', '采药', 'alch', 'skl', 0, 'common', '木', { draw: 1, block: 3 });
  C('baidu', '百毒掌', 'alch', 'atk', 1, 'common', '木', { dmg: 4, aoe: true, apply: { poison: 2 } });
  C('fudu', '附毒', 'alch', 'pow', 1, 'uncommon', '木', { self: { envenom: 1 } });
  C('yindu', '引毒发作', 'alch', 'skl', 1, 'uncommon', '木', { fx: 'doublePoison', text: '使目标的中毒层数翻倍。', exhaust: true, up: { exhaust: false } });
  C('yaowang', '药王体', 'alch', 'pow', 1, 'uncommon', '木', { self: { regen: 2 } });
  C('dubao', '毒蛟出洞', 'alch', 'atk', 1, 'uncommon', '木', { dmgPoison: 1, up: { cost: 0 } });
  C('yaodan', '凝丹', 'alch', 'skl', 1, 'uncommon', '木', { fx: 'gainPotion', text: '获得一瓶随机丹药。', exhaust: true, block: 6 });
  C('wandu', '万毒归宗', 'alch', 'skl', 2, 'rare', '木', { applyAll: { poison: 8 }, exhaust: true, up: { applyAll: { poison: 12 } } });
  C('huanhun', '九转还魂丹', 'alch', 'skl', 2, 'rare', '木', { heal: 15, block: 10, exhaust: true });
  C('dujing', '毒经', 'alch', 'pow', 2, 'rare', '木', { self: { plague: 2 }, up: { self: { plague: 3 } } });

  // ── 通用池 ──
  C('kaishan', '开山掌', 'neutral', 'atk', 1, 'common', '土', { dmg: 8 });
  C('guanxiang', '观想', 'neutral', 'skl', 1, 'common', '水', { draw: 2 });
  C('jinguang', '金光咒', 'neutral', 'skl', 1, 'common', '金', { block: 8 });
  C('liehuo', '烈火符', 'neutral', 'atk', 1, 'common', '火', { dmg: 7, apply: { burn: 2 } });
  C('huichun', '回春诀', 'neutral', 'skl', 1, 'common', '木', { heal: 5, exhaust: true });
  C('juling', '聚灵诀', 'neutral', 'skl', 0, 'uncommon', '', { energy: 1, exhaust: true, up: { exhaust: false } });
  C('dingshen', '定神符', 'neutral', 'skl', 1, 'uncommon', '土', { block: 9, retain: true });
  C('leifu', '天雷符', 'neutral', 'atk', 2, 'uncommon', '火', { dmg: 14, apply: { vuln: 1 } });
  C('fengling', '封灵符', 'neutral', 'skl', 1, 'uncommon', '水', { apply: { weak: 2, vuln: 2 } });
  C('xuesha', '血煞符', 'neutral', 'atk', 0, 'uncommon', '火', { hpLoss: 3, dmg: 12 });
  C('pojie', '破碎虚空', 'neutral', 'atk', 2, 'rare', '', { dmg: 14, draw: 2 });
  C('niepan', '涅槃', 'neutral', 'skl', 3, 'rare', '火', { block: 25, heal: 12, exhaust: true });
  C('daodao', '大道无形', 'neutral', 'pow', 2, 'rare', '', { self: { dex: 1, str: 1 }, up: { self: { dex: 2, str: 2 } } });

  // ── 状态 / 诅咒 ──
  C('zanian', '杂念', 'status', 'skl', 0, 'status', '', { unplayable: true, ethereal: true, text: '心神不宁，念头纷飞。' });
  C('xinmo', '心魔', 'curse', 'skl', 0, 'curse', '', { unplayable: true, endTurnHp: 2, text: '缠身心魔，难以驱除。' });

  /* ---------------- 职业(道途) ---------------- */
  const CLASSES = {
    sword: {
      name: '剑修', g: '剑', color: '#8fc1e8', hp: 84, relic: 'qingfeng',
      desc: '以剑入道，剑意层层叠加，多段连击斩妖除魔。',
      tag: '连击 · 剑意 · 剑阵',
      deck: ['jianqi', 'jianqi', 'jianqi', 'jianqi', 'jianqi', 'defend', 'defend', 'defend', 'defend', 'yujian'],
    },
    body: {
      name: '体修', g: '体', color: '#d1a273', hp: 86, relic: 'xuantie_wan',
      desc: '炼体铁骨，以护体为矛，反震万法不侵。',
      tag: '护体 · 反震 · 以血换力',
      deck: ['kaibei', 'kaibei', 'kaibei', 'kaibei', 'kaibei', 'defend', 'defend', 'defend', 'defend', 'tieshan'],
    },
    mage: {
      name: '法修', g: '法', color: '#e58a6e', hp: 74, relic: 'wuxingzhu',
      desc: '五行流转，相生相克，烈焰与寒霜皆听调遣。',
      tag: '相生 · 灼烧 · 过牌',
      deck: ['huoqiu', 'huoqiu', 'huoqiu', 'huoqiu', 'qingteng', 'defend', 'defend', 'defend', 'houtu', 'wuxingjue'],
    },
    alch: {
      name: '丹修', g: '丹', color: '#8fd19b', hp: 74, relic: 'baicaoding',
      desc: '毒丹并炼，蚀骨断魂，亦可回春续命。',
      tag: '中毒 · 丹药 · 回春',
      deck: ['dusha', 'dusha', 'dusha', 'dusha', 'dusha', 'defend', 'defend', 'defend', 'defend', 'cudu'],
    },
  };

  /* ---------------- 法宝 ----------------
     钩子： onPickup(run) battleStart(b) turnStart(b) turnEnd(b) cardPlayed(b,info)
            battleWin(b) modifyDamageTaken(b,dmg) onLethal(b) 及被动字段 */
  const RELICS = {
    // 初始
    qingfeng: { n: '青锋古剑', g: '剑', r: 'starter', d: '战斗开始时，获得 1 点剑意。', battleStart: (b) => b.addStatus(b.player, 'str', 1) },
    xuantie_wan: { n: '玄铁腕环', g: '环', r: 'starter', d: '战斗胜利后，回复 5 点气血。', battleWin: (b) => b.run.heal(5) },
    wuxingzhu: { n: '五行珠', g: '珠', r: 'starter', d: '每回合第一次触发相生时，抽 1 张牌。', cardPlayed: (b, i) => { if (i.sheng && !b.rs.wxz) { b.rs.wxz = 1; b.drawCards(1); } }, turnStart: (b) => { b.rs.wxz = 0; } },
    baicaoding: { n: '百草鼎', g: '鼎', r: 'starter', d: '战斗开始时，对所有敌人施加 2 层中毒。', battleStart: (b) => b.alive().forEach((e) => b.addStatus(e, 'poison', 2)) },
    // 普通
    juling_deng: { n: '聚灵灯', g: '灯', r: 'common', d: '每场战斗第一个回合，额外获得 1 点灵力。', turnStart: (b) => { if (b.turn === 1) b.energy += 1; } },
    jingang_chu: { n: '金刚杵', g: '杵', r: 'common', d: '战斗开始时，获得 1 点剑意。', battleStart: (b) => b.addStatus(b.player, 'str', 1) },
    dinghai: { n: '定海针', g: '针', r: 'common', d: '战斗开始时，获得 10 点护体。', battleStart: (b) => b.gainBlock(b.player, 10, { raw: true }) },
    qiankun_dai: { n: '乾坤袋', g: '袋', r: 'common', d: '每场战斗第一个回合，额外抽 2 张牌。', turnStart: (b) => { if (b.turn === 1) b.drawCards(2); } },
    lingzhi: { n: '千年灵芝', g: '芝', r: 'common', d: '拾取时，最大气血 +10。', onPickup: (r) => r.gainMaxHp(10) },
    xuantie_jia: { n: '玄铁甲', g: '甲', r: 'common', d: '回合结束时，若没有护体，获得 6 点护体。', turnEnd: (b) => { if (b.player.block === 0) b.gainBlock(b.player, 6, { raw: true }); } },
    feidao: { n: '飞刀', g: '刀', r: 'common', d: '每回合打出第 3 张攻击牌时，获得 1 点身法。', turnStart: (b) => { b.rs.fd = 0; }, cardPlayed: (b, i) => { if (i.type === 'atk' && ++b.rs.fd === 3) b.addStatus(b.player, 'dex', 1); } },
    jinzhong: { n: '金钟罩', g: '钟', r: 'common', d: '受到的伤害若不超过 5 点，则降为 1 点。', modifyDamageTaken: (b, d) => (d > 0 && d <= 5 ? 1 : d) },
    qiankun_quan: { n: '乾坤圈', g: '圈', r: 'common', d: '战斗开始时，对所有敌人施加 1 层易伤。', battleStart: (b) => b.alive().forEach((e) => b.addStatus(e, 'vuln', 1)) },
    xuemai: { n: '血玉', g: '玉', r: 'common', d: '战斗开始时，回复 3 点气血。', battleStart: (b) => b.heal(b.player, 3) },
    // 罕见
    lingbi: { n: '灵笔', g: '笔', r: 'uncommon', d: '每打出 10 张攻击牌，下一张攻击牌伤害翻倍。', cardPlayed: (b, i) => { if (i.type === 'atk') { b.rs.lb = (b.rs.lb || 0) + 1; if (b.rs.lb >= 10) { b.rs.lb = 0; b.rs.lbReady = 1; } } } },
    danding: { n: '丹鼎', g: '炉', r: 'uncommon', d: '拾取时，丹药栏位 +2。', onPickup: (r) => r.addPotionSlots(2) },
    juebao: { n: '聚宝盆', g: '盆', r: 'uncommon', d: '拾取时获得 100 灵石；战斗灵石 +25%。', goldMult: 1.25, onPickup: (r) => r.gainGold(100) },
    lianhua: { n: '续命莲', g: '莲', r: 'uncommon', d: '气血归零时，回复 50% 最大气血（仅一次）。', onLethal: (b) => { if (!b.run.flags.lotus) { b.run.flags.lotus = 1; b.player.hp = Math.ceil(b.player.maxHp / 2); return true; } return false; } },
    zhaohun: { n: '招魂幡', g: '幡', r: 'uncommon', d: '每击杀一个敌人，回复 3 点气血。', kill: (b) => b.heal(b.player, 3) },
    shanhu: { n: '珊瑚枝', g: '枝', r: 'uncommon', d: '每回合打出第 1 张技能牌时，获得 3 点护体。', turnStart: (b) => { b.rs.sh = 0; }, cardPlayed: (b, i) => { if (i.type === 'skl' && !b.rs.sh) { b.rs.sh = 1; b.gainBlock(b.player, 3, { raw: true }); } } },
    // 稀有
    yinlei: { n: '引雷针', g: '雷', r: 'rare', d: '回合结束时，每剩余 1 点灵力，对随机敌人造成 4 点伤害。', turnEnd: (b) => { const n = b.energy; for (let i = 0; i < n; i++) { const t = b.rng.pick(b.alive()); if (t) b.hurt(t, 4, b.player, {}); } b.checkWin(); } },
    taixu: { n: '太虚镜', g: '镜', r: 'rare', d: '每回合打出的第一张牌，耗费变为 0。', freeFirst: true },
    lingxi: { n: '灵犀珠', g: '犀', r: 'rare', d: '每回合额外抽 1 张牌。', drawBonus: 1 },
    // Boss
    molong: { n: '血魔幡', g: '魔', r: 'boss', d: '灵力上限 +1。战斗开始时，将一张「心魔」洗入抽牌堆。', energyBonus: 1, battleStart: (b) => b.addCardToPile('xinmo', 'draw', 1) },
    taiyi: { n: '太乙净瓶', g: '瓶', r: 'boss', d: '灵力上限 +1。无法再获得丹药。', energyBonus: 1, noPotion: true },
    jiutian: { n: '九天玄女令', g: '令', r: 'boss', d: '灵力上限 +1。每回合少抽 1 张牌。', energyBonus: 1, drawBonus: -1 },
    yehuo: { n: '无间业火', g: '焰', r: 'boss', d: '灵力上限 +1。无法在洞府打坐调息。', energyBonus: 1, noRest: true },
    hundun: { n: '混沌珠', g: '混', r: 'boss', d: '灵力上限 +1。每场战斗开始时，你的手牌中多一张「杂念」。', energyBonus: 1, battleStart: (b) => b.addCardToPile('zanian', 'draw', 1) },
  };

  /* ---------------- 丹药 ---------------- */
  const POTIONS = {
    huichun: { n: '回春丹', g: '春', r: 'common', d: '回复 20 点气血。', use: (b) => b.heal(b.player, 20) },
    juling: { n: '聚灵丹', g: '灵', r: 'common', d: '获得 2 点灵力。', use: (b) => { b.energy += 2; b.fx({ t: 'text', who: b.player, s: '+2 灵力', k: 'buff' }); } },
    jingang: { n: '金刚丹', g: '刚', r: 'common', d: '获得 14 点护体。', use: (b) => b.gainBlock(b.player, 14, { raw: true }) },
    jianyi: { n: '剑意丹', g: '意', r: 'common', d: '获得 2 点剑意。', use: (b) => b.addStatus(b.player, 'str', 2) },
    dulong: { n: '毒龙丹', g: '毒', r: 'common', d: '对目标施加 9 层中毒。', target: true, use: (b, t) => b.addStatus(t, 'poison', 9) },
    liehuo: { n: '烈火丹', g: '焰', r: 'common', d: '对所有敌人造成 16 点伤害。', use: (b) => { b.alive().forEach((e) => b.hurt(e, 16, b.player, {})); b.checkWin(); } },
    mingshen: { n: '明神丹', g: '明', r: 'common', d: '抽 3 张牌。', use: (b) => b.drawCards(3) },
    dingshen: { n: '定身丹', g: '定', r: 'uncommon', d: '对目标施加 3 层虚弱与 3 层易伤。', target: true, use: (b, t) => { b.addStatus(t, 'weak', 3); b.addStatus(t, 'vuln', 3); } },
    peiyuan: { n: '培元丹', g: '元', r: 'rare', d: '最大气血永久 +10。', use: (b) => { b.run.gainMaxHp(10); b.player.maxHp += 10; b.player.hp += 10; } },
    pojie: { n: '破劫丹', g: '劫', r: 'rare', d: '使目标眩晕 1 回合，并造成 20 点伤害。', target: true, use: (b, t) => { b.addStatus(t, 'stun', 1); b.hurt(t, 20, b.player, {}); b.checkWin(); } },
  };

  /* ---------------- 境界 ---------------- */
  const REALMS = [
    { name: '练气', place: '青云山', tint: '#2c4a3a', desc: '山林妖兽出没，灵气初开。' },
    { name: '筑基', place: '幽冥谷', tint: '#45283f', desc: '阴风惨惨，尸傀游荡。' },
    { name: '金丹', place: '北海之滨', tint: '#1f3d5c', desc: '寒潮万里，蛟龙潜渊。' },
    { name: '元婴', place: '九幽魔域', tint: '#4d2323', desc: '魔焰滔天，心魔滋生。' },
    { name: '化神', place: '九霄雷池', tint: '#3d3a1f', desc: '天劫将至，万雷齐鸣。' },
  ];

  /* ---------------- 敌人 ----------------
     moves 字段：dmg hits block apply(施于玩家) self heal cards[{id,n,to}] summon[] intent(覆盖图标) */
  const ENEMIES = {};
  function en(id, name, g, el, hp, moves, pattern, o) {
    ENEMIES[id] = Object.assign({ id, name, g, el, hp, moves, pattern }, o || {});
  }
  // 练气
  en('fox', '灵狐', '狐', '木', [20, 24], { bite: { n: '撕咬', dmg: 6 }, charm: { n: '媚惑', block: 5, apply: { weak: 1 } } }, ['bite', 'charm', 'bite']);
  en('spider', '毒蛛', '蛛', '木', [22, 26], { web: { n: '结网', dmg: 4, apply: { weak: 1 } }, venom: { n: '毒牙', dmg: 5, apply: { poison: 3 } } }, ['venom', 'web', 'venom']);
  en('mandrill', '山魈', '魈', '土', [26, 30], { roar: { n: '咆哮', self: { str: 2 } }, slam: { n: '猛砸', dmg: 9 } }, ['roar', 'slam', 'slam']);
  en('wisp', '鬼火', '火', '火', [14, 18], { spark: { n: '火星', dmg: 3, hits: 2 }, flick: { n: '飘忽', dmg: 5 } }, ['spark', 'flick']);
  en('ghoul', '饿鬼', '鬼', '', [24, 28], { scratch: { n: '抓挠', dmg: 7 }, moan: { n: '哀嚎', cards: [{ id: 'zanian', n: 1, to: 'discard' }] } }, ['scratch', 'moan', 'scratch']);
  en('sapling', '树苗', '苗', '木', [10, 12], { wither: { n: '枯藤', dmg: 4 } }, ['wither']);
  en('bear', '铁背熊妖', '熊', '土', [62, 68], { maul: { n: '熊掌', dmg: 14 }, roar: { n: '怒吼', block: 12, self: { str: 1 } }, swipe: { n: '横扫', dmg: 8, apply: { vuln: 1 } } }, ['roar', 'maul', 'swipe', 'maul'], { tier: 'elite' });
  en('cultist', '魔教弟子', '邪', '火', [52, 58], { chant: { n: '祭炼', self: { str: 3 } }, stab: { n: '连刺', dmg: 6, hits: 2 }, slash: { n: '血斩', dmg: 12 } }, ['stab', 'slash', 'stab'], { tier: 'elite', intro: ['chant'] });
  en('treant', '千年树妖', '树', '木', [100, 108], {
    entangle: { n: '缠绕', dmg: 10, apply: { weak: 1 } }, spore: { n: '毒孢', block: 8, apply: { poison: 4 } },
    grow: { n: '疯长', block: 10, self: { str: 2 } }, summon: { n: '唤苗', summon: ['sapling'], block: 6 },
  }, ['entangle', 'spore', 'grow', 'entangle', 'summon'], { tier: 'boss', half: { self: { str: 3 }, block: 15, msg: '树妖狂暴！' } });
  // 筑基
  en('skeleton', '骷髅兵', '骷', '', [34, 38], { slash: { n: '劈砍', dmg: 9 }, guard: { n: '举盾', block: 9 } }, ['slash', 'guard', 'slash']);
  en('zombie', '尸傀', '尸', '土', [46, 52], { bite: { n: '撕咬', dmg: 12 }, groan: { n: '尸吼', apply: { weak: 2 } }, shamble: { n: '蹒跚', dmg: 8, block: 6 } }, ['groan', 'bite', 'shamble']);
  en('ghost', '阴魂', '魂', '水', [30, 34], { drain: { n: '汲魂', dmg: 6, apply: { frail: 1 } }, wail: { n: '鬼哭', apply: { weak: 2, vuln: 1 } } }, ['wail', 'drain', 'drain']);
  en('bat', '血蝠', '蝠', '', [22, 26], { bite: { n: '吸血', dmg: 5, heal: 5 }, swoop: { n: '俯冲', dmg: 4, hits: 2 } }, ['bite', 'swoop', 'swoop']);
  en('demonic', '魔修', '魔', '火', [42, 48], { chant: { n: '魔功', self: { str: 2 } }, blast: { n: '魔焰', dmg: 11 }, curse: { n: '种魔', cards: [{ id: 'xinmo', n: 1, to: 'discard' }] } }, ['chant', 'blast', 'curse', 'blast']);
  en('corpseking', '尸王', '王', '土', [92, 100], {
    smash: { n: '碎骨', dmg: 20 }, roar: { n: '尸吼', apply: { weak: 2 } }, rage: { n: '暴走', block: 15, self: { str: 3 } }, claw: { n: '双爪', dmg: 8, hits: 2 },
  }, ['roar', 'smash', 'claw', 'rage', 'smash'], { tier: 'elite' });
  en('bloodblade', '血剑客', '客', '火', [78, 84], { slash: { n: '血影双斩', dmg: 10, hits: 2 }, bleed: { n: '裂创', dmg: 6, apply: { vuln: 2 } }, rage: { n: '嗜血', block: 10, self: { str: 2 } } }, ['slash', 'bleed', 'rage', 'slash'], { tier: 'elite' });
  en('bloodfiend', '血魔老祖', '血', '火', [150, 160], {
    drain: { n: '吸血', dmg: 14, heal: 8 }, curse: { n: '血咒', apply: { vuln: 2 }, cards: [{ id: 'xinmo', n: 1, to: 'discard' }] },
    rain: { n: '血雨', dmg: 8, hits: 3 }, ritual: { n: '血祭', block: 15, self: { str: 3 } },
  }, ['drain', 'curse', 'rain', 'drain', 'ritual', 'rain'], { tier: 'boss', half: { self: { str: 3 }, block: 20, msg: '血魔怒燃！' } });
  // 金丹
  en('wyrm', '蛟龙幼崽', '蛟', '水', [54, 60], { breath: { n: '龙息', dmg: 12 }, coil: { n: '盘绕', block: 12, self: { str: 1 } }, tail: { n: '摆尾', dmg: 9, apply: { weak: 1 } } }, ['tail', 'breath', 'coil', 'breath']);
  en('clam', '冰蚌精', '蚌', '水', [50, 56], { clamp: { n: '夹击', dmg: 14 }, shell: { n: '闭壳', block: 20, self: { thorns: 3 } }, open: { n: '开壳', dmg: 8, apply: { frail: 2 } } }, ['open', 'shell', 'clamp']);
  en('siren', '海妖', '妖', '水', [48, 54], { song: { n: '惑心曲', apply: { vuln: 2, weak: 1 } }, claw: { n: '双爪', dmg: 8, hits: 2 }, lure: { n: '魅音', dmg: 6, cards: [{ id: 'zanian', n: 1, to: 'discard' }] } }, ['song', 'claw', 'lure', 'claw']);
  en('scorpion', '寒霜蝎', '蝎', '水', [46, 52], { sting: { n: '毒刺', dmg: 8, apply: { poison: 4 } }, freeze: { n: '冰封', block: 8, apply: { frail: 2 } }, strike: { n: '蝎尾', dmg: 14 } }, ['sting', 'freeze', 'strike']);
  en('turtle', '玄龟', '龟', '土', [100, 108], { shell: { n: '缩壳', block: 25, self: { thorns: 3 } }, bite: { n: '重咬', dmg: 18 }, slam: { n: '撞击', dmg: 12, apply: { weak: 2 } } }, ['shell', 'bite', 'slam', 'bite'], { tier: 'elite' });
  en('icefairy', '冰魄仙子', '仙', '水', [88, 94], {
    frost: { n: '寒霜', dmg: 8, apply: { weak: 2, vuln: 2 } }, shard: { n: '冰刃', dmg: 6, hits: 3 },
    blizzard: { n: '暴风雪', dmg: 14, apply: { frail: 2 }, cards: [{ id: 'zanian', n: 1, to: 'discard' }] },
  }, ['frost', 'shard', 'blizzard', 'shard'], { tier: 'elite' });
  en('dragon', '北海蛟龙', '龙', '水', [200, 210], {
    tidal: { n: '巨浪', dmg: 16 }, roar: { n: '龙吟', apply: { weak: 2, vuln: 2, frail: 2 } }, coil: { n: '盘踞', block: 20, self: { str: 2 } },
    sweep: { n: '龙尾横扫', dmg: 8, hits: 3 }, ice: { n: '玄冰吐息', dmg: 12, apply: { frail: 2 } },
  }, ['roar', 'tidal', 'sweep', 'coil', 'ice', 'tidal'], { tier: 'boss', half: { self: { str: 4 }, block: 20, msg: '蛟龙暴怒！' } });
  // 元婴
  en('general', '魔将', '将', '土', [72, 80], { cleave: { n: '断岳斩', dmg: 16 }, banner: { n: '魔旗', self: { str: 3 } }, guard: { n: '魔甲', block: 18 } }, ['banner', 'cleave', 'guard', 'cleave']);
  en('phantom', '心魔幻影', '幻', '', [60, 66], { whisper: { n: '蛊惑', apply: { weak: 2, vuln: 2 } }, strike: { n: '幻刺', dmg: 8, hits: 2 }, dream: { n: '梦魇', cards: [{ id: 'xinmo', n: 1, to: 'discard' }] } }, ['whisper', 'strike', 'dream', 'strike']);
  en('flame', '炎魔', '炎', '火', [66, 72], { inferno: { n: '业火', dmg: 10, apply: { burn: 4 } }, scorch: { n: '灼烧', dmg: 8, hits: 2 }, ember: { n: '炎潮', block: 10, self: { str: 2 } } }, ['ember', 'inferno', 'scorch']);
  en('puppet', '傀儡', '傀', '', [80, 88], { crush: { n: '碾压', dmg: 18 }, brace: { n: '固守', block: 20 }, gears: { n: '齿轮', dmg: 6, hits: 3 } }, ['brace', 'crush', 'gears', 'crush']);
  en('thunderbeast', '雷兽', '兽', '火', [132, 140], { bolt: { n: '雷爪', dmg: 14, hits: 2 }, charge: { n: '蓄雷', self: { str: 3 }, intent: 'charge' }, thunder: { n: '天雷', dmg: 30 } }, ['bolt', 'charge', 'thunder', 'bolt'], { tier: 'elite' });
  en('demonlord', '魔尊分身', '尊', '火', [126, 134], {
    devour: { n: '吞噬', dmg: 22, heal: 10 }, curse: { n: '魔咒', apply: { vuln: 3 }, cards: [{ id: 'xinmo', n: 2, to: 'discard' }] }, rage: { n: '魔化', block: 15, self: { str: 3 } },
  }, ['curse', 'devour', 'rage', 'devour'], { tier: 'elite' });
  en('innerdemon', '心魔', '魔', '', [240, 250], {
    whisper: { n: '惑心', apply: { weak: 2, vuln: 2, frail: 2 } }, devour: { n: '噬心', dmg: 10, hits: 3 },
    nightmare: { n: '梦魇', cards: [{ id: 'xinmo', n: 2, to: 'draw' }] }, empower: { n: '魔化', block: 20, self: { str: 4 } },
    void: { n: '虚无', dmg: 28 },
  }, ['whisper', 'devour', 'nightmare', 'empower', 'devour', 'void'], { tier: 'boss', half: { self: { str: 4 }, block: 25, msg: '心魔吞噬了你的执念！' } });
  // 化神
  en('spirit', '雷灵', '灵', '火', [82, 90], { zap: { n: '雷击', dmg: 8, hits: 3 }, static: { n: '静电', dmg: 6, apply: { vuln: 2 } }, charge: { n: '聚雷', block: 15, self: { str: 2 } } }, ['zap', 'static', 'charge', 'zap']);
  en('soldier', '天兵', '兵', '金', [92, 100], { spear: { n: '天戈', dmg: 18 }, shield: { n: '天盾', block: 25 }, formation: { n: '锁仙阵', dmg: 10, apply: { weak: 2, frail: 2 } } }, ['shield', 'spear', 'formation', 'spear']);
  en('cloud', '劫云', '云', '水', [100, 108], { rain: { n: '雷雨', dmg: 6, hits: 4 }, gather: { n: '聚云', block: 20, self: { growth: 2 } }, lightning: { n: '落雷', dmg: 20, apply: { burn: 3 } } }, ['gather', 'rain', 'lightning', 'rain']);
  en('golden', '金甲卫', '甲', '土', [110, 118], { smash: { n: '金锤', dmg: 22 }, guard: { n: '金刚阵', block: 30 }, stomp: { n: '践踏', dmg: 12, apply: { vuln: 2 } } }, ['guard', 'smash', 'stomp']);
  en('heavengeneral', '天将', '将', '金', [165, 175], { halberd: { n: '方天画戟', dmg: 24 }, roar: { n: '天威', self: { str: 3 } }, sweep: { n: '横扫千军', dmg: 12, hits: 2, apply: { vuln: 2 } } }, ['roar', 'halberd', 'sweep', 'halberd'], { tier: 'elite' });
  en('thunderlord', '雷公', '公', '火', [155, 165], { strike: { n: '连环雷', dmg: 9, hits: 4 }, gather: { n: '聚雷', block: 20, self: { str: 3 } }, judge: { n: '天罚', dmg: 34 } }, ['strike', 'gather', 'strike', 'judge'], { tier: 'elite' });
  en('tribulation', '九九天劫', '劫', '火', [310, 320], {
    thunder: { n: '天雷', dmg: 8, hits: 4 }, cloud: { n: '劫云', block: 30, self: { str: 2 } },
    mind: { n: '心魔劫', apply: { vuln: 2, weak: 2 }, cards: [{ id: 'xinmo', n: 2, to: 'discard' }] },
    charge: { n: '蓄力', self: { str: 2 }, intent: 'charge' }, doom: { n: '灭世神雷', dmg: 45 },
  }, ['thunder', 'cloud', 'mind', 'thunder', 'charge', 'doom'], { tier: 'boss', half: { self: { str: 5 }, block: 40, msg: '第九道天雷降下！' } });

  const ENCOUNTERS = [
    { easy: [['fox'], ['spider'], ['wisp', 'wisp'], ['ghoul']], hard: [['mandrill'], ['fox', 'wisp'], ['spider', 'ghoul'], ['ghoul', 'wisp', 'wisp'], ['mandrill', 'wisp']], elite: [['bear'], ['cultist']], boss: ['treant'] },
    { easy: [['skeleton', 'skeleton'], ['bat', 'bat'], ['ghost']], hard: [['zombie'], ['demonic'], ['skeleton', 'bat', 'bat'], ['ghost', 'skeleton'], ['demonic', 'bat']], elite: [['corpseking'], ['bloodblade']], boss: ['bloodfiend'] },
    { easy: [['wyrm'], ['clam'], ['scorpion', 'scorpion']], hard: [['siren', 'wyrm'], ['clam', 'scorpion'], ['siren', 'scorpion', 'scorpion'], ['wyrm', 'wyrm']], elite: [['turtle'], ['icefairy']], boss: ['dragon'] },
    { easy: [['flame', 'phantom'], ['general'], ['puppet']], hard: [['flame', 'flame', 'phantom'], ['general', 'phantom'], ['puppet', 'flame'], ['phantom', 'phantom', 'flame']], elite: [['thunderbeast'], ['demonlord']], boss: ['innerdemon'] },
    { easy: [['spirit', 'spirit'], ['soldier'], ['cloud']], hard: [['soldier', 'spirit'], ['golden', 'spirit'], ['cloud', 'cloud'], ['golden', 'cloud']], elite: [['heavengeneral'], ['thunderlord']], boss: ['tribulation'] },
  ];

  /* ---------------- 奇遇 ----------------
     choices(run) → [{label, can?, do(run) → {text, then?}}]
     then: {t:'pick',mode:'remove'|'upgrade'} {t:'cards',ids} {t:'battle',elite:true} {t:'relic',rarity} */
  const EVENTS = [
    {
      id: 'spring', title: '荒山灵泉', text: '山道尽头，一汪灵泉氤氲着淡淡雾气，泉水中隐隐有灵光流转。',
      choices: (r) => [
        { label: '饮泉疗伤（回复 25% 最大气血）', do: () => { const n = Math.floor(r.maxHp * 0.25); r.heal(n); return { text: `泉水清冽甘甜，你回复了 ${n} 点气血。` }; } },
        { label: '沐浴洗髓（最大气血 +6，失去 8 点气血）', do: () => { r.loseHp(8); r.gainMaxHp(6); return { text: '灵泉洗炼筋骨，你觉得根基更加稳固，只是有些虚弱。' }; } },
        { label: '不为所动，继续赶路', do: () => ({ text: '你按捺住好奇心，径直离去。' }) },
      ],
    },
    {
      id: 'corpse', title: '无名遗骸', text: '路旁一具枯骨盘膝而坐，手中仍握着一只褪色的储物袋。',
      choices: (r) => [
        { label: '搜刮遗物', do: () => { const g = r.rng.range(55, 85); r.gainGold(g); if (r.rng.chance(0.4)) { r.addCard('xinmo'); return { text: `你搜得 ${g} 灵石，但一缕残念钻入识海——获得「心魔」。` }; } return { text: `你搜得 ${g} 灵石。` }; } },
        { label: '为其超度', do: () => { const got = r.gainRandomPotion(); return { text: got ? '枯骨化作飞灰，留下一瓶丹药。' : '枯骨化作飞灰，你的丹药栏已满。' }; } },
      ],
    },
    {
      id: 'oldman', title: '神秘老者', text: '一位白发老者拦住去路，笑眯眯地打量着你：“小友，可愿论道一番？”',
      choices: (r) => [
        { label: '请教功法（支付 30 灵石，淬炼一张牌）', can: () => r.gold >= 30, do: () => { r.gold -= 30; return { text: '老者点拨数语，令你受益匪浅。', then: { t: 'pick', mode: 'upgrade' } }; } },
        { label: '献上丹药（失去一瓶丹药，获得一件法宝）', can: () => r.potions.some(Boolean), do: () => { const i = r.potions.findIndex(Boolean); r.potions[i] = null; r.gainRandomRelic(); return { text: '老者抚须大笑，赠你一件法宝。' }; } },
        { label: '婉言谢绝', do: () => ({ text: '老者摇头轻叹，消失在山雾中。' }) },
      ],
    },
    {
      id: 'demon', title: '魔修交易', text: '一名黑袍魔修低声道：“以血换功，公平买卖，如何？”',
      choices: (r) => [
        { label: '接受（失去 12 点气血，获得一张稀有功法）', can: () => r.hp > 14, do: () => { r.loseHp(12); return { text: '魔修丢来一卷血色玉简。', then: { t: 'cards', rarity: 'rare', n: 3 } }; } },
        { label: '断然拒绝', do: () => ({ text: '你拂袖而去，身后传来冷笑。' }) },
      ],
    },
    {
      id: 'gamble', title: '天机赌局', text: '路边摊位上，一名道人摇着卦筒：“押上灵石，一卦定乾坤。”',
      choices: (r) => [
        { label: '押注 40 灵石（45% 赢得 100 灵石）', can: () => r.gold >= 40, do: () => { if (r.rng.chance(0.45)) { r.gainGold(100); return { text: '卦象大吉！你赢得了 100 灵石。' }; } r.gold -= 40; return { text: '卦象大凶……40 灵石打了水漂。' }; } },
        { label: '不赌为妙', do: () => ({ text: '你摇摇头，转身离开。' }) },
      ],
    },
    {
      id: 'mirror', title: '心魔镜', text: '山洞深处立着一面古镜，镜中的“你”正冷冷地看着你，嘴角带着一丝笑意。',
      choices: (r) => [
        { label: '直面心魔（战斗，胜利后获得法宝）', do: () => ({ text: '镜中人破镜而出！', then: { t: 'battle', elite: true, relic: true } }) },
        { label: '闭目回避（失去 8 点气血）', do: () => { r.loseHp(8); return { text: '你紧闭双眼，冷汗涔涔地退出山洞。' }; } },
      ],
    },
    {
      id: 'tablet', title: '上古石碑', text: '断崖之上矗立着一块残碑，碑文晦涩，却隐含大道至理。',
      choices: (r) => [
        { label: '参悟碑文（移除一张牌）', do: () => ({ text: '你静心参悟，去芜存菁。', then: { t: 'pick', mode: 'remove' } }) },
        { label: '拓印碑文（三选一功法）', do: () => ({ text: '你小心拓下碑文。', then: { t: 'cards', n: 3 } }) },
        { label: '离开', do: () => ({ text: '你看了一眼便离开了。' }) },
      ],
    },
    {
      id: 'herb', title: '灵药园', text: '一片灵药园中药香扑鼻，一头守园灵兽正在打盹。',
      choices: (r) => [
        { label: '强行采摘（失去 10 点气血，获得两瓶丹药）', can: () => r.hp > 12, do: () => { r.loseHp(10); r.gainRandomPotion(); r.gainRandomPotion(); return { text: '灵兽惊醒扑来，你抓了两株灵药狼狈逃走。' }; } },
        { label: '悄悄采摘（获得一瓶丹药）', do: () => { const ok = r.gainRandomPotion(); return { text: ok ? '你屏息凝神，顺利采得一株灵药。' : '你的丹药栏已满，只能空手而归。' }; } },
      ],
    },
    {
      id: 'altar', title: '残破祭坛', text: '荒废的祭坛上刻满血色符文，隐隐传来低语：“献祭……献祭……”',
      choices: (r) => [
        { label: '献血（失去 10 点气血，获得一件法宝）', can: () => r.hp > 12, do: () => { r.loseHp(10); r.gainRandomRelic(); return { text: '祭坛吸饱了鲜血，吐出一件法宝。' }; } },
        { label: '献金（支付 60 灵石，淬炼两张随机牌）', can: () => r.gold >= 60, do: () => { r.gold -= 60; const n = r.upgradeRandom(2); return { text: `符文流转，你的 ${n} 张功法得到了淬炼。` }; } },
        { label: '转身离去', do: () => ({ text: '你不愿与邪祭为伍。' }) },
      ],
    },
    {
      id: 'beast', title: '受伤灵兽', text: '一只白毛灵兽蜷缩在草丛中，后腿血肉模糊，正用湿漉漉的眼睛望着你。',
      choices: (r) => [
        { label: '救治（支付 25 灵石，最大气血 +8）', can: () => r.gold >= 25, do: () => { r.gold -= 25; r.gainMaxHp(8); return { text: '灵兽痊愈后蹭了蹭你的手，留下一缕灵息。' }; } },
        { label: '取其内丹（获得 60 灵石）', do: () => { r.gainGold(60); return { text: '你狠下心取走内丹，灵兽悲鸣而逝。' }; } },
        { label: '不予理会', do: () => ({ text: '你叹了口气，径自离开。' }) },
      ],
    },
    {
      id: 'scroll', title: '残卷', text: '树洞里藏着一卷残破的功法，字迹殷红，透着不祥之气。',
      choices: (r) => [
        { label: '参悟（获得一张稀有功法，但染上「心魔」）', do: () => { r.addCard('xinmo'); return { text: '你强行参悟，识海中魔念丛生。', then: { t: 'cards', rarity: 'rare', n: 3 } }; } },
        { label: '焚毁残卷（获得 30 灵石）', do: () => { r.gainGold(30); return { text: '残卷在火中蜷曲成灰，你在灰烬里找到了几块灵石。' }; } },
      ],
    },
  ];

  /* ---------------- 突破奖励 ---------------- */
  const BREAKTHROUGH = [
    { id: 'body', n: '淬体', d: '最大气血 +12。', do: (r) => r.gainMaxHp(12) },
    { id: 'insight', n: '悟道', d: '从三张稀有功法中选择一张。', do: (r) => ({ t: 'cards', rarity: 'rare', n: 3 }) },
    { id: 'marrow', n: '洗髓', d: '随机淬炼三张功法。', do: (r) => { r.upgradeRandom(3); } },
    { id: 'wealth', n: '天材地宝', d: '获得 150 灵石与一瓶丹药。', do: (r) => { r.gainGold(150); r.gainRandomPotion(); } },
    { id: 'artifact', n: '祭炼法宝', d: '获得一件随机法宝。', do: (r) => { r.gainRandomRelic(); } },
    { id: 'purge', n: '断念', d: '移除一张牌。', do: (r) => ({ t: 'pick', mode: 'remove' }) },
  ];

  /* ---------------- 传承（局外成长） ---------------- */
  const META = [
    { id: 'hp', n: '先天道体', d: '开局最大气血 +4 / 级', max: 5, cost: (l) => 25 + 20 * l },
    { id: 'gold', n: '家底殷实', d: '开局灵石 +25 / 级', max: 3, cost: (l) => 20 + 20 * l },
    { id: 'potion', n: '药童相随', d: '开局携带一瓶随机丹药', max: 1, cost: () => 40 },
    { id: 'insight', n: '天资聪颖', d: '开局随机淬炼一张起始功法', max: 1, cost: () => 60 },
    { id: 'choice', n: '机缘深厚', d: '战斗后的功法奖励多一个选项', max: 1, cost: () => 100 },
    { id: 'relic', n: '传家之宝', d: '开局获得一件随机普通法宝', max: 1, cost: () => 120 },
    { id: 'mage', n: '解锁·法修', d: '解锁「法修」道途', max: 1, cost: () => 40, unlock: 'mage' },
    { id: 'alch', n: '解锁·丹修', d: '解锁「丹修」道途', max: 1, cost: () => 70, unlock: 'alch' },
  ];

  const ASCENSION_TEXT = [
    '无劫数：标准难度。',
    '劫数一：敌人气血 +10%，伤害 +6%。',
    '劫数二：敌人气血 +20%，伤害 +12%。',
    '劫数三：敌人气血 +30%，伤害 +18%。',
    '劫数四：敌人气血 +40%，伤害 +24%。',
    '劫数五：敌人气血 +50%，伤害 +30%。',
  ];

  Object.assign(XX, {
    ELEMENTS, SHENG_BONUS, KE_BONUS, STATUS, CARDS, CLASSES, RELICS, POTIONS, REALMS, ENEMIES, ENCOUNTERS, EVENTS, BREAKTHROUGH, META, ASCENSION_TEXT,
  });
})(typeof window !== 'undefined' ? window : globalThis);
