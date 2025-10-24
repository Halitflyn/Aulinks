// Глобальні змінні
let scheduleData = null;
let themeAutoHideTimer; // Для старої логіки кнопки теми
const themeBtn = document.getElementById('themeBtn'); // Стара кнопка теми
const SCHEDULE_STORAGE_KEY = 'myCustomSchedule';

// Елементи
let subgroupFilter, showAllWeeks, hideEmptyLessons, showNextWeekBtn;
let toggleFiltersBtn, advancedFiltersPanel, openModalBtn, settingsModal, modalClose;
let importBtn, importFile, exportBtn, deleteBtn, importStatusEl;

// === CSS Змінні ===
const cssRoot = document.documentElement;
const getCssVar = (varName) => getComputedStyle(cssRoot).getPropertyValue(varName).trim();

// Функції для cookies
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
    const today = new Date(); const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0'); const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function daysDifference(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1); const d2 = new Date(dateStr2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return Infinity;
    const diffTime = Math.abs(d2.getTime() - d1.getTime()); return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
function loadCanceledLessons() {
    const cookie = getCookie('canceledLessons'); if (!cookie) return { asSet: new Set(), asList: [] };
    let list = []; try { list = JSON.parse(cookie); if (!Array.isArray(list)) list = []; } catch (e) { list = []; }
    const today = getTodayDateString();
    const cleanedList = list.filter(item => item?.id && item.canceledOn && daysDifference(item.canceledOn, today) < 7);
    if (cleanedList.length < list.length) setCookie('canceledLessons', JSON.stringify(cleanedList));
    return { asSet: new Set(cleanedList.map(item => item.id)), asList: cleanedList };
}
function toggleCanceledLesson(id) {
    if (!id) return; const { asList } = loadCanceledLessons(); const today = getTodayDateString();
    const index = asList.findIndex(item => item.id === id);
    if (index > -1) asList.splice(index, 1); else asList.push({ id: id, canceledOn: today });
    setCookie('canceledLessons', JSON.stringify(asList));
}
// --- ---

// --- Функції для тижнів ---
function getISOWeek(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return NaN;
    const d = new Date(date.getTime()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const yearStart = new Date(d.getFullYear(), 0, 1); const week1 = new Date(d.getFullYear(), 0, 4);
    if (isNaN(week1.getTime())) return NaN; const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum); const dayOfYear = Math.floor((d - yearStart) / 86400000) + 1;
    return Math.ceil(dayOfYear / 7);
}
function getCurrentType() {
    const showNextWeek = showNextWeekBtn?.classList.contains('active') || false;
    const now = new Date(); if (showNextWeek) now.setDate(now.getDate() + 7);
    const startSemesterStr = scheduleData?.startDate;
    if (!startSemesterStr) { const cw = getISOWeek(now); return isNaN(cw) || cw % 2 !== 0 ? 'num' : 'den'; }
    const startSemester = new Date(startSemesterStr);
    if (isNaN(startSemester.getTime())) { const cw = getISOWeek(now); return isNaN(cw) || cw % 2 !== 0 ? 'num' : 'den'; }
    const weekStart = getISOWeek(startSemester); const currentWeek = getISOWeek(now);
    if (isNaN(weekStart) || isNaN(currentWeek)) return 'num';
    const startWeekIsOdd = weekStart % 2 !== 0; const currentWeekIsOdd = currentWeek % 2 !== 0;
    const isNumerator = startWeekIsOdd === currentWeekIsOdd;
    return isNumerator ? 'num' : 'den';
}
function getWeekDates(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) date = new Date();
    const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff); const friday = new Date(monday); friday.setDate(friday.getDate() + 4);
    return { start: monday, end: friday };
}
// --- ---

// --- Завантаження JSON даних ---
async function loadScheduleData() { /* ... без змін ... */ }
// --- ---

// --- Генерація навігації ---
function generateNavigation() { /* ... без змін ... */ }
function getShortDayName(fullName) { /* ... без змін ... */ }
// --- ---

// --- Генерація розкладу ---
function generateSchedule() { /* ... без змін ... */ }
function generateLessonCard(lesson, dayKey) { /* ... без змін ... */ }
function getSubgroupClass(sub) { /* ... без змін ... */ }
function getSubgroupLabel(sub) { /* ... без змін ... */ }
function getTypeLabel(type) { /* ... без змін ... */ }
// --- ---

