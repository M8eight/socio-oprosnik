const API_BASE_URL = "http://127.0.0.1:8080";

// Используемые эндпоинты (согласно вашему бэкенду)
const GET_STAGE_DETAIL_URL = (id) => `${API_BASE_URL}/stage/${id}`;
const SAVE_STAGE_URL = `${API_BASE_URL}/stage/save/`; // POST для сохранения
const LEADERBOARD_URL = `${API_BASE_URL}/leaderboard/`; // GET для таблицы лидеров

let currentStageNum = null;

// Локальный справочник для имен этапов (имитируем admin/stages/)
const THEORY_STAGE_NAMES = {
    1: "Введение в социологию",
    2: "Классические теории",
    3: "Социальные группы",
    4: "Культура и общество",
    5: "Социология конфликта",
};

document.addEventListener('DOMContentLoaded', renderLocalStages);

// ==========================================================
// ФУНКЦИИ УПРАВЛЕНИЯ ЭТАПАМИ (КОНТЕНТОМ)
// ==========================================================

/**
 * Имитирует загрузку списка этапов, используя локальный справочник.
 */
function renderLocalStages() {
    const stagesList = document.getElementById('stagesList');
    stagesList.innerHTML = '';

    Object.entries(THEORY_STAGE_NAMES).forEach(([num, name]) => {
        const stageNum = parseInt(num);
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action stage-list-group-item';
        item.textContent = `[Этап ${stageNum}] ${name}`;
        item.setAttribute('data-stage-num', stageNum);
        
        item.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.stage-list-group-item').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            // Загружаем данные с бэкенда по stage_num
            loadStageData(stageNum, name);
        };

        stagesList.appendChild(item);
    });
}

/**
 * Загружает JSON-диалог конкретного этапа с бэкенда.
 * Использует: GET /stage/{stage_num}
 */
async function loadStageData(stageNum, stageName) {
    currentStageNum = stageNum;
    const editor = document.getElementById('jsonEditor');
    const title = document.getElementById('currentStageTitle');
    const status = document.getElementById('statusMessage');
    const saveBtn = document.getElementById('saveButton');
    
    title.textContent = `${stageNum}: ${stageName || 'Загрузка...'}`;
    status.className = 'alert alert-info';
    status.textContent = 'Загрузка данных...';
    editor.value = '';
    editor.disabled = true;
    saveBtn.disabled = true;

    try {
        const response = await fetch(GET_STAGE_DETAIL_URL(stageNum));
        
        if (response.status === 404) {
             // Если этапа нет в БД, даем возможность создать его, начиная с пустого JSON
             editor.value = '{\n  "characters": {},\n  "questions": []\n}';
             editor.disabled = false;
             saveBtn.disabled = false;
             status.className = 'alert alert-warning';
             status.textContent = `Этап ${stageNum} не найден в БД. Готов к созданию!`;
             return;
        }

        if (!response.ok) {
            throw new Error(`Ошибка API: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json(); // { "stage_num": 1, "dialogue_json": "..." }
        
        const rawJsonString = data.dialogue_json;
        
        // Форматируем JSON для удобства редактирования
        const formattedJson = JSON.stringify(JSON.parse(rawJsonString), null, 2);
        
        editor.value = formattedJson;
        editor.disabled = false;
        status.className = 'alert alert-success';
        status.textContent = `Данные этапа ${stageNum} успешно загружены.`;
        saveBtn.disabled = false;

    } catch (error) {
        console.error(`Ошибка при загрузке/парсинге этапа ${stageNum}:`, error);
        editor.value = `Ошибка загрузки или парсинга JSON: ${error.message}`;
        editor.disabled = true;
        status.className = 'alert alert-danger';
        status.textContent = `Критическая ошибка: ${error.message}`;
        saveBtn.disabled = true;
    }
}

/**
 * Сохраняет измененный JSON-диалог на бэкенд.
 * Использует: POST /stage/save/
 */
async function saveStageData() {
    if (!currentStageNum) return;

    const editor = document.getElementById('jsonEditor');
    const saveStatus = document.getElementById('saveStatus');
    const saveBtn = document.getElementById('saveButton');
    
    saveStatus.className = 'text-warning';
    saveStatus.textContent = 'Сохранение...';
    saveBtn.disabled = true;

    try {
        const rawJson = editor.value.trim();
        // 1. Проверяем, что JSON действителен (бросит ошибку, если нет)
        JSON.parse(rawJson); 

        // 2. Отправляем данные методом POST
        const response = await fetch(SAVE_STAGE_URL, {
            method: 'POST', // Соответствует вашему эндпоинту POST /stage/save/
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stage_num: currentStageNum,
                dialogue_json: rawJson // Отправляем raw JSON string
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Ошибка API: ${response.status} - ${errorData.detail || errorData.message}`);
        }

        saveStatus.className = 'text-success';
        saveStatus.textContent = '✅ Сохранено успешно!';
        setTimeout(() => saveStatus.textContent = '', 3000); 

    } catch (error) {
        console.error("Ошибка при сохранении:", error);
        saveStatus.className = 'text-danger';
        saveStatus.textContent = `❌ Ошибка сохранения: ${error.message}`;
    } finally {
        saveBtn.disabled = false;
    }
}


// ==========================================================
// ФУНКЦИИ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ (РЕЗУЛЬТАТАМИ)
// ==========================================================

/**
 * Загружает таблицу лидеров, используя ваш основной эндпоинт.
 * Использует: GET /leaderboard/
 */
async function loadAllUsers() {
    const usersTableBody = document.getElementById('usersTableBody');
    usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-info">Загрузка данных...</td></tr>';

    try {
        const response = await fetch(LEADERBOARD_URL);
        if (!response.ok) {
             throw new Error(`Ошибка API: ${response.status} - ${response.statusText}`);
        }
        const users = await response.json(); // Массив объектов LeaderRead

        renderUsersTable(users);

    } catch (error) {
        console.error("Ошибка загрузки списка пользователей:", error);
        usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Ошибка: ${error.message}</td></tr>`;
    }
}

function renderUsersTable(users) {
    const usersTableBody = document.getElementById('usersTableBody');
    usersTableBody.innerHTML = '';
    
    if (users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Пользователи не найдены.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = usersTableBody.insertRow();
        row.insertCell().textContent = user.id; // ID из БД
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.score;
        row.insertCell().textContent = user.stage;
        
        // Форматирование даты
        const date = user.last_update ? new Date(user.last_update) : null;
        row.insertCell().textContent = date ? date.toLocaleDateString() : '—';

        // NOTE: Поскольку у вас нет эндпоинта DELETE /admin/user/{id},
        // кнопка "Удалить" здесь не будет работать без изменений на бэкенде.
        const actionsCell = row.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger disabled';
        deleteBtn.textContent = 'Удалить (Нет API)';
        actionsCell.appendChild(deleteBtn);
    });
}