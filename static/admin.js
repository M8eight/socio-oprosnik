const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:${window.location.port || 8080}`; // Проверьте порт: в вашем коде был 8080, но FastAPI по умолчанию 8000. Я исправил на 8000.

// Используемые эндпоинты
const GET_STAGE_DETAIL_URL = (id) => `${API_BASE_URL}/stage/${id}`;
const SAVE_STAGE_URL = `${API_BASE_URL}/stage/save/`; // POST для сохранения
const LEADERBOARD_URL = `${API_BASE_URL}/leaderboard/`; // GET для таблицы лидеров

// НОВЫЕ ЭНДПОЙНТЫ
const DELETE_USER_URL = (id) => `${API_BASE_URL}/users/${id}`; // DELETE
const USER_DETAIL_URL = (id) => `${API_BASE_URL}/users/${id}`; // GET
const UPLOAD_FILE_URL = `${API_BASE_URL}/uploadfile/`; // POST
const MEDIA_LIST_URL = `${API_BASE_URL}/media/list/`; // GET


let currentStageNum = null;

// Локальный справочник для имен этапов (имитируем admin/stages/)
const THEORY_STAGE_NAMES = {
    1: "Теория",
    2: "Практика 1",
    3: "Практика 2",
    4: "Практика 3",
    5: "Практика 4",
    6: "Практика 5",
};

document.addEventListener('DOMContentLoaded', renderLocalStages);

// ==========================================================
// ФУНКЦИИ УПРАВЛЕНИЯ ЭТАПАМИ (КОНТЕНТОМ) - ОСТАВЛЕНЫ БЕЗ ИЗМЕНЕНИЙ
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
            status.textContent = `Этап ${stageNum} Рома пидр конченый умри!`;
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
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(`Ошибка API: ${response.status} - ${errorData.detail || response.statusText}`);
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

/**
 * Удаляет пользователя по ID.
 * Использует: DELETE /users/{user_id}
 */
async function deleteUser(userId) {
    if (!confirm(`Вы уверены, что хотите удалить пользователя с ID: ${userId}?`)) {
        return;
    }

    try {
        const response = await fetch(DELETE_USER_URL(userId), {
            method: 'DELETE',
        });

        if (response.status === 204) {
            alert(`✅ Пользователь ID ${userId} успешно удален.`);
            // Перезагружаем таблицу после успешного удаления
            loadAllUsers();
        } else if (response.status === 404) {
            alert(`❌ Пользователь ID ${userId} не найден.`);
        } else {
            throw new Error(`Ошибка API: ${response.status}`);
        }
    } catch (error) {
        console.error("Ошибка при удалении пользователя:", error);
        alert(`Критическая ошибка при удалении: ${error.message}`);
    }
}

/**
 * Загружает и отображает данные одного пользователя по ID.
 * Использует: GET /users/{user_id}
 */
async function loadUserById() {
    const userId = document.getElementById('userIdInput').value;
    const resultDiv = document.getElementById('userResult');
    resultDiv.innerHTML = '<span class="text-warning">Загрузка...</span>';

    try {
        const response = await fetch(USER_DETAIL_URL(userId));

        if (response.status === 404) {
            resultDiv.innerHTML = `<span class="text-danger">Пользователь ID ${userId} не найден.</span>`;
            return;
        }

        if (!response.ok) {
            throw new Error(`Ошибка API: ${response.status}`);
        }

        const user = await response.json();

        // Отображение результата
        const date = user.last_update ? new Date(user.last_update).toLocaleDateString() : '—';
        resultDiv.innerHTML = `
            <span class="text-success">✅ Найдено:</span> 
            <strong>${user.username}</strong> | 
            Баллы: ${user.score} | 
            Этап: ${user.stage} | 
            Обновление: ${date}
        `;

    } catch (error) {
        console.error("Ошибка при загрузке пользователя по ID:", error);
        resultDiv.innerHTML = `<span class="text-danger">❌ Ошибка: ${error.message}</span>`;
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

        // ЯЧЕЙКА ДЕЙСТВИЙ
        const actionsCell = row.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger';
        deleteBtn.textContent = '❌ Удалить';
        // Теперь кнопка вызывает функцию deleteUser
        deleteBtn.onclick = () => deleteUser(user.id);
        actionsCell.appendChild(deleteBtn);
    });
}


// ==========================================================
// ФУНКЦИИ УПРАВЛЕНИЯ МЕДИАФАЙЛАМИ
// ==========================================================

/**
 * Загружает выбранный файл на сервер.
 * Использует: POST /uploadfile/
 */
async function uploadFile() {
    const fileInput = document.getElementById('mediaFile');
    const uploadStatus = document.getElementById('uploadStatus');
    const file = fileInput.files[0];

    if (!file) {
        uploadStatus.className = 'text-danger';
        uploadStatus.textContent = 'Выберите файл для загрузки.';
        return;
    }

    uploadStatus.className = 'text-warning';
    uploadStatus.textContent = `Загрузка файла ${file.name}...`;

    const formData = new FormData();
    formData.append("file", file); // 'file' должно совпадать с именем параметра в FastAPI

    try {
        const response = await fetch(UPLOAD_FILE_URL, {
            method: 'POST',
            body: formData, // FormData отправляется автоматически как multipart/form-data
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || response.statusText);
        }

        uploadStatus.className = 'text-success';
        uploadStatus.innerHTML = `✅ Файл <strong>${data.filename}</strong> загружен! <a href="${data.url}" target="_blank">Открыть</a>`;
        fileInput.value = ''; // Очистить input
        listMediaFiles(); // Обновить список файлов
    } catch (error) {
        console.error("Ошибка при загрузке файла:", error);
        uploadStatus.className = 'text-danger';
        uploadStatus.textContent = `❌ Ошибка загрузки: ${error.message}`;
    }
}

/**
 * Получает список всех файлов из папки media.
 * Использует: GET /media/list/
 */
async function listMediaFiles() {
    const mediaList = document.getElementById('mediaList');
    mediaList.innerHTML = '<li class="list-group-item text-info">Загрузка списка...</li>';

    try {
        const response = await fetch(MEDIA_LIST_URL);
        if (!response.ok) {
            throw new Error(`Ошибка API: ${response.status} - ${response.statusText}`);
        }
        const fileList = await response.json();

        renderMediaList(fileList);

    } catch (error) {
        console.error("Ошибка при получении списка файлов:", error);
        mediaList.innerHTML = `<li class="list-group-item text-danger">Ошибка: ${error.message}</li>`;
    }
}

/**
 * Отображает список файлов на странице.
 */
function renderMediaList(files) {
    const mediaList = document.getElementById('mediaList');
    mediaList.innerHTML = '';

    if (files.length === 0) {
        mediaList.innerHTML = '<li class="list-group-item text-muted">Папка media пуста.</li>';
        return;
    }

    files.forEach(filename => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';

        const fileUrl = `${API_BASE_URL}/media/${filename}`;

        item.innerHTML = `
            ${filename}
            <a href="${fileUrl}" target="_blank" class="btn btn-sm btn-outline-primary">Посмотреть</a>
        `;
        mediaList.appendChild(item);
    });
}