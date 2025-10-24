// Глобальні змінні
let scheduleData = null; // Тут буде зберігатися розклад (або з файлу, або з localStorage)
let themeAutoHideTimer;
const themeBtn = document.getElementById('themeBtn');
const SCHEDULE_STORAGE_KEY = 'myCustomSchedule'; // Ключ для localStorage

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

// --- Нові функції для скасованих пар ---

// Отримує сьогоднішню дату в форматі YYYY-MM-DD
function getTodayDateString() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Розраховує різницю в днях між двома датами
function daysDifference(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Завантажує список скасованих пар, АВТОМАТИЧНО очищуючи старі (старші 7 днів)
function loadCanceledLessons() {
  const cookie = getCookie('canceledLessons');
  if (!cookie) return { asSet: new Set(), asList: [] };

  let list = [];
  try {
    list = JSON.parse(cookie);
    if (!Array.isArray(list)) list = [];
  } catch (e) {
    list = [];
  }

  const today = getTodayDateString();
  // Фільтруємо: залишаємо тільки ті, що скасовані менше 7 днів тому
  const cleanedList = list.filter(item => {
    return daysDifference(item.canceledOn, today) < 7;
  });

  // Якщо список змінився (очистили старі), оновлюємо cookie
  if (cleanedList.length < list.length) {
    setCookie('canceledLessons', JSON.stringify(cleanedList));
  }

  return {
    asSet: new Set(cleanedList.map(item => item.id)), // Для швидкого пошуку
    asList: cleanedList // Для збереження
  };
}

// Перемикає стан пари (скасовано / не скасовано)
function toggleCanceledLesson(id) {
  const { asList } = loadCanceledLessons();
  const today = getTodayDateString();
  const index = asList.findIndex(item => item.id === id);

  if (index > -1) {
    // Вже є, видаляємо (повертаємо пару)
    asList.splice(index, 1);
  } else {
    // Немає, додаємо (скасовуємо пару)
    asList.push({ id: id, canceledOn: today });
  }

  setCookie('canceledLessons', JSON.stringify(asList));
}

// --- Кінець нових функцій ---

// Функції для тижнів
function getISOWeek(date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getCurrentType() {
  const showNextWeek = document.getElementById('showNextWeek').checked;
  const now = new Date();
  
  if (showNextWeek) {
    now.setDate(now.getDate() + 7);
  }

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

// === *** НОВА ФУНКЦІЯ: Завантаження JSON даних *** ===
async function loadScheduleData() {
  // 1. Намагаємося завантажити розклад з localStorage
  const customSchedule = localStorage.getItem(SCHEDULE_STORAGE_KEY);
  if (customSchedule) {
    try {
      console.log('Завантаження збереженого розкладу...');
      scheduleData = JSON.parse(customSchedule);
      return scheduleData;
    } catch (e) {
      console.error('Помилка читання збереженого розкладу:', e);
      // Якщо помилка, видаляємо зламаний розклад
      localStorage.removeItem(SCHEDULE_STORAGE_KEY);
    }
  }

  // 2. Якщо в localStorage нічого немає, завантажуємо з файлу
  try {
    console.log('Завантаження розкладу за замовчуванням...');
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
        <p style="font-size: 0.8em; color: #666;">(Можлива помилка в schedule.json)</p>
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
          ${day.lessons.map(lesson => generateLessonCard(lesson, dayKey)).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function generateLessonCard(lesson, dayKey) {
  const hasSubgroups = lesson.subgroups && lesson.subgroups.length > 0;
  const isEmpty = (lesson.type === 'empty' || !lesson.subject) && !hasSubgroups;

  let cardClass = isEmpty ? 'card empty' : `card ${lesson.type}`;
  
  if (!hasSubgroups && lesson.weeks) {
      if (lesson.weeks === 'num' || lesson.weeks === 'den') {
          cardClass += ` numden ${lesson.weeks}`;
      }
  }
  
  const lessonId = `lesson-${dayKey}-${lesson.number}`; 
  
  if (isEmpty) {
    return `
      <article class="${cardClass}" id="${lessonId}">
        <h3>${lesson.number} пара</h3>
        <p class="empty-message">Немає</p>
      </article>
    `;
  }

  let subgroupsHtml = '';
  let mainContent = ''; 

  if (hasSubgroups) {
    subgroupsHtml = lesson.subgroups.map(sub => {
      const subClass = getSubgroupClass(sub);
      const subLabel = getSubgroupLabel(sub); 
      
      let weekLabel = '';
      if (sub.weeks === 'num') {
        weekLabel = '<span class="week-label num-label"> (Чисельник)</span>';
      } else if (sub.weeks === 'den') {
        weekLabel = '<span class="week-label den-label"> (Знаменник)</span>';
      }

      return `
        <div class="subgroup ${subClass}">
          <p class="subgroup-label ${sub.group === 'sub2' ? 'sub2' : 'sub1'}">${subLabel}${weekLabel}</p>
          <p><b>${sub.subject}</b> (${getTypeLabel(sub.type)})</p>
          <p class="teacher-room">${sub.teacher}${sub.room ? ', ' + sub.room : ''}</p>
        </div>
      `;
    }).join('');
  } else if (lesson.subject) {
    mainContent = `
      <p data-main-content="true"><b>${lesson.subject}</b> (${getTypeLabel(lesson.type)})</p>
      <p class="teacher-room">${lesson.teacher}${lesson.room ? ', ' + lesson.room : ''}</p>
    `;
  }

  return `
    <article class="${cardClass}" id="${lessonId}">
      <h3>
        ${lesson.number} пара
        <button class="cancel-btn" title="Скасувати/повернути пару" data-lesson-id="${lessonId}">❌</button>
      </h3>
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
  if (sub.group === 'sub1') return 'Підгрупа 1';
  if (sub.group === 'sub2') return 'Підгрупа 2';
  return ''; // 'all' або не вказано
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
  const canceledLessonIds = loadCanceledLessons().asSet; 
  const currentType = getCurrentType();
  const cards = document.querySelectorAll('.card');

  cards.forEach(card => {
    let emptyMsg = card.querySelector('.empty-message');
    const timeEl = card.querySelector('.time');
    const mainContentEl = card.querySelector('p[data-main-content]');
    const teacherRoomEl = card.querySelector('.teacher-room');
    const subgroups = card.querySelectorAll('.subgroup');

    // --- 1. ОБРОБКА СКАСОВАНИХ ПАР ---
    const isCanceled = canceledLessonIds.has(card.id);
    card.classList.toggle('canceled', isCanceled);

    if (isCanceled) {
      if (!emptyMsg) {
        emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-message';
        card.querySelector('h3').insertAdjacentElement('afterend', emptyMsg);
      }
      emptyMsg.textContent = 'Скасовано';
      emptyMsg.style.display = 'block';
      
      if (timeEl) timeEl.style.display = 'none';
      if (mainContentEl) mainContentEl.style.display = 'none';
      if (teacherRoomEl) teacherRoomEl.style.display = 'none';
      subgroups.forEach(sub => sub.style.display = 'none');
      
      card.style.display = 'block';
      card.classList.remove('empty');
      return; 
    }

    // --- 2. ЯКЩО НЕ СКАСОВАНА - СКИДАЄМО СТАН ---
    if (emptyMsg) {
      if (emptyMsg.textContent === 'Скасовано') {
        emptyMsg.remove(); 
        emptyMsg = null; 
      } else if (emptyMsg.textContent === 'Немає') {
        emptyMsg.style.display = 'none'; 
      }
    }
    if (timeEl) timeEl.style.display = 'block';
    if (mainContentEl) mainContentEl.style.display = 'block';
    if (teacherRoomEl) teacherRoomEl.style.display = 'block';
    
    // --- 3. ЛОГІКА ФІЛЬТРАЦІЇ ---
    let hasVisibleContent = false;

    if (mainContentEl) {
      let mainVisible = true;
      if (!showAll) {
        const weekType = card.classList.contains('num') ? 'num' : 
                         (card.classList.contains('den') ? 'den' : 'all');
        if (weekType !== 'all' && weekType !== currentType) {
          mainVisible = false;
        }
      }
      
      if (mainVisible) {
        hasVisibleContent = true;
      } else {
        mainContentEl.style.display = 'none';
        if (teacherRoomEl) teacherRoomEl.style.display = 'none';
      }
    }

    if (subgroups.length > 0) {
      subgroups.forEach(sub => {
        let visible = true;
        const subType = sub.classList.contains('sub1') ? 'sub1' : 
                        (sub.classList.contains('sub2') ? 'sub2' : 'all');
                        
        if (subgroup !== 'all') { 
          if (subType !== 'all' && subType !== subgroup) {
            visible = false; 
          }
        }
        if (!showAll) {
          const weekType = sub.classList.contains('num') ? 'num' : 
                           (sub.classList.contains('den') ? 'den' : 'all');
          if (weekType !== 'all' && weekType !== currentType) visible = false;
        }

        sub.style.display = visible ? 'block' : 'none';
        if (visible) hasVisibleContent = true;
      });
    }
    
    if (card.classList.contains('empty')) {
        hasVisibleContent = false;
    }

    // --- 4. ФІНАЛЬНИЙ СТАН (КОНТЕНТ / ПОРОЖНЬО) ---
    if (hasVisibleContent) {
      card.classList.remove('empty');
      card.style.display = 'block';
      if (timeEl) timeEl.style.display = 'block';
      if (emptyMsg) emptyMsg.style.display = 'none'; 
    } else {
      card.classList.add('empty');
      if (timeEl) timeEl.style.display = 'none';
      
      if (!emptyMsg) {
        emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-message';
        card.querySelector('h3').insertAdjacentElement('afterend', emptyMsg);
      }
      emptyMsg.textContent = 'Немає';
      emptyMsg.style.display = 'block';

      if (hideEmpty) {
        card.style.display = 'none';
      } else {
        card.style.display = 'block';
      }
    }
  });

  // --- 5. ОНОВЛЕННЯ ІНТЕРФЕЙСУ ---
  const labels = document.querySelectorAll('.num-label, .den-label');
  labels.forEach(label => {
    label.style.display = showAll ? '' : 'none';
  });
  
  const nextWeekCheckbox = document.getElementById('showNextWeek');
  const nextWeekLabel = document.getElementById('nextWeekLabel');
  if (showAll) {
    nextWeekCheckbox.checked = false;
    nextWeekCheckbox.disabled = true;
    nextWeekLabel.style.opacity = '0.5';
    nextWeekLabel.style.cursor = 'not-allowed';
  } else {
    nextWeekCheckbox.disabled = false;
    nextWeekLabel.style.opacity = '1';
    nextWeekLabel.style.cursor = 'pointer';
  }

  updateWeekInfo();
  highlightCurrentPair();
  saveSettings();
  generateReports(); 
}


// Оновлення інформації про тиждень
function updateWeekInfo() {
  const showAll = document.getElementById('showAllWeeks').checked;
  const showNextWeek = document.getElementById('showNextWeek').checked;
  const infoSpan = document.getElementById('currentWeekInfo');
  
  if (showAll) {
    infoSpan.innerHTML = '';
  } else {
    const date = new Date();
    if (showNextWeek) {
      date.setDate(date.getDate() + 7);
      infoSpan.style.color = '#9c27b0'; 
    } else {
      infoSpan.style.color = ''; 
    }
    
    const type = getCurrentType(); 
    const dates = getWeekDates(date);
    const typeName = type === 'num' ? 'Чисельник' : 'Знаменник';
    const prefix = showNextWeek ? 'Наст. тиждень: ' : '';
    
    infoSpan.innerHTML = `${prefix}${typeName} (${dates.start.toLocaleDateString('uk-UA')} – ${dates.end.toLocaleDateString('uk-UA')})`;
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
    if (card.style.display === 'none' || card.classList.contains('canceled')) return;

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
  const cards = todaySection.querySelectorAll('.card:not(.empty):not(.canceled)');
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
  const showNextWeek = getCookie('showNextWeek'); 
  if (showNextWeek === 'true') { 
    document.getElementById('showNextWeek').checked = true; 
  }
}

// Збереження налаштувань
function saveSettings() {
  const subgroup = document.getElementById('subgroupFilter').value;
  const showAll = document.getElementById('showAllWeeks').checked;
  const hideEmpty = document.getElementById('hideEmptyLessons').checked;
  const showNextWeek = document.getElementById('showNextWeek').checked; 
  setCookie('subgroupFilter', subgroup);
  setCookie('showAllWeeks', showAll ? 'true' : 'false');
  setCookie('hideEmptyLessons', hideEmpty ? 'true' : 'false');
  setCookie('showNextWeek', showNextWeek ? 'true' : 'false'); 
}

// Обробник кліку на кнопках скасування
function handleCancelClick(e) {
  if (e.target.classList.contains('cancel-btn')) {
    const id = e.target.dataset.lessonId;
    toggleCanceledLesson(id);
    filterSchedule(); 
    vibrate(); 
  }
}

// Генерація звітів та статистики
function generateReports() {
  if (!scheduleData) return;

  const stats = calculateStatistics();
  
  const totalLessonsEl = document.getElementById('totalLessons');
  if (totalLessonsEl) {
    totalLessonsEl.textContent = stats.totalLessons;
  }

  const subjectsBreakdown = document.getElementById('subjectsBreakdown');
  if (subjectsBreakdown) {
      subjectsBreakdown.innerHTML = Array.from(stats.subjectTypes.entries())
        .map(([subject, types]) => `
          <div class="subject-item">
            <div class="subject-name">${subject}</div>
            <div class="subject-types">${Array.from(types).map(getTypeLabel).join(', ')}</div>
          </div>
        `).join('');
  }
}

// Оновлена функція статистики
function calculateStatistics() {
  const subjects = new Set();
  const teachers = new Set();
  const subjectTypes = new Map();
  let totalLessons = 0;
  let busyDays = 0;

  Object.values(scheduleData.schedule).forEach(day => {
    let dayHasLessons = false;
    
    day.lessons.forEach(lesson => {
      const hasSubgroups = lesson.subgroups && lesson.subgroups.length > 0;
      const isEmpty = (lesson.type === 'empty' || !lesson.subject) && !hasSubgroups;

      if (isEmpty) {
        return; 
      }
      
      let lessonCounted = false;

      // Обробка головної пари (якщо вона є і НЕ має підгруп)
      if (lesson.subject && !hasSubgroups) {
        dayHasLessons = true;
        totalLessons++; 
        lessonCounted = true;
        
        subjects.add(lesson.subject);
        if (lesson.teacher) teachers.add(lesson.teacher);
        
        if (!subjectTypes.has(lesson.subject)) {
          subjectTypes.set(lesson.subject, new Set());
        }
        subjectTypes.get(lesson.subject).add(lesson.type);
      }

      // Обробити підгрупи
      if (hasSubgroups) {
        lesson.subgroups.forEach(sub => {
          if (sub.subject) {
            dayHasLessons = true; 
            subjects.add(sub.subject);
            if (sub.teacher) teachers.add(sub.teacher);
            
            if (!subjectTypes.has(sub.subject)) {
              subjectTypes.set(sub.subject, new Set());
            }
            subjectTypes.get(sub.subject).add(sub.type);
            
            if (!lessonCounted) {
                totalLessons++;
                lessonCounted = true; 
            }
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

// === *** НОВІ ФУНКЦІЇ ДЛЯ МОДАЛЬНОГО ВІКНА *** ===
function initModal() {
  const modal = document.getElementById('settingsModal');
  const btn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('modalClose');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const exportBtn = document.getElementById('exportBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const statusEl = document.getElementById('importStatus');

  // Відкрити модальне вікно
  btn.onclick = () => {
    modal.style.display = 'block';
    statusEl.textContent = '';
  }
  // Закрити модальне вікно
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  }
  // Закрити при кліку поза вікном
  window.onclick = (event) => {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  }

  // 1. Імпорт
  importBtn.onclick = () => {
    importFile.click(); // Відкрити діалог вибору файлу
  }
  
  importFile.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        JSON.parse(text); // Перевірка, чи це валідний JSON
        localStorage.setItem(SCHEDULE_STORAGE_KEY, text); // Зберегти в localStorage
        statusEl.textContent = '✅ Розклад успішно імпортовано! Сторінка оновиться.';
        statusEl.style.color = '#28a745';
        setTimeout(() => location.reload(), 1500); // Оновити сторінку
      } catch (err) {
        console.error('Помилка імпорту:', err);
        statusEl.textContent = '❌ Помилка! Файл пошкоджений або це не .json.';
        statusEl.style.color = '#d32f2f';
      }
    };
    reader.readAsText(file);
    // Скинути value, щоб можна було завантажити той самий файл знову
    event.target.value = null; 
  };

  // 2. Експорт
  exportBtn.onclick = () => {
    // Ми експортуємо поточні завантажені дані (`scheduleData`)
    const dataStr = JSON.stringify(scheduleData, null, 2); // 'null, 2' для гарного форматування
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    statusEl.textContent = '✅ Шаблон експортовано.';
    statusEl.style.color = '#1e88e5';
  };

  // 3. Видалення
  deleteBtn.onclick = () => {
    if (confirm('Ви впевнені, що хочете видалити свій розклад і повернутися до версії за замовчуванням?')) {
      localStorage.removeItem(SCHEDULE_STORAGE_KEY);
      statusEl.textContent = '✅ Ваш розклад видалено. Сторінка оновиться.';
      statusEl.style.color = '#d32f2f';
      setTimeout(() => location.reload(), 1500);
    }
  };
}
// === *** КІНЕЦЬ НОВИХ ФУНКЦІЙ *** ===


// Ініціалізація додатку
async function initApp() {
  const data = await loadScheduleData(); // Тепер завантажує з localStorage або файлу
  if (!data) return;

  // Оновити заголовок (ВИДАЛЕНО рядок, що додає групу)
  document.getElementById('schedule-title').textContent = `Розклад занять`;

  // Генерувати інтерфейс
  generateNavigation();
  generateSchedule(); 

  // *** Додаємо обробники подій ***
  document.getElementById('subgroupFilter').addEventListener('change', filterSchedule);
  document.getElementById('showAllWeeks').addEventListener('change', filterSchedule);
  document.getElementById('hideEmptyLessons').addEventListener('change', filterSchedule);
  document.getElementById('showNextWeek').addEventListener('change', filterSchedule); 
  document.getElementById('schedule-container').addEventListener('click', handleCancelClick); 
  
  // *** Ініціалізуємо модальне вікно ***
  initModal();

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
