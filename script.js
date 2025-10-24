// Глобальні змінні
let scheduleData = null;
let themeAutoHideTimer; // Для старої логіки кнопки теми
const themeBtn = document.getElementById('themeBtn'); // Стара кнопка теми
const SCHEDULE_STORAGE_KEY = 'myCustomSchedule';

// Елементи (оголошуємо глобально для доступу)
let subgroupFilter, showAllWeeks, hideEmptyLessons, showNextWeekBtn;
let toggleFiltersBtn, advancedFiltersPanel, openModalBtn, settingsModal, modalClose;
let importBtn, importFile, exportBtn, deleteBtn, importStatusEl; // Елементи модалки

// === CSS Змінні (для JS доступу, якщо потрібно) ===
const cssRoot = document.documentElement;
const getCssVar = (varName) => getComputedStyle(cssRoot).getPropertyValue(varName).trim();
// const setCssVar = (varName, value) => cssRoot.style.setProperty(varName, value);

// Функції для cookies (для налаштувань фільтрів)
function setCookie(name, value, days = 30) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

// --- Функції для скасованих пар ---
function getTodayDateString() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function daysDifference(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        console.error("Invalid date string provided to daysDifference:", dateStr1, dateStr2);
        return Infinity;
    }
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
function loadCanceledLessons() {
    const cookie = getCookie('canceledLessons');
    if (!cookie) return { asSet: new Set(), asList: [] };
    let list = [];
    try { list = JSON.parse(cookie); if (!Array.isArray(list)) list = []; } catch (e) { list = []; }
    const today = getTodayDateString();
    const cleanedList = list.filter(item => item && item.id && item.canceledOn && daysDifference(item.canceledOn, today) < 7);
    if (cleanedList.length < list.length) setCookie('canceledLessons', JSON.stringify(cleanedList));
    return { asSet: new Set(cleanedList.map(item => item.id)), asList: cleanedList };
}
function toggleCanceledLesson(id) {
    if (!id) return;
    const { asList } = loadCanceledLessons();
    const today = getTodayDateString();
    const index = asList.findIndex(item => item.id === id);
    if (index > -1) asList.splice(index, 1); else asList.push({ id: id, canceledOn: today });
    setCookie('canceledLessons', JSON.stringify(asList));
}
// --- Кінець функцій скасування ---

