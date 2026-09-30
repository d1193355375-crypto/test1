/* 问道长生 - 游戏引擎：与 UI 无关，可在 Node 中无头运行 */
(function (G) {
  'use strict';
  const XX = G.XX;
  const { ELEMENTS, SHENG_BONUS, KE_BONUS, STATUS, CARDS, CLASSES, RELICS, POTIONS, REALMS, ENEMIES, ENCOUNTERS, EVENTS, BREAKTHROUGH, META } = XX;

  /* ================= 随机数（可存档） ================= */
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
      let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(n) { return Math.floor(this.next() * n); }
    range(a, b) { return a + this.int(b - a + 1); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr.length ? arr[this.int(arr.length)] : undefined; }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    }
    weighted(w) { // {key: weight}
      const keys = Object.keys(w); let total = 0;
      keys.forEach((k) => (total += w[k]));
      let r = this.next() * total;
      for (const k of keys) { r -= w[k]; if (r < 0) return k; }
      return keys[keys.length - 1];
    }
  }

  /* ================= 卡牌视图 / 描述 ================= */
  const viewCache = {};
  function inc(n, min, k) { return n + Math.max(min, Math.ceil(n * (k || 0.35))); }
  function autoUp(d) {
    const u = {};
    if (d.dmg) u.dmg = (d.hits || 1) > 1 ? inc(d.dmg, 1, 0.3) : inc(d.dmg, 2);
    if (d.block) u.block = inc(d.block, 2);
    if (d.heal) u.heal = inc(d.heal, 2, 0.25);
    if (d.draw) u.draw = d.draw + 1;
    ['apply', 'applyAll', 'self', 'sheng'].forEach((k) => {
      if (d[k] && k !== 'sheng') {
        u[k] = {};
        for (const s in d[k]) u[k][s] = inc(d[k][s], 1);
      }
    });
    if (!Object.keys(u).length && d.cost > 0) u.cost = d.cost - 1;
    return u;
  }
  function view(id, up) {
    const key = id + (up ? '+' : '');
    if (viewCache[key]) return viewCache[key];
    const d = CARDS[id];
    let v = d;
    if (up && d.rarity !== 'status' && d.rarity !== 'curse') {
      v = Object.assign({}, d, d.up || autoUp(d), { name: d.name + '＋', upgraded: true });
    }
    return (viewCache[key] = v);
  }
  function canUpgrade(c) {
    const d = CARDS[c.id];
    return !c.up && d.rarity !== 'status' && d.rarity !== 'curse';
  }
  const stName = (k) => (STATUS[k] ? STATUS[k].n : k);
  function listStatus(o, skip) {
    return Object.keys(o).filter((k) => k !== skip).map((k) => `${o[k]}层${stName(k)}`).join('、');
  }
  function effText(e, b, v, isSheng) {
    const p = [];
    const P = b ? b.player : null;
    const ex = isSheng ? '额外' : '';
    const aoe = v.aoe;
    const num = (base, cur) => `<b class="${cur > base ? 'hi' : cur < base ? 'lo' : ''}">${cur}</b>`;
    if (e.hpLoss) p.push(`失去${e.hpLoss}点气血。`);
    let dmgPart = '';
    if (e.dmgBlock) dmgPart = `造成等同于${e.dmgBlock > 1 ? e.dmgBlock + '倍' : ''}护体的伤害`;
    else if (e.dmgPoison) dmgPart = '造成等同于目标中毒层数的伤害';
    else if (e.dmg) {
      const cur = P ? b.calcDamage(P, null, e.dmg, { el: v.el, strMult: e.strMult }) : e.dmg;
      dmgPart = `${ex}造成${num(e.dmg, cur)}点伤害`;
      if ((e.hits || 1) > 1) dmgPart += `×${e.hits}`;
      if (e.x) dmgPart += '×X';
    }
    if (dmgPart) p.push(`${aoe && !isSheng ? '对所有敌人' : ''}${dmgPart}${e.lifesteal ? '，并回复等同于伤害的气血' : ''}。`);
    if (e.block) {
      const cur = P ? b.calcBlock(P, e.block) : e.block;
      p.push(`${ex}获得${num(e.block, cur)}点护体。`);
    }
    if (e.heal) p.push(`${ex}回复${e.heal}点气血。`);
    if (e.draw) p.push(`${ex}抽${e.draw}张牌。`);
    if (e.energy) p.push(`${ex}获得${e.energy}点灵力。`);
    if (e.apply) p.push(`${ex}对${aoe ? '所有敌人' : '目标'}施加${listStatus(e.apply)}。`);
    if (e.applyAll) p.push(`${ex}对所有敌人施加${listStatus(e.applyAll)}。`);
    if (e.self) {
      const s = listStatus(e.self, 'strDown');
      if (s) p.push(`${ex}获得${s}${e.self.strDown ? '，回合结束时失去' : ''}。`);
    }
    if (!isSheng && e.x) p.push('X 为消耗的全部灵力。');
    return p;
  }
  function cardText(v, b) {
    const parts = [];
    if (v.unplayable) parts.push('<span class="kw">无法打出</span>。');
    if (v.endTurnHp) parts.push(`回合结束时若在手中，失去${v.endTurnHp}点气血。`);
    parts.push(...effText(v, b, v, false));
    if (v.text) parts.push(v.text);
    const kws = [];
    if (v.exhaust) kws.push('消耗');
    if (v.retain) kws.push('保留');
    if (v.innate) kws.push('固有');
    if (v.ethereal) kws.push('消散');
    if (kws.length) parts.push(kws.map((k) => `<span class="kw">${k}</span>`).join('、') + '。');
    if (v.sheng) parts.push(`<span class="sheng-t">相生：</span>${effText(v.sheng, b, v, true).join('') || ''}`);
    return parts.join(' ');
  }
  function mergeEff(base, add) {
    const out = Object.assign({}, base);
    for (const k in add) {
      const a = add[k];
      if (a && typeof a === 'object') {
        out[k] = Object.assign({}, base[k]);
        for (const s in a) out[k][s] = (out[k][s] || 0) + a[s];
      } else if (typeof a === 'number') out[k] = (base[k] || 0) + a;
      else out[k] = a;
    }
    return out;
  }

  /* ================= 特殊卡效果 ================= */
  const FX = {
    doublePoison(b, e, t) { if (t && t.st.poison) b.addStatus(t, 'poison', t.st.poison); },
    gainPotion(b) { if (!b.run.gainRandomPotion()) b.fx({ t: 'text', who: b.player, s: '丹药栏已满', k: 'debuff' }); },
  };

  /* ================= 战斗 ================= */
  class Battle {
    constructor(run, ids, kind) {
      this.run = run; this.rng = run.rng; this.kind = kind || 'normal';
      this.player = { uid: 'p', isPlayer: true, name: '我', hp: run.hp, maxHp: run.maxHp, block: 0, st: {} };
      this.enemies = []; this._eid = 1;
      this.rs = {}; this.fxq = []; this.turn = 0; this.energy = 0;
      this.phase = 'init'; this.result = null; this.lastEl = ''; this.cardsPlayed = 0; this.queue = [];
      this.hand = []; this.discardPile = []; this.exhaustPile = []; this.fresh = new Set();
      this.maxEnergy = 3 + this.sumRelic('energyBonus');
      this.drawPile = this.rng.shuffle(run.deck.slice());
      const inn = this.drawPile.filter((c) => view(c.id, c.up).innate);
      if (inn.length) this.drawPile = this.drawPile.filter((c) => !inn.includes(c)).concat(inn);
      ids.forEach((id) => this.spawn(id));
    }
    sumRelic(key) { return this.run.relics.reduce((s, id) => s + (RELICS[id][key] || 0), 0); }
    hasRelic(key) { return this.run.relics.some((id) => RELICS[id][key]); }
    fire(hook, a, b2) {
      for (const id of this.run.relics.slice()) {
        const r = RELICS[id];
        if (r[hook]) { const res = r[hook](this, a, b2); if (res !== undefined && hook === 'modifyDamageTaken') a = res; }
      }
      return a;
    }
    fx(e) { this.fxq.push(e); }
    drainFx() { const q = this.fxq; this.fxq = []; return q; }
    alive() { return this.enemies.filter((e) => !e.dead); }

    start() {
      this.fire('battleStart');
      this.startPlayerTurn();
    }
    spawn(id, after) {
      const d = ENEMIES[id], asc = this.run.asc || 0;
      const hp = Math.round(this.rng.range(d.hp[0], d.hp[1]) * (1 + 0.1 * asc));
      const e = { uid: 'e' + this._eid++, id, def: d, name: d.name, g: d.g, el: d.el, tier: d.tier || 'normal', hp, maxHp: hp, block: 0, st: {}, turns: 0, move: null, dead: false, half: false, dmgMul: 1 + 0.06 * asc };
      if (after) this.enemies.splice(this.enemies.indexOf(after) + 1, 0, e); else this.enemies.push(e);
      this.planIntent(e);
      return e;
    }
    planIntent(e) {
      const d = e.def, intro = d.intro || [];
      e.move = e.turns < intro.length ? intro[e.turns] : d.pattern[(e.turns - intro.length) % d.pattern.length];
      e.turns++;
    }

    /* ---- 数值 ---- */
    calcDamage(src, dst, base, o) {
      o = o || {};
      let d = base * (src.dmgMul || 1);
      d += (src.st.str || 0) * (o.strMult == null ? 1 : o.strMult);
      if (o.sheng) d *= 1 + SHENG_BONUS * (1 + (src.st.harmony || 0));
      if (src.st.weak) d *= 0.75;
      if (dst) {
        if (dst.st.vuln) d *= 1.5;
        if (o.el && dst.el && ELEMENTS[o.el] && ELEMENTS[o.el].over === dst.el) d *= 1 + KE_BONUS;
      }
      if (o.mult) d *= o.mult;
      return Math.max(0, Math.floor(d));
    }
    calcBlock(ent, base, o) {
      o = o || {};
      let n = base + (ent.st.dex || 0);
      if (o.sheng) n *= 1 + SHENG_BONUS * (1 + (ent.st.harmony || 0));
      if (ent.st.frail) n *= 0.75;
      return Math.max(0, Math.floor(n));
    }
    gainBlock(ent, n, o) {
      o = o || {};
      if (!o.raw) n = this.calcBlock(ent, n, o);
      if (n <= 0) return;
      ent.block += n;
      this.fx({ t: 'block', who: ent, n });
    }
    heal(ent, n) {
      const before = ent.hp;
      ent.hp = Math.min(ent.maxHp, ent.hp + n);
      if (ent.hp > before) this.fx({ t: 'heal', who: ent, n: ent.hp - before });
    }
    addStatus(ent, k, n) {
      if (!n) return;
      if (k === 'stun' && ent.tier === 'boss') { this.fx({ t: 'text', who: ent, s: '免疫', k: 'buff' }); return; }
      ent.st[k] = (ent.st[k] || 0) + n;
      if (ent.st[k] <= 0) delete ent.st[k];
      this.fx({ t: 'status', who: ent, k, n });
    }
    hurt(dst, amount, src, o) {
      o = o || {};
      if (dst.dead || this.phase === 'over') return { loss: 0, blocked: 0 };
      amount = Math.max(0, Math.floor(amount));
      if (dst.isPlayer) amount = this.fire('modifyDamageTaken', amount);
      const blocked = Math.min(dst.block, amount);
      dst.block -= blocked; amount -= blocked;
      if (amount > 0) dst.hp -= amount;
      this.fx({ t: 'dmg', who: dst, n: amount, blocked });
      if (o.attack && src && !src.dead && dst.st.thorns && !o.noThorns) this.hurt(src, dst.st.thorns, null, { noThorns: true });
      if (dst.hp <= 0) this.onZero(dst);
      else if (!dst.isPlayer && dst.def.half && !dst.half && dst.hp <= dst.maxHp / 2) this.triggerHalf(dst);
      return { loss: amount, blocked };
    }
    onZero(dst) {
      if (dst.isPlayer) {
        if (this.run.relics.some((id) => RELICS[id].onLethal && RELICS[id].onLethal(this))) { this.fx({ t: 'text', who: dst, s: '续命！', k: 'buff' }); return; }
        dst.hp = 0; this.phase = 'over'; this.result = 'lose'; this.run.hp = 0;
      } else {
        dst.hp = 0; dst.dead = true; dst.block = 0;
        this.fx({ t: 'die', who: dst });
        this.fire('kill', dst);
      }
    }
    triggerHalf(e) {
      const h = e.def.half; e.half = true;
      this.fx({ t: 'text', who: e, s: h.msg || '狂暴', k: 'debuff' });
      if (h.self) for (const k in h.self) this.addStatus(e, k, h.self[k]);
      if (h.block) this.gainBlock(e, h.block, { raw: true });
    }
    checkWin() {
      if (this.phase === 'over') return this.result === 'win';
      if (this.alive().length) return false;
      this.phase = 'over'; this.result = 'win';
      this.run.hp = this.player.hp;
      this.fire('battleWin');
      return true;
    }

    /* ---- 牌堆 ---- */
    newTemp(id) { return { u: this.run.uidc++, id, up: false, temp: true }; }
    addCardToPile(id, pile, n) {
      for (let i = 0; i < (n || 1); i++) {
        const c = this.newTemp(id);
        if (pile === 'draw') this.drawPile.splice(this.rng.int(this.drawPile.length + 1), 0, c);
        else if (pile === 'hand') { if (this.hand.length < 10) this.hand.push(c); else this.discardPile.push(c); }
        else this.discardPile.push(c);
      }
    }
    drawCards(n) {
      for (let i = 0; i < n; i++) {
        if (this.hand.length >= 10) break;
        if (!this.drawPile.length) {
          if (!this.discardPile.length) break;
          this.drawPile = this.rng.shuffle(this.discardPile); this.discardPile = [];
        }
        const c = this.drawPile.pop();
        this.hand.push(c); this.fresh.add(c.u);
      }
    }

    /* ---- 回合流程 ---- */
    startPlayerTurn() {
      const p = this.player;
      this.turn++; this.phase = 'player'; this.cardsPlayed = 0; this.lastEl = '';
      if (!p.st.barricade) p.block = 0;
      this.energy = this.maxEnergy;
      if (p.st.energyNext) { this.energy += p.st.energyNext; delete p.st.energyNext; }
      if (p.st.flow) this.energy += p.st.flow;
      if (p.st.poison) {
        this.hurt(p, p.st.poison, null, {});
        p.st.poison--; if (p.st.poison <= 0) delete p.st.poison;
        if (this.result) return;
      }
      if (p.st.growth) this.addStatus(p, 'str', p.st.growth);
      if (p.st.array) this.alive().forEach((e) => this.hurt(e, p.st.array, p, {}));
      if (p.st.plague) this.alive().forEach((e) => this.addStatus(e, 'poison', p.st.plague));
      let n = 5 + this.sumRelic('drawBonus');
      if (p.st.drawNext) { n += p.st.drawNext; delete p.st.drawNext; }
      this.fire('turnStart');
      this.drawCards(n);
      this.checkWin();
    }
    tickEnd(ent) {
      const st = ent.st;
      if (st.burn) { const n = st.burn; st.burn = n - Math.ceil(n / 3); if (st.burn <= 0) delete st.burn; this.hurt(ent, n, null, {}); }
      if (st.plated) this.gainBlock(ent, st.plated, { raw: true });
      if (st.regen) this.heal(ent, st.regen);
      if (st.strDown) { this.addStatus(ent, 'str', -st.strDown); delete st.strDown; }
      ['weak', 'vuln', 'frail'].forEach((k) => { if (st[k]) { st[k]--; if (st[k] <= 0) delete st[k]; } });
    }
    endTurn() {
      if (this.phase !== 'player') return;
      this.fire('turnEnd');
      if (this.checkWin()) return;
      const keep = [];
      for (const c of this.hand) {
        const v = view(c.id, c.up);
        if (v.endTurnHp) this.hurt(this.player, v.endTurnHp, null, {});
        if (v.ethereal) this.exhaustPile.push(c);
        else if (v.retain) keep.push(c);
        else this.discardPile.push(c);
      }
      this.hand = keep;
      if (this.result) return;
      this.tickEnd(this.player);
      if (this.result) return;
      this.phase = 'enemy';
      this.queue = this.alive();
    }
    /** 依次执行一个敌人的行动。返回 'more' | 'end'(新回合已开始) | 'over' */
    stepEnemy() {
      if (this.phase !== 'enemy') return this.result ? 'over' : 'end';
      let e = this.queue.shift();
      while (e && e.dead) e = this.queue.shift();
      if (e) {
        if (!(e.st.barricade)) e.block = 0;
        if (e.st.poison) { const n = e.st.poison; e.st.poison--; if (e.st.poison <= 0) delete e.st.poison; this.hurt(e, n, null, {}); }
        if (!e.dead) {
          if (e.st.stun > 0) {
            e.st.stun--; if (e.st.stun <= 0) delete e.st.stun;
            this.fx({ t: 'text', who: e, s: '眩晕', k: 'debuff' });
          } else this.execMove(e, e.def.moves[e.move]);
          if (!e.dead) { this.tickEnd(e); if (!e.dead) this.planIntent(e); }
        }
        if (this.checkWin() || this.result) return 'over';
      }
      if (this.queue.some((x) => !x.dead)) return 'more';
      this.startPlayerTurn();
      return this.phase === 'over' ? 'over' : 'end';
    }
    execMove(e, m) {
      const p = this.player;
      this.fx({ t: 'lunge', who: e, atk: !!m.dmg, name: m.n });
      if (m.dmg) {
        for (let i = 0; i < (m.hits || 1); i++) {
          if (this.phase === 'over') return;
          const d = this.calcDamage(e, p, m.dmg);
          this.hurt(p, d, e, { attack: true });
        }
      }
      if (this.phase === 'over') return;
      if (m.block) this.gainBlock(e, m.block, { raw: true });
      if (m.heal) this.heal(e, m.heal);
      if (m.apply) for (const k in m.apply) this.addStatus(p, k, m.apply[k]);
      if (m.self) for (const k in m.self) this.addStatus(e, k, m.self[k]);
      if (m.cards) m.cards.forEach((c) => this.addCardToPile(c.id, c.to, c.n));
      if (m.summon) m.summon.forEach((id) => { if (this.alive().length < 5) this.spawn(id, e); });
    }
    intentOf(e) {
      if (e.st.stun > 0) return { icons: ['stun'], name: '眩晕' };
      const m = e.def.moves[e.move];
      if (!m) return { icons: [], name: '' };
      const icons = []; let dmg = null;
      if (m.dmg) { icons.push('atk'); dmg = this.calcDamage(e, this.player, m.dmg); }
      if (m.apply || m.cards) icons.push('debuff');
      if (m.block) icons.push('def');
      if (m.self || m.heal) icons.push(m.intent === 'charge' ? 'charge' : 'buff');
      if (m.summon) icons.push('summon');
      if (!icons.length) icons.push('buff');
      return { icons, dmg, hits: m.hits || 1, name: m.n };
    }

    /* ---- 出牌 ---- */
    cardCost(c) {
      const v = view(c.id, c.up);
      if (v.x) return 'X';
      if (this.cardsPlayed === 0 && this.hasRelic('freeFirst')) return 0;
      return v.cost;
    }
    needsTarget(c) {
      const v = view(c.id, c.up);
      return !!((v.dmg || v.dmgBlock || v.dmgPoison || v.apply || v.fx === 'doublePoison') && !v.aoe);
    }
    shengActive(c) {
      const v = view(c.id, c.up);
      if (!v.el) return false;
      if (this.player.st.nextSheng > 0) return true;
      return !!(this.lastEl && ELEMENTS[this.lastEl].gen === v.el);
    }
    canPlay(i) {
      const c = this.hand[i];
      if (!c || this.phase !== 'player') return { ok: false, reason: '' };
      const v = view(c.id, c.up);
      if (v.unplayable) return { ok: false, reason: '无法打出' };
      const cost = this.cardCost(c);
      if (cost !== 'X' && cost > this.energy) return { ok: false, reason: '灵力不足' };
      return { ok: true };
    }
    playCard(i, target) {
      const chk = this.canPlay(i);
      if (!chk.ok) return chk;
      const c = this.hand[i], v = view(c.id, c.up);
      if (this.needsTarget(c)) {
        if (!target || target.dead) {
          const al = this.alive();
          if (al.length === 1) target = al[0]; else return { ok: false, reason: '需要目标' };
        }
      }
      const cost = this.cardCost(c);
      let X = 0;
      if (cost === 'X') { X = this.energy; this.energy = 0; } else this.energy -= cost;
      this.hand.splice(i, 1);
      let sheng = false;
      if (v.el) {
        if (this.player.st.nextSheng > 0) { sheng = true; this.player.st.nextSheng--; if (!this.player.st.nextSheng) delete this.player.st.nextSheng; }
        else if (this.lastEl && ELEMENTS[this.lastEl].gen === v.el) sheng = true;
      }
      const eff = sheng && v.sheng ? mergeEff(v, v.sheng) : v;
      if (sheng) this.fx({ t: 'text', who: this.player, s: '相生！', k: 'sheng' });
      let times = 1;
      if (v.type === 'atk' && this.player.st.nextDouble > 0) { times = 2; this.addStatus(this.player, 'nextDouble', -1); }
      for (let n = 0; n < times; n++) {
        if (this.phase === 'over') break;
        this.resolve(eff, target, X, sheng, v);
      }
      if (v.el) this.lastEl = v.el;
      this.cardsPlayed++;
      if (v.type === 'pow') { /* 功法：本场战斗持续，牌移出 */ }
      else if (v.exhaust) this.exhaustPile.push(c);
      else this.discardPile.push(c);
      this.fire('cardPlayed', { card: v, type: v.type, sheng });
      this.checkWin();
      return { ok: true };
    }
    resolve(e, target, X, sheng, v) {
      const p = this.player;
      if (e.hpLoss) { this.hurt(p, e.hpLoss, null, {}); if (this.result) return; }
      const targets = e.aoe ? this.alive() : target ? [target] : [];
      const hasDmg = e.dmg != null || e.dmgBlock || e.dmgPoison;
      if (hasDmg) {
        const hits = e.x ? X : e.hits || 1;
        let mult = 1;
        if (v.type === 'atk' && this.rs.lbReady) { mult = 2; this.rs.lbReady = 0; }
        for (let h = 0; h < hits; h++) {
          for (const t of targets) {
            if (t.dead || this.phase === 'over') continue;
            let base = e.dmg || 0;
            if (e.dmgBlock) base = Math.floor(p.block * e.dmgBlock);
            if (e.dmgPoison) base = (t.st.poison || 0) * e.dmgPoison;
            const d = this.calcDamage(p, t, base, { el: v.el, sheng, strMult: e.strMult, mult });
            const res = this.hurt(t, d, p, { attack: true });
            if (e.lifesteal && res.loss > 0) this.heal(p, res.loss);
            if (p.st.envenom && res.loss > 0 && !t.dead) this.addStatus(t, 'poison', p.st.envenom);
          }
        }
      }
      if (this.phase === 'over') return;
      if (e.block) this.gainBlock(p, e.block, { sheng });
      if (e.heal) this.heal(p, e.heal);
      if (e.draw) this.drawCards(e.draw);
      if (e.energy) this.energy += e.energy;
      if (e.apply) targets.forEach((t) => { if (!t.dead) for (const k in e.apply) this.addStatus(t, k, e.apply[k]); });
      if (e.applyAll) this.alive().forEach((t) => { for (const k in e.applyAll) this.addStatus(t, k, e.applyAll[k]); });
      if (e.self) for (const k in e.self) this.addStatus(p, k, e.self[k]);
      if (e.fx && FX[e.fx]) FX[e.fx](this, e, target, X);
    }
    usePotion(slot, target) {
      const id = this.run.potions[slot];
      if (!id || this.phase !== 'player') return { ok: false };
      const pd = POTIONS[id];
      if (pd.target) {
        if (!target || target.dead) { const al = this.alive(); if (al.length === 1) target = al[0]; else return { ok: false, reason: '需要目标' }; }
      }
      this.run.potions[slot] = null;
      pd.use(this, target);
      this.checkWin();
      return { ok: true };
    }
  }

  /* ================= 存档存储 ================= */
  const memStore = {};
  const store = {
    get(k) { try { const v = G.localStorage && G.localStorage.getItem(k); return v == null ? memStore[k] || null : v; } catch (e) { return memStore[k] || null; } },
    set(k, v) { memStore[k] = v; try { G.localStorage && G.localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { delete memStore[k]; try { G.localStorage && G.localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const META_KEY = 'xianxia.meta.v1', RUN_KEY = 'xianxia.run.v1';

  const Meta = {
    fresh() { return { dao: 0, lv: {}, runs: 0, wins: 0, maxAsc: 0, bestRealm: 0 }; },
    load() { try { const m = JSON.parse(store.get(META_KEY)); if (m && m.lv) return Object.assign(Meta.fresh(), m); } catch (e) { /* ignore */ } return Meta.fresh(); },
    save(m) { store.set(META_KEY, JSON.stringify(m)); },
    level(m, id) { return m.lv[id] || 0; },
    classUnlocked(m, cls) { return cls === 'sword' || cls === 'body' || !!m.lv[cls]; },
    canBuy(m, def) { const l = Meta.level(m, def.id); return l < def.max && m.dao >= def.cost(l); },
    buy(m, id) {
      const def = META.find((x) => x.id === id), l = Meta.level(m, id);
      if (!def || !Meta.canBuy(m, def)) return false;
      m.dao -= def.cost(l); m.lv[id] = l + 1; Meta.save(m); return true;
    },
    /** 一局结束时结算，返回获得的道果 */
    finish(m, run) {
      const gain = run.daoGain();
      m.dao += gain; m.runs++;
      if (run.outcome === 'win') { m.wins++; m.maxAsc = Math.min(5, Math.max(m.maxAsc, run.asc + 1)); }
      m.bestRealm = Math.max(m.bestRealm, run.realm + (run.outcome === 'win' ? 1 : 0));
      Meta.save(m);
      return gain;
    },
  };

  /* ================= 一局游戏 ================= */
  const MAP_W = 5, MAP_ROWS = 6; // 行 0..5 为普通节点，第 6 行为 Boss
  const CARD_PRICE = { common: 50, uncommon: 80, rare: 150 };
  const RELIC_PRICE = { common: 150, uncommon: 250, rare: 300 };
  const POTION_PRICE = { common: 50, uncommon: 75, rare: 110 };

  class Run {
    static create(opts) {
      const r = new Run();
      const meta = opts.meta || Meta.fresh();
      const cls = CLASSES[opts.cls];
      r.v = 1; r.seed = (opts.seed == null ? (Math.random() * 4294967296) >>> 0 : opts.seed >>> 0);
      r.rng = new RNG(r.seed);
      r.cls = opts.cls; r.asc = opts.asc || 0;
      r.maxHp = cls.hp + 4 * Meta.level(meta, 'hp'); r.hp = r.maxHp;
      r.gold = 99 + 25 * Meta.level(meta, 'gold');
      r.uidc = 1; r.deck = []; r.relics = []; r.potions = [null, null, null];
      r.mods = { extraChoice: Meta.level(meta, 'choice') > 0 };
      r.flags = {}; r.seenEvents = []; r.removals = 0;
      r.stats = { fights: 0, elites: 0, bosses: 0, floors: 0 };
      cls.deck.forEach((id) => r.addCard(id));
      r.relics.push(cls.relic);
      if (Meta.level(meta, 'insight')) { const c = r.rng.pick(r.deck.filter((x) => canUpgrade(x) && CARDS[x.id].rarity === 'starter' && x.id !== 'defend')); if (c) c.up = true; }
      if (Meta.level(meta, 'potion')) r.gainRandomPotion();
      if (Meta.level(meta, 'relic')) r.gainRandomRelic('common');
      r.realm = 0; r.queue = []; r.phase = 'map'; r.outcome = null;
      r.newRealm();
      return r;
    }
    toJSON() {
      const o = {};
      ['v', 'seed', 'cls', 'asc', 'hp', 'maxHp', 'gold', 'uidc', 'deck', 'relics', 'potions', 'mods', 'flags', 'seenEvents', 'removals', 'stats', 'realm', 'map', 'cur', 'path', 'fightsInRealm'].forEach((k) => (o[k] = this[k]));
      o.rngState = this.rng.s;
      return o;
    }
    static fromJSON(o) {
      const r = new Run();
      Object.assign(r, o);
      r.rng = new RNG(1); r.rng.s = o.rngState >>> 0;
      r.queue = []; r.phase = 'map'; r.outcome = null; r.battle = null;
      return r;
    }

    /* ---- 基础操作 ---- */
    addCard(id, up) { const c = { u: this.uidc++, id, up: !!up }; this.deck.push(c); return c; }
    removeCard(uid) { const i = this.deck.findIndex((c) => c.u === uid); if (i >= 0) this.deck.splice(i, 1); }
    upgradeCard(uid) { const c = this.deck.find((x) => x.u === uid); if (c && canUpgrade(c)) c.up = true; }
    upgradeRandom(n) {
      const pool = this.rng.shuffle(this.deck.filter(canUpgrade)).slice(0, n);
      pool.forEach((c) => (c.up = true));
      return pool.length;
    }
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
    loseHp(n) { this.hp = Math.max(1, this.hp - n); }
    gainMaxHp(n) { this.maxHp += n; this.hp += n; }
    gainGold(n) { this.gold += n; }
    hasRelic(id) { return this.relics.includes(id); }
    sumRelic(key) { return this.relics.reduce((s, id) => s + (RELICS[id][key] || 0), 0); }
    addRelic(id) {
      this.relics.push(id);
      const r = RELICS[id];
      if (r.onPickup) r.onPickup(this);
    }
    addPotionSlots(n) { for (let i = 0; i < n; i++) this.potions.push(null); }
    canGainPotion() { return !this.relics.some((id) => RELICS[id].noPotion) && this.potions.includes(null); }
    addPotion(id) {
      if (!this.canGainPotion()) return false;
      this.potions[this.potions.indexOf(null)] = id; return true;
    }
    gainRandomPotion() {
      if (!this.canGainPotion()) return false;
      const rar = this.rng.weighted({ common: 65, uncommon: 25, rare: 10 });
      const ids = Object.keys(POTIONS).filter((k) => POTIONS[k].r === rar);
      return this.addPotion(this.rng.pick(ids));
    }
    rollRelic(weights) {
      const owned = new Set(this.relics);
      for (let t = 0; t < 8; t++) {
        const rar = this.rng.weighted(weights || { common: 50, uncommon: 33, rare: 17 });
        const ids = Object.keys(RELICS).filter((k) => RELICS[k].r === rar && !owned.has(k));
        if (ids.length) return this.rng.pick(ids);
      }
      return null;
    }
    gainRandomRelic(rar) {
      const id = this.rollRelic(rar ? { [rar]: 1 } : null);
      if (id) this.addRelic(id);
      return id;
    }
    rollBossRelics(n) {
      const owned = new Set(this.relics);
      return this.rng.shuffle(Object.keys(RELICS).filter((k) => RELICS[k].r === 'boss' && !owned.has(k))).slice(0, n);
    }
    rollCards(n, kind) {
      const wmap = {
        normal: { common: 60, uncommon: 37, rare: 3 }, elite: { common: 50, uncommon: 40, rare: 10 },
        shop: { common: 52, uncommon: 36, rare: 12 }, rare: { rare: 1 }, boss: { rare: 1 },
      };
      const w = Object.assign({}, wmap[kind] || wmap.normal);
      if (w.rare && w.common) w.rare += this.realm;
      const out = []; let guard = 0;
      while (out.length < n && guard++ < 300) {
        const rar = this.rng.weighted(w);
        const cls = this.rng.chance(0.25) ? 'neutral' : this.cls;
        const pool = Object.keys(CARDS).filter((k) => CARDS[k].rarity === rar && CARDS[k].cls === cls);
        if (!pool.length) continue;
        const id = this.rng.pick(pool);
        if (!out.includes(id)) out.push(id);
      }
      return out;
    }

    /* ---- 地图 ---- */
    newRealm() {
      this.map = this.genMap(); this.cur = null; this.node = null; this.fightsInRealm = 0; this.path = [];
    }
    genMap() {
      const rng = this.rng, W = MAP_W, R = MAP_ROWS;
      const exist = Array.from({ length: R }, () => Array(W).fill(false));
      const edges = Array.from({ length: R }, () => Array.from({ length: W }, () => new Set()));
      const cols = rng.shuffle([0, 1, 2, 3, 4]);
      const starts = cols.slice(0, rng.range(3, 4));
      while (starts.length < 4) starts.push(rng.pick(starts));
      starts.forEach((s) => {
        let c = s;
        for (let r = 0; r < R; r++) {
          exist[r][c] = true;
          if (r === R - 1) break;
          const opts = rng.shuffle([c - 1, c, c + 1].filter((n) => n >= 0 && n < W));
          let n = opts.find((x) => x === c || !edges[r][x].has(c));
          if (n == null) n = c;
          edges[r][c].add(n); c = n;
        }
      });
      const rows = [];
      for (let r = 0; r < R; r++) {
        rows.push(Array.from({ length: W }, (_, c) => (exist[r][c]
          ? { r, c, type: 'battle', next: r === R - 1 ? [2] : Array.from(edges[r][c]).sort(), jx: (rng.next() - 0.5) * 0.5, jy: (rng.next() - 0.5) * 0.4 }
          : null)));
      }
      rows.push([null, null, { r: R, c: 2, type: 'boss', next: [], jx: 0, jy: 0 }, null, null]);
      // 类型分配
      const special = new Set(['shop', 'rest', 'elite']);
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < W; c++) {
          const node = rows[r][c]; if (!node) continue;
          if (r === 0) { node.type = 'battle'; continue; }
          if (r === 3) { node.type = 'chest'; continue; }
          if (r === R - 1) { node.type = 'rest'; continue; }
          const parents = [];
          for (let pc = 0; pc < W; pc++) if (rows[r - 1][pc] && rows[r - 1][pc].next.includes(c)) parents.push(rows[r - 1][pc].type);
          const w = { battle: 46, event: 22, shop: r >= 1 ? 8 : 0, rest: r >= 1 && r <= 2 ? 12 : 0, elite: r >= 2 ? 12 : 0 };
          for (let t = 0; t < 10; t++) {
            const type = rng.weighted(w);
            if (special.has(type) && parents.includes(type)) continue;
            node.type = type; break;
          }
        }
      }
      const all = rows.flat().filter(Boolean);
      const convert = (type, rowsOk) => {
        if (all.some((n) => n.type === type)) return;
        const cand = all.filter((n) => rowsOk.includes(n.r) && (n.type === 'battle' || n.type === 'event'));
        const n = rng.pick(cand); if (n) n.type = type;
      };
      convert('shop', [1, 2, 4]); convert('elite', [2, 4]);
      return rows;
    }
    availableNodes() {
      if (this.phase !== 'map') return [];
      if (!this.cur) return this.map[0].filter(Boolean);
      return this.map[this.cur.r].find((n) => n && n.c === this.cur.c).next.map((c) => this.map[this.cur.r + 1][c]);
    }
    enterNode(r, c) {
      const node = this.availableNodes().find((n) => n.r === r && n.c === c);
      if (!node) return false;
      this.cur = { r, c }; this.node = node; this.path.push(r + '_' + c);
      switch (node.type) {
        case 'battle': this.startBattle(this.pickEncounter('normal'), 'normal'); break;
        case 'elite': this.startBattle(this.pickEncounter('elite'), 'elite'); break;
        case 'boss': this.startBattle(this.pickEncounter('boss'), 'boss'); break;
        case 'event': this.startEvent(); break;
        case 'shop': this.shop = this.genShop(); this.phase = 'shop'; break;
        case 'rest': this.phase = 'rest'; break;
        case 'chest': this.phase = 'chest'; this.chest = { relic: this.rollRelic(), gold: this.rng.range(25, 50), opened: false }; break;
      }
      return true;
    }
    pickEncounter(kind) {
      const enc = ENCOUNTERS[this.realm];
      if (kind === 'boss') return enc.boss.slice();
      if (kind === 'elite') return this.rng.pick(enc.elite).slice();
      return this.rng.pick(this.fightsInRealm < 2 ? enc.easy : enc.hard).slice();
    }
    startBattle(ids, kind) {
      this.battle = new Battle(this, ids, kind);
      this.phase = 'battle';
      this.battle.start();
    }
    finishBattle() {
      const b = this.battle;
      if (b.result === 'lose') { this.killedBy = b.enemies.map((e) => e.id).join('+'); return this.lose(); }
      const kind = b.kind;
      this.stats.fights++; this.fightsInRealm++;
      if (kind === 'elite') this.stats.elites++;
      if (kind === 'boss') this.stats.bosses++;
      this.battle = null;
      this.queue = [{ t: 'reward', reward: this.makeReward(kind) }];
      if (kind === 'boss' && this.realm < REALMS.length - 1) this.queue.push({ t: 'breakthrough', options: this.rng.shuffle(BREAKTHROUGH.slice()).slice(0, 3).map((o) => o.id) });
      this.advance();
    }
    makeReward(kind) {
      const rg = { normal: [10, 20], elite: [25, 35], boss: [60, 80] }[kind];
      const gold = Math.round(this.rng.range(rg[0], rg[1]) * (1 + this.relics.reduce((s, id) => s + ((RELICS[id].goldMult || 1) - 1), 0)));
      this.gold += gold;
      const n = 3 + (this.mods.extraChoice ? 1 : 0);
      const rw = { gold, cards: this.rollCards(n, kind), cardsDone: false, potion: null, potionTaken: false, relics: [], relicChoose: false, relicTaken: false };
      if (this.rng.chance({ normal: 0.35, elite: 0.5, boss: 0 }[kind]) && this.canGainPotion()) {
        const rar = this.rng.weighted({ common: 65, uncommon: 25, rare: 10 });
        rw.potion = this.rng.pick(Object.keys(POTIONS).filter((k) => POTIONS[k].r === rar));
      }
      if (kind === 'elite') { const id = this.rollRelic(); if (id) rw.relics = [id]; }
      if (kind === 'boss') { rw.relics = this.rollBossRelics(3); rw.relicChoose = true; }
      return rw;
    }
    rewardPickCard(i) { const rw = this.reward; if (rw.cardsDone) return; this.addCard(rw.cards[i]); rw.cardsDone = true; }
    rewardSkipCards() { this.reward.cardsDone = true; }
    rewardTakePotion() { const rw = this.reward; if (rw.potion && !rw.potionTaken && this.addPotion(rw.potion)) rw.potionTaken = true; }
    rewardTakeRelic(i) {
      const rw = this.reward;
      if (rw.relicTaken || !rw.relics[i]) return;
      this.addRelic(rw.relics[i]); rw.relicTaken = true;
    }
    rewardLeave() { this.reward = null; this.advance(); }

    /* ---- 步骤队列 ---- */
    advance() {
      const s = this.queue.shift();
      if (!s) return this.completeNode();
      switch (s.t) {
        case 'reward': this.phase = 'reward'; this.reward = s.reward; break;
        case 'pick': this.phase = 'pick'; this.pickInfo = s; break;
        case 'cards': this.phase = 'cards'; this.offer = s; break;
        case 'breakthrough': this.phase = 'breakthrough'; this.btOptions = s.options; break;
        case 'battle': this.startBattle(this.pickEncounter('elite'), 'elite'); break;
      }
    }
    completeNode() {
      const node = this.node;
      this.stats.floors++;
      if (node && node.type === 'boss') {
        if (this.realm >= REALMS.length - 1) return this.win();
        this.realm++; this.hp = this.maxHp; this.newRealm();
      }
      this.phase = 'map';
    }
    win() { this.phase = 'over'; this.outcome = 'win'; }
    lose() { this.phase = 'over'; this.outcome = 'dead'; this.battle = null; }
    daoGain() {
      const s = this.stats;
      const base = s.floors + s.fights * 2 + s.elites * 4 + s.bosses * 15 + (this.outcome === 'win' ? 60 : 0);
      return Math.round(base * (1 + 0.2 * this.asc));
    }

    /* ---- 选牌 / 三选一 / 突破 ---- */
    pickEligible() { return this.pickInfo.mode === 'upgrade' ? this.deck.filter(canUpgrade) : this.deck.slice(); }
    pickChoose(uid) {
      const info = this.pickInfo;
      if (info.mode === 'upgrade') this.upgradeCard(uid); else this.removeCard(uid);
      if (info.cost) { this.gold -= info.cost; this.shop.removed = true; this.removals++; }
      this.pickInfo = null;
      if (info.back) this.phase = info.back; else this.advance();
    }
    pickSkip() { const info = this.pickInfo; this.pickInfo = null; if (info.back) this.phase = info.back; else this.advance(); }
    offerChoose(i) { this.addCard(this.offer.ids[i]); this.offer = null; this.advance(); }
    offerSkip() { this.offer = null; this.advance(); }
    breakthroughChoose(id) {
      const o = BREAKTHROUGH.find((x) => x.id === id);
      const res = o.do(this);
      this.btOptions = null;
      if (res && res.t) this.pushStep(res, true);
      this.advance();
    }
    pushStep(then, front) {
      let step = null;
      if (then.t === 'pick') step = { t: 'pick', mode: then.mode };
      else if (then.t === 'cards') step = { t: 'cards', ids: this.rollCards(then.n || 3, then.rarity === 'rare' ? 'rare' : 'shop') };
      else if (then.t === 'battle') step = { t: 'battle' };
      if (!step) return;
      if (front) this.queue.unshift(step); else this.queue.push(step);
    }

    /* ---- 奇遇 ---- */
    startEvent() {
      let pool = EVENTS.filter((e) => !this.seenEvents.includes(e.id));
      if (!pool.length) { this.seenEvents = []; pool = EVENTS; }
      const def = this.rng.pick(pool);
      this.seenEvents.push(def.id);
      this.event = { def, title: def.title, text: def.text, choices: def.choices(this), outcome: null };
      this.phase = 'event';
    }
    eventChoose(i) {
      const ch = this.event.choices[i];
      if (!ch || (ch.can && !ch.can())) return;
      this.event.outcome = ch.do();
    }
    eventContinue() {
      const then = this.event.outcome && this.event.outcome.then;
      this.event = null;
      if (then) this.pushStep(then, false);
      this.advance();
    }

    /* ---- 洞府 ---- */
    canRestHeal() { return !this.hasRelicKey('noRest'); }
    hasRelicKey(k) { return this.relics.some((id) => RELICS[id][k]); }
    restHeal() { if (!this.canRestHeal()) return; this.heal(Math.floor(this.maxHp * 0.3)); this.advance(); }
    restUpgrade() { this.queue.unshift({ t: 'pick', mode: 'upgrade' }); this.advance(); }

    /* ---- 宝箱 ---- */
    openChest() {
      const c = this.chest; if (c.opened) return;
      c.opened = true; this.gainGold(c.gold);
      if (c.relic) this.addRelic(c.relic);
    }
    chestLeave() { this.chest = null; this.advance(); }

    /* ---- 坊市 ---- */
    genShop() {
      const price = (base) => Math.round((base * this.rng.range(90, 110)) / 100 / 5) * 5;
      const cards = this.rollCards(7, 'shop').map((id) => ({ id, price: price(CARD_PRICE[CARDS[id].rarity] * (CARDS[id].cls === 'neutral' ? 1.15 : 1)), sold: false }));
      cards[this.rng.int(cards.length)].sale = true;
      cards.forEach((c) => { if (c.sale) c.price = Math.round(c.price / 2 / 5) * 5; });
      const relics = [];
      for (let i = 0; i < 3; i++) {
        const id = this.rollRelic();
        if (id && !relics.some((r) => r.id === id)) relics.push({ id, price: price(RELIC_PRICE[RELICS[id].r]), sold: false });
      }
      const potions = [];
      for (let i = 0; i < 3; i++) {
        const rar = this.rng.weighted({ common: 60, uncommon: 30, rare: 10 });
        const id = this.rng.pick(Object.keys(POTIONS).filter((k) => POTIONS[k].r === rar));
        potions.push({ id, price: price(POTION_PRICE[rar]), sold: false });
      }
      return { cards, relics, potions, removeCost: 75 + 25 * this.removals, removed: false };
    }
    shopBuy(kind, i) {
      const item = this.shop[kind][i];
      if (!item || item.sold || this.gold < item.price) return false;
      if (kind === 'potions' && !this.canGainPotion()) return false;
      this.gold -= item.price; item.sold = true;
      if (kind === 'cards') this.addCard(item.id);
      else if (kind === 'relics') this.addRelic(item.id);
      else this.addPotion(item.id);
      return true;
    }
    shopRemove() {
      const s = this.shop;
      if (s.removed || this.gold < s.removeCost || !this.deck.length) return false;
      this.pickInfo = { t: 'pick', mode: 'remove', back: 'shop', cost: s.removeCost }; this.phase = 'pick';
      return true;
    }
    shopLeave() { this.shop = null; this.advance(); }

    /* ---- 药水（地图上） ---- */
    discardPotion(i) { this.potions[i] = null; }
  }

  Object.assign(XX, { RNG, Battle, Run, Meta, store, FX, view, cardText, canUpgrade, mergeEff, MAP_W, MAP_ROWS, RUN_KEY, META_KEY });

  XX.saveRun = (run) => { if (run && run.phase === 'map') store.set(RUN_KEY, JSON.stringify(run)); };
  XX.loadRun = () => { try { const o = JSON.parse(store.get(RUN_KEY)); if (o && o.v === 1 && o.map) return Run.fromJSON(o); } catch (e) { /* ignore */ } return null; };
  XX.clearRun = () => store.del(RUN_KEY);
})(typeof window !== 'undefined' ? window : globalThis);
