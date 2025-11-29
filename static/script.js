const API_BASE_URL = "http://127.0.0.1:8080";
const LEADERBOARD_URL = `${API_BASE_URL}/leaderboard/`;
const SUBMIT_SCORE_URL = `${API_BASE_URL}/submit-score/`;
const GET_STAGE_URL = (stageNum) => `${API_BASE_URL}/stage/${stageNum}`;

const MAX_THEORY_STAGE = 5;

let globalUserScore = 0;
let globalUserStage = 0;
let globalUserName = localStorage.getItem("userName") || "Игрок";

let currentStageQuestions = [];
let currentStageCharacters = {};
let currentStageIndex = 0;
let currentQuestionIndex = 0;

let isTyping = false;
let typingTimeout;
let fullText = "";

let dynamicCharacterMap = {};
let dynamicCharElements = {};

let currentCallback = null;
let currentQuestionSpeed = 30;

// ============== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ================

window.addEventListener('DOMContentLoaded', () => {
    const storedName = localStorage.getItem("userName");
    const nicknameDisplay = document.getElementById("nickname-display");

    if (storedName) {
        globalUserName = storedName;
        if (nicknameDisplay) {
            nicknameDisplay.textContent = storedName;
        }
        submitScore(0, 0);
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
            console.log("Структура вопросов:", currentStageQuestions);
        }

    } catch (error) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА загрузки этапа:", error);
        alert(`Не удалось загрузить этап ${stageNum}: ${error.message}`);
        return null;
    }
    return true;
}

// ============== ОТПРАВКА СЧЕТА НА СЕРВЕР ================

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
            headers: {
                "Content-Type": "application/json",
            },
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

        // Обновляем глобальные переменные из ответа сервера
        globalUserScore = data.score;
        globalUserStage = data.stage;
        
        console.log(`📈 Обновлены глобальные переменные: score=${globalUserScore}, stage=${globalUserStage}`);
        
        // Обновляем UI
        updateUI(globalUserScore, globalUserStage);
        
        return data;
    } catch (error) {
        console.error("❌ Ошибка при отправке счета:", error);
        return null;
    }
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

// ============== ОБНОВЛЕНИЕ UI ================

function updateUI(score, stage) {
    const nicknameEl = document.getElementById("nickname-display");
    if (nicknameEl) {
        nicknameEl.textContent = localStorage.getItem("userName") || "Пользователь";
    }

    const theoryCard = document.querySelector(".game-card .card-icon-blue")?.closest(".game-card");
    if (theoryCard) {
        const theoryProgressFill = theoryCard.querySelector(".progress-fill");
        const theoryScoreDisplay = theoryCard.querySelector(".card-score");

        const progressPercent = Math.min(stage / MAX_THEORY_STAGE, 1) * 100;
        if (theoryProgressFill) theoryProgressFill.style.width = `${progressPercent}%`;
        if (theoryScoreDisplay) theoryScoreDisplay.textContent = `🏆 ${Math.min(stage, MAX_THEORY_STAGE)} / ${MAX_THEORY_STAGE}`;
    }

    const practiceCard = document.querySelector(".game-card .card-icon-green")?.closest(".game-card");
    if (practiceCard) {
        if (stage >= MAX_THEORY_STAGE) {
            practiceCard.classList.remove("disabled-card");
        } else {
            practiceCard.classList.add("disabled-card");
        }
    }

    if (document.getElementById("theoryModal")) {
        renderTheoryStages();
    }
}

// ============== ЭТАПЫ ТЕОРИИ ================

const theoryStageNames = [
    "Введение в социологию",
    "Классические теории",
    "Социальные группы",
    "Культура и общество",
    "Социология конфликта",
];

function renderTheoryStages() {
    const modalBody = document.querySelector("#theoryModal .modal-body");
    if (!modalBody) return;

    let stageContainer = modalBody.querySelector('.stage-container');
    if (!stageContainer) {
        console.error("stage-container не найден!");
        return;
    }

    stageContainer.innerHTML = "";

    const startButton = modalBody.querySelector('.btn-primary.w-100');
    if (startButton && globalUserStage > 0) {
        startButton.style.display = 'none';
    }

    theoryStageNames.forEach((name, index) => {
        const stageNum = index + 1;
        const isCompleted = stageNum <= globalUserStage;
        const isNext = stageNum === globalUserStage + 1;
        const isDisabled = !isNext && !isCompleted;

        const item = document.createElement("div");
        item.className = `stage-list-item ${isDisabled ? 'disabled-stage' : ''} ${isCompleted ? 'border-success' : 'border-primary'}`;

        let statusIcon = isCompleted ? '✅' : isNext ? '🔓' : '🔒';
        let statusText = isCompleted ? 'Пройдено' : isNext ? 'Готово к запуску' : 'Заблокировано';

        item.innerHTML = `
            <h6>${statusIcon} Этап ${stageNum}: ${name}</h6>
            <p class="stage-placeholder mb-2" style="color: ${isCompleted ? '#22c55e' : isNext ? '#3b82f6' : 'rgba(255,255,255,0.5)'};">
                ${statusText}
            </p>
        `;

        if (isNext || isCompleted) {
            const startBtn = document.createElement('button');
            startBtn.className = 'btn btn-sm mt-2';
            startBtn.textContent = isCompleted ? '🔄 Перепройти' : '▶️ Начать этап';

            startBtn.onclick = () => {
                const theoryModal = bootstrap.Modal.getInstance(document.getElementById('theoryModal'));
                if (theoryModal) theoryModal.hide();
                startBtn.blur();
                startSurvey(stageNum);
            };
            item.appendChild(startBtn);
        }

        stageContainer.appendChild(item);
    });
}

