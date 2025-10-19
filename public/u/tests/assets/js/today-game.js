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

function showFeedback(isSuccess, message) {
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (feedbackMessage) {
        feedbackMessage.innerText = message;
        feedbackMessage.className = `feedback-message ${isSuccess ? 'correct' : 'incorrect'}`;
    }
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
        // Patch for old save files
        if (!loaded.dailyBonus) loaded.dailyBonus = { inventionSuccess: 0 };
        if (!loaded.collaborators || loaded.collaborators.length === 0) {
            loaded.collaborators = [
                { id: "tesla", name: "테슬라", personality: "번뜩이는", skill: "기계공학", synergy: 70 },
                { id: "davinci", name: "다빈치", personality: "박식한", skill: "이론물리", synergy: 60 }
            ];
        }
        if (loaded.knowledge === undefined) loaded.knowledge = 50;
        if (loaded.influence === undefined) loaded.influence = 50;

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
        dynamicChoices = [];
        if (!gameState.inventionModules.ideaBank.built) dynamicChoices.push({ text: "아이디어 뱅크 구축 (부품 50, 에너지 20)", action: "build_ideaBank" });
        if (!gameState.inventionModules.prototypeStudio.built) dynamicChoices.push({ text: "프로토타입 스튜디오 구축 (에너지 30, 부품 30)", action: "build_prototypeStudio" });
        if (!gameState.inventionModules.debateArena.built) dynamicChoices.push({ text: "토론의 장 구축 (부품 100, 에너지 50)", action: "build_debateArena" });
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

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}' >${choice.text}</button>`).join('');
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

// --- Game Data (ENTP Themed) ---
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
    "daily_event_debate_challenge": {
        text: "외부에서 명성 높은 토론가가 당신에게 지적 대결을 신청했습니다.",
        choices: [
            { text: "도전을 받아들인다.", action: "accept_debate_challenge" },
            { text: "관심 없다며 거절한다.", action: "decline_debate_challenge" }
        ]
    },
    "daily_event_energy_overload": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_patent_dispute": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_new_collaborator": {
        choices: [
            { text: "새로운 협력자를 영입한다.", action: "welcome_new_collaborator" },
            { text: "그의 능력을 좀 더 지켜본다.", action: "observe_collaborator" },
            { text: "영입을 거절한다.", action: "reject_collaborator" }
        ]
    },
    "game_over_ingenuity": { text: "독창성이 고갈되어 더 이상 새로운 아이디어를 내지 못합니다. 발명소는 문을 닫습니다.", choices: [], final: true },
    "game_over_curiosity": { text: "호기심을 잃었습니다. 세상을 탐구하고 새로운 것을 발견하려는 동력을 상실했습니다.", choices: [], final: true },
    "game_over_debate": { text: "끝없는 토론에 지쳐 아무도 당신의 말을 듣지 않습니다. 당신의 논리는 힘을 잃었습니다.", choices: [], final: true },
    "game_over_knowledge": { text: "지식이 부족하여 더 이상 혁신적인 아이디어를 발전시킬 수 없습니다.", choices: [], final: true },
    "game_over_influence": { text: "당신의 영향력이 바닥나 아무도 당신의 아이디어에 투자하지 않습니다.", choices: [], final: true },
    "game_over_resources": { text: "자원이 고갈되어 발명소를 더 이상 운영할 수 없습니다.", choices: [], final: true },
    "action_resource_gathering": {
        text: "어떤 자원을 수집하시겠습니까?",
        choices: [
            { text: "부품 수집", action: "gather_parts" },
            { text: "에너지 충전", action: "charge_energy" },
            { text: "특허 검색", "action": "search_patents" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_module_management": { text: "어떤 모듈을 관리하시겠습니까?", choices: [] },
    "wacky_experiments_menu": {
        text: "어떤 엉뚱한 실험을 해볼까요?",
        choices: [
            { text: "위험한 실험 (행동력 1 소모)", action: "conduct_risky_experiment" },
            { text: "시간 여행 장치 (행동력 1 소모)", action: "build_time_machine" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
};

const tinkerOutcomes = [
    { weight: 30, condition: (gs) => gs.curiosity > 60, effect: (gs) => { const v = getRandomValue(10, 5); return { changes: { ingenuity: gs.ingenuity + v }, message: `이것저것 만져보다 새로운 아이디어가 떠올랐습니다! (+${v} 독창성)` }; } },
    { weight: 25, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { knowledge: gs.knowledge + v }, message: `기계를 분해하고 조립하며 새로운 지식을 얻었습니다. (+${v} 지식)` }; } },
    { weight: 20, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { resources: { ...gs.resources, parts: gs.resources.parts - v } }, message: `실수로 부품을 망가뜨렸습니다. (-${v} 부품)` }; } },
    { weight: 15, condition: (gs) => gs.curiosity < 40, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { curiosity: gs.curiosity - v }, message: `아무것도 흥미롭지 않습니다. 호기심이 감소합니다. (-${v} 호기심)` }; } },
];

