// =============================================================================
// شاشة الترحيب وتوجيه اللاعب: (تحدي ناس حقيقيين) أو (تحدي الكمبيوتر)
// هذا الملف هو "المفتاح" الوحيد بين الوضعين؛ كل وضع يعيش في ملفه المستقل (online.js / ai.js)
// ولا يعرف أحدهما الآخر.
// =============================================================================
(function () {
    'use strict';

    const NAME_KEY = 'faction-player-name';
    const welcomeScreen = document.querySelector('#welcome-screen');
    const nameInput = document.querySelector('#welcome-name-input');
    const nameError = document.querySelector('#welcome-error');
    const challengeHumans = document.querySelector('#challenge-humans');
    const challengeComputer = document.querySelector('#challenge-computer');
    const backToWelcome = document.querySelector('#back-to-welcome');
    const headerSubtitle = document.querySelector('.header-subtitle');
    const pickDark = document.querySelector('#join-dark-team');
    const pickLight = document.querySelector('#join-light-team');

    let mode = null;   // null | 'online' | 'ai'

    function show(screen, visible) {
        screen.hidden = !visible;
        screen.classList.toggle('screen-hidden', !visible);
    }

    function readName() {
        const name = nameInput.value.trim().slice(0, 20);
        nameError.hidden = Boolean(name);
        if (!name) { nameInput.focus(); return ''; }
        try { localStorage.setItem(NAME_KEY, name); } catch (error) { /* التخزين غير متاح: لا مشكلة */ }
        return name;
    }

    const App = {
        playerName: '',

        showWelcome() {
            if (mode === 'online') OnlineMode.exit();
            if (mode === 'ai') AIMode.exit();
            mode = null;
            show(selectionScreen, false);
            show(battleScreen, false);
            show(welcomeScreen, true);
            nameInput.focus();
        },

        // الشاشة الرئيسية للوضع الحالي: قائمة اللاعبين (أونلاين) أو اختيار الفريق (كمبيوتر)
        showModeHome() {
            if (!mode) { App.showWelcome(); return; }
            show(welcomeScreen, false);
            show(battleScreen, false);
            selectionScreen.classList.toggle('mode-online', mode === 'online');
            selectionScreen.classList.toggle('mode-ai', mode === 'ai');
            headerSubtitle.textContent = mode === 'online'
                ? `أهلاً ${App.playerName}! اختر لاعباً من القائمة وتحدَّه.`
                : `أهلاً ${App.playerName}! اختر فريقك لتواجه العقل الإلكتروني.`;
            show(selectionScreen, true);
        },

        enterOnline() {
            const name = readName();
            if (!name) return;
            App.playerName = name;
            mode = 'online';
            OnlineMode.enter(name);
            App.showModeHome();
        },

        enterComputer() {
            const name = readName();
            if (!name) return;
            App.playerName = name;
            mode = 'ai';
            App.showModeHome();
        }
    };
    window.App = App;

    challengeHumans.addEventListener('click', App.enterOnline);
    challengeComputer.addEventListener('click', App.enterComputer);
    backToWelcome.addEventListener('click', App.showWelcome);
    // أزرار اختيار الفريق تعمل في وضع الكمبيوتر فقط (في الأونلاين تُخفى ويُختار الفريق عند التحدي)
    pickLight.addEventListener('click', () => { if (mode === 'ai') AIMode.start('light'); });
    pickDark.addEventListener('click', () => { if (mode === 'ai') AIMode.start('dark'); });
    nameInput.addEventListener('input', () => { nameError.hidden = true; });

    try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch (error) { nameInput.value = ''; }
    App.showWelcome();
})();
