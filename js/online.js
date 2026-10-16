// =============================================================================
// وضع "تحدي ناس حقيقيين" (أونلاين)
// هذا الملف هو الوحيد الذي يعرف الـ socket والمزامنة بين اللاعبين. لا يستخدم أي شيء من وضع الكمبيوتر.
// يعتمد على game.js فقط عبر دوالها المعتادة، ويسجّل نفسه كوضع نشط عبر الكائن OnlineMode أسفل الملف.
// =============================================================================

let socket = null;                     // لا يُنشأ الاتصال إلا عند اختيار "تحدي ناس حقيقيين"
let leavingLobby = false;              // نتجاهل رسائل الانقطاع عندما نغادر الأونلاين بإرادتنا
let onlineInMatch = false;             // هل توجد مباراة أونلاين جارية؟
let onlinePaused = false;              // تتوقف الحركات خلال مهلة إعادة اتصال أحد اللاعبين
const ONLINE_SESSION_KEY = 'faction-online-session';
const onlinePlayerList = document.querySelector('#online-player-list');
const onlineRefreshButton = document.querySelector('#online-refresh-button');
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
let lobbyRefreshTimeout = null;
let resumeExpiredNotice = '';

function finishLobbyRefresh(failed = false) {
    if (lobbyRefreshTimeout !== null) {
        window.clearTimeout(lobbyRefreshTimeout);
        lobbyRefreshTimeout = null;
    }
    if (!onlineRefreshButton) return;
    onlineRefreshButton.disabled = false;
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang] || translations.en;
    onlineRefreshButton.textContent = getNestedValue(t, 'selection.refreshPlayers') || 'Refresh';
    if (failed && onlinePlayerList) {
        onlinePlayerList.innerHTML = `<p class="online-empty-state">${escapeHtml(getNestedValue(t, 'selection.refreshPlayersFailed') || 'The server did not respond. Try refreshing again.')}</p>`;
    }
}

function refreshOnlinePlayers() {
    if (!onlineRefreshButton) return;
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang] || translations.en;
    onlineRefreshButton.disabled = true;
    onlineRefreshButton.textContent = getNestedValue(t, 'selection.refreshingPlayers') || 'Refreshing...';
    onlinePlayerList.innerHTML = `<p class="online-empty-state">${escapeHtml(getNestedValue(t, 'selection.refreshingPlayers') || 'Refreshing...')}</p>`;
    lobbyRefreshTimeout = window.setTimeout(() => finishLobbyRefresh(true), 8000);

    if (!socket) finishLobbyRefresh(true);
    else if (socket.connected) socket.emit('lobby:refresh');
    else socket.connect();
}

function readOnlineSessionId() {
    try { return localStorage.getItem(ONLINE_SESSION_KEY) || ''; } catch (error) { return ''; }
}

function saveOnlineSessionId(sessionId) {
    if (!sessionId) return;
    try { localStorage.setItem(ONLINE_SESSION_KEY, sessionId); } catch (error) { /* التخزين غير متاح */ }
}


