/* 问道长生 - 界面层：DOM 渲染、交互、动效、音效 */
(function (G) {
  'use strict';
  const XX = G.XX, D = document;
  const { CARDS, CLASSES, RELICS, POTIONS, REALMS, STATUS, ELEMENTS, META, BREAKTHROUGH, ASCENSION_TEXT, Run, Meta, view, cardText, canUpgrade } = XX;

  let run = null;
  let meta = Meta.load();
  const ui = { screen: 'title', sel: null, potSel: null, busy: false, modal: null, pickSel: null, cls: 'sword', asc: 0, lastBattle: null, lastTurn: 0, muted: false };
  try { ui.muted = G.localStorage.getItem('xianxia.muted') === '1'; } catch (e) { /* ignore */ }

  const app = D.getElementById('app'), tipEl = D.getElementById('tip'), fxLayer = D.getElementById('fxlayer');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tipAttr = (name, desc) => `data-tip="${esc(name)}|${esc(desc)}"`;

  const NODE_G = { battle: '战', elite: '精', event: '奇', shop: '市', rest: '洞', chest: '宝', boss: '劫' };
  const NODE_N = { battle: '妖兽出没', elite: '妖王镇守', event: '奇遇', shop: '坊市', rest: '洞府', chest: '机缘宝箱', boss: '突破之劫' };
  const TYPE_N = { atk: '攻击', skl: '技能', pow: '功法' };
  const RAR_N = { starter: '起始', common: '普通', uncommon: '罕见', rare: '稀有', status: '状态', curse: '诅咒' };
  const INTENT_G = { atk: '攻', def: '守', debuff: '咒', buff: '强', summon: '召', stun: '晕', charge: '蓄' };
  const INTENT_N = { atk: '攻击', def: '防御', debuff: '施咒', buff: '强化', summon: '召唤', stun: '眩晕', charge: '蓄力' };
  const CYCLE = ['木', '火', '土', '金', '水'];

  /* ================= 音效（WebAudio 合成） ================= */
  let actx = null;
  function sfx(kind) {
    if (ui.muted) return;
    try {
      actx = actx || new (G.AudioContext || G.webkitAudioContext)();
      const t0 = actx.currentTime;
      const tone = (f, dur, type, vol, slide, delay) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = t0 + (delay || 0);
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
        g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
      };
      switch (kind) {
        case 'card': tone(520, 0.07, 'triangle', 0.05, 380); break;
        case 'hit': tone(180, 0.16, 'sawtooth', 0.09, 60); break;
        case 'hurt': tone(120, 0.24, 'square', 0.09, 45); break;
        case 'block': tone(700, 0.09, 'square', 0.05, 900); break;
        case 'heal': tone(440, 0.12, 'sine', 0.06, 660); tone(660, 0.16, 'sine', 0.05, 880, 0.08); break;
        case 'sheng': tone(660, 0.1, 'sine', 0.06, 990); tone(990, 0.16, 'sine', 0.05, 1320, 0.07); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.07, 0, i * 0.11)); break;
        case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sine', 0.08, 0, i * 0.18)); break;
        case 'ui': tone(600, 0.05, 'sine', 0.04, 500); break;
        case 'buy': tone(880, 0.08, 'triangle', 0.06); tone(1175, 0.1, 'triangle', 0.05, 0, 0.06); break;
      }
    } catch (e) { /* 音频不可用则忽略 */ }
  }

  /* ================= 小部件 ================= */
  const elColor = (el) => (el && ELEMENTS[el] ? ELEMENTS[el].color : '#8a8f9a');
  function statusHtml(ent) {
    return Object.keys(ent.st).filter((k) => STATUS[k] && ent.st[k]).map((k) => {
      const S = STATUS[k], n = ent.st[k];
      return `<span class="st ${S.good ? 'good' : 'bad'}" ${tipAttr(S.n + ' ' + n, S.d.replace(/N/g, n))}>${S.g}<i>${n}</i></span>`;
    }).join('');
  }
  function hpBar(ent) {
    const pct = Math.max(0, Math.min(100, (ent.hp / ent.maxHp) * 100));
    return `<div class="hpbar"><i style="width:${pct}%"></i><span>${Math.max(0, ent.hp)} / ${ent.maxHp}</span></div>`;
  }
  function relicHtml(id, extra) {
    const r = RELICS[id];
    return `<span class="relic r-${r.r}" ${tipAttr(r.n, r.d)} ${extra || ''}>${r.g}</span>`;
  }
  function potionHtml(id, slot, clickable) {
    if (!id) return `<span class="potion empty" ${tipAttr('空丹药栏', '可以携带丹药，战斗中使用。')}></span>`;
    const p = POTIONS[id];
    return `<span class="potion p-${p.r}" ${clickable ? `data-act="potion" data-slot="${slot}"` : ''} ${tipAttr(p.n, p.d)}>${p.g}</span>`;
  }
  function cardHtml(c, o) {
    o = o || {};
    const v = view(c.id, c.up), d = CARDS[c.id], b = o.b;
    const junk = d.rarity === 'status' || d.rarity === 'curse';
    let cost = o.hand && b ? b.cardCost(c) : (v.x ? 'X' : v.cost);
    const cls = ['card', v.type, d.rarity];
    if (junk) cls.push('junk');
    if (o.dim) cls.push('dim');
    if (o.sheng) cls.push('sheng');
    if (o.sel) cls.push('sel');
    if (v.upgraded) cls.push('upg');
    if (o.fresh) cls.push('fresh');
    if (o.small) cls.push('small');
    const costCls = cost !== 'X' && cost < v.cost ? 'cost less' : 'cost';
    return `<div class="${cls.join(' ')}" ${o.attrs || ''} style="--el:${elColor(v.el)};${o.style || ''}">
      <div class="${costCls}">${junk ? '·' : cost}</div>${v.el ? `<div class="elb">${v.el}</div>` : ''}
      <div class="cname">${v.name}</div>
      <div class="art"><span>${d.g || d.name[0]}</span></div>
      <div class="ctype">${TYPE_N[v.type]} · ${RAR_N[d.rarity]}</div>
      <div class="cdesc"><p>${cardText(v, o.hand ? b : null)}</p></div>
      ${o.tag ? `<div class="ctag">${o.tag}</div>` : ''}
    </div>`;
  }
  const chainHtml = (b) => {
    const nextEl = b.lastEl ? ELEMENTS[b.lastEl].gen : '';
    const all = b.player.st.nextSheng > 0;
    return `<div class="chain" ${tipAttr('五行流转', '木生火，火生土，土生金，金生水，水生木。打出的牌若被上一张牌的五行所生，即触发「相生」，伤害与护体大幅提升。')}>` +
      CYCLE.map((e, i) => `<span class="cel ${b.lastEl === e ? 'last' : ''} ${nextEl === e || all ? 'next' : ''}" style="--el:${elColor(e)}">${e}</span>${i < 4 ? '<i>›</i>' : ''}`).join('') + '</div>';
  };
  function moveDesc(b, e, m) {
    const p = [];
    if (m.dmg) p.push(`攻击 ${b.calcDamage(e, b.player, m.dmg)} 点${(m.hits || 1) > 1 ? '×' + m.hits : ''}`);
    if (m.block) p.push(`获得 ${m.block} 点护体`);
    if (m.heal) p.push(`回复 ${m.heal} 点气血`);
    if (m.apply) p.push('使你获得 ' + Object.keys(m.apply).map((k) => `${m.apply[k]}层${STATUS[k].n}`).join('、'));
    if (m.self) p.push('自身获得 ' + Object.keys(m.self).map((k) => `${m.self[k]}层${STATUS[k].n}`).join('、'));
    if (m.cards) p.push('向你的牌堆塞入 ' + m.cards.map((c) => `${c.n}张「${CARDS[c.id].name}」`).join('、'));
    if (m.summon) p.push('召唤援军');
    return p.join('；') || '蓄势待发';
  }
  function intentHtml(b, e) {
    if (e.dead) return '';
    const it = b.intentOf(e), m = e.def.moves[e.move];
    const tip = tipAttr(it.name, m ? moveDesc(b, e, m) : '');
    const dmg = it.dmg != null ? `<b>${it.dmg}${it.hits > 1 ? '×' + it.hits : ''}</b>` : '';
    return `<div class="intent" ${tip}>${it.icons.map((k) => `<span class="ii ${k}">${INTENT_G[k]}</span>`).join('')}${dmg}<em>${it.name}</em></div>`;
  }
  function enemyHtml(e, b) {
    const target = (ui.sel != null || ui.potSel != null) && !e.dead;
    const elb = e.el ? `<i class="elb" style="--el:${elColor(e.el)}" ${tipAttr('属性：' + e.el, ELEMENTS[e.el].over ? `克制「${ELEMENTS[e.el].over}」，被「${Object.keys(ELEMENTS).find((k) => ELEMENTS[k].over === e.el)}」克制。` : '')}>${e.el}</i>` : '';
    return `<div class="enemy ${e.tier} ${e.dead ? 'dead' : ''} ${target ? 'targetable' : ''}" data-uid="${e.uid}" data-act="enemy">
      <div class="intent-row">${intentHtml(b, e)}</div>
      <div class="avatar" style="--el:${elColor(e.el)}"><span>${e.g}</span>${elb}${e.block ? `<div class="blk" ${tipAttr('护体', '优先抵挡伤害。')}>${e.block}</div>` : ''}</div>
      <div class="ename">${e.name}${e.tier !== 'normal' ? `<small>${e.tier === 'boss' ? '劫主' : '妖王'}</small>` : ''}</div>
      ${hpBar(e)}<div class="sts">${statusHtml(e)}</div></div>`;
  }

  /* ================= 顶栏 ================= */
  function topbarHtml() {
    const c = CLASSES[run.cls], rl = REALMS[run.realm];
    return `<header class="topbar">
      <div class="tb-id"><span class="badge" style="--c:${c.color}">${c.g}</span><div><b>${c.name}</b><small>${rl.name} · ${rl.place}${run.asc ? ` · 劫数${run.asc}` : ''}</small></div></div>
      <div class="tb-stats"><span class="hp" ${tipAttr('气血', '归零则陨落。')}>♥ ${run.phase === 'battle' && run.battle ? run.battle.player.hp : run.hp}<small>/${run.maxHp}</small></span><span class="gold" ${tipAttr('灵石', '在坊市购买功法、法宝与丹药。')}>◆ ${run.gold}</span></div>
      <div class="tb-potions">${run.potions.map((p, i) => potionHtml(p, i, true)).join('')}</div>
      <div class="tb-relics">${run.relics.map((id) => relicHtml(id)).join('')}</div>
      <div class="tb-btns"><button class="ib" data-act="deck" ${tipAttr('牌库', '查看当前所有功法')}>牌库<i>${run.deck.length}</i></button><button class="ib" data-act="menu">☰</button></div>
    </header>`;
  }

  /* ================= 各屏幕 ================= */
  function titleHtml() {
    const has = !!XX.loadRun();
    return `<div class="title-screen">
      <div class="moon"></div>
      <svg class="mount m1" viewBox="0 0 800 200" preserveAspectRatio="none"><path d="M0 200 L0 120 L90 60 L170 110 L260 30 L360 120 L450 70 L560 140 L650 50 L740 110 L800 80 L800 200Z"/></svg>
      <svg class="mount m2" viewBox="0 0 800 200" preserveAspectRatio="none"><path d="M0 200 L0 150 L120 90 L220 140 L330 80 L430 150 L540 100 L640 160 L720 110 L800 150 L800 200Z"/></svg>
      <div class="title-box">
        <h1>问道长生</h1>
        <p class="sub">修仙肉鸽 · 卡牌构筑</p>
        <p class="poem">一念入道，万劫不磨。<br>自练气而化神，渡九九天劫，方得飞升。</p>
        <div class="menu">
          ${has ? '<button class="btn primary" data-act="continue">继续修行</button>' : ''}
          <button class="btn ${has ? '' : 'primary'}" data-act="new">${has ? '重新入道' : '开始修行'}</button>
          <button class="btn" data-act="meta">传承 <small>道果 ${meta.dao}</small></button>
          <button class="btn" data-act="help">玩法说明</button>
        </div>
        <p class="foot">${meta.runs ? `已修行 ${meta.runs} 世 · 飞升 ${meta.wins} 次` : '愿道友早日飞升'}</p>
      </div></div>`;
  }
  function selectHtml() {
    const asc = Math.min(ui.asc, meta.maxAsc);
    const cards = Object.keys(CLASSES).map((id) => {
      const c = CLASSES[id], ok = Meta.classUnlocked(meta, id);
      const r = RELICS[c.relic];
      return `<div class="class-card ${ui.cls === id ? 'on' : ''} ${ok ? '' : 'locked'}" ${ok ? `data-act="pick-class" data-cls="${id}"` : ''} style="--c:${c.color}">
        <div class="cg">${c.g}</div><h3>${c.name}</h3><p class="tag">${c.tag}</p><p>${c.desc}</p>
        <p class="meta">气血 ${c.hp + 4 * Meta.level(meta, 'hp')}　初始法宝：${r.n}</p><p class="meta relic-d">${r.d}</p>
        ${ok ? '' : '<div class="lock">未解锁 · 于「传承」中解锁</div>'}</div>`;
    }).join('');
    return `<div class="panel select"><h2>择一道途</h2><div class="class-row">${cards}</div>
      <div class="asc"><span>劫数</span><button class="ib" data-act="asc-" ${asc <= 0 ? 'disabled' : ''}>−</button><b>${asc}</b><button class="ib" data-act="asc+" ${asc >= meta.maxAsc ? 'disabled' : ''}>＋</button><em>${ASCENSION_TEXT[asc]}${meta.maxAsc === 0 ? '（飞升一次后解锁更高劫数）' : ''}</em></div>
      <div class="row-btns"><button class="btn" data-act="title">返回</button><button class="btn primary" data-act="start">入道</button></div></div>`;
  }
  function metaHtml() {
    const rows = META.map((m) => {
      const l = Meta.level(meta, m.id), max = l >= m.max;
      const dots = m.max > 1 ? `<span class="dots">${Array.from({ length: m.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</span>` : '';
      return `<div class="meta-row ${max ? 'max' : ''}"><div><b>${m.n}</b> ${dots}<p>${m.d}</p></div>
        <button class="btn sm" data-act="buy" data-id="${m.id}" ${max || !Meta.canBuy(meta, m) ? 'disabled' : ''}>${max ? '已达成' : `${m.cost(l)} 道果`}</button></div>`;
    }).join('');
    return `<div class="panel meta-panel"><h2>传承</h2><p class="dao">道果 <b>${meta.dao}</b><small>　每次陨落或飞升都会留下道果，用以强化后世修行。</small></p>${rows}
      <div class="row-btns"><button class="btn primary" data-act="title">返回</button></div></div>`;
  }
  function mapHtml() {
    const map = run.map, avail = new Set(run.availableNodes().map((n) => n.r + '_' + n.c)), done = new Set(run.path);
    const R = XX.MAP_ROWS + 1, W = XX.MAP_W;
    const P = (n) => ({ x: ((n.c + 0.5 + n.jx * 0.6) / W) * 100, y: 100 - ((n.r + 0.5 + n.jy * 0.5) / R) * 100 });
    let lines = '', nodes = '';
    map.forEach((row) => row.forEach((n) => {
      if (!n) return;
      const a = P(n);
      n.next.forEach((c) => {
        const t = map[n.r + 1][c]; if (!t) return;
        const b2 = P(t), on = done.has(n.r + '_' + n.c) && (avail.has(t.r + '_' + t.c) || done.has(t.r + '_' + t.c));
        lines += `<line x1="${a.x}" y1="${a.y}" x2="${b2.x}" y2="${b2.y}" class="${on ? 'on' : ''}"/>`;
      });
      const key = n.r + '_' + n.c, isCur = run.cur && run.cur.r === n.r && run.cur.c === n.c;
      const st = avail.has(key) ? 'avail' : isCur ? 'cur' : done.has(key) ? 'done' : 'far';
      const name = n.type === 'boss' ? REALMS[run.realm].name + '劫' : NODE_N[n.type];
      nodes += `<button class="node ${n.type} ${st}" style="left:${a.x}%;top:${a.y}%" ${st === 'avail' ? `data-act="node" data-r="${n.r}" data-c="${n.c}"` : 'tabindex="-1"'} ${tipAttr(name, n.type === 'boss' ? '击败劫主，突破境界。' : '')}><span>${n.type === 'boss' ? '劫' : NODE_G[n.type]}</span></button>`;
    }));
    const rl = REALMS[run.realm];
    const legend = ['battle', 'elite', 'event', 'shop', 'rest', 'chest'].map((t) => `<span><i class="node mini ${t}"><span>${NODE_G[t]}</span></i>${NODE_N[t]}</span>`).join('');
    return `<div class="map-screen"><div class="map-head"><h2>${rl.name}期 · ${rl.place}</h2><p>${rl.desc}　选择前路，直至突破境界。</p></div>
      <div class="map-wrap"><svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${nodes}</div>
      <div class="legend">${legend}</div></div>`;
  }
  function battleHtml() {
    const b = run.battle, p = b.player, c = CLASSES[run.cls];
    const myTurn = b.phase === 'player' && !ui.busy;
    const hand = b.hand.map((card, i) => {
      const chk = b.canPlay(i), n = b.hand.length, off = i - (n - 1) / 2;
      return cardHtml(card, {
        b, hand: true, dim: !chk.ok, sheng: chk.ok && b.shengActive(card), sel: ui.sel === i, fresh: b.fresh.has(card.u),
        attrs: `data-act="card" data-i="${i}"`, style: `--r:${(off * (n > 7 ? 2.6 : 3.6)).toFixed(2)}deg;--y:${(Math.abs(off) ** 2 * (n > 7 ? 1 : 1.6)).toFixed(1)}px;--i:${i}`,
      });
    }).join('');
    return `<div class="combat ${b.phase === 'enemy' ? 'enemy-turn' : ''}">
      <div class="field">
        <div class="pzone"><div class="player" data-uid="p"><div class="avatar" style="--el:${c.color}"><span>${c.g}</span>${p.block ? `<div class="blk">${p.block}</div>` : ''}</div>
          <div class="ename">${c.name}</div>${hpBar(p)}<div class="sts">${statusHtml(p)}</div></div>${chainHtml(b)}</div>
        <div class="enemies n${b.enemies.length}">${b.enemies.map((e) => enemyHtml(e, b)).join('')}</div>
      </div>
      ${ui.sel != null ? `<div class="hint">选择目标　<a data-act="cancel">取消</a></div>` : ui.potSel != null ? `<div class="hint">选择丹药目标　<a data-act="cancel">取消</a></div>` : ''}
      <div class="hud">
        <div class="side left"><div class="energy" ${tipAttr('灵力', '打出功法所需。每回合开始恢复。')}><b>${b.energy}</b><small>/${b.maxEnergy}</small></div>
          <button class="pile" data-act="pile" data-which="draw" ${tipAttr('抽牌堆', '点击查看剩余的牌（顺序已被打乱）')}>抽牌堆<i>${b.drawPile.length}</i></button></div>
        <div class="hand n${b.hand.length}">${hand}</div>
        <div class="side right"><button class="btn end ${myTurn ? '' : 'wait'}" data-act="end" ${myTurn ? '' : 'disabled'}>${b.phase === 'enemy' ? '敌方行动' : '结束回合'}</button>
          <button class="pile" data-act="pile" data-which="discard">弃牌堆<i>${b.discardPile.length}</i></button>
          ${b.exhaustPile.length ? `<button class="pile ex" data-act="pile" data-which="exhaust">消耗<i>${b.exhaustPile.length}</i></button>` : ''}</div>
      </div></div>`;
  }
  function rewardHtml() {
    const rw = run.reward, canPot = run.canGainPotion();
    const cards = rw.cardsDone ? '' : `<h3>选择一门功法</h3><div class="card-row">${rw.cards.map((id, i) => cardHtml({ id, up: false }, { attrs: `data-act="rw-card" data-i="${i}"` })).join('')}</div>
      <button class="btn sm" data-act="rw-skip">跳过</button>`;
    const pot = rw.potion ? `<div class="loot">${potionHtml(rw.potion, 0, false)}<span>${POTIONS[rw.potion].n}　<small>${POTIONS[rw.potion].d}</small></span>
      <button class="btn sm" data-act="rw-potion" ${rw.potionTaken || !canPot ? 'disabled' : ''}>${rw.potionTaken ? '已取' : canPot ? '取走' : '丹药栏已满'}</button></div>` : '';
    const rel = rw.relics.length ? `<h3>${rw.relicChoose ? '劫主遗宝 · 择一' : '妖王遗宝'}</h3>` + rw.relics.map((id, i) => `<div class="loot">${relicHtml(id)}<span>${RELICS[id].n}　<small>${RELICS[id].d}</small></span>
      <button class="btn sm" data-act="rw-relic" data-i="${i}" ${rw.relicTaken ? 'disabled' : ''}>${rw.relicTaken ? '—' : '取走'}</button></div>`).join('') : '';
    return `<div class="panel reward"><h2>${run.node && run.node.type === 'boss' ? '劫数已破' : '战胜'}</h2><p class="gold-line">◆ 获得 <b>${rw.gold}</b> 灵石</p>${pot}${rel}${cards}
      <div class="row-btns"><button class="btn primary" data-act="rw-leave">继续前行</button></div></div>`;
  }
  function shopHtml() {
    const s = run.shop;
    const item = (kind, it, i, inner) => `<div class="shop-item ${it.sold ? 'sold' : ''} ${run.gold < it.price ? 'poor' : ''}" data-act="buy-${kind}" data-i="${i}">${inner}<div class="price">${it.sale ? '<em>特价</em>' : ''}◆ ${it.price}</div></div>`;
    return `<div class="panel shop"><h2>坊市</h2><p class="gold-line">◆ 灵石 <b>${run.gold}</b></p>
      <h3>功法</h3><div class="shop-row">${s.cards.map((c, i) => item('cards', c, i, cardHtml({ id: c.id, up: false }, { small: true }))).join('')}</div>
      <h3>法宝与丹药</h3><div class="shop-row misc">${s.relics.map((r, i) => item('relics', r, i, `<div class="rl">${relicHtml(r.id)}<b>${RELICS[r.id].n}</b><small>${RELICS[r.id].d}</small></div>`)).join('')}
      ${s.potions.map((p, i) => item('potions', p, i, `<div class="rl">${potionHtml(p.id, 0, false)}<b>${POTIONS[p.id].n}</b><small>${POTIONS[p.id].d}</small></div>`)).join('')}</div>
      <h3>服务</h3><div class="shop-row misc"><div class="shop-item ${s.removed || run.gold < s.removeCost ? 'poor' : ''} ${s.removed ? 'sold' : ''}" data-act="shop-remove"><div class="rl"><span class="relic">焚</span><b>焚经断念</b><small>永久移除牌库中的一张牌</small></div><div class="price">◆ ${s.removeCost}</div></div></div>
      <div class="row-btns"><button class="btn primary" data-act="shop-leave">离开坊市</button></div></div>`;
  }
  function restHtml() {
    const can = run.canRestHeal(), n = Math.floor(run.maxHp * 0.3), ups = run.deck.filter(canUpgrade).length;
    return `<div class="panel restsite"><div class="fire"><i></i><i></i><i></i></div><h2>洞府</h2><p class="flavor">一处僻静洞府，灵气氤氲，可以静心修行。</p>
      <div class="rest-opts"><button class="btn big" data-act="rest-heal" ${can ? '' : 'disabled'}><b>打坐调息</b><small>${can ? `回复 ${n} 点气血（当前 ${run.hp}/${run.maxHp}）` : '业火缠身，无法静坐'}</small></button>
      <button class="btn big" data-act="rest-up" ${ups ? '' : 'disabled'}><b>参悟淬炼</b><small>淬炼一张功法，使其更强</small></button>
      <button class="btn big ghost" data-act="rest-skip"><b>不做停留</b><small>直接上路</small></button></div></div>`;
  }
  function eventHtml() {
    const ev = run.event;
    if (ev.outcome) return `<div class="panel event"><h2>${ev.title}</h2><p class="flavor">${ev.outcome.text}</p><div class="row-btns"><button class="btn primary" data-act="ev-go">继续</button></div></div>`;
    return `<div class="panel event"><h2>${ev.title}</h2><p class="flavor">${ev.text}</p><div class="ev-choices">${ev.choices.map((c, i) => {
      const dis = c.can && !c.can();
      return `<button class="btn big" data-act="ev-choice" data-i="${i}" ${dis ? 'disabled' : ''}>${c.label}${dis ? '（条件不足）' : ''}</button>`;
    }).join('')}</div></div>`;
  }
  function chestHtml() {
    const c = run.chest;
    if (!c.opened) return `<div class="panel chest"><h2>机缘宝箱</h2><div class="chest-box" data-act="chest-open"><span>宝</span></div><p class="flavor">石壁后隐藏着一只古朴的宝箱……</p><button class="btn primary" data-act="chest-open">开启</button></div>`;
    return `<div class="panel chest"><h2>机缘宝箱</h2><p class="gold-line">◆ 获得 <b>${c.gold}</b> 灵石</p>${c.relic ? `<div class="loot">${relicHtml(c.relic)}<span>${RELICS[c.relic].n}　<small>${RELICS[c.relic].d}</small></span></div>` : ''}<button class="btn primary" data-act="chest-leave">继续前行</button></div>`;
  }
  function pickHtml() {
    const info = run.pickInfo, list = run.pickEligible(), up = info.mode === 'upgrade';
    const sorted = list.slice().sort((a, b) => (CARDS[a.id].type > CARDS[b.id].type ? 1 : -1) || CARDS[a.id].name.localeCompare(CARDS[b.id].name));
    const sel = ui.pickSel != null ? run.deck.find((c) => c.u === ui.pickSel) : null;
    const preview = sel && up ? `<div class="preview">${cardHtml(sel, {})}<span>→</span>${cardHtml({ id: sel.id, up: true }, {})}</div>` : '';
    return `<div class="panel pick"><h2>${up ? '选择一张功法淬炼' : '选择一张牌移除'}</h2>${preview}
      <div class="card-grid">${sorted.map((c) => cardHtml(c, { small: true, sel: ui.pickSel === c.u, attrs: `data-act="pick-card" data-u="${c.u}"` })).join('')}</div>
      <div class="row-btns"><button class="btn" data-act="pick-skip">${info.back === 'shop' ? '算了' : '放弃'}</button><button class="btn primary" data-act="pick-ok" ${sel ? '' : 'disabled'}>${up ? '淬炼' : '移除'}</button></div></div>`;
  }
  function offerHtml() {
    return `<div class="panel reward"><h2>获得功法</h2><h3>选择一门功法</h3><div class="card-row">${run.offer.ids.map((id, i) => cardHtml({ id, up: false }, { attrs: `data-act="offer" data-i="${i}"` })).join('')}</div>
      <div class="row-btns"><button class="btn" data-act="offer-skip">放弃</button></div></div>`;
  }
  function breakthroughHtml() {
    const next = REALMS[run.realm + 1];
    return `<div class="panel bt"><div class="bt-glow"></div><h2>突破！</h2><p class="flavor">劫云散去，灵台清明。你踏入 <b>${next.name}期</b>，气血尽复。请选择一项突破机缘：</p>
      <div class="ev-choices">${run.btOptions.map((id) => { const o = BREAKTHROUGH.find((x) => x.id === id); return `<button class="btn big" data-act="bt" data-id="${id}"><b>${o.n}</b><small>${o.d}</small></button>`; }).join('')}</div></div>`;
  }
  function overHtml() {
    const win = run.outcome === 'win', rl = REALMS[Math.min(run.realm, REALMS.length - 1)];
    const killer = run.killedBy ? run.killedBy.split('+').map((id) => XX.ENEMIES[id] ? XX.ENEMIES[id].name : id).join('、') : '';
    return `<div class="panel over ${win ? 'win' : 'dead'}"><div class="big-char">${win ? '仙' : '殁'}</div><h2>${win ? '渡劫飞升' : '道消身陨'}</h2>
      <p class="flavor">${win ? '九九天劫尽数化去，你羽化登仙，超脱轮回。' : `你倒在了${rl.name}期的${rl.place}${killer ? `，死于「${killer}」之手` : ''}。`}</p>
      <div class="stats"><div><b>${run.stats.fights}</b><small>战斗</small></div><div><b>${run.stats.elites}</b><small>妖王</small></div><div><b>${run.stats.bosses}</b><small>劫主</small></div><div><b>${run.deck.length}</b><small>功法</small></div><div><b>${run.relics.length}</b><small>法宝</small></div></div>
      <p class="gold-line">获得道果 <b>+${run.daoGained || 0}</b>　<small>（现有 ${meta.dao}）</small></p>
      <div class="row-btns"><button class="btn" data-act="title">主菜单</button><button class="btn primary" data-act="new">再入轮回</button></div></div>`;
  }

  /* ================= 弹窗 ================= */
  function modalHtml() {
    const m = ui.modal; if (!m) return '';
    let body = '';
    if (m.t === 'deck') {
      const order = { atk: 0, skl: 1, pow: 2 };
      const list = run.deck.slice().sort((a, b) => order[CARDS[a.id].type] - order[CARDS[b.id].type] || CARDS[a.id].name.localeCompare(CARDS[b.id].name));
      body = `<h2>牌库 · ${list.length}</h2><div class="card-grid">${list.map((c) => cardHtml(c, { small: true })).join('')}</div>`;
    } else if (m.t === 'pile') {
      const b = run.battle, pile = { draw: b.drawPile, discard: b.discardPile, exhaust: b.exhaustPile }[m.which];
      const list = pile.slice().sort((a, c) => CARDS[a.id].name.localeCompare(CARDS[c.id].name));
      body = `<h2>${{ draw: '抽牌堆', discard: '弃牌堆', exhaust: '消耗堆' }[m.which]} · ${list.length}</h2>${list.length ? `<div class="card-grid">${list.map((c) => cardHtml(c, { small: true, b })).join('')}</div>` : '<p class="flavor">空空如也。</p>'}`;
    } else if (m.t === 'potion') {
      const id = run.potions[m.slot]; if (!id) return '';
      const p = POTIONS[id], b = run.battle, canUse = b && b.phase === 'player' && !ui.busy;
      body = `<h2>${p.n}</h2><p class="flavor">${p.d}</p><div class="row-btns"><button class="btn" data-act="potion-drop" data-slot="${m.slot}">丢弃</button>${canUse ? `<button class="btn primary" data-act="potion-use" data-slot="${m.slot}">使用</button>` : ''}</div>`;
    } else if (m.t === 'menu') {
      body = `<h2>菜单</h2><div class="ev-choices"><button class="btn big" data-act="mute"><b>音效：${ui.muted ? '关' : '开'}</b></button><button class="btn big" data-act="help"><b>玩法说明</b></button><button class="btn big" data-act="save-quit"><b>存档并返回主菜单</b><small>仅在地图上可存档</small></button><button class="btn big danger" data-act="abandon"><b>放弃此世</b><small>视为陨落，结算道果</small></button></div>`;
    } else if (m.t === 'help') {
      body = helpHtml();
    }
    return `<div class="modal" data-act="modal-bg"><div class="modal-box">${body}<button class="x" data-act="modal-close">×</button></div></div>`;
  }
  function helpHtml() {
    return `<h2>玩法说明</h2><div class="help">
      <p><b>目标：</b>自练气至化神，历经五大境界，每境界结尾击败劫主完成突破，最终渡过<b>九九天劫</b>飞升。</p>
      <p><b>地图：</b>每个境界一张分支地图，自下而上前进。节点有<b>妖兽</b>、<b>妖王</b>（精英）、<b>奇遇</b>、<b>坊市</b>、<b>洞府</b>（回血/淬炼）与<b>机缘宝箱</b>。</p>
      <p><b>战斗：</b>每回合获得灵力，打出功法牌。敌人头顶显示其意图。<b>护体</b>抵挡伤害，回合开始时清空。</p>
      <p><b>五行：</b>木→火→土→金→水→木相生。若上一张打出的牌五行<b>生</b>本牌（如先木后火），触发<b>相生</b>：伤害与护体 +50%，部分功法有额外效果。卡牌所属五行克制敌人属性时，伤害 +30%（木克土、土克水、水克火、火克金、金克木）。</p>
      <p><b>状态：</b>剑意（增伤）、身法（增护体）、虚弱、易伤、破防、中毒、灼烧、眩晕……悬停可查看说明。</p>
      <p><b>成长：</b>战斗后选取功法、法宝、丹药；洞府可淬炼功法；坊市可焚经断念精简牌库。</p>
      <p><b>传承：</b>每次陨落或飞升都会留下<b>道果</b>，可在「传承」中永久强化、解锁道途。飞升后可挑战更高<b>劫数</b>。</p>
      <p><b>操作：</b>点击卡牌出牌（需要目标时再点击敌人）；数字键 1–9 选牌，<kbd>E</kbd> 结束回合，<kbd>Esc</kbd> 取消。触屏设备点一次选牌、再点一次打出。</p></div>`;
  }

  /* ================= 主渲染 ================= */
  function render() {
    settle();
    const inRun = run && ui.screen === 'run';
    let html;
    if (ui.screen === 'select') html = '<main class="screen">' + selectHtml() + '</main>';
    else if (ui.screen === 'meta') html = '<main class="screen">' + metaHtml() + '</main>';
    else if (!inRun) html = titleHtml();
    else html = topbarHtml() + '<main class="screen">' + screenFor() + '</main>';
    D.body.dataset.realm = inRun ? run.realm : -1;
    D.body.dataset.phase = inRun ? run.phase : ui.screen;
    const old = app.querySelector('.screen');
    const keepScroll = old ? old.scrollTop : 0;
    app.innerHTML = html + modalHtml();
    const sc = app.querySelector('.screen');
    if (sc) {
      // 阶段/地图位置变化时滚动到关注点，否则保持滚动位置
      const key = inRun ? run.phase + '|' + run.realm + '|' + (run.path ? run.path.length : 0) : '';
      if (key !== ui.viewKey) {
        ui.viewKey = key;
        const a = inRun && run.phase === 'map' && sc.querySelector('.node.avail');
        if (a) a.scrollIntoView({ block: 'center' }); else sc.scrollTop = 0;
      } else sc.scrollTop = keepScroll;
    }
    if (inRun && run.phase === 'battle' && run.battle) afterBattleRender();
    else ui.lastBattle = null;
  }
  function screenFor() {
    switch (run.phase) {
      case 'map': return mapHtml();
      case 'battle': return battleHtml();
      case 'reward': return rewardHtml();
      case 'shop': return shopHtml();
      case 'rest': return restHtml();
      case 'event': return eventHtml();
      case 'chest': return chestHtml();
      case 'pick': return pickHtml();
      case 'cards': return offerHtml();
      case 'breakthrough': return breakthroughHtml();
      case 'over': return overHtml();
      default: return '';
    }
  }
  function settle() {
    if (run && run.phase === 'over' && !run.settled) {
      run.settled = true;
      run.daoGained = Meta.finish(meta, run);
      XX.clearRun();
      sfx(run.outcome === 'win' ? 'win' : 'lose');
    }
  }
  function after() {
    if (run && run.phase === 'map') XX.saveRun(run);
    render();
  }

  /* ================= 战斗特效 ================= */
  function afterBattleRender() {
    const b = run.battle;
    if (ui.lastBattle !== b) { ui.lastBattle = b; ui.lastTurn = 0; }
    if (b.turn !== ui.lastTurn && b.phase === 'player') { ui.lastTurn = b.turn; banner(b.turn === 1 ? '战斗开始' : `第 ${b.turn} 回合`); }
    b.fresh.clear();
    fitHand();
    playFx(b.drainFx());
  }
  /** 手牌按可用宽度动态计算重叠，牌少时完全展开 */
  function fitHand() {
    const hand = app.querySelector('.hand'); if (!hand) return;
    const cards = hand.querySelectorAll('.card'), n = cards.length; if (n < 2) return;
    const cw = cards[0].offsetWidth, over = n * cw - (hand.clientWidth - 16);
    hand.style.setProperty('--m', (over > 0 ? -Math.min(cw * 0.55, over / (2 * n)) : 2).toFixed(1) + 'px');
  }
  G.addEventListener('resize', fitHand);
  function banner(text) {
    const el = D.createElement('div'); el.className = 'banner'; el.textContent = text;
    fxLayer.appendChild(el); setTimeout(() => el.remove(), 1300);
  }
  function popAt(uid, text, cls) {
    const t = app.querySelector(`[data-uid="${uid}"] .avatar`) || app.querySelector(`[data-uid="${uid}"]`); if (!t) return;
    const r = t.getBoundingClientRect(), el = D.createElement('div');
    el.className = 'pop ' + cls; el.textContent = text;
    el.style.left = (r.left + r.width / 2 + (Math.random() - 0.5) * 36) + 'px'; el.style.top = (r.top + r.height * 0.25) + 'px';
    fxLayer.appendChild(el); setTimeout(() => el.remove(), 1100);
  }
  function playFx(list) {
    let delay = 0;
    list.forEach((f) => {
      const w = f.who && f.who.uid;
      const run1 = (fn) => setTimeout(fn, delay);
      switch (f.t) {
        case 'dmg':
          if (f.n > 0 || f.blocked) {
            run1(() => {
              popAt(w, f.n > 0 ? '-' + f.n : '挡', f.n > 0 ? (f.who.isPlayer ? 'dmg-p' : 'dmg') : 'pblk');
              const el = app.querySelector(`[data-uid="${w}"]`); if (el) { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 350); }
              sfx(f.n > 0 ? (f.who.isPlayer ? 'hurt' : 'hit') : 'block');
              if (f.who.isPlayer && f.n > 0) { D.body.classList.add('shake'); setTimeout(() => D.body.classList.remove('shake'), 300); }
            });
            delay += 60;
          }
          break;
        case 'block': run1(() => { popAt(w, '+' + f.n + ' 护', 'pblk'); sfx('block'); }); delay += 40; break;
        case 'heal': run1(() => { popAt(w, '+' + f.n, 'heal'); sfx('heal'); }); delay += 40; break;
        case 'status': if (f.n) run1(() => popAt(w, `${STATUS[f.k].n} ${f.n > 0 ? '+' : ''}${f.n}`, STATUS[f.k].good === (f.n > 0 ? 1 : 0) || (STATUS[f.k].good && f.n > 0) ? 'buff' : 'debuff')); delay += 40; break;
        case 'text': run1(() => { popAt(w, f.s, f.k || 'buff'); if (f.k === 'sheng') sfx('sheng'); }); delay += 60; break;
        case 'lunge': run1(() => { const el = app.querySelector(`[data-uid="${w}"]`); if (el && f.atk) { el.classList.add('lunge'); setTimeout(() => el.classList.remove('lunge'), 450); } if (f.name) popAt(w, f.name, 'move'); }); break;
        case 'die': run1(() => { const el = app.querySelector(`[data-uid="${w}"]`); if (el) el.classList.add('dying'); }); break;
      }
    });
  }

  /* ================= 战斗操作 ================= */
  async function finishBattleUI() {
    const b = run.battle;
    ui.busy = true; render();
    await sleep(b.result === 'win' ? 800 : 1200);
    ui.busy = false; ui.sel = null; ui.potSel = null;
    if (b.result === 'win') sfx('win');
    run.finishBattle();
    after();
  }
  function playIdx(i, target) {
    const b = run.battle, r = b.playCard(i, target);
    if (!r.ok) return;
    ui.sel = null; sfx('card');
    render();
    if (b.phase === 'over') finishBattleUI();
  }
  function onCard(i) {
    const b = run.battle; if (ui.busy || b.phase !== 'player') return;
    const c = b.hand[i], chk = b.canPlay(i);
    if (!chk.ok) { if (chk.reason) popAt('p', chk.reason, 'debuff'); return; }
    const touch = G.matchMedia && G.matchMedia('(hover: none)').matches;
    if (b.needsTarget(c) && b.alive().length > 1) { ui.sel = ui.sel === i ? null : i; ui.potSel = null; render(); return; }
    if (touch && ui.sel !== i) { ui.sel = i; render(); return; }
    playIdx(i, null);
  }
  function onEnemy(uid) {
    const b = run.battle; if (ui.busy || b.phase !== 'player') return;
    const e = b.enemies.find((x) => x.uid === uid); if (!e || e.dead) return;
    if (ui.sel != null) playIdx(ui.sel, e);
    else if (ui.potSel != null) { const s = ui.potSel; ui.potSel = null; b.usePotion(s, e); sfx('heal'); render(); if (b.phase === 'over') finishBattleUI(); }
  }
  async function endTurnUI() {
    const b = run.battle; if (ui.busy || b.phase !== 'player') return;
    ui.busy = true; ui.sel = null; ui.potSel = null; sfx('ui');
    b.endTurn(); render();
    if (b.phase === 'over') { ui.busy = false; return finishBattleUI(); }
    banner('敌方行动');
    while (b.phase === 'enemy') {
      await sleep(720);
      const r = b.stepEnemy(); render();
      if (r !== 'more') break;
    }
    ui.busy = false;
    render();
    if (b.phase === 'over') await finishBattleUI();
  }

  /* ================= 事件分发 ================= */
  function startRun() {
    run = Run.create({ cls: ui.cls, asc: Math.min(ui.asc, meta.maxAsc), meta });
    ui.screen = 'run'; ui.sel = ui.potSel = null; ui.modal = null;
    sfx('ui'); after();
  }
  const actions = {
    title() { ui.screen = 'title'; ui.modal = null; if (run && run.phase === 'over') run = null; render(); },
    new() { run = null; ui.screen = 'select'; ui.modal = null; ui.asc = Math.min(ui.asc, meta.maxAsc); render(); },
    continue() { const r = XX.loadRun(); if (!r) return; run = r; ui.screen = 'run'; after(); },
    meta() { ui.screen = 'meta'; render(); },
    help() { ui.modal = { t: 'help' }; render(); },
    'pick-class'(el) { ui.cls = el.dataset.cls; render(); },
    'asc-'() { ui.asc = Math.max(0, ui.asc - 1); render(); },
    'asc+'() { ui.asc = Math.min(meta.maxAsc, ui.asc + 1); render(); },
    start() { startRun(); },
    buy(el) { if (Meta.buy(meta, el.dataset.id)) sfx('buy'); render(); },
    node(el) { sfx('ui'); run.enterNode(+el.dataset.r, +el.dataset.c); ui.sel = ui.potSel = null; render(); },
    card(el) { onCard(+el.dataset.i); },
    enemy(el) { onEnemy(el.dataset.uid); },
    end() { endTurnUI(); },
    cancel() { ui.sel = null; ui.potSel = null; render(); },
    pile(el) { ui.modal = { t: 'pile', which: el.dataset.which }; render(); },
    deck() { ui.modal = { t: 'deck' }; render(); },
    menu() { ui.modal = { t: 'menu' }; render(); },
    mute() { ui.muted = !ui.muted; try { G.localStorage.setItem('xianxia.muted', ui.muted ? '1' : '0'); } catch (e) { /* ignore */ } render(); },
    'modal-close'() { ui.modal = null; render(); },
    'modal-bg'(el, ev) { if (ev.target === el) { ui.modal = null; render(); } },
    potion(el) { ui.modal = { t: 'potion', slot: +el.dataset.slot }; render(); },
    'potion-drop'(el) { run.discardPotion(+el.dataset.slot); ui.modal = null; render(); },
    'potion-use'(el) {
      const slot = +el.dataset.slot, b = run.battle, id = run.potions[slot], p = POTIONS[id];
      ui.modal = null;
      if (p.target && b.alive().length > 1) { ui.potSel = slot; ui.sel = null; render(); return; }
      b.usePotion(slot, null); sfx('heal'); render();
      if (b.phase === 'over') finishBattleUI();
    },
    'save-quit'() { if (run.phase === 'map') XX.saveRun(run); ui.modal = null; ui.screen = 'title'; render(); },
    abandon() { if (!G.confirm || G.confirm('确定放弃此世修行吗？')) { run.killedBy = ''; run.battle = null; run.lose(); ui.modal = null; render(); } },
    'rw-card'(el) { run.rewardPickCard(+el.dataset.i); sfx('buy'); render(); },
    'rw-skip'() { run.rewardSkipCards(); render(); },
    'rw-potion'() { run.rewardTakePotion(); sfx('buy'); render(); },
    'rw-relic'(el) { run.rewardTakeRelic(+el.dataset.i); sfx('buy'); render(); },
    'rw-leave'() { run.rewardLeave(); after(); },
    'buy-cards'(el) { if (run.shopBuy('cards', +el.dataset.i)) { sfx('buy'); render(); } },
    'buy-relics'(el) { if (run.shopBuy('relics', +el.dataset.i)) { sfx('buy'); render(); } },
    'buy-potions'(el) { if (run.shopBuy('potions', +el.dataset.i)) { sfx('buy'); render(); } },
    'shop-remove'() { if (run.shopRemove()) { ui.pickSel = null; sfx('buy'); render(); } },
    'shop-leave'() { run.shopLeave(); after(); },
    'rest-heal'() { sfx('heal'); run.restHeal(); after(); },
    'rest-up'() { ui.pickSel = null; run.restUpgrade(); render(); },
    'rest-skip'() { run.advance(); after(); },
    'ev-choice'(el) { run.eventChoose(+el.dataset.i); render(); },
    'ev-go'() { run.eventContinue(); ui.pickSel = null; after(); },
    'chest-open'() { run.openChest(); sfx('buy'); render(); },
    'chest-leave'() { run.chestLeave(); after(); },
    'pick-card'(el) { ui.pickSel = +el.dataset.u; render(); },
    'pick-ok'() { if (ui.pickSel == null) return; run.pickChoose(ui.pickSel); ui.pickSel = null; sfx('buy'); after(); },
    'pick-skip'() { ui.pickSel = null; run.pickSkip(); after(); },
    offer(el) { run.offerChoose(+el.dataset.i); sfx('buy'); after(); },
    'offer-skip'() { run.offerSkip(); after(); },
    bt(el) { run.breakthroughChoose(el.dataset.id); sfx('win'); after(); },
  };
  D.addEventListener('click', (ev) => {
    if (ev.target.closest('.modal-box') && !ev.target.closest('[data-act]')) return;
    const el = ev.target.closest('[data-act]');
    if (!el) { if (ui.sel != null && !ev.target.closest('.hud, .enemy')) { ui.sel = null; render(); } return; }
    const fn = actions[el.dataset.act];
    if (!fn) return;
    if (el.disabled) return;
    fn(el, ev);
  });
  D.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { if (ui.modal) { ui.modal = null; render(); } else if (ui.sel != null || ui.potSel != null) { ui.sel = ui.potSel = null; render(); } return; }
    if (!run || ui.screen !== 'run' || run.phase !== 'battle' || ui.modal) return;
    if (ev.key === 'e' || ev.key === 'E' || ev.key === 'Enter') { endTurnUI(); return; }
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= 9) onCard(n - 1);
  });

  /* ================= 悬浮提示 ================= */
  function showTip(t, x, y) {
    const [name, desc] = t.getAttribute('data-tip').split('|');
    tipEl.innerHTML = `<b>${name}</b>${desc ? `<span>${desc}</span>` : ''}`;
    tipEl.style.display = 'block';
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(6, Math.min(G.innerWidth - w - 6, x + 14)) + 'px';
    tipEl.style.top = Math.max(6, Math.min(G.innerHeight - h - 6, y + 16)) + 'px';
  }
  D.addEventListener('mouseover', (e) => { const t = e.target.closest('[data-tip]'); if (t) showTip(t, e.clientX, e.clientY); else tipEl.style.display = 'none'; });
  D.addEventListener('mousemove', (e) => { if (tipEl.style.display === 'block') { const t = e.target.closest('[data-tip]'); if (t) showTip(t, e.clientX, e.clientY); else tipEl.style.display = 'none'; } });
  let tipTimer = null;
  D.addEventListener('touchstart', (e) => {
    const t = e.target.closest('[data-tip]'); if (!t) { tipEl.style.display = 'none'; return; }
    const r = t.getBoundingClientRect(); showTip(t, r.left, r.bottom);
    clearTimeout(tipTimer); tipTimer = setTimeout(() => (tipEl.style.display = 'none'), 2500);
  }, { passive: true });

  /* ================= 启动 ================= */
  XX.ui = { render, ui, actions, get run() { return run; }, get meta() { return meta; }, setRun(r) { run = r; ui.screen = 'run'; ui.sel = ui.potSel = null; ui.modal = null; } }; // setRun 仅供测试脚本使用
  render();
})(typeof window !== 'undefined' ? window : globalThis);
