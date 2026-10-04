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
const shopTitle = document.querySelector('#shop-title');
const bankInventory = document.querySelector('#bank-inventory');
const graveyardInventory = document.querySelector('#graveyard-inventory');
const bankShopChoice = document.querySelector('#shop-bank-choice');
const graveyardShopChoice = document.querySelector('#shop-graveyard-choice');
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
const handToggle = document.querySelector('#hand-toggle');
const handModal = document.querySelector('#hand-modal');
const closeHandModal = document.querySelector('#close-hand-modal');
const handModalContent = document.querySelector('#hand-modal-content');
const ECONOMIC_VICTORY_GOLD = 25;
function battleText(key, fallback) {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    return getNestedValue(translations[lang], `battle.${key}`) || fallback;
}

function cardText(key, fallback) {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    return getNestedValue(translations[lang], `card.${key}`) || fallback;
}

let isPlayerTurn = true;
let deployedCardCount = 0;
let cardsDeployedThisTurn = 0;
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
    return (card.isBankCard || dropDiscount[team].has(card.id)) ? DISCOUNTED_DROP_COST : card.cost;
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
    if (targetSlot.dataset.cardName === 'light-healer') {
        const targetSlots = targetSlot.classList.contains('computer-slot') ? computerDropSlots : playerDropSlots;
        const hasFalcon = [...targetSlots].some((slot) => slot.classList.contains('occupied-slot') && slot.dataset.cardName === 'الصقر الجارح');
        if (hasFalcon) return 'مخفية من الصقر الجارح';
    }
    return '';
}