// --- Функції для тижнів ---
function getISOWeek(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return NaN;
    const t = date.getTime();
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    // January 4 is always in week 1.
    const week1 = new Date(d.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getCurrentType() {
    const showNextWeek = showNextWeekBtn?.classList.contains('active') || false;
    const now = new Date();
    if (showNextWeek) now.setDate(now.getDate() + 7);

    const startSemesterStr = scheduleData?.startDate;
    if (!startSemesterStr) {
        console.warn("startDate is not defined in scheduleData. Assuming current week based on ISO week number.");
        const currentWeekNum = getISOWeek(now);
        // Непарні ISO тижні - чисельник, парні - знаменник (типово)
        return isNaN(currentWeekNum) || currentWeekNum % 2 !== 0 ? 'num' : 'den';
    }

    const startSemester = new Date(startSemesterStr);
     if (isNaN(startSemester.getTime())) {
        console.error("Invalid startDate in scheduleData:", startSemesterStr,". Assuming current week based on ISO.");
         const currentWeekNum = getISOWeek(now);
         return isNaN(currentWeekNum) || currentWeekNum % 2 !== 0 ? 'num' : 'den';
    }

    const weekStart = getISOWeek(startSemester);
    const currentWeek = getISOWeek(now);

    if (isNaN(weekStart) || isNaN(currentWeek)) {
         console.error("Could not calculate week numbers. Assuming numerator.");
         return 'num';
    }

    // Розрахунок парності відносно тижня старту
    const startWeekIsOdd = weekStart % 2 !== 0;
    const currentWeekIsOdd = currentWeek % 2 !== 0;
    // Чисельник, якщо парність збігається (непарний-непарний або парний-парний відносно старту)
    const isNumerator = startWeekIsOdd === currentWeekIsOdd;

    return isNumerator ? 'num' : 'den';
}
function getWeekDates(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) date = new Date();
    const d = new Date(date); const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    // Створюємо нові об'єкти Date, щоб уникнути мутації
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    const friday = new Date(monday); friday.setDate(friday.getDate() + 4);
    return { start: monday, end: friday };
}
// --- ---

// --- Завантаження JSON даних ---
async function loadScheduleData() {
    const customSchedule = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (customSchedule) {
        try {
            console.log('Завантаження збереженого розкладу...');
            scheduleData = JSON.parse(customSchedule);
            if (typeof scheduleData !== 'object' || scheduleData === null || !scheduleData.schedule) throw new Error("Invalid data format in localStorage");
            return scheduleData;
        } catch (e) {
            console.error('Помилка читання збереженого розкладу:', e);
            localStorage.removeItem(SCHEDULE_STORAGE_KEY);
        }
    }
    try {
        console.log('Завантаження розкладу за замовчуванням...');
        const response = await fetch('./schedule.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        scheduleData = await response.json();
         if (typeof scheduleData !== 'object' || scheduleData === null || !scheduleData.schedule) throw new Error("Invalid data format in schedule.json");
        return scheduleData;
    } catch (error) {
        console.error('Помилка завантаження розкладу:', error);
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.innerHTML = `
              <div style="color: #d32f2f; text-align: center;">
                <h3>❌ Помилка завантаження</h3>
                <p>Не вдалося завантажити дані розкладу (${error.message}). Спробуйте оновити сторінку.</p>
                <p style="font-size: 0.8em; color: #666;">(Можлива помилка в schedule.json або проблеми з мережею)</p>
              </div>`;
        }
        return null; // Повертаємо null при помилці
    }
}
// --- ---

// --- Генерація навігації ---
function generateNavigation() {
    const nav = document.getElementById('navigation');
    if (!nav || !scheduleData?.schedule) return;
    const days = Object.keys(scheduleData.schedule);
    nav.innerHTML = days.map(dayKey => {
        const dayName = scheduleData.schedule[dayKey]?.name || dayKey;
        const shortName = getShortDayName(dayName);
        // Використовуємо dataset для зберігання ключів дня
        return `<a href="#${dayKey}" data-daykey="${dayKey}" data-full="${dayName}" data-short="${shortName}">${dayName}</a>`;
    }).join('');
    // Додаємо обробник кліків на посилання навігації
     addNavClickHandlers();
}
function getShortDayName(fullName) {
    const shortNames = { 'Понеділок': 'ПН', 'Вівторок': 'ВТ', 'Середа': 'СР', 'Четвер': 'ЧТ', 'П\'ятниця': 'ПТ' };
    return shortNames[fullName] || fullName?.substring(0, 2).toUpperCase() || '?';
}
// Нова функція для плавної прокрутки через JS
function scrollToDay(dayId) {
    const element = document.getElementById(dayId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
// Додаємо обробники до посилань навігації
function addNavClickHandlers() {
    const navLinks = document.querySelectorAll('#navigation a');
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // Забороняємо стандартний перехід по якорю
            const dayKey = link.dataset.daykey;
            if (dayKey) {
                scrollToDay(dayKey);
            }
        });
    });
}
// --- ---

