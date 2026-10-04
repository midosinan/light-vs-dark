// نظام الترجمة متعدد اللغات
const translations = {
    en: {
        title: "Faction Wars",
        cards: {
            light: [
                { name: "Fierce Falcon", description: "Stealth Protection: As long as it's alive in your field, it completely prevents the opponent from targeting the Light Healer card for attack. This card protects the Light Healer from direct attacks, making it safer to provide healing to allies." },
                { name: "Light Healer", description: "Healing and Restoration: Does not attack, but has a special healing button that heals an ally or the leader by +2 health at the cost of 2 of its health (maximum 4 heals per turn, stops when its health reaches 2)." },
                { name: "Cunning Trader", description: "Periodic Gold Generation: Grants its team +1 gold piece automatically at the end of each turn as long as it's present on the battlefield." },
                { name: "Vault Guardian", description: "A strong fighter that protects the team with high attack power and good health." },
                { name: "Light Shield", description: "Protects the King of Dawn from damage. The King's health does not decrease as long as the Shield is on the field." },
                { name: "Sword of Justice", description: "Justice Protection: Can only be attacked if the attacker is stronger with higher attack power." }
            ],
            dark: [
                { name: "Silent Neighbor", description: "Silence and Block: Has a special button `🔇 Block Card` that prevents an enemy card from attacking in the next turn. The card infiltrates the opponent's field and chooses their strongest card to block from attacking." },
                { name: "Hell Dragon", description: "A very powerful monster with high attack power and health, posing a major threat in battle. Has the highest stats in the game and can defeat most other cards." },
                { name: "Dark Ghoul", description: "A massive fighter that can withstand hits with medium attack power and high health. A durable card that can endure multiple attacks and deal damage powerfully." },
                { name: "Dread Priest", description: "A balanced fighter with medium attack power and health. An economical card that can be easily summoned and provides good balance between attack and defense." },
                { name: "Valley of Screams", description: "A fast fighter with medium attack power and low health. An economical card that can be easily summoned early in battle to provide quick attack power." },
                { name: "Box Monster", description: "A balanced fighter with medium attack power and health. A good card for both defense and attack with balanced stats making it a flexible choice in different strategies." }
            ]
        },
        welcome: {
            title: "Faction Wars",
            greeting: "Welcome, warrior, to the battlefield between Light and Darkness! Enter your name, then choose who you want to face.",
            nameLabel: "What's your name?",
            namePlaceholder: "Enter your name here",
            nameError: "Please enter your name first.",
            challengeHumans: "Challenge Real Players",
            challengeComputer: "Challenge Computer",
            onlineGreeting: "Welcome {name}! Choose a player from the list and challenge them.",
            aiGreeting: "Welcome {name}! Choose your team to face the computer AI."
        },
        selection: {
            subtitle: "Choose your destiny: Light Faction or Dark Faction?",
            guideButton: "Game Guide",
            backButton: "Back",
            onlineLobby: "Available Players",
            loadingPlayers: "Loading players...",
            challengeTeamTitle: "Choose your team",
            challengeTeamPrompt: "Choose the team you will play as. Your opponent will be assigned the other team.",
            challenge: "Challenge",
            lightFaction: "Light Faction",
            lightSubtitle: "(Protector of Light and Justice)",
            joinLight: "[Join Light Faction]",
            darkFaction: "Dark Faction",
            darkSubtitle: "(Master of Power and Darkness)",
            joinDark: "[Join Dark Faction]",
            bank: "Bank Market",
            bankClose: "Close",
            cards: {
                resurrect: "Resurrect",
                mercenary: "Mercenary Army",
                tax: "Forced Tax",
                bankruptcy: "Bankruptcy Curse",
                luck: "Game of Luck",
                goldToHealth: "Exchange Gold for Health",
                healthToGold: "Exchange Leader Health for Gold"
            }
        },
        battle: {
            lightTeam: "Light Team",
            darkTeam: "Dark Team",
            turn: "Your Turn",
            battlefield: "Battlefield",
            graveyard: "Graveyard",
            bank: "Bank Market",
            luck: "Game of Luck",
            handCards: "Hand Cards",
            gameEvents: "Game Events",
            endTurn: "End Turn",
            back: "Back",
            defaultMessage: "Select a card or execute a command to start your turn.",
            shopTitle: "Bank Market",
            shopClose: "Close Bank Market",
            bankCards: "Bank Cards",
            buyFromBank: "Buy cards from the Bank",
            recoverFromGraveyard: "Recover cards from the Graveyard",
            buy: "Buy",
            goldToHealth: "Exchange Gold for Health",
            goldToHealthCost: "3 gold -> 6 health",
            healthToGold: "Exchange Leader Health for Gold",
            healthToGoldCost: "2 leader health -> 5 gold",
            graveyardCards: "Graveyard Cards",
            insufficientGold: "Not enough gold",
            ok: "OK",
            turnConfirm: "You ended your turn without an action",
            withdraw: "Do you want to withdraw?",
            continueTurn: "No, I will continue",
            noMoveTitle: "No move available",
            emergencySacrifice: "You do not have enough gold to deploy cards and no attack targets are available. Sacrifice 2 leader health for 5 gold and continue?",
            acceptSacrifice: "Yes, sacrifice 2 health (+5 gold)",
            declineSacrifice: "No, end turn",
            attackTitle: "Choose a target to attack",
            noOpponentCards: "There are no opponent cards on the battlefield.",
            noAttackTargets: "There are no cards that can be attacked now.",
            silenceTitle: "Choose a card to block",
            noSilenceTargets: "There are no cards that can be blocked.",
            closeAttack: "Cancel attack selection",
            closeSilence: "Cancel block selection"
            ,phaseYourTurn: "Round {phase} - Your Turn"
            ,phaseOpponentTurn: "Round {phase} - Opponent's Turn"
            ,joinLight: "You joined the Light Team. Deploy a card and begin the attack."
            ,joinDark: "You joined the Dark Team. Deploy a card and begin the attack."
            ,aiStarted: "The computer match has started. Deploy your cards, then end your turn."
            ,leaderLight: "King of Dawn"
            ,leaderDark: "Lord of Shadows"
            ,victoryEconomicTitle: "Economic Victory!"
            ,victoryMilitaryTitle: "Congratulations!"
            ,defeatEconomicTitle: "Economic Defeat"
            ,defeatMilitaryTitle: "Better luck next time"
            ,victoryEconomicMessage: "Well done! You collected {gold} gold and {winner} won by economic victory!"
            ,victoryMilitaryMessage: "{winner} won the match!"
            ,defeatEconomicMessage: "You lost the match! {winner} collected {gold} gold and achieved an economic victory."
            ,defeatMilitaryMessage: "You lost the match. {winner} won."
            ,bankResurrect: "Resurrect"
            ,bankMercenary: "Mercenary Army"
            ,bankTax: "Forced Tax"
            ,bankruptcy: "Bankruptcy Curse"
        },
        card: {
            health: "Health",
            attack: "Attack",
            cost: "Cost"
        },
        guide: {
            title: "Online Play Guide",
            description: "This guide explains how to play <strong>Faction Wars</strong> online. The system automatically manages the match, turns, health, gold, market, and victory conditions.",
            start: "Starting the Match",
            start1: "Choose your team: <strong>Light Faction</strong> or <strong>Dark Faction</strong>.",
            start2: "Click join to start a new match or join an available opponent.",
            start3: "Your name, team, health, and gold appear in the top bar.",
            start4: "The match starts with 20 leader health and 5 gold pieces.",
            interface: "Match Interface",
            interface1: "<strong>Top Bar:</strong> Shows health and gold of your team and opponent, and indicates whose turn it is.",
            interface2: "<strong>Battlefield:</strong> Place your forces in available slots to face opponent forces.",
            interface3: "<strong>Your Hand:</strong> Shows available cards for summoning, with card cost and value.",
            interface4: "<strong>Bank Market:</strong> Includes cards, assistance, weapons, armor, spells, and equipment.",
            cards: "Cards and Resources",
            cards1: "Each card has a <strong>health</strong> value shown beside or below its image.",
            cards2: "Each card has a <strong>gold</strong> value or cost associated with its use in the match.",
            cards3: "You cannot use a card if you don't have enough gold for its cost.",
            cards4: "Card health decreases when attacked, and is removed from the battlefield when it reaches zero.",
            turnFlow: "Turn Flow",
            turnFlow1: "The system waits until your turn becomes active.",
            turnFlow2: "Use gold to buy a card or summon a force or activate a market item.",
            turnFlow3: "Place cards in available slots in the battlefield.",
            turnFlow4: "Select attack target then press <strong>Attack</strong>.",
            turnFlow5: "The system executes the attack and updates health and gold automatically, then turn passes to opponent.",
            goldIncome: "Periodic Gold Income Table",
            phase1: "1",
            phase1Gold: "5 pieces",
            phase1Desc: "Match start and summoning first forces.",
            phase2: "2",
            phase2Gold: "4 gold pieces",
            phase2Desc: "Gold flow for strategy building.",
            phase3: "3",
            phase3Gold: "3 pieces",
            phase3Desc: "Resource management and attack planning.",
            phase4: "4",
            phase4Gold: "2 pieces",
            phase4Desc: "Careful economy phase.",
            phase5: "5",
            phase5Gold: "1 piece",
            phase5Desc: "Last income from bank.",
            phase6: "6+",
            phase6Gold: "0, income stops",
            phase6Desc: "Rely on forces in the battlefield.",
            goldToHealth: "Exchanging Leader Health for Gold (Emergency Funding)",
            goldToHealth1: "You can sacrifice 2 health points (2❤) from your team leader to get <strong>5 gold pieces</strong> to continue the battle.",
            goldToHealth2: "This feature is available from the bank market (once per turn), or as an emergency window if you can't execute any move and don't have enough gold.",
            goldToHealth3: "Your leader's health must be more than 2 to be able to sacrifice.",
            victory: "Victory Conditions",
            victoryDesc: "The system announces the result automatically when one of these conditions is met:",
            victory1: "<strong>Military Victory:</strong> Opponent leader health reaches <strong>0</strong>.",
            victory2: "<strong>Economic Victory:</strong> Your gold reaches <strong>25</strong> pieces in your treasury.",
            connection: "Connection and Disconnection",
            connection1: "Turn indicator shows when you can execute commands.",
            connection2: "If disconnected, reopen the match or click back then join again.",
            connection3: "Don't close the page during attack execution or purchase until match update completes."
        }
    },
    ar: {
        title: "حرب الفصائل",
        cards: {
            light: [
                { name: "الصقر الجارح", description: "حماية التخفي: طالما هو حي في ساحتك، يمنع الخصم تماماً من استهداف كرت معالجة النور بالهجوم. الكرت يحمي معالجة النور من الهجمات المباشرة مما يجعلها أكثر أماناً لتقديم العلاج للحلفاء." },
                { name: "معالجة النور", description: "المعالجة والترميم: لا تهاجم، بل تملك زراً خاصاً للمعالجة يعالج حليفاً أو القائد بـ +2 حياة مقابل خصم 2 من صحتها (بحد أقصى 4 علاجات في الجولة، وتتوقف إذا بلغت صحتها 2)." },
                { name: "التاجر الماكر", description: "توليد الذهب الدوري: يمنح فريقه +1 قطعة ذهب تلقائياً في نهاية كل جولة طالما هو متواجد في ساحة المعركة." },
                { name: "حارس الخزنة", description: "مقاتل قوي يحمي الفريق بقوة هجومية عالية وصحة جيدة." },
                { name: "درع النور", description: "يحمي ملك الفجر من الضرر. حياة الملك لا تنقص طالما الدرع في الساحة." },
                { name: "سيف العدالة", description: "حماية العدالة: لا يمكن هجومه إلا إذا كان المهاجم أقوى منه بقوة هجومية أعلى." }
            ],
            dark: [
                { name: "الجار الصامت", description: "الصمت والمنع: يملك زراً خاصاً `🔇 منع كرت` يمنع كرتاً معادياً من الهجوم في الدورة التالية. الكرت يتسلل إلى ساحة الخصم ويختار أقوى كرت لديه لمنعه من الهجوم." },
                { name: "تنين الجحيم", description: "وحش قوي جداً بقوة هجومية عالية وصحة عالية، يشكل تهديداً كبيراً في المعركة. يمتلك أعلى إحصائيات في اللعبة ويمكنه هزيمة معظم الكروت الأخرى." },
                { name: "غول الظلام", description: "مقاتل ضخم يتحمل الضربات بقوة هجومية متوسطة وصحة عالية. كرت متين يمكنه الصمود أمام الهجمات المتعددة وإلحاق الضرر بقوة." },
                { name: "كاهن الرعب", description: "مقاتل متوازن بقوة هجومية وصحة متوسطة. كرت اقتصادي يمكن استدعاؤه بسهولة ويوفر توازناً جيداً بين الهجوم والدفاع." },
                { name: "وادي الصراخ", description: "مقاتل سريع بقوة هجومية متوسطة وصحة منخفضة. كرت اقتصادي يمكن استدعاؤه بسهولة في بداية المعركة لتوفير قوة هجومية سريعة." },
                { name: "وحش الصندوق", description: "مقاتل متوازن بقوة هجومية وصحة متوسطة. كرت جيد للدفاع والهجوم مع إحصائيات متوازنة تجعله خياراً مرناً في الاستراتيجيات المختلفة." }
            ]
        },
        welcome: {
            title: "حرب الفصائل",
            greeting: "مرحباً بك أيها المحارب في ساحة المعركة بين النور والظلام! اكتب اسمك، ثم اختر من تريد أن تواجه.",
            nameLabel: "ما اسمك؟",
            namePlaceholder: "اكتب اسمك هنا",
            nameError: "الرجاء إدخال اسمك أولاً.",
            challengeHumans: "تحدي ناس حقيقيين",
            challengeComputer: "تحدي الكمبيوتر",
            onlineGreeting: "أهلاً {name}! اختر لاعباً من القائمة وتحدَّه.",
            aiGreeting: "أهلاً {name}! اختر فريقك لتواجه العقل الإلكتروني."
        },
        selection: {
            subtitle: "اختر مصيرك: فريق النور أم فريق الظلام؟",
            guideButton: "دليل اللعبة",
            backButton: "رجوع",
            onlineLobby: "اللاعبون المتاحون",
            loadingPlayers: "جارٍ تحميل اللاعبين...",
            challengeTeamTitle: "اختر فريقك",
            challengeTeamPrompt: "اختر الفريق الذي ستلعب به. سيُسند الفريق الآخر إلى خصمك.",
            challenge: "تحدي",
            lightFaction: "فريق النور",
            lightSubtitle: "(حامي النور والعدالة)",
            joinLight: "[ الانضمام لفريق النور ]",
            darkFaction: "فريق الظلام",
            darkSubtitle: "(سيد القوة والظلام)",
            joinDark: "[ الانضمام لفريق الظلام ]",
            bank: "سوق البنك",
            bankClose: "إغلاق",
            cards: {
                resurrect: "بعث الأرواح",
                mercenary: "جيش المرتزقة",
                tax: "ضريبة قسرية",
                bankruptcy: "لعنة الافلاس",
                luck: "لعبة الحظ",
                goldToHealth: "استبدال الذهب بالحياة",
                healthToGold: "استبدال حياة القائد بالذهب"
            }
        },
        battle: {
            lightTeam: "فريق النور",
            darkTeam: "فريق الظلام",
            turn: "دورك",
            battlefield: "ساحة المعركة",
            graveyard: "المقبرة",
            bank: "سوق البنك",
            luck: "لعبة الحظ",
            handCards: "كروت اليد",
            gameEvents: "أحداث اللعبة",
            endTurn: "إنهاء الدور",
            back: "رجوع",
            defaultMessage: "اختر كرتًا أو نفّذ أمرًا لبدء دورك.",
            shopTitle: "سوق البنك",
            shopClose: "إغلاق سوق البنك",
            bankCards: "كروت البنك",
            buyFromBank: "شراء كروت من البنك",
            recoverFromGraveyard: "استعادة كروت من المقبرة",
            buy: "شراء",
            goldToHealth: "استبدال الذهب بالحياة",
            goldToHealthCost: "3 ذهب ← 6 حياة",
            healthToGold: "استبدال حياة القائد بالذهب",
            healthToGoldCost: "2 حياة قائد ← 5 ذهب",
            graveyardCards: "كروت المقبرة",
            insufficientGold: "لا تملك ذهبًا كافيًا",
            ok: "حسنًا",
            turnConfirm: "لقد أنهيت دورك بدون أي حدث",
            withdraw: "هل تريد الانسحاب؟",
            continueTurn: "لا، سوف أواصل",
            noMoveTitle: "عجز عن تنفيذ حركة",
            emergencySacrifice: "لا تملك ذهبًا كافيًا لإنزال كروت ولا توجد أهداف هجومية متاحة لك. هل تريد التضحية بنقطتي حياة (2❤) من القائد للحصول على 5 قطع ذهب ومواصلة اللعب؟",
            acceptSacrifice: "نعم، تضحية بـ 2 حياة (+5 ذهب)",
            declineSacrifice: "لا، إنهاء الدور",
            attackTitle: "اختر من تريد الهجوم عليه",
            noOpponentCards: "لا توجد كروت للخصم في الساحة.",
            noAttackTargets: "لا توجد كروت يمكن مهاجمتها الآن.",
            silenceTitle: "اختر كرتًا لمنعه من الهجوم",
            noSilenceTargets: "لا توجد كروت يمكن منعها.",
            closeAttack: "إلغاء اختيار الهجوم",
            closeSilence: "إلغاء اختيار المنع"
            ,phaseYourTurn: "المرحلة {phase} - دورك"
            ,phaseOpponentTurn: "المرحلة {phase} - دور الخصم"
            ,joinLight: "انضممت إلى فريق النور. اختر كرتًا من يدك وابدأ الهجوم."
            ,joinDark: "انضممت إلى فريق الظلام. اختر كرتًا من يدك وابدأ الهجوم."
            ,aiStarted: "بدأت مباراة ضد الكمبيوتر. ابدأ بإنزال كروتك ثم اضغط إنهاء الدور."
            ,leaderLight: "ملك الفجر"
            ,leaderDark: "سيد الظلال"
            ,victoryEconomicTitle: "نصر اقتصادي!"
            ,victoryMilitaryTitle: "مبروك الانتصار!"
            ,defeatEconomicTitle: "هزيمة اقتصادية"
            ,defeatMilitaryTitle: "حظ أوفر"
            ,victoryEconomicMessage: "أحسنت! جمعت {gold} قطعة ذهب وفاز {winner} بالنصر الاقتصادي!"
            ,victoryMilitaryMessage: "{winner} فاز بالمباراة!"
            ,defeatEconomicMessage: "خسرت المباراة! جمع {winner} عدد {gold} قطعة ذهب وحقق النصر الاقتصادي."
            ,defeatMilitaryMessage: "لقد خسرت اللعبة وفاز {winner}."
            ,bankResurrect: "بعث الأرواح"
            ,bankMercenary: "جيش المرتزقة"
            ,bankTax: "ضريبة قسرية"
            ,bankruptcy: "لعنة الإفلاس"
        },
        card: {
            health: "الحياة",
            attack: "القوة",
            cost: "التكلفة"
        },
        guide: {
            title: "دليل اللعب أونلاين",
            description: "هذا الدليل يشرح طريقة لعب <strong>حرب الفصائل</strong> عبر الإنترنت. يتولى النظام تلقائياً إدارة المباراة، الجولات، الصحة، الذهب، السوق، والتحقق من شروط الفوز.",
            start: "بدء المباراة",
            start1: "اختر فريقك: <strong>فريق النور</strong> أو <strong>فريق الظلام</strong>.",
            start2: "اضغط زر الانضمام لبدء مباراة جديدة أو للانضمام إلى خصم متصل.",
            start3: "يظهر اسمك وفريقك وصحتك وذهبك في الشريط العلوي.",
            start4: "تبدأ المباراة بصحة قائد قدرها <strong>20</strong> و<strong>5</strong> قطع ذهبية.",
            interface: "واجهة المباراة",
            interface1: "<strong>الشريط العلوي:</strong> يعرض صحة وذهب فريقك وخصمك، ويحدد صاحب الدور.",
            interface2: "<strong>ساحة المعركة:</strong> ضع قواتك في الخانات المتاحة لمواجهة قوات الخصم.",
            interface3: "<strong>يدك:</strong> تعرض الكروت المتاحة للاستدعاء، مع تكلفة الكرت وقيمته.",
            interface4: "<strong>سوق البنك:</strong> يضم البطاقات والمعاونة والأسلحة والدروع والتعويذات والمعدات.",
            cards: "الكروت والموارد",
            cards1: "لكل كرت قيمة <strong>حياة</strong> تظهر بجانب أو أسفل صورته.",
            cards2: "لكل كرت قيمة <strong>ذهب</strong> أو تكلفة مرتبطة باستخدامه في المباراة.",
            cards3: "لا يمكنك استخدام كرت إذا لم يكن لديك الذهب الكافي لتكلفته.",
            cards4: "تنخفض حياة الكرت عند تعرضه للهجوم، ويُزال من الساحة عند وصولها إلى الصفر.",
            turnFlow: "سير الدور",
            turnFlow1: "ينتظر النظام حتى يصبح دورك فعالًا.",
            turnFlow2: "استخدم الذهب لشراء كرت أو استدعاء قوة أو تفعيل عنصر من السوق.",
            turnFlow3: "ضع الكروت في الخانات المتاحة داخل ساحة المعركة.",
            turnFlow4: "اختر هدف الهجوم ثم اضغط زر <strong>هجوم</strong>.",
            turnFlow5: "ينفذ النظام الهجوم ويحدّث الصحة والذهب تلقائيًا، ثم ينتقل الدور للخصم.",
            goldIncome: "جدول دخل الذهب الدوري",
            phase1: "1",
            phase1Gold: "5 قطع",
            phase1Desc: "بدء المباراة واستدعاء القوات الأولى.",
            phase2: "2",
            phase2Gold: "4 قطع ذهب",
            phase2Desc: "تدفق ذهب لبناء الاستراتيجية.",
            phase3: "3",
            phase3Gold: "3 قطع",
            phase3Desc: "إدارة الموارد والتخطيط للهجوم.",
            phase4: "4",
            phase4Gold: "قطعتان",
            phase4Desc: "مرحلة اقتصاد حذر.",
            phase5: "5",
            phase5Gold: "قطعة واحدة",
            phase5Desc: "آخر دخل من البنك.",
            phase6: "6 فما فوق",
            phase6Gold: "0، توقف الدخل",
            phase6Desc: "اعتمد على القوات الموجودة في الساحة.",
            goldToHealth: "استبدال حياة القائد بالذهب (التمويل الطارئ)",
            goldToHealth1: "يمكنك التضحية بنقطتي حياة (2❤) من قائد فريقك للحصول على <strong>5 قطع ذهب</strong> لمواصلة المعركة.",
            goldToHealth2: "تتاح هذه الميزة من سوق البنك (مرة واحدة في الجولة)، أو كنافذة طوارئ إذا عجزت عن تنفيذ أي حركة ولم تملك ذهباً كافياً.",
            goldToHealth3: "يشترط أن تكون صحة قائدك أكثر من 2 لتتمكن من التضحية.",
            victory: "شروط الفوز",
            victoryDesc: "يعلن النظام النتيجة تلقائيًا عند تحقق أحد الشرطين:",
            victory1: "<strong>النصر العسكري:</strong> وصول صحة قائد الخصم إلى <strong>0</strong>.",
            victory2: "<strong>النصر الاقتصادي:</strong> وصول ذهبك إلى <strong>25</strong> قطعة داخل خزنتك.",
            connection: "الاتصال والانقطاع",
            connection1: "يظهر مؤشر الدور لتعرف متى يمكنك تنفيذ الأوامر.",
            connection2: "إذا انقطع اتصالك، أعد فتح المباراة أو اضغط العودة ثم انضم مجددًا.",
            connection3: "لا تغلق الصفحة أثناء تنفيذ هجوم أو شراء حتى يكتمل تحديث المباراة."
        }
    }
};

