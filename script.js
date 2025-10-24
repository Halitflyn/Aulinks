// Глобальні змінні
let scheduleData = null;
let themeAutoHideTimer;
const themeBtn = document.getElementById('themeBtn');

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

// Функції для тижнів
function getISOWeek(date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getCurrentType() {
  const now = new Date();
  const startSemester = new Date(scheduleData?.startDate || '2025-09-08');
  const weekStart = getISOWeek(startSemester);
  const currentWeek = getISOWeek(now);
  const weeksSinceStart = currentWeek - weekStart + 1;
  const isNumerator = weeksSinceStart % 2 !== 0;
  return isNumerator ? 'num' : 'den';
}

function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setFullYear(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  return { start: monday, end: friday };
}

// Завантаження JSON даних
async function loadScheduleData() {
  try {
    const response = await fetch('./schedule.json');
    if (!response.ok) throw new Error('Не вдалося завантажити розклад');
    scheduleData = await response.json();
    return scheduleData;
  } catch (error) {
    console.error('Помилка завантаження розкладу:', error);
    document.getElementById('loading').innerHTML = `
      <div style="color: #d32f2f; text-align: center;">
        <h3>❌ Помилка завантаження</h3>
        <p>Не вдалося завантажити дані розкладу. Спробуйте оновити сторінку.</p>
      </div>
    `;
    return null;
  }
}

// Генерація навігації
function generateNavigation() {
  const nav = document.getElementById('navigation');
  const days = Object.keys(scheduleData.schedule);
  
  nav.innerHTML = days.map(dayKey => {
    const dayName = scheduleData.schedule[dayKey].name;
    const shortName = getShortDayName(dayName);
    return `<a href="#" onclick="scrollToDay('${dayKey}'); return false;" 
               data-full="${dayName}" data-short="${shortName}">${dayName}</a>`;
  }).join('');
}

function getShortDayName(fullName) {
  const shortNames = {
    'Понеділок': 'ПН',
    'Вівторок': 'ВТ',
    'Середа': 'СР',
    'Четвер': 'ЧТ',
    'П\'ятниця': 'ПТ'
  };
  return shortNames[fullName] || fullName.substring(0, 2).toUpperCase();
}

// Генерація розкладу
function generateSchedule() {
  const container = document.getElementById('schedule-container');
  const days = Object.keys(scheduleData.schedule);
  
  container.innerHTML = days.map(dayKey => {
    const day = scheduleData.schedule[dayKey];
    return `
      <section class="day" id="${dayKey}">
        <h2>${day.name}</h2>
        <div class="cards">
          ${day.lessons.map(lesson => generateLessonCard(lesson)).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function generateLessonCard(lesson) {
  const isEmpty = lesson.type === 'empty' || !lesson.subject;
  const cardClass = isEmpty ? 'card empty' : `card ${lesson.type}`;
  
  if (isEmpty) {
    return `
      <article class="${cardClass}">
        <h3>${lesson.number} пара</h3>
        <p>Немає</p>
      </article>
    `;
  }

  let subgroupsHtml = '';
  if (lesson.subgroups && lesson.subgroups.length > 0) {
    subgroupsHtml = lesson.subgroups.map(sub => {
      const subClass = getSubgroupClass(sub);
      const subLabel = getSubgroupLabel(sub);
      return `
        <div class="subgroup ${subClass}">
          <p class="subgroup-label ${sub.group === 'sub2' ? 'sub2' : 'sub1'}">${subLabel}</p>
          <p><b>${sub.subject}</b> (${getTypeLabel(sub.type)})</p>
          <p class="teacher-room">${sub.teacher}${sub.room ? ', ' + sub.room : ''}</p>
        </div>
      `;
    }).join('');
  }

  const mainContent = lesson.subgroups.length === 0 ? `
    <p><b>${lesson.subject}</b> (${getTypeLabel(lesson.type)})</p>
    <p class="teacher-room">${lesson.teacher}${lesson.room ? ', ' + lesson.room : ''}</p>
  ` : '';

  return `
    <article class="${cardClass}">
      <h3>${lesson.number} пара</h3>
      ${mainContent}
      ${subgroupsHtml}
      <p class="time">${lesson.time}</p>
    </article>
  `;
}

function getSubgroupClass(sub) {
  let classes = [];
  if (sub.weeks === 'num' || sub.weeks === 'den') {
    classes.push('numden', sub.weeks);
  }
  if (sub.group === 'sub1' || sub.group === 'sub2') {
    classes.push(sub.group);
  }
  return classes.join(' ');
}

function getSubgroupLabel(sub) {
  let label = '';
  if (sub.group === 'sub1') label = 'Підгрупа 1';
  else if (sub.group === 'sub2') label = 'Підгрупа 2';
  else if (sub.group === 'all') label = '';
  
  if (sub.weeks === 'num') label += label ? ' (Чисельник)' : 'Чисельник';
  else if (sub.weeks === 'den') label += label ? ' (Знаменник)' : 'Знаменник';
  
  return label;
}

function getTypeLabel(type) {
  const types = {
    'lecture': 'Лекція',
    'practical': 'Практична',
    'lab': 'Лабораторна',
    'mixed': 'Змішана'
  };
  return types[type] || type;
}

// Фільтрація розкладу
function filterSchedule() {
  const subgroup = document.getElementById('subgroupFilter').value;
  const showAll = document.getElementById('showAllWeeks').checked;
  const hideEmpty = document.getElementById('hideEmptyLessons').checked;
  const currentType = getCurrentType();
  const cards = document.querySelectorAll('.card');

  cards.forEach(card => {
    const subgroups = card.querySelectorAll('.subgroup');
    let hasVisibleContent = false;

    if (subgroups.length === 0) {
      // Картки без підгруп
      const isEmpty = card.classList.contains('empty');
      if (hideEmpty && isEmpty) {
        card.style.display = 'none';
      } else {
        card.style.display = 'block';
      }
    } else {
      // Сховати всі subgroups спочатку
      subgroups.forEach(sub => sub.style.display = 'none');

      subgroups.forEach(sub => {
        let visible = true;

        // Фільтр підгрупи
        if (subgroup !== 'all') {
          const subType = sub.classList.contains('sub1') ? 'sub1' : 
                         (sub.classList.contains('sub2') ? 'sub2' : 'all');
          if (subType !== 'all' && subType !== subgroup) visible = false;
        }

        // Фільтр тижня
        if (!showAll) {
          const weekType = sub.classList.contains('num') ? 'num' : 
                          (sub.classList.contains('den') ? 'den' : 'all');
          if (weekType !== 'all' && weekType !== currentType) visible = false;
        }

        sub.style.display = visible ? 'block' : 'none';
        if (visible) hasVisibleContent = true;
      });

      if (hasVisibleContent) {
        card.classList.remove('empty');
        card.style.display = 'block';
      } else {
        card.classList.add('empty');
        card.style.display = hideEmpty ? 'none' : 'block';
      }
    }
  });

  // Приховувати лейбли чисельник/знаменник при автоматичному режимі
  const labels = document.querySelectorAll('.num-label, .den-label');
  labels.forEach(label => {
    label.style.display = showAll ? '' : 'none';
  });

  updateWeekInfo();
  highlightCurrentPair();
  saveSettings();
  generateReports(); // Оновити звіти після фільтрації
}

// Оновлення інформації про тиждень
function updateWeekInfo() {
  const showAll = document.getElementById('showAllWeeks').checked;
  const infoSpan = document.getElementById('currentWeekInfo');
  if (showAll) {
    infoSpan.innerHTML = '';
  } else {
    const type = getCurrentType();
    const dates = getWeekDates(new Date());
    const typeName = type === 'num' ? 'Чисельник' : 'Знаменник';
    infoSpan.innerHTML = `${typeName} (${dates.start.toLocaleDateString('uk-UA')} – ${dates.end.toLocaleDateString('uk-UA')})`;
  }
}

// Навігація
function scrollToDay(dayId) {
  const element = document.getElementById(dayId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return false;
}

// Оновлення тексту навігації для мобільного
function updateNavText() {
  const isMobile = window.innerWidth <= 600;
  const links = document.querySelectorAll('nav a');
  links.forEach(link => {
    if (isMobile) {
      link.textContent = link.dataset.short;
    } else {
      link.textContent = link.dataset.full;
    }
  });
}

// Темна тема
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  setCookie('darkMode', isDark ? 'true' : 'false');
}

// Поточний день
function highlightToday() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = new Date().getDay();
  const todayKey = days[today];
  
  const daySections = document.querySelectorAll('.day');
  daySections.forEach(section => {
    section.classList.remove('today');
    if (section.id === todayKey) {
      section.classList.add('today');
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Підсвітити активний день у верхньому меню
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    link.classList.remove('active-day');
    const dayName = scheduleData?.schedule[todayKey]?.name;
    if (link.dataset && link.dataset.full === dayName) {
      link.classList.add('active-day');
    }
  });
}

// Виділення поточної/наступної пари
function highlightCurrentPair() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todaySection = document.querySelector('.day.today');
  
  if (!todaySection) return;

  const cards = todaySection.querySelectorAll('.card:not(.empty)');
  let currentCard = null;
  let upcomingCard = null;
  let minDiffToStart = Infinity;

  cards.forEach(card => {
    if (card.style.display === 'none') return;

    const timeP = card.querySelector('.time');
    if (!timeP || !timeP.textContent) return;

    const timeText = timeP.textContent;
    const [startTime, endTime] = timeText.split(' – ');
    if (!startTime || !endTime) return;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) return;

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      card.classList.add('current');
      card.classList.remove('upcoming');
      currentCard = card;
      return;
    }

    if (startMinutes > currentMinutes) {
      const diff = startMinutes - currentMinutes;
      if (diff < minDiffToStart) {
        minDiffToStart = diff;
        upcomingCard = card;
      }
    }
  });

  // Очистити попередні класи
  cards.forEach(c => {
    c.classList.remove('current', 'upcoming');
  });

  if (currentCard) {
    currentCard.classList.add('current');
  }

  if (upcomingCard && minDiffToStart <= 15) {
    upcomingCard.classList.add('upcoming');
  }
}

// Збір проміжків часу для кнопки теми
function collectTodayIntervals() {
  const todaySection = document.querySelector('.day.today');
  if (!todaySection) return [];
  const cards = todaySection.querySelectorAll('.card:not(.empty)');
  const intervals = [];
  
  cards.forEach(card => {
    if (card.style.display === 'none') return;
    const timeEl = card.querySelector('.time');
    if (!timeEl || !timeEl.textContent) return;
    const [startTime, endTime] = timeEl.textContent.split(' – ');
    if (!startTime || !endTime) return;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return;
    intervals.push({ start: sh * 60 + sm, end: eh * 60 + em });
  });
  
  intervals.sort((a, b) => a.start - b.start);
  return intervals;
}

// Оновлення кнопки теми
function updateThemeButtonTime() {
  if (!themeBtn || !themeBtn.classList.contains('expanded')) return;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const intervals = collectTodayIntervals();

  let current = null;
  let upcomingDiff = Infinity;
  let minutesLeft = null;

  intervals.forEach(({ start, end }) => {
    if (currentMinutes >= start && currentMinutes < end) {
      current = { start, end };
      minutesLeft = end - currentMinutes;
    } else if (start > currentMinutes) {
      const diff = start - currentMinutes;
      if (diff < upcomingDiff) upcomingDiff = diff;
    }
  });

  themeBtn.className = 'theme-toggle expanded';
  if (current) {
    themeBtn.classList.add('green');
    themeBtn.textContent = `${minutesLeft}хв`;
  } else if (upcomingDiff !== Infinity) {
    themeBtn.classList.add('yellow');
    themeBtn.textContent = `${upcomingDiff}хв`;
  } else {
    themeBtn.classList.add('purple');
    themeBtn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
  }
}

// Вібрація
function vibrate() {
  if (navigator.vibrate) navigator.vibrate(50);
}

// Обробник кнопки теми
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    if (!themeBtn.classList.contains('expanded')) {
      themeBtn.classList.add('expanded');
      updateThemeButtonTime();
      vibrate();
      clearTimeout(themeAutoHideTimer);
      themeAutoHideTimer = setTimeout(() => {
        themeBtn.classList.remove('expanded', 'green', 'yellow', 'purple');
        themeBtn.textContent = '';
        vibrate();
      }, 3000);
    } else {
      toggleDarkMode();
      updateThemeButtonTime();
      vibrate();
      clearTimeout(themeAutoHideTimer);
      themeAutoHideTimer = setTimeout(() => {
        themeBtn.classList.remove('expanded', 'green', 'yellow', 'purple');
        themeBtn.textContent = '';
        vibrate();
      }, 2000);
    }
  });
}

// Завантаження налаштувань
function loadSettings() {
  const darkMode = getCookie('darkMode');
  if (darkMode === 'true') {
    document.body.classList.add('dark-mode');
  }

  const subgroup = getCookie('subgroupFilter');
  if (subgroup) {
    document.getElementById('subgroupFilter').value = subgroup;
  }

  const showAll = getCookie('showAllWeeks');
  if (showAll === 'true') {
    document.getElementById('showAllWeeks').checked = true;
  }

  const hideEmpty = getCookie('hideEmptyLessons');
  if (hideEmpty === 'true') {
    document.getElementById('hideEmptyLessons').checked = true;
  }
}

// Збереження налаштувань
function saveSettings() {
  const subgroup = document.getElementById('subgroupFilter').value;
  const showAll = document.getElementById('showAllWeeks').checked;
  const hideEmpty = document.getElementById('hideEmptyLessons').checked;
  setCookie('subgroupFilter', subgroup);
  setCookie('showAllWeeks', showAll ? 'true' : 'false');
  setCookie('hideEmptyLessons', hideEmpty ? 'true' : 'false');
}

// Генерація звітів та статистики
function generateReports() {
  if (!scheduleData) return;

  const stats = calculateStatistics();
  
  // Оновити статистичні картки
  document.getElementById('totalLessons').textContent = stats.totalLessons;
  document.getElementById('totalSubjects').textContent = stats.subjects.size;
  document.getElementById('totalTeachers').textContent = stats.teachers.size;
  document.getElementById('busyDays').textContent = stats.busyDays;

  // Генерувати розбивку по предметах
  const subjectsBreakdown = document.getElementById('subjectsBreakdown');
  subjectsBreakdown.innerHTML = Array.from(stats.subjectTypes.entries())
    .map(([subject, types]) => `
      <div class="subject-item">
        <div class="subject-name">${subject}</div>
        <div class="subject-types">${Array.from(types).map(getTypeLabel).join(', ')}</div>
      </div>
    `).join('');
}

function calculateStatistics() {
  const subjects = new Set();
  const teachers = new Set();
  const subjectTypes = new Map();
  let totalLessons = 0;
  let busyDays = 0;

  Object.values(scheduleData.schedule).forEach(day => {
    let dayHasLessons = false;
    
    day.lessons.forEach(lesson => {
      if (lesson.type !== 'empty' && lesson.subject) {
        totalLessons++;
        dayHasLessons = true;
        subjects.add(lesson.subject);
        
        if (lesson.teacher) teachers.add(lesson.teacher);
        
        if (!subjectTypes.has(lesson.subject)) {
          subjectTypes.set(lesson.subject, new Set());
        }
        subjectTypes.get(lesson.subject).add(lesson.type);

        // Обробити підгрупи
        lesson.subgroups.forEach(sub => {
          if (sub.subject) {
            subjects.add(sub.subject);
            if (sub.teacher) teachers.add(sub.teacher);
            
            if (!subjectTypes.has(sub.subject)) {
              subjectTypes.set(sub.subject, new Set());
            }
            subjectTypes.get(sub.subject).add(sub.type);
          }
        });
      }
    });
    
    if (dayHasLessons) busyDays++;
  });

  return {
    totalLessons,
    subjects,
    teachers,
    subjectTypes,
    busyDays
  };
}

// Ініціалізація додатку
async function initApp() {
  const data = await loadScheduleData();
  if (!data) return;

  // Оновити заголовок
  document.getElementById('schedule-title').textContent = 
    `Розклад занять (${data.group}, ${data.semester})`;

// Генерувати інтерфейс
  generateNavigation();
  generateSchedule();

  // *** ПОЧАТОК ВИПРАВЛЕННЯ: Додаємо обробники подій ***
  document.getElementById('subgroupFilter').addEventListener('change', filterSchedule);
  document.getElementById('showAllWeeks').addEventListener('change', filterSchedule);
  document.getElementById('hideEmptyLessons').addEventListener('change', filterSchedule);
  // *** КІНЕЦЬ ВИПРАВЛЕННЯ ***

  // Завантажити налаштування та застосувати фільтри
  loadSettings();
  filterSchedule();
  
  // Підсвітити сьогоднішній день
  highlightToday();
  
  // Оновити текст навігації
  updateNavText();

  // Генерувати звіти
  generateReports();

  // Сховати індикатор завантаження
  document.getElementById('loading').style.display = 'none';
  document.getElementById('schedule-container').style.display = 'block';
}

// Запуск додатку
document.addEventListener('DOMContentLoaded', initApp);

// Оновлення кожну хвилину
setInterval(() => {
  highlightCurrentPair();
  updateThemeButtonTime();
}, 60000);

// Обробка зміни розміру екрану

window.addEventListener('resize', updateNavText);
