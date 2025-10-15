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
        debate: 50, // 토론
        knowledge: 30, // 지식
        reputation: 30, // 평판
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
            ideaBank: { built: false, durability: 100, name: "아이디어 뱅크", description: "기발한 아이디어를 저장하고 조합합니다.", effect_description: "독창성 보너스 및 새로운 아이디어 발견 확률 증가." },
            prototypeStudio: { built: false, durability: 100, name: "프로토타입 스튜디오", description: "아이디어를 시제품으로 만듭니다.", effect_description: "기술 레벨업 및 부품 수집 효율 증가." },
            debateHall: { built: false, durability: 100, name: "토론의 장", description: "협력자들과 자유롭게 토론하는 공간입니다.", effect_description: "새로운 협력자 영입 및 투자 유치 이벤트 활성화." },
            patentOffice: { built: false, durability: 100, name: "특허청", description: "완성된 발명품의 특허를 등록합니다.", effect_description: "특허 등록을 통한 평판 및 연구자금 확보." },
            advancedWorkshop: { built: false, durability: 100, name: "고급 작업실", description: "혁신 기술을 사용하는 고급 발명품을 제작합니다.", effect_description: "고급 발명품 제작 및 혁신 기술 활용 잠금 해제." }
        },
        techLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('entpInventionGame', JSON.stringify(gameState));
}

// ... (The rest of the code will be a combination of the old ENTP script and the new ENFJ features, adapted for the ENTP theme)
// This is a placeholder for the full script that will be generated.