// ربط مستمعات الخادم. تُستدعى مرة واحدة فقط: تكرارها كان سيجعل كل رسالة تُعالَج مرتين
function attachLobbyListeners() {
    if (lobbyListenersAttached || !socket) return;
    lobbyListenersAttached = true;

    // نعيد الانضمام للردهة عند كل اتصال (يشمل إعادة الاتصال بعد الانقطاع)
    socket.on('connect', () => {
        if (activeMode === OnlineMode) {
            socket.emit('player:join', { name: localPlayerName, sessionId: readOnlineSessionId() });
        }
    });
    socket.on('connect_error', () => {
        if (activeMode === OnlineMode) {
            finishLobbyRefresh(true);
        }
    });
    socket.on('disconnect', handleSocketDisconnect);

    socket.on('player:session', ({ id, name }) => {
        localSocketId = id;
        localPlayerName = name;
    });
    socket.on('player:session', ({ sessionId }) => saveOnlineSessionId(sessionId));
    socket.on('lobby:list', (players) => {
        if (activeMode !== OnlineMode) return;
        finishLobbyRefresh();
        renderOnlinePlayers(players);
        if (resumeExpiredNotice) {
            const notice = document.createElement('p');
            notice.className = 'online-empty-state';
            notice.textContent = resumeExpiredNotice;
            onlinePlayerList.prepend(notice);
            resumeExpiredNotice = '';
        }
    });

    socket.on('challenge:error', ({ message }) => {
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang] || translations.en;
        updateBattleNews(message || getNestedValue(t, 'battle.news.challengeFailed') || 'Unable to send the challenge.');
    });
    socket.on('match:paused', () => {
        if (activeMode !== OnlineMode || !onlineInMatch) return;
        onlinePaused = true;
        isPlayerTurn = false;
        clearPlayerTurnTimer();
        setTurnLockState();
        updateBattleNews('انقطع اتصال الخصم مؤقتًا. ستبقى المباراة محفوظة لوقت قصير.');
    });
    socket.on('match:resume', (data) => resumeOnlineMatch(data));
    socket.on('match:resumed', (data) => resumeOnlineMatch(data));
    socket.on('match:resume-failed', () => {
        if (activeMode !== OnlineMode) return;
        const wasOnline = onlineInMatch;
        onlinePaused = false;
        currentRoomId = null;
        onlineInMatch = false;
        clearPlayerTurnTimer();
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang] || translations.en;
        resumeExpiredNotice = getNestedValue(t, 'selection.matchExpired') || 'The connection took too long. Start a new challenge.';
        if (wasOnline && !battleScreen.hidden && !battleScreen.classList.contains('screen-hidden')) {
            lockBattleAfterGameOver();
            setTurnIndicatorMessage(t.selection.matchEnded);
            updateBattleNews(resumeExpiredNotice);
            showSelectionScreen();
        }
    });

    socket.on('challenge:incoming', ({ challengerName, roomId, forcedTeam, turnDurationMs }) => {
        if (activeMode !== OnlineMode || (onlineInMatch && !isGameOver)) return; // لا نقبل تحدياً أثناء مباراة جارية
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang] || translations.en;
        const forcedTeamText = forcedTeam === 'light'
            ? getNestedValue(t, 'battle.lightTeam') || 'Light Team'
            : getNestedValue(t, 'battle.darkTeam') || 'Dark Team';
        const template = getNestedValue(t, 'battle.news.challengeIncoming') || "Do you want to accept {name}'s challenge?\nYou will be assigned automatically to the {team} team.";
        const durationKey = ({
            0: 'turnDurationOpen',
            45000: 'turnDuration45',
            60000: 'turnDuration60',
            90000: 'turnDuration90',
            120000: 'turnDuration120'
        })[turnDurationMs ?? 45000] || 'turnDuration45';
        const durationText = getNestedValue(t, `selection.${durationKey}`) || '45 seconds';
        const confirmMessage = template
            .replace('{name}', challengerName)
            .replace('{team}', forcedTeamText)
            .replace('{duration}', durationText);
        const accept = window.confirm(confirmMessage);
        if (accept) socket.emit('challenge:accept', { roomId });
    });
    socket.on('challenge:sent', ({ targetName, selectedTeam }) => {
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang] || translations.en;
        const selectedTeamName = selectedTeam === 'light'
            ? getNestedValue(t, 'battle.lightTeam') || 'Light Team'
            : getNestedValue(t, 'battle.darkTeam') || 'Dark Team';
        const template = getNestedValue(t, 'battle.news.challengeSent') || 'Challenge sent to {name}; you chose to play as {team}.';
        updateBattleNews(template.replace('{name}', targetName).replace('{team}', selectedTeamName));
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
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang];
        onlinePlayerList.innerHTML = `<p class="online-empty-state">${t.selection.noPlayersAvailable}</p>`;
        return;
    }

    const lang = document.documentElement.getAttribute('lang') || 'en';
    const challengeLabel = getNestedValue(translations[lang] || translations.en, 'selection.challenge') || 'Challenge';
    onlinePlayerList.innerHTML = visiblePlayers.map((player) => `
        <div class="online-player-item">
            <span>${escapeHtml(player.name)}</span>
            <button type="button" data-target-id="${escapeHtml(player.id)}">${escapeHtml(challengeLabel)}</button>
        </div>
    `).join('');

    onlinePlayerList.querySelectorAll('button[data-target-id]').forEach((button) => {
        button.addEventListener('click', () => {
            if (!socket) return;
            const targetPlayer = visiblePlayers.find((player) => player.id === button.dataset.targetId);
            if (!targetPlayer) return;
            pendingChallengeTarget = targetPlayer;
            const teamModal = document.querySelector('#challenge-team-modal');
            if (teamModal) {
                teamModal.classList.remove('screen-hidden');
            } else {
                socket.emit('player:challenge', {
                    targetId: targetPlayer.id,
                    team: 'light',
                    turnDurationMs: getSelectedTurnDurationMs()
                });
                const lang = document.documentElement.getAttribute('lang') || 'en';
                const t = translations[lang] || translations.en;
                const template = getNestedValue(t, 'battle.news.challengeSentAsTeam') || 'Challenge sent to {name} as the Light Team.';
                updateBattleNews(template.replace('{name}', targetPlayer.name));
            }
        });
    });
}

