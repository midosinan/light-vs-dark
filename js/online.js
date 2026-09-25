// =============================================================================
// وضع "تحدي ناس حقيقيين" (أونلاين)
// هذا الملف هو الوحيد الذي يعرف الـ socket والمزامنة بين اللاعبين. لا يستخدم أي شيء من وضع الكمبيوتر.
// يعتمد على game.js فقط عبر دوالها المعتادة، ويسجّل نفسه كوضع نشط عبر الكائن OnlineMode أسفل الملف.
// =============================================================================

let socket = null;                     // لا يُنشأ الاتصال إلا عند اختيار "تحدي ناس حقيقيين"
let leavingLobby = false;              // نتجاهل رسائل الانقطاع عندما نغادر الأونلاين بإرادتنا
let onlineInMatch = false;             // هل توجد مباراة أونلاين جارية؟
const onlinePlayerList = document.querySelector('#online-player-list');
let currentRoomId = null;
let currentMatchPlayers = [];
let localPlayerName = 'اللاعب';
let localSocketId = null;
let pendingChallengeTarget = null;
let matchFirstTurnId = null;           // اللاعب الذي بدأ أول دور (هو من يحدد بداية كل جولة)
let onlineSeq = 0;                     // ترقيم الرسائل المرسلة
const lastRemoteSeq = {};              // آخر رقم رسالة استُلم من كل مُرسل
let applyingRemoteState = false;       // نمنع إعادة الإرسال أثناء تطبيق حالة قادمة من الخصم
let lobbyListenersAttached = false;


// ربط مستمعات الخادم. تُستدعى مرة واحدة فقط: تكرارها كان سيجعل كل رسالة تُعالَج مرتين
function attachLobbyListeners() {
    if (lobbyListenersAttached || !socket) return;
    lobbyListenersAttached = true;

    // نعيد الانضمام للردهة عند كل اتصال (يشمل إعادة الاتصال بعد الانقطاع)
    socket.on('connect', () => { if (activeMode === OnlineMode) socket.emit('player:join', { name: localPlayerName }); });
    socket.on('connect_error', () => {
        if (activeMode === OnlineMode) onlinePlayerList.innerHTML = '<p class="online-empty-state">الخادم غير متصل الآن. حاول لاحقاً، أو ارجع واختر تحدي الكمبيوتر.</p>';
    });
    socket.on('disconnect', handleSocketDisconnect);

    socket.on('player:session', ({ id, name }) => {
        localSocketId = id;
        localPlayerName = name;
    });
    socket.on('lobby:list', (players) => { if (activeMode === OnlineMode) renderOnlinePlayers(players); });

    socket.on('challenge:incoming', ({ challengerName, roomId, forcedTeam }) => {
        if (activeMode !== OnlineMode || (onlineInMatch && !isGameOver)) return; // لا نقبل تحدياً أثناء مباراة جارية
        const forcedTeamText = forcedTeam === 'light' ? 'فريق النور' : 'فريق الظلام';
        const accept = window.confirm(`هل تريد قبول تحدي ${challengerName}؟\nسيتم تخصيصك تلقائيًا إلى ${forcedTeamText}.`);
        if (accept) socket.emit('challenge:accept', { roomId });
    });
    socket.on('challenge:sent', ({ targetName, selectedTeam }) => {
        updateBattleNews(`تم إرسال تحدي إلى ${targetName}، وقررت اللعب كفريق ${selectedTeam === 'light' ? 'النور' : 'الظلام'}.`);
    });

    socket.on('match:start', (data) => { if (activeMode === OnlineMode) startOnlineMatch(data); });
    socket.on('match:turn', (data) => { if (activeMode === OnlineMode) handleOnlineTurn(data); });
    socket.on('match:action', (payload) => {
        if (activeMode !== OnlineMode || !onlineInMatch) return;
        applyRemoteAction(payload);
    });
    socket.on('match:ended', (data) => { if (activeMode === OnlineMode) handleOnlineMatchEnded(data); });
}

