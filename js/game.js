// =============================================================================
// حرب الفصائل — اللعبة الأساسية (مشتركة بين الوضعين)
// هنا: الكروت، الساحة، الذهب والصحة، الهجوم والمعالجة والمنع، البنك والمقبرة، الفوز والخسارة.
// لا يوجد هنا أي كود أونلاين ولا أي ذكاء اصطناعي. الوضعان يعيشان في ملفين مستقلين:
//   js/online.js  ← تحدي ناس حقيقيين (socket + مزامنة)
//   js/ai.js      ← تحدي الكمبيوتر (العقل الإلكتروني؛ محركه في js/ai-engine.js)
//   js/main.js    ← شاشة الترحيب وتوجيه اللاعب
// وكل وضع يسجّل نفسه في المتغير activeMode ويستجيب لثلاثة خطافات فقط:
// afterAction / finishTurn / leaveMatch (انظر notifyStateChange و endPlayerTurn و showSelectionScreen).
// =============================================================================
const selectionScreen = document.querySelector('#selection-screen');
const battleScreen = document.querySelector('#battle-screen');
const guideModal = document.querySelector('#guide-modal');
const openGuide = document.querySelector('#open-guide');
const closeGuide = document.querySelector('#close-guide');
const bankToggle = document.querySelector('#bank-toggle');
const battleShop = document.querySelector('#battle-shop');
const goldToHealthButton = document.querySelector('#gold-to-health-button');
const healthToGoldButton = document.querySelector('#health-to-gold-button');
const emergencySacrificeModal = document.querySelector('#emergency-sacrifice-modal');
const acceptSacrificeButton = document.querySelector('#accept-sacrifice-button');
const declineSacrificeButton = document.querySelector('#decline-sacrifice-button');
const battleHand = document.querySelector('#battle-hand');
const battleArena = document.querySelector('.battle-arena');
const lightPlayerBanner = document.querySelector('#light-player-banner');
const darkPlayerBanner = document.querySelector('#dark-player-banner');
const battleBackButton = document.querySelector('#battle-back-button');
const leaderSlot = document.querySelector('#leader-slot');
const computerLeaderSlot = document.querySelector('#computer-leader-slot');
const battleNewsText = document.querySelector('#battle-news-text');
const playerDropSlots = document.querySelectorAll('.drop-slot');
const computerDropSlots = document.querySelectorAll('.computer-slot');
const endTurnButton = document.querySelector('#end-turn-button');
const battleGraveyard = document.querySelector('#battle-graveyard');
const battleGraveyardSlots = document.querySelector('#battle-graveyard-slots');
const graveyardToggle = document.querySelector('#graveyard-toggle');
const graveyardToggleCount = document.querySelector('#graveyard-toggle-count');
const shopCloseButton = document.querySelector('#shop-close');
const lotteryToggle = document.querySelector('#lottery-toggle');
const attackModal = document.querySelector('#attack-modal');
const attackTargets = document.querySelector('#attack-targets');
const attackEmptyMessage = document.querySelector('#attack-empty-message');
const closeAttackModal = document.querySelector('#close-attack-modal');
const silenceModal = document.querySelector('#silence-modal');
const silenceTargets = document.querySelector('#silence-targets');
const silenceEmptyMessage = document.querySelector('#silence-empty-message');
const closeSilenceModal = document.querySelector('#close-silence-modal');
const cardInfoModal = document.querySelector('#card-info-modal');
const closeCardInfoModal = document.querySelector('#close-card-info-modal');
const graveyardBankCards = document.querySelector('#graveyard-bank-cards');
const victoryModal = document.querySelector('#victory-modal');
const victoryLeaderImage = document.querySelector('#victory-leader-image');
const victoryResultIcon = document.querySelector('#victory-result-icon');
const victoryTitle = document.querySelector('#victory-title');
const victoryMessage = document.querySelector('#victory-message');
const insufficientGoldModal = document.querySelector('#insufficient-gold-modal');
const insufficientGoldMessage = document.querySelector('#insufficient-gold-message');
const closeInsufficientGold = document.querySelector('#close-insufficient-gold');
const turnConfirmModal = document.querySelector('#turn-confirm-modal');
const withdrawTurnButton = document.querySelector('#withdraw-turn-button');
const continueTurnButton = document.querySelector('#continue-turn-button');
const ECONOMIC_VICTORY_GOLD = 25;
let isPlayerTurn = true;
let deployedCardCount = 0;
let battlePhase = 1;
let isGameOver = false;
let matchResult = null;           // نتيجة المباراة { winner, type }
let turnHasNoAvailableMoves = false;
let victoryReturnTimer = null;

// الوضع الحالي للعب ('online' أو 'ai'): يسجّل نفسه هنا من online.js أو ai.js.
// game.js لا يعرف تفاصيل أي وضع؛ يكتفي باستدعاء هذه الخطافات:
//   afterAction()  بعد كل حركة تغيّر الحالة     finishTurn()  عند إنهاء اللاعب دوره     leaveMatch()  عند مغادرة المباراة
let activeMode = null;
function notifyStateChange() { if (activeMode && activeMode.afterAction) activeMode.afterAction(); }

// كروت اشتراها اللاعب من البنك أو المقبرة: إنزالها يكلّف 1 ذهب فقط
const DISCOUNTED_DROP_COST = 1;
const dropDiscount = { light: new Set(), dark: new Set() };
function getDropCost(team, card) {
    return (card.isBankCard || dropDiscount[team].has(card.name)) ? DISCOUNTED_DROP_COST : card.cost;
}
const turnActions = { player: false, computer: false };
const goldToHealthUsed = { light: false, dark: false };
const healthToGoldUsed = { light: false, dark: false };
let victoryTimer = null;
let insufficientGoldTimer = null;
const deployedCardNames = { light: new Set(), dark: new Set() };
const graveyardCards = [];
const phaseGoldIncome = { 2: 4, 3: 3, 4: 2, 5: 1 };