function chooseChallengeTeam(team) {
    if (!pendingChallengeTarget || !socket) return;
    socket.emit('player:challenge', {
        targetId: pendingChallengeTarget.id,
        team,
        turnDurationMs: getSelectedTurnDurationMs()
    });
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang] || translations.en;
    const teamLabel = team === 'light'
        ? getNestedValue(t, 'battle.lightTeam') || 'Light Team'
        : getNestedValue(t, 'battle.darkTeam') || 'Dark Team';
    const template = getNestedValue(t, 'battle.news.challengeSentWithTeam') || 'Challenge sent to {name}; you chose the {team}.';
    updateBattleNews(template.replace('{name}', pendingChallengeTarget.name).replace('{team}', teamLabel));
    pendingChallengeTarget = null;
    const teamModal = document.querySelector('#challenge-team-modal');
    if (teamModal) teamModal.classList.add('screen-hidden');
}

function startOnlineMatch({ roomId, players, currentTurnId, firstTurnId, state, stateSnapshot, turnRemainingMs, turnStartPending, turnDurationMs }) {
    currentRoomId = roomId;
    currentMatchPlayers = players || [];
    // أي بداية مباراة قادمة من الخادم هي مباراة أونلاين، مهما كانت قيمة mode المرسلة
    onlineInMatch = true;
    onlinePaused = state === 'paused';
    matchFirstTurnId = firstTurnId || currentTurnId;
    onlineSeq = 0;
    Object.keys(lastRemoteSeq).forEach((key) => delete lastRemoteSeq[key]);

    const yourPlayer = currentMatchPlayers.find((player) => player.id === socket.id);
    const selectedTeam = yourPlayer?.team === 'dark' || yourPlayer?.team === 'light'
        ? yourPlayer.team
        : (battleScreen.dataset.selectedTeam || 'light');
    const startsWithPlayer = !onlinePaused && socket.id === currentTurnId;

    showBattleScreen(selectedTeam, startsWithPlayer, turnDurationMs ?? getSelectedTurnDurationMs());
    setTurnLockState();
    updateTurnIndicator();
    const opponentName = currentMatchPlayers.find((player) => player.id !== socket.id)?.name || 'الخصم';
    updateBattleNews(`بدأت مباراة عبر الإنترنت ضد ${opponentName}.`);
    if (stateSnapshot) applyRemoteSnapshot(stateSnapshot);
    if (turnStartPending) resetOnlineTurnStart(selectedTeam, currentMatchPlayers.find((player) => player.id === currentTurnId)?.team);
    if (typeof turnRemainingMs === 'number' && isPlayerTurn) startPlayerTurnTimer(turnRemainingMs);
    syncOnline();
}