function localizeBattleNews(message) {
    if ((document.documentElement.getAttribute('lang') || 'en') === 'ar') return message;
    let text = String(message);
    const replacements = [
        ['الكمبيوتر يفكر...', 'Computer is thinking...'],
        ['الكمبيوتر أنزل', 'Computer deployed'],
        ['في الساحة (تكلفة ', ' on the battlefield (cost '],
        ['الكمبيوتر عجز عن أي حركة وانسحب من المباراة.', 'The computer could not make a move and withdrew from the match.'],
        ['الكمبيوتر لعب لعبة الحظ وكسب 10 ذهبات!', 'The computer played the lottery and won 10 gold!'],
        ['الكمبيوتر لعب لعبة الحظ وخسر 5 ذهبات.', 'The computer played the lottery and lost 5 gold.'],
        ['الكمبيوتر لعب لعبة الحظ ولم يكسب شيئاً.', 'The computer played the lottery and won nothing.'],
        ['الكمبيوتر اشترى', 'Computer bought'],
        ['الكمبيوتر استبدل 3 ذهب بـ 6 حياة لقائده.', 'The computer exchanged 3 gold for 6 leader health.'],
        ['الكمبيوتر استبدل 3 ذهب بـ 6 حياة لمعالجة النور.', 'The computer exchanged 3 gold for 6 healer health.'],
        ['تعذر إرسال التحدي.', 'Unable to send the challenge.'],
        ['انقطع اتصال الخصم مؤقتًا. ستبقى المباراة محفوظة لوقت قصير.', 'The opponent disconnected temporarily. The match will be saved for a short time.'],
        ['انتهت المباراة لأن الاتصال لم يعد خلال المهلة المحددة.', 'The match ended because the connection did not return in time.'],
        ['انتهت مدة التحدي ولم تتم الموافقة عليه.', 'The challenge expired because it was not accepted.'],
        ['انقطع اتصال الخصم، وتم احتساب المباراة لصالحك.', 'The opponent disconnected. The match is awarded to you.'],
        ['انقطع اتصالك مؤقتًا. ستستأنف المباراة تلقائيًا عند عودة الاتصال.', 'You temporarily disconnected. The match will resume automatically when you reconnect.'],
        ['تمت استعادة المباراة بعد إعادة الاتصال.', 'The match was restored after reconnecting.'],
        ['تمت استعادة غرفة المباراة.', 'The match room was restored.'],
        ['انتهى دورك، بانتظار الخصم.', 'Your turn ended; waiting for the opponent.'],
        ['بدأت مباراة عبر الإنترنت ضد ', 'Online match started against '],
        ['بدأ دورك الآن (المرحلة ', 'Your turn began (Round '],
        ['دور الخصم الآن.', "It is the opponent's turn."],
        ['تم إرسال تحدي إلى ', 'Challenge sent to '],
        ['، وقررت اللعب كفريق ', ', you chose the '],
        [' مع اختيارك لفريق ', ' with the '],
        ['فريق النور', 'Light Team'],
        ['فريق الظلام', 'Dark Team'],
        ['النور', 'Light'],
        ['الظلام', 'Dark'],
        ['معالجة النور عالجت', 'The Light Healer restored'],
        ['الجار الصامت منع', 'The Silent Neighbor blocked'],
        ['بدأت مباراة ضد الكمبيوتر. ابدأ بإنزال كروتك ثم اضغط إنهاء الدور.', 'The computer match has started. Deploy your cards, then end your turn.'],
        ['انضممت إلى فريق النور. اختر كرتًا من يدك وابدأ الهجوم.', 'You joined the Light Team. Deploy a card and begin the attack.'],
        ['انضممت إلى فريق الظلام. اختر كرتًا من يدك وابدأ الهجوم.', 'You joined the Dark Team. Deploy a card and begin the attack.'],
        ['اضغط خانة فارغة لإنزال الكرت، أو اضغط الكرت مجدداً للإلغاء.', 'Click an empty slot to deploy the card, or click the card again to cancel.'],
        ['تم إنزال ', 'Deployed '],
        [' وخصم ', ' and spent '],
        [' من الذهب.', ' gold.'],
        ['انتهت تأثيرات المنع، الكروت يمكنها الهجوم من جديد.', 'Block effects ended; cards can attack again.'],
        ['سوق البنك متاح ابتداءً من المرحلة الثالثة.', 'The Bank Market is available from Round 3.'],
        ['لا توجد حركات متاحة لك حالياً. يمكنك إنهاء الدور وانتظار الجولة التالية.', 'No moves are currently available. You can end your turn and wait for the next round.'],
        ['لا توجد كروت للخصم في الساحة.', 'There are no opponent cards on the battlefield.'],
        ['هذا الكرت ممنوع بالفعل.', 'This card is already blocked.'],
        ['درع النور يحمي قائد الفريق من الضرر!', 'The Light Shield protects the team leader from damage!'],
        ['مات درع النور، انتهت الحماية عن القائد.', 'The Light Shield was destroyed; the leader is no longer protected.'],
        ['لا يمكن الهجوم: قوة الكرت المهاجم أقل من قوة الكرت المستهدف.', 'Cannot attack: the attacking card has less power than the target.'],
        ['استبدل فريق الظلام 3 ذهب بـ 6 حياة لسيد الظلال.', 'The Dark Team exchanged 3 gold for 6 leader health.'],
        ['استبدل فريق النور 3 ذهب بـ 6 حياة لمعالجة النور.', 'The Light Team exchanged 3 gold for 6 healer health.'],
        ['ضحى سيد الظلال (فريق الظلام) بـ 2 من حياته وحصل على 5 قطع ذهب إضافية.', 'Lord of Shadows (Dark Team) sacrificed 2 health and gained 5 gold.'],
        ['ضحى ملك الفجر (فريق النور) بـ 2 من حياته وحصل على 5 قطع ذهب إضافية.', 'King of Dawn (Light Team) sacrificed 2 health and gained 5 gold.'],
        ['الحكم: بدأ دورك (المرحلة ', 'Judge: your turn began (Round '],
        ['بدأ دورك (المرحلة ', 'Your turn began (Round '],
        ['الجولة ', 'Round '],
        ['المرحلة ', 'Round '],
        ['الحكم: بدأ دورك', 'Judge: your turn began'],
        ['الحكم: دخلت ', 'Judge: entered '],
        ['، تم توزيع ', ', distributed '],
        [' ذهب لكل لاعب.', ' gold to each player.'],
        ['، ولا يوجد توزيع ذهب إضافي في هذه المرحلة.', '; no additional income in this round.'],
        ['). تم توزيع ', '). Distributed '],
        ['ليس لديك مال كافٍ لشراء ', 'You do not have enough gold to buy '],
        [' تحتاج إلى ', '. You need '],
        [' ذهب.', ' gold.'],
        ['تم شراء ', 'Bought '],
        [' من البنك مقابل ', ' from the Bank for '],
        [' ذهب وأضيف إلى يدك.', ' gold and added it to your hand.'],
        ['انتهى دورك، بانتظار الخصم.', 'Your turn ended; waiting for the opponent.'],
        ['خسر فريقك لأنه أنهى دوره دون هجوم أو إنزال أو معالجة أو لعبة حظ.', 'Your team lost because it ended the turn without attacking, deploying, healing, or playing the lottery.'],
        ['ملك الفجر', 'King of Dawn'],
        ['سيد الظلال', 'Lord of Shadows'],
        ['فريق النور', 'Light Team'],
        ['فريق الظلام', 'Dark Team'],
        ['بعث الارواح', 'Resurrect'],
        ['جيش المرتزقة', 'Mercenary Army'],
        ['ضريبة قسرية', 'Forced Tax'],
        ['لعنة الافلاس', 'Bankruptcy Curse']
    ];
    replacements.forEach(([from, to]) => { text = text.split(from).join(to); });
    return text;
}