// دالة مساعدة للحصول على قيمة متداخلة من كائن الترجمة
function getNestedValue(obj, path) {
    return path.split('.').reduce((o, i) => o && o[i], obj);
}

// دالة لتغيير اللغة
function setLanguage(lang) {
    const html = document.documentElement;
    const body = document.body;
    
    // تغيير سمات HTML
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    
    // تحديث جميع النصوص
    updateTexts(lang);
    
    // تحديث كروت اللعبة إذا كانت موجودة
    if (typeof renderBattleHand === 'function') {
        const team = battleScreen.dataset.selectedTeam;
        if (team) {
            renderBattleHand(team);
        }
    }
    
    // تحديث الكروت الموزعة في الساحة
    if (typeof refreshDeployedCards === 'function') {
        refreshDeployedCards();
    }
    if (typeof updateVictoryModalText === 'function') {
        updateVictoryModalText();
    }
    
    // تحديث رسالة الترحيب في شاشة الاختيار
    const headerSubtitle = document.getElementById('header-subtitle');
    if (headerSubtitle && window.App && window.App.playerName) {
        const selectionScreen = document.getElementById('selection-screen');
        const mode = selectionScreen && selectionScreen.classList.contains('mode-online') ? 'online' : 'ai';
        const t = translations[lang];
        const greetingKey = mode === 'online' ? 'onlineGreeting' : 'aiGreeting';
        const greeting = t.welcome[greetingKey].replace('{name}', window.App.playerName);
        headerSubtitle.textContent = greeting;
    }
    
    // حفظ اللغة المختارة
    localStorage.setItem('selectedLanguage', lang);
    
    // تحديث زر اللغة
    updateLanguageButton(lang);
}