// ============== ИНИЦИАЛИЗАЦИЯ ПЕРСОНАЖЕЙ ================

function initializeCharacters() {
    dynamicCharacterMap = {};
    dynamicCharElements = {};
    const container = document.getElementById("charactersContainer");

    if (container) {
        container.innerHTML = "";
    }

    const charNames = Object.keys(currentStageCharacters);

    if (charNames.length === 0) {
        console.warn("⚠️ Нет персонажей для инициализации.");
        return;
    }

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
            if (defaultSprite) {
                charDiv.style.backgroundImage = `url('${defaultSprite}')`;
            }
            
            charDiv.style.opacity = 0;

            container.appendChild(charDiv);

            dynamicCharacterMap[name] = charID;
            dynamicCharElements[charID] = charDiv;
        }
    });

    console.log(`✅ Инициализировано персонажей: ${charNames.length}`);
    console.log("Карта персонажей:", dynamicCharacterMap);
}

// ============== УПРАВЛЕНИЕ СПРАЙТАМИ ================

function updateCharacterSprite(name, emotion) {
    const charID = dynamicCharacterMap[name];
    const charElement = dynamicCharElements[charID];
    const charData = currentStageCharacters[name];

    if (!charElement || !charData || !charData.sprites) {
        console.warn(`⚠️ Не удалось обновить спрайт для '${name}': элемент или данные отсутствуют`);
        return;
    }

    const emotionKey = emotion || 'default';
    const spriteUrl = charData.sprites[emotionKey] || charData.sprites['default'];

    if (spriteUrl) {
        charElement.style.backgroundImage = `url('${spriteUrl}')`;
        console.log(`✅ Спрайт обновлен: ${name} → ${emotionKey}`);
    } else {
        console.warn(`❌ Спрайт для '${name}' (${emotionKey}) не найден. Проверьте пути к файлам.`);
    }
}

// ============== УПРАВЛЕНИЕ ПОЗИЦИЯМИ ПЕРСОНАЖЕЙ ================

function setCharactersPosition(visibleCharNames) {
    for (const id in dynamicCharElements) {
        const charElement = dynamicCharElements[id];
        charElement.style.opacity = 0;
        charElement.style.animation = 'none';
        charElement.classList.remove('pos-single-center', 'pos-dual-left', 'pos-dual-right');
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

// ============== ЗАПУСК ВИЗУАЛЬНОЙ НОВЕЛЛЫ ================

async function startSurvey(stageNum) {
    const result = await fetchStageData(stageNum);

    if (!result || currentStageQuestions.length === 0) {
        console.error("Невозможно запустить этап: вопросы не загружены или ошибка загрузки.");
        return;
    }

    initializeCharacters();

    currentStageIndex = stageNum;
    currentQuestionIndex = 0;

    document.getElementById("page1").classList.remove("active");
    document.getElementById("page2").classList.add("active");

    showQuestion(0);
}

// ============== ОТОБРАЖЕНИЕ ВОПРОСА ================

function showQuestion(index) {
    console.log(`📖 Показываем вопрос с индексом: ${index}`);
    currentQuestionIndex = index;
    const question = currentStageQuestions[index];

    if (!question) {
        console.error(`❌ ОШИБКА: Вопрос с индексом ${index} не найден!`);
        console.log("Доступные вопросы:", currentStageQuestions);
        return;
    }

    console.log(`✅ Вопрос найден:`, question);

    const nameplate = document.getElementById("characterName");
    if (nameplate) nameplate.textContent = question.character;

    const choicesContainer = document.getElementById("choicesContainer");
    if (choicesContainer) {
        choicesContainer.innerHTML = "";
        choicesContainer.style.display = "none";
    }

    if (question.visibleCharacters && question.visibleCharacters.length > 0) {
        setCharactersPosition(question.visibleCharacters);
    } else if (question.character) {
        setCharactersPosition([question.character]);
    }

    if (question.emotion) {
        updateCharacterSprite(question.character, question.emotion);
    }

    const dialogueText = document.getElementById("dialogueText");
    const textSpeed = question.speed || 30;
    
    if (dialogueText) {
        typeText(question.text, dialogueText, () => {
            showChoices();
        }, textSpeed);
    }
}

// ============== ПОДСТАНОВКА ТЕКСТА ================

function substituteText(text) {
    if (!text) return "";
    text = text.replace(/{{player_name}}/g, globalUserName);
    return text;
}

// ============== ПЕЧАТЬ ТЕКСТА ================

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
        if (dialogueEl) {
            dialogueEl.textContent = fullText;
        }
        isTyping = false;

        const textboxEl = document.querySelector(".vn-textbox");
        if (textboxEl) {
            textboxEl.classList.remove("typing");
        }

        if (currentCallback) {
            console.log("⏩ Пропуск текста: вызываем колбэк");
            currentCallback();
            currentCallback = null;
        }
    }
}