const debateOutcomes = [
    { weight: 40, condition: (gs, col) => col.synergy < 80, effect: (gs, col) => { const v = getRandomValue(10, 5); const updated = gs.collaborators.map(c => c.id === col.id ? { ...c, synergy: Math.min(100, c.synergy + v) } : c); return { changes: { collaborators: updated }, message: `${col.name}${getWaGwaParticle(col.name)}의 열띤 토론으로 시너지가 상승했습니다. (+${v} 시너지)` }; } },
    { weight: 30, condition: () => true, effect: (gs, col) => { const v = getRandomValue(5, 2); return { changes: { debate: gs.debate + v }, message: `${col.name}에게서 새로운 토론 기술을 배웠습니다. (+${v} 토론)` }; } },
    { weight: 20, condition: (gs) => gs.influence < 40, effect: (gs, col) => { const v = getRandomValue(10, 3); const updated = gs.collaborators.map(c => c.id === col.id ? { ...c, synergy: Math.max(0, c.synergy - v) } : c); return { changes: { collaborators: updated }, message: `당신의 논리가 부족하여 ${col.name}이(가) 실망합니다. (-${v} 시너지)` }; } },
];

const pitchOutcomes = [
    { weight: 40, condition: (gs) => gs.ingenuity > 60, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { influence: gs.influence + v }, message: `독창적인 아이디어 발표로 투자자들의 마음을 사로잡았습니다. (+${v} 영향력)` }; } },
    { weight: 30, condition: () => true, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { knowledge: gs.knowledge + v }, message: `발표를 준비하며 관련 지식이 늘었습니다. (+${v} 지식)` }; } },
    { weight: 20, condition: (gs) => gs.debate < 40, effect: (gs) => { const v = getRandomValue(10, 4); return { changes: { influence: gs.influence - v }, message: `날카로운 질문에 제대로 답변하지 못해 영향력이 감소했습니다. (-${v} 영향력)` }; } },
];

const minigames = [
    {
        name: "논리 회로 연결",
        description: "주어진 입출력 조건에 맞게 논리 게이트(AND, OR, NOT)를 연결하여 올바른 회로를 완성하세요.",
        start: (gameArea, choicesDiv) => {
            // Minigame logic will be implemented here
            gameState.minigameState = { score: 0 };
            gameArea.innerHTML = `<p>${minigames[0].description}</p><p>미니게임 시작!</p>`;
            choicesDiv.innerHTML = `<button class="choice-btn" onclick="minigames[0].processAction('endGame')">게임 종료</button>`;
        },
        render: () => {}, // Placeholder
        processAction: (actionType) => { if (actionType === 'endGame') minigames[0].end(); },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({ ingenuity: gameState.ingenuity + rewards.ingenuity, knowledge: gameState.knowledge + rewards.knowledge, currentScenarioId: 'intro' }, rewards.message);
        }
    },
];