// دالة لتحديث جميع النصوص
function updateTexts(lang) {
    const t = translations[lang];
    
    // تحديث جميع العناصر التي تحتوي على data-i18n
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const value = getNestedValue(t, key);
        if (value) {
            // استخدام innerHTML إذا كانت القيمة تحتوي على وسوم HTML
            if (value.includes('<') && value.includes('>')) {
                element.innerHTML = value;
            } else {
                element.textContent = value;
            }
        }
    });
    
    // تحديث الـ placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const value = getNestedValue(t, key);
        if (value) {
            element.placeholder = value;
        }
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
        const key = element.getAttribute('data-i18n-aria-label');
        const value = getNestedValue(t, key);
        if (value) element.setAttribute('aria-label', value);
    });
    
    // تحديث عنوان الصفحة
    document.title = t.title;
    
    // تحديث رسالة شريط الأخبار الافتراضية
    const newsTicker = document.getElementById('battle-news-text');
    if (newsTicker && !newsTicker.hasAttribute('data-i18n')) {
        newsTicker.textContent = t.battle.defaultMessage;
    }
    
    // شاشة الاختيار
    const subtitle = document.querySelector('.header-subtitle');
    if (subtitle) subtitle.textContent = t.selection.subtitle;
    
    const guideBtn = document.getElementById('open-guide');
    if (guideBtn) guideBtn.textContent = t.selection.guideButton;
    
    const backBtn = document.getElementById('back-to-welcome');
    if (backBtn) backBtn.textContent = t.selection.backButton;
    
    const lobbyHeader = document.querySelector('.online-lobby-header h2');
    if (lobbyHeader) lobbyHeader.textContent = t.selection.onlineLobby;
    
    const playerList = document.getElementById('online-player-list');
    if (playerList && playerList.querySelector('p')) {
        playerList.querySelector('p').textContent = t.selection.loadingPlayers;
    }
    
    // تحديث عناصر فريق النور
    const lightH2 = document.querySelector('.dawn-faction h2');
    if (lightH2) lightH2.textContent = t.selection.lightFaction;
    
    const lightSubtitle = document.querySelector('.dawn-faction .subtitle');
    if (lightSubtitle) lightSubtitle.textContent = t.selection.lightSubtitle;
    
    const joinLight = document.getElementById('join-light-team');
    if (joinLight) joinLight.textContent = t.selection.joinLight;
    
    // تحديث عناصر فريق الظلام
    const darkH2 = document.querySelector('.shadow-faction h2');
    if (darkH2) darkH2.textContent = t.selection.darkFaction;
    
    const darkSubtitle = document.querySelector('.shadow-faction .subtitle');
    if (darkSubtitle) darkSubtitle.textContent = t.selection.darkSubtitle;
    
    const joinDark = document.getElementById('join-dark-team');
    if (joinDark) joinDark.textContent = t.selection.joinDark;
    
    // تحديث عناصر سوق البنك
    const bankHeader = document.querySelector('.shop-panel .panel-header');
    if (bankHeader) bankHeader.innerHTML = `${t.selection.bank} <span>&gt;</span>`;
    
    const bankFooter = document.querySelector('.shop-footer');
    if (bankFooter) bankFooter.textContent = t.selection.bankClose;
    
    // شاشة المعركة
    const lightTeamH1 = document.querySelector('#light-player-banner h1');
    if (lightTeamH1) lightTeamH1.textContent = t.battle.lightTeam;
    
    const darkTeamH1 = document.querySelector('#dark-player-banner h1');
    if (darkTeamH1) darkTeamH1.textContent = t.battle.darkTeam;
    
    const turnIndicator = document.querySelector('.turn-indicator');
    if (turnIndicator) turnIndicator.textContent = t.battle.turn;
    
    const arenaTitle = document.querySelector('.arena-title');
    if (arenaTitle) arenaTitle.textContent = t.battle.battlefield;
    
    const graveyardH2 = document.querySelector('.battle-graveyard h2');
    if (graveyardH2) graveyardH2.textContent = t.battle.graveyard;
    
    const bankToggle = document.querySelector('#bank-toggle span');
    if (bankToggle) bankToggle.textContent = t.battle.bank;
    
    const lotteryToggle = document.querySelector('#lottery-toggle span');
    if (lotteryToggle) lotteryToggle.textContent = t.battle.luck;
    
    const handToggle = document.querySelector('#hand-toggle');
    if (handToggle) handToggle.setAttribute('aria-label', t.battle.handCards);
    
    const battleNewsStrong = document.querySelector('.battle-news strong');
    if (battleNewsStrong) battleNewsStrong.textContent = t.battle.gameEvents;
    
    const endTurnBtn = document.getElementById('end-turn-button');
    if (endTurnBtn) endTurnBtn.textContent = t.battle.endTurn;
    
    // دليل اللعبة
    const guideTitle = document.getElementById('guide-title');
    if (guideTitle) guideTitle.textContent = t.guide.title;

    const guideContent = document.querySelector('#guide-modal p');
    if (guideContent) guideContent.innerHTML = t.guide.description;

    // تحديث عناصر الدليل التفصيلية يتم تلقائياً عبر data-i18n
}

// دالة لتحديث زر اللغة
function updateLanguageButton(lang) {
    const langBtn = document.getElementById('language-toggle');
    if (langBtn) {
        langBtn.textContent = lang === 'ar' ? 'English' : 'العربية';
    }
}

// دالة لتهيئة نظام اللغة
function initLanguage() {
    // استرجاع اللغة المحفوظة أو استخدام الإنجليزية كافتراضي
    const savedLang = localStorage.getItem('selectedLanguage') || 'en';
    setLanguage(savedLang);
    
    // إضافة مستمع لزر تبديل اللغة
    const langBtn = document.getElementById('language-toggle');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            const currentLang = document.documentElement.getAttribute('lang');
            const newLang = currentLang === 'ar' ? 'en' : 'ar';
            setLanguage(newLang);
        });
    }
}

// تهيئة اللغة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initLanguage);