function updateBattleNews(newMessage) {
    newMessage = localizeBattleNews(newMessage);
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
        { id: 'falcon', image: 'assets/images/cards/Good/falcon.png', name: 'Fierce Falcon', cost: 2, health: 8, attack: 2 },
        { id: 'light-healer', image: 'assets/images/cards/Good/light-healer.png', name: 'Light Healer', cost: 2, health: 12, attack: 0 },
        { id: 'cunning-trader', image: 'assets/images/cards/Good/cunning-trader.png', name: 'Cunning Trader', cost: 3, health: 6, attack: 5 },
        { id: 'vault-guardian', image: 'assets/images/cards/Good/vault-guardian.png', name: 'Vault Guardian', cost: 4, health: 11, attack: 7 },
        { id: 'light-shield', image: 'assets/images/cards/Good/light-shield.png', name: 'Light Shield', cost: 4, health: 13, attack: 3 },
        { id: 'sword-of-justice', image: 'assets/images/cards/Good/sword-of-justice.png', name: 'Sword of Justice', cost: 5, health: 9, attack: 8 }
    ],
    dark: [
        { id: 'silent-neighbor', image: 'assets/images/cards/Evil/silent-neighbor.png', name: 'Silent Neighbor', cost: 2, health: 8, attack: 3 },
        { id: 'hell-dragon', image: 'assets/images/cards/Evil/hell-dragon.png', name: 'Hell Dragon', cost: 6, health: 15, attack: 8 },
        { id: 'dark-ghoul', image: 'assets/images/cards/Evil/dark-ghoul.png', name: 'Dark Ghoul', cost: 4, health: 13, attack: 5 },
        { id: 'dread-priest', image: 'assets/images/cards/Evil/dread-priest.png', name: 'Dread Priest', cost: 3, health: 9, attack: 4 },
        { id: 'valley-of-screams', image: 'assets/images/cards/Evil/valley-of-screams.png', name: 'Valley of Screams', cost: 3, health: 7, attack: 4 },
        { id: 'box-monster', image: 'assets/images/cards/Evil/box-monster.png', name: 'Box Monster', cost: 4, health: 11, attack: 5 }
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
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang];
    const teamCards = t.cards[team];
    
    battleHand.setAttribute('aria-label', `${lang === 'ar' ? 'كروت فريق' : 'Cards of'} ${team === 'dark' ? (lang === 'ar' ? 'الظلام' : 'Dark') : (lang === 'ar' ? 'النور' : 'Light')}`);
    
    battleHand.innerHTML = battleCards[team].map((card, cardIndex) => {
        const cardInfo = teamCards[cardIndex];
        return `
        <article class="battle-card" draggable="true" data-card-index="${cardIndex}" tabindex="0" aria-label="${cardInfo.name}: ${lang === 'ar' ? 'التكلفة' : 'Cost'} ${card.cost}, ${lang === 'ar' ? 'الحياة' : 'Health'} ${card.health}, ${lang === 'ar' ? 'القوة الهجومية' : 'Attack Power'} ${card.attack}. ${cardInfo.description}">
            <img src="${card.image}" alt="${cardInfo.name}">
            <span class="card-cost">${card.cost}</span>
            <h2>${cardInfo.name}</h2>
            <div class="card-values"><span>❤ <strong>${card.health}</strong></span><span>⚔ <strong>${card.attack}</strong></span></div>
            <button class="card-info-button" type="button" data-card-name="${card.id}" data-card-cost="${card.cost}" data-card-health="${card.health}" data-card-attack="${card.attack}" data-card-description="${cardInfo.description}" data-card-image="${card.image}">?</button>
            <div class="card-tooltip" role="tooltip">
                <strong>${cardInfo.name}</strong>
                <span>${lang === 'ar' ? 'التكلفة' : 'Cost'}: ${card.cost}</span>
                <span>${lang === 'ar' ? 'الحياة' : 'Health'}: ${card.health}</span>
                <span>${lang === 'ar' ? 'القوة الهجومية' : 'Attack Power'}: ${card.attack}</span>
                <p>${cardInfo.description}</p>
            </div>
        </article>
    `}).join('');
    setTurnLockState();
}