function handleOnlineTurn({ currentTurnId, turnRemainingMs, turnDurationMs }) {
    if (!onlineInMatch || isGameOver) return;
    if (turnDurationMs !== undefined) setGameTurnDurationMs(turnDurationMs);
    onlinePaused = false;
    const nextTeam = currentMatchPlayers.find((player) => player.id === currentTurnId)?.team;
    const previousTeam = nextTeam === 'light' ? 'dark' : nextTeam === 'dark' ? 'light' : null;
    if (previousTeam && checkEmptyArenaDefeat(previousTeam)) return;
    const wasPlayerTurn = isPlayerTurn;
    isPlayerTurn = socket.id === currentTurnId;
    if (isPlayerTurn) {
        turnActions.player = false;
        turnHasNoAvailableMoves = false;
        cardsDeployedThisTurn = 0;
        resetAttackAvailability();
    }
    setTurnLockState();
    updateAttackButtons();
    updateBankControls();
    endTurnButton.hidden = !isPlayerTurn;
    endTurnButton.textContent = battleText('endTurn', 'End Turn');
    updateTurnIndicator();
    if (isPlayerTurn) {
        updateBattleNews(`بدأ دورك الآن (المرحلة ${battlePhase}).`);
        forceWithdrawalIfNoPlayerEvent();
    } else if (wasPlayerTurn) {
        updateBattleNews('دور الخصم الآن.');
    }
    startPlayerTurnTimer(typeof turnRemainingMs === 'number' ? turnRemainingMs : undefined);
    if (isPlayerTurn) syncOnline();
}

function handleOnlineMatchEnded({ reason } = {}) {
    if (reason === 'challenge-expired') {
        updateBattleNews('انتهت مدة التحدي ولم تتم الموافقة عليه.');
        return;
    }
    const wasOnline = onlineInMatch;
    currentRoomId = null;
    onlineInMatch = false;
    onlinePaused = false;
    if (!wasOnline || isGameOver) return;
    if (reason === 'opponent-left') {
        lockBattleAfterGameOver();
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang];
        setTurnIndicatorMessage(t.selection.matchEnded);
        updateBattleNews('انقطع اتصال الخصم، وتم احتساب المباراة لصالحك.');
        showVictoryModal(battleScreen.dataset.selectedTeam);
    }
}

function handleSocketDisconnect() {
    if (leavingLobby) return;          // خروج مقصود من الأونلاين، لا داعي لرسائل الخطأ
    if (onlinePlayerList) {
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const t = translations[lang];
        onlinePlayerList.innerHTML = `<p class="online-empty-state">${lang === 'ar' ? 'انقطع الاتصال بالخادم. جارٍ محاولة إعادة الاتصال...' : 'Disconnected from server. Attempting to reconnect...'}</p>`;
    }
    if (!onlineInMatch) return;
    onlinePaused = true;
    isPlayerTurn = false;
    clearPlayerTurnTimer();
    setTurnLockState();
    if (isGameOver) return;
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const t = translations[lang];
    setTurnIndicatorMessage(t.selection.reconnecting);
    updateBattleNews('انقطع اتصالك مؤقتًا. ستستأنف المباراة تلقائيًا عند عودة الاتصال.');
}

function resumeOnlineMatch({ roomId, players, currentTurnId, firstTurnId, state, stateSnapshot, turnRemainingMs, turnStartPending, turnDurationMs } = {}) {
    if (activeMode !== OnlineMode || !roomId) return;
    currentRoomId = roomId;
    currentMatchPlayers = players || currentMatchPlayers;
    onlineInMatch = true;
    onlinePaused = state !== 'active';
    matchFirstTurnId = firstTurnId || currentTurnId;
    isPlayerTurn = !onlinePaused && socket.id === currentTurnId;
    if (!battleScreen || battleScreen.classList.contains('screen-hidden')) {
        startOnlineMatch({ roomId, players: currentMatchPlayers, currentTurnId, firstTurnId, state, stateSnapshot, turnRemainingMs, turnStartPending, turnDurationMs });
        return;
    }
    if (turnDurationMs !== undefined) setGameTurnDurationMs(turnDurationMs);
    if (stateSnapshot) applyRemoteSnapshot(stateSnapshot);
    if (turnStartPending) {
        const currentTurnTeam = currentMatchPlayers.find((player) => player.id === currentTurnId)?.team;
        resetOnlineTurnStart(battleScreen.dataset.selectedTeam, currentTurnTeam);
    }
    setTurnLockState();
    updateTurnIndicator();
    if (isPlayerTurn) startPlayerTurnTimer(typeof turnRemainingMs === 'number' ? turnRemainingMs : undefined);
    if (isPlayerTurn && turnStartPending) syncOnline();
    updateBattleNews(state === 'active' ? 'تمت استعادة المباراة بعد إعادة الاتصال.' : 'تمت استعادة الغرفة، بانتظار عودة اللاعب الآخر.');
}

