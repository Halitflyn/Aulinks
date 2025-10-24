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
  
  // Якщо "Наступний тиждень" увімкнено, беремо дату +7 днів
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
  // Пара вважається порожньою, ТІЛЬКИ ЯКЩО в ній немає ані головного предмету, ані підгруп.
  const hasSubgroups = lesson.subgroups && lesson.subgroups.length > 0;
  const isEmpty = (lesson.type === 'empty' || !lesson.subject) && !hasSubgroups;

  let cardClass = isEmpty ? 'card empty' : `card ${lesson.type}`;
  
  // Додаємо клас тижня, якщо пара *не* ділиться на підгрупи
  if (!hasSubgroups && lesson.weeks) {
      if (lesson.weeks === 'num' || lesson.weeks === 'den') {
          cardClass += ` numden ${lesson.weeks}`;
      }
  }
  
  const lessonId = `lesson-${dayKey}-${lesson.number}`; // Унікальний ID
  
  if (isEmpty) {
    return `
      <article class="${cardClass}" id="${lessonId}">
        <h3>${lesson.number} пара</h3>
        <p class="empty-message">Немає</p>
      </article>
    `;
  }

  // === *** ПОЧАТОК ВИПРАВЛЕННЯ 1 (Дублювання) *** ===
  let subgroupsHtml = '';
  let mainContent = ''; // Ініціалізуємо як порожні

  if (hasSubgroups) {
    // --- 1. Є ПІДГРУПИ: Рендеримо тільки їх ---
    subgroupsHtml = lesson.subgroups.map(sub => {
      const subClass = getSubgroupClass(sub);
      const subLabel = getSubgroupLabel(sub); // Нова функція (Fix 2)
      
      // === *** ПОЧАТОК ВИПРАВЛЕННЯ 2 (Кольори) *** ===
      let weekLabel = '';
      if (sub.weeks === 'num') {
        weekLabel = '<span class="week-label num-label"> (Чисельник)</span>';
      } else if (sub.weeks === 'den') {
        weekLabel = '<span class="week-label den-label"> (Знаменник)</span>';
      }
      // === *** КІНЕЦЬ ВИПРАВЛЕННЯ 2 *** ===

      return `
        <div class="subgroup ${subClass}">
          <p class="subgroup-label ${sub.group === 'sub2' ? 'sub2' : 'sub1'}">${subLabel}${weekLabel}</p>
          <p><b>${sub.subject}</b> (${getTypeLabel(sub.type)})</p>
          <p class="teacher-room">${sub.teacher}${sub.room ? ', ' + sub.room : ''}</p>
        </div>
      `;
    }).join('');
  } else if (lesson.subject) {
    // --- 2. НЕМАЄ ПІДГРУП, АЛЕ Є ГОЛОВНИЙ ПРЕДМЕТ: Рендеримо його ---
    mainContent = `
      <p data-main-content="true"><b>${lesson.subject}</b> (${getTypeLabel(lesson.type)})</p>
      <p class="teacher-room">${lesson.teacher}${lesson.room ? ', ' + lesson.room : ''}</p>
    `;
  }
  // === *** КІНЕЦЬ ВИПРАВЛЕННЯ 1 *** ===

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

