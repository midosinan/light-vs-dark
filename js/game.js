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
const languageToggle = document.querySelector('#language-toggle');
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
const turnIndicatorLabel = document.querySelector('#turn-indicator-label');
const turnTimer = document.querySelector('#turn-timer');
const turnDurationSelect = document.querySelector('#turn-duration');
const handToggle = document.querySelector('#hand-toggle');
const handModal = document.querySelector('#hand-modal');
const closeHandModal = document.querySelector('#close-hand-modal');
const handModalContent = document.querySelector('#hand-modal-content');
const ECONOMIC_VICTORY_GOLD = 30;
const TURN_TIME_LIMIT_SECONDS = 45;
let gameTurnDurationMs = TURN_TIME_LIMIT_SECONDS * 1000;

function getSelectedTurnDurationMs() {
    const seconds = Number(turnDurationSelect?.value);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : TURN_TIME_LIMIT_SECONDS * 1000;
}

function normalizeTurnDurationMs(durationMs) {
    const allowedDurations = [0, 45_000, 60_000, 90_000, 120_000];
    if (durationMs === null) return 0;
    return allowedDurations.includes(durationMs) ? durationMs : TURN_TIME_LIMIT_SECONDS * 1000;
}

function setGameTurnDurationMs(durationMs) {
    gameTurnDurationMs = normalizeTurnDurationMs(durationMs);
}
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
let battleRoundNumber = 1;
let isGameOver = false;
let matchResult = null;           // نتيجة المباراة { winner, type }
let turnHasNoAvailableMoves = false;
let victoryReturnTimer = null;
let turnTimerInterval = null;
let turnDeadline = 0;

// الوضع الحالي للعب ('online' أو 'ai'): يسجّل نفسه هنا من online.js أو ai.js.
// game.js لا يعرف تفاصيل أي وضع؛ يكتفي باستدعاء هذه الخطافات:
//   afterAction()  بعد كل حركة تغيّر الحالة     finishTurn()  عند إنهاء اللاعب دوره     leaveMatch()  عند مغادرة المباراة
let activeMode = null;
function notifyStateChange() { if (activeMode && activeMode.afterAction) activeMode.afterAction(); }

function setTurnIndicatorMessage(message) {
    turnIndicatorLabel.textContent = message;
}

function clearPlayerTurnTimer() {
    if (turnTimerInterval !== null) {
        window.clearInterval(turnTimerInterval);
        turnTimerInterval = null;
    }
    turnDeadline = 0;
    turnTimer.hidden = true;
    turnTimer.classList.remove('timer-warning');
}

function updatePlayerTurnTimer() {
    if (!isPlayerTurn || isGameOver || !activeMode || battleScreen.hidden || battleScreen.classList.contains('screen-hidden')) {
        clearPlayerTurnTimer();
        return;
    }

    const secondsRemaining = Math.ceil((turnDeadline - Date.now()) / 1000);
    if (secondsRemaining <= 0) {
        clearPlayerTurnTimer();
        const team = battleScreen.dataset.selectedTeam;
        const stats = playerStats[team === 'dark' ? 'darkTeam' : 'lightTeam'];
        stats.gold = Math.max(0, stats.gold - 1);
        renderPlayerStats();
        updateBattleNews(battleText('turnTimeout', 'Time is up. Your turn was passed and you lost 1 gold.'), 'danger');
        endPlayerTurn(true);
        return;
    }

    const lang = document.documentElement.getAttribute('lang') || 'en';
    turnTimer.textContent = lang === 'ar' ? `${secondsRemaining}ث` : `${secondsRemaining}s`;
    turnTimer.hidden = false;
    turnTimer.classList.toggle('timer-warning', secondsRemaining <= 10);
}

function startPlayerTurnTimer(durationMs = gameTurnDurationMs) {
    clearPlayerTurnTimer();
    if (!isPlayerTurn || isGameOver || !activeMode || battleScreen.hidden || battleScreen.classList.contains('screen-hidden')) return;
    if (durationMs === null || durationMs === 0) return;

    turnDeadline = Date.now() + Math.max(0, durationMs);
    updatePlayerTurnTimer();
    turnTimerInterval = window.setInterval(updatePlayerTurnTimer, 250);
}

// كروت اشتراها اللاعب من البنك أو المقبرة: إنزالها يكلّف 1 ذهب فقط
const DISCOUNTED_DROP_COST = 1;
const bankSoldCardNames = new Set();
const dropDiscount = { light: new Set(), dark: new Set() };