// Фільтрація розкладу
function filterSchedule() {
    const subgroup = subgroupFilter?.value || 'all'; const showAll = showAllWeeks?.checked || false;
    const hideEmpty = hideEmptyLessons?.checked || false; const canceledLessonIds = loadCanceledLessons().asSet;
    const currentType = getCurrentType(); const cards = document.querySelectorAll('#schedule-container .card');

    if (showNextWeekBtn) { /* ... логіка блокування кнопки ... */ }

    cards.forEach(card => {
        if (!card) return; let emptyMsg = card.querySelector('.empty-message');
        const timeEl = card.querySelector('.time'); const mainContentEl = card.querySelector('p[data-main-content]');
        const teacherRoomEl = card.querySelector('.teacher-room'); const subgroups = card.querySelectorAll('.subgroup');
        const h3El = card.querySelector('h3');

        const isCanceled = canceledLessonIds.has(card.id); card.classList.toggle('canceled', isCanceled);

        if (isCanceled) { /* ... логіка показу "Скасовано" ... */ return; }

        if (emptyMsg) { if (emptyMsg.textContent === 'Скасовано') emptyMsg.remove(); else emptyMsg.style.display = 'none'; }
        if (timeEl) timeEl.style.display = 'block'; if (mainContentEl) mainContentEl.style.display = 'block';
        if (teacherRoomEl) teacherRoomEl.style.display = 'block';

        let hasVisibleContent = false;
        if (mainContentEl) { /* ... логіка видимості головного контенту ... */ }
        if (subgroups.length > 0) { /* ... логіка видимості підгруп ... */ }
        if (card.classList.contains('empty') && !mainContentEl && subgroups.length === 0) { hasVisibleContent = false; }

        if (hasVisibleContent) { /* ... логіка показу контенту ... */ }
        else { /* ... логіка показу "Немає" або приховування ... */ }
    });

    const weekLabels = document.querySelectorAll('.week-label');
    weekLabels.forEach(label => label.style.display = showAll ? 'none' : 'inline');

    updateWeekInfo(); highlightCurrentPair(); saveSettings();
    // generateReports();
}


// Оновлення інформації про тиждень
function updateWeekInfo() { /* ... без змін ... */ }

// --- Навігація, Поточний день ---
function scrollToDay(dayId) { /* ... без змін ... */ }
function updateNavText() { /* ... без змін ... */ }
function highlightToday() { /* ... без змін ... */ }
function highlightCurrentPair() { /* ... без змін ... */ }
// --- ---

// === Логіка Темної теми (тепер через кукі) ===
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  setCookie('darkMode', isDark ? 'true' : 'false'); // Зберігаємо в кукі
  // Стара логіка кнопки теми оновить її вигляд самостійно, якщо вона розгорнута
   if (themeBtn?.classList.contains('expanded')) {
       updateThemeButtonTime(); // Оновити текст/іконку на кнопці
   }
}
// === ===

// === Старі функції для кнопки Теми ===
function collectTodayIntervals() { /* ... без змін ... */ }
function updateThemeButtonTime() { /* ... без змін ... */ }
// === ===

// === Вібрація ===
function vibrate() { if (navigator.vibrate) navigator.vibrate(50); }
// === ===

// === Старий обробник кнопки Теми ===
if (themeBtn && themeBtn.classList.contains('theme-toggle')) {
  themeBtn.addEventListener('click', () => {
    if (!themeBtn.classList.contains('expanded')) {
      themeBtn.classList.add('expanded'); updateThemeButtonTime(); vibrate();
      clearTimeout(themeAutoHideTimer);
      themeAutoHideTimer = setTimeout(() => {
        themeBtn.classList.remove('expanded', 'green', 'yellow', 'purple');
        themeBtn.textContent = ''; themeBtn.style.color = 'white';
      }, 3000);
    } else {
      toggleDarkMode(); updateThemeButtonTime(); vibrate();
      clearTimeout(themeAutoHideTimer);
      themeAutoHideTimer = setTimeout(() => {
        themeBtn.classList.remove('expanded', 'green', 'yellow', 'purple');
        themeBtn.textContent = ''; themeBtn.style.color = 'white';
      }, 2000);
    }
  });
}
// === ===

// Завантаження налаштувань (з урахуванням теми з кукі)
function loadSettings() {
  const darkMode = getCookie('darkMode');
  if (darkMode === 'true') document.body.classList.add('dark-mode');
  else document.body.classList.remove('dark-mode');
  // Іконка для старої кнопки теми не потрібна при завантаженні

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
function handleCancelClick(e) { if (e.target?.classList.contains('cancel-btn')) { /* ... */ } }
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

    filterSchedule(); // Перший запуск фільтрації
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