// --- Генерація розкладу ---
function generateSchedule() {
    const container = document.getElementById('schedule-container');
    if (!container || !scheduleData?.schedule) return;
    const days = Object.keys(scheduleData.schedule);
    container.innerHTML = days.map(dayKey => {
        const day = scheduleData.schedule[dayKey];
        if (!day || !Array.isArray(day.lessons)) return '';
        return `
          <section class="day" id="${dayKey}">
            <h2>${day.name || dayKey}</h2>
            <div class="cards">
              ${day.lessons.map(lesson => generateLessonCard(lesson, dayKey)).join('')}
            </div>
          </section>`;
    }).join('');
}
function generateLessonCard(lesson, dayKey) {
    if (!lesson || typeof lesson !== 'object') return ''; // Посилена перевірка
    const lessonNumber = lesson.number ?? '?'; // Використовуємо ?? для fallback
    const hasSubgroups = Array.isArray(lesson.subgroups) && lesson.subgroups.length > 0;
    const isEmpty = (lesson.type === 'empty' || !lesson.subject) && !hasSubgroups;
    let cardClass = isEmpty ? 'card empty' : `card ${lesson.type || 'unknown'}`;
    if (!hasSubgroups && lesson.weeks && (lesson.weeks === 'num' || lesson.weeks === 'den')) {
        cardClass += ` numden ${lesson.weeks}`;
    }
    const lessonId = `lesson-${dayKey}-${lessonNumber}`;
    if (isEmpty) {
        return `<article class="${cardClass}" id="${lessonId}"><h3>${lessonNumber} пара</h3><p class="empty-message">Немає</p></article>`;
    }
    let subgroupsHtml = ''; let mainContent = '';
    if (hasSubgroups) {
        subgroupsHtml = lesson.subgroups.map(sub => {
            if (!sub) return '';
            const subClass = getSubgroupClass(sub); const subLabel = getSubgroupLabel(sub);
            let weekLabel = '';
            if (sub.weeks === 'num') weekLabel = '<span class="week-label num-label"> (Чисельник)</span>';
            else if (sub.weeks === 'den') weekLabel = '<span class="week-label den-label"> (Знаменник)</span>';
            return `
              <div class="subgroup ${subClass}">
                <p class="subgroup-label">${subLabel}${weekLabel}</p>
                <p><b>${sub.subject || '?'}</b> (${getTypeLabel(sub.type)})</p>
                <p class="teacher-room">${sub.teacher || ''}${sub.room ? ', ' + sub.room : ''}</p>
              </div>`;
        }).join('');
    } else if (lesson.subject) {
        mainContent = `
          <p data-main-content="true"><b>${lesson.subject}</b> (${getTypeLabel(lesson.type)})</p>
          <p class="teacher-room">${lesson.teacher || ''}${lesson.room ? ', ' + lesson.room : ''}</p>`;
    }
    // Перевірка часу на валідність (проста)
    const timeDisplay = typeof lesson.time === 'string' && lesson.time.includes('–') ? lesson.time : '??:?? – ??:??';
    return `
      <article class="${cardClass}" id="${lessonId}">
        <h3>
          ${lessonNumber} пара
          <button class="cancel-btn" title="Скасувати/повернути пару" data-lesson-id="${lessonId}">❌</button>
        </h3>
        ${mainContent}${subgroupsHtml}
        <p class="time">${timeDisplay}</p>
      </article>`;
}
function getSubgroupClass(sub) { return (sub?.weeks && ['num', 'den'].includes(sub.weeks) ? `numden ${sub.weeks}` : '') + (sub?.group && ['sub1', 'sub2'].includes(sub.group) ? ` ${sub.group}`: ''); }
function getSubgroupLabel(sub) { if (sub?.group === 'sub1') return 'Підгрупа 1'; if (sub?.group === 'sub2') return 'Підгрупа 2'; return ''; }
function getTypeLabel(type) { const types = { 'lecture': 'Лекція', 'practical': 'Практична', 'lab': 'Лабораторна', 'mixed': 'Змішана' }; return types[type] || type || '?'; }
// --- ---