// ============== ОТОБРАЖЕНИЕ ВЫБОРОВ ================

function showChoices() {
    const question = currentStageQuestions[currentQuestionIndex];
    const container = document.getElementById("choicesContainer");

    console.log(`🎮 showChoices вызван для вопроса:`, question);

    container.innerHTML = "";
    container.style.display = "flex";

    if (question.isEnd) {
        console.log("🏁 Это финальный экран!");
        const endButton = document.createElement("button");
        endButton.className = "vn-continue-btn";
        endButton.textContent = "Вернуться в меню";
        endButton.onclick = () => {
            backToMenu();
        };
        container.appendChild(endButton);
        return;
    }

    question.choices.forEach((choice) => {
        const button = document.createElement("button");
        button.className = "vn-choice-btn";
        button.textContent = choice.text;

        button.onclick = (e) => {
            e.stopPropagation();
            console.log(`🖱️ Клик на выбор:`, choice);

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
    console.log(`🎯 handleQuizAnswer вызван. Выбор:`, choice);
    console.log(`📊 Текущее состояние: currentStageIndex=${currentStageIndex}, globalUserStage=${globalUserStage}`);

    const container = document.getElementById("choicesContainer");
    container.innerHTML = "";
    container.style.display = "none";

    let scoreChange = 0;
    let responseText = "";
    const nextStepIndex = choice.next;
    let stageCompleted = false;

    if (choice.isCorrect) {
        scoreChange = 50;
        responseText = "🎉 " + question.correctResponse;

        // ✅ ИСПРАВЛЕНО: Проверяем, это последний квиз И мы проходим новый этап
        if (question.isLastQuiz) {
            console.log(`🏁 Это последний квиз этапа ${currentStageIndex}`);
            
            // Если текущий этап больше или равен пройденному - повышаем уровень
            if (currentStageIndex >= globalUserStage) {
                globalUserStage = currentStageIndex;
                stageCompleted = true;
                responseText += ` 🎊 Поздравляем! Этап ${currentStageIndex} пройден!`;
                console.log(`✅ ЭТАП ЗАВЕРШЕН! Новый globalUserStage: ${globalUserStage}`);
            } else {
                console.log(`ℹ️ Этап ${currentStageIndex} уже был пройден ранее.`);
            }
        }
    } else {
        responseText = "❌ " + question.wrongResponse;
    }

    globalUserScore += scoreChange;
    
    // Отправляем обновленные данные на сервер
    console.log(`📤 Отправка на сервер: score=${globalUserScore}, stage=${globalUserStage}`);
    submitScore(globalUserScore, globalUserStage);

    typeText(responseText, document.getElementById("dialogueText"), () => {
        console.log("✍️ Текст ответа напечатан, создаём кнопку Далее");

        const nextButton = document.createElement("button");
        nextButton.className = "vn-continue-btn";
        nextButton.textContent = "Далее ▸";

        nextButton.onclick = () => {
            console.log(`➡️ Клик на Далее, переход на индекс ${nextStepIndex}`);
            
            // Проверяем финальный экран
            const nextQuestion = currentStageQuestions[nextStepIndex];
            if (nextStepIndex === 0 || (nextQuestion && nextQuestion.isEnd)) {
                console.log("🔙 Возврат в меню");
                backToMenu();
            } else {
                showQuestion(nextStepIndex);
            }
        };

        container.style.display = "flex";
        container.appendChild(nextButton);
        console.log("✅ Кнопка Далее добавлена в контейнер");
    });
}

// ============== ВОЗВРАТ В МЕНЮ ================

function backToMenu() {
    console.log("🔙 Возврат в меню. Текущий прогресс:", {
        score: globalUserScore,
        stage: globalUserStage
    });
    
    document.getElementById("page2").classList.remove("active");
    document.getElementById("page1").classList.add("active");
    
    currentQuestionIndex = 0;
    currentStageQuestions = [];
    currentStageCharacters = {};
    
    // Обновляем UI при возврате в меню
    updateUI(globalUserScore, globalUserStage);
    
    console.log("✅ Возврат в меню завершен");
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
        } else {
            alert("Пожалуйста, введите имя!");
        }
    };

    const storedName = localStorage.getItem("userName");

    if (storedName) {
        const nicknameDisplay = document.getElementById("nickname-display");
        if (nicknameDisplay) nicknameDisplay.textContent = storedName;
        updateUI(globalUserScore, globalUserStage);
    } else {
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

    const theoryModalElement = document.getElementById('theoryModal');
    if (theoryModalElement) {
        theoryModalElement.addEventListener('show.bs.modal', renderTheoryStages);
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