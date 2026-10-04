// =============================================================================
// وضع "تحدي الكمبيوتر"
// هذا الملف هو الوحيد الذي يعرف كيف يلعب الكمبيوتر. لا يستخدم أي شيء من الأونلاين (لا socket ولا مزامنة)،
// ويتعامل مع اللعبة الأساسية (game.js) عبر دوالها المعتادة فقط.
// العقل الفعلي (المحاكاة والبحث) موجود في ai-engine.js.
// =============================================================================
(function () {
    'use strict';

    // إعدادات "قوة التفكير": زيادة الأرقام تجعل الكمبيوتر أقوى وأبطأ في التفكير
    const AI_LEVEL = { budgetMs: 300, maxN: 40, horizon: 6, topK: 7 };
    const THINK_DELAY_MS = 500;   // مهلة قبل كل حركة (ليتابعها اللاعب)
    const KEY_BY_NAME = { 'light-shield': 'shield', 'light-healer': 'healer', 'falcon': 'falcon', 'sword-of-justice': 'sword', 'silent-neighbor': 'silent' };

    const statsKey = (team) => (team === 'dark' ? 'darkTeam' : 'lightTeam');
    const otherTeam = (team) => (team === 'dark' ? 'light' : 'dark');
    const computerTeam = () => otherTeam(battleScreen.dataset.selectedTeam);
    const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

    // ------------------------------------------------------------------ عرض كرت الكمبيوتر في ساحته
    function aiRenderCard(slot, card) {
        slot.classList.add('occupied-slot');
        slot.dataset.cardName = card.id;
        slot.dataset.health = card.health;
        slot.dataset.attack = card.attack;
        if (card.id === 'light-healer') slot.dataset.healUses = '0';
        slot.innerHTML = deployedCardMarkup(card, false, false);
    }

    // ------------------------------------------------------------------ نقل حالة اللعبة الحقيقية إلى المحرك
    const toSim = (c) => ({ name: c.id, key: KEY_BY_NAME[c.id] || null, cost: c.cost, hp: c.health, atk: c.attack, isBank: Boolean(c.isBankCard) });

    function bankDefinitions() {
        return [...battleShop.querySelectorAll('.bank-card[data-bank-cost]')]
            .filter((el) => !el.classList.contains('graveyard-bank-card') && el.dataset.bankAction !== 'lottery' && el.dataset.cardHealth)
            .map((el) => ({ name: el.dataset.bankName, cost: Number(el.dataset.bankCost), hp: Number(el.dataset.cardHealth), atk: Number(el.dataset.cardAttack) }));
    }

    function mirrorTeam(team, slots, isComputer) {
        const stats = playerStats[statsKey(team)];
        const board = [...slots].map((slot) => {
            if (!slot.classList.contains('occupied-slot')) return null;
            const def = resolveCardDefinition(slot.dataset.cardName, team);
            if (!def) return null;
            return { def: toSim(def), hp: Number(slot.dataset.health), atk: Number(slot.dataset.attack),
                used: slot.dataset.attackUsed === 'true', heals: Number(slot.dataset.healUses || 0), blocked: isSlotBlocked(slot) };
        });
        // يد الكمبيوتر معروفة له. أما يد اللاعب فيعرف منها الكروت الأساسية فقط (كروت البنك التي يحملها اللاعب سرّ).
        const cards = battleCards[team].filter((c) => isComputer || !c.isBankCard).map(toSim);
        const drop = {};
        dropDiscount[team].forEach((name) => { drop[name] = 1; });
        return {
            hp: stats.health, gold: stats.gold, board, cards,
            deployedThisTurn: isComputer ? cardsDeployedThisTurn : 0,
            deployed: new Set(deployedCardNames[team]),
            grave: graveyardCards.filter((c) => c.team === team).map((c) => ({ def: toSim(c) })),
            gth: goldToHealthUsed[team], htg: healthToGoldUsed[team], drop
        };
    }

    function buildMirror(team, acted) {
        const human = otherTeam(team);
        const g = new AIEngine.SimGame({
            T: { [team]: mirrorTeam(team, computerDropSlots, true), [human]: mirrorTeam(human, playerDropSlots, false) },
            bank: bankDefinitions(), phase: battlePhase, round: battlePhase, first: human,
            rng: AIEngine.mulberry32(Math.floor(Math.random() * 1e9))
        });
        g.acted = acted;
        return g;
    }

    // ------------------------------------------------------------------ تنفيذ الحركات على اللعبة الحقيقية
    const say = (message) => updateBattleNews(`🤖 ${message}`);

    function getTranslatedCardName(cardId, team) {
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang];
        const teamCards = t.cards[team];
        const cardIndex = battleCards[team].findIndex(c => c.id === cardId);
        if (cardIndex >= 0 && teamCards[cardIndex]) {
            return teamCards[cardIndex].name;
        }
        return battleCards[team].find(c => c.id === cardId)?.name || cardId;
    }

    function aiDeploy(team, simDef, slotIndex, allowSacrifice) {
        const def = battleCards[team].find((c) => c.id === simDef.name || c.name === simDef.name);
        const slot = computerDropSlots[slotIndex];
        if (!def || !slot || slot.classList.contains('occupied-slot') || deployedCardNames[team].has(def.name)) return false;

        if (cardsDeployedThisTurn >= AIEngine.RULES.maxDeployPerTurn) return false;

        const stats = playerStats[statsKey(team)];
        const cost = getDropCost(team, def);
        if (stats.gold < cost) {
            if (!allowSacrifice || !exchangeHealthForGold(team)) return false;
            if (stats.gold < cost) return false;
        }
        stats.gold -= cost;
        deployedCardNames[team].add(def.name);
        dropDiscount[team].delete(def.name);
        cardsDeployedThisTurn += 1;
        aiRenderCard(slot, def);
        renderPlayerStats();
        const translatedName = getTranslatedCardName(def.id, team);
        say(`الكمبيوتر أنزل ${translatedName} في الساحة (تكلفة ${cost}).`);
        return true;
    }

    function aiAttack(team, attackerIndex, targetIndex) {
        const attackerSlot = computerDropSlots[attackerIndex];
        const targetSlot = playerDropSlots[targetIndex];
        if (!attackerSlot || !targetSlot || battlePhase < 2) return false;
        if (!attackerSlot.classList.contains('occupied-slot') || !targetSlot.classList.contains('occupied-slot')) return false;
        if (attackerSlot.dataset.attackUsed === 'true' || getAttackBlockReason(attackerSlot, targetSlot)) return false;
        const done = resolveCombatAttack(attackerSlot, targetSlot, team, attackerSlot.dataset.cardName);
        if (done && attackerSlot.classList.contains('occupied-slot')) attackerSlot.dataset.attackUsed = 'true';
        return done;
    }

    function aiHeal(team, healerIndex, target) {
        const healerSlot = computerDropSlots[healerIndex];
        if (!healerSlot || healerSlot.dataset.cardName !== 'light-healer') return false;
        const healerHealth = Number(healerSlot.dataset.health), uses = Number(healerSlot.dataset.healUses || 0);
        if (healerHealth <= 2 || uses >= 4) return false;
        const stats = playerStats[statsKey(team)];
        let gained, targetName;
        if (target.leader) {
            if (stats.health >= 20) return false;
            gained = Math.min(20, stats.health + 2) - stats.health;
            stats.health += gained; targetName = 'ملك الفجر';
            renderLeaderInSlot(computerLeaderSlot, team);
            renderPlayerStats();
        } else {
            const targetSlot = computerDropSlots[target.idx];
            if (!targetSlot || targetSlot === healerSlot || !targetSlot.classList.contains('occupied-slot')) return false;
            const max = resolveCardDefinition(targetSlot.dataset.cardName, team)?.health ?? Infinity;
            const before = Number(targetSlot.dataset.health);
            const after = Math.min(max, before + 2);
            gained = after - before; targetName = getTranslatedCardName(targetSlot.dataset.cardName, team);
            targetSlot.dataset.health = after;
            targetSlot.querySelector('.deployed-card-health strong').textContent = after;
        }
        healerSlot.dataset.health = healerHealth - 2;
        healerSlot.dataset.healUses = String(uses + 1);
        healerSlot.querySelector('.deployed-card-health strong').textContent = healerHealth - 2;
        turnActions.computer = true;
        say(`معالجة النور عالجت ${targetName} وأضافت ${gained} حياة.`);
        return true;
    }

    function aiSilence(team, neighborIndex, targetIndex) {
        const neighborSlot = computerDropSlots[neighborIndex];
        const targetSlot = playerDropSlots[targetIndex];
        if (!neighborSlot || !targetSlot || battlePhase < 2 || neighborSlot.dataset.cardName !== 'silent-neighbor' || neighborSlot.dataset.attackUsed === 'true') return false;
        if (!targetSlot.classList.contains('occupied-slot') || isSlotBlocked(targetSlot)) return false;
        const key = getBlockKey(targetSlot);
        tempEffects.blockedCards.add(key);
        tempEffects.silencedBy.set(key, 'الجار الصامت');
        targetSlot.classList.add('blocked-card');
        turnActions.computer = true;
        const playerTeam = battleScreen.dataset.selectedTeam;
        const translatedName = getTranslatedCardName(targetSlot.dataset.cardName, playerTeam);
        say(`الجار الصامت منع ${translatedName} من الهجوم في دورك القادم.`);
        return true;
    }

    function aiBuyBank(team, bankDef, slotIndex) {
        const element = [...battleShop.querySelectorAll('.bank-card[data-bank-cost]')].find((el) => el.dataset.bankName === bankDef.name && !el.classList.contains('graveyard-bank-card'));
        if (!element || battlePhase < 3 || battleCards[team].some((c) => c.name === bankDef.name)) return false;
        const stats = playerStats[statsKey(team)];
        const cost = Number(element.dataset.bankCost);
        if (stats.gold < cost) return false;
        stats.gold -= cost;
        battleCards[team].push({
            image: element.querySelector('img').getAttribute('src'), name: bankDef.name, cost: 1,
            health: Number(element.dataset.cardHealth), attack: Number(element.dataset.cardAttack),
            description: 'كرت تم شراؤه من البنك.', isBankCard: true
        });
        renderPlayerStats();
        turnActions.computer = true;
        const translatedName = getTranslatedCardName(bankDef.name, team) || bankDef.name;
        say(`الكمبيوتر اشترى ${translatedName} من البنك مقابل ${cost} ذهب.`);
        return aiDeploy(team, bankDef, slotIndex, false);
    }

    function aiBuyBack(team, graveIndex, slotIndex) {
        const entry = graveyardCards.filter((c) => c.team === team)[graveIndex];
        if (!entry || battlePhase < 3) return false;
        const stats = playerStats[statsKey(team)];
        if (stats.gold < entry.cost) return false;
        const purchaseCost = entry.cost;
        stats.gold -= purchaseCost;
        entry.element?.remove();
        graveyardCards.splice(graveyardCards.indexOf(entry), 1);
        deployedCardNames[team].delete(entry.name);
        dropDiscount[team].add(entry.name);
        renderGraveyardBankCards();
        updateGraveyardBadge();
        renderPlayerStats();
        turnActions.computer = true;
        const translatedName = getTranslatedCardName(entry.id, team) || entry.name;
        say(`الكمبيوتر اشترى ${translatedName} من المقبرة مقابل ${purchaseCost} ذهب.`);
        return aiDeploy(team, { name: entry.name }, slotIndex, false);
    }

    function aiGoldToHealth(team) {
        const stats = playerStats[statsKey(team)];
        if (battlePhase < 3 || goldToHealthUsed[team] || stats.gold < 3) return false;
        if (team === 'dark') {
            if (stats.health >= 20) return false;
            stats.gold -= 3; stats.health = Math.min(20, stats.health + 6);
            renderLeaderInSlot(computerLeaderSlot, team);
        } else {
            const healerSlot = [...computerDropSlots].find((s) => s.dataset.cardName === 'light-healer');
            if (!healerSlot || Number(healerSlot.dataset.health) >= 12) return false;
            stats.gold -= 3;
            const health = Math.min(12, Number(healerSlot.dataset.health) + 6);
            healerSlot.dataset.health = health;
            healerSlot.querySelector('.deployed-card-health strong').textContent = health;
        }
        goldToHealthUsed[team] = true;
        turnActions.computer = true;
        renderPlayerStats();
        say(team === 'dark' ? 'الكمبيوتر استبدل 3 ذهب بـ 6 حياة لقائده.' : 'الكمبيوتر استبدل 3 ذهب بـ 6 حياة لمعالجة النور.');
        return true;
    }

    function aiLottery(team) {
        const stats = playerStats[statsKey(team)];
        if (battlePhase < 3 || stats.gold < 2) return false;
        const outcomes = [0, 10, -5];
        const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        stats.gold -= 2;
        stats.gold = Math.max(0, stats.gold + outcome);
        turnActions.computer = true;
        renderPlayerStats();
        say(outcome > 0 ? 'الكمبيوتر لعب لعبة الحظ وكسب 10 ذهبات!' : outcome < 0 ? 'الكمبيوتر لعب لعبة الحظ وخسر 5 ذهبات.' : 'الكمبيوتر لعب لعبة الحظ ولم يكسب شيئاً.');
        return true;
    }

    function executeAct(team, act) {
        switch (act.k) {
            case 'deploy': return aiDeploy(team, act.def, act.slot, act.sac);
            case 'bank': return aiBuyBank(team, act.b, act.slot);
            case 'back': return aiBuyBack(team, act.gi, act.slot);
            case 'atk': return aiAttack(team, act.ai, act.tj);
            case 'heal': return aiHeal(team, act.hi, act.target);
            case 'sil': return aiSilence(team, act.ni, act.tj);
            case 'gth': return aiGoldToHealth(team);
            case 'lot': return aiLottery(team);
            default: return false;
        }
    }

    // ------------------------------------------------------------------ دور الكمبيوتر
    function computerHasAnyMove(team) {
        // نفس تعريف "توجد حركة" في المحرك، مبنياً على الحالة الحقيقية
        return buildMirror(team, false).anyAction(team);
    }

    async function runComputerTurn(sessionId) {
        const team = computerTeam();
        const alive = () => AIMode.session === sessionId && !isGameOver && activeMode === AIMode;

        AIMode.stats.turns += 1;
        resetAttackAvailability();
        turnActions.computer = false;
        cardsDeployedThisTurn = 0;
        document.querySelector('.turn-indicator').textContent = `المرحلة ${battlePhase} - دور الكمبيوتر`;
        lightPlayerBanner.classList.toggle('active-player', team === 'light');
        darkPlayerBanner.classList.toggle('active-player', team === 'dark');
        say('الكمبيوتر يفكر...');

        // لا حركات متاحة: يضحّي بحياة القائد إن أمكن، وإلا يخسر إن كانت ساحته فارغة وحياته منخفضة
        if (!computerHasAnyMove(team)) {
            const stats = playerStats[statsKey(team)];
            if (battlePhase > 1 && stats.health > 2 && !healthToGoldUsed[team]) exchangeHealthForGold(team, true);
            else if ([...computerDropSlots].every((s) => !s.classList.contains('occupied-slot')) && stats.health <= 2) {
                isGameOver = true; isPlayerTurn = false; endTurnButton.hidden = true;
                showVictoryModal(otherTeam(team));
                say('الكمبيوتر عجز عن أي حركة وانسحب من المباراة.');
                return;
            }
        }

        let acted = turnActions.computer;
        let failures = 0;
        try {
            for (let step = 0; step < 40; step++) {
                await sleep(THINK_DELAY_MS);
                if (!alive()) return;
                const act = AIEngine.chooseAct(buildMirror(team, acted), team, AI_LEVEL);
                if (!act) break;
                if (executeAct(team, act)) { acted = true; failures = 0; AIMode.stats.acted += 1; }
                else {   // الحركة رُفضت من قواعد اللعبة الحقيقية: لا نُصرّ عليها
                    AIMode.stats.rejected += 1;
                    AIMode.stats.lastRejected = JSON.stringify(act, (k, v) => (k === 'def' || k === 'b' ? v.name : v));
                    if (++failures > 2) break;
                }
                if (!alive()) return;
            }
        } catch (error) {
            // أي خطأ غير متوقع أثناء التفكير: نسجّله وننهي دور الكمبيوتر بدل أن تتجمّد اللعبة
            console.error('خطأ في تفكير الكمبيوتر:', error);
        }
        if (!alive()) return;

        await sleep(THINK_DELAY_MS);
        if (!alive()) return;
        clearBlockedCards(team);                       // المنع الموجّه لكروت الكمبيوتر ينتهي بانتهاء دوره
        const completedPhase = battlePhase;
        advanceBattlePhase({ clearBlocks: false });    // الكمبيوتر هو الثاني: هو من يُغلق الجولة
        if (isGameOver) return;
        const income = phaseGoldIncome[battlePhase] && battlePhase > completedPhase ? phaseGoldIncome[battlePhase] : 0;

        // الدور يعود للاعب
        isPlayerTurn = true;
        turnActions.player = false;
        turnHasNoAvailableMoves = false;
        cardsDeployedThisTurn = 0;
        resetAttackAvailability();
        setTurnLockState();
        updateAttackButtons();
        updateBankControls();
        endTurnButton.hidden = false;
        endTurnButton.textContent = 'إنهاء الدور';
        updateTurnIndicator();
        updateBattleNews(`الحكم: بدأ دورك (المرحلة ${battlePhase}).${income > 0 ? ` تم توزيع ${income} ذهب لكل لاعب.` : ''}`);
        forceWithdrawalIfNoPlayerEvent();
    }

    // ------------------------------------------------------------------ تسجيل الوضع
    const AIMode = {
        id: 'ai',
        session: 0,
        stats: { turns: 0, acted: 0, rejected: 0 },   // إحصاءات للفحص والاختبار

        // بدء مباراة ضد الكمبيوتر (اللاعب يبدأ أولاً)
        start(playerTeam) {
            activeMode = AIMode;
            AIMode.session += 1;
            showBattleScreen(playerTeam, true);
            updateTurnIndicator();
            updateBattleNews(battleText('aiStarted', 'The computer match has started. Deploy your cards, then end your turn.'));
        },

        // يستدعيها game.js عندما ينهي اللاعب دوره (بعد التحقق من قاعدة "لا تنهِ دورك بلا حدث")
        finishTurn() {
            const playerTeam = battleScreen.dataset.selectedTeam;
            isPlayerTurn = false;
            hideEmergencySacrificeModal();
            hideAttackModal();
            hideSilenceModal();
            clearBlockedCards(playerTeam);        // المنع الموجّه لكروت اللاعب ينتهي بانتهاء دوره
            setTurnLockState();
            updateAttackButtons();
            updateBankControls();
            endTurnButton.hidden = true;
            const sessionId = AIMode.session;
            window.setTimeout(() => {
                if (AIMode.session === sessionId && !isGameOver && activeMode === AIMode) runComputerTurn(sessionId);
            }, 400);
        },

        // مغادرة المباراة (زر الرجوع أو نهايتها): نلغي أي تفكير جارٍ
        leaveMatch() { AIMode.session += 1; },

        // الخروج من وضع الكمبيوتر كلياً
        exit() { AIMode.session += 1; if (activeMode === AIMode) activeMode = null; }
    };

    window.AIMode = AIMode;
})();