// === *** ПОЧАТОК ВИПРАВЛЕННЯ 2 (Кольори) *** ===
// Тепер повертає ТІЛЬКИ назву підгрупи
function getSubgroupLabel(sub) {
  if (sub.group === 'sub1') return 'Підгрупа 1';
  if (sub.group === 'sub2') return 'Підгрупа 2';
  return ''; // 'all' або не вказано
}
// === *** КІНЕЦЬ ВИПРАВЛЕННЯ 2 *** ===

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
      
      // Ховаємо все інше
      if (timeEl) timeEl.style.display = 'none';
      if (mainContentEl) mainContentEl.style.display = 'none';
      if (teacherRoomEl) teacherRoomEl.style.display = 'none';
      subgroups.forEach(sub => sub.style.display = 'none');
      
      card.style.display = 'block';
      card.classList.remove('empty');
      return; // Закінчуємо обробку цієї картки
    }

    // --- 2. ЯКЩО НЕ СКАСОВАНА - СКИДАЄМО СТАН ---
    if (emptyMsg) {
      if (emptyMsg.textContent === 'Скасовано') {
        emptyMsg.remove(); // Видаляємо "Скасовано"
        emptyMsg = null; // Скидаємо, щоб логіка нижче могла створити "Немає"
      } else if (emptyMsg.textContent === 'Немає') {
        emptyMsg.style.display = 'none'; // Ховаємо "Немає"
      }
    }
    // Показуємо елементи за замовчуванням (якщо вони існують)
    if (timeEl) timeEl.style.display = 'block';
    if (mainContentEl) mainContentEl.style.display = 'block';
    if (teacherRoomEl) teacherRoomEl.style.display = 'block';
    
    // --- 3. ЛОГІКА ФІЛЬТРАЦІЇ ---
    let hasVisibleContent = false;

    // Перевірка головного контенту (якщо він є)
    if (mainContentEl) {
      let mainVisible = true;
      // Фільтр тижня для головної пари
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

    // Перевірка підгруп (якщо вони є)
    if (subgroups.length > 0) {
      subgroups.forEach(sub => {
        let visible = true;

        // Фільтр підгрупи
        const subType = sub.classList.contains('sub1') ? 'sub1' : 
                        (sub.classList.contains('sub2') ? 'sub2' : 'all');
                        
        if (subgroup !== 'all') { // Якщо фільтр активний
          if (subType !== 'all' && subType !== subgroup) {
            visible = false; // Приховати, якщо це інша підгрупа (sub2, а фільтр sub1)
          }
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
    }
    
    // Якщо це *була* порожня картка (з `class="empty"`), в ній немає контенту
    if (card.classList.contains('empty')) {
        hasVisibleContent = false;
    }

    // --- 4. ФІНАЛЬНИЙ СТАН (КОНТЕНТ / ПОРОЖНЬО) ---
    if (hasVisibleContent) {
      card.classList.remove('empty');
      card.style.display = 'block';
      if (timeEl) timeEl.style.display = 'block';
      if (emptyMsg) emptyMsg.style.display = 'none'; // Ховаємо "Немає"
    } else {
      // Стала порожньою
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
  // Приховувати лейбли чисельник/знаменник при автоматичному режимі
  const labels = document.querySelectorAll('.num-label, .den-label');
  labels.forEach(label => {
    label.style.display = showAll ? '' : 'none';
  });
  
  // Блокуємо "Наст. тиждень", якщо увімкнено "Показати всі тижні"
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
  generateReports(); // Оновити звіти після фільтрації
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
      infoSpan.style.color = '#9c27b0'; // Фіолетовий для "наступного"
    } else {
      infoSpan.style.color = ''; // Стандартний колір (успадкується)
    }
    
    const type = getCurrentType(); // Вже враховує showNextWeek
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
      
      // === *** ПОЧАТОК ВИПРАВЛЕННЯ 3 (Скрол) *** ===
      // Повертаємо авто-скрол при завантаженні
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // === *** КІНЕЦЬ ВИПРАВЛЕННЯ 3 *** ===
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
  // Перевіряємо, чи клікнули ми саме на кнопку "x"
  if (e.target.classList.contains('cancel-btn')) {
    const id = e.target.dataset.lessonId;
    toggleCanceledLesson(id);
    filterSchedule(); // Оновити вигляд одразу
    vibrate(); // Приємний фідбек
  }
}

// Генерація звітів та статистики
function generateReports() {
  if (!scheduleData) return;

  const stats = calculateStatistics();
  
  // Оновити статистичні картки
  const totalLessonsEl = document.getElementById('totalLessons');
  if (totalLessonsEl) {
    totalLessonsEl.textContent = stats.totalLessons;
  }

  // Генерувати розбивку по предметах
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
      // Використовуємо ту саму логіку, що й у generateLessonCard
      const isEmpty = (lesson.type === 'empty' || !lesson.subject) && !hasSubgroups;

      if (isEmpty) {
        return; // Справді порожня пара, пропускаємо
      }
      
      let lessonCounted = false;

      // Обробка головної пари (якщо вона є і НЕ має підгруп)
      if (lesson.subject && !hasSubgroups) {
        dayHasLessons = true;
        totalLessons++; // Рахуємо як 1 пару
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
            
            // Якщо це пара з підгрупами, рахуємо її як ОДНУ пару
            if (!lessonCounted) {
                totalLessons++;
                lessonCounted = true; // Рахуємо "змішану" пару лише один раз
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
  document.getElementById('showNextWeek').addEventListener('change', filterSchedule); // НОВИЙ
  // Додаємо один обробник на весь контейнер для кнопок "x" (делегування подій)
  document.getElementById('schedule-container').addEventListener('click', handleCancelClick); // НОВИЙ
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