function renderHandModal(team) {
    if (!handModalContent) return;
    
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang];
    const teamCards = t.cards[team];
    
    handModalContent.innerHTML = battleCards[team].map((card, cardIndex) => {
        const cardInfo = teamCards[cardIndex];
        return `
        <article class="battle-card" draggable="true" data-card-index="${cardIndex}" tabindex="0" aria-label="${cardInfo.name}: ${lang === 'ar' ? 'التكلفة' : 'Cost'} ${card.cost}, ${lang === 'ar' ? 'الحياة' : 'Health'} ${card.health}, ${lang === 'ar' ? 'القوة الهجومية' : 'Attack Power'} ${card.attack}. ${cardInfo.description}">
            <img src="${card.image}" alt="${cardInfo.name}">
            <span class="card-cost">${card.cost}</span>
            <h2>${cardInfo.name}</h2>
            <div class="card-values"><span>❤ <strong>${card.health}</strong></span><span>⚔ <strong>${card.attack}</strong></span></div>
            <button class="card-info-button" type="button" data-card-name="${card.id}" data-card-cost="${card.cost}" data-card-health="${card.health}" data-card-attack="${card.attack}" data-card-description="${cardInfo.description}" data-card-image="${card.image}">?</button>
        </article>
    `}).join('');
    
    // إضافة event listeners للكروت في نافذة اليد
    const modalCards = handModalContent.querySelectorAll('.battle-card');
    modalCards.forEach((card) => {
        card.addEventListener('click', (event) => {
            const cardIndex = card.dataset.cardIndex;
            const battleCard = battleHand.querySelector(`.battle-card[data-card-index="${cardIndex}"]`);
            if (battleCard) {
                battleCard.click();
                hideHandModal();
            }
        });
        
        card.addEventListener('dragstart', (event) => {
            const cardIndex = card.dataset.cardIndex;
            const battleCard = battleHand.querySelector(`.battle-card[data-card-index="${cardIndex}"]`);
            if (battleCard) {
                battleCard.dispatchEvent(new Event('dragstart'));
            }
        });
    });
}

function showHandModal() {
    const team = battleScreen.dataset.selectedTeam || 'light';
    renderHandModal(team);
    handModal.classList.remove('screen-hidden');
    handModal.setAttribute('aria-hidden', 'false');
    handToggle.setAttribute('aria-expanded', 'true');
}

function hideHandModal() {
    handModal.classList.add('screen-hidden');
    handModal.setAttribute('aria-hidden', 'true');
    handToggle.setAttribute('aria-expanded', 'false');
}

