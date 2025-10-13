// today-game.js - 아이디어 발명소 (The Invention Lab)

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

function getEulReParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "";
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
        ingenuity: 50,
        curiosity: 50,
        debate: 50,
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { spark: 10, components: 10, funding: 5, disruptive_tech: 0 },
        collaborators: [
            { id: "edison", name: "에디슨", personality: "실용적", skill: "기계공학", synergy: 70 },
            { id: "da_vinci", name: "다빈치", personality: "박식한", skill: "이론물리", synergy: 60 }
        ],
        maxCollaborators: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { collectionSuccess: 0 },
        dailyActions: { explored: false, debateHeld: false, talkedTo: [], minigamePlayed: false },
        inventionModules: {
            ideaBank: { built: false, durability: 100 },
            prototypeStudio: { built: false, durability: 100 },
            debateHall: { built: false, durability: 100 },
            patentOffice: { built: false, durability: 100 },
            advancedWorkshop: { built: false, durability: 100 }
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
        if (!loaded.dailyBonus) loaded.dailyBonus = { collectionSuccess: 0 };
        if (!loaded.collaborators || loaded.collaborators.length === 0) {
            loaded.collaborators = [
                { id: "edison", name: "에디슨", personality: "실용적", skill: "기계공학", synergy: 70 },
                { id: "da_vinci", name: "다빈치", personality: "박식한", skill: "이론물리", synergy: 60 }
            ];
        }
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
        <p><b>연구:</b> ${gameState.day}일차</p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>독창성:</b> ${gameState.ingenuity} | <b>호기심:</b> ${gameState.curiosity} | <b>토론:</b> ${gameState.debate}</p>
        <p><b>자원:</b> 영감의 불꽃 ${gameState.resources.spark}, 부품 ${gameState.resources.components}, 연구자금 ${gameState.resources.funding}, 혁신 기술 ${gameState.resources.disruptive_tech || 0}</p>
        <p><b>기술 레벨:</b> ${gameState.techLevel}</p>
        <p><b>협력자 (${gameState.collaborators.length}/${gameState.maxCollaborators}):</b></p>
        <ul>${collaboratorListHtml}</ul>
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
    } else if (gameState.currentScenarioId === 'action_facility_management') {
        dynamicChoices = gameScenarios.action_facility_management.choices ? [...gameScenarios.action_facility_management.choices] : [];
        if (!gameState.inventionModules.ideaBank.built) dynamicChoices.push({ text: "아이디어 뱅크 구축 (영감 50, 부품 20)", action: "build_idea_bank" });
        if (!gameState.inventionModules.prototypeStudio.built) dynamicChoices.push({ text: "프로토타입 스튜디오 구축 (부품 30, 연구자금 30)", action: "build_prototype_studio" });
        if (!gameState.inventionModules.debateHall.built) dynamicChoices.push({ text: "토론의 장 건설 (영감 100, 부품 50, 연구자금 50)", action: "build_debate_hall" });
        if (!gameState.inventionModules.patentOffice.built) dynamicChoices.push({ text: "특허청 설립 (부품 80, 연구자금 40)", action: "build_patent_office" });
        if (gameState.inventionModules.prototypeStudio.built && gameState.inventionModules.prototypeStudio.durability > 0 && !gameState.inventionModules.advancedWorkshop.built) {
            dynamicChoices.push({ text: "고급 작업실 증축 (부품 50, 연구자금 100)", action: "build_advanced_workshop" });
        }
        Object.keys(gameState.inventionModules).forEach(key => {
            const facility = gameState.inventionModules[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${key} 유지보수 (부품 10, 연구자금 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}''>${choice.text}</button>`).join('');
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

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "어떤 기발한 일을 해볼까요?", choices: [
        { text: "연구소 탐색", action: "explore" },
        { text: "협력자와 토론하기", action: "talk_to_collaborators" },
        { text: "난상 토론 개최", action: "hold_debate" },
        { text: "자원/아이디어 수집", action: "show_resource_collection_options" },
        { text: "발명 모듈 관리", action: "show_facility_options" },
        { text: "오늘의 미니게임", action: "play_minigame" }
    ]},
    "daily_event_patent_dispute": {
        text: "협력자 에디슨과 다빈치 사이에 특허 분쟁이 발생했습니다. 둘 다 아이디어의 소유권을 주장하고 있습니다.",
        choices: [
            { text: "에디슨의 실용성을 인정한다.", action: "handle_dispute", params: { first: "edison", second: "da_vinci" } },
            { text: "다빈치의 독창성을 높이 산다.", action: "handle_dispute", params: { first: "da_vinci", second: "edison" } },
            { text: "두 아이디어를 합쳐 새로운 발명품을 만들자고 제안한다.", action: "mediate_dispute" },
            { text: "치열한 경쟁은 더 나은 발명을 낳는 법이다.", action: "ignore_event" }
        ]
    },
    "daily_event_competitor": { text: "경쟁사에서 신기술을 발표했습니다. 연구자금이 일부 유출되었습니다. (-10 연구자금)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_flaw": { text: "개발 중인 프로토타입에서 치명적인 설계 결함이 발견되었습니다. (-10 부품)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_investor_visit": {
        text: "유명 투자자가 발명소에 관심을 보입니다. [연구자금 50]을 사용하여 시제품을 선보이면 [혁신 기술]에 대한 투자를 받을 수 있습니다.",
        choices: [
            { text: "시제품을 선보인다", action: "accept_investment" },
            { text: "아직 때가 아니다", action: "decline_investment" }
        ]
    },
    "daily_event_new_collaborator": {
        choices: [
            { text: "그의 아이디어를 듣고 즉시 영입한다.", action: "welcome_new_unique_collaborator" },
            { text: "그와 끝장 토론을 벌여본다.", action: "observe_collaborator" },
            { text: "나와는 방향이 다른 것 같다.", action: "reject_collaborator" }
        ]
    },
    "game_over_ingenuity": { text: "발명소의 독창성이 고갈되었습니다. 더 이상 새로운 아이디어는 나오지 않습니다.", choices: [], final: true },
    "game_over_curiosity": { text: "호기심이 사라진 발명소는 정체되었습니다. 협력자들은 흥미를 잃고 떠납니다.", choices: [], final: true },
    "game_over_debate": { text: "건강한 토론 문화가 사라졌습니다. 아무도 자신의 아이디어를 공유하지 않습니다.", choices: [], final: true },
    "game_over_resources": { text: "발명소의 자원이 고갈되어 더 이상 운영할 수 없습니다.", choices: [], final: true },
    "action_resource_collection": {
        text: "어떤 자원/아이디어를 수집하시겠습니까?",
        choices: [
            { text: "브레인스토밍 (영감의 불꽃)", action: "perform_collect_spark" },
            { text: "고물상 뒤지기 (부품)", action: "perform_gather_components" },
            { text: "투자 유치 (연구자금)", "action": "perform_raise_funding" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_facility_management": {
        text: "어떤 발명 모듈을 관리하시겠습니까?",
        choices: []
    },
    "resource_collection_result": {
        text: "",
        choices: [{ text: "확인", action: "show_resource_collection_options" }]
    },
    "facility_management_result": {
        text: "",
        choices: [{ text: "확인", action: "show_facility_options" }]
    },
    "dispute_resolution_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    }
};

function calculateMinigameReward(minigameName, score) {
    let rewards = { ingenuity: 0, curiosity: 0, debate: 0, message: "" };

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.curiosity = 15;
                rewards.ingenuity = 10;
                rewards.debate = 5;
                rewards.message = "엄청난 기억력입니다! 새로운 아이디어가 샘솟습니다. (+15 호기심, +10 독창성, +5 토론)";
            } else if (score >= 21) {
                rewards.curiosity = 10;
                rewards.ingenuity = 5;
                rewards.message = "훌륭한 기억력입니다. (+10 호기심, +5 독창성)";
            } else if (score >= 0) {
                rewards.curiosity = 5;
                rewards.message = "두뇌 훈련을 완료했습니다. (+5 호기심)";
            } else {
                rewards.message = "두뇌 훈련을 완료했지만, 아쉽게도 보상은 없습니다.";
            }
            break;
        case "역발상 퀴즈":
            rewards.ingenuity = 10;
            rewards.message = "기존의 틀을 깨는 답변입니다! (+10 독창성)";
            break;
        case "즉흥 토론 챌린지":
            rewards.debate = 10;
            rewards.ingenuity = 5;
            rewards.message = "논리적인 승리입니다! (+10 토론, +5 독창성)";
            break;
        case "신기술 조합하기":
            rewards.ingenuity = 15;
            rewards.message = "세상을 바꿀 발명품이 탄생했습니다! (+15 독창성)";
            break;
        case "궤변 논파하기":
            rewards.debate = 15;
            rewards.message = "상대방의 궤변을 완벽하게 논파했습니다! (+15 토론)";
            break;
        default:
            rewards.message = `미니게임 ${minigameName}을(를) 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "기억력 순서 맞추기",
        description: "화면에 나타나는 패턴을 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { currentSequence: [], playerInput: [], stage: 1, score: 0, showingSequence: false };
            minigames[0].render(gameArea, choicesDiv);
            minigames[0].showSequence();
        },
        render: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `
                <p><b>단계:</b> ${gameState.minigameState.stage} | <b>점수:</b> ${gameState.minigameState.score}</p>
                <p id="sequenceDisplay" style="font-size: 2em; font-weight: bold; min-height: 1.5em;"></p>
                <p>패턴을 기억하고 입력하세요:</p>
                <div id="playerInputDisplay" style="font-size: 1.5em; min-height: 1.5em;">${gameState.minigameState.playerInput.join(' ')}</div>
            `;
            choicesDiv.innerHTML = `
                <div class="number-pad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="choice-btn num-btn" data-value="${num}">${num}</button>`).join('')}
                    <button class="choice-btn num-btn" data-value="0">0</button>
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.num-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const sequenceLength = gameState.minigameState.stage + 2;
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(Math.floor(currentRandFn() * 10));
            }

            const sequenceDisplay = document.getElementById('sequenceDisplay');
            let i = 0;
            const interval = setInterval(() => {
                if (i < gameState.minigameState.currentSequence.length) {
                    sequenceDisplay.innerText = gameState.minigameState.currentSequence[i];
                    i++;
                } else {
                    clearInterval(interval);
                    sequenceDisplay.innerText = "입력하세요!";
                    gameState.minigameState.showingSequence = false;
                }
            }, 800);
        },
        processAction: (actionType, value = null) => {
            if (gameState.minigameState.showingSequence) return;

            if (actionType === 'addInput') {
                gameState.minigameState.playerInput.push(parseInt(value));
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((num, i) => num === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("오답입니다. 게임 종료.");
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({
                ingenuity: gameState.ingenuity + rewards.ingenuity,
                curiosity: gameState.curiosity + rewards.curiosity,
                debate: gameState.debate + rewards.debate,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    { name: "역발상 퀴즈", description: "상식을 뒤엎는 질문에 가장 창의적인 답변을 하세요.", start: (ga, cd) => { ga.innerHTML = "<p>역발상 퀴즈 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[1].end()'>종료</button>"; gameState.minigameState = { score: 10 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[1].name, gameState.minigameState.score); updateState({ ingenuity: gameState.ingenuity + r.ingenuity, curiosity: gameState.curiosity + r.curiosity, debate: gameState.debate + r.debate, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "즉흥 토론 챌린지", description: "주어진 주제에 대해 즉흥적으로 논리를 펼쳐 상대를 설득하세요.", start: (ga, cd) => { ga.innerHTML = "<p>즉흥 토론 챌린지 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[2].end()'>종료</button>"; gameState.minigameState = { score: 15 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[2].name, gameState.minigameState.score); updateState({ ingenuity: gameState.ingenuity + r.ingenuity, curiosity: gameState.curiosity + r.curiosity, debate: gameState.debate + r.debate, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "신기술 조합하기", description: "서로 다른 기술들을 조합하여 새로운 발명품을 구상하세요.", start: (ga, cd) => { ga.innerHTML = "<p>신기술 조합하기 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[3].end()'>종료</button>"; gameState.minigameState = { score: 20 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[3].name, gameState.minigameState.score); updateState({ ingenuity: gameState.ingenuity + r.ingenuity, curiosity: gameState.curiosity + r.curiosity, debate: gameState.debate + r.debate, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "궤변 논파하기", description: "상대방의 궤변에 숨겨진 논리적 오류를 찾아내 반박하세요.", start: (ga, cd) => { ga.innerHTML = "<p>궤변 논파하기 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[4].end()'>종료</button>"; gameState.minigameState = { score: 25 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[4].name, gameState.minigameState.score); updateState({ ingenuity: gameState.ingenuity + r.ingenuity, curiosity: gameState.curiosity + r.curiosity, debate: gameState.debate + r.debate, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } }
];

// --- Game Actions ---
function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("행동력이 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    explore: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.explored) { updateState({ dailyActions: { ...gameState.dailyActions, explored: true } }, "오늘은 더 이상 새로운 것을 발견하지 못했습니다."); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, explored: true } };
        let message = "연구소를 탐색하니 새로운 아이디어가 떠오를 것 같습니다.";
        const rand = currentRandFn();
        if (rand < 0.3) { message += " 기발한 아이디어를 얻었습니다. (+2 영감의 불꽃)"; changes.spark = gameState.resources.spark + 2; }
        else if (rand < 0.6) { message += " 쓸만한 부품을 발견했습니다. (+2 부품)"; changes.resources = { ...gameState.resources, components: gameState.resources.components + 2 }; }
        else { message += " 특별한 것은 발견하지 못했습니다."; }
        
        updateState(changes, message);
    },
    talk_to_collaborators: () => {
        if (!spendActionPoint()) return;
        const collaborator = gameState.collaborators[Math.floor(currentRandFn() * gameState.collaborators.length)];
        if (gameState.dailyActions.talkedTo.includes(collaborator.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, collaborator.id] } }, `${collaborator.name}${getWaGwaParticle(collaborator.name)} 이미 열띤 토론을 벌였습니다.`); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, collaborator.id] } };
        let message = `${collaborator.name}${getWaGwaParticle(collaborator.name)} 토론했습니다. `;
        if (collaborator.synergy > 80) { message += `그와의 토론에서 새로운 관점을 얻어 독창성이 증폭되었습니다. (+5 독창성)`; changes.ingenuity = gameState.ingenuity + 5; }
        else if (collaborator.synergy < 40) { message += `그는 당신의 의견에 동의하지 않는군요. 토론이 길어집니다. (-5 호기심)`; changes.curiosity = gameState.curiosity - 5; }
        else { message += `지적인 대화는 언제나 즐겁습니다. (+2 호기심)`; changes.curiosity = gameState.curiosity + 2; }
        
        updateState(changes, message);
    },
    hold_debate: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.debateHeld) {
            const message = "오늘은 이미 난상 토론을 개최했습니다. 과도한 토론은 소모적일 뿐입니다. (-5 토론)";
            gameState.debate -= 5;
            updateState({ debate: gameState.debate }, message);
            return;
        }
        updateState({ dailyActions: { ...gameState.dailyActions, debateHeld: true } });
        const rand = currentRandFn();
        let message = "난상 토론을 개최했습니다. ";
        if (rand < 0.5) { message += "열띤 토론 끝에 모두의 지적 수준이 한 단계 성장했습니다. (+10 토론, +5 호기심)"; updateState({ debate: gameState.debate + 10, curiosity: gameState.curiosity + 5 }); }
        else { message += "예상치 못한 반론에 직면했지만, 멋지게 방어해냈습니다. (+5 독창성)"; updateState({ ingenuity: gameState.ingenuity + 5 }); }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            lastPlayedDate: new Date().toISOString().slice(0, 10),
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    handle_dispute: (params) => {
        if (!spendActionPoint()) return;
        const { first, second } = params;
        let message = "";
        let reward = { ingenuity: 0, curiosity: 0, debate: 0 };
        
        const updatedCollaborators = gameState.collaborators.map(c => {
            if (c.id === first) {
                c.synergy = Math.min(100, c.synergy + 10);
                message += `${c.name}의 아이디어를 지지했습니다. 그와의 시너지가 상승합니다. `;
                reward.ingenuity += 5;
            } else if (c.id === second) {
                c.synergy = Math.max(0, c.synergy - 5);
                message += `${second}와의 시너지가 약간 하락했습니다. `;
            }
            return c;
        });
        
        updateState({ ...reward, collaborators: updatedCollaborators, currentScenarioId: 'dispute_resolution_result' }, message);
    },
    mediate_dispute: () => {
        if (!spendActionPoint()) return;
        const message = "당신의 중재로 두 아이디어가 합쳐져 더욱 기발한 발명품이 탄생했습니다! (+10 토론, +5 독창성)";
        updateState({ debate: gameState.debate + 10, ingenuity: gameState.ingenuity + 5, currentScenarioId: 'dispute_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const message = "분쟁을 내버려두었습니다. 자유로운 경쟁이 더 나은 결과를 낳을 수도 있습니다. 하지만 협력자들의 시너지는 감소합니다. (-10 토론, -5 독창성)";
        const updatedCollaborators = gameState.collaborators.map(c => {
            c.synergy = Math.max(0, c.synergy - 5);
            return c;
        });
        updateState({ debate: gameState.debate - 10, ingenuity: gameState.ingenuity - 5, collaborators: updatedCollaborators, currentScenarioId: 'dispute_resolution_result' }, message);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_collect_spark: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.techLevel * 0.1) + (gameState.dailyBonus.collectionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "기발한 아이디어가 떠올랐습니다! (+5 영감의 불꽃)";
            changes.resources = { ...gameState.resources, spark: gameState.resources.spark + 5 };
        } else {
            message = "아무 생각도 나지 않습니다.";
        }
        updateState(changes, message);
    },
    perform_gather_components: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.techLevel * 0.1) + (gameState.dailyBonus.collectionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "쓸만한 부품을 구했습니다! (+5 부품)";
            changes.resources = { ...gameState.resources, components: gameState.resources.components + 5 };
        } else {
            message = "부품을 구하지 못했습니다.";
        }
        updateState(changes, message);
    },
    perform_raise_funding: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.techLevel * 0.1) + (gameState.dailyBonus.collectionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "투자 유치에 성공했습니다! (+5 연구자금)";
            changes.resources = { ...gameState.resources, funding: gameState.resources.funding + 5 };
        } else {
            message = "투자 유치에 실패했습니다.";
        }
        updateState(changes, message);
    },
    build_idea_bank: () => {
        if (!spendActionPoint()) return;
        const cost = { spark: 50, components: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.components >= cost.components && gameState.resources.spark >= cost.spark) {
            gameState.inventionModules.ideaBank.built = true;
            message = "아이디어 뱅크를 구축했습니다!";
            changes.debate = gameState.debate + 10;
            changes.resources = { ...gameState.resources, components: gameState.resources.components - cost.components, spark: gameState.resources.spark - cost.spark };
        } else {
            message = "자원이 부족하여 구축할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_prototype_studio: () => {
        if (!spendActionPoint()) return;
        const cost = { components: 30, funding: 30 };
        let message = "";
        let changes = {};
        if (gameState.resources.components >= cost.components && gameState.resources.funding >= cost.funding) {
            gameState.inventionModules.prototypeStudio.built = true;
            message = "프로토타입 스튜디오를 구축했습니다!";
            changes.curiosity = gameState.curiosity + 10;
            changes.resources = { ...gameState.resources, components: gameState.resources.components - cost.components, funding: gameState.resources.funding - cost.funding };
        } else {
            message = "자원이 부족하여 구축할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_debate_hall: () => {
        if (!spendActionPoint()) return;
        const cost = { spark: 100, components: 50, funding: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.components >= cost.components && gameState.resources.funding >= cost.funding && gameState.resources.spark >= cost.spark) {
            gameState.inventionModules.debateHall.built = true;
            message = "토론의 장을 건설했습니다!";
            changes.debate = gameState.debate + 20;
            changes.curiosity = gameState.curiosity + 20;
            changes.resources = { ...gameState.resources, components: gameState.resources.components - cost.components, funding: gameState.resources.funding - cost.funding, spark: gameState.resources.spark - cost.spark };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_patent_office: () => {
        if (!spendActionPoint()) return;
        const cost = { components: 80, funding: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.components >= cost.components && gameState.resources.funding >= cost.funding) {
            gameState.inventionModules.patentOffice.built = true;
            message = "특허청을 설립했습니다!";
            changes.ingenuity = gameState.ingenuity + 15;
            changes.debate = gameState.debate + 10;
            changes.resources = { ...gameState.resources, components: gameState.resources.components - cost.components, funding: gameState.resources.funding - cost.funding };
        } else {
            message = "자원이 부족하여 설립할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_advanced_workshop: () => {
        if (!spendActionPoint()) return;
        const cost = { components: 50, funding: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.components >= cost.components && gameState.resources.funding >= cost.funding) {
            gameState.inventionModules.advancedWorkshop.built = true;
            message = "고급 작업실을 증축했습니다!";
            changes.resources = { ...gameState.resources, components: gameState.resources.components - cost.components, funding: gameState.resources.funding - cost.funding };
        } else {
            message = "자원이 부족하여 증축할 수 없습니다.";
        }
        updateState(changes, message);
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { components: 10, funding: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.components >= cost.components && gameState.resources.funding >= cost.funding) {
            gameState.inventionModules[facilityKey].durability = 100;
            message = `${facilityKey} 모듈의 유지보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, components: gameState.resources.components - cost.components, funding: gameState.resources.funding - cost.funding };
        } else {
            message = "유지보수에 필요한 자원이 부족합니다.";
        }
        updateState(changes, message);
    },
    develop_tech: () => {
        if (!spendActionPoint()) return;
        const cost = 20 * (gameState.techLevel + 1);
        if (gameState.resources.components >= cost && gameState.resources.funding >= cost) {
            gameState.techLevel++;
            updateState({ resources: { ...gameState.resources, components: gameState.resources.components - cost, funding: gameState.resources.funding - cost }, techLevel: gameState.techLevel });
            updateGameDisplay(`기술 개발에 성공했습니다! 모든 자원/아이디어 수집 성공률이 10% 증가합니다. (현재 레벨: ${gameState.techLevel})`);
        } else { updateGameDisplay(`기술 개발에 필요한 자원이 부족합니다. (부품 ${cost}, 연구자금 ${cost} 필요)`); }
        updateState({ currentScenarioId: 'intro' });
    },
    analyze_competitor: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, components: gameState.resources.components + 20, funding: gameState.resources.funding + 20 } }); updateGameDisplay("경쟁사 분석 중 새로운 부품 공급처를 발견했습니다! (+20 부품, +20 연구자금)"); }
        else if (rand < 0.5) { updateState({ ingenuity: gameState.ingenuity + 10, debate: gameState.debate + 10 }); updateGameDisplay("경쟁사의 약점을 간파했습니다. (+10 독창성, +10 토론)"); }
        else { updateGameDisplay("경쟁사를 분석했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_investment: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.funding >= 50) {
            updateState({ resources: { ...gameState.resources, funding: gameState.resources.funding - 50, disruptive_tech: (gameState.resources.disruptive_tech || 0) + 1 } });
            updateGameDisplay("투자에 성공하여 혁신 기술을 확보했습니다! 이 기술은 세상을 바꿀 것입니다.");
        } else { updateGameDisplay("시제품을 선보일 연구자금이 부족합니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_investment: () => {
        if (!spendActionPoint()) return;
        updateGameDisplay("투자 제안을 거절했습니다. 우리의 비전은 우리가 실현합니다.");
        updateState({ currentScenarioId: 'intro' });
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        
        const minigameIndex = (gameState.day - 1) % minigames.length;
        const minigame = minigames[minigameIndex];
        
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

function applyStatEffects() {
    let message = "";
    if (gameState.ingenuity >= 70) {
        gameState.dailyBonus.collectionSuccess += 0.1;
        message += "높은 독창성 덕분에 자원/아이디어 수집 성공률이 증가합니다. ";
    }
    if (gameState.ingenuity < 30) {
        gameState.collaborators.forEach(c => c.synergy = Math.max(0, c.synergy - 5));
        message += "독창성이 고갈되어 협력자들과의 시너지가 하락합니다. ";
    }

    if (gameState.curiosity >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "넘치는 호기심 덕분에 발명소에 활기가 넘쳐 행동력이 증가합니다. ";
    }
    if (gameState.curiosity < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "호기심이 식어 발명소에 침체기가 찾아와 행동력이 감소합니다. ";
    }

    if (gameState.debate >= 70) {
        Object.keys(gameState.inventionModules).forEach(key => {
            if (gameState.inventionModules[key].built) gameState.inventionModules[key].durability = Math.min(100, gameState.inventionModules[key].durability + 1);
        });
        message += "활발한 토론 문화 덕분에 발명 모듈 관리가 더 잘 이루어집니다. ";
    }
    if (gameState.debate < 30) {
        Object.keys(gameState.inventionModules).forEach(key => {
            if (gameState.inventionModules[key].built) gameState.inventionModules[key].durability = Math.max(0, gameState.inventionModules[key].durability - 2);
        });
        message += "토론 문화가 약화되어 발명 모듈들이 빠르게 노후화됩니다. ";
    }
    return message;
}

function generateRandomCollaborator() {
    const names = ["테슬라", "파인만", "폰노이만", "아인슈타인"];
    const personalities = ["괴짜", "자유로운", "논리적인", "엉뚱한"];
    const skills = ["이론물리", "기계공학", "소프트웨어", "화학"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        synergy: 50
    };
}

// --- Daily/Initialization Logic ---
function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    updateState({
        actionPoints: 10,
        maxActionPoints: 10,
        dailyActions: { explored: false, debateHeld: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { collectionSuccess: 0 }
    });

    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    gameState.collaborators.forEach(c => {
        if (c.skill === '이론물리') { gameState.resources.spark++; skillBonusMessage += `${c.name}와의 토론에서 영감의 불꽃을 얻었습니다. `; }
        else if (c.skill === '기계공학') { gameState.resources.components++; skillBonusMessage += `${c.name}의 도움으로 부품을 추가로 얻었습니다. `; }
        else if (c.skill === '소프트웨어') { gameState.resources.spark++; skillBonusMessage += `${c.name}의 코드에서 영감을 얻었습니다. `; }
    });

    Object.keys(gameState.inventionModules).forEach(key => {
        const facility = gameState.inventionModules[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${key} 모듈이 파손되었습니다! 수리가 필요합니다. `;
            }
        }
    });

    gameState.resources.spark -= gameState.collaborators.length * 2;
    let dailyMessage = "새로운 연구일이 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.spark < 0) {
        gameState.curiosity -= 10;
        dailyMessage += "영감의 불꽃이 부족하여 협력자들이 지루해합니다! (-10 호기심)";
    }
    
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_competitor"; updateState({resources: {...gameState.resources, funding: Math.max(0, gameState.resources.funding - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_flaw"; updateState({resources: {...gameState.resources, components: Math.max(0, gameState.resources.components - 10)}}); }
    else if (rand < 0.5 && gameState.collaborators.length >= 2) { eventId = "daily_event_patent_dispute"; }
    else if (rand < 0.7 && gameState.inventionModules.debateHall.built && gameState.collaborators.length < gameState.maxCollaborators) {
        eventId = "daily_event_new_collaborator";
        const newCollaborator = generateRandomCollaborator();
        gameState.pendingNewCollaborator = newCollaborator;
        gameScenarios["daily_event_new_collaborator"].text = `새로운 협력자 ${newCollaborator.name}(${newCollaborator.personality}, ${newCollaborator.skill})이(가) 합류하고 싶어 합니다. (현재 협력자 수: ${gameState.collaborators.length} / ${gameState.maxCollaborators})`;
    }
    else if (rand < 0.85 && gameState.inventionModules.debateHall.built) { eventId = "daily_event_investor_visit"; }
    
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 발명소를 초기화하시겠습니까? 모든 진행 상황이 사라집니다.")) {
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