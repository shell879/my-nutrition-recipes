const $ = (id) => document.getElementById(id);
let slides = [];
let index = 0;
let timer = null;
let paused = false;
let publicStores = [];
let secondsPerSlide = 2;
const cardAnimations = ['flip-top', 'flip-bottom', 'flip-right', 'flip-left', 'card-fade', 'card-enter'];

function renderSlide() {
  const slide = slides[index];
  $('flavor').textContent = slide.flavor;
  document.body.dataset.theme = String(index % 4);
  $('names').replaceChildren();
  slide.entries.forEach((entry, cardIndex) => {
    const card = document.createElement('article');
    card.className = 'drink-card';
    card.style.setProperty('--card-delay', `${cardIndex * 160 * Math.min(secondsPerSlide / 2, 1)}ms`);
    card.style.setProperty('--animation-scale', Math.min(secondsPerSlide / 2, 1));
    card.style.setProperty('--card-animation', cardAnimations[(index + cardIndex) % cardAnimations.length]);
    const category = document.createElement('p');
    category.className = 'drink-category';
    category.textContent = entry.category;
    const name = document.createElement('h3');
    name.textContent = entry.name;
    card.appendChild(category);
    card.appendChild(name);
    $('names').appendChild(card);
  });
  $('position').textContent = `Slide ${index + 1} of ${slides.length}`;
  $('previous').disabled = slides.length <= 1;
  $('next').disabled = slides.length <= 1;
  $('pause').disabled = slides.length <= 1;
}

function stopTimer() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function startTimer() {
  stopTimer();
  if (!paused && slides.length > 1) {
    timer = window.setInterval(() => changeSlide(1), secondsPerSlide * 1000);
  }
}

function changeSlide(direction) {
  index = (index + direction + slides.length) % slides.length;
  renderSlide();
}

function stop() {
  stopTimer();
  slides = [];
  $('controls').hidden = true;
  $('stop').disabled = true;
  $('flavor').textContent = '';
  $('names').replaceChildren();
  if (!$('storePicker').hidden) $('storeSelect').value = '';
  $('status').textContent = $('storePicker').hidden
    ? 'Slideshow stopped. You can close this tab or return to MyNutrition.'
    : 'Slideshow stopped. Select a store to start again.';
}

function startSlideshow(data) {
  if (!data || typeof data.storeName !== 'string' || !Array.isArray(data.slides) ||
      data.slides.some((slide) => !slide || typeof slide.flavor !== 'string' || !Array.isArray(slide.entries) ||
        !slide.entries.length || slide.entries.some((entry) => !entry || typeof entry.category !== 'string' || typeof entry.name !== 'string'))) {
    throw new Error('The slideshow data is invalid.');
  }
  stopTimer();
  slides = data.slides;
  index = 0;
  paused = false;
  $('pause').textContent = 'Pause';
  $('slideshowTitle').textContent = `${data.storeName} - Recipe slideshow`;
  $('flavor').textContent = '';
  $('names').replaceChildren();
  $('controls').hidden = !slides.length;
  $('stop').disabled = !slides.length;
  $('status').textContent = slides.length ? '' : 'This store has no drinks to display.';
  if (slides.length) {
    renderSlide();
    startTimer();
  }
}

async function loadPublicStores() {
  $('storePicker').hidden = false;
  $('stop').disabled = true;
  $('status').textContent = 'Loading stores...';
  const apiBase = location.hostname === '127.0.0.1' || location.hostname === 'localhost'
    ? 'http://127.0.0.1:8787' : '';
  const response = await fetch(`${apiBase}/api/christmas/public-slideshow`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load stores (HTTP ${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data.stores)) throw new Error('The public store list is invalid.');
  publicStores = data.stores;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = publicStores.length ? 'Select a store' : 'No stores available';
  $('storeSelect').replaceChildren(placeholder);
  publicStores.forEach((store, storeIndex) => {
    if (!store || typeof store.storeName !== 'string' || !Array.isArray(store.slides)) throw new Error('The public store list is invalid.');
    const option = document.createElement('option');
    option.value = String(storeIndex);
    option.textContent = store.storeName;
    $('storeSelect').appendChild(option);
  });
  $('storeSelect').disabled = !publicStores.length;
  $('status').textContent = publicStores.length ? 'Select a store to start the slideshow.' : 'No stores are available.';
}

$('storeSelect').addEventListener('change', () => {
  if ($('storeSelect').value === '') {
    stop();
    return;
  }
  try {
    startSlideshow(publicStores[Number($('storeSelect').value)]);
  } catch (error) {
    console.error('Could not start slideshow:', error);
    stop();
    $('status').textContent = `Could not start slideshow: ${error.message}`;
  }
});
$('stop').addEventListener('click', stop);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && slides.length) stop();
});
$('previous').addEventListener('click', () => { changeSlide(-1); startTimer(); });
$('next').addEventListener('click', () => { changeSlide(1); startTimer(); });
$('slower').addEventListener('click', () => changeSpeed(1));
$('faster').addEventListener('click', () => changeSpeed(-1));
$('pause').addEventListener('click', () => {
  paused = !paused;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  startTimer();
});

function changeSpeed(direction) {
  secondsPerSlide = Math.max(1, Math.min(8, secondsPerSlide + direction));
  $('speed').textContent = `${secondsPerSlide} ${secondsPerSlide === 1 ? 'second' : 'seconds'} per slide`;
  $('faster').disabled = secondsPerSlide === 1;
  $('slower').disabled = secondsPerSlide === 8;
  startTimer();
}

async function initialize() {
  try {
    const isDemo = new URLSearchParams(location.search).get('demo') === '1';
    const raw = sessionStorage.getItem('mynutrition-slideshow');
    sessionStorage.removeItem('mynutrition-slideshow');
    if (raw) {
      $('backLink').href = isDemo ? '/demo/' : '/mynutrition/';
      $('backLink').textContent = isDemo ? 'Back to demo' : 'Back to MyNutrition';
      startSlideshow(JSON.parse(raw));
    } else if (isDemo) {
      $('backLink').href = '/demo/';
      $('backLink').textContent = 'Back to demo';
      throw new Error('Open the slideshow from the demo catalog to display its recipes.');
    } else {
      await loadPublicStores();
    }
  } catch (error) {
    console.error('Could not start slideshow:', error);
    $('status').textContent = error.message;
    $('stop').disabled = true;
  }
}
initialize();