function resetOnlineTurnStart(playerTeam, currentTurnTeam) {
    resetAttackAvailability();
    cardsDeployedThisTurn = 0;
    turnHasNoAvailableMoves = false;
    if (currentTurnTeam === playerTeam) turnActions.player = false;
    else if (currentTurnTeam) turnActions.computer = false;
    updateAttackButtons();
}

function leaveOnlineMatch() {
    clearPlayerTurnTimer();
    // الخادم يفهم الحدث 'match:ended' فقط: يبلّغ الطرفين ويحذف الغرفة
    if (onlineInMatch && currentRoomId && socket) {
        socket.emit('match:ended', { roomId: currentRoomId, reason: isGameOver ? 'finished' : 'opponent-left' });
    }
    currentRoomId = null;
    if (onlineInMatch) onlineInMatch = false;
    onlinePaused = false;
}

function broadcastMatchAction(action) {
    if (!socket || !onlineInMatch || onlinePaused || !currentRoomId) return;
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
        roundNumber: battleRoundNumber,
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
        graveyard: graveyardCards.map((card) => ({ team: card.team, name: card.id })),
        result: matchResult,
        cards: {
            light: battleCards.light.filter((card) => card.isBankCard).map(serializeCardDefinition),
            dark: battleCards.dark.filter((card) => card.isBankCard).map(serializeCardDefinition)
        },
        deployedCardNames: {
            light: [...deployedCardNames.light],
            dark: [...deployedCardNames.dark]
        },
        dropDiscount: {
            light: [...dropDiscount.light],
            dark: [...dropDiscount.dark]
        },
        bankSoldCardNames: [...bankSoldCardNames],
        blockDuration: Object.fromEntries(tempEffects.blockDuration),
        silencedBy: Object.fromEntries(tempEffects.silencedBy),
        turnActions: {
            [playerTeam]: turnActions.player,
            [opponentTeam]: turnActions.computer
        },
        cardsDeployedThisTurn,
        deployedCardCount,
        turnHasNoAvailableMoves: {
            [playerTeam]: turnHasNoAvailableMoves,
            [opponentTeam]: false
        }
    };
}

function serializeCardDefinition(card) {
    return {
        id: card.id,
        name: card.name,
        image: card.image,
        cost: card.cost,
        health: card.health,
        attack: card.attack,
        isBankCard: Boolean(card.isBankCard)
    };
}

function syncOnline() {
    if (!socket || !onlineInMatch || !currentRoomId || applyingRemoteState) return;
    broadcastMatchAction(buildOnlineSnapshot());
}

