// =============================================================================
// محرك العقل الإلكتروني (بلا أي اعتماد على الصفحة)
// - نسخة رياضية من قواعد اللعبة تُستخدم لتجربة الحركات "في الخيال" قبل تنفيذها.
// - يختار الحركة الأفضل بمحاكاة مئات المباريات القصيرة (Monte-Carlo) بعد كل حركة محتملة.
// لا يلمس هذا الملف الواجهة إطلاقاً؛ الجسر إلى اللعبة موجود في ai.js.
// =============================================================================
(function (root) {
    'use strict';

    const RULES = {
        leaderDmg: 5, killGold: 2, econGold: 25, startHp: 20,
        lottery: [0, 10, -5], lotteryCost: 2,
        attackPhase: 2, bankPhase: 3,
        income: { 2: 4, 3: 3, 4: 2, 5: 1 },
        healCost: 2, healAmount: 2, maxHeals: 4,
        discountedDropCost: 1,          // إنزال كرت اشتُري من البنك أو المقبرة
        maxRounds: 40, maxDeployPerTurn: 2
    };
    const SPECIAL = { shield: 4, sword: 3, falcon: 2, healer: 3, silent: 3 };

    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const opp = (t) => (t === 'light' ? 'dark' : 'light');

    function cloneTeam(T) {
        return {
            hp: T.hp, gold: T.gold, deployedThisTurn: T.deployedThisTurn || 0,
            board: T.board.map((c) => c && { def: c.def, hp: c.hp, atk: c.atk, used: c.used, heals: c.heals, blocked: c.blocked }),
            cards: T.cards.slice(), deployed: new Set(T.deployed), grave: T.grave.slice(),
            gth: T.gth, htg: T.htg, drop: Object.assign({}, T.drop)
        };
    }

    // ------------------------------------------------------------------ اللعبة
    class SimGame {
        constructor(o) {
            this.R = o.rules || RULES; this.T = o.T; this.bank = o.bank || [];
            this.phase = o.phase; this.round = o.round || o.phase; this.first = o.first;
            this.rng = o.rng || Math.random; this.over = false; this.winner = null; this.type = null;
            this.acted = false; this.silenced = 0;
        }
        clone() {
            const g = Object.create(SimGame.prototype);
            g.R = this.R; g.bank = this.bank; g.rng = this.rng; g.first = this.first; g.round = this.round; g.phase = this.phase;
            g.over = this.over; g.winner = this.winner; g.type = this.type; g.acted = this.acted; g.silenced = this.silenced;
            g.T = { light: cloneTeam(this.T.light), dark: cloneTeam(this.T.dark) };
            return g;
        }
        hand(t) { const T = this.T[t]; return T.cards.filter((c) => !T.deployed.has(c.name)); }
        dropCost(T, def) { return T.drop[def.name] !== undefined ? T.drop[def.name] : (def.isBank ? this.R.discountedDropCost : def.cost); }
        setOver(w, type) { if (this.over) return; this.over = true; this.winner = w; this.type = type; }
        checkEcon() {
            if (this.over) return;
            if (this.T.light.gold >= this.R.econGold) this.setOver('light', 'economic');
            else if (this.T.dark.gold >= this.R.econGold) this.setOver('dark', 'economic');
        }
        hasShield(t) { return this.T[t].board.some((c) => c && c.def.key === 'shield'); }
        damageLeader(t) { if (this.hasShield(t)) return; const T = this.T[t]; T.hp = Math.max(0, T.hp - this.R.leaderDmg); }
        removeCard(t, idx) { const T = this.T[t]; const c = T.board[idx]; T.grave.push({ def: c.def }); this.damageLeader(t); T.board[idx] = null; }

        sacrifice(t, need) {
            const T = this.T[t];
            if (T.hp <= 2 || T.htg || T.gold + 5 < need) return false;
            T.hp -= 2; T.gold += 5; T.htg = true; this.checkEcon(); return true;
        }
        deploy(t, def, slot, allowSac) {
            const T = this.T[t];
            if (this.over || T.board[slot] || T.deployed.has(def.name)) return false;
            if ((T.deployedThisTurn || 0) >= this.R.maxDeployPerTurn) return false;
            const cost = this.dropCost(T, def);
            if (T.gold < cost && !(allowSac && this.sacrifice(t, cost))) return false;
            if (T.gold < cost) return false;
            T.gold -= cost; T.deployed.add(def.name); delete T.drop[def.name];
            T.deployedThisTurn = (T.deployedThisTurn || 0) + 1;
            T.board[slot] = { def, hp: def.hp, atk: def.atk, used: false, heals: 0, blocked: false };
            this.acted = true; return true;
        }
        buyBank(t, b) {
            const T = this.T[t];
            if (this.over || this.phase < this.R.bankPhase || T.cards.some((c) => c.name === b.name) || T.gold < b.cost) return false;
            T.gold -= b.cost; T.cards.push({ name: b.name, key: null, cost: 1, hp: b.hp, atk: b.atk, isBank: true });
            this.acted = true; return true;
        }
        buyBack(t, gi) {
            const T = this.T[t]; const e = T.grave[gi];
            if (this.over || this.phase < this.R.bankPhase || !e || T.gold < e.def.cost) return false;
            T.gold -= e.def.cost; T.grave.splice(gi, 1); T.deployed.delete(e.def.name); T.drop[e.def.name] = this.R.discountedDropCost;
            this.acted = true; return true;
        }
        lottery(t) {
            const T = this.T[t];
            if (this.over || this.phase < this.R.bankPhase || T.gold < this.R.lotteryCost) return false;
            T.gold -= this.R.lotteryCost;
            const o = this.R.lottery[Math.floor(this.rng() * this.R.lottery.length)];
            T.gold = Math.max(0, T.gold + o); this.acted = true; this.checkEcon(); return true;
        }
        goldToHealth(t) {
            const T = this.T[t];
            if (this.over || this.phase < this.R.bankPhase || T.gth || T.gold < 3) return false;
            if (t === 'dark') { if (T.hp >= this.R.startHp) return false; T.gold -= 3; T.hp = Math.min(this.R.startHp, T.hp + 6); }
            else { const H = T.board.find((c) => c && c.def.key === 'healer'); if (!H || H.hp >= 12) return false; T.gold -= 3; H.hp = Math.min(12, H.hp + 6); }
            T.gth = true; this.acted = true; return true;
        }
        attackReason(t, ai, tj) {
            const A = this.T[t].board[ai]; const ot = opp(t); const D = this.T[ot].board[tj];
            if (this.phase < this.R.attackPhase) return 'phase';
            if (!A || !D) return 'empty';
            if (A.used) return 'used'; if (A.blocked) return 'blocked'; if (A.atk <= 0) return 'noatk';
            if (A.atk < D.atk) return 'weak';
            if (D.def.key === 'sword' && A.atk <= D.atk) return 'sword';
            if (D.def.key === 'healer' && this.T[ot].board.some((c) => c && c.def.key === 'falcon')) return 'falcon';
            return null;
        }
        attack(t, ai, tj) {
            if (this.over || this.attackReason(t, ai, tj)) return false;
            const ot = opp(t); const A = this.T[t].board[ai]; const D = this.T[ot].board[tj];
            A.hp -= D.atk; D.hp -= A.atk;
            const tDies = D.hp <= 0, aDies = A.hp <= 0;
            if (tDies) { this.T[t].gold += this.R.killGold; this.checkEcon(); }
            if (this.over) return true;
            if (tDies) this.removeCard(ot, tj);
            if (aDies) this.removeCard(t, ai); else A.used = true;
            this.acted = true;
            const a = this.T[t].hp, d = this.T[ot].hp;
            if (a === 0 || d === 0) this.setOver(a === 0 && d === 0 ? t : (a > 0 ? t : ot), 'military');
            return true;
        }
        heal(t, hi, target) {
            const T = this.T[t]; const H = T.board[hi];
            if (this.over || !H || H.def.key !== 'healer' || this.phase < 2 || H.heals >= this.R.maxHeals || H.hp <= this.R.healCost) return false;
            if (target.leader) { if (T.hp >= this.R.startHp) return false; T.hp = Math.min(this.R.startHp, T.hp + this.R.healAmount); }
            else { const C = T.board[target.idx]; if (!C || C === H) return false; C.hp = Math.min(C.def.hp, C.hp + this.R.healAmount); }
            H.hp -= this.R.healCost; H.heals++; this.acted = true; return true;
        }
        silence(t, ni, tj) {
            const N = this.T[t].board[ni]; const D = this.T[opp(t)].board[tj];
            if (this.over || !N || N.def.key !== 'silent' || this.phase < 2 || N.used || !D || D.blocked) return false;
            D.blocked = true; this.silenced++; this.acted = true; return true;
        }
        applyAct(t, a) {
            switch (a.k) {
                case 'deploy': return this.deploy(t, a.def, a.slot, a.sac);
                case 'bank': {
                    if (!this.buyBank(t, a.b)) return false;
                    const T = this.T[t]; return this.deploy(t, T.cards[T.cards.length - 1], a.slot, false);
                }
                case 'back': { const d = this.T[t].grave[a.gi] && this.T[t].grave[a.gi].def; if (!d || !this.buyBack(t, a.gi)) return false; return this.deploy(t, d, a.slot, false); }
                case 'atk': return this.attack(t, a.ai, a.tj);
                case 'heal': return this.heal(t, a.hi, a.target);
                case 'sil': return this.silence(t, a.ni, a.tj);
                case 'gth': return this.goldToHealth(t);
                case 'lot': return this.lottery(t);
                default: return false;
            }
        }
        anyAction(t) {
            const T = this.T[t], O = this.T[opp(t)]; const free = T.board.some((c) => !c);
            if (free && this.hand(t).some((c) => this.dropCost(T, c) <= T.gold)) return true;
            if (this.phase >= 2) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (T.board[i] && O.board[j] && !this.attackReason(t, i, j)) return true;
            const H = T.board.find((c) => c && c.def.key === 'healer');
            if (H && this.phase >= 2 && H.hp > this.R.healCost && (T.hp < this.R.startHp || T.board.some((c) => c && c !== H && c.hp < c.def.hp))) return true;
            if (this.phase >= this.R.bankPhase && (T.gold >= this.R.lotteryCost || this.bank.some((b) => b.cost <= T.gold) || T.grave.some((e) => e.def.cost <= T.gold))) return true;
            return false;
        }
        beginTurn(t) {
            this.acted = false; this.silenced = 0;
            this.T[t].deployedThisTurn = 0;
            this.T[t].board.forEach((c) => { if (c) { c.used = false; c.heals = 0; } });
        }
        endTurn(t) { this.T[t].board.forEach((c) => { if (c) c.blocked = false; }); }
        advanceRound() {
            this.round++; this.phase = Math.min(this.round, 5);
            const inc = this.R.income[this.phase] || 0;
            for (const t of ['light', 'dark']) { this.T[t].gold += inc; this.T[t].htg = false; }
            this.checkEcon();
        }
        // دور كامل لبوت داخل المحاكاة
        takeTurn(t, bot) {
            const T = this.T[t]; this.beginTurn(t);
            if (!this.anyAction(t)) {
                if (this.round > 1 && T.hp > 2 && !T.htg) { T.hp -= 2; T.gold += 5; T.htg = true; this.checkEcon(); }
                else if (T.board.every((c) => !c) && T.hp <= 2) { this.setOver(opp(t), 'nomoves'); return; }
            }
            if (!this.over) bot.turn(this, t);
            this.endTurn(t);
        }
        // بعد أن ينهي t دوره: هل تنتهي الجولة؟ (اللاعب الثاني يغلق الجولة)
        afterTurn(t) { if (!this.over && this.first !== t) this.advanceRound(); }
        boardValue(t, p) { let v = 0; for (const c of this.T[t].board) if (c) v += valueOf(c.def, p, c.hp); return v; }
        evaluate(t) {
            if (this.over) return this.winner === t ? 1 : (this.winner === null ? 0.5 : 0);
            const me = this.T[t], op = this.T[opp(t)];
            const hpTerm = (me.hp - op.hp) / 20, goldTerm = (me.gold - op.gold) / 25;
            const boardTerm = (this.boardValue(t, EVAL) - this.boardValue(opp(t), EVAL)) / 40;
            return 0.5 + 0.5 * Math.tanh((hpTerm * 0.5 + goldTerm * 0.2 + boardTerm * 0.3) * 2);
        }
    }

    // ---------------------------------------------------------------- تقييم الكروت
    const EVAL = { hpW: 0.45, bonus: true, bonusScale: 1 };
    function valueOf(def, p, hp) {
        let v = def.atk + (p.hpW !== undefined ? p.hpW : 0.45) * (hp !== undefined ? hp : def.hp);
        if (p.bonus) v += (p.bonusScale !== undefined ? p.bonusScale : 1) * (SPECIAL[def.key] || 0);
        return v;
    }

    // ------------------------------------------------------------------- البوت
    class SimBot {
        constructor(p) { this.p = p; }
        attackValue(g, t, ai, tj) {
            const ot = opp(t), T = g.T[t], O = g.T[ot], A = T.board[ai], D = O.board[tj];
            const kill = D.hp <= A.atk, die = A.hp <= D.atk; const oS = g.hasShield(ot), tS = g.hasShield(t);
            let s = 0;
            if (kill) { s += g.R.killGold + valueOf(D.def, this.p, D.hp) * 0.9 + (oS ? 0 : g.R.leaderDmg) * this.p.leaderW; if (!oS && O.hp <= g.R.leaderDmg) s += 50; }
            else s += A.atk * 0.25;
            if (die) { s -= valueOf(A.def, this.p, A.hp) * 0.9 + (tS ? 0 : g.R.leaderDmg); if (!tS && T.hp <= g.R.leaderDmg) s -= 50; }
            else s -= D.atk * 0.25;
            return s;
        }
        candidates(g, t) {
            const T = g.T[t], O = g.T[opp(t)], out = []; const P = this.p; const cw = P.costW;
            const free = T.board.findIndex((c) => !c);
            if (free >= 0 && (T.deployedThisTurn || 0) < g.R.maxDeployPerTurn) {
                for (const def of g.hand(t)) {
                    const cost = g.dropCost(T, def); const base = valueOf(def, P) - cw * cost + 1;
                    if (T.gold >= cost) out.push({ s: base, act: { k: 'deploy', def, slot: free, sac: false } });
                    else if (g.round > 1 && T.hp > 8 && !T.htg && T.gold + 5 >= cost) out.push({ s: base - 2.5, act: { k: 'deploy', def, slot: free, sac: true } });
                }
                if (g.phase >= g.R.bankPhase) {
                    for (const b of g.bank) if (!T.cards.some((c) => c.name === b.name) && T.gold >= b.cost + g.R.discountedDropCost) {
                        out.push({ s: valueOf(b, P) - cw * (b.cost + g.R.discountedDropCost) + 0.6, act: { k: 'bank', b, slot: free } });
                    }
                    T.grave.forEach((e, gi) => {
                        const need = e.def.cost + g.R.discountedDropCost;
                        if (T.gold >= need) out.push({ s: valueOf(e.def, P) - cw * need + 0.4, act: { k: 'back', gi, slot: free } });
                    });
                }
            }
            if (g.phase >= g.R.attackPhase) {
                T.board.forEach((A, ai) => {
                    if (!A) return;
                    O.board.forEach((D, tj) => {
                        if (!D || g.attackReason(t, ai, tj)) return;
                        out.push({ s: this.attackValue(g, t, ai, tj) - P.attackThr, act: { k: 'atk', ai, tj } });
                    });
                });
            }
            const hi = T.board.findIndex((c) => c && c.def.key === 'healer');
            if (hi >= 0 && g.phase >= 2) {
                const h = T.board[hi];
                if (h.hp > g.R.healCost && h.heals < g.R.maxHeals) {
                    if (T.hp <= g.R.startHp - 4) out.push({ s: 1.2 + (T.hp <= 10 ? 1 : 0), act: { k: 'heal', hi, target: { leader: true } } });
                    T.board.forEach((c, i) => { if (c && i !== hi && c.hp <= c.def.hp - 2 && h.hp > 4) out.push({ s: 1 + c.atk * 0.1, act: { k: 'heal', hi, target: { idx: i } } }); });
                }
            }
            const ni = T.board.findIndex((c) => c && c.def.key === 'silent' && !c.used);
            if (ni >= 0 && g.phase >= 2) O.board.forEach((D, j) => { if (D && !D.blocked && D.atk > 0) out.push({ s: 1 + D.atk * 0.3, act: { k: 'sil', ni, tj: j } }); });
            if (g.phase >= g.R.bankPhase && !T.gth && T.gold >= 3) {
                if (t === 'dark' && T.hp <= 12) out.push({ s: 2.5 + (12 - T.hp) * 0.2, act: { k: 'gth' } });
                const H = T.board.find((c) => c && c.def.key === 'healer');
                if (t === 'light' && H && H.hp <= 6) out.push({ s: 1.5, act: { k: 'gth' } });
            }
            if (g.phase >= g.R.bankPhase && T.gold >= g.R.lotteryCost) out.push({ s: T.gold >= P.lotteryGold ? 0.5 : -1, act: { k: 'lot' } });
            return out;
        }
        // دور كامل داخل المحاكاة
        turn(g, t) {
            let fails = 0;
            for (let guard = 0; guard < 60 && !g.over; guard++) {
                const cands = this.candidates(g, t); let best = null, bs = 0;
                for (const c of cands) { const s = c.s + (g.rng() - 0.5) * 2 * this.p.noise; if (s > bs) { bs = s; best = c; } }
                if (!best) break;
                if (!g.applyAct(t, best.act) && ++fails > 3) break;
            }
            if (!g.acted && !g.over) {      // قاعدة: لا تنهِ دورك بلا حدث
                let best = null; for (const c of this.candidates(g, t)) if (!best || c.s > best.s) best = c;
                if (best) g.applyAct(t, best.act);
            }
        }
    }

    const SELF_PARAMS = { attackThr: 1.0, leaderW: 1.0, hpW: 0.45, costW: 0.7, bonus: true, bonusScale: 1, noise: 0.5, lotteryGold: 99 };
    function sampleOpponent(rng) {
        const u = (a, b) => a + (b - a) * rng();
        return { attackThr: u(-0.5, 3), leaderW: u(0.6, 1.6), hpW: u(0.35, 0.6), costW: u(0.5, 0.9), bonus: true, bonusScale: u(0.3, 1.4), noise: u(0.3, 1), lotteryGold: rng() < 0.85 ? 99 : u(6, 12) };
    }

    // ----------------------------------------------------------------- البحث
    // يجرّب كل حركة ممكنة (وإنهاء الدور) ثم يلعب باقي المباراة عشرات المرات ويختار الأفضل نتيجة.
    function playOut(g0, t, act, oppParams, seed, horizon) {
        const g = g0.clone(); g.rng = mulberry32(seed); g.acted = g0.acted;
        const self = new SimBot(SELF_PARAMS), other = new SimBot(oppParams);
        if (act) { if (!g.applyAct(t, act)) return g.evaluate(t) - 0.2; self.turn(g, t); }
        g.endTurn(t); g.afterTurn(t);
        let cur = opp(t);
        for (let i = 0; i < horizon && !g.over; i++) {
            g.takeTurn(cur, cur === t ? self : other); g.afterTurn(cur); cur = opp(cur);
        }
        return g.evaluate(t);
    }

    function chooseAct(g0, t, o) {
        o = o || {};
        const budget = o.budgetMs !== undefined ? o.budgetMs : 350, maxN = o.maxN || 40, horizon = o.horizon || 6, topK = o.topK || 7;
        const seedBase = o.seed !== undefined ? o.seed : Math.floor(Math.random() * 1e9);
        const bot = new SimBot(SELF_PARAMS);
        const cands = bot.candidates(g0, t).filter((c) => c.s > -3).sort((a, b) => b.s - a.s).slice(0, topK);
        const options = cands.map((c) => ({ act: c.act, sum: 0, n: 0 }));
        if (g0.acted || options.length === 0) options.push({ act: null, sum: 0, n: 0 });        // إنهاء الدور
        if (options.length === 1) return options[0].act;
        const rngOpp = mulberry32(seedBase ^ 0x9e3779b9);
        const oppSamples = []; for (let i = 0; i < maxN; i++) oppSamples.push(sampleOpponent(rngOpp));
        const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const t0 = now();
        for (let r = 0; r < maxN; r++) {
            for (const op of options) { op.sum += playOut(g0, t, op.act, oppSamples[r], seedBase + r * 7919, horizon); op.n++; }
            if (r >= 5 && now() - t0 > budget) break;
        }
        let best = options[0];
        for (const op of options) if (op.sum / op.n > best.sum / best.n) best = op;
        return best.act;
    }

    root.AIEngine = { RULES, SimGame, SimBot, SELF_PARAMS, chooseAct, mulberry32, opp, valueOf, sampleOpponent };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.AIEngine;
})(typeof window !== 'undefined' ? window : globalThis);