function renderOnlinePlayers(players) {
    if (!onlinePlayerList) return;
    if (!socket || !players) {
        onlinePlayerList.innerHTML = '<p class="online-empty-state">لا يوجد خادم عبر الإنترنت متصل الآن. حاول لاحقاً، أو ارجع واختر تحدي الكمبيوتر.</p>';
        return;
    }
    const visiblePlayers = players.filter((player) => player.id && player.id !== localSocketId);
    if (!visiblePlayers.length) {
        onlinePlayerList.innerHTML = '<p class="online-empty-state">لا يوجد لاعبون متاحون الآن. انتظر قليلاً حتى يظهر لاعب، أو ارجع واختر تحدي الكمبيوتر.</p>';
        return;
    }

    onlinePlayerList.innerHTML = visiblePlayers.map((player) => `
        <div class="online-player-item">
            <span>${escapeHtml(player.name)}</span>
            <button type="button" data-target-id="${escapeHtml(player.id)}">تحدي</button>
        </div>
    `).join('');

    onlinePlayerList.querySelectorAll('button[data-target-id]').forEach((button) => {
        button.addEventListener('click', () => {
            if (!socket) return;
            const targetPlayer = visiblePlayers.find((player) => player.id === button.dataset.targetId);
            if (!targetPlayer) return;
            pendingChallengeTarget = targetPlayer;
            const teamModal = document.querySelector('#challenge-team-modal');
            const teamMessage = document.querySelector('#challenge-team-message');
            if (teamModal && teamMessage) {
                teamMessage.textContent = `اختر الفريق الذي ستلعب به ضد ${targetPlayer.name}. سيتم إجبار الخصم على الفريق الآخر.`;
                teamModal.classList.remove('screen-hidden');
            } else {
                socket.emit('player:challenge', { targetId: targetPlayer.id, team: 'light' });
                updateBattleNews(`تم إرسال تحدي إلى ${targetPlayer.name} كفريق النور.`);
            }
        });
    });
}

function chooseChallengeTeam(team) {
    if (!pendingChallengeTarget || !socket) return;
    socket.emit('player:challenge', { targetId: pendingChallengeTarget.id, team });
    const teamLabel = team === 'light' ? 'النور' : 'الظلام';
    updateBattleNews(`تم إرسال تحدي إلى ${pendingChallengeTarget.name} مع اختيارك لفريق ${teamLabel}.`);
    pendingChallengeTarget = null;
    const teamModal = document.querySelector('#challenge-team-modal');
    if (teamModal) teamModal.classList.add('screen-hidden');
}

function startOnlineMatch({ roomId, players, currentTurnId }) {
    currentRoomId = roomId;
    currentMatchPlayers = players || [];
    // أي بداية مباراة قادمة من الخادم هي مباراة أونلاين، مهما كانت قيمة mode المرسلة
    onlineInMatch = true;
    matchFirstTurnId = currentTurnId;
    onlineSeq = 0;
    Object.keys(lastRemoteSeq).forEach((key) => delete lastRemoteSeq[key]);

    const yourPlayer = currentMatchPlayers.find((player) => player.id === socket.id);
    const selectedTeam = yourPlayer?.team === 'dark' || yourPlayer?.team === 'light'
        ? yourPlayer.team
        : (battleScreen.dataset.selectedTeam || 'light');
    const startsWithPlayer = socket.id === currentTurnId;

    showBattleScreen(selectedTeam, startsWithPlayer);
    updateTurnIndicator();
    const opponentName = currentMatchPlayers.find((player) => player.id !== socket.id)?.name || 'الخصم';
    updateBattleNews(`بدأت مباراة عبر الإنترنت ضد ${opponentName}.`);
}

function handleOnlineTurn({ currentTurnId }) {
    if (!onlineInMatch || isGameOver) return;
    const wasPlayerTurn = isPlayerTurn;
    isPlayerTurn = socket.id === currentTurnId;
    if (isPlayerTurn) {
        turnActions.player = false;
        turnHasNoAvailableMoves = false;
        resetAttackAvailability();
    }
    setTurnLockState();
    updateAttackButtons();
    updateBankControls();
    endTurnButton.hidden = !isPlayerTurn;
    endTurnButton.textContent = 'إنهاء الدور';
    updateTurnIndicator();
    if (isPlayerTurn) {
        updateBattleNews(`بدأ دورك الآن (المرحلة ${battlePhase}).`);
        forceWithdrawalIfNoPlayerEvent();
    } else if (wasPlayerTurn) {
        updateBattleNews('دور الخصم الآن.');
    }
}