function refreshDeployedCards() {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const team = battleScreen.dataset.selectedTeam || 'light';
    
    // Refresh player deployed cards
    playerDropSlots.forEach((slot) => {
        if (slot.classList.contains('occupied-slot')) {
            const cardId = slot.dataset.cardName;
            const cardHealth = slot.dataset.health;
            const cardAttack = slot.dataset.attack;
            const cardImage = slot.querySelector('.deployed-card-image').src;
            const isHealer = cardId === 'light-healer';
            const isSilentNeighbor = cardId === 'silent-neighbor';
            
            const canAttack = slot.querySelector('.card-attack-button') && !slot.querySelector('.card-attack-button').disabled;
            
            // Get the card data
            const card = battleCards[team].find(c => c.id === cardId);
            if (!card) return;
            
            // Get translated card info
            const t = translations[lang];
            const teamCards = t.cards[team];
            const cardIndex = teamCards.findIndex(c => {
                const targetId = c.name.toLowerCase().replace(/\s+/g, '-');
                return cardId === targetId || 
                       cardId === 'falcon' && c.name === 'Fierce Falcon' ||
                       cardId === 'light-healer' && c.name === 'Light Healer' ||
                       cardId === 'cunning-trader' && c.name === 'Cunning Trader' ||
                       cardId === 'vault-guardian' && c.name === 'Vault Guardian' ||
                       cardId === 'light-shield' && c.name === 'Light Shield' ||
                       cardId === 'sword-of-justice' && c.name === 'Sword of Justice' ||
                       cardId === 'silent-neighbor' && c.name === 'Silent Neighbor' ||
                       cardId === 'hell-dragon' && c.name === 'Hell Dragon' ||
                       cardId === 'dark-ghoul' && c.name === 'Dark Ghoul' ||
                       cardId === 'dread-priest' && c.name === 'Dread Priest' ||
                       cardId === 'valley-of-screams' && c.name === 'Valley of Screams' ||
                       cardId === 'box-monster' && c.name === 'Box Monster';
            });
            
            const cardInfo = cardIndex !== -1 ? teamCards[cardIndex] : null;
            const translatedName = cardInfo ? cardInfo.name : card.name;
            const translatedDescription = cardInfo ? cardInfo.description : '';
            
            slot.innerHTML = `
                <img class="deployed-card-image" src="${cardImage}" alt="${translatedName}">
                <span class="deployed-card-name">${translatedName}</span>
                <div class="deployed-card-stats">
                    <span class="deployed-card-health">❤ <strong>${cardHealth}</strong></span>
                    <span class="deployed-card-attack">⚔ <strong>${cardAttack}</strong></span>
                </div>
                <button class="card-info-button" type="button" data-card-name="${translatedName}" data-card-cost="${card.cost}" data-card-health="${cardHealth}" data-card-attack="${cardAttack}" data-card-description="${translatedDescription}" data-card-image="${cardImage}">?</button>
                ${canAttack ? `
                    <button class="card-attack-button ${isHealer ? 'card-heal-button' : ''}" type="button" data-card-name="${translatedName}" data-action="${isHealer ? 'heal' : 'attack'}" ${battlePhase === 1 ? 'disabled' : ''}>${isHealer ? '✚' : '⚔'} <span>${isHealer ? (lang === 'ar' ? 'معالجة' : 'Heal') : (lang === 'ar' ? 'هجوم' : 'Attack')}</span></button>
                    ${isSilentNeighbor ? `<button class="card-silence-button" type="button" data-card-name="${translatedName}" data-action="silence" ${battlePhase === 1 ? 'disabled' : ''}>🔇 <span>${lang === 'ar' ? 'منع كرت' : 'Block Card'}</span></button>` : ''}
                ` : ''}
            `;
        }
    });
    
    // Refresh computer deployed cards
    computerDropSlots.forEach((slot) => {
        if (slot.classList.contains('occupied-slot')) {
            const cardId = slot.dataset.cardName;
            const cardHealth = slot.dataset.health;
            const cardAttack = slot.dataset.attack;
            const cardImage = slot.querySelector('.deployed-card-image').src;
            
            // Get the card data for opponent team
            const opponentTeam = team === 'light' ? 'dark' : 'light';
            const card = battleCards[opponentTeam].find(c => c.id === cardId);
            if (!card) return;
            
            // Get translated card info
            const t = translations[lang];
            const teamCards = t.cards[opponentTeam];
            const cardIndex = teamCards.findIndex(c => {
                const targetId = c.name.toLowerCase().replace(/\s+/g, '-');
                return cardId === targetId || 
                       cardId === 'falcon' && c.name === 'Fierce Falcon' ||
                       cardId === 'light-healer' && c.name === 'Light Healer' ||
                       cardId === 'cunning-trader' && c.name === 'Cunning Trader' ||
                       cardId === 'vault-guardian' && c.name === 'Vault Guardian' ||
                       cardId === 'light-shield' && c.name === 'Light Shield' ||
                       cardId === 'sword-of-justice' && c.name === 'Sword of Justice' ||
                       cardId === 'silent-neighbor' && c.name === 'Silent Neighbor' ||
                       cardId === 'hell-dragon' && c.name === 'Hell Dragon' ||
                       cardId === 'dark-ghoul' && c.name === 'Dark Ghoul' ||
                       cardId === 'dread-priest' && c.name === 'Dread Priest' ||
                       cardId === 'valley-of-screams' && c.name === 'Valley of Screams' ||
                       cardId === 'box-monster' && c.name === 'Box Monster';
            });
            
            const cardInfo = cardIndex !== -1 ? teamCards[cardIndex] : null;
            const translatedName = cardInfo ? cardInfo.name : card.name;
            
            slot.innerHTML = `
                <img class="deployed-card-image" src="${cardImage}" alt="${translatedName}">
                <span class="deployed-card-name">${translatedName}</span>
                <div class="deployed-card-stats">
                    <span class="deployed-card-health">❤ <strong>${cardHealth}</strong></span>
                    <span class="deployed-card-attack">⚔ <strong>${cardAttack}</strong></span>
                </div>
                <button class="card-info-button" type="button" data-card-name="${translatedName}" data-card-cost="${card.cost}" data-card-health="${cardHealth}" data-card-attack="${cardAttack}" data-card-description="${cardInfo ? cardInfo.description : ''}" data-card-image="${cardImage}">?</button>
            `;
        }
    });
}

