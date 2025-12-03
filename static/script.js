// ==================== АВТООПРЕДЕЛЕНИЕ API URL ====================
// Используем текущий хост браузера вместо жёсткого 127.0.0.1
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:${window.location.port || 8080}`;

console.log("🌐 API Base URL:", API_BASE_URL); // Для отладки

const LEADERBOARD_URL = `${API_BASE_URL}/leaderboard/`;
const SUBMIT_SCORE_URL = `${API_BASE_URL}/submit-score/`;
const GET_STAGE_URL = (stageNum) => `${API_BASE_URL}/stage/${stageNum}`;
const GET_PROGRESS_BASE_URL = `${API_BASE_URL}/get-progress/`; 

const MAX_THEORY_STAGE = 1;
const MAX_PRACTICE_STAGE = 5;

let globalUserScore = 0;
let globalUserStage = 0;
let globalPracticeStage = 0;
let globalUserName = localStorage.getItem("userName") || "Игрок";

let currentStageQuestions = [];
let currentStageCharacters = {};
let currentStageIndex = 0;
let currentQuestionIndex = 0;
let currentMode = "theory";

let isTyping = false;
let typingTimeout;
let fullText = "";

let dynamicCharacterMap = {};
let dynamicCharElements = {};

let currentCallback = null;
let currentQuestionSpeed = 30;

// ============== ФУНКЦИИ ВЗАИМОДЕЙСТВИЯ С API ================

async function fetchUserProgress() {
    const username = localStorage.getItem("userName");
    if (!username) return;

    try {
        const url = `${GET_PROGRESS_BASE_URL}?username=${encodeURIComponent(username)}`;

        const response = await fetch(url, {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Ошибка API при загрузке прогресса: ${response.statusText}`);
        }

        const data = await response.json();

        globalUserScore = data.score || 0;
        globalUserStage = data.stage || 0;

        console.log(`✅ Прогресс загружен с сервера: score=${globalUserScore}, stage=${globalUserStage}`);
        updateUI(globalUserScore, globalUserStage);

    } catch (error) {
        console.error("❌ Ошибка при загрузке прогресса:", error);
        updateUI(globalUserScore, globalUserStage);
    }
}

async function submitScore(score, stage) {
    const username = localStorage.getItem("userName");
    if (!username) {
        console.error("Имя пользователя не найдено. Невозможно отправить счет.");
        return;
    }

    console.log(`📊 submitScore вызван: username=${username}, score=${score}, stage=${stage}`);

    try {
        const response = await fetch(SUBMIT_SCORE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: username,
                score: score,
                stage: stage,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ошибка API: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ API: Счет успешно отправлен/обновлен.", data);

        globalUserScore = data.score;
        globalUserStage = data.stage;

        updateUI(globalUserScore, globalUserStage);

        return data;
    } catch (error) {
        console.error("❌ Ошибка при отправке счета:", error);
        return null;
    }
}

// ============== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ================

window.addEventListener('DOMContentLoaded', () => {
    const storedName = localStorage.getItem("userName");
    const nicknameDisplay = document.getElementById("nickname-display");
    const navbar = document.getElementById("mainNavbar");

    if (navbar) {
        navbar.classList.add("navbar-light");
        navbar.classList.remove("navbar-dark");
    }

    if (storedName) {
        globalUserName = storedName;
        if (nicknameDisplay) {
            nicknameDisplay.textContent = storedName;
        }
        fetchUserProgress();
    }
});

// ============== ЗАГРУЗКА ДАННЫХ ЭТАПА ================

async function fetchStageData(stageNum) {
    try {
        const response = await fetch(GET_STAGE_URL(stageNum));
        if (!response.ok) {
            throw new Error(`Ошибка API при загрузке этапа ${stageNum}: ${response.statusText}`);
        }
        const data = await response.json();
        const rawJsonString = data.dialogue_json;
        let parsedData = {};

        if (rawJsonString && rawJsonString.trim().length > 0) {
            try {
                parsedData = JSON.parse(rawJsonString);
            } catch (e) {
                console.error("Ошибка парсинга JSON-строки из БД:", e);
                console.warn("JSON-строка недействительна. Используется пустой объект данных.");
            }
        } else {
            console.warn(`В поле dialogue_json для этапа ${stageNum} нет данных.`);
        }

        currentStageCharacters = parsedData.characters || {};
        currentStageQuestions = parsedData.questions || [];

        if (currentStageQuestions.length === 0) {
            console.log("Данные персонажей загружены, но список вопросов пуст. Используется заглушка.");
            const defaultCharacter = currentStageCharacters["Профессор Социо"] ? "Профессор Социо" : "Ошибка";
            currentStageQuestions = [
                {
                    character: defaultCharacter,
                    text: "Этап загружен, но в JSON нет массива 'questions' или формат неверный. Проверьте БД!",
                    isEnd: true,
                    choices: [{ text: "Вернуться в меню", next: 0 }],
                }
            ];
        } else {
            console.log(`✅ Загружено ${currentStageQuestions.length} вопросов и ${Object.keys(currentStageCharacters).length} персонажей.`);
        }
    } catch (error) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА загрузки этапа:", error);
        alert(`Не удалось загрузить этап ${stageNum}: ${error.message}`);
        return null;
    }
    return true;
}

