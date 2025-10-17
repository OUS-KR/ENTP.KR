// today-game.js - 아이디어 발명소 (The Idea Invention Lab)

// --- Utility Functions ---
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "를";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "와";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

// --- Game State Management ---
let gameState = {};
let currentRandFn = null;

function resetGameState() {
    gameState = {
        day: 1,
        ingenuity: 50, // 독창성
        curiosity: 50, // 호기심
        debate: 50,    // 토론
        knowledge: 50, // 지식
        influence: 50, // 영향력
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { parts: 10, energy: 10, patents: 5, breakthroughs: 0 },
        collaborators: [
            { id: "tesla", name: "테슬라", personality: "번뜩이는", skill: "기계공학", synergy: 70 },
            { id: "davinci", name: "다빈치", personality: "박식한", skill: "이론물리", synergy: 60 }
        ],
        maxCollaborators: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { inventionSuccess: 0 },
        dailyActions: { tinkered: false, pitchSessionHeld: false, debatedWith: [], minigamePlayed: false },
        inventionModules: {
            ideaBank: { built: false, durability: 100, name: "아이디어 뱅크", description: "기발한 아이디어를 저장하고 조합합니다.", effect_description: "독창성 보너스 및 아이디어 자동 생성." },
            prototypeStudio: { built: false, durability: 100, name: "프로토타입 스튜디오", description: "아이디어를 실제 형태로 제작합니다.", effect_description: "호기심 향상 및 부품 생성." },
            debateArena: { built: false, durability: 100, name: "토론의 장", description: "아이디어를 검증하고 발전시키는 토론 공간입니다.", effect_description: "새로운 협력자 영입 및 토론 능력 강화." },
            patentOffice: { built: false, durability: 100, name: "특허청", description: "완성된 발명품의 권리를 보호합니다.", effect_description: "과거 기록을 통해 스탯 및 자원 획득." },
            advancedWorkshop: { built: false, durability: 100, name: "고급 작업실", description: "혁신 기술을 사용하는 고급 발명품을 제작합니다.", effect_description: "고급 발명 및 혁신 기술 활용 잠금 해제." }
        },
        techLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('entpInventionGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('entpInventionGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        let loaded = JSON.parse(savedState);
        if (!loaded.dailyBonus) loaded.dailyBonus = { inventionSuccess: 0 };
        if (!loaded.collaborators || loaded.collaborators.length === 0) {
            loaded.collaborators = [
                { id: "tesla", name: "테슬라", personality: "번뜩이는", skill: "기계공학", synergy: 70 },
                { id: "davinci", name: "다빈치", personality: "박식한", skill: "이론물리", synergy: 60 }
            ];
        }
        if (!loaded.knowledge) loaded.knowledge = 50;
        if (!loaded.influence) loaded.influence = 50;

        Object.assign(gameState, loaded);

        currentRandFn = mulberry32(getDailySeed() + gameState.day);

        if (gameState.lastPlayedDate !== today) {
            gameState.day += 1;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    renderAll();
}

function updateState(changes, displayMessage = null) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll(displayMessage);
}

// --- UI Rendering ---
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    if(gameArea && text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    const collaboratorListHtml = gameState.collaborators.map(c => `<li>${c.name} (${c.skill}) - 시너지: ${c.synergy}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>발명:</b> ${gameState.day}일차</p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>독창성:</b> ${gameState.ingenuity} | <b>호기심:</b> ${gameState.curiosity} | <b>토론:</b> ${gameState.debate} | <b>지식:</b> ${gameState.knowledge} | <b>영향력:</b> ${gameState.influence}</p>
        <p><b>자원:</b> 부품 ${gameState.resources.parts}, 에너지 ${gameState.resources.energy}, 특허 ${gameState.resources.patents}, 혁신 기술 ${gameState.resources.breakthroughs || 0}</p>
        <p><b>기술 레벨:</b> ${gameState.techLevel}</p>
        <p><b>협력자 (${gameState.collaborators.length}/${gameState.maxCollaborators}):</b></p>
        <ul>${collaboratorListHtml}</ul>
        <p><b>설치된 모듈:</b></p>
        <ul>${Object.values(gameState.inventionModules).filter(m => m.built).map(m => `<li>${m.name} (내구성: ${m.durability}) - ${m.effect_description}</li>`).join('') || '없음'}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = [];

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    } else if (gameState.currentScenarioId === 'action_module_management') {
        dynamicChoices = gameScenarios.action_module_management.choices ? [...gameScenarios.action_module_management.choices] : [];
        if (!gameState.inventionModules.ideaBank.built) dynamicChoices.push({ text: "아이디어 뱅크 구축 (부품 50, 에너지 20)", action: "build_ideaBank" });
        if (!gameState.inventionModules.prototypeStudio.built) dynamicChoices.push({ text: "프로토타입 스튜디오 구축 (에너지 30, 부품 30)", action: "build_prototypeStudio" });
        if (!gameState.inventionModules.debateArena.built) dynamicChoices.push({ text: "토론의 장 구축 (부품 100, 에너지 50, 특허 50)", action: "build_debateArena" });
        if (!gameState.inventionModules.patentOffice.built) dynamicChoices.push({ text: "특허청 구축 (에너지 80, 특허 40)", action: "build_patentOffice" });
        if (gameState.inventionModules.prototypeStudio.built && gameState.inventionModules.prototypeStudio.durability > 0 && !gameState.inventionModules.advancedWorkshop.built) {
            dynamicChoices.push({ text: "고급 작업실 구축 (에너지 50, 특허 100)", action: "build_advancedWorkshop" });
        }
        Object.keys(gameState.inventionModules).forEach(key => {
            const module = gameState.inventionModules[key];
            if (module.built && module.durability < 100) {
                dynamicChoices.push({ text: `${module.name} 유지보수 (에너지 10, 부품 10)`, action: "maintain_module", params: { module: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}'>${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll(customDisplayMessage = null) {
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(customDisplayMessage || scenario.text);
        renderChoices(scenario.choices);
    }
}

// --- Game Data (to be themed for ENTP) ---
const gameScenarios = {
    "intro": { text: "오늘은 어떤 기발한 일을 해볼까요?", choices: [
        { text: "이것저것 만져보기", action: "tinker" },
        { text: "협력자와 토론하기", action: "debate_with_collaborators" },
        { text: "아이디어 발표회", action: "pitch_session" },
        { text: "자원 수집", action: "show_resource_gathering_options" },
        { text: "발명 모듈 관리", action: "show_module_options" },
        { text: "엉뚱한 실험", action: "show_wacky_experiments_options" },
        { text: "오늘의 두뇌 유희", action: "play_minigame" }
    ]},
    // ... more ENTP-themed scenarios
};

// ... (Full game logic will be implemented here)

// --- Initialization ---
window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', () => {
            if (gameState.manualDayAdvances >= 5) {
                updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요.");
                return;
            }
            updateState({
                manualDayAdvances: gameState.manualDayAdvances + 1,
                day: gameState.day + 1,
                lastPlayedDate: new Date().toISOString().slice(0, 10),
                dailyEventTriggered: false
            });
            processDailyEvents();
        });
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};