// Фільтрація розкладу
function filterSchedule() {
    const subgroup = subgroupFilter?.value || 'all';
    const showAll = showAllWeeks?.checked || false;
    const hideEmpty = hideEmptyLessons?.checked || false;
    const canceledLessonIds = loadCanceledLessons().asSet;
    const currentType = getCurrentType();
    const cards = document.querySelectorAll('#schedule-container .card');

    if (showNextWeekBtn) {
        const isDisabled = showAll;
        showNextWeekBtn.disabled = isDisabled;
        showNextWeekBtn.style.opacity = isDisabled ? '0.5' : '1';
        showNextWeekBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
        if (isDisabled) showNextWeekBtn.classList.remove('active');
    }

    cards.forEach(card => {
        if (!card) return;
        let emptyMsg = card.querySelector('.empty-message');
        const timeEl = card.querySelector('.time');
        const mainContentEl = card.querySelector('p[data-main-content]');
        const teacherRoomEl = card.querySelector('.teacher-room');
        const subgroups = card.querySelectorAll('.subgroup');
        const h3El = card.querySelector('h3');

        const isCanceled = canceledLessonIds.has(card.id);
        card.classList.toggle('canceled', isCanceled);

        if (isCanceled) {
            if (!emptyMsg && h3El) { emptyMsg = document.createElement('p'); emptyMsg.className = 'empty-message'; h3El.insertAdjacentElement('afterend', emptyMsg); }
            if (emptyMsg) { emptyMsg.textContent = 'Скасовано'; emptyMsg.style.display = 'block'; }
            if (timeEl) timeEl.style.display = 'none';
            if (mainContentEl) mainContentEl.style.display = 'none';
            if (teacherRoomEl) teacherRoomEl.style.display = 'none';
            subgroups.forEach(sub => sub.style.display = 'none');
            card.style.display = 'flex'; card.classList.remove('empty');
            return;
        }

        if (emptyMsg) { if (emptyMsg.textContent === 'Скасовано') emptyMsg.remove(); else emptyMsg.style.display = 'none'; }
        if (timeEl) timeEl.style.display = 'block'; if (mainContentEl) mainContentEl.style.display = 'block';
        if (teacherRoomEl) teacherRoomEl.style.display = 'block';

        let hasVisibleContent = false;
        if (mainContentEl) {
            let mainVisible = true;
            if (!showAll) {
                const weekType = card.classList.contains('num') ? 'num' : (card.classList.contains('den') ? 'den' : 'all');
                if (weekType !== 'all' && weekType !== currentType) mainVisible = false;
            }
            if (mainVisible) hasVisibleContent = true;
            else { mainContentEl.style.display = 'none'; if (teacherRoomEl) teacherRoomEl.style.display = 'none'; }
        }

        if (subgroups.length > 0) {
            subgroups.forEach(sub => {
                if (!sub) return;
                let visible = true;
                const subType = sub.classList.contains('sub1') ? 'sub1' : (sub.classList.contains('sub2') ? 'sub2' : 'all');
                if (subgroup !== 'all' && subType !== 'all' && subType !== subgroup) visible = false;
                if (!showAll) {
                    const weekType = sub.classList.contains('num') ? 'num' : (sub.classList.contains('den') ? 'den' : 'all');
                    if (weekType !== 'all' && weekType !== currentType) visible = false;
                }
                sub.style.display = visible ? 'block' : 'none';
                if (visible) hasVisibleContent = true;
            });
        }

        // Порожня картка - це та, що має клас 'empty' І НЕ має видимого контенту ПІСЛЯ фільтрації
        const initiallyEmpty = card.classList.contains('empty') && !mainContentEl && subgroups.length === 0;
        if (initiallyEmpty) { hasVisibleContent = false; }


        if (hasVisibleContent) {
             if (card.classList.contains('empty')) { // Якщо вона БУЛА порожньою, але контент з'явився
                 card.classList.remove('empty');
                 if (emptyMsg) emptyMsg.style.display = 'none';
             }
            card.style.display = 'flex';
            if (timeEl) timeEl.style.display = 'block';
        } else {
             // Якщо картка стала порожньою ПІСЛЯ фільтрації, АБО була порожньою
             if (!card.classList.contains('empty')) card.classList.add('empty'); // Додаємо клас
            if (timeEl) timeEl.style.display = 'none';
            if (!emptyMsg && h3El) { emptyMsg = document.createElement('p'); emptyMsg.className = 'empty-message'; h3El.insertAdjacentElement('afterend', emptyMsg); }
            if (emptyMsg) { emptyMsg.textContent = 'Немає'; emptyMsg.style.display = 'block'; }
            card.style.display = hideEmpty ? 'none' : 'flex';
        }
    });

    const weekLabels = document.querySelectorAll('.week-label');
    weekLabels.forEach(label => label.style.display = showAll ? 'none' : 'inline');

    updateWeekInfo();
    highlightCurrentPair();
    saveSettings();
    generateReports(); // Повертаємо виклик звітів сюди
}