function restoreSnapshotMetadata(snapshot, playerTeam) {
    const opponentTeam = playerTeam === 'dark' ? 'light' : 'dark';
    let localHandChanged = false;

    ['light', 'dark'].forEach((team) => {
        const dynamicCards = Array.isArray(snapshot.cards?.[team]) ? snapshot.cards[team] : [];
        dynamicCards.forEach((card) => {
            if (!card || card.isBankCard !== true || typeof card.id !== 'string' || !card.id.startsWith('bank:')) return;
            if (battleCards[team].some((existing) => existing.id === card.id)) return;
            const definition = resolveCardDefinition(card.id, team);
            if (definition) {
                battleCards[team].push(definition);
                if (team === playerTeam) localHandChanged = true;
            }
        });

        if (Array.isArray(snapshot.deployedCardNames?.[team])) {
            deployedCardNames[team].clear();
            snapshot.deployedCardNames[team].forEach((id) => {
                if (typeof id === 'string' && battleCards[team].some((card) => card.id === id)) deployedCardNames[team].add(id);
            });
        }

        if (Array.isArray(snapshot.dropDiscount?.[team])) {
            dropDiscount[team].clear();
            snapshot.dropDiscount[team].forEach((id) => {
                if (typeof id === 'string' && battleCards[team].some((card) => card.id === id)) dropDiscount[team].add(id);
            });
        }
    });

    if (Array.isArray(snapshot.bankSoldCardNames)) {
        bankSoldCardNames.clear();
        snapshot.bankSoldCardNames.forEach((name) => {
            if (typeof name === 'string') bankSoldCardNames.add(normalizeBankCardName(name));
        });
        syncBankCardAvailability();
    }

    tempEffects.blockedCards.clear();
    tempEffects.silencedBy.clear();
    tempEffects.blockDuration.clear();
    (Array.isArray(snapshot.blocked) ? snapshot.blocked : []).forEach((key) => {
        if (!/^(light|dark)_[1-4]$/.test(String(key))) return;
        tempEffects.blockedCards.add(String(key));
        const duration = Number(snapshot.blockDuration?.[key]);
        if (Number.isFinite(duration) && duration > 0) tempEffects.blockDuration.set(String(key), duration);
        const source = snapshot.silencedBy?.[key];
        if (typeof source === 'string' && /^(light|dark)_[1-4]$/.test(source)) tempEffects.silencedBy.set(String(key), source);
    });

    if (snapshot.turnActions && typeof snapshot.turnActions === 'object') {
        turnActions.player = Boolean(snapshot.turnActions[playerTeam]);
        turnActions.computer = Boolean(snapshot.turnActions[opponentTeam]);
    }
    if (Number.isFinite(Number(snapshot.cardsDeployedThisTurn))) {
        cardsDeployedThisTurn = Math.max(0, Math.min(2, Number(snapshot.cardsDeployedThisTurn)));
    }
    if (Number.isFinite(Number(snapshot.deployedCardCount))) {
        deployedCardCount = Math.max(0, Number(snapshot.deployedCardCount));
    }
    if (snapshot.turnHasNoAvailableMoves && typeof snapshot.turnHasNoAvailableMoves === 'object') {
        turnHasNoAvailableMoves = Boolean(snapshot.turnHasNoAvailableMoves[playerTeam]);
    }

    if (snapshot.result && (snapshot.result.winner === 'light' || snapshot.result.winner === 'dark')) {
        matchResult = snapshot.result;
    }
    return localHandChanged;
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
        slot.dataset.cardName = definition.id;
        slot.dataset.health = String(health);
        slot.dataset.attack = String(definition.attack);
        if (definition.id === 'light-healer') slot.dataset.healUses = String(clampNumber(data.healUses, 0, 4, 0));
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
        const element = createGraveyardElement(definition.id, definition.image, entry.team);
        battleGraveyardSlots.appendChild(element);
        graveyardCards.push({ ...definition, team: entry.team, element });
    });
    renderGraveyardBankCards();
    updateGraveyardBadge();
}