function calculateMinigameReward(minigameName, score) {
    let rewards = { ingenuity: 0, knowledge: 0, message: "" };
    if (score >= 100) { rewards.ingenuity = 15; rewards.knowledge = 10; rewards.message = `완벽한 논리입니다! (+15 독창성, +10 지식)`; } 
    else if (score >= 50) { rewards.ingenuity = 10; rewards.knowledge = 5; rewards.message = `훌륭한 회로입니다. (+10 독창성, +5 지식)`; } 
    else { rewards.ingenuity = 5; rewards.message = `회로를 완성했습니다. (+5 독창성)`; }
    return rewards;
}

function spendActionPoint() {
    if (gameState.actionPoints <= 0) { updateGameDisplay("행동력이 부족합니다."); return false; }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    tinker: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = tinkerOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    debate_with_collaborators: () => {
        if (!spendActionPoint()) return;
        const collaborator = gameState.collaborators[Math.floor(currentRandFn() * gameState.collaborators.length)];
        const possibleOutcomes = debateOutcomes.filter(o => !o.condition || o.condition(gameState, collaborator));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState, collaborator);
        updateState(result.changes, result.message);
    },
    pitch_session: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = pitchOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_module_options: () => updateState({ currentScenarioId: 'action_module_management' }),
    show_wacky_experiments_options: () => updateState({ currentScenarioId: 'wacky_experiments_menu' }),
    gather_parts: () => {
        if (!spendActionPoint()) return;
        const partsGain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, parts: gameState.resources.parts + partsGain } }, `부품을 수집했습니다. (+${partsGain} 부품)`);
    },
    charge_energy: () => {
        if (!spendActionPoint()) return;
        const energyGain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, energy: gameState.resources.energy + energyGain } }, `에너지를 충전했습니다. (+${energyGain} 에너지)`);
    },
    search_patents: () => {
        if (!spendActionPoint()) return;
        const patentsGain = getRandomValue(5, 2);
        updateState({ resources: { ...gameState.resources, patents: gameState.resources.patents + patentsGain } }, `새로운 특허를 발견했습니다. (+${patentsGain} 특허)`);
    },
    build_ideaBank: () => {
        if (!spendActionPoint()) return;
        const cost = { parts: 50, energy: 20 };
        if (gameState.resources.parts >= cost.parts && gameState.resources.energy >= cost.energy) {
            gameState.inventionModules.ideaBank.built = true;
            const ingenuityGain = getRandomValue(10, 3);
            updateState({ ingenuity: gameState.ingenuity + ingenuityGain, resources: { ...gameState.resources, parts: gameState.resources.parts - cost.parts, energy: gameState.resources.energy - cost.energy } }, `아이디어 뱅크를 구축했습니다! (+${ingenuityGain} 독창성)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_prototypeStudio: () => {
        if (!spendActionPoint()) return;
        const cost = { energy: 30, parts: 30 };
        if (gameState.resources.energy >= cost.energy && gameState.resources.parts >= cost.parts) {
            gameState.inventionModules.prototypeStudio.built = true;
            const curiosityGain = getRandomValue(10, 3);
            updateState({ curiosity: gameState.curiosity + curiosityGain, resources: { ...gameState.resources, energy: gameState.resources.energy - cost.energy, parts: gameState.resources.parts - cost.parts } }, `프로토타입 스튜디오를 구축했습니다! (+${curiosityGain} 호기심)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_debateArena: () => {
        if (!spendActionPoint()) return;
        const cost = { parts: 100, energy: 50 };
        if (gameState.resources.parts >= cost.parts && gameState.resources.energy >= cost.energy) {
            gameState.inventionModules.debateArena.built = true;
            const debateGain = getRandomValue(15, 5);
            updateState({ debate: gameState.debate + debateGain, resources: { ...gameState.resources, parts: gameState.resources.parts - cost.parts, energy: gameState.resources.energy - cost.energy } }, `토론의 장을 구축했습니다! (+${debateGain} 토론)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_patentOffice: () => {
        if (!spendActionPoint()) return;
        const cost = { energy: 80, patents: 40 };
        if (gameState.resources.energy >= cost.energy && gameState.resources.patents >= cost.patents) {
            gameState.inventionModules.patentOffice.built = true;
            const knowledgeGain = getRandomValue(15, 5);
            updateState({ knowledge: gameState.knowledge + knowledgeGain, resources: { ...gameState.resources, energy: gameState.resources.energy - cost.energy, patents: gameState.resources.patents - cost.patents } }, `특허청을 구축했습니다! (+${knowledgeGain} 지식)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_advancedWorkshop: () => {
        if (!spendActionPoint()) return;
        const cost = { energy: 50, patents: 100 };
        if (gameState.resources.energy >= cost.energy && gameState.resources.patents >= cost.patents) {
            gameState.inventionModules.advancedWorkshop.built = true;
            const ingenuityGain = getRandomValue(20, 5);
            updateState({ ingenuity: gameState.ingenuity + ingenuityGain, resources: { ...gameState.resources, energy: gameState.resources.energy - cost.energy, patents: gameState.resources.patents - cost.patents } }, `고급 작업실을 구축했습니다! (+${ingenuityGain} 독창성)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    maintain_module: (params) => {
        if (!spendActionPoint()) return;
        const moduleKey = params.module;
        const cost = { energy: 10, parts: 10 };
        if (gameState.resources.energy >= cost.energy && gameState.resources.parts >= cost.parts) {
            gameState.inventionModules[moduleKey].durability = 100;
            updateState({ resources: { ...gameState.resources, energy: gameState.resources.energy - cost.energy, parts: gameState.resources.parts - cost.parts } }, `${gameState.inventionModules[moduleKey].name} 모듈을 보수했습니다.`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    conduct_risky_experiment: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) {
            const breakthroughGain = getRandomValue(1, 1);
            updateState({ resources: { ...gameState.resources, breakthroughs: (gameState.resources.breakthroughs || 0) + breakthroughGain } }, `위험한 실험 끝에 혁신 기술을 발견했습니다! (+${breakthroughGain} 혁신 기술)`);
        } else {
            const partsLoss = getRandomValue(20, 5);
            updateState({ resources: { ...gameState.resources, parts: gameState.resources.parts - partsLoss } }, `실험이 폭발하여 부품을 잃었습니다. (-${partsLoss} 부품)`);
        }
    },
    build_time_machine: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.1) {
            const knowledgeGain = getRandomValue(50, 10);
            updateState({ knowledge: gameState.knowledge + knowledgeGain }, `시간 여행에 성공하여 미래의 지식을 얻었습니다! (+${knowledgeGain} 지식)`);
        } else {
            const curiosityLoss = getRandomValue(10, 5);
            updateState({ curiosity: gameState.curiosity - curiosityLoss }, `시간 여행 장치가 작동하지 않습니다. 호기심이 감소합니다. (-${curiosityLoss} 호기심)`);
        }
    },
    play_minigame: () => {
        if (!spendActionPoint()) return;
        const minigame = minigames[0];
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } });
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
};

function applyStatEffects() {
    let message = "";
    if (gameState.ingenuity >= 70) { message += "넘치는 독창성으로 발명 성공률이 증가합니다. "; }
    if (gameState.curiosity >= 70) { const v = getRandomValue(5, 2); gameState.resources.parts += v; message += `주체할 수 없는 호기심으로 새로운 부품을 발견했습니다. (+${v} 부품) `; }
    if (gameState.debate >= 70) { const v = getRandomValue(2, 1); gameState.collaborators.forEach(c => c.synergy = Math.min(100, c.synergy + v)); message += `날카로운 토론 실력으로 협력자들의 시너지가 상승합니다. (+${v} 시너지) `; }
    if (gameState.knowledge < 30) { gameState.actionPoints -= 1; message += "지식이 부족하여 행동력이 1 감소합니다. "; }
    if (gameState.influence < 30) { Object.keys(gameState.inventionModules).forEach(key => { if(gameState.inventionModules[key].built) gameState.inventionModules[key].durability -= 1; }); message += "영향력이 약화되어 모듈들이 빠르게 노후화됩니다. "; }
    return message;
}

const weightedDailyEvents = [
    { id: "daily_event_debate_challenge", weight: 15, condition: () => true },
    { id: "daily_event_energy_overload", weight: 10, condition: () => true, onTrigger: () => { const v = getRandomValue(10, 5); updateState({ resources: { ...gameState.resources, energy: Math.max(0, gameState.resources.energy - v) } }, `에너지 과부하로 시스템이 손상되었습니다. (-${v} 에너지)`); } },
    { id: "daily_event_patent_dispute", weight: 10, condition: () => gameState.resources.patents > 5, onTrigger: () => { const v = getRandomValue(5, 2); updateState({ resources: { ...gameState.resources, patents: Math.max(0, gameState.resources.patents - v) } }, `특허 분쟁에 휘말렸습니다. (-${v} 특허)`); } },
    { id: "daily_event_new_collaborator", weight: 10, condition: () => gameState.inventionModules.debateArena.built && gameState.collaborators.length < gameState.maxCollaborators, onTrigger: () => {
        const newCollaborator = { id: "newbie", name: "신입", personality: "열정적인", skill: "프로그래밍", synergy: 50 };
        gameState.pendingNewCollaborator = newCollaborator;
        gameScenarios["daily_event_new_collaborator"].text = `새로운 협력자 ${newCollaborator.name}(${newCollaborator.personality}, ${newCollaborator.skill})이(가) 합류하고 싶어 합니다. (현재 협력자 수: ${gameState.collaborators.length} / ${gameState.maxCollaborators})`;
    }},
];

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
    updateState({ actionPoints: 10, dailyEventTriggered: true });
    const statEffectMessage = applyStatEffects();
    let dailyMessage = "새로운 발명의 날이 밝았습니다. " + statEffectMessage;

    if (gameState.ingenuity <= 0) { gameState.currentScenarioId = "game_over_ingenuity"; }
    else if (gameState.curiosity <= 0) { gameState.currentScenarioId = "game_over_curiosity"; }
    else if (gameState.debate <= 0) { gameState.currentScenarioId = "game_over_debate"; }
    else if (gameState.knowledge <= 0) { gameState.currentScenarioId = "game_over_knowledge"; }
    else if (gameState.influence <= 0) { gameState.currentScenarioId = "game_over_influence"; }
    else if (gameState.resources.parts <= 0 && gameState.resources.energy <= 0) { gameState.currentScenarioId = "game_over_resources"; }

    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    if (possibleEvents.length > 0) {
        const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenEvent = possibleEvents.find(event => (cumulativeWeight += event.weight) >= rand);
        if (chosenEvent) {
            eventId = chosenEvent.id;
            if (chosenEvent.onTrigger) chosenEvent.onTrigger();
        }
    }
    if (!gameScenarios[gameState.currentScenarioId]) {
        gameState.currentScenarioId = eventId;
    }
    updateGameDisplay(dailyMessage + (gameScenarios[gameState.currentScenarioId]?.text || ''));
    renderChoices(gameScenarios[gameState.currentScenarioId]?.choices || []);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 발명소를 폐쇄하시겠습니까? 모든 아이디어가 사라집니다.")) {
        localStorage.removeItem('entpInventionGame');
        resetGameState();
        saveGameState();
        location.reload();
    }
}

window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', gameActions.manualNextDay);
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};