// Оновлення інформації про тиждень
function updateWeekInfo() { /* ... без змін ... */ }

// --- Навігація, Поточний день ---
// scrollToDay перенесено вище, до generateNavigation
function updateNavText() { /* ... без змін ... */ }
function highlightToday() { /* ... без змін ... */ }
function highlightCurrentPair() { /* ... без змін ... */ }
// --- ---

// === Логіка Темної теми (тепер через кукі) ===
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  setCookie('darkMode', isDark ? 'true' : 'false'); // Зберігаємо в кукі
   if (themeBtn?.classList.contains('expanded')) { updateThemeButtonTime(); }
}
// === ===

// === Старі функції для кнопки Теми ===
function collectTodayIntervals() { /* ... без змін ... */ }
function updateThemeButtonTime() {
     if (!themeBtn || !themeBtn.classList.contains('expanded')) return;
     const now = new Date(); const currentMinutes = now.getHours() * 60 + now.getMinutes();
     const intervals = collectTodayIntervals(); let current = null; let upcomingDiff = Infinity; let minutesLeft = null;
     intervals.forEach(({ start, end }) => { /* ... */ });
     themeBtn.classList.remove('green', 'yellow', 'purple'); themeBtn.style.color = 'white';
     if (current) { themeBtn.classList.add('green'); themeBtn.textContent = `${minutesLeft}хв`; }
     else if (upcomingDiff <= 15) { themeBtn.classList.add('yellow'); themeBtn.style.color = '#222'; themeBtn.textContent = `${upcomingDiff}хв`; }
     else { themeBtn.classList.add('purple'); themeBtn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙'; }
}
// === ===

// === Вібрація ===
function vibrate() { if (navigator.vibrate) navigator.vibrate(50); }
// === ===

// === Старий обробник кнопки Теми ===
if (themeBtn && themeBtn.classList.contains('theme-toggle')) { /* ... без змін ... */ }
// === ===

// Завантаження налаштувань (з урахуванням теми з кукі)
function loadSettings() {
  const darkMode = getCookie('darkMode');
  if (darkMode === 'true') document.body.classList.add('dark-mode');
  else document.body.classList.remove('dark-mode');

  const subgroup = getCookie('subgroupFilter');
  if (subgroup && subgroupFilter) subgroupFilter.value = subgroup;
  else if (subgroupFilter) subgroupFilter.value = 'all';

  const showAll = getCookie('showAllWeeks');
  if (showAllWeeks) showAllWeeks.checked = (showAll === 'true');

  const hideEmpty = getCookie('hideEmptyLessons');
  if (hideEmptyLessons) hideEmptyLessons.checked = (hideEmpty === 'true');

  const showNext = getCookie('showNextWeek');
  if (showNextWeekBtn) {
      if (showNext === 'true') showNextWeekBtn.classList.add('active');
      else showNextWeekBtn.classList.remove('active');
  }
}

// Збереження налаштувань (Без теми)
function saveSettings() {
  if (subgroupFilter) setCookie('subgroupFilter', subgroupFilter.value);
  if (showAllWeeks) setCookie('showAllWeeks', showAllWeeks.checked ? 'true' : 'false');
  if (hideEmptyLessons) setCookie('hideEmptyLessons', hideEmptyLessons.checked ? 'true' : 'false');
  if (showNextWeekBtn) setCookie('showNextWeek', showNextWeekBtn.classList.contains('active') ? 'true' : 'false');
}

// --- Обробник кліку скасування ---
function handleCancelClick(e) { /* ... без змін ... */ }
// --- ---

// --- Звіти та Статистика ---
function generateReports() { /* ... без змін ... */ }
function calculateStatistics() { /* ... без змін ... */ }
// --- ---

// --- Модальне вікно Імпорту/Експорту ---
function initModal() { /* ... без змін, логіка всередині ... */ }
// --- ---


// === Ініціалізація додатку ===
async function initApp() {
    console.log("Initializing app...");
    subgroupFilter = document.getElementById('subgroupFilter');
    showAllWeeks = document.getElementById('showAllWeeks');
    hideEmptyLessons = document.getElementById('hideEmptyLessons');
    showNextWeekBtn = document.getElementById('showNextWeekBtn');
    toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
    advancedFiltersPanel = document.getElementById('advancedFiltersPanel');
    openModalBtn = document.getElementById('openModalBtn');

    loadSettings(); // Завантажуємо налаштування (включаючи тему з кукі)
    console.log("Settings loaded.");

    const data = await loadScheduleData();
    if (!data) { console.error("Failed to load schedule data."); return; }
    console.log("Schedule data loaded.");

    const titleEl = document.getElementById('schedule-title');
    if (titleEl) titleEl.textContent = `Розклад занять`;

    generateNavigation(); console.log("Navigation generated.");
    generateSchedule(); console.log("Schedule generated.");

    // Обробники подій
    toggleFiltersBtn?.addEventListener('click', () => {
        if (advancedFiltersPanel) {
            const isVisible = advancedFiltersPanel.style.display === 'block';
            advancedFiltersPanel.style.display = isVisible ? 'none' : 'block';
            if(toggleFiltersBtn) toggleFiltersBtn.textContent = isVisible ? '⚙️ Фільтри' : '⚙️ Сховати';
        }
    });
    openModalBtn?.addEventListener('click', () => {
        if (settingsModal) settingsModal.style.display = 'block';
        if (importStatusEl) { importStatusEl.textContent = ''; importStatusEl.className = 'status';}
    });
    showNextWeekBtn?.addEventListener('click', () => {
        showNextWeekBtn.classList.toggle('active');
        filterSchedule();
    });
    subgroupFilter?.addEventListener('change', filterSchedule);
    showAllWeeks?.addEventListener('change', filterSchedule);
    hideEmptyLessons?.addEventListener('change', filterSchedule);
    document.getElementById('schedule-container')?.addEventListener('click', handleCancelClick);
    console.log("Event listeners added.");

    initModal(); // Ініціалізуємо модальне вікно
    console.log("Modal initialized.");

    // Перший запуск фільтрації ПІСЛЯ того, як всі елементи створено та дані завантажено
    filterSchedule();
    console.log("Initial filter applied.");

    highlightToday(); updateNavText(); generateReports();
    console.log("UI updated.");

    const loadingEl = document.getElementById('loading');
    const containerEl = document.getElementById('schedule-container');
    if (loadingEl) loadingEl.style.display = 'none';
    if (containerEl) containerEl.style.display = 'block';
    console.log("App ready.");
}

// Запуск додатку
document.addEventListener('DOMContentLoaded', initApp);

// Оновлення кожну хвилину
const minuteUpdater = setInterval(() => {
  highlightCurrentPair();
  updateThemeButtonTime(); // Повертаємо оновлення для старої кнопки теми
}, 60000);

// Обробка зміни розміру екрану
window.addEventListener('resize', updateNavText);