// نظام التأثيرات المؤقتة
const tempEffects = {
    blockedCards: new Set(), // مفاتيح الخانات الممنوعة من الهجوم: "الفريق_رقم الخانة" مثل light_2
    silencedBy: new Map() // يربط الكرت الممنوع بالكرت الذي منعه
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

// الفريق الذي تنتمي إليه الخانة (خانات اللاعب = فريقه، خانات الخصم = الفريق الآخر)
function getSlotTeam(slot) {
    const playerTeam = battleScreen.dataset.selectedTeam || 'light';
    if (slot.classList.contains('computer-slot')) return playerTeam === 'dark' ? 'light' : 'dark';
    return playerTeam;
}

// المفتاح مبني على الفريق ورقم الخانة، فهو متطابق عند اللاعبين الاثنين
function getBlockKey(slot) {
    return `${getSlotTeam(slot)}_${slot.dataset.slotIndex}`;
}

function isSlotBlocked(slot) {
    return Boolean(slot) && tempEffects.blockedCards.has(getBlockKey(slot));
}

// مصدر واحد لقواعد الهجوم: يستخدمه اللاعب والكمبيوتر وواجهة اختيار الهدف
function getAttackBlockReason(attackerSlot, targetSlot) {
    const attackerAttack = Number(attackerSlot.dataset.attack);
    const targetAttack = Number(targetSlot.dataset.attack);
    if (isSlotBlocked(attackerSlot)) return 'الكرت المهاجم ممنوع من الهجوم (الجار الصامت)';
    if (attackerAttack < targetAttack) return 'قوة غير كافية';
    if (targetSlot.dataset.cardName === 'سيف العدالة' && attackerAttack <= targetAttack) return 'يحتاج قوة أعلى';
    if (targetSlot.dataset.cardName === 'معالجة النور') {
        const targetSlots = targetSlot.classList.contains('computer-slot') ? computerDropSlots : playerDropSlots;
        const hasFalcon = [...targetSlots].some((slot) => slot.classList.contains('occupied-slot') && slot.dataset.cardName === 'الصقر الجارح');
        if (hasFalcon) return 'مخفية من الصقر الجارح';
    }
    return '';
}

function updateBattleNews(newMessage) {
    if (!battleNewsText.querySelector('.news-content')) battleNewsText.innerHTML = '';
    const entry = document.createElement('div');
    entry.className = 'news-content';
    entry.textContent = newMessage;
    battleNewsText.appendChild(entry);
    const entries = battleNewsText.querySelectorAll('.news-content');
    if (entries.length > 60) entries[0].remove();
    // التمرير إلى الأسفل لعرض آخر حدث
    battleNewsText.scrollTop = battleNewsText.scrollHeight;
}

const battleCards = {
    light: [
        { image: 'assets/images/cards/Good/falcon.png', name: 'الصقر الجارح', cost: 2, health: 8, attack: 2, description: 'حماية التخفي: طالما هو حي في ساحتك، يمنع الخصم تماماً من استهداف كرت معالجة النور بالهجوم. الكرت يحمي معالجة النور من الهجمات المباشرة مما يجعلها أكثر أماناً لتقديم العلاج للحلفاء.' },
        { image: 'assets/images/cards/Good/light-healer.png', name: 'معالجة النور', cost: 2, health: 12, attack: 0, description: 'المعالجة والترميم: لا تهاجم، بل تملك زراً خاصاً للمعالجة يعالج حليفاً أو القائد بـ +2 حياة مقابل خصم 2 من صحتها (بحد أقصى 4 علاجات في الجولة، وتتوقف إذا بلغت صحتها 2).' },
        { image: 'assets/images/cards/Good/cunning-trader.png', name: 'التاجر الماكر', cost: 3, health: 6, attack: 5, description: 'توليد الذهب الدوري: يمنح فريقه +1 قطعة ذهب تلقائياً في نهاية كل جولة طالما هو متواجد في ساحة المعركة.' },
        { image: 'assets/images/cards/Good/vault-guardian.png', name: 'حارس الخزنة', cost: 4, health: 11, attack: 7, description: 'مقاتل قوي يحمي الفريق بقوة هجومية عالية وصحة جيدة.' },
        { image: 'assets/images/cards/Good/light-shield.png', name: 'درع النور', cost: 4, health: 13, attack: 3, description: 'يحمي ملك الفجر من الضرر. حياة الملك لا تنقص طالما الدرع في الساحة.' },
        { image: 'assets/images/cards/Good/sword-of-justice.png', name: 'سيف العدالة', cost: 5, health: 9, attack: 8, description: 'حماية العدالة: لا يمكن هجومه إلا إذا كان المهاجم أقوى منه بقوة هجومية أعلى.' }
    ],
    dark: [
        { image: 'assets/images/cards/Evil/silent-neighbor.png', name: 'الجار الصامت', cost: 2, health: 8, attack: 3, description: 'الصمت والمنع: يملك زراً خاصاً `🔇 منع كرت` يمنع كرتاً معادياً من الهجوم في الدورة التالية. الكرت يتسلل إلى ساحة الخصم ويختار أقوى كرت لديه لمنعه من الهجوم.' },
        { image: 'assets/images/cards/Evil/hell-dragon.png', name: 'تنين الجحيم', cost: 6, health: 15, attack: 8, description: 'وحش قوي جداً بقوة هجومية عالية وصحة عالية، يشكل تهديداً كبيراً في المعركة. يمتلك أعلى إحصائيات في اللعبة ويمكنه هزيمة معظم الكروت الأخرى.' },
        { image: 'assets/images/cards/Evil/dark-ghoul.png', name: 'غول الظلام', cost: 4, health: 13, attack: 5, description: 'مقاتل ضخم يتحمل الضربات بقوة هجومية متوسطة وصحة عالية. كرت متين يمكنه الصمود أمام الهجمات المتعددة وإلحاق الضرر بقوة.' },
        { image: 'assets/images/cards/Evil/dread-priest.png', name: 'كاهن الرعب', cost: 3, health: 9, attack: 4, description: 'مقاتل متوازن بقوة هجومية وصحة متوسطة. كرت اقتصادي يمكن استدعاؤه بسهولة ويوفر توازناً جيداً بين الهجوم والدفاع.' },
        { image: 'assets/images/cards/Evil/valley-of-screams.png', name: 'وادي الصراخ', cost: 3, health: 7, attack: 4, description: 'مقاتل سريع بقوة هجومية متوسطة وصحة منخفضة. كرت اقتصادي يمكن استدعاؤه بسهولة في بداية المعركة لتوفير قوة هجومية سريعة.' },
        { image: 'assets/images/cards/Evil/box-monster.png', name: 'وحش الصندوق', cost: 4, health: 11, attack: 5, description: 'مقاتل متوازن بقوة هجومية وصحة متوسطة. كرت جيد للدفاع والهجوم مع إحصائيات متوازنة تجعله خياراً مرناً في الاستراتيجيات المختلفة.' }
    ]
};
const playerStats = {
    lightTeam: { health: 20, gold: 5 },
    darkTeam: { health: 20, gold: 5 }
};

function setTurnLockState() {
    if (!isPlayerTurn || isGameOver) clearHandSelection();
    const playerCanAct = isPlayerTurn && !isGameOver;
    const battleCardsNode = battleHand.querySelectorAll('.battle-card');
    battleCardsNode.forEach((card) => {
        card.draggable = playerCanAct;
        card.style.opacity = playerCanAct ? '' : '0.55';
        card.style.cursor = playerCanAct ? '' : 'not-allowed';
        card.setAttribute('aria-disabled', String(!playerCanAct));
    });

    bankToggle.disabled = !playerCanAct || battlePhase < 3;
    bankToggle.setAttribute('aria-disabled', String(!playerCanAct || battlePhase < 3));
    lotteryToggle.disabled = !playerCanAct || battlePhase < 3;
    lotteryToggle.setAttribute('aria-disabled', String(!playerCanAct || battlePhase < 3));
    endTurnButton.disabled = !playerCanAct;
    endTurnButton.setAttribute('aria-disabled', String(!playerCanAct));

    [...playerDropSlots].forEach((slot) => {
        slot.style.pointerEvents = playerCanAct ? '' : 'none';
    });

    // أزرار الهجوم والاستبدال تعتمد على الدور أيضاً، فنحدّثها عند كل تغيير في الدور
    updateAttackButtons();
    if (battleScreen.dataset.selectedTeam) {
        updateGoldToHealthButton();
        updateHealthToGoldButton();
    }
}

function renderBattleHand(team) {
    clearHandSelection();
    battleHand.setAttribute('aria-label', `كروت فريق ${team === 'dark' ? 'الظلام' : 'النور'}`);
    battleHand.innerHTML = battleCards[team].map((card, cardIndex) => `
        <article class="battle-card" draggable="true" data-card-index="${cardIndex}" tabindex="0" aria-label="${card.name}: التكلفة ${card.cost}، الحياة ${card.health}، القوة الهجومية ${card.attack}. ${card.description}">
            <img src="${card.image}" alt="${card.name}">
            <span class="card-cost">${card.cost}</span>
            <h2>${card.name}</h2>
            <div class="card-values"><span>❤ <strong>${card.health}</strong></span><span>⚔ <strong>${card.attack}</strong></span></div>
            <button class="card-info-button" type="button" data-card-name="${card.name}" data-card-cost="${card.cost}" data-card-health="${card.health}" data-card-attack="${card.attack}" data-card-description="${card.description}" data-card-image="${card.image}">?</button>
            <div class="card-tooltip" role="tooltip">
                <strong>${card.name}</strong>
                <span>التكلفة: ${card.cost}</span>
                <span>الحياة: ${card.health}</span>
                <span>القوة الهجومية: ${card.attack}</span>
                <p>${card.description}</p>
            </div>
        </article>
    `).join('');
    setTurnLockState();
}

function deployedCardMarkup(card, canAttack = true, isPlayerCard = true) {
    const isHealer = card.name === 'معالجة النور';
    const isSilentNeighbor = card.name === 'الجار الصامت';
    
    return `
        <img class="deployed-card-image" src="${card.image}" alt="${card.name}">
        <span class="deployed-card-name">${card.name}</span>
        <div class="deployed-card-stats">
            <span class="deployed-card-health">❤ <strong>${card.health}</strong></span>
            <span class="deployed-card-attack">⚔ <strong>${card.attack}</strong></span>
        </div>
        <button class="card-info-button" type="button" data-card-name="${card.name}" data-card-cost="${card.cost}" data-card-health="${card.health}" data-card-attack="${card.attack}" data-card-description="${card.description}" data-card-image="${card.image}">?</button>
        ${canAttack && isPlayerCard ? `
            <button class="card-attack-button ${isHealer ? 'card-heal-button' : ''}" type="button" data-card-name="${card.name}" data-action="${isHealer ? 'heal' : 'attack'}" ${battlePhase === 1 ? 'disabled' : ''}>${isHealer ? '✚' : '⚔'} <span>${isHealer ? 'معالجة' : 'هجوم'}</span></button>
            ${isSilentNeighbor ? `<button class="card-silence-button" type="button" data-card-name="${card.name}" data-action="silence" ${battlePhase === 1 ? 'disabled' : ''}>🔇 <span>منع كرت</span></button>` : ''}
        ` : ''}
    `;
}

function updateAttackButtons() {
    battleArena.querySelectorAll('.card-attack-button').forEach((button) => {
        const cardSlot = button.closest('.drop-slot');
        const isHealer = button.dataset.action === 'heal';
        const uses = Number(cardSlot?.dataset.healUses || 0);
        const healerHealth = Number(cardSlot?.dataset.health || 0);
        const isTurnLocked = !isPlayerTurn || isGameOver;
        const isBlocked = !isHealer && isSlotBlocked(cardSlot);
        button.disabled = isTurnLocked || battlePhase === 1 || isBlocked || (isHealer ? uses >= 4 || healerHealth <= 2 : cardSlot?.dataset.attackUsed === 'true');
        button.title = isBlocked ? 'هذا الكرت ممنوع من الهجوم في هذا الدور (الجار الصامت)' : '';
    });
    battleArena.querySelectorAll('.card-silence-button').forEach((button) => {
        const cardSlot = button.closest('.drop-slot');
        button.disabled = !isPlayerTurn || isGameOver || battlePhase === 1 || cardSlot?.dataset.attackUsed === 'true';
    });
}

function resetAttackAvailability() {
    [...playerDropSlots, ...computerDropSlots].forEach((slot) => {
        delete slot.dataset.attackUsed;
        if (slot.dataset.cardName === 'معالجة النور') slot.dataset.healUses = '0';
    });
}

// إزالة المنع: كله (team = null) أو ما يخص كروت فريق معيّن فقط
function clearBlockedCards(team = null) {
    let cleared = 0;
    [...tempEffects.blockedCards].forEach((key) => {
        if (team && !key.startsWith(`${team}_`)) return;
        tempEffects.blockedCards.delete(key);
        tempEffects.silencedBy.delete(key);
        cleared += 1;
    });

    [...playerDropSlots, ...computerDropSlots].forEach((slot) => {
        if (!isSlotBlocked(slot)) slot.classList.remove('blocked-card');
    });

    if (cleared > 0) updateBattleNews('انتهت تأثيرات المنع، الكروت يمكنها الهجوم من جديد.');
}

function updateBankControls() {
    const isBankAvailable = battlePhase >= 3;
    const playerCanAct = isPlayerTurn && !isGameOver;
    bankToggle.disabled = !isBankAvailable || !playerCanAct;
    bankToggle.setAttribute('aria-disabled', String(!isBankAvailable || !playerCanAct));
    lotteryToggle.disabled = !isBankAvailable || !playerCanAct;
    lotteryToggle.setAttribute('aria-disabled', String(!isBankAvailable || !playerCanAct));
    updateGoldToHealthButton(isBankAvailable);
    updateHealthToGoldButton(isBankAvailable);
    if (!isBankAvailable || !playerCanAct) setBankOpen(false);
}

function updateGoldToHealthButton(isBankAvailable = battlePhase >= 3) {
    const team = battleScreen.dataset.selectedTeam;
    if (!team) return;
    const stats = playerStats[team === 'dark' ? 'darkTeam' : 'lightTeam'];
    const healerSlot = [...playerDropSlots].find((slot) => slot.dataset.cardName === 'معالجة النور');
    const hasTarget = team === 'dark'
        ? stats.health < 20
        : Boolean(healerSlot) && Number(healerSlot.dataset.health) < 12;
    const canUse = isBankAvailable && !goldToHealthUsed[team] && stats.gold >= 3 && hasTarget && isPlayerTurn && !isGameOver;
    goldToHealthButton.disabled = !canUse;
    goldToHealthButton.setAttribute('aria-disabled', String(!canUse));
    goldToHealthButton.title = team === 'light' && !healerSlot
        ? 'يجب أن تكون معالجة النور في الساحة أولًا'
        : 'استبدال 3 ذهب بـ 6 حياة';
}

function updateHealthToGoldButton(isBankAvailable = battlePhase >= 3) {
    if (!healthToGoldButton) return;
    const team = battleScreen.dataset.selectedTeam;
    if (!team) return;
    const stats = playerStats[team === 'dark' ? 'darkTeam' : 'lightTeam'];
    const canUse = isBankAvailable && !healthToGoldUsed[team] && stats.health > 2 && isPlayerTurn && !isGameOver;
    healthToGoldButton.disabled = !canUse;
    healthToGoldButton.setAttribute('aria-disabled', String(!canUse));
    healthToGoldButton.title = stats.health <= 2
        ? 'لا يمكن التضحية عندما تكون صحة القائد 2 أو أقل'
        : (healthToGoldUsed[team] ? 'تم استخدام الاستبدال لهذه الجولة' : 'استبدال 2 حياة من القائد بـ 5 ذهب');
}

function checkEconomicVictory() {
    if (isGameOver) return;
    if (playerStats.lightTeam.gold >= ECONOMIC_VICTORY_GOLD) {
        isGameOver = true;
        isPlayerTurn = false;
        endTurnButton.hidden = true;
        showVictoryModal('light', 'economic');
        updateBattleNews(`حقق فريق النور النصر الاقتصادي بعد وصول رصيده إلى ${playerStats.lightTeam.gold} قطعة ذهب!`);
        document.querySelector('.turn-indicator').textContent = 'انتهت المباراة - نصر اقتصادي';
    } else if (playerStats.darkTeam.gold >= ECONOMIC_VICTORY_GOLD) {
        isGameOver = true;
        isPlayerTurn = false;
        endTurnButton.hidden = true;
        showVictoryModal('dark', 'economic');
        updateBattleNews(`حقق فريق الظلام النصر الاقتصادي بعد وصول رصيده إلى ${playerStats.darkTeam.gold} قطعة ذهب!`);
        document.querySelector('.turn-indicator').textContent = 'انتهت المباراة - نصر اقتصادي';
    }
}

function renderPlayerStats() {
    document.querySelector('#light-health').textContent = playerStats.lightTeam.health;
    document.querySelector('#dark-health').textContent = playerStats.darkTeam.health;
    document.querySelector('#light-gold').textContent = playerStats.lightTeam.gold;
    document.querySelector('#dark-gold').textContent = playerStats.darkTeam.gold;
    updateGoldToHealthButton();
    updateHealthToGoldButton();
    checkEconomicVictory();
}

function showInsufficientGoldMessage(card, currentGold) {
    insufficientGoldMessage.textContent = `تحتاج إلى ${card.cost} ذهب لإنزال ${card.name}، بينما رصيدك الحالي ${currentGold} ذهب.`;
    insufficientGoldModal.classList.remove('screen-hidden');
    window.clearTimeout(insufficientGoldTimer);
    insufficientGoldTimer = window.setTimeout(hideInsufficientGoldMessage, 3000);
    closeInsufficientGold.focus();
}

function hideInsufficientGoldMessage() {
    insufficientGoldModal.classList.add('screen-hidden');
}

function updateTurnIndicator() {
    if (isGameOver) return;
    const playerTeam = battleScreen.dataset.selectedTeam;
    const opponentTeam = playerTeam === 'dark' ? 'light' : 'dark';
    const activeTeam = isPlayerTurn ? playerTeam : opponentTeam;
    lightPlayerBanner.classList.toggle('active-player', activeTeam === 'light');
    darkPlayerBanner.classList.toggle('active-player', activeTeam === 'dark');
    document.querySelector('.turn-indicator').textContent = isPlayerTurn
        ? `المرحلة ${battlePhase} - دورك`
        : `المرحلة ${battlePhase} - دور الخصم`;
}

// الخادم يخبر الطرفين بصاحب الدور. تقدّم الجولة والذهب لا يحدثان هنا،
// بل عند إنهاء اللاعب الثاني لدوره ثم يصلان للخصم ضمن الحالة المتزامنة.
function lockBattleAfterGameOver() {
    isGameOver = true;
    isPlayerTurn = false;
    endTurnButton.hidden = true;
    hideAttackModal();
    hideSilenceModal();
    hideEmergencySacrificeModal();
    turnConfirmModal.classList.add('screen-hidden');
    setTurnLockState();
    updateAttackButtons();
    updateBankControls();
}

// نعرّف الكرت من بياناتنا المحلية فقط (لا نثق بنصوص/صور قادمة من الشبكة)
function resolveCardDefinition(name, preferredTeam) {
    const teams = preferredTeam
        ? [preferredTeam, preferredTeam === 'dark' ? 'light' : 'dark']
        : ['light', 'dark'];
    for (const team of teams) {
        const found = battleCards[team].find((card) => card.name === name);
        if (found) return found;
    }
    const bankElement = [...battleShop.querySelectorAll('.bank-card[data-card-health]')]
        .find((element) => element.dataset.bankName === name);
    if (bankElement) {
        return {
            image: bankElement.querySelector('img').getAttribute('src'),
            name,
            cost: 1,
            health: Number(bankElement.dataset.cardHealth),
            attack: Number(bankElement.dataset.cardAttack),
            description: 'كرت تم شراؤه من البنك.',
            isBankCard: true
        };
    }
    return null;
}

function clearSlotState(slot) {
    slot.classList.remove('occupied-slot', 'blocked-card', 'drag-over');
    delete slot.dataset.cardName;
    delete slot.dataset.health;
    delete slot.dataset.attack;
    delete slot.dataset.attackUsed;
    delete slot.dataset.healUses;
    slot.innerHTML = '';
}

function createGraveyardElement(cardName, imageSrc) {
    const element = document.createElement('div');
    element.className = 'graveyard-card';
    element.title = cardName;
    const image = document.createElement('img');
    image.src = imageSrc;
    image.alt = cardName;
    const label = document.createElement('span');
    label.textContent = cardName;
    element.append(image, label);
    return element;
}

function ensureGoldThroughLeaderSacrifice(team, neededGold, purchaseLabel) {
    const statsKey = team === 'dark' ? 'darkTeam' : 'lightTeam';
    const stats = playerStats[statsKey];

    if (stats.gold >= neededGold) return true;
    if (stats.health <= 2 || healthToGoldUsed[team]) {
        updateBattleNews(`لا يوجد مال كافٍ لشراء ${purchaseLabel}.`);
        return false;
    }

    const sacrificed = exchangeHealthForGold(team);
    if (!sacrificed) {
        updateBattleNews(`لا يمكنك شراء ${purchaseLabel} لأنك لا تملك الذهب الكافي ولا يمكنك التضحية بحياة القائد.`);
        return false;
    }

    if (stats.gold >= neededGold) return true;
    updateBattleNews(`بعد التضحية بحياة القائد، ما زال الذهب غير كافٍ لشراء ${purchaseLabel}.`);
    return false;
}

function showTurnConfirmModal() {
    turnConfirmModal.classList.remove('screen-hidden');
    continueTurnButton.focus();
}

function hideTurnConfirmModal() {
    turnConfirmModal.classList.add('screen-hidden');
    endTurnButton.focus();
}

function purchaseBankCard(bankCard) {
    if (!isPlayerTurn || isGameOver) return;
    if (battlePhase < 3) {
        updateBattleNews('سوق البنك متاح ابتداءً من المرحلة الثالثة.');
        return;
    }
    const cost = Number(bankCard.dataset.bankCost);
    const cardName = bankCard.dataset.bankName;
    const playerTeam = battleScreen.dataset.selectedTeam;
    const stats = playerStats[battleScreen.dataset.selectedTeam === 'dark' ? 'darkTeam' : 'lightTeam'];

    if (!ensureGoldThroughLeaderSacrifice(playerTeam, cost, cardName)) {
        showInsufficientGoldMessage({ name: cardName, cost }, stats.gold);
        return;
    }

    stats.gold -= cost;
    if (bankCard.dataset.bankAction === 'lottery') {
        const lotteryOutcomes = [
            { gold: 0, message: 'لم تكسب ولم تخسر شيئًا.' },
            { gold: 10, message: 'مبروك! كسبت 10 ذهبات.' },
            { gold: -5, message: 'للأسف! خسرت 5 ذهبات.' }
        ];
        const outcome = lotteryOutcomes[Math.floor(Math.random() * lotteryOutcomes.length)];
        stats.gold = Math.max(0, stats.gold + outcome.gold);
        turnActions.player = true;
        renderPlayerStats();
        const lotteryMessage = `اشتريت ${cardName} مقابل ${cost} ذهب. نتيجة القرعة: ${outcome.message}`;
        updateBattleNews(lotteryMessage);
        notifyStateChange();
        return;
    }

    const purchasedCard = {
        image: bankCard.querySelector('img').getAttribute('src'),
        name: cardName,
        cost: DISCOUNTED_DROP_COST, // إنزال كروت البنك يكلّف 1 ذهب
        health: Number(bankCard.dataset.cardHealth),
        attack: Number(bankCard.dataset.cardAttack),
        description: `كرت تم شراؤه من البنك.`,
        isBankCard: true
    };
    
    battleCards[playerTeam].push(purchasedCard);
    addCardToHand(purchasedCard);
    turnActions.player = true;
    renderPlayerStats();
    bankCard.classList.add('bank-card-purchased');
    bankCard.setAttribute('aria-label', `تم شراء ${cardName}`);
    const purchaseMessage = `تم شراء ${cardName} من البنك مقابل ${cost} ذهب وأضيف إلى يدك.`;
    updateBattleNews(purchaseMessage);
    notifyStateChange();
}

function exchangeGoldForHealth() {
    if (!isPlayerTurn || isGameOver) return;
    const team = battleScreen.dataset.selectedTeam;
    const statsKey = team === 'dark' ? 'darkTeam' : 'lightTeam';
    const stats = playerStats[statsKey];
    const healerSlot = [...playerDropSlots].find((slot) => slot.dataset.cardName === 'معالجة النور');
    const hasTarget = team === 'dark'
        ? stats.health < 20
        : Boolean(healerSlot) && Number(healerSlot.dataset.health) < 12;
    if (battlePhase < 3 || goldToHealthUsed[team] || stats.gold < 3 || !hasTarget) {
        updateGoldToHealthButton();
        return;
    }

    stats.gold -= 3;
    if (team === 'dark') {
        stats.health = Math.min(20, stats.health + 6);
        renderLeaderInSlot(leaderSlot, 'dark');
    } else {
        const health = Math.min(12, Number(healerSlot.dataset.health) + 6);
        healerSlot.dataset.health = health;
        healerSlot.querySelector('.deployed-card-health strong').textContent = health;
        updateAttackButtons();
    }
    goldToHealthUsed[team] = true;
    turnActions.player = true;
    renderPlayerStats();
    updateGoldToHealthButton();
    const exchangeMessage = team === 'dark'
        ? 'استبدل فريق الظلام 3 ذهب بـ 6 حياة لسيد الظلال.'
        : 'استبدل فريق النور 3 ذهب بـ 6 حياة لمعالجة النور.';
    updateBattleNews(exchangeMessage);
    notifyStateChange();
}

function exchangeHealthForGold(team, isEmergency = false) {
    if (isGameOver) return false;
    if (team === battleScreen.dataset.selectedTeam && !isPlayerTurn && !isEmergency) return false;
    const statsKey = team === 'dark' ? 'darkTeam' : 'lightTeam';
    const stats = playerStats[statsKey];
    if (stats.health <= 2) {
        updateBattleNews('لا يمكن التضحية: صحة القائد 2 أو أقل تجنبًا لهلاكه.');
        return false;
    }
    if (healthToGoldUsed[team] && !isEmergency) {
        updateBattleNews('تم استخدام استبدال حياة القائد بالذهب لهذه الجولة بالفعل.');
        return false;
    }

    stats.health -= 2;
    stats.gold += 5;
    healthToGoldUsed[team] = true;

    const isPlayer = team === battleScreen.dataset.selectedTeam;
    if (isPlayer) {
        turnActions.player = true;
        renderLeaderInSlot(leaderSlot, team);
    } else {
        turnActions.computer = true;
        renderLeaderInSlot(computerLeaderSlot, team);
    }

    renderPlayerStats();
    updateAttackButtons();
    updateHealthToGoldButton();
    notifyStateChange();

    const teamName = team === 'dark' ? 'فريق الظلام' : 'فريق النور';
    const leaderName = team === 'dark' ? 'سيد الظلال' : 'ملك الفجر';
    updateBattleNews(`ضحى ${leaderName} (${teamName}) بـ 2 من حياته وحصل على 5 قطع ذهب إضافية.`);
    return true;
}

function showEmergencySacrificeModal() {
    if (isGameOver) return;
    emergencySacrificeModal.classList.remove('screen-hidden');
    acceptSacrificeButton.focus();
}

function hideEmergencySacrificeModal() {
    emergencySacrificeModal.classList.add('screen-hidden');
}

function resetBattleResources(initialPlayerTurn = true) {
    window.clearTimeout(victoryTimer);
    window.clearTimeout(victoryReturnTimer);
    window.clearTimeout(insufficientGoldTimer);
    victoryModal.classList.add('screen-hidden');
    victoryModal.setAttribute('aria-hidden', 'true');
    hideInsufficientGoldMessage();
    hideEmergencySacrificeModal();
    hideAttackModal();
    hideSilenceModal();
    turnConfirmModal.classList.add('screen-hidden');
    battleShop.querySelectorAll('.bank-card-purchased').forEach((card) => {
        card.classList.remove('bank-card-purchased');
        card.removeAttribute('aria-label');
    });
    playerStats.lightTeam.health = 20;
    playerStats.darkTeam.health = 20;
    playerStats.lightTeam.gold = 5;
    playerStats.darkTeam.gold = 5;
    goldToHealthUsed.light = false;
    goldToHealthUsed.dark = false;
    healthToGoldUsed.light = false;
    healthToGoldUsed.dark = false;
    battleCards.light = battleCards.light.filter((card) => !card.isBankCard);
    battleCards.dark = battleCards.dark.filter((card) => !card.isBankCard);
    // ملاحظة: لا نحذف data-slot-index من الخانات، فهو الذي يحدد المهاجم والهدف
    [...playerDropSlots, ...computerDropSlots].forEach(clearSlotState);
    battleGraveyardSlots.innerHTML = '';
    graveyardCards.length = 0;
    updateGraveyardBadge();
    setGraveyardOpen(false);
    setBankOpen(false);
    computerLeaderSlot.innerHTML = '';
    deployedCardNames.light.clear();
    deployedCardNames.dark.clear();
    dropDiscount.light.clear();
    dropDiscount.dark.clear();
    isPlayerTurn = initialPlayerTurn;
    deployedCardCount = 0;
    endTurnButton.hidden = !isPlayerTurn;
    turnActions.player = false;
    turnActions.computer = false;
    turnHasNoAvailableMoves = false;
    matchResult = null;
    battlePhase = 1;
    isGameOver = false;

    // إعادة تعيين التأثيرات المؤقتة
    tempEffects.blockedCards.clear();
    tempEffects.silencedBy.clear();

    updateBankControls();
    renderPlayerStats();
    battleNewsText.innerHTML = '<div class="news-content">اختر كرتًا أو نفّذ أمرًا لبدء دورك.</div>';
    resetAttackAvailability();
    updateAttackButtons();
}

function handleCardDragStart(event) {
    const cardElement = event.target.closest('.battle-card');
    if (!isPlayerTurn || isGameOver) {
        event.preventDefault();
        return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', cardElement.dataset.cardIndex);
    cardElement.classList.add('is-dragging');
}

function handleCardDragEnd(event) {
    event.target.closest('.battle-card')?.classList.remove('is-dragging');
}

function handleSlotDragOver(event) {
    const slot = event.currentTarget;
    if (!slot.classList.contains('occupied-slot')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        slot.classList.add('drag-over');
    }
}

function handleSlotDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function loseIfNoAffordableCard(team, stats, deployedNames) {
    const hasAffordableCard = battleCards[team].some((card) => !deployedNames.has(card.name) && getDropCost(team, card) <= stats.gold);
    const arenaIsEmpty = [...playerDropSlots].every((slot) => !slot.classList.contains('occupied-slot'));
    if (arenaIsEmpty && !hasAffordableCard) {
        if (stats.health > 2 && !healthToGoldUsed[team]) {
            showEmergencySacrificeModal();
        } else if (stats.health <= 2) {
            isGameOver = true;
            isPlayerTurn = false;
            endTurnButton.hidden = true;
            showVictoryModal(team === 'dark' ? 'light' : 'dark');
            const noGoldMessage = 'خسر فريقك لأنه عجز عن إنزال أي كرت من يده بسبب نقص الذهب ولم تعد صحة القائد تسمح بالتضحية.';
            updateBattleNews(noGoldMessage);
        }
    }
}

// إنزال كرت في خانة، بغضّ النظر عن الطريقة (سحب بالماوس، أو اختيار الكرت ثم لمس الخانة على الجوال).
// هذه هي نقطة الإنزال الوحيدة في اللعبة؛ كلتا الطريقتين تستدعيانها فتبقى القواعد متطابقة دائماً.
function deployCardToSlot(cardIndex, slot) {
    if (!isPlayerTurn || isGameOver) return false;
    if (slot.classList.contains('occupied-slot')) return false;

    const team = battleScreen.dataset.selectedTeam;
    const card = battleCards[team][cardIndex];
    const stats = playerStats[team === 'dark' ? 'darkTeam' : 'lightTeam'];
    const deployedNames = deployedCardNames[team];

    if (!card || deployedNames.has(card.name)) {
        updateBattleNews('لا يمكن تكرار كرت موجود في ساحة المعركة.');
        return false;
    }

    const dropCost = getDropCost(team, card);
    if (dropCost > stats.gold) {
        if (!ensureGoldThroughLeaderSacrifice(team, dropCost, card.name)) {
            showInsufficientGoldMessage({ ...card, cost: dropCost }, stats.gold);
            loseIfNoAffordableCard(team, stats, deployedNames);
            return false;
        }
    }

    stats.gold -= dropCost;
    dropDiscount[team].delete(card.name);
    turnActions.player = true;
    deployedNames.add(card.name);
    deployedCardCount += 1;
    slot.classList.add('occupied-slot');
    slot.dataset.cardName = card.name;
    slot.dataset.health = card.health;
    slot.dataset.attack = card.attack;
    if (card.name === 'معالجة النور') slot.dataset.healUses = '0';
    slot.innerHTML = deployedCardMarkup(card, true, true);
    battleHand.querySelector(`[data-card-index="${cardIndex}"]`)?.remove();
    renderPlayerStats();
    updateGoldToHealthButton();
    endTurnButton.hidden = false;
    updateAttackButtons();
    notifyStateChange();
    updateBattleNews(`تم إنزال ${card.name} وخصم ${dropCost} من الذهب.`);
    return true;
}

function handleCardDrop(event) {
    event.preventDefault();
    const slot = event.currentTarget;
    slot.classList.remove('drag-over');
    const cardIndex = Number(event.dataTransfer.getData('text/plain'));
    deployCardToSlot(cardIndex, slot);
}

// -----------------------------------------------------------------------
// الإنزال باللمس: بديل عن السحب لأن السحب القياسي (HTML5 drag) لا يعمل
// على شاشات اللمس. اضغط كرتاً من يدك ليُميَّز، ثم اضغط خانة فارغة لإنزاله فيها.
// السحب بالماوس على سطح المكتب يبقى يعمل كما هو، بلا أي تعارض بين الطريقتين.
// -----------------------------------------------------------------------
let selectedHandCardIndex = null;

function clearHandSelection() {
    if (selectedHandCardIndex === null) return;
    selectedHandCardIndex = null;
    battleHand.querySelectorAll('.battle-card.selected-for-drop').forEach((el) => el.classList.remove('selected-for-drop'));
    [...playerDropSlots].forEach((slot) => slot.classList.remove('placeable-slot'));
}

function selectHandCard(cardElement) {
    const cardIndex = Number(cardElement.dataset.cardIndex);
    if (selectedHandCardIndex === cardIndex) { clearHandSelection(); return; }
    clearHandSelection();
    if (!isPlayerTurn || isGameOver || cardElement.getAttribute('aria-disabled') === 'true') return;
    selectedHandCardIndex = cardIndex;
    cardElement.classList.add('selected-for-drop');
    let hasFreeSlot = false;
    [...playerDropSlots].forEach((slot) => {
        if (!slot.classList.contains('occupied-slot')) { slot.classList.add('placeable-slot'); hasFreeSlot = true; }
    });
    if (hasFreeSlot) updateBattleNews('اضغط خانة فارغة لإنزال الكرت، أو اضغط الكرت مجدداً للإلغاء.');
}

// تقدّم الجولة: توزيع ذهب الجولة، إعادة تهيئة الهجوم، وفتح السوق عند الجولة 3
function advanceBattlePhase({ clearBlocks = true } = {}) {
    const previousPhase = battlePhase;
    const nextPhase = Math.min(previousPhase + 1, 5);
    const phaseIncome = nextPhase > previousPhase ? (phaseGoldIncome[nextPhase] || 0) : 0;

    battlePhase = nextPhase;
    if (clearBlocks) clearBlockedCards();

    if (phaseIncome > 0) {
        playerStats.lightTeam.gold += phaseIncome;
        playerStats.darkTeam.gold += phaseIncome;
        renderPlayerStats();
    }

    healthToGoldUsed.light = false;
    healthToGoldUsed.dark = false;
    resetAttackAvailability();
    updateAttackButtons();
    updateBankControls();

    const phaseText = `الجولة ${battlePhase}`;
    updateBattleNews(`الحكم: دخلت ${phaseText}${phaseIncome > 0 ? `، تم توزيع ${phaseIncome} ذهب لكل لاعب.` : '، ولا يوجد توزيع ذهب إضافي في هذه المرحلة.'}`);
    return battlePhase;
}

function forcePlayerWithdrawal() {
    isGameOver = true;
    isPlayerTurn = false;
    endTurnButton.hidden = true;
    const computerTeam = battleScreen.dataset.selectedTeam === 'dark' ? 'light' : 'dark';
    showVictoryModal(computerTeam);
    updateBattleNews('خسر فريقك لأنه لم يعد قادرًا على تنفيذ أي حدث.');
}

function forceWithdrawalIfNoPlayerEvent() {
    turnHasNoAvailableMoves = false;
    if (isGameOver || !isPlayerTurn) return;
    const playerTeam = battleScreen.dataset.selectedTeam;
    const stats = playerStats[playerTeam === 'dark' ? 'darkTeam' : 'lightTeam'];
    const availableSlot = [...playerDropSlots].some((slot) => !slot.classList.contains('occupied-slot'));
    const canDeploy = availableSlot && battleCards[playerTeam].some((card) => getDropCost(playerTeam, card) <= stats.gold && !deployedCardNames[playerTeam].has(card.name));
    const opponentCards = [...computerDropSlots].filter((slot) => slot.classList.contains('occupied-slot'));
    const canAttack = [...playerDropSlots].some((attackerSlot) => attackerSlot.classList.contains('occupied-slot')
        && attackerSlot.dataset.attackUsed !== 'true'
        && opponentCards.some((targetSlot) => Number(attackerSlot.dataset.attack) >= Number(targetSlot.dataset.attack)));
    const healerSlot = [...playerDropSlots].find((slot) => slot.dataset.cardName === 'معالجة النور');
    const injuredAlly = [...playerDropSlots].some((slot) => {
        if (!slot.classList.contains('occupied-slot') || slot === healerSlot) return false;
        const maxHealth = battleCards[playerTeam].find((card) => card.name === slot.dataset.cardName)?.health || Number(slot.dataset.health);
        return Number(slot.dataset.health) < maxHealth;
    });
    const canHeal = Boolean(healerSlot)
        && Number(healerSlot.dataset.health) >= 2
        && Number(healerSlot.dataset.healUses || 0) < 4
        && (stats.health < 20 || injuredAlly);
    const canBuyFromBank = battlePhase >= 3 && [...battleShop.querySelectorAll('.bank-card[data-bank-cost]')]
        .some((card) => Number(card.dataset.bankCost) <= stats.gold);
    const canPlayLottery = battlePhase >= 3 && stats.gold >= 2;
    const canBuyFromGraveyard = graveyardCards.some((card) => card.team === playerTeam && card.cost <= stats.gold);
    if (!canDeploy && !canAttack && !canHeal && !canBuyFromBank && !canPlayLottery && !canBuyFromGraveyard) {
        if (stats.health > 2 && !healthToGoldUsed[playerTeam]) {
            showEmergencySacrificeModal();
        } else {
            const hasAnyCardInArena = [...playerDropSlots].some((slot) => slot.classList.contains('occupied-slot'));
            if (!hasAnyCardInArena && stats.health <= 2) {
                forcePlayerWithdrawal();
            } else {
                turnHasNoAvailableMoves = true;
                updateBattleNews('لا توجد حركات متاحة لك حالياً. يمكنك إنهاء الدور وانتظار الجولة التالية.');
            }
        }
    }
}

function endPlayerTurn() {
    if (!isPlayerTurn || isGameOver) return;
    // قاعدة اللعبة: لا يُسمح بإنهاء الدور دون أي حدث (إلا إذا لم تتوفر أي حركة أصلاً)
    if (!turnActions.player && !turnHasNoAvailableMoves) {
        showTurnConfirmModal();
        return;
    }
    if (activeMode && activeMode.finishTurn) activeMode.finishTurn();
}

function renderLeaderInSlot(slot, team) {
    const leader = team === 'dark'
        ? { image: 'assets/images/characters/lord-shadow.png', name: 'سيد الظلال', health: playerStats.darkTeam.health }
        : { image: 'assets/images/characters/king-dawn.png', name: 'ملك الفجر', health: playerStats.lightTeam.health };

    slot.innerHTML = `
        <img class="leader-card-image" src="${leader.image}" alt="${leader.name}">
        <span class="leader-card-name">${leader.name}</span>
        <span class="leader-card-health">❤ ${leader.health}</span>
    `;
}

function renderLeaders(playerTeam) {
    const computerTeam = playerTeam === 'dark' ? 'light' : 'dark';
    renderLeaderInSlot(leaderSlot, playerTeam);
    renderLeaderInSlot(computerLeaderSlot, computerTeam);
}

function showBattleScreen(team, startsWithPlayer = true) {
    selectionScreen.hidden = true;
    selectionScreen.classList.add('screen-hidden');
    battleScreen.hidden = false;
    battleScreen.classList.remove('screen-hidden');
    battleScreen.dataset.selectedTeam = team;
    resetBattleResources(startsWithPlayer);
    document.querySelector('.turn-indicator').textContent = startsWithPlayer ? 'دورك' : 'انتظار دور الخصم';
    lightPlayerBanner.classList.toggle('active-player', team === 'light' && startsWithPlayer);
    darkPlayerBanner.classList.toggle('active-player', team === 'dark' && startsWithPlayer);
    renderBattleHand(team);
    renderLeaders(team);
    endTurnButton.textContent = 'إنهاء الدور';
    setTurnLockState();
    const joinMessage = team === 'dark'
        ? 'انضممت إلى فريق الظلام. اختر كرتًا من يدك وابدأ الهجوم.'
        : 'انضممت إلى فريق النور. اختر كرتًا من يدك وابدأ الهجوم.';
    battleNewsText.innerHTML = `<div class="news-content">${joinMessage}</div>`;
}

// الخروج من المعركة إلى الشاشة الرئيسية للوضع الحالي (القائمة أو اختيار الفريق)
function showSelectionScreen() {
    if (activeMode && activeMode.leaveMatch) activeMode.leaveMatch();
    battleScreen.hidden = true;
    battleScreen.classList.add('screen-hidden');
    if (window.App && App.showModeHome) App.showModeHome();
}

function showGuide() {
    guideModal.classList.remove('screen-hidden');
    guideModal.setAttribute('aria-hidden', 'false');
    closeGuide.focus();
}

function hideGuide() {
    guideModal.classList.add('screen-hidden');
    guideModal.setAttribute('aria-hidden', 'true');
    openGuide.focus();
}

function hideAttackModal() {
    attackModal.classList.add('screen-hidden');
    attackModal.setAttribute('aria-hidden', 'true');
}

function showSilenceModal(silentNeighborSlot) {
    const opponentCards = [...battleArena.querySelectorAll('.computer-slot.occupied-slot')];

    if (opponentCards.length === 0) {
        updateBattleNews('لا توجد كروت للخصم في الساحة.');
        return;
    }

    silenceTargets.innerHTML = opponentCards.map((slot) => {
        const cardImage = slot.querySelector('.deployed-card-image');
        const cardName = slot.querySelector('.deployed-card-name')?.textContent || 'كرت الخصم';
        const isAlreadyBlocked = isSlotBlocked(slot);

        return `
            <button type="button" class="attack-target" data-target-name="${cardName}" data-target-slot-index="${slot.dataset.slotIndex}" ${isAlreadyBlocked ? 'disabled' : ''}>
                <img src="${cardImage?.src || ''}" alt="${cardName}">
                <span>${cardName}</span>
                <small>القوة: ${slot.dataset.attack}${isAlreadyBlocked ? ' - ممنوع بالفعل' : ''}</small>
            </button>
        `;
    }).join('');

    silenceModal.querySelector('#silence-title').textContent = 'اختر كرتًا لمنعه من الهجوم';
    const hasValidTarget = silenceTargets.querySelector('.attack-target:not(:disabled)');
    silenceEmptyMessage.textContent = 'لا توجد كروت يمكن منعها.';
    silenceEmptyMessage.hidden = Boolean(hasValidTarget);
    silenceModal.classList.remove('screen-hidden');
    silenceModal.setAttribute('aria-hidden', 'false');
    silenceModal.dataset.silentNeighborSlotIndex = silentNeighborSlot.dataset.slotIndex;

    if (hasValidTarget) hasValidTarget.focus();
}

function hideSilenceModal() {
    silenceModal.classList.add('screen-hidden');
    silenceModal.setAttribute('aria-hidden', 'true');
}

function showCardInfoModal(cardData) {
    console.log('Card data:', cardData);
    
    document.getElementById('card-info-image').src = cardData.image;
    document.getElementById('card-info-title').textContent = cardData.name;
    document.getElementById('card-info-health').textContent = cardData.health;
    document.getElementById('card-info-attack').textContent = cardData.attack;
    document.getElementById('card-info-cost').textContent = cardData.cost;
    document.getElementById('card-info-description').textContent = cardData.description;
    
    cardInfoModal.classList.remove('screen-hidden');
    cardInfoModal.setAttribute('aria-hidden', 'false');
    closeCardInfoModal.focus();
}

function hideCardInfoModal() {
    cardInfoModal.classList.add('screen-hidden');
    cardInfoModal.setAttribute('aria-hidden', 'true');
}

function executeSilence(targetSlotIndex) {
    if (!isPlayerTurn || isGameOver) {
        hideSilenceModal();
        return;
    }
    const silentNeighborSlotIndex = silenceModal.dataset.silentNeighborSlotIndex;
    const silentNeighborSlot = [...playerDropSlots].find((slot) => slot.dataset.slotIndex === silentNeighborSlotIndex);
    const targetSlot = [...computerDropSlots].find((slot) => slot.dataset.slotIndex === targetSlotIndex);

    if (!silentNeighborSlot || !targetSlot || !silentNeighborSlot.classList.contains('occupied-slot') || !targetSlot.classList.contains('occupied-slot')) {
        hideSilenceModal();
        return;
    }

    const blockedKey = getBlockKey(targetSlot);
    if (tempEffects.blockedCards.has(blockedKey)) {
        updateBattleNews('هذا الكرت ممنوع بالفعل.');
        hideSilenceModal();
        return;
    }

    tempEffects.blockedCards.add(blockedKey);
    tempEffects.silencedBy.set(blockedKey, silentNeighborSlot.dataset.cardName);
    targetSlot.classList.add('blocked-card');

    turnActions.player = true;
    updateBattleNews(`الجار الصامت منع ${targetSlot.dataset.cardName} من الهجوم في دوره القادم.`);
    hideSilenceModal();
    notifyStateChange();
}

function moveCardToGraveyard(slot) {
    const cardImage = slot.querySelector('.deployed-card-image');
    const cardName = slot.dataset.cardName || 'كرت';
    const graveyardElement = createGraveyardElement(cardName, cardImage?.getAttribute('src') || '');
    battleGraveyardSlots.appendChild(graveyardElement);
    const team = getSlotTeam(slot);
    const card = resolveCardDefinition(cardName, team);
    if (card) graveyardCards.push({ ...card, team, element: graveyardElement });
    renderGraveyardBankCards();
    updateGraveyardBadge();
}

function renderGraveyardBankCards() {
    const playerTeam = battleScreen.dataset.selectedTeam;
    const availableCards = graveyardCards.filter((card) => card.team === playerTeam);
    graveyardBankCards.innerHTML = availableCards.length
        ? availableCards.map((card, index) => `
            <button type="button" class="bank-card graveyard-bank-card" data-graveyard-index="${graveyardCards.indexOf(card)}">
                <img src="${card.image}" alt="${card.name}">
                <span>${card.name}</span>
                <small>شراء: ◉ ${card.cost}</small>
            </button>
        `).join('')
        : '<p class="empty-graveyard-shop">لا توجد كروت من فريقك في المقبرة.</p>';
}

function addCardToHand(card) {
    const cardIndex = battleCards[battleScreen.dataset.selectedTeam].findIndex((item) => item === card || item.name === card.name);
    const cardElement = document.createElement('article');
    cardElement.className = 'battle-card';
    cardElement.draggable = true;
    cardElement.tabIndex = 0;
    cardElement.dataset.cardIndex = cardIndex;
    cardElement.setAttribute('aria-label', `${card.name}: التكلفة ${card.cost}، الحياة ${card.health}، القوة الهجومية ${card.attack}. ${card.description}`);
    cardElement.innerHTML = `
        <img src="${card.image}" alt="${card.name}">
        <span class="card-cost">${card.cost}</span>
        <h2>${card.name}</h2>
        <div class="card-values"><span>❤ <strong>${card.health}</strong></span><span>⚔ <strong>${card.attack}</strong></span></div>
        <button class="card-info-button" type="button" data-card-name="${card.name}" data-card-cost="${card.cost}" data-card-health="${card.health}" data-card-attack="${card.attack}" data-card-description="${card.description}" data-card-image="${card.image}">?</button>
        <div class="card-tooltip" role="tooltip"><strong>${card.name}</strong><span>التكلفة: ${card.cost}</span><span>الحياة: ${card.health}</span><span>القوة الهجومية: ${card.attack}</span><p>${card.description}</p></div>
    `;
    battleHand.appendChild(cardElement);
}

function showVictoryModal(winningTeam, victoryType = 'military') {
    if (matchResult) return; // النتيجة أُعلنت من قبل
    matchResult = { winner: winningTeam, type: victoryType };
    const winnerName = winningTeam === 'light' ? 'فريق النور' : 'فريق الظلام';
    const playerTeam = battleScreen.dataset.selectedTeam;
    const leader = winningTeam === 'light'
        ? { image: 'assets/images/characters/king-dawn.png', name: 'ملك الفجر' }
        : { image: 'assets/images/characters/lord-shadow.png', name: 'سيد الظلال' };
    victoryLeaderImage.src = leader.image;
    victoryLeaderImage.alt = leader.name;
    const playerWon = winningTeam === playerTeam;
    victoryResultIcon.textContent = playerWon ? (victoryType === 'economic' ? '💰' : '🏆') : '😔';
    victoryTitle.textContent = playerWon
        ? (victoryType === 'economic' ? 'نصر اقتصادي!' : 'مبروك الانتصار!')
        : (victoryType === 'economic' ? 'هزيمة اقتصادية' : 'حظ أوفر');
    victoryMessage.textContent = playerWon
        ? (victoryType === 'economic' ? `أحسنت! جمعت ${ECONOMIC_VICTORY_GOLD} قطعة ذهب وفاز ${winnerName} بالنصر الاقتصادي!` : `${winnerName} فاز بالمباراة!`)
        : (victoryType === 'economic' ? `خسرت المباراة! جمع ${winnerName} عدد ${ECONOMIC_VICTORY_GOLD} قطعة ذهب وحقق النصر الاقتصادي.` : `لقد خسرت اللعبة وفاز ${winnerName}`);
    
    // تأخير ظهور رسالة النتيجة
    window.clearTimeout(victoryTimer);
    victoryTimer = window.setTimeout(() => {
        victoryModal.classList.remove('screen-hidden');
        victoryModal.setAttribute('aria-hidden', 'false');
        
        // بعد 3 ثوانٍ من ظهور الرسالة، العودة لشاشة الاختيار
        window.clearTimeout(victoryReturnTimer);
        victoryReturnTimer = window.setTimeout(() => {
            victoryModal.classList.add('screen-hidden');
            victoryModal.setAttribute('aria-hidden', 'true');
            showSelectionScreen();
        }, 3000);
    }, 2000);
    notifyStateChange(); // إبلاغ الخصم بالنتيجة
}

function damageLeader(team, attackingTeam, announceResult = true) {
    // التحقق من وجود درع النور في ساحة الفريق المستهدف
    const targetSlots = team === battleScreen.dataset.selectedTeam ? playerDropSlots : computerDropSlots;
    const hasLightShield = [...targetSlots].some((slot) => 
        slot.classList.contains('occupied-slot') && slot.dataset.cardName === 'درع النور'
    );
    
    if (hasLightShield) {
        updateBattleNews('درع النور يحمي قائد الفريق من الضرر!');
        return false;
    }
    
    const statsKey = team === 'dark' ? 'darkTeam' : 'lightTeam';
    playerStats[statsKey].health = Math.max(0, playerStats[statsKey].health - 5);
    renderPlayerStats();
    renderLeaderInSlot(team === battleScreen.dataset.selectedTeam ? leaderSlot : computerLeaderSlot, team);
    if (playerStats[statsKey].health === 0 && announceResult) {
        isGameOver = true;
        isPlayerTurn = false;
        endTurnButton.hidden = true;
        hideAttackModal();
        updateAttackButtons();
        const winner = team === battleScreen.dataset.selectedTeam ? 'الخصم' : 'فريقك';
        showVictoryModal(team === 'dark' ? 'light' : 'dark');
        updateBattleNews(`خسر قائد فريق ${team === 'dark' ? 'الظلام' : 'النور'} جميع نقاط حياته. ${winner} فاز بالمباراة!`);
        document.querySelector('.turn-indicator').textContent = 'انتهت المباراة';
        return true;
    }
    return false;
}

function removeDefeatedCard(slot, team, attackingTeam, announceResult = true) {
    const cardName = slot.dataset.cardName;
    
    // إذا كان الكرت الميت هو درع النور، إزالة الحماية عن القائد
    if (cardName === 'درع النور') {
        updateBattleNews('مات درع النور، انتهت الحماية عن القائد.');
    }
    
    moveCardToGraveyard(slot);
    const leaderDefeated = damageLeader(team, attackingTeam, announceResult);
    if (team === battleScreen.dataset.selectedTeam) {
        deployedCardNames[team].add(slot.dataset.cardName);
    }
    tempEffects.blockedCards.delete(getBlockKey(slot));
    tempEffects.silencedBy.delete(getBlockKey(slot));
    clearSlotState(slot);
    return leaderDefeated;
}

function executeAttack(targetSlotIndex) {
    const attackerSlot = [...playerDropSlots].find((slot) => slot.dataset.slotIndex === attackModal.dataset.attackerSlotIndex);
    const targetSlot = [...computerDropSlots].find((slot) => slot.dataset.slotIndex === targetSlotIndex);
    if (!isPlayerTurn || isGameOver || battlePhase === 1
        || !attackerSlot || !targetSlot
        || !attackerSlot.classList.contains('occupied-slot') || !targetSlot.classList.contains('occupied-slot')
        || attackerSlot.dataset.attackUsed === 'true') {
        hideAttackModal();
        return;
    }

    const blockReason = getAttackBlockReason(attackerSlot, targetSlot);
    if (blockReason) {
        updateBattleNews(`لا يمكن تنفيذ هذا الهجوم: ${blockReason}.`);
        hideAttackModal();
        return;
    }

    const attackSucceeded = resolveCombatAttack(attackerSlot, targetSlot, battleScreen.dataset.selectedTeam, attackModal.dataset.attackerName);
    if (attackSucceeded) {
        turnActions.player = true;
        if (attackerSlot.classList.contains('occupied-slot')) attackerSlot.dataset.attackUsed = 'true';
    }
    updateAttackButtons();
    hideAttackModal();
    notifyStateChange();
}

function resolveCombatAttack(attackerSlot, targetSlot, attackerTeam, attackerName) {
    const attackerCardName = attackerSlot.dataset.cardName || attackerName;
    const targetCardName = targetSlot.dataset.cardName || 'الكرت المستهدف';
    const attackerAttack = Number(attackerSlot.dataset.attack);
    const targetAttack = Number(targetSlot.dataset.attack);
    if (attackerAttack < targetAttack) {
        updateBattleNews('لا يمكن الهجوم: قوة الكرت المهاجم أقل من قوة الكرت المستهدف.');
        return false;
    }

    if (attackerTeam === battleScreen.dataset.selectedTeam) turnActions.player = true;
    else turnActions.computer = true;

    const attackerHealth = Number(attackerSlot.dataset.health) - targetAttack;
    const targetHealth = Number(targetSlot.dataset.health) - attackerAttack;
    attackerSlot.dataset.health = attackerHealth;
    targetSlot.dataset.health = targetHealth;
    attackerSlot.querySelector('.deployed-card-health strong').textContent = Math.max(attackerHealth, 0);
    targetSlot.querySelector('.deployed-card-health strong').textContent = Math.max(targetHealth, 0);

    const defeatedNames = [];
    let leaderDefeated = false;
    let attackRewardMessage = '';
    const targetTeam = attackerTeam === battleScreen.dataset.selectedTeam
        ? (battleScreen.dataset.selectedTeam === 'dark' ? 'light' : 'dark')
        : battleScreen.dataset.selectedTeam;
    if (targetHealth <= 0) {
        defeatedNames.push(targetSlot.dataset.cardName);
        const attackingStatsKey = attackerTeam === 'dark' ? 'darkTeam' : 'lightTeam';
        playerStats[attackingStatsKey].gold += 2;
        renderPlayerStats();
        const attackingTeamName = attackerTeam === 'dark' ? 'فريق الظلام' : 'فريق النور';
        attackRewardMessage = ` حصل ${attackingTeamName} على +2 ذهب لأنه بدأ الهجوم وأسقط ${targetCardName}.`;
        leaderDefeated = removeDefeatedCard(targetSlot, targetTeam, attackerTeam, false) || leaderDefeated;
        if (targetTeam === battleScreen.dataset.selectedTeam) {
            deployedCardCount = Math.max(0, deployedCardCount - 1);
        }
    }
    if (attackerHealth <= 0) {
        defeatedNames.push(attackerSlot.dataset.cardName);
        leaderDefeated = removeDefeatedCard(attackerSlot, attackerTeam, targetTeam, false) || leaderDefeated;
        if (attackerTeam === battleScreen.dataset.selectedTeam) {
            deployedCardCount = Math.max(0, deployedCardCount - 1);
        }
    }
    endTurnButton.hidden = false;
    const attackerStats = playerStats[attackerTeam === 'dark' ? 'darkTeam' : 'lightTeam'];
    const targetStats = playerStats[targetTeam === 'dark' ? 'darkTeam' : 'lightTeam'];
    if (attackerStats.health === 0 || targetStats.health === 0) {
        isGameOver = true;
        isPlayerTurn = false;
        endTurnButton.hidden = true;
        hideAttackModal();
        const winningTeam = attackerStats.health === 0 && targetStats.health === 0
            ? attackerTeam
            : (attackerStats.health > 0 ? attackerTeam : targetTeam);
        showVictoryModal(winningTeam);
        document.querySelector('.turn-indicator').textContent = 'انتهت المباراة';
    }
    updateGoldToHealthButton();
    if (!leaderDefeated) {
        const attackerResult = attackerHealth <= 0 ? 'مات' : `بقيت له ${Math.max(attackerHealth, 0)} حياة`;
        const targetResult = targetHealth <= 0 ? 'مات' : `بقيت له ${Math.max(targetHealth, 0)} حياة`;
        
        // عرض الأحداث الكاملة مع تفاصيل الهجوم المزدوج
        let fullEventMessage = `هجوم ${attackerCardName} على ${targetCardName}: خسر ${attackerCardName} عدد ${targetAttack} حياة، وخسر ${targetCardName} عدد ${attackerAttack} حياة. النتيجة: ${attackerCardName} ${attackerResult}، و${targetCardName} ${targetResult}.`;
        
        if (attackRewardMessage) {
            fullEventMessage += ` ${attackRewardMessage}`;
        }
        
        updateBattleNews(fullEventMessage);
    } else if (attackRewardMessage) {
        updateBattleNews(attackRewardMessage);
    }
    return true;
}

function executeHeal(targetSlotIndex, targetType = 'card') {
    if (!isPlayerTurn || isGameOver) {
        hideAttackModal();
        return;
    }
    const healerSlot = [...playerDropSlots].find((slot) => slot.dataset.slotIndex === attackModal.dataset.attackerSlotIndex);
    const targetSlot = targetType === 'leader'
        ? leaderSlot
        : [...playerDropSlots].find((slot) => slot.dataset.slotIndex === targetSlotIndex);
    if (!healerSlot || !targetSlot || healerSlot === targetSlot || !healerSlot.classList.contains('occupied-slot') || (targetType === 'card' && !targetSlot.classList.contains('occupied-slot'))) {
        hideAttackModal();
        return;
    }

    const healerHealth = Number(healerSlot.dataset.health);
    const healUses = Number(healerSlot.dataset.healUses || 0);
    if (healUses >= 4) {
        updateBattleNews('استنفدت معالجة النور عدد العلاجات المسموح به في هذه الجولة.');
        hideAttackModal();
        updateAttackButtons();
        return;
    }
    if (healerHealth <= 2) {
        updateBattleNews('عندما تصل حياة معالجة النور إلى 2 لا تعالج أحدًا.');
        hideAttackModal();
        return;
    }

    const playerStatsKey = battleScreen.dataset.selectedTeam === 'dark' ? 'darkTeam' : 'lightTeam';
    const allyMaxHealth = resolveCardDefinition(targetSlot.dataset.cardName, battleScreen.dataset.selectedTeam)?.health ?? Infinity;
    const targetHealth = targetType === 'leader'
        ? Math.min(20, playerStats[playerStatsKey].health + 2)
        : Math.min(allyMaxHealth, Number(targetSlot.dataset.health) + 2);
    const restoredHealth = targetHealth - (targetType === 'leader' ? playerStats[playerStatsKey].health : Number(targetSlot.dataset.health));
    healerSlot.dataset.health = healerHealth - 2;
    healerSlot.dataset.healUses = String(healUses + 1);
    turnActions.player = true;
    healerSlot.querySelector('.deployed-card-health strong').textContent = healerHealth - 2;
    if (targetType === 'leader') {
        playerStats[playerStatsKey].health = targetHealth;
        renderLeaderInSlot(leaderSlot, battleScreen.dataset.selectedTeam);
        renderPlayerStats();
    } else {
        targetSlot.dataset.health = targetHealth;
        targetSlot.querySelector('.deployed-card-health strong').textContent = targetHealth;
    }
    updateGoldToHealthButton();
    notifyStateChange();
    updateBattleNews(`عالجت معالجة النور ${targetType === 'leader' ? 'ملك الفجر' : targetSlot.dataset.cardName} وأضافت ${restoredHealth} حياة، وخسرت نقطتين من حياتها.`);
    hideAttackModal();
}

function showAttackModal(attackerSlot) {
    const opponentCards = [...battleArena.querySelectorAll('.computer-slot.occupied-slot')];

    attackTargets.innerHTML = opponentCards.map((slot) => {
        const cardImage = slot.querySelector('.deployed-card-image');
        const cardName = slot.querySelector('.deployed-card-name')?.textContent || 'كرت الخصم';
        const blockReason = getAttackBlockReason(attackerSlot, slot);

        return `
            <button type="button" class="attack-target" data-target-name="${cardName}" data-target-slot-index="${slot.dataset.slotIndex}" ${blockReason ? 'disabled' : ''}>
                <img src="${cardImage?.src || ''}" alt="${cardName}">
                <span>${cardName}</span>
                <small>القوة: ${slot.dataset.attack}${blockReason ? ` - ${blockReason}` : ''}</small>
            </button>
        `;
    }).join('');
    attackModal.querySelector('#attack-title').textContent = 'اختر من تريد الهجوم عليه';
    const hasValidTarget = attackTargets.querySelector('.attack-target:not(:disabled)');
    attackEmptyMessage.textContent = opponentCards.length === 0
        ? 'لا توجد كروت للخصم في الساحة.'
        : 'لا توجد كروت يمكن مهاجمتها الآن.';
    attackEmptyMessage.hidden = Boolean(hasValidTarget);
    attackModal.classList.remove('screen-hidden');
    attackModal.setAttribute('aria-hidden', 'false');
    attackModal.dataset.attackerName = attackerSlot.dataset.cardName;
    attackModal.dataset.attackerSlotIndex = attackerSlot.dataset.slotIndex;
    attackModal.dataset.action = 'attack';
    const firstValidTarget = attackTargets.querySelector('.attack-target:not(:disabled)');
    if (firstValidTarget) firstValidTarget.focus();
}

function showHealModal(healerSlot) {
    const allyCards = [...playerDropSlots].filter((slot) => slot.classList.contains('occupied-slot') && slot !== healerSlot);
    const playerStatsKey = battleScreen.dataset.selectedTeam === 'dark' ? 'darkTeam' : 'lightTeam';
    const leaderName = battleScreen.dataset.selectedTeam === 'dark' ? 'سيد الظلال' : 'ملك الفجر';
    const leaderTarget = playerStats[playerStatsKey].health < 20 ? `
        <button type="button" class="attack-target heal-target" data-target-type="leader">
            <img src="${battleScreen.dataset.selectedTeam === 'dark' ? 'assets/images/characters/lord-shadow.png' : 'assets/images/characters/king-dawn.png'}" alt="${leaderName}">
            <span>${leaderName}</span>
            <small>❤ ${playerStats[playerStatsKey].health} ← +2</small>
        </button>
    ` : '';
    attackTargets.innerHTML = leaderTarget + allyCards.map((slot) => {
        const cardImage = slot.querySelector('.deployed-card-image');
        const cardName = slot.dataset.cardName || 'حليف';
        return `
            <button type="button" class="attack-target heal-target" data-target-slot-index="${slot.dataset.slotIndex}">
                <img src="${cardImage?.src || ''}" alt="${cardName}">
                <span>${cardName}</span>
                <small>❤ ${slot.dataset.health} ← +2</small>
            </button>
        `;
    }).join('');
    attackModal.querySelector('#attack-title').textContent = 'اختر حليفًا لمعالجته';
    const hasHealingTarget = Boolean(leaderTarget) || allyCards.length > 0;
    attackEmptyMessage.textContent = hasHealingTarget ? 'لا توجد أهداف متاحة.' : 'لا يوجد قائد أو حلفاء آخرون يمكن علاجهم.';
    attackEmptyMessage.hidden = hasHealingTarget;
    attackModal.classList.remove('screen-hidden');
    attackModal.setAttribute('aria-hidden', 'false');
    attackModal.dataset.attackerName = healerSlot.dataset.cardName;
    attackModal.dataset.attackerSlotIndex = healerSlot.dataset.slotIndex;
    attackModal.dataset.action = 'heal';
    if (hasHealingTarget) attackTargets.querySelector('.attack-target').focus();
}

function setBankOpen(isOpen) {
    if (isOpen) { renderGraveyardBankCards(); setGraveyardOpen(false); }
    battleShop.classList.toggle('shop-open', isOpen);
    battleShop.setAttribute('aria-hidden', String(!isOpen));
    bankToggle.setAttribute('aria-expanded', String(isOpen));
}

// لوحة المقبرة: مطوية افتراضياً على الجوال (تُفتح بالضغط على الأيقونة العائمة)، ودائماً ظاهرة على الشاشات الكبيرة
function setGraveyardOpen(isOpen) {
    if (isOpen) setBankOpen(false);
    battleGraveyard.classList.toggle('graveyard-open', isOpen);
    graveyardToggle.setAttribute('aria-expanded', String(isOpen));
}

function updateGraveyardBadge() {
    graveyardToggleCount.textContent = String(graveyardCards.length);
}

endTurnButton.addEventListener('click', endPlayerTurn);
withdrawTurnButton.addEventListener('click', () => {
    hideTurnConfirmModal();
    isGameOver = true;
    isPlayerTurn = false;
    endTurnButton.hidden = true;
    const computerTeam = battleScreen.dataset.selectedTeam === 'dark' ? 'light' : 'dark';
    showVictoryModal(computerTeam);
    updateBattleNews('خسر فريقك لأنه أنهى دوره دون هجوم أو إنزال أو معالجة أو لعبة حظ.');
});
continueTurnButton.addEventListener('click', hideTurnConfirmModal);
battleArena.addEventListener('click', (event) => {
    const attackButton = event.target.closest('.card-attack-button');
    const silenceButton = event.target.closest('.card-silence-button');
    const infoButton = event.target.closest('.card-info-button');
    
    if (infoButton) {
        const cardData = {
            name: infoButton.dataset.cardName,
            cost: infoButton.dataset.cardCost,
            health: infoButton.dataset.cardHealth,
            attack: infoButton.dataset.cardAttack,
            description: infoButton.dataset.cardDescription,
            image: infoButton.dataset.cardImage
        };
        showCardInfoModal(cardData);
        return;
    }
    
    if (silenceButton && !silenceButton.disabled) {
        const cardSlot = silenceButton.closest('.drop-slot');
        showSilenceModal(cardSlot);
        return;
    }
    
    if (!attackButton || attackButton.disabled) return;
    const cardSlot = attackButton.closest('.drop-slot');
    if (attackButton.dataset.action === 'heal') {
        showHealModal(cardSlot);
    } else {
        showAttackModal(cardSlot);
    }
});
attackTargets.addEventListener('click', (event) => {
    const targetButton = event.target.closest('.attack-target');
    if (!targetButton || targetButton.disabled) return;
    if (attackModal.dataset.action === 'heal') {
        executeHeal(targetButton.dataset.targetSlotIndex, targetButton.dataset.targetType || 'card');
    } else {
        executeAttack(targetButton.dataset.targetSlotIndex);
    }
});

silenceTargets.addEventListener('click', (event) => {
    const targetButton = event.target.closest('.attack-target');
    if (!targetButton || targetButton.disabled) return;
    executeSilence(targetButton.dataset.targetSlotIndex);
});
closeInsufficientGold.addEventListener('click', hideInsufficientGoldMessage);
closeCardInfoModal.addEventListener('click', hideCardInfoModal);
graveyardBankCards.addEventListener('click', (event) => {
    const purchaseButton = event.target.closest('.graveyard-bank-card');
    if (!purchaseButton) return;
    const cardIndex = Number(purchaseButton.dataset.graveyardIndex);
    const card = graveyardCards[cardIndex];
    const playerTeam = battleScreen.dataset.selectedTeam;
    const stats = playerStats[playerTeam === 'dark' ? 'darkTeam' : 'lightTeam'];
    if (!card || !isPlayerTurn || isGameOver || battlePhase < 3) return;
    if (!ensureGoldThroughLeaderSacrifice(playerTeam, card.cost, card.name)) {
        updateBattleNews(`ليس لديك مال كافٍ لشراء ${card.name}. تحتاج إلى ${card.cost} ذهب.`);
        return;
    }
    
    const purchaseCost = card.cost;
    stats.gold -= purchaseCost;

    // بعد الشراء من المقبرة يكلّف إنزال الكرت 1 ذهب فقط
    dropDiscount[playerTeam].add(card.name);
    card.cost = DISCOUNTED_DROP_COST;   // ليظهر على كرت اليد
    
    // إضافة الكرت إلى اليد
    addCardToHand(card);
    deployedCardNames[playerTeam].delete(card.name);
    card.element?.remove();
    graveyardCards.splice(cardIndex, 1);
    renderGraveyardBankCards();
    updateGraveyardBadge();
    renderPlayerStats();
    turnActions.player = true;
    updateBattleNews(`تم شراء ${card.name} من المقبرة مقابل ${purchaseCost} ذهب، وإنزاله سيكلّف 1 ذهب فقط.`);
    notifyStateChange();
});
battleHand.addEventListener('click', (event) => {
    const infoButton = event.target.closest('.card-info-button');
    if (infoButton) {
        const cardData = {
            name: infoButton.dataset.cardName,
            cost: infoButton.dataset.cardCost,
            health: infoButton.dataset.cardHealth,
            attack: infoButton.dataset.cardAttack,
            description: infoButton.dataset.cardDescription,
            image: infoButton.dataset.cardImage
        };
        showCardInfoModal(cardData);
        return;
    }
    const cardElement = event.target.closest('.battle-card');
    if (cardElement) selectHandCard(cardElement);
});

battleHand.addEventListener('dragstart', (event) => {
    if (event.target.closest('.battle-card')) handleCardDragStart(event);
});
battleHand.addEventListener('dragend', (event) => {
    if (event.target.closest('.battle-card')) handleCardDragEnd(event);
});
playerDropSlots.forEach((slot) => {
    slot.addEventListener('dragover', handleSlotDragOver);
    slot.addEventListener('dragleave', handleSlotDragLeave);
    slot.addEventListener('drop', handleCardDrop);
    slot.addEventListener('click', () => {
        if (selectedHandCardIndex === null || slot.classList.contains('occupied-slot')) return;
        const cardIndex = selectedHandCardIndex;
        clearHandSelection();
        deployCardToSlot(cardIndex, slot);
    });
});
battleBackButton.addEventListener('click', showSelectionScreen);
openGuide.addEventListener('click', showGuide);
closeGuide.addEventListener('click', hideGuide);
closeAttackModal.addEventListener('click', hideAttackModal);
closeSilenceModal.addEventListener('click', hideSilenceModal);
bankToggle.addEventListener('click', () => {
    if (battlePhase < 3) {
        updateBattleNews('سوق البنك متاح ابتداءً من المرحلة الثالثة.');
        return;
    }
    setBankOpen(!battleShop.classList.contains('shop-open'));
});
shopCloseButton.addEventListener('click', () => setBankOpen(false));
graveyardToggle.addEventListener('click', () => setGraveyardOpen(!battleGraveyard.classList.contains('graveyard-open')));
goldToHealthButton.addEventListener('click', exchangeGoldForHealth);
healthToGoldButton.addEventListener('click', () => {
    if (!isPlayerTurn || isGameOver) return;
    exchangeHealthForGold(battleScreen.dataset.selectedTeam);
});
acceptSacrificeButton.addEventListener('click', () => {
    hideEmergencySacrificeModal();
    exchangeHealthForGold(battleScreen.dataset.selectedTeam, true);
});
declineSacrificeButton.addEventListener('click', () => {
    hideEmergencySacrificeModal();
    turnActions.player = true;
    endPlayerTurn();
});
lotteryToggle.addEventListener('click', () => purchaseBankCard(lotteryToggle));
battleShop.addEventListener('mouseleave', () => setBankOpen(false));
battleShop.addEventListener('click', (event) => {
    const bankCard = event.target.closest('.bank-card[data-bank-cost]');
    if (!bankCard || bankCard.classList.contains('graveyard-bank-card')) return;
    purchaseBankCard(bankCard);
});
guideModal.addEventListener('click', (event) => {
    if (event.target === guideModal) hideGuide();
});
attackModal.addEventListener('click', (event) => {
    if (event.target === attackModal) hideAttackModal();
});
cardInfoModal.addEventListener('click', (event) => {
    if (event.target === cardInfoModal) hideCardInfoModal();
});
emergencySacrificeModal.addEventListener('click', (event) => {
    if (event.target === emergencySacrificeModal) hideEmergencySacrificeModal();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !guideModal.classList.contains('screen-hidden')) hideGuide();
    if (event.key === 'Escape' && !attackModal.classList.contains('screen-hidden')) hideAttackModal();
    if (event.key === 'Escape' && !silenceModal.classList.contains('screen-hidden')) hideSilenceModal();
    if (event.key === 'Escape' && !cardInfoModal.classList.contains('screen-hidden')) hideCardInfoModal();
    if (event.key === 'Escape' && !emergencySacrificeModal.classList.contains('screen-hidden')) hideEmergencySacrificeModal();
});
renderPlayerStats();