// ============== ЗАГРУЗКА ТАБЛИЦЫ ЛИДЕРОВ ================

async function fetchLeaderboard() {
    try {
        const response = await fetch(LEADERBOARD_URL);
        if (!response.ok) {
            throw new Error(`Ошибка API: ${response.statusText}`);
        }
        const leaders = await response.json();
        renderLeaderboard(leaders);
    } catch (error) {
        console.error("Ошибка при загрузке таблицы лидеров:", error);
        document.getElementById("leaderboard-body").innerHTML =
            '<tr><td colspan="3" class="text-danger">Не удалось загрузить таблицу лидеров.</td></tr>';
    }
}

function renderLeaderboard(leaders) {
    const tbody = document.getElementById("leaderboard-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    const currentUsername = localStorage.getItem("userName");

    leaders.forEach((leader, index) => {
        const rank = index + 1;
        let medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
        let rowClass = "leaderboard-row";
        if (leader.username === currentUsername) {
            rowClass += " table-primary border-3 border-primary";
            medal = rank;
        } else if (rank <= 3) {
            rowClass +=
                rank === 1
                    ? " table-warning"
                    : rank === 2
                        ? " table-secondary"
                        : " table-danger";
        }
        const row = document.createElement("tr");
        row.className = rowClass;
        row.innerHTML = `
            <td><span class="rank-medal">${medal}</span></td>
            <td><strong>${leader.username === currentUsername
                ? `${leader.username} (Вы)`
                : leader.username
            }</strong></td>
            <td>${leader.score}</td>
        `;
        tbody.appendChild(row);
    });
}


function num_word(value){  
	value = Math.abs(value) % 100; 
	var num = value % 10;
	if(value > 10 && value < 20) return "очков"; 
	if(num > 1 && num < 5) return "очка";
	if(num == 1) return "очко"; 
	return "очков";
}

// ============== ОБНОВЛЕНИЕ UI ================

function updateUI(score, stage) {
    const nicknameEl = document.getElementById("nickname-display");
    if (nicknameEl) {
        nicknameEl.textContent = localStorage.getItem("userName") || "Пользователь";
    }

    const scoreDisplay = document.getElementById("score-display");
    if (scoreDisplay) {
        scoreDisplay.textContent = `${score} ${num_word(score)}`;
    }

    // ───── Теория ─────
    const theoryCard = document.querySelector(".game-card .card-icon-blue")?.closest(".game-card");
    if (theoryCard) {
        const theoryProgressFill = theoryCard.querySelector("#theory-progress");
        const theoryScoreDisplay = theoryCard.querySelector("#theory-score");

        const theoryCompleted = Math.min(stage, MAX_THEORY_STAGE);
        const progressPercent = theoryCompleted / MAX_THEORY_STAGE * 100;

        if (theoryProgressFill) theoryProgressFill.style.width = `${progressPercent}%`;
        if (theoryScoreDisplay) theoryScoreDisplay.textContent = `🏆 ${theoryCompleted} / ${MAX_THEORY_STAGE}`;
    }

    // ───── Практика ─────
    const practiceCard = document.getElementById("practice-card");
    if (practiceCard) {
        const practiceProgressFill = practiceCard.querySelector("#practice-progress");
        const practiceScoreDisplay = practiceCard.querySelector("#practice-score");

        // Сколько практических этапов пройдено
        const practiceCompleted = Math.max(0, stage - MAX_THEORY_STAGE); // stage 1 = теория, 2-6 = практика
        const practicePercent = Math.min(practiceCompleted, MAX_PRACTICE_STAGE) / MAX_PRACTICE_STAGE * 100;

        if (practiceProgressFill) practiceProgressFill.style.width = `${practicePercent}%`;
        if (practiceScoreDisplay) practiceScoreDisplay.textContent = `🏆 ${practiceCompleted} / ${MAX_PRACTICE_STAGE}`;

        // Разблокировка карточки практики
        if (stage >= MAX_THEORY_STAGE) {
            practiceCard.classList.remove("disabled-card");
        } else {
            practiceCard.classList.add("disabled-card");
        }
    }

    // Обновляем список этапов в модалке (если она открыта)
    const practiceModalElement = document.getElementById('practiceModal');
    if (practiceModalElement && practiceModalElement.classList.contains('show')) {
        renderPracticeStages();
    }
}

// ============== ЭТАПЫ ПРАКТИКИ ================

const practiceStageNames = [
    "Социология труда",
    "Производство и общество",
    "Социальные движения",
    "Урбанизация",
    "Социология организаций",
];

function renderPracticeStages() {
    const container = document.getElementById("practice-stages-container");
    if (!container) return;

    container.innerHTML = "";

    const isTheoryCompleted = globalUserStage >= MAX_THEORY_STAGE;

    practiceStageNames.forEach((name, index) => {
        const stageNum = index + MAX_THEORY_STAGE + 1; 
        
        const isCompleted = globalUserStage >= stageNum;

        const IS_PRACTICE_START = (stageNum === (MAX_THEORY_STAGE + 1)); 

        let isAvailable = isCompleted || (
             (IS_PRACTICE_START && globalUserStage === MAX_THEORY_STAGE) || 
             (stageNum === globalUserStage + 1)                             
        );
        
        if (!isTheoryCompleted) {
            isAvailable = false;
        }
        
        const isDisabled = !isAvailable;

        const item = document.createElement("div");
        item.className = `stage-list-item ${isDisabled ? 'disabled-stage' : ''} ${isCompleted ? 'border-success' : 'border-primary'}`;

        let statusIcon = isCompleted ? '✅' : isDisabled && !isTheoryCompleted ? '🔒' : isDisabled ? '🔒' : '🔓';
        let statusText = isCompleted ? 'Пройдено' : isDisabled && !isTheoryCompleted ? 'Заблокировано (Пройдите Теорию)' : isDisabled ? 'Заблокировано' : 'Готово к запуску';

        item.innerHTML = `
            <h6>${statusIcon} Этап ${index + 1}: ${name}</h6>
            <p class="stage-placeholder mb-2" style="color: ${isCompleted ? '#22c55e' : isDisabled ? 'rgba(255,255,255,0.5)' : '#3b82f6'};">
                ${statusText}
            </p>
        `;

        if (isAvailable) {
            const startBtn = document.createElement('button');
            startBtn.className = 'btn btn-sm mt-2 btn-primary';
            startBtn.textContent = isCompleted ? '🔄 Перепройти' : '▶️ Начать этап';

            startBtn.onclick = () => {
                const practiceModal = bootstrap.Modal.getInstance(document.getElementById('practiceModal'));
                if (practiceModal) practiceModal.hide();
                startBtn.blur();
                startPractice(stageNum);
            };
            item.appendChild(startBtn);
        }

        container.appendChild(item);
    });
}

// ============== УПРАВЛЕНИЕ ПЕРСОНАЖАМИ И ДИАЛОГАМИ ================

function initializeCharacters() {
    dynamicCharacterMap = {};
    dynamicCharElements = {};
    const container = document.getElementById("charactersContainer");
    if (container) { container.innerHTML = ""; }
    const charNames = Object.keys(currentStageCharacters);
    if (charNames.length === 0) { console.warn("⚠️ Нет персонажей для инициализации."); return; }
    charNames.forEach((name, index) => {
        const charID = `char_${index}`;
        const charData = currentStageCharacters[name];
        if (charData && container) {
            const charDiv = document.createElement("div");
            charDiv.id = charID;
            charDiv.className = "vn-character-sprite";
            charDiv.style.width = charData.width + "px";
            charDiv.style.height = charData.height + "px";
            const defaultSprite = charData.sprites?.default;
            if (defaultSprite) { charDiv.style.backgroundImage = `url('${defaultSprite}')`; }
            charDiv.style.opacity = 0;
            container.appendChild(charDiv);
            dynamicCharacterMap[name] = charID;
            dynamicCharElements[charID] = charDiv;
        }
    });
}

function updateCharacterSprite(name, emotion) {
    const charID = dynamicCharacterMap[name];
    const charElement = dynamicCharElements[charID];
    const charData = currentStageCharacters[name];
    if (!charElement || !charData || !charData.sprites) { return; }
    const emotionKey = emotion || 'default';
    const spriteUrl = charData.sprites[emotionKey] || charData.sprites['default'];
    if (spriteUrl) { charElement.style.backgroundImage = `url('${spriteUrl}')`; }
}

function setCharactersPosition(visibleCharNames) {
    for (const id in dynamicCharElements) {
        const charElement = dynamicCharElements[id];
        charElement.style.opacity = 0;
        charElement.style.animation = 'none';
        charElement.classList.remove('pos-single-center', 'pos-dual-left', 'pos-dual-right', 'active-speaker');
    }
    const count = visibleCharNames.length;
    if (count === 1) {
        const charName = visibleCharNames[0];
        const charID = dynamicCharacterMap[charName];
        const charElement = dynamicCharElements[charID];
        if (charElement) {
            charElement.classList.add('pos-single-center');
            charElement.style.opacity = 1;
            charElement.style.animation = 'idle 3s ease-in-out infinite';
        }
    } else if (count === 2) {
        const leftCharName = visibleCharNames[0];
        const rightCharName = visibleCharNames[1];
        const leftElement = dynamicCharElements[dynamicCharacterMap[leftCharName]];
        const rightElement = dynamicCharElements[dynamicCharacterMap[rightCharName]];
        if (leftElement) {
            leftElement.classList.add('pos-dual-left');
            leftElement.style.opacity = 1;
            leftElement.style.animation = 'idle 3s ease-in-out infinite';
        }
        if (rightElement) {
            rightElement.classList.add('pos-dual-right');
            rightElement.style.opacity = 1;
            rightElement.style.animation = 'idle 3s ease-in-out infinite';
        }
    }
}

async function startSurvey(stageNum) {
    currentMode = "theory";
    const result = await fetchStageData(stageNum);
    if (!result || currentStageQuestions.length === 0) { return; }
    initializeCharacters();
    currentStageIndex = stageNum;
    currentQuestionIndex = 0;
    const navbar = document.getElementById("mainNavbar");
    if (navbar) { navbar.style.display = "none"; }
    document.getElementById("page1").classList.remove("active");
    document.getElementById("page2").classList.add("active");
    showQuestion(0);
}

async function startPractice(stageNum) {
    currentMode = "practice";
    const result = await fetchStageData(stageNum);
    if (!result || currentStageQuestions.length === 0) { return; }
    initializeCharacters();
    currentStageIndex = stageNum;
    currentQuestionIndex = 0;
    const navbar = document.getElementById("mainNavbar");
    if (navbar) { navbar.style.display = "none"; }
    document.getElementById("page1").classList.remove("active");
    document.getElementById("page2").classList.add("active");
    showQuestion(0);
}

function showQuestion(index) {
    currentQuestionIndex = index;
    const question = currentStageQuestions[index];
    if (!question) { return; }
    const nameplate = document.getElementById("characterName");
    if (nameplate) nameplate.textContent = question.character;
    const choicesContainer = document.getElementById("choicesContainer");
    if (choicesContainer) { choicesContainer.innerHTML = ""; choicesContainer.style.display = "none"; }
    const visibleChars = question.visibleCharacters || (question.character ? [question.character] : []);
    setCharactersPosition(visibleChars);
    if (question.emotion) { updateCharacterSprite(question.character, question.emotion); }
    for (const charID in dynamicCharElements) {
        const charElement = dynamicCharElements[charID];
        const charName = Object.keys(dynamicCharacterMap).find(key => dynamicCharacterMap[key] === charID);
        if (charName === question.character) {
            charElement.classList.add('active-speaker');
        } else {
            charElement.classList.remove('active-speaker');
        }
    }
    const dialogueText = document.getElementById("dialogueText");
    const textSpeed = question.speed || 30;
    if (dialogueText) {
        typeText(question.text, dialogueText, () => {
            showChoices();
        }, textSpeed);
    }
}

function substituteText(text) {
    if (!text) return "";
    text = text.replace(/{{player_name}}/g, globalUserName);
    return text;
}

function typeText(text, element, callback, speed = 30) {
    const substitutedText = substituteText(text);
    fullText = substitutedText;
    let index = 0;
    element.textContent = "";
    isTyping = true;
    currentCallback = callback;
    currentQuestionSpeed = speed;
    const textboxEl = document.querySelector(".vn-textbox");
    textboxEl.classList.add("typing");
    function type() {
        if (index < substitutedText.length) {
            element.textContent += substitutedText[index];
            index++;
            typingTimeout = setTimeout(type, currentQuestionSpeed);
        } else {
            isTyping = false;
            textboxEl.classList.remove("typing");
            if (currentCallback) currentCallback();
            currentCallback = null;
        }
    }
    type();
}

function skipText() {
    if (isTyping) {
        clearTimeout(typingTimeout);
        const dialogueEl = document.getElementById("dialogueText");
        if (dialogueEl) { dialogueEl.textContent = fullText; }
        isTyping = false;
        const textboxEl = document.querySelector(".vn-textbox");
        if (textboxEl) { textboxEl.classList.remove("typing"); }
        if (currentCallback) {
            currentCallback();
            currentCallback = null;
        }
    }
}

function showChoices() {
    const question = currentStageQuestions[currentQuestionIndex];
    const container = document.getElementById("choicesContainer");
    container.innerHTML = "";
    container.style.display = "flex";
    if (question.isEnd) {
        const endButton = document.createElement("button");
        endButton.className = "vn-continue-btn";
        endButton.textContent = "Вернуться в меню";
        endButton.onclick = () => { backToMenu(); };
        container.appendChild(endButton);
        return;
    }
    question.choices.forEach((choice) => {
        const button = document.createElement("button");
        button.className = "vn-choice-btn";
        button.textContent = choice.text;
        button.onclick = (e) => {
            e.stopPropagation();
            if (question.type === "quiz") {
                handleQuizAnswer(choice, question);
            } else {
                showQuestion(choice.next);
            }
        };
        container.appendChild(button);
    });
}

// ============== ОБРАБОТКА ОТВЕТА НА КВИЗ ================

function handleQuizAnswer(choice, question) {
    const container = document.getElementById("choicesContainer");
    container.innerHTML = "";
    container.style.display = "none";

    let scoreChange = 0;
    let responseText = "";
    const nextStepIndex = choice.next;
    let stageToSubmit = globalUserStage;

    if (choice.isCorrect) {
        scoreChange = 50;
        responseText = "🎉 " + question.correctResponse;

        if (question.isLastQuiz) {
            if (currentStageIndex > globalUserStage) {
                stageToSubmit = currentStageIndex;
                responseText += ` 🎊 Поздравляем! Этап ${currentMode === "theory" ? currentStageIndex : currentStageIndex - MAX_THEORY_STAGE} пройден!`;
            }
        }
    } else {
        responseText = "❌ " + question.wrongResponse;
    }

    const newScore = globalUserScore + scoreChange;

    submitScore(newScore, stageToSubmit);

    typeText(responseText, document.getElementById("dialogueText"), () => {
        const nextButton = document.createElement("button");
        nextButton.className = "vn-continue-btn";
        nextButton.textContent = "Далее ▸";

        nextButton.onclick = () => {
            const nextQuestion = currentStageQuestions[nextStepIndex];
            if (nextStepIndex === 0 || (nextQuestion && nextQuestion.isEnd)) {
                backToMenu();
            } else {
                showQuestion(nextStepIndex);
            }
        };

        container.style.display = "flex";
        container.appendChild(nextButton);
    });
}

// ============== ВОЗВРАТ В МЕНЮ ================

function backToMenu() {
    document.getElementById("page2").classList.remove("active");
    document.getElementById("page1").classList.add("active");

    const navbar = document.getElementById("mainNavbar");
    if (navbar) { navbar.style.display = "block"; }

    currentQuestionIndex = 0;
    currentStageQuestions = [];
    currentStageCharacters = {};

    updateUI(globalUserScore, globalUserStage);
}

// ============== ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ================

document.addEventListener("DOMContentLoaded", () => {
    const nameModalElement = document.getElementById("nameModal");
    const usernameInput = document.getElementById("username-input");
    const saveNameButton = document.getElementById("save-name-button");

    let nameModalBootstrap = null;
    if (nameModalElement) {
        nameModalBootstrap = new bootstrap.Modal(nameModalElement, {
            backdrop: 'static',
            keyboard: false
        });
    }

    const handleSaveName = () => {
        if (!usernameInput) return;
        const newName = usernameInput.value.trim();
        if (newName) {
            localStorage.setItem("userName", newName);
            globalUserName = newName;
            const nicknameDisplay = document.getElementById("nickname-display");
            if (nicknameDisplay) nicknameDisplay.textContent = newName;
            if (nameModalBootstrap) nameModalBootstrap.hide();
            
            submitScore(0, 0);
        } else {
            alert("Пожалуйста, введите имя!");
        }
    };

    const storedName = localStorage.getItem("userName");

    if (!storedName) {
        if (nameModalBootstrap) nameModalBootstrap.show();
    }

    if (saveNameButton) saveNameButton.addEventListener("click", handleSaveName);

    if (usernameInput) {
        usernameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSaveName();
            }
        });
    }

    const leaderboardModalElement = document.getElementById("leaderboardModal");
    if (leaderboardModalElement) {
        leaderboardModalElement.addEventListener("show.bs.modal", fetchLeaderboard);
    }

    const practiceModalElement = document.getElementById('practiceModal');
    if (practiceModalElement) {
        practiceModalElement.addEventListener('show.bs.modal', renderPracticeStages);
    }

    const textbox = document.querySelector(".vn-textbox");
    if (textbox) {
        textbox.addEventListener("click", function (e) {
            if (e.target.classList.contains("vn-choice-btn") ||
                e.target.classList.contains("vn-continue-btn")) {
                return;
            }
            skipText();
        });
    }

    const feedbackBtn = document.getElementById("feedback-button");
    if (feedbackBtn) {
        feedbackBtn.onclick = function () {
            window.open("ВАША_ССЫЛКА_НА_GOOGLE_ФОРМУ", "_blank");
        };
    }
});