function captureBattleSummary() {
    const playerTeam = battleScreen.dataset.selectedTeam;
    const read = (slots) => [...slots].map((slot) => (
        slot.classList.contains('occupied-slot') ? { id: slot.dataset.cardName, health: Number(slot.dataset.health) } : null
    ));
    return {
        mine: read(playerDropSlots),
        opp: read(computerDropSlots),
        myHealth: playerStats[playerTeam === 'dark' ? 'darkTeam' : 'lightTeam'].health,
        gold: {
            light: playerStats.lightTeam.gold,
            dark: playerStats.darkTeam.gold
        },
        phase: battlePhase,
        roundNumber: battleRoundNumber
    };
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

function describeRemoteChanges(before) {
    const after = captureBattleSummary();
    const messages = [];
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const playerTeam = battleScreen.dataset.selectedTeam || 'light';
    
    after.opp.forEach((card, index) => {
        const previous = before.opp[index];
        const opponentTeam = playerTeam === 'light' ? 'dark' : 'light';
        if (card && (!previous || previous.id !== card.id)) {
            const cardName = getTranslatedCardName(card.id, opponentTeam);
            messages.push(`${lang === 'ar' ? 'الخصم أنزل' : 'Opponent deployed'} ${cardName} ${lang === 'ar' ? 'في الساحة' : 'on the field'}.`);
        }
        else if (card && previous && card.health < previous.health) {
            const cardName = getTranslatedCardName(card.id, opponentTeam);
            messages.push(`${cardName} (${lang === 'ar' ? 'الخصم' : 'Opponent'}) ${lang === 'ar' ? 'خسر' : 'lost'} ${previous.health - card.health} ${lang === 'ar' ? 'حياة' : 'health'}.`);
        }
        else if (!card && previous) {
            const cardName = getTranslatedCardName(previous.id, opponentTeam);
            messages.push(`${cardName} ${lang === 'ar' ? 'سقط من ساحة الخصم' : 'fell from opponent field'}.`);
        }
    });
    after.mine.forEach((card, index) => {
        const previous = before.mine[index];
        if (card && previous && card.health < previous.health) {
            const cardName = getTranslatedCardName(card.id, playerTeam);
            messages.push(`${cardName} ${lang === 'ar' ? 'خسر' : 'lost'} ${previous.health - card.health} ${lang === 'ar' ? 'حياة بسبب هجوم الخصم' : 'health due to opponent attack'}.`);
        }
        else if (!card && previous) {
            const cardName = getTranslatedCardName(previous.id, playerTeam);
            messages.push(`${cardName} ${lang === 'ar' ? 'سقط من ساحتك' : 'fell from your field'}.`);
        }
    });
    if (after.myHealth < before.myHealth) messages.push(`${lang === 'ar' ? 'خسر قائدك' : 'Your leader lost'} ${before.myHealth - after.myHealth} ${lang === 'ar' ? 'حياة' : 'health'}.`);
    messages.slice(0, 6).forEach((message) => updateBattleNews(message));
}

function describeRemoteRoundEffects(before, phase) {
    const income = phase > before.phase ? phaseGoldIncome[phase] || 0 : 0;
    const gold = { ...before.gold };
    const effects = { bankruptcy: 2, tax: 1 };
    const teamName = (team) => battleText(team === 'light' ? 'lightTeam' : 'darkTeam', team);

    ['light', 'dark'].forEach((team) => {
        const traderCount = [...getTeamSlots(team)].filter((slot) =>
            slot.classList.contains('occupied-slot') && slot.dataset.cardName === 'cunning-trader'
        ).length;
        gold[team] += income + traderCount;
        if (traderCount > 0) {
            updateBattleNews(battleText('traderIncome', '{card} generated +{amount} gold for {team} this round.')
                .replace('{card}', getTranslatedCardName('cunning-trader', team))
                .replace('{amount}', traderCount)
                .replace('{team}', teamName(team)));
        }
    });

    ['light', 'dark'].forEach((team) => {
        const opponentTeam = team === 'light' ? 'dark' : 'light';
        const activeEffects = [...getTeamSlots(team)].filter((slot) =>
            slot.classList.contains('occupied-slot') && effects[getBankCardRuleKey(slot.dataset.cardName)]
        );
        if (activeEffects.length === 0) return;

        const opponentHasVaultGuardian = [...getTeamSlots(opponentTeam)].some((slot) =>
            slot.classList.contains('occupied-slot') && slot.dataset.cardName === 'vault-guardian'
        );
        if (opponentHasVaultGuardian) {
            const prevented = activeEffects.reduce((total, slot) =>
                total + effects[getBankCardRuleKey(slot.dataset.cardName)], 0);
            updateBattleNews(battleText(
                'vaultGuardianPreventedDrain',
                '{guardian} protected {team} and prevented {amount} gold from being drained this round.'
            ).replace('{guardian}', getTranslatedCardName('vault-guardian', opponentTeam))
                .replace('{team}', teamName(opponentTeam))
                .replace('{amount}', prevented));
            return;
        }

        activeEffects.forEach((slot) => {
            const amount = effects[getBankCardRuleKey(slot.dataset.cardName)];
            const lost = Math.min(gold[opponentTeam], amount);
            gold[opponentTeam] -= lost;
            if (lost === 0) return;
            updateBattleNews(battleText('bankRoundDrain', '{card} made {team} lose {amount} gold this round.')
                .replace('{card}', getTranslatedBankCardName(slot.dataset.cardName.replace(/^bank:/i, '')))
                .replace('{team}', teamName(opponentTeam))
                .replace('{amount}', lost));
        });
    });
}

function applyRemoteSnapshot(snap) {
    if (isGameOver) return;
    const playerTeam = battleScreen.dataset.selectedTeam;
    const opponentTeam = playerTeam === 'dark' ? 'light' : 'dark';
    const before = captureBattleSummary();
    applyingRemoteState = true;
    try {
        const localHandChanged = restoreSnapshotMetadata(snap, playerTeam);
        ['light', 'dark'].forEach((team) => {
            const stats = playerStats[team === 'dark' ? 'darkTeam' : 'lightTeam'];
            stats.health = clampNumber(snap.stats?.[team]?.health, 0, 20, stats.health);
            stats.gold = clampNumber(snap.stats?.[team]?.gold, 0, 999, stats.gold);
            goldToHealthUsed[team] = Boolean(snap.goldToHealthUsed?.[team]);
            healthToGoldUsed[team] = Boolean(snap.healthToGoldUsed?.[team]);
        });

        applyBoardState(playerDropSlots, snap.boards?.[playerTeam], playerTeam, true);
        applyBoardState(computerDropSlots, snap.boards?.[opponentTeam], opponentTeam, false);
        rebuildGraveyard(snap.graveyard);
        renderLeaderInSlot(leaderSlot, playerTeam);
        renderLeaderInSlot(computerLeaderSlot, opponentTeam);

        const newPhase = clampNumber(snap.phase, 1, 5, battlePhase);
        const phaseChanged = newPhase !== battlePhase;
        const snapshotRoundNumber = Number(snap.roundNumber);
        const hasValidRoundNumber = Number.isSafeInteger(snapshotRoundNumber)
            && snapshotRoundNumber >= 1
            && snapshotRoundNumber <= 1_000_000;
        const roundChanged = hasValidRoundNumber
            ? snapshotRoundNumber !== battleRoundNumber
            : phaseChanged;
        const canDescribeRoundEffects = hasValidRoundNumber
            && snapshotRoundNumber === before.roundNumber + 1;
        battlePhase = newPhase;
        if (hasValidRoundNumber) battleRoundNumber = snapshotRoundNumber;

        renderPlayerStats();
        if (localHandChanged) renderBattleHand(playerTeam);
        updateAttackButtons();
        updateBankControls();
        describeRemoteChanges(before);
        if (roundChanged) {
            const income = battlePhase > before.phase ? phaseGoldIncome[battlePhase] || 0 : 0;
            updateBattleNews(income > 0
                ? battleText('news.phaseIncome', 'Round {phase}: each team received {income} gold.')
                    .replace('{phase}', battlePhase)
                    .replace('{income}', income)
                : battleText('news.phaseNoIncome', 'Round {phase}: no additional round income was distributed.')
                    .replace('{phase}', battlePhase));
            if (canDescribeRoundEffects) describeRemoteRoundEffects(before, battlePhase);
        }

        const result = snap.result;
        if (result && !isGameOver && (result.winner === 'light' || result.winner === 'dark')) {
            lockBattleAfterGameOver();
            const lang = document.documentElement.getAttribute('lang') || 'en';
            const t = translations[lang];
            setTurnIndicatorMessage(t.selection.matchEnded);
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
    if (!socket || !currentRoomId || onlinePaused) return;
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
        if (socket.connected) socket.emit('player:join', { name: localPlayerName, sessionId: readOnlineSessionId() });
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

onlineRefreshButton?.addEventListener('click', refreshOnlinePlayers);

document.querySelectorAll('[data-challenge-team]').forEach((button) => {
    button.addEventListener('click', () => chooseChallengeTeam(button.dataset.challengeTeam));
});