function handleOnlineMatchEnded({ reason } = {}) {
    const wasOnline = onlineInMatch;
    currentRoomId = null;
    onlineInMatch = false;
    if (!wasOnline || isGameOver) return;
    if (reason === 'opponent-left') {
        lockBattleAfterGameOver();
        document.querySelector('.turn-indicator').textContent = 'انتهت المباراة';
        updateBattleNews('انقطع اتصال الخصم، وتم احتساب المباراة لصالحك.');
        showVictoryModal(battleScreen.dataset.selectedTeam);
    }
}

function handleSocketDisconnect() {
    if (leavingLobby) return;          // خروج مقصود من الأونلاين، لا داعي لرسائل الخطأ
    if (onlinePlayerList) {
        onlinePlayerList.innerHTML = '<p class="online-empty-state">انقطع الاتصال بالخادم. جارٍ محاولة إعادة الاتصال...</p>';
    }
    if (!onlineInMatch) return;
    currentRoomId = null;
    onlineInMatch = false;
    if (isGameOver) return;
    lockBattleAfterGameOver();
    document.querySelector('.turn-indicator').textContent = 'انقطع الاتصال';
    updateBattleNews('انقطع اتصالك بالخادم فانتهت المباراة. اضغط زر العودة للرجوع إلى الشاشة الرئيسية.');
}

function leaveOnlineMatch() {
    // الخادم يفهم الحدث 'match:ended' فقط: يبلّغ الطرفين ويحذف الغرفة
    if (onlineInMatch && currentRoomId && socket) {
        socket.emit('match:ended', { roomId: currentRoomId, reason: isGameOver ? 'finished' : 'opponent-left' });
    }
    currentRoomId = null;
    if (onlineInMatch) onlineInMatch = false;
}

function broadcastMatchAction(action) {
    if (!socket || !onlineInMatch || !currentRoomId) return;
    socket.emit('match:action', { roomId: currentRoomId, ...action });
}

function serializeSlot(slot) {
    if (!slot.classList.contains('occupied-slot')) return null;
    return {
        name: slot.dataset.cardName,
        health: Number(slot.dataset.health),
        attackUsed: slot.dataset.attackUsed === 'true',
        healUses: Number(slot.dataset.healUses || 0)
    };
}

function buildOnlineSnapshot() {
    const playerTeam = battleScreen.dataset.selectedTeam;
    const opponentTeam = playerTeam === 'dark' ? 'light' : 'dark';
    return {
        type: 'sync',
        senderId: socket.id,
        seq: ++onlineSeq,
        phase: battlePhase,
        stats: {
            light: { health: playerStats.lightTeam.health, gold: playerStats.lightTeam.gold },
            dark: { health: playerStats.darkTeam.health, gold: playerStats.darkTeam.gold }
        },
        boards: {
            [playerTeam]: [...playerDropSlots].map(serializeSlot),
            [opponentTeam]: [...computerDropSlots].map(serializeSlot)
        },
        blocked: [...tempEffects.blockedCards],
        goldToHealthUsed: { light: goldToHealthUsed.light, dark: goldToHealthUsed.dark },
        healthToGoldUsed: { light: healthToGoldUsed.light, dark: healthToGoldUsed.dark },
        graveyard: graveyardCards.map((card) => ({ team: card.team, name: card.name })),
        result: matchResult
    };
}

function syncOnline() {
    if (!socket || !onlineInMatch || !currentRoomId || applyingRemoteState) return;
    broadcastMatchAction(buildOnlineSnapshot());
}