function normalizeBankCardName(cardName) {
    return String(cardName ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function syncBankCardAvailability() {
    [...battleShop.querySelectorAll('.bank-card[data-bank-cost]')].forEach((card) => {
        if (card.dataset.bankAction === 'lottery') return;
        const isSold = bankSoldCardNames.has(normalizeBankCardName(card.dataset.bankName));
        card.hidden = isSold;
        card.disabled = isSold;
        card.classList.toggle('bank-card-purchased', isSold);
        card.setAttribute('aria-hidden', String(isSold));
    });
}

function isBankCardAvailable(cardName) {
    return !bankSoldCardNames.has(normalizeBankCardName(cardName));
}

function markBankCardSold(cardName) {
    if (!cardName) return;
    bankSoldCardNames.add(normalizeBankCardName(cardName));
    syncBankCardAvailability();
}

function releaseBankCard(cardName) {
    if (!cardName) return;
    bankSoldCardNames.delete(normalizeBankCardName(cardName));
    syncBankCardAvailability();
}

function getDropCost(team, card) {
    return (card.isBankCard || dropDiscount[team].has(card.id)) ? DISCOUNTED_DROP_COST : card.cost;
}
const turnActions = { player: false, computer: false };
const goldToHealthUsed = { light: false, dark: false };
const healthToGoldUsed = { light: false, dark: false };
let victoryTimer = null;
let insufficientGoldTimer = null;
let insufficientGoldContext = null;
const deployedCardNames = { light: new Set(), dark: new Set() };
const graveyardCards = [];
const phaseGoldIncome = { 2: 4, 3: 3, 4: 2, 5: 1 };

// نظام التأثيرات المؤقتة
const tempEffects = {
    blockedCards: new Set(), // مفاتيح الخانات الممنوعة من الهجوم: "الفريق_رقم الخانة" مثل light_2
    silencedBy: new Map(), // يربط الكرت الممنوع بالكرت الذي منعه
    blockDuration: new Map() // يربط مفتاح الخانة بعدد الجولات المتبقية للمنع
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function isLeaderShieldCard(cardName) {
    const normalized = String(cardName ?? '').trim().toLowerCase();
    const aliases = ['light-shield', 'leader-shield', 'bank:leader-shield'];
    return aliases.includes(cardName) || aliases.includes(normalized)
        || getBankCardTranslationKey(cardName) === 'commanderShield';
}

function getTranslatedCardInfo(cardId, team) {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const cardTeam = battleCards[team]?.some(card => card.id === cardId)
        ? team
        : ['light', 'dark'].find(candidate => battleCards[candidate]?.some(card => card.id === cardId));
    const cardIndex = battleCards[cardTeam]?.findIndex(card => card.id === cardId) ?? -1;
    return cardIndex >= 0 ? translations[lang]?.cards?.[cardTeam]?.[cardIndex] || null : null;
}

function getTranslatedCardName(cardId, team) {
    const bankCard = battleCards[team]?.find(card => card.isBankCard && (card.id === cardId || card.name === cardId));
    if (bankCard) return getTranslatedBankCardName(bankCard.name);
    return getTranslatedCardInfo(cardId, team)?.name
        || battleCards[team]?.find(card => card.id === cardId)?.name
        || resolveCardDefinition(cardId, team)?.name
        || cardId;
}

function getCardDisplayName(card, team) {
    return card.isBankCard
        ? getTranslatedBankCardName(card.name)
        : getTranslatedCardName(card.id, team);
}

function getBankCardTranslationKey(cardName) {
    const normalizedName = String(cardName ?? '')
        .replace(/^bank:/i, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/[\u064B-\u065F\u0670]/g, '');
    const mapping = {
        'بعث الارواح': 'resurrect',
        resurrect: 'resurrect',
        'جيش المرتزقة': 'mercenary',
        'mercenary army': 'mercenary',
        'ضريبة قسرية': 'tax',
        'forced tax': 'tax',
        'لعنة الافلاس': 'bankruptcy',
        'bankruptcy curse': 'bankruptcy',
        'لعبة الحظ': 'luck',
        'game of luck': 'luck',
        'درع القائد': 'commanderShield',
        "commander's shield": 'commanderShield',
        'commander’s shield': 'commanderShield'
    };
    return mapping[normalizedName] || null;
}

function getTranslatedBankCardName(cardName) {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang] || translations.en;
    const key = getBankCardTranslationKey(cardName);
    return key ? (t.battle.bankCards[key] || t.battle.bankCardsEn[key]) : cardName;
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

function getTeamSlots(team) {
    return team === (battleScreen.dataset.selectedTeam || 'light') ? playerDropSlots : computerDropSlots;
}

function getBankCardRuleKey(cardId) {
    return getBankCardTranslationKey(cardId);
}

function getBankCardDescription(cardName) {
    const key = getBankCardTranslationKey(cardName);
    return key
        ? battleText(`bankCardDescriptions.${key}`, battleText('bankCardDescription', 'Purchased from the Bank.'))
        : battleText('bankCardDescription', 'Purchased from the Bank.');
}

function getLocalizedCardDescription(card, cardInfo = null) {
    return cardInfo?.description || (card.isBankCard ? getBankCardDescription(card.name) : card.description || '');
}

function canDeployCard(team, cardId) {
    if (cardId !== 'silent-neighbor') return true;
    const opponentTeam = team === 'dark' ? 'light' : 'dark';
    return ![...getTeamSlots(opponentTeam)].some((slot) =>
        slot.classList.contains('occupied-slot') && getBankCardRuleKey(slot.dataset.cardName) === 'resurrect'
    );
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
    if (isSlotBlocked(attackerSlot)) {
        return battleText('attackBlockedBySilent', 'This card is blocked by Silent Neighbor and cannot attack this turn.');
    }
    if (attackerAttack < targetAttack) {
        return battleText('attackTooWeak', 'Your card needs at least as much attack power as the target.');
    }
    if (targetSlot.dataset.cardName === 'sword-of-justice' && attackerAttack <= targetAttack) {
        return battleText('attackNeedsHigherPower', 'Sword of Justice can only be attacked by a card with higher attack power.');
    }
    if (targetSlot.dataset.cardName === 'light-healer') {
        const targetSlots = targetSlot.classList.contains('computer-slot') ? computerDropSlots : playerDropSlots;
        const hasFalcon = [...targetSlots].some((slot) => slot.classList.contains('occupied-slot') && slot.dataset.cardName === 'falcon');
        if (hasFalcon) {
            return battleText('healerProtectedByFalcon', 'The Light Healer is protected by the Fierce Falcon.');
        }
    }
    return '';
}

function localizeBattleNews(message) {
    if (message == null || typeof message !== 'string') return message;
    const normalizeMessage = (value) => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const normalizedMessage = normalizeMessage(message);
    const arabicToEnglish = [
        ['درع القائد يحمي قائد الفريق من الضرر!', 'The Leader Shield protects the team leader from damage!'],
        ['مات درع القائد، انتهت الحماية عن القائد.', 'The Leader Shield was destroyed; the leader is no longer protected.'],
        ['هذا الكرت تم شراؤه بالفعل من البنك، ولا يمكن شراء نسخة ثانية منه حتى يعود للبانك.', 'This card has already been bought from the bank and cannot be purchased again until it returns to the bank.'],
        ['سوق البنك متاح ابتداءً من المرحلة الثالثة.', 'The Bank Market is available from Round 3.'],
        ['هذا الكرت غير صالح.', 'This card is invalid.'],
        ['لا يمكن تكرار كرت موجود في ساحة المعركة.', 'A card of this type is already on the battlefield.'],
        ['لا يسمح بانزال 3 كروت في نفس الدور. انتظر إلى الجولة القادمة.', 'You cannot deploy a third card in the same turn. Wait until the next round.'],
        ['لا توجد كروت للخصم في الساحة.', 'There are no opponent cards on the battlefield.'],
        ['هذا الكرت ممنوع بالفعل.', 'This card is already blocked.'],
        ['انتهت تأثيرات المنع، الكروت يمكنها الهجوم من جديد.', 'Block effects ended; cards can attack again.'],
        ['لا توجد حركات متاحة لك حالياً. يمكنك إنهاء الدور وانتظار الجولة التالية.', 'There are no available moves for you right now. You can end your turn and wait for the next round.'],
        ['لا يمكن الهجوم: قوة الكرت المهاجم أقل من قوة الكرت المستهدف.', 'Cannot attack: the attacking card has less power than the target.'],
        ['لا يمكن تنفيذ هذا الهجوم: القوتان أقل من الهدف.', 'This attack cannot be performed: the attacking card has less power than the target.'],
        ['لا يمكن تنفيذ هذا الهجوم: الكرت المهاجم ممنوع من الهجوم (الجار الصامت).', 'This attack cannot be performed: the attacker is blocked from attacking (Silent Neighbor).'],
        ['لا يمكن تنفيذ هذا الهجوم: القوة غير كافية.', 'This attack cannot be performed: the attacking card is too weak.'],
        ['لا يمكن تنفيذ هذا الهجوم: يحتاج قوة أعلى.', 'This attack cannot be performed: it requires more attack power.']
    ];

    if (lang === 'en') {
        for (const [arabic, english] of arabicToEnglish) {
            if (normalizeMessage(arabic) === normalizedMessage) return english;
            if (normalizedMessage.startsWith('لا يمكن تنفيذ هذا الهجوم:')) {
                const reason = normalizedMessage.replace('لا يمكن تنفيذ هذا الهجوم: ', '');
                const reasonMap = {
                    'الكرت المهاجم ممنوع من الهجوم (الجار الصامت).': 'the attacker is blocked from attacking (Silent Neighbor).',
                    'قوة غير كافية.': 'the attacking card is too weak.',
                    'يحتاج قوة أعلى.': 'it requires higher attack power.',
                    'مخفية من الصقر الجارح.': 'it is protected by the Fierce Falcon.'
                };
                if (reasonMap[reason]) return `This attack cannot be performed: ${reasonMap[reason]}`;
            }
        }
        if (normalizedMessage.startsWith('لا يمكن الهجوم:')) {
            const reason = normalizedMessage.replace('لا يمكن الهجوم: ', '');
            if (reason.includes('أقل من')) return 'Cannot attack: the attacking card has less power than the target.';
        }
    }

    if (lang === 'ar') {
        const englishToArabic = [
            ['The Leader Shield protects the team leader from damage!', 'درع القائد يحمي قائد الفريق من الضرر!'],
            ['The Leader Shield was destroyed; the leader is no longer protected.', 'مات درع القائد، انتهت الحماية عن القائد.'],
            ['This card has already been bought from the bank and cannot be purchased again until it returns to the bank.', 'هذا الكرت تم شراؤه بالفعل من البنك، ولا يمكن شراء نسخة ثانية منه حتى يعود للبانك.'],
            ['The Bank Market is available from Round 3.', 'سوق البنك متاح ابتداءً من المرحلة الثالثة.'],
            ['This card is invalid.', 'هذا الكرت غير صالح.'],
            ['A card of this type is already on the battlefield.', 'لا يمكن تكرار كرت موجود في ساحة المعركة.'],
            ['You cannot deploy a third card in the same turn. Wait until the next round.', 'لا يسمح بانزال 3 كروت في نفس الدور. انتظر إلى الجولة القادمة.'],
            ['There are no opponent cards on the battlefield.', 'لا توجد كروت للخصم في الساحة.'],
            ['This card is already blocked.', 'هذا الكرت ممنوع بالفعل.'],
            ['Block effects ended; cards can attack again.', 'انتهت تأثيرات المنع، الكروت يمكنها الهجوم من جديد.'],
            ['There are no available moves for you right now. You can end your turn and wait for the next round.', 'لا توجد حركات متاحة لك حالياً. يمكنك إنهاء الدور وانتظار الجولة التالية.'],
            ['Cannot attack: the attacking card has less power than the target.', 'لا يمكن الهجوم: قوة الكرت المهاجم أقل من قوة الكرت المستهدف.'],
            ['This attack cannot be performed: the attacker is blocked from attacking (Silent Neighbor).', 'لا يمكن تنفيذ هذا الهجوم: الكرت المهاجم ممنوع من الهجوم (الجار الصامت).'],
            ['This attack cannot be performed: the attacking card is too weak.', 'لا يمكن تنفيذ هذا الهجوم: قوة غير كافية.'],
            ['This attack cannot be performed: it requires higher attack power.', 'لا يمكن تنفيذ هذا الهجوم: يحتاج قوة أعلى.']
        ];
        for (const [english, arabic] of englishToArabic) {
            if (normalizeMessage(english) === normalizedMessage) return arabic;
        }
        if (normalizedMessage.startsWith('This attack cannot be performed:')) {
            const reason = normalizedMessage.replace('This attack cannot be performed: ', '');
            const reasonMap = {
                'the attacker is blocked from attacking (Silent Neighbor).': 'الكرت المهاجم ممنوع من الهجوم (الجار الصامت).',
                'the attacking card is too weak.': 'قوة غير كافية.',
                'it requires higher attack power.': 'يحتاج قوة أعلى.',
                'it is protected by the Fierce Falcon.': 'مخفية من الصقر الجارح.'
            };
            if (reasonMap[reason]) return `لا يمكن تنفيذ هذا الهجوم: ${reasonMap[reason]}`;
        }
        if (normalizedMessage.startsWith('Cannot attack:')) {
            return 'لا يمكن الهجوم: قوة الكرت المهاجم أقل من قوة الكرت المستهدف.';
        }
        return message;
    }

    const sourceTemplates = translations.ar.battle.news;
    const targetTemplates = translations.en.battle.news;
    const valueTranslations = new Map([
        ['النور', 'Light'],
        ['الظلام', 'Dark'],
        ['نور', 'Light'],
        ['ظلام', 'Dark'],
        ['فريق النور', 'Light Team'],
        ['فريق الظلام', 'Dark Team'],
        ['ملك الفجر', 'King of Dawn'],
        ['سيد الظلال', 'Lord of Shadows'],
        ['فريقك', 'Your team'],
        ['الخصم', 'The opponent'],
        ['بعث الأرواح', 'Resurrect'],
        ['بعث الارواح', 'Resurrect'],
        ['جيش المرتزقة', 'Mercenary Army'],
        ['لعنة الافلاس', 'Bankruptcy Curse'],
        ['مبروك! كسبت 10 ذهبات.', 'Congratulations! You won 10 gold.'],
        ['للأسف! خسرت 5 ذهبات.', 'Unfortunately, you lost 5 gold.'],
        ['لم تكسب ولم تخسر شيئًا.', 'You neither won nor lost anything.'],
        ['مات', 'was defeated'],
        ['قوة غير كافية', 'insufficient attack power'],
        ['يحتاج قوة أعلى', 'requires higher attack power'],
        ['مخفية من الصقر الجارح', 'is protected by the Fierce Falcon'],
        ['الكرت المهاجم ممنوع من الهجوم (الجار الصامت)', 'the attacker is blocked by the Silent Neighbor'],
        ['لا يمكن الهجوم: قوة الكرت المهاجم أقل من قوة الكرت المستهدف.', 'Cannot attack: the attacking card has less power than the target.']
    ]);

    Object.entries(translations.ar.cards).forEach(([team, cards]) => {
        cards.forEach((card, index) => valueTranslations.set(card.name, translations.en.cards[team][index].name));
    });
    Object.entries(sourceTemplates).forEach(([key, source]) => {
        const parts = source.split(/(\{\w+\})/g);
        const placeholders = new Set();
        const pattern = new RegExp(`^${parts.map((part) => {
            const placeholder = part.match(/^\{(\w+)\}$/);
            if (placeholder) {
                if (placeholders.has(placeholder[1])) return `\\k<${placeholder[1]}>`;
                placeholders.add(placeholder[1]);
                return `(?<${placeholder[1]}>[\\s\\S]*?)`;
            }
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('')}$`);
        const match = String(message).match(pattern);
        if (!match) return;
        const values = {};
        parts.forEach((part) => {
            const placeholder = part.match(/^\{(\w+)\}$/);
            if (!placeholder || part in values) return;
            const value = match.groups[placeholder[1]];
            const statusMatch = value.match(/^بقيت له (\d+) حياة$/);
            values[part] = valueTranslations.get(value) || (statusMatch ? `has ${statusMatch[1]} health` : value);
        });
        let translated = targetTemplates[key];
        Object.entries(values).forEach(([placeholder, value]) => {
            translated = translated.replaceAll(placeholder, value);
        });
        message = translated;
    });
    return valueTranslations.get(message) || message;
}

function updateBattleNewsCount() {
    const count = battleNewsText.querySelectorAll('.news-content').length;
    const counter = document.querySelector('#battle-news-count');
    if (!counter) return;
    if (!count) {
        counter.textContent = '';
        return;
    }
    const lang = document.documentElement.getAttribute('lang') || 'en';
    counter.textContent = lang === 'ar' ? `${count} حدث` : `${count} ${count === 1 ? 'event' : 'events'}`;
}

function resetBattleNews() {
    battleNewsText.replaceChildren();
    const emptyMessage = document.createElement('li');
    emptyMessage.className = 'news-empty';
    emptyMessage.textContent = battleText('defaultMessage', 'Select a card or execute a command to start your turn.');
    battleNewsText.appendChild(emptyMessage);
    updateBattleNewsCount();
}

function updateBattleNews(newMessage, type = 'info') {
    newMessage = localizeBattleNews(newMessage);
    battleNewsText.querySelector('.news-empty')?.remove();
    const entry = document.createElement('li');
    const eventType = ['info', 'success', 'danger'].includes(type) ? type : 'info';
    entry.className = `news-content ${eventType}`;
    entry.textContent = newMessage;
    battleNewsText.appendChild(entry);
    const entries = battleNewsText.querySelectorAll('.news-content');
    if (entries.length > 200) entries[0].remove();
    battleNewsText.scrollTop = battleNewsText.scrollHeight;
    updateBattleNewsCount();
}

const battleCards = {
    light: [
        { id: 'falcon', image: 'assets/images/cards/Good/falcon.png', name: 'Fierce Falcon', cost: 2, health: 10, attack: 3 },
        { id: 'light-healer', image: 'assets/images/cards/Good/light-healer.png', name: 'Light Healer', cost: 2, health: 14, attack: 1 },
        { id: 'cunning-trader', image: 'assets/images/cards/Good/cunning-trader.png', name: 'Cunning Trader', cost: 3, health: 8, attack: 6 },
        { id: 'vault-guardian', image: 'assets/images/cards/Good/vault-guardian.png', name: 'Vault Guardian', cost: 4, health: 13, attack: 8 },
        { id: 'light-shield', image: 'assets/images/cards/Good/light-shield.png', name: 'Light Shield', cost: 7, health: 7, attack: 4 },
        { id: 'sword-of-justice', image: 'assets/images/cards/Good/sword-of-justice.png', name: 'Sword of Justice', cost: 5, health: 11, attack: 9 }
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

function updateHandToggleLabel() {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const isFanned = battleHand?.classList.contains('is-fanned');
    if (!handToggle) return;
    handToggle.setAttribute('aria-pressed', String(Boolean(isFanned)));
    handToggle.setAttribute('aria-label', lang === 'ar'
        ? (isFanned ? 'طي كروت اليد' : 'فرد كروت اليد')
        : (isFanned ? 'Fold hand cards' : 'Fan hand cards'));
    handToggle.title = lang === 'ar'
        ? (isFanned ? 'طي كروت اليد' : 'فرد كروت اليد')
        : (isFanned ? 'Fold hand cards' : 'Fan hand cards');
}

function toggleHandFanState(forceState) {
    if (!battleHand) return;
    const shouldFan = typeof forceState === 'boolean' ? forceState : !battleHand.classList.contains('is-fanned');
    battleHand.classList.toggle('is-fanned', shouldFan);
    handToggle?.classList.toggle('is-fanned', shouldFan);
    updateHandToggleLabel();
}

function renderBattleHand(team) {
    clearHandSelection();
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang];
    const teamCards = t.cards[team];
    
    battleHand.setAttribute('aria-label', `${lang === 'ar' ? 'كروت فريق' : 'Cards of'} ${team === 'dark' ? (lang === 'ar' ? 'الظلام' : 'Dark') : (lang === 'ar' ? 'النور' : 'Light')}`);
    
    battleHand.innerHTML = battleCards[team].map((card, cardIndex) => {
        const displayCost = getDropCost(team, card);
        const cardInfo = teamCards[cardIndex] || {
            name: getCardDisplayName(card, team),
            description: getLocalizedCardDescription(card)
        };
        const spreadAngle = battleCards[team].length <= 1 ? 0 : ((cardIndex - ((battleCards[team].length - 1) / 2)) * 5);
        return `
        <article class="battle-card" draggable="true" data-card-index="${cardIndex}" tabindex="0" style="--card-angle:${spreadAngle}deg;" aria-label="${cardInfo.name}: ${lang === 'ar' ? 'التكلفة' : 'Cost'} ${displayCost}, ${lang === 'ar' ? 'الحياة' : 'Health'} ${card.health}, ${lang === 'ar' ? 'القوة الهجومية' : 'Attack Power'} ${card.attack}. ${cardInfo.description}">
            <img src="${card.image}" alt="${cardInfo.name}">
            <span class="card-cost">${displayCost}</span>
            <h2>${cardInfo.name}</h2>
            <div class="card-values"><span>❤ <strong>${card.health}</strong></span><span>⚔ <strong>${card.attack}</strong></span></div>
            <button class="card-info-button" type="button" data-card-name="${card.id}" data-card-cost="${displayCost}" data-card-health="${card.health}" data-card-attack="${card.attack}" data-card-description="${cardInfo.description}" data-card-image="${card.image}">?</button>
            <div class="card-tooltip" role="tooltip">
                <strong>${cardInfo.name}</strong>
                <span>${lang === 'ar' ? 'التكلفة' : 'Cost'}: ${displayCost}</span>
                <span>${lang === 'ar' ? 'الحياة' : 'Health'}: ${card.health}</span>
                <span>${lang === 'ar' ? 'القوة الهجومية' : 'Attack Power'}: ${card.attack}</span>
                <p>${cardInfo.description}</p>
            </div>
        </article>
    `}).join('');
    setTurnLockState();
    updateHandToggleLabel();
}

function renderHandModal(team) {
    if (!handModalContent) return;
    
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang];
    const teamCards = t.cards[team];
    
    handModalContent.innerHTML = battleCards[team].map((card, cardIndex) => {
        const displayCost = getDropCost(team, card);
        const cardInfo = teamCards[cardIndex] || {
            name: getCardDisplayName(card, team),
            description: getLocalizedCardDescription(card)
        };
        return `
        <article class="battle-card" draggable="true" data-card-index="${cardIndex}" tabindex="0" aria-label="${cardInfo.name}: ${lang === 'ar' ? 'التكلفة' : 'Cost'} ${displayCost}, ${lang === 'ar' ? 'الحياة' : 'Health'} ${card.health}, ${lang === 'ar' ? 'القوة الهجومية' : 'Attack Power'} ${card.attack}. ${cardInfo.description}">
            <img src="${card.image}" alt="${cardInfo.name}">
            <span class="card-cost">${displayCost}</span>
            <h2>${cardInfo.name}</h2>
            <div class="card-values"><span>❤ <strong>${card.health}</strong></span><span>⚔ <strong>${card.attack}</strong></span></div>
            <button class="card-info-button" type="button" data-card-name="${card.id}" data-card-cost="${displayCost}" data-card-health="${card.health}" data-card-attack="${card.attack}" data-card-description="${cardInfo.description}" data-card-image="${card.image}">?</button>
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
            const cardInfo = getTranslatedCardInfo(cardId, team);
            const translatedName = cardInfo?.name || (card.isBankCard ? getTranslatedBankCardName(card.name) : card.name);
            const translatedDescription = getLocalizedCardDescription(card, cardInfo);
            
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
            const cardInfo = getTranslatedCardInfo(cardId, opponentTeam);
            const translatedName = cardInfo?.name || (card.isBankCard ? getTranslatedBankCardName(card.name) : card.name);
            
            slot.innerHTML = `
                <img class="deployed-card-image" src="${cardImage}" alt="${translatedName}">
                <span class="deployed-card-name">${translatedName}</span>
                <div class="deployed-card-stats">
                    <span class="deployed-card-health">❤ <strong>${cardHealth}</strong></span>
                    <span class="deployed-card-attack">⚔ <strong>${cardAttack}</strong></span>
                </div>
                <button class="card-info-button" type="button" data-card-name="${translatedName}" data-card-cost="${card.cost}" data-card-health="${cardHealth}" data-card-attack="${cardAttack}" data-card-description="${getLocalizedCardDescription(card, cardInfo)}" data-card-image="${cardImage}">?</button>
            `;
        }
    });
}

function deployedCardMarkup(card, canAttack = true, isPlayerCard = true) {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const team = battleScreen.dataset.selectedTeam || 'light';
    const cardInfo = getTranslatedCardInfo(card.id, team);
    
    const cardName = cardInfo?.name || (card.isBankCard ? getTranslatedBankCardName(card.name) : card.name);
    const cardDescription = getLocalizedCardDescription(card, cardInfo);
    
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
        button.title = isBlocked ? battleText('attackBlockedBySilent', 'This card is blocked by Silent Neighbor and cannot attack this turn.') : '';
        if (isBlocked) {
            button.setAttribute('aria-label', `${button.dataset.cardName}: ${button.title}`);
        } else {
            button.removeAttribute('aria-label');
        }
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

        // تقليل مدة المنع
        const currentDuration = tempEffects.blockDuration.get(key) || 1;
        const newDuration = currentDuration - 1;

        if (newDuration <= 0) {
            // انتهت مدة المنع، إزالة الكرت من القائمة
            tempEffects.blockedCards.delete(key);
            tempEffects.silencedBy.delete(key);
            tempEffects.blockDuration.delete(key);
            cleared += 1;
        } else {
            // تقليل المدة
            tempEffects.blockDuration.set(key, newDuration);
        }
    });

    [...playerDropSlots, ...computerDropSlots].forEach((slot) => {
        if (!isSlotBlocked(slot)) slot.classList.remove('blocked-card');
    });

    if (cleared > 0) updateBattleNews('انتهت تأثيرات المنع، الكروت يمكنها الهجوم من جديد.');
}

function clearBlocksAppliedBy(silencerKey) {
    let cleared = 0;
    [...tempEffects.silencedBy.entries()].forEach(([blockedKey, sourceKey]) => {
        if (sourceKey !== silencerKey) return;
        tempEffects.blockedCards.delete(blockedKey);
        tempEffects.silencedBy.delete(blockedKey);
        tempEffects.blockDuration.delete(blockedKey);
        const blockedSlot = [...playerDropSlots, ...computerDropSlots]
            .find((slot) => getBlockKey(slot) === blockedKey);
        blockedSlot?.classList.remove('blocked-card');
        cleared += 1;
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
        ? battleText('goldToHealthNeedHealer', 'Summon the Light Healer first to exchange gold for health.')
        : battleText('goldToHealthTooltip', 'Exchange 3 gold for 6 health.');
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
        ? battleText('healthToGoldLowHealth', 'You cannot sacrifice when the leader has 2 health or less.')
        : (healthToGoldUsed[team]
            ? battleText('healthToGoldAlreadyUsed', 'This exchange has already been used this round.')
            : battleText('healthToGoldTooltip', 'Exchange 2 leader health for 5 gold.'));
}

function checkEconomicVictory(tieBreakerTeam = null) {
    if (isGameOver) return;
    const lightReached = playerStats.lightTeam.gold >= ECONOMIC_VICTORY_GOLD;
    const darkReached = playerStats.darkTeam.gold >= ECONOMIC_VICTORY_GOLD;
    const winner = lightReached && darkReached
        ? tieBreakerTeam
        : (lightReached ? 'light' : darkReached ? 'dark' : null);
    if (!winner) return;

    const winnerName = winner === 'light' ? 'النور' : 'الظلام';
    const winnerGold = playerStats[winner === 'dark' ? 'darkTeam' : 'lightTeam'].gold;
    isGameOver = true;
    isPlayerTurn = false;
    endTurnButton.hidden = true;
    showVictoryModal(winner, 'economic');
    updateBattleNews(`حقق فريق ${winnerName} النصر الاقتصادي بعد وصول رصيده إلى ${winnerGold} قطعة ذهب!`, 'success');
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang];
    setTurnIndicatorMessage(t.selection.economicVictory);
}

function renderPlayerStats(tieBreakerTeam = null, deferVictoryCheck = false) {
    document.querySelector('#light-health').textContent = playerStats.lightTeam.health;
    document.querySelector('#dark-health').textContent = playerStats.darkTeam.health;
    document.querySelector('#light-gold').textContent = playerStats.lightTeam.gold;
    document.querySelector('#dark-gold').textContent = playerStats.darkTeam.gold;
    updateGoldToHealthButton();
    updateHealthToGoldButton();
    if (!deferVictoryCheck) checkEconomicVictory(tieBreakerTeam);
}

function removeSilentNeighborsForResurrect(team) {
    const opponentTeam = team === 'dark' ? 'light' : 'dark';
    [...getTeamSlots(opponentTeam)].forEach((slot) => {
        if (!slot.classList.contains('occupied-slot') || slot.dataset.cardName !== 'silent-neighbor') return;
        removeDefeatedCard(slot, opponentTeam, team);
        if (opponentTeam === battleScreen.dataset.selectedTeam) {
            deployedCardCount = Math.max(0, deployedCardCount - 1);
        }
        const message = battleText(
            'resurrectDestroysSilent',
            '{resurrect} destroyed {silent} without taking damage.'
        );
        updateBattleNews(message
            .replace('{resurrect}', getTranslatedBankCardName('بعث الارواح'))
            .replace('{silent}', getTranslatedCardName('silent-neighbor', opponentTeam)));
    });
}

function applyBankRoundEffects(tieBreakerTeam = null) {
    const effectAmounts = { bankruptcy: 2, tax: 1 };
    ['light', 'dark'].forEach((team) => {
        const opponentTeam = team === 'dark' ? 'light' : 'dark';
        const effects = [...getTeamSlots(team)].filter((slot) =>
            slot.classList.contains('occupied-slot') && effectAmounts[getBankCardRuleKey(slot.dataset.cardName)]
        );
        if (effects.length === 0) return;

        const opponentHasVaultGuardian = [...getTeamSlots(opponentTeam)].some((slot) =>
            slot.classList.contains('occupied-slot') && slot.dataset.cardName === 'vault-guardian'
        );
        const opponentStats = playerStats[opponentTeam === 'dark' ? 'darkTeam' : 'lightTeam'];
        const opponentName = battleText(opponentTeam === 'dark' ? 'darkTeam' : 'lightTeam', opponentTeam);

        if (opponentHasVaultGuardian) {
            const prevented = effects.reduce((total, slot) =>
                total + effectAmounts[getBankCardRuleKey(slot.dataset.cardName)], 0);
            updateBattleNews(battleText(
                'vaultGuardianPreventedDrain',
                '{guardian} protected {team} and prevented {amount} gold from being drained this round.'
            ).replace('{guardian}', getTranslatedCardName('vault-guardian', opponentTeam))
                .replace('{team}', opponentName)
                .replace('{amount}', prevented));
            return;
        }

        effects.forEach((slot) => {
            const effect = getBankCardRuleKey(slot.dataset.cardName);
            const amount = effectAmounts[effect];
            const lost = Math.min(opponentStats.gold, amount);
            opponentStats.gold -= lost;
            if (lost === 0) return;
            const cardName = getTranslatedBankCardName(slot.dataset.cardName.replace(/^bank:/i, ''));
            updateBattleNews(battleText(
                'bankRoundDrain',
                '{card} made {team} lose {amount} gold this round.'
            ).replace('{card}', cardName).replace('{team}', opponentName).replace('{amount}', lost));
        });
    });
    renderPlayerStats(tieBreakerTeam, true);
}

function showInsufficientGoldMessage(card, currentGold) {
    insufficientGoldContext = { card, currentGold };
    insufficientGoldModal.classList.remove('screen-hidden');
    refreshInsufficientGoldMessage();
    window.clearTimeout(insufficientGoldTimer);
    insufficientGoldTimer = window.setTimeout(hideInsufficientGoldMessage, 3000);
    closeInsufficientGold.focus();
}

function refreshInsufficientGoldMessage() {
    if (!insufficientGoldContext || insufficientGoldModal.classList.contains('screen-hidden')) return;
    const { card, currentGold } = insufficientGoldContext;
    const team = battleScreen.dataset.selectedTeam || 'light';
    const translatedName = card.isBankCard
        ? getTranslatedBankCardName(card.name)
        : getTranslatedCardName(card.id, team) || card.name;
    insufficientGoldMessage.textContent = battleText('insufficientGoldDeploy', 'You need {cost} gold to deploy {card}, but you currently have {gold} gold.')
        .replace('{cost}', card.cost)
        .replace('{card}', translatedName)
        .replace('{gold}', currentGold);
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
    const fallback = isPlayerTurn ? `Round ${battlePhase} - Your Turn` : `Round ${battlePhase} - Opponent's Turn`;
    setTurnIndicatorMessage(battleText(key, fallback).replace('{phase}', battlePhase));
}

// الخادم يخبر الطرفين بصاحب الدور. تقدّم الجولة والذهب لا يحدثان هنا،
// بل عند إنهاء اللاعب الثاني لدوره ثم يصلان للخصم ضمن الحالة المتزامنة.
function lockBattleAfterGameOver() {
    clearPlayerTurnTimer();
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

function checkEmptyArenaDefeat(team) {
    const playerTeam = battleScreen.dataset.selectedTeam;
    const teamSlots = team === playerTeam ? playerDropSlots : computerDropSlots;
    if ([...teamSlots].some((slot) => slot.classList.contains('occupied-slot'))) return false;

    const winner = team === 'light' ? 'dark' : 'light';
    const teamName = battleText(team === 'light' ? 'lightTeam' : 'darkTeam', team === 'light' ? 'Light Team' : 'Dark Team');
    lockBattleAfterGameOver();
    updateBattleNews(battleText('news.emptyArenaLoss', 'The {team} team lost because its battlefield was empty when its turn ended.')
        .replace('{team}', teamName), 'danger');
    showVictoryModal(winner);
    return true;
}

function getBankCardId(name) {
    return `bank:${name}`;
}

function isCardInPlayerField(cardId) {
    return [...playerDropSlots].some((slot) => slot.classList.contains('occupied-slot') && slot.dataset.cardName === cardId);
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
        .find((element) => element.dataset.bankName === name || getBankCardId(element.dataset.bankName) === name);
    if (bankElement) {
        const translatedName = getTranslatedBankCardName(bankElement.dataset.bankName);
        return {
            id: getBankCardId(bankElement.dataset.bankName),
            image: bankElement.querySelector('img').getAttribute('src'),
            name: translatedName,
            cost: 1,
            health: Number(bankElement.dataset.cardHealth),
            attack: Number(bankElement.dataset.cardAttack),
            description: getBankCardDescription(bankElement.dataset.bankName),
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

function hasEnoughGold(team, neededGold) {
    const statsKey = team === 'dark' ? 'darkTeam' : 'lightTeam';
    const stats = playerStats[statsKey];
    return stats.gold >= neededGold;
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
    const translatedName = getTranslatedBankCardName(cardName);
    const playerTeam = battleScreen.dataset.selectedTeam;
    const stats = playerStats[battleScreen.dataset.selectedTeam === 'dark' ? 'darkTeam' : 'lightTeam'];

    if (bankSoldCardNames.has(normalizeBankCardName(cardName))) {
        updateBattleNews(`هذا الكرت تم شراؤه بالفعل من البنك، ولا يمكن شراء نسخة ثانية منه حتى يعود للبانك.`);
        return;
    }

    if (!hasEnoughGold(playerTeam, cost)) {
        showInsufficientGoldMessage({ name: translatedName, cost }, stats.gold);
        return;
    }

    stats.gold -= cost;
    if (bankCard.dataset.bankAction === 'lottery') {
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang];
        const lotteryOutcomes = lang === 'ar' ? [
            { gold: 0, message: 'لم تكسب ولم تخسر شيئًا.' },
            { gold: 10, message: 'مبروك! كسبت 10 ذهبات.' },
            { gold: -5, message: 'للأسف! خسرت 5 ذهبات.' }
        ] : [
            { gold: 0, message: 'You neither won nor lost anything.' },
            { gold: 10, message: 'Congratulations! You won 10 gold.' },
            { gold: -5, message: 'Unfortunately! You lost 5 gold.' }
        ];
        const outcome = lotteryOutcomes[Math.floor(Math.random() * lotteryOutcomes.length)];
        stats.gold = Math.max(0, stats.gold + outcome.gold);
        turnActions.player = true;
        renderPlayerStats(playerTeam);
        const lotteryMessage = lang === 'ar' 
            ? `اشتريت ${translatedName} مقابل ${cost} ذهب. نتيجة القرعة: ${outcome.message}`
            : `Bought ${translatedName} for ${cost} gold. Lottery result: ${outcome.message}`;
        updateBattleNews(lotteryMessage);
        notifyStateChange();
        return;
    }

    const cardId = getBankCardId(cardName);
    if (!isCardInPlayerField(cardId)) deployedCardNames[playerTeam].delete(cardId);
    const purchasedCard = {
        id: cardId,
        image: bankCard.querySelector('img').getAttribute('src'),
        name: cardName,
        cost: DISCOUNTED_DROP_COST, // إنزال كروت البنك يكلّف 1 ذهب
        health: Number(bankCard.dataset.cardHealth),
        attack: Number(bankCard.dataset.cardAttack),
        description: getBankCardDescription(cardName),
        isBankCard: true
    };
    
    battleCards[playerTeam].push(purchasedCard);
    addCardToHand(purchasedCard);
    markBankCardSold(cardName);
    turnActions.player = true;
    renderPlayerStats();
    bankCard.classList.add('bank-card-purchased');
    bankCard.setAttribute('aria-label', `تم شراء ${translatedName}`);
    const purchaseMessage = `تم شراء ${translatedName} من البنك مقابل ${cost} ذهب وأضيف إلى يدك.`;
    updateBattleNews(purchaseMessage, 'success');
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

    renderPlayerStats(team);
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
    clearPlayerTurnTimer();
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
    bankSoldCardNames.clear();
    syncBankCardAvailability();
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
    battleRoundNumber = 1;
    isGameOver = false;

    // إعادة تعيين التأثيرات المؤقتة
    tempEffects.blockedCards.clear();
    tempEffects.silencedBy.clear();

    updateBankControls();
    renderPlayerStats();
    resetBattleNews();
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

    if (!card) {
        updateBattleNews(battleText('news.invalidCard', 'This card is invalid.'));
        return false;
    }

    // التحقق فقط مما إذا كان الكرت موجود فعلياً في الساحة
    if (isCardInPlayerField(card.id)) {
        updateBattleNews(battleText('news.duplicateCard', 'A card of this type is already on the battlefield.'));
        return false;
    }

    if (!canDeployCard(team, card.id)) {
        updateBattleNews(battleText(
            'silentBlockedByResurrect',
            'The Silent Neighbor cannot be deployed while the opponent has Resurrect on the battlefield.'
        ));
        return false;
    }

    if (cardsDeployedThisTurn >= 2) {
        updateBattleNews(battleText('news.tooManyCards', 'You cannot deploy a third card in the same turn. Wait until the next round.'));
        return false;
    }

    const dropCost = getDropCost(team, card);
    if (dropCost > stats.gold) {
        if (!hasEnoughGold(team, dropCost)) {
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
    if (getBankCardRuleKey(card.id) === 'resurrect') removeSilentNeighborsForResurrect(team);
    battleHand.querySelector(`[data-card-index="${cardIndex}"]`)?.remove();
    renderPlayerStats();
    updateGoldToHealthButton();
    endTurnButton.hidden = !isPlayerTurn || isGameOver;
    updateAttackButtons();
    notifyStateChange();
    const translatedName = getTranslatedCardName(card.id, team);
    updateBattleNews(battleText('news.cardDeployed', 'Deployed {card} and spent {cost} gold.')
        .replace('{card}', translatedName)
        .replace('{cost}', dropCost), 'success');
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
function advanceBattlePhase({ clearBlocks = true, tieBreakerTeam = null } = {}) {
    const previousPhase = battlePhase;
    const nextPhase = Math.min(previousPhase + 1, 5);
    const phaseIncome = nextPhase > previousPhase ? (phaseGoldIncome[nextPhase] || 0) : 0;

    battlePhase = nextPhase;
    battleRoundNumber += 1;
    if (clearBlocks) clearBlockedCards();

    if (phaseIncome > 0) {
        playerStats.lightTeam.gold += phaseIncome;
        playerStats.darkTeam.gold += phaseIncome;
    }
    const traderIncome = {};
    ['light', 'dark'].forEach((team) => {
        const traderCount = [...getTeamSlots(team)].filter((slot) =>
            slot.classList.contains('occupied-slot') && slot.dataset.cardName === 'cunning-trader'
        ).length;
        if (traderCount === 0) return;
        playerStats[team === 'dark' ? 'darkTeam' : 'lightTeam'].gold += traderCount;
        traderIncome[team] = traderCount;
    });
    updateBattleNews(phaseIncome > 0
        ? battleText('news.phaseIncome', 'Round {phase}: each team received {income} gold.')
            .replace('{phase}', battlePhase)
            .replace('{income}', phaseIncome)
        : battleText('news.phaseNoIncome', 'Round {phase}: no additional round income was distributed.')
            .replace('{phase}', battlePhase));
    Object.entries(traderIncome).forEach(([team, amount]) => {
        updateBattleNews(battleText('traderIncome', '{card} generated +{amount} gold for {team} this round.')
            .replace('{card}', getTranslatedCardName('cunning-trader', team))
            .replace('{amount}', amount)
            .replace('{team}', battleText(team === 'dark' ? 'darkTeam' : 'lightTeam', team)));
    });
    applyBankRoundEffects(tieBreakerTeam);
    renderPlayerStats(tieBreakerTeam);

    healthToGoldUsed.light = false;
    healthToGoldUsed.dark = false;
    resetAttackAvailability();
    updateAttackButtons();
    updateBankControls();

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
        .some((card) => !card.hidden && !card.disabled && Number(card.dataset.bankCost) <= stats.gold);
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

function endPlayerTurn(automatic = false) {
    if (!isPlayerTurn || isGameOver) return;
    // قاعدة اللعبة: لا يُسمح بإنهاء الدور دون أي حدث (إلا إذا لم تتوفر أي حركة أصلاً)
    if (!automatic && !turnActions.player && !turnHasNoAvailableMoves) {
        showTurnConfirmModal();
        return;
    }
    clearPlayerTurnTimer();
    if (checkEmptyArenaDefeat(battleScreen.dataset.selectedTeam)) return;
    if (automatic) turnConfirmModal.classList.add('screen-hidden');
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

function showBattleScreen(team, startsWithPlayer = true, turnDurationMs = getSelectedTurnDurationMs()) {
    selectionScreen.hidden = true;
    selectionScreen.classList.add('screen-hidden');
    battleScreen.hidden = false;
    battleScreen.classList.remove('screen-hidden');
    languageToggle.disabled = true;
    battleScreen.dataset.selectedTeam = team;
    setGameTurnDurationMs(turnDurationMs);
    resetBattleResources(startsWithPlayer);
    setTurnIndicatorMessage(startsWithPlayer ? battleText('turn', 'Your Turn') : (document.documentElement.lang === 'ar' ? 'انتظار دور الخصم' : 'Waiting for opponent'));
    lightPlayerBanner.classList.toggle('active-player', team === 'light' && startsWithPlayer);
    darkPlayerBanner.classList.toggle('active-player', team === 'dark' && startsWithPlayer);
    renderBattleHand(team);
    renderLeaders(team);
    endTurnButton.textContent = battleText('endTurn', 'End Turn');
    setTurnLockState();
    const joinMessage = battleText(team === 'dark' ? 'joinDark' : 'joinLight', team === 'dark'
        ? 'You joined the Dark Team. Deploy a card and begin the attack.'
        : 'You joined the Light Team. Deploy a card and begin the attack.');
    battleNewsText.replaceChildren();
    updateBattleNews(joinMessage);
    startPlayerTurnTimer();
}

// الخروج من المعركة إلى الشاشة الرئيسية للوضع الحالي (القائمة أو اختيار الفريق)
function showSelectionScreen() {
    clearPlayerTurnTimer();
    if (activeMode && activeMode.leaveMatch) activeMode.leaveMatch();
    battleScreen.hidden = true;
    battleScreen.classList.add('screen-hidden');
    languageToggle.disabled = false;
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

    // تحديد مدة المنع:
    // في وضع تحدي الكمبيوتر: اللاعب يبدأ دائماً، يلعب أولاً، المنع لجولة واحدة فقط
    // في وضع الأونلاين:
    //   - إذا كان اللاعب يبدأ المباراة، يلعب أولاً، المنع لجولتين (يؤثر على دور الخصم + دور اللاعب القادم)
    //   - إذا كان الخصم يبدأ المباراة، اللاعب يلعب ثانياً، المنع لجولة واحدة فقط
    let blockDuration = 1; // الافتراضي لجولة واحدة
    if (activeMode && activeMode.id === 'online') {
        const playerStarted = battleScreen.dataset.selectedTeam === 'light';
        blockDuration = playerStarted ? 2 : 1;
    }

    tempEffects.blockedCards.add(blockedKey);
    tempEffects.silencedBy.set(blockedKey, getBlockKey(silentNeighborSlot));
    tempEffects.blockDuration.set(blockedKey, blockDuration);
    targetSlot.classList.add('blocked-card');

    turnActions.player = true;
    const targetTeam = getSlotTeam(targetSlot);
    const translatedName = getTranslatedCardName(targetSlot.dataset.cardName, targetTeam);
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const durationText = lang === 'ar' ? `لـ ${blockDuration} جولات` : `for ${blockDuration} turn${blockDuration > 1 ? 's' : ''}`;
    updateBattleNews(`الجار الصامت منع ${translatedName} من الهجوم ${durationText}.`);
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
        ? availableCards.map((card, index) => {
            const translatedName = getTranslatedCardName(card.id, card.team);
            return `
            <button type="button" class="bank-card graveyard-bank-card" data-graveyard-index="${graveyardCards.indexOf(card)}">
                <img src="${card.image}" alt="${translatedName}">
                <span>${translatedName}</span>
                <small>شراء: ◉ ${card.cost}</small>
            </button>
        `;
        }).join('')
        : '<p class="empty-graveyard-shop">لا توجد كروت من فريقك في المقبرة.</p>';
}

function addCardToHand(card) {
    const teamCards = battleCards[battleScreen.dataset.selectedTeam];
    let cardIndex = teamCards.indexOf(card);
    if (cardIndex === -1) cardIndex = teamCards.findIndex((item) => item.id === card.id);
    const translatedName = getCardDisplayName(card, battleScreen.dataset.selectedTeam);
    const cardElement = document.createElement('article');
    cardElement.className = 'battle-card';
    cardElement.draggable = true;
    cardElement.tabIndex = 0;
    cardElement.dataset.cardIndex = cardIndex;
    cardElement.setAttribute('aria-label', `${translatedName}: التكلفة ${card.cost}، الحياة ${card.health}، القوة الهجومية ${card.attack}. ${card.description}`);
    cardElement.innerHTML = `
        <img src="${card.image}" alt="${translatedName}">
        <span class="card-cost">${card.cost}</span>
        <h2>${translatedName}</h2>
        <div class="card-values"><span>❤ <strong>${card.health}</strong></span><span>⚔ <strong>${card.attack}</strong></span></div>
        <button class="card-info-button" type="button" data-card-name="${translatedName}" data-card-cost="${card.cost}" data-card-health="${card.health}" data-card-attack="${card.attack}" data-card-description="${card.description}" data-card-image="${card.image}">?</button>
        <div class="card-tooltip" role="tooltip"><strong>${translatedName}</strong><span>التكلفة: ${card.cost}</span><span>الحياة: ${card.health}</span><span>القوة الهجومية: ${card.attack}</span><p>${card.description}</p></div>
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
    // درع القائد يحمي قائد الفريق الذي ينتمي إليه طالما هو موجود في الساحة
    const targetSlots = team === battleScreen.dataset.selectedTeam ? playerDropSlots : computerDropSlots;
    const hasLeaderShield = [...targetSlots].some((slot) =>
        slot.classList.contains('occupied-slot') && isLeaderShieldCard(slot.dataset.cardName)
    );

    if (hasLeaderShield) {
        updateBattleNews('درع القائد يحمي قائد الفريق من الضرر!');
        return false;
    }
    
    const statsKey = team === 'dark' ? 'darkTeam' : 'lightTeam';
    playerStats[statsKey].health = Math.max(0, playerStats[statsKey].health - 5);
    renderPlayerStats(null, true);
    renderLeaderInSlot(team === battleScreen.dataset.selectedTeam ? leaderSlot : computerLeaderSlot, team);
    if (playerStats[statsKey].health === 0 && announceResult) {
        isGameOver = true;
        isPlayerTurn = false;
        endTurnButton.hidden = true;
        hideAttackModal();
        updateAttackButtons();
        const winner = team === battleScreen.dataset.selectedTeam ? 'الخصم' : 'فريقك';
        showVictoryModal(team === 'dark' ? 'light' : 'dark');
        updateBattleNews(`خسر قائد فريق ${team === 'dark' ? 'الظلام' : 'النور'} جميع نقاط حياته. ${winner} فاز بالمباراة!`, 'danger');
        setTurnIndicatorMessage('انتهت المباراة');
        return true;
    }
    return false;
}

function removeDefeatedCard(slot, team, attackingTeam, announceResult = true) {
    const cardName = slot.dataset.cardName;
    clearBlocksAppliedBy(getBlockKey(slot));
    if (String(cardName || '').startsWith('bank:')) {
        releaseBankCard(cardName.replace(/^bank:/, ''));
    }

    // إذا توفي درع القائد، تنتهي الحماية عن قائد الفريق
    if (isLeaderShieldCard(cardName)) {
        updateBattleNews('مات درع القائد، انتهت الحماية عن القائد.');
    }

    moveCardToGraveyard(slot);
    const leaderDefeated = damageLeader(team, attackingTeam, announceResult);
    deployedCardNames[team].delete(slot.dataset.cardName);
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
        updateBattleNews(battleText('news.invalidAttack', 'This attack cannot be performed: {reason}')
            .replace('{reason}', blockReason));
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
        renderPlayerStats(null, true);
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang];
        const attackingTeamName = attackerTeam === 'dark' ? t.battle.darkTeam : t.battle.lightTeam;
        attackRewardMessage = t.battle.goldReward
            .replace('{team}', attackingTeamName)
            .replace('{target}', targetCardName);
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
        setTurnIndicatorMessage('انتهت المباراة');
    } else {
        checkEconomicVictory(attackerTeam);
    }
    updateGoldToHealthButton();
    if (!leaderDefeated) {
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang];
        const attackerResult = attackerHealth <= 0 ? t.battle.died : t.battle.healthLeft.replace('{health}', Math.max(attackerHealth, 0));
        const targetResult = targetHealth <= 0 ? t.battle.died : t.battle.healthLeft.replace('{health}', Math.max(targetHealth, 0));

        // عرض الأحداث الكاملة مع تفاصيل الهجوم المزدوج
        const fullEventMessage = t.battle.attackResult
            .replaceAll('{attacker}', attackerCardName)
            .replaceAll('{target}', targetCardName)
            .replace('{attackerLoss}', targetAttack)
            .replace('{targetLoss}', attackerAttack)
            .replace('{attackerResult}', attackerResult)
            .replace('{targetResult}', targetResult);

        if (attackRewardMessage) {
            updateBattleNews(fullEventMessage + ' ' + attackRewardMessage);
        } else {
            updateBattleNews(fullEventMessage);
        }
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
    updateBattleNews(`عالجت معالجة النور ${targetName} وأضافت ${restoredHealth} حياة، وخسرت نقطتين من حياتها.`, 'success');
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
        : (isSlotBlocked(attackerSlot)
            ? battleText('attackBlockedBySilent', 'This card is blocked by Silent Neighbor and cannot attack this turn.')
            : battleText('noAttackTargets', 'There are no cards that can be attacked now.'));
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

endTurnButton.addEventListener('click', () => endPlayerTurn());
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
    if (!hasEnoughGold(playerTeam, card.cost)) {
        updateBattleNews(`ليس لديك مال كافٍ لشراء ${translatedName}. تحتاج إلى ${card.cost} ذهب.`, 'danger');
        return;
    }
    
    const purchaseCost = card.cost;
    stats.gold -= purchaseCost;

    // بعد الشراء من المقبرة يكلّف إنزال الكرت 1 ذهب فقط
    dropDiscount[playerTeam].add(card.id);
    card.cost = DISCOUNTED_DROP_COST;   // ليظهر على كرت اليد
    
    // إضافة الكرت إلى اليد
    addCardToHand(card);
    if (!isCardInPlayerField(card.id)) deployedCardNames[playerTeam].delete(card.id);
    card.element?.remove();
    graveyardCards.splice(cardIndex, 1);
    renderGraveyardBankCards();
    updateGraveyardBadge();
    renderPlayerStats(playerTeam);
    turnActions.player = true;
    updateBattleNews(`تم شراء ${translatedName} من المقبرة مقابل ${purchaseCost} ذهب، وإنزاله سيكلّف 1 ذهب فقط.`, 'success');
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
handToggle.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 640px), (max-height: 480px) and (orientation: landscape)').matches) {
        if (handModal.classList.contains('screen-hidden')) {
            showHandModal();
        } else {
            hideHandModal();
        }
        return;
    }

    toggleHandFanState();
});
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