function deployedCardMarkup(card, canAttack = true, isPlayerCard = true) {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang];
    
    // Find the card in translations by id
    let cardInfo = null;
    const team = battleScreen.dataset.selectedTeam || 'light';
    const teamCards = t.cards[team];
    
    // Find card by id
    const cardIndex = teamCards.findIndex(c => {
        const cardId = card.id || card.name?.toLowerCase().replace(/\s+/g, '-');
        const targetId = c.name.toLowerCase().replace(/\s+/g, '-');
        return cardId === targetId || 
               card.id === 'falcon' && c.name === 'Fierce Falcon' ||
               card.id === 'light-healer' && c.name === 'Light Healer' ||
               card.id === 'cunning-trader' && c.name === 'Cunning Trader' ||
               card.id === 'vault-guardian' && c.name === 'Vault Guardian' ||
               card.id === 'light-shield' && c.name === 'Light Shield' ||
               card.id === 'sword-of-justice' && c.name === 'Sword of Justice' ||
               card.id === 'silent-neighbor' && c.name === 'Silent Neighbor' ||
               card.id === 'hell-dragon' && c.name === 'Hell Dragon' ||
               card.id === 'dark-ghoul' && c.name === 'Dark Ghoul' ||
               card.id === 'dread-priest' && c.name === 'Dread Priest' ||
               card.id === 'valley-of-screams' && c.name === 'Valley of Screams' ||
               card.id === 'box-monster' && c.name === 'Box Monster';
    });
    
    if (cardIndex !== -1) {
        cardInfo = teamCards[cardIndex];
    }
    
    const cardName = cardInfo ? cardInfo.name : card.name;
    const cardDescription = cardInfo ? cardInfo.description : card.description;
    
    const isHealer = card.id === 'light-healer';
    const isSilentNeighbor = card.id === 'silent-neighbor';
    
    return `
        <img class="deployed-card-image" src="${card.image}" alt="${cardName}">
        <span class="deployed-card-name">${cardName}</span>
        <div class="deployed-card-stats">
            <span class="deployed-card-health">❤ <strong>${card.health}</strong></span>
            <span class="deployed-card-attack">⚔ <strong>${card.attack}</strong></span>
        </div>
        <button class="card-info-button" type="button" data-card-name="${cardName}" data-card-cost="${card.cost}" data-card-health="${card.health}" data-card-attack="${card.attack}" data-card-description="${cardDescription}" data-card-image="${card.image}">?</button>
        ${canAttack && isPlayerCard ? `
            <button class="card-attack-button ${isHealer ? 'card-heal-button' : ''}" type="button" data-card-name="${cardName}" data-action="${isHealer ? 'heal' : 'attack'}" ${battlePhase === 1 ? 'disabled' : ''}>${isHealer ? '✚' : '⚔'} <span>${isHealer ? (lang === 'ar' ? 'معالجة' : 'Heal') : (lang === 'ar' ? 'هجوم' : 'Attack')}</span></button>
            ${isSilentNeighbor ? `<button class="card-silence-button" type="button" data-card-name="${cardName}" data-action="silence" ${battlePhase === 1 ? 'disabled' : ''}>🔇 <span>${lang === 'ar' ? 'منع كرت' : 'Block Card'}</span></button>` : ''}
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
        if (slot.dataset.cardName === 'light-healer') slot.dataset.healUses = '0';
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
    const healerSlot = [...playerDropSlots].find((slot) => slot.dataset.cardName === 'light-healer');
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
    const key = isPlayerTurn ? 'phaseYourTurn' : 'phaseOpponentTurn';
    document.querySelector('.turn-indicator').textContent = battleText(key, `Round ${battlePhase} - ${isPlayerTurn ? 'Your Turn' : "Opponent's Turn"}`).replace('{phase}', battlePhase);
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
        const found = battleCards[team].find((card) => card.id === name || card.name === name);
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