function applyBoardState(slots, boardData, team, isOwn) {
    [...slots].forEach((slot, index) => {
        const data = Array.isArray(boardData) ? boardData[index] : null;
        const definition = data ? resolveCardDefinition(String(data.name), team) : null;
        if (!data || !definition) {
            clearSlotState(slot);
            return;
        }
        const health = clampNumber(data.health, 1, 99, definition.health);
        slot.classList.add('occupied-slot');
        slot.dataset.cardName = definition.name;
        slot.dataset.health = String(health);
        slot.dataset.attack = String(definition.attack);
        if (definition.name === 'معالجة النور') slot.dataset.healUses = String(clampNumber(data.healUses, 0, 4, 0));
        else delete slot.dataset.healUses;
        if (data.attackUsed) slot.dataset.attackUsed = 'true';
        else delete slot.dataset.attackUsed;
        slot.innerHTML = deployedCardMarkup(definition, isOwn, isOwn);
        slot.querySelector('.deployed-card-health strong').textContent = String(health);
        slot.classList.toggle('blocked-card', isSlotBlocked(slot));
    });
}

function rebuildGraveyard(entries) {
    battleGraveyardSlots.innerHTML = '';
    graveyardCards.length = 0;
    (Array.isArray(entries) ? entries.slice(0, 60) : []).forEach((entry) => {
        if (!entry || (entry.team !== 'light' && entry.team !== 'dark')) return;
        const definition = resolveCardDefinition(String(entry.name), entry.team);
        if (!definition) return;
        const element = createGraveyardElement(definition.name, definition.image);
        battleGraveyardSlots.appendChild(element);
        graveyardCards.push({ ...definition, team: entry.team, element });
    });
    renderGraveyardBankCards();
    updateGraveyardBadge();
}

function captureBattleSummary() {
    const playerTeam = battleScreen.dataset.selectedTeam;
    const read = (slots) => [...slots].map((slot) => (
        slot.classList.contains('occupied-slot') ? { name: slot.dataset.cardName, health: Number(slot.dataset.health) } : null
    ));
    return {
        mine: read(playerDropSlots),
        opp: read(computerDropSlots),
        myHealth: playerStats[playerTeam === 'dark' ? 'darkTeam' : 'lightTeam'].health
    };
}

function describeRemoteChanges(before) {
    const after = captureBattleSummary();
    const messages = [];
    after.opp.forEach((card, index) => {
        const previous = before.opp[index];
        if (card && (!previous || previous.name !== card.name)) messages.push(`الخصم أنزل ${card.name} في الساحة.`);
        else if (card && previous && card.health < previous.health) messages.push(`${card.name} (الخصم) خسر ${previous.health - card.health} حياة.`);
        else if (!card && previous) messages.push(`سقط ${previous.name} من ساحة الخصم.`);
    });
    after.mine.forEach((card, index) => {
        const previous = before.mine[index];
        if (card && previous && card.health < previous.health) messages.push(`${card.name} خسر ${previous.health - card.health} حياة بسبب هجوم الخصم.`);
        else if (!card && previous) messages.push(`سقط ${previous.name} من ساحتك.`);
    });
    if (after.myHealth < before.myHealth) messages.push(`خسر قائدك ${before.myHealth - after.myHealth} حياة.`);
    messages.slice(0, 6).forEach((message) => updateBattleNews(message));
}

function applyRemoteSnapshot(snap) {
    if (isGameOver) return;
    const playerTeam = battleScreen.dataset.selectedTeam;
    const opponentTeam = playerTeam === 'dark' ? 'light' : 'dark';
    const before = captureBattleSummary();
    applyingRemoteState = true;
    try {
        ['light', 'dark'].forEach((team) => {
            const stats = playerStats[team === 'dark' ? 'darkTeam' : 'lightTeam'];
            stats.health = clampNumber(snap.stats?.[team]?.health, 0, 20, stats.health);
            stats.gold = clampNumber(snap.stats?.[team]?.gold, 0, 999, stats.gold);
            goldToHealthUsed[team] = Boolean(snap.goldToHealthUsed?.[team]);
            healthToGoldUsed[team] = Boolean(snap.healthToGoldUsed?.[team]);
        });

        tempEffects.blockedCards.clear();
        tempEffects.silencedBy.clear();
        (Array.isArray(snap.blocked) ? snap.blocked : []).forEach((key) => {
            if (/^(light|dark)_[1-4]$/.test(String(key))) tempEffects.blockedCards.add(String(key));
        });

        applyBoardState(playerDropSlots, snap.boards?.[playerTeam], playerTeam, true);
        applyBoardState(computerDropSlots, snap.boards?.[opponentTeam], opponentTeam, false);
        rebuildGraveyard(snap.graveyard);
        renderLeaderInSlot(leaderSlot, playerTeam);
        renderLeaderInSlot(computerLeaderSlot, opponentTeam);

        const newPhase = clampNumber(snap.phase, 1, 5, battlePhase);
        const phaseChanged = newPhase !== battlePhase;
        battlePhase = newPhase;

        renderPlayerStats();
        updateAttackButtons();
        updateBankControls();
        describeRemoteChanges(before);
        if (phaseChanged) {
            const income = phaseGoldIncome[battlePhase] || 0;
            updateBattleNews(`الحكم: دخلت الجولة ${battlePhase}${income > 0 ? `، تم توزيع ${income} ذهب لكل لاعب.` : '.'}`);
        }

        const result = snap.result;
        if (result && !isGameOver && (result.winner === 'light' || result.winner === 'dark')) {
            lockBattleAfterGameOver();
            document.querySelector('.turn-indicator').textContent = 'انتهت المباراة';
            showVictoryModal(result.winner, result.type === 'economic' ? 'economic' : 'military');
        }
    } finally {
        applyingRemoteState = false;
    }
}

