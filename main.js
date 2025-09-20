// Кнопка теми: розширювана паличка/круг
const themeBtn = document.getElementById('themeBtn');
let themeAutoHideTimer;

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
  const startSemester = new Date('2025-09-08');
  const weekStart = getISOWeek(startSemester); // наприклад, 37
  const currentWeek = getISOWeek(now);

  // Рахуємо різницю від початку семестру
  const weeksSinceStart = currentWeek - weekStart + 1;

  // Якщо непарний — Чисельник, якщо парний — Знаменник
  const isNumerator = weeksSinceStart % 2 !== 0;
  return isNumerator ? 'num' : 'den';
}


function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  monday.setFullYear(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  return { start: monday, end: friday };
}

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

// Темна тема (використовується при кліку по розширеній кнопці)
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  setCookie('darkMode', isDark ? 'true' : 'false');
}

// Зібрати проміжки часу пар на сьогодні з DOM (видимі картки)
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
  // Відсортувати за часом початку
  intervals.sort((a, b) => a.start - b.start);
  return intervals;
}

// Оновити стан розширеної кнопки: колір і текст
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

// Вібрація (для мобільних)
function vibrate() {
  if (navigator.vibrate) navigator.vibrate(50);
}

// Обробник кліку по кнопці теми
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
      // Після зміни освітлення тримати кнопку ще 2 секунди
      clearTimeout(themeAutoHideTimer);
      themeAutoHideTimer = setTimeout(() => {
        themeBtn.classList.remove('expanded', 'green', 'yellow', 'purple');
        themeBtn.textContent = '';
        vibrate();
      }, 2000);
    }
  });
}

// Завантажити налаштування з cookies
function loadSettings() {
  // Темна тема
  const darkMode = getCookie('darkMode');
  if (darkMode === 'true') {
    document.body.classList.add('dark-mode');
    document.querySelector('.theme-toggle').textContent = '☀️';
  }

  // Підгрупа
  const subgroup = getCookie('subgroupFilter');
  if (subgroup) {
    document.getElementById('subgroupFilter').value = subgroup;
  }

  // Показати всі тижні
  const showAll = getCookie('showAllWeeks');
  if (showAll === 'true') {
    document.getElementById('showAllWeeks').checked = true;
  }

  // Приховати порожні пари
  const hideEmpty = getCookie('hideEmptyLessons');
  if (hideEmpty === 'true') {
    document.getElementById('hideEmptyLessons').checked = true;
  }
}

// Зберегти налаштування
function saveSettings() {
  const subgroup = document.getElementById('subgroupFilter').value;
  const showAll = document.getElementById('showAllWeeks').checked;
  const hideEmpty = document.getElementById('hideEmptyLessons').checked;
  setCookie('subgroupFilter', subgroup);
  setCookie('showAllWeeks', showAll ? 'true' : 'false');
  setCookie('hideEmptyLessons', hideEmpty ? 'true' : 'false');
}

// Поточний день
function highlightToday() {
  const days = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота'];
  const today = new Date().getDay();
  const todayName = days[today];
  const daySections = document.querySelectorAll('.day');
  daySections.forEach(section => {
    const h2 = section.querySelector('h2');
    if (h2 && h2.textContent === todayName) {
      section.classList.add('today');
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Підсвітити активний день у верхньому меню
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    link.classList.remove('active-day');
    if (link.dataset && link.dataset.full === todayName) {
      link.classList.add('active-day');
    }
  });
}
highlightToday();

// Фільтрація
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
        const emptyMsg = card.querySelector('.empty-message');
        if (emptyMsg) emptyMsg.style.display = isEmpty ? 'block' : 'none';
        const timeEl = card.querySelector('.time');
        if (timeEl) timeEl.style.display = isEmpty ? 'none' : 'block';
      }
    } else {
      // Сховати всі subgroups спочатку
      subgroups.forEach(sub => sub.style.display = 'none');

      subgroups.forEach(sub => {
        let visible = true;

        // Фільтр підгрупи
        if (subgroup !== 'all') {
          const subType = sub.classList.contains('sub1') ? 'sub1' : (sub.classList.contains('sub2') ? 'sub2' : null);
          if (subType !== null && subType !== subgroup) visible = false;
        }

        // Фільтр тижня
        if (!showAll) {
          const weekType = sub.classList.contains('num') ? 'num' : (sub.classList.contains('den') ? 'den' : null);
          if (weekType && weekType !== currentType) visible = false;
        }

        sub.style.display = visible ? 'block' : 'none';
        if (visible) hasVisibleContent = true;
      });

      const emptyMsg = card.querySelector('.empty-message');
      const timeEl = card.querySelector('.time');

      if (hasVisibleContent) {
        if (emptyMsg) emptyMsg.style.display = 'none';
        if (timeEl) timeEl.style.display = 'block';
        card.classList.remove('empty');
        card.style.display = 'block';
      } else {
        subgroups.forEach(sub => sub.style.display = 'none');
        if (timeEl) timeEl.style.display = 'none';
        if (emptyMsg) emptyMsg.style.display = 'block';
        else {
          const newEmpty = document.createElement('p');
          newEmpty.className = 'empty-message';
          newEmpty.textContent = 'Немає';
          newEmpty.style.display = 'block';
          card.appendChild(newEmpty);
        }
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
  highlightCurrentPair(); // Оновити виділення після фільтрації
  saveSettings(); // Зберегти налаштування
}

// Виділення поточної/наступної пари
function highlightCurrentPair() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;

  // Знайти сьогоднішній день
  const todaySection = document.querySelector('.day.today');
  if (!todaySection) return;

  const cards = todaySection.querySelectorAll('.card:not(.empty)');
  let currentCard = null;
  let upcomingCard = null;
  let minDiffToStart = Infinity;

  cards.forEach(card => {
    // Перевіряємо, чи картка видима
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

    // Якщо зараз в проміжку пари
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      card.classList.add('current');
      card.classList.remove('upcoming');
      currentCard = card;
      return; // Тільки одна поточна
    }

    // Перевірити на наступну пару (якщо після цієї пари)
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

  // Встановити поточну
  if (currentCard) {
    currentCard.classList.add('current');
  }

  // Встановити наступну, якщо < 15 хв
  if (upcomingCard && minDiffToStart <= 15) {
    upcomingCard.classList.add('upcoming');
  }
}

// Ініціалізація
loadSettings(); // Завантажити налаштування
filterSchedule();
updateWeekInfo();
highlightCurrentPair(); // Початкове виділення
updateNavText(); // Оновити текст навігації

// Оновлювати кожну хвилину
setInterval(() => {
  highlightCurrentPair();
  updateThemeButtonTime();
}, 60000);

// Обробка зміни розміру екрану для навігації
window.addEventListener('resize', updateNavText);