function createGraveyardElement(cardName, imageSrc, team) {
    const translatedName = getTranslatedCardName(cardName, team);
    const element = document.createElement('div');
    element.className = 'graveyard-card';
    element.title = translatedName;
    const image = document.createElement('img');
    image.src = imageSrc;
    image.alt = translatedName;
    const label = document.createElement('span');
    label.textContent = translatedName;
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
    const healerSlot = [...playerDropSlots].find((slot) => slot.dataset.cardName === 'light-healer');
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
    cardsDeployedThisTurn = 0;
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
    battleNewsText.innerHTML = `<div class="news-content">${battleText('defaultMessage', 'Select a card or execute a command to start your turn.')}</div>`;
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
    const hasAffordableCard = battleCards[team].some((card) => !deployedNames.has(card.id) && getDropCost(team, card) <= stats.gold);
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

    if (!card || deployedNames.has(card.id)) {
        updateBattleNews('لا يمكن تكرار كرت موجود في ساحة المعركة.');
        return false;
    }

    if (cardsDeployedThisTurn >= 2) {
        updateBattleNews('لا يسمح بانزال 3 كروت في نفس الدور. انتظر إلى الجولة القادمة.');
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
    dropDiscount[team].delete(card.id);
    turnActions.player = true;
    deployedNames.add(card.id);
    deployedCardCount += 1;
    cardsDeployedThisTurn += 1;
    slot.classList.add('occupied-slot');
    slot.dataset.cardName = card.id;
    slot.dataset.health = card.health;
    slot.dataset.attack = card.attack;
    if (card.id === 'light-healer') slot.dataset.healUses = '0';
    slot.innerHTML = deployedCardMarkup(card, true, true);
    battleHand.querySelector(`[data-card-index="${cardIndex}"]`)?.remove();
    renderPlayerStats();
    updateGoldToHealthButton();
    endTurnButton.hidden = false;
    updateAttackButtons();
    notifyStateChange();
    const translatedName = getTranslatedCardName(card.id, team);
    updateBattleNews(`تم إنزال ${translatedName} وخصم ${dropCost} من الذهب.`);
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
    const canDeploy = availableSlot && battleCards[playerTeam].some((card) => getDropCost(playerTeam, card) <= stats.gold && !deployedCardNames[playerTeam].has(card.id));
    const opponentCards = [...computerDropSlots].filter((slot) => slot.classList.contains('occupied-slot'));
    const canAttack = [...playerDropSlots].some((attackerSlot) => attackerSlot.classList.contains('occupied-slot')
        && attackerSlot.dataset.attackUsed !== 'true'
        && opponentCards.some((targetSlot) => Number(attackerSlot.dataset.attack) >= Number(targetSlot.dataset.attack)));
    const healerSlot = [...playerDropSlots].find((slot) => slot.dataset.cardName === 'light-healer');
    const injuredAlly = [...playerDropSlots].some((slot) => {
        if (!slot.classList.contains('occupied-slot') || slot === healerSlot) return false;
        const maxHealth = battleCards[playerTeam].find((card) => card.id === slot.dataset.cardName)?.health || Number(slot.dataset.health);
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
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const leader = team === 'dark'
        ? { image: 'assets/images/characters/lord-shadow.png', name: lang === 'ar' ? 'سيد الظلال' : 'Lord of Shadows', health: playerStats.darkTeam.health }
        : { image: 'assets/images/characters/king-dawn.png', name: lang === 'ar' ? 'ملك الفجر' : 'King of Dawn', health: playerStats.lightTeam.health };

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
    document.querySelector('.turn-indicator').textContent = startsWithPlayer ? battleText('turn', 'Your Turn') : (document.documentElement.lang === 'ar' ? 'انتظار دور الخصم' : 'Waiting for opponent');
    lightPlayerBanner.classList.toggle('active-player', team === 'light' && startsWithPlayer);
    darkPlayerBanner.classList.toggle('active-player', team === 'dark' && startsWithPlayer);
    renderBattleHand(team);
    renderLeaders(team);
    endTurnButton.textContent = battleText('endTurn', 'End Turn');
    setTurnLockState();
    const joinMessage = battleText(team === 'dark' ? 'joinDark' : 'joinLight', team === 'dark'
        ? 'You joined the Dark Team. Deploy a card and begin the attack.'
        : 'You joined the Light Team. Deploy a card and begin the attack.');
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
                <small>${cardText('attack', 'Attack')}: ${slot.dataset.attack}${isAlreadyBlocked ? ' - ممنوع بالفعل' : ''}</small>
            </button>
        `;
    }).join('');

    silenceModal.querySelector('#silence-title').textContent = battleText('silenceTitle', 'Choose a card to block');
    const hasValidTarget = silenceTargets.querySelector('.attack-target:not(:disabled)');
    silenceEmptyMessage.textContent = battleText('noSilenceTargets', 'There are no cards that can be blocked.');
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
    const team = battleScreen.dataset.selectedTeam;
    const translatedName = team ? getTranslatedCardName(cardData.name, team) : cardData.name;
    document.getElementById('card-info-title').textContent = translatedName;
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
    const targetTeam = getSlotTeam(targetSlot);
    const translatedName = getTranslatedCardName(targetSlot.dataset.cardName, targetTeam);
    updateBattleNews(`الجار الصامت منع ${translatedName} من الهجوم في دوره القادم.`);
    hideSilenceModal();
    notifyStateChange();
}

function moveCardToGraveyard(slot) {
    const cardImage = slot.querySelector('.deployed-card-image');
    const cardName = slot.dataset.cardName || 'كرت';
    const team = getSlotTeam(slot);
    const graveyardElement = createGraveyardElement(cardName, cardImage?.getAttribute('src') || '', team);
    battleGraveyardSlots.appendChild(graveyardElement);
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

function updateVictoryModalText() {
    if (!matchResult) return;
    const playerTeam = battleScreen.dataset.selectedTeam;
    const winningTeam = matchResult.winner;
    const victoryType = matchResult.type;
    const playerWon = winningTeam === playerTeam;
    const winnerName = winningTeam === 'light' ? battleText('lightTeam', 'Light Team') : battleText('darkTeam', 'Dark Team');
    const titleKey = playerWon
        ? (victoryType === 'economic' ? 'victoryEconomicTitle' : 'victoryMilitaryTitle')
        : (victoryType === 'economic' ? 'defeatEconomicTitle' : 'defeatMilitaryTitle');
    const messageKey = playerWon
        ? (victoryType === 'economic' ? 'victoryEconomicMessage' : 'victoryMilitaryMessage')
        : (victoryType === 'economic' ? 'defeatEconomicMessage' : 'defeatMilitaryMessage');
    const message = battleText(messageKey, '').replace('{gold}', ECONOMIC_VICTORY_GOLD).replace('{winner}', winnerName);
    victoryTitle.textContent = battleText(titleKey, playerWon ? 'Congratulations!' : 'Better luck next time');
    victoryMessage.textContent = message;
    const leader = winningTeam === 'light'
        ? { image: 'assets/images/characters/king-dawn.png', name: battleText('leaderLight', 'King of Dawn') }
        : { image: 'assets/images/characters/lord-shadow.png', name: battleText('leaderDark', 'Lord of Shadows') };
    victoryLeaderImage.src = leader.image;
    victoryLeaderImage.alt = leader.name;
    victoryResultIcon.textContent = playerWon ? (victoryType === 'economic' ? '💰' : '🏆') : '😔';
}

function showVictoryModal(winningTeam, victoryType = 'military') {
    if (matchResult) return; // النتيجة أُعلنت من قبل
    matchResult = { winner: winningTeam, type: victoryType };
    updateVictoryModalText();
    
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
    const attackerCardId = attackerSlot.dataset.cardName || attackerName;
    const targetCardId = targetSlot.dataset.cardName || 'الكرت المستهدف';
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
    const attackerCardName = getTranslatedCardName(attackerCardId, attackerTeam);
    const targetCardName = getTranslatedCardName(targetCardId, targetTeam);
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
    const targetName = targetType === 'leader' ? 'ملك الفجر' : getTranslatedCardName(targetSlot.dataset.cardName, battleScreen.dataset.selectedTeam);
    updateBattleNews(`عالجت معالجة النور ${targetName} وأضافت ${restoredHealth} حياة، وخسرت نقطتين من حياتها.`);
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
                <small>${cardText('attack', 'Attack')}: ${slot.dataset.attack}${blockReason ? ` - ${blockReason}` : ''}</small>
            </button>
        `;
    }).join('');
    attackModal.querySelector('#attack-title').textContent = battleText('attackTitle', 'Choose a target to attack');
    const hasValidTarget = attackTargets.querySelector('.attack-target:not(:disabled)');
    attackEmptyMessage.textContent = opponentCards.length === 0
        ? battleText('noOpponentCards', 'There are no opponent cards on the battlefield.')
        : battleText('noAttackTargets', 'There are no cards that can be attacked now.');
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
    setBankView(null);
    if (isOpen) setGraveyardOpen(false);
    battleShop.classList.toggle('shop-open', isOpen);
    battleShop.setAttribute('aria-hidden', String(!isOpen));
    bankToggle.setAttribute('aria-expanded', String(isOpen));
}

function setBankView(view) {
    const showBank = view === 'bank';
    const showGraveyard = view === 'graveyard';
    bankInventory.hidden = !showBank;
    graveyardInventory.hidden = !showGraveyard;
    bankShopChoice.setAttribute('aria-pressed', String(showBank));
    graveyardShopChoice.setAttribute('aria-pressed', String(showGraveyard));
    shopTitle.textContent = showBank
        ? battleText('bankCards', 'Bank Cards')
        : showGraveyard
            ? battleText('graveyardCards', 'Graveyard Cards')
            : battleText('shopTitle', 'Bank Market');
    if (showGraveyard) renderGraveyardBankCards();
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
    const translatedName = getTranslatedCardName(card.id, playerTeam);
    if (!ensureGoldThroughLeaderSacrifice(playerTeam, card.cost, card.name)) {
        updateBattleNews(`ليس لديك مال كافٍ لشراء ${translatedName}. تحتاج إلى ${card.cost} ذهب.`);
        return;
    }
    
    const purchaseCost = card.cost;
    stats.gold -= purchaseCost;

    // بعد الشراء من المقبرة يكلّف إنزال الكرت 1 ذهب فقط
    dropDiscount[playerTeam].add(card.id);
    card.cost = DISCOUNTED_DROP_COST;   // ليظهر على كرت اليد
    
    // إضافة الكرت إلى اليد
    addCardToHand(card);
    deployedCardNames[playerTeam].delete(card.id);
    card.element?.remove();
    graveyardCards.splice(cardIndex, 1);
    renderGraveyardBankCards();
    updateGraveyardBadge();
    renderPlayerStats();
    turnActions.player = true;
    updateBattleNews(`تم شراء ${translatedName} من المقبرة مقابل ${purchaseCost} ذهب، وإنزاله سيكلّف 1 ذهب فقط.`);
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
bankShopChoice.addEventListener('click', () => setBankView('bank'));
graveyardShopChoice.addEventListener('click', () => setBankView('graveyard'));
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
handToggle.addEventListener('click', showHandModal);
closeHandModal.addEventListener('click', hideHandModal);
handModal.addEventListener('click', (event) => {
    if (event.target === handModal) hideHandModal();
});
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