function applyRemoteAction(action) {
    if (!action || !onlineInMatch || action.type !== 'sync') return;
    if (action.senderId && socket && action.senderId === socket.id) return;
    const senderKey = String(action.senderId || 'remote');
    const seq = Number(action.seq) || 0;
    if (seq <= (lastRemoteSeq[senderKey] || 0)) return; // رسالة قديمة أو مكررة
    lastRemoteSeq[senderKey] = seq;
    applyRemoteSnapshot(action);
}

function finishOnlineTurn() {
    if (!socket || !currentRoomId) return;
    const playerTeam = battleScreen.dataset.selectedTeam;
    isPlayerTurn = false;
    hideEmergencySacrificeModal();
    hideAttackModal();
    hideSilenceModal();
    clearBlockedCards(playerTeam); // المنع الموجّه لكروتي ينتهي بانتهاء دوري
    if (socket.id !== matchFirstTurnId) advanceBattlePhase({ clearBlocks: false });
    setTurnLockState();
    updateAttackButtons();
    updateBankControls();
    endTurnButton.hidden = true;
    if (isGameOver) return; // نصر اقتصادي حدث أثناء توزيع الذهب وتم إرساله
    updateTurnIndicator();
    syncOnline();
    socket.emit('match:end-turn', { roomId: currentRoomId });
    updateBattleNews('انتهى دورك، بانتظار الخصم.');
}

// ------------------------------------------------------------------ تسجيل الوضع
const OnlineMode = {
    id: 'online',

    // الدخول إلى الردهة (بعد أن أدخل اللاعب اسمه واختار "تحدي ناس حقيقيين")
    enter(playerName) {
        activeMode = OnlineMode;
        leavingLobby = false;
        localPlayerName = playerName;
        if (!socket && window.io) socket = window.io();
        if (!socket) {
            onlinePlayerList.innerHTML = '<p class="online-empty-state">لا يوجد خادم عبر الإنترنت متصل الآن. حاول لاحقاً، أو ارجع واختر تحدي الكمبيوتر.</p>';
            return;
        }
        attachLobbyListeners();
        onlinePlayerList.innerHTML = '<p>جارٍ تحميل اللاعبين...</p>';
        if (socket.connected) socket.emit('player:join', { name: localPlayerName });
        else if (socket.connect) socket.connect();
    },

    // خطافات يستدعيها game.js
    afterAction() { syncOnline(); },
    finishTurn() { finishOnlineTurn(); },
    leaveMatch() { leaveOnlineMatch(); },

    // الخروج من الأونلاين كلياً (زر الرجوع إلى شاشة الترحيب): نغادر المباراة ونقطع الاتصال
    exit() {
        leavingLobby = true;
        leaveOnlineMatch();
        if (socket && socket.disconnect) socket.disconnect();
        if (activeMode === OnlineMode) activeMode = null;
    }
};
window.OnlineMode = OnlineMode;

document.querySelectorAll('[data-challenge-team]').forEach((button) => {
    button.addEventListener('click', () => chooseChallengeTeam(button.dataset.challengeTeam));
});
