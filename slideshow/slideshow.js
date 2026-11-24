const $ = (id) => document.getElementById(id);
let slides = [];
let index = 0;
let timer = null;
let paused = false;
let stopped = false;
let publicStores = [];
let secondsPerSlide = 7;

function renderSlide() {
  const slide = slides[index];
  $('flavor').textContent = slide.flavor;
  $('names').replaceChildren();
  slide.entries.forEach((entry) => {
    const drink = document.createElement('article');
    drink.className = 'drink';
    const text = document.createElement('div');
    text.className = 'drink-text';
    const category = document.createElement('p');
    category.textContent = entry.category;
    const name = document.createElement('h3');
    name.textContent = entry.name;
    text.append(category, name);
    drink.appendChild(text);
    $('names').appendChild(drink);
  });
}

function stopTimer() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function startTimer() {
  stopTimer();
  if (!paused && !stopped && slides.length > 1) {
    timer = window.setInterval(() => {
      index = (index + 1) % slides.length;
      renderSlide();
    }, secondsPerSlide * 1000);
  }
}

function stop() {
  stopTimer();
  stopped = true;
  paused = false;
  $('slideshow').classList.remove('is-paused');
  $('pause').textContent = 'Pause';
  $('pause').disabled = true;
  $('stop').textContent = 'Start';
  $('flavor').textContent = '';
  $('names').replaceChildren();
  $('status').textContent = 'Slideshow stopped. Select Start to play again.';
}

function startSlideshow(data) {
  if (!data || typeof data.storeName !== 'string' || !Array.isArray(data.slides) ||
      data.slides.some((slide) => !slide || typeof slide.flavor !== 'string' || !Array.isArray(slide.entries) ||
        !slide.entries.length || slide.entries.some((entry) => !entry || typeof entry.category !== 'string' || typeof entry.name !== 'string'))) {
    throw new Error('The slideshow data is invalid.');
  }
  stopTimer();
  slides = data.slides.flatMap((slide) => {
    const pages = [];
    for (let offset = 0; offset < slide.entries.length; offset += 4) {
      pages.push({ flavor: slide.flavor, entries: slide.entries.slice(offset, offset + 4) });
    }
    return pages;
  });
  index = 0;
  paused = false;
  stopped = false;
  $('slideshow').classList.remove('is-paused');
  $('pause').textContent = 'Pause';
  $('pause').disabled = !slides.length;
  $('stop').textContent = 'Stop';
  $('stop').disabled = !slides.length;
  $('storeWatermark').textContent = data.storeName;
  document.title = `${data.storeName} - Recipe slideshow`;
  $('flavor').textContent = '';
  $('names').replaceChildren();
  $('status').textContent = slides.length ? '' : 'This store has no drinks to display.';
  if (slides.length) {
    renderSlide();
    startTimer();
  }
}

async function loadPublicStores() {
  $('storePicker').hidden = false;
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
  $('status').textContent = publicStores.length ? 'Open + to select a store.' : 'No stores are available.';
}

$('storeSelect').addEventListener('change', () => {
  if ($('storeSelect').value === '') {
    stopTimer();
    slides = [];
    paused = false;
    stopped = false;
    $('slideshow').classList.remove('is-paused');
    $('pause').textContent = 'Pause';
    $('stop').textContent = 'Stop';
    $('flavor').textContent = '';
    $('names').replaceChildren();
    $('storeWatermark').textContent = '';
    $('pause').disabled = true;
    $('stop').disabled = true;
    $('status').textContent = 'Select a store to start the slideshow.';
    return;
  }
  try {
    startSlideshow(publicStores[Number($('storeSelect').value)]);
    $('controlsPanel').open = false;
  } catch (error) {
    console.error('Could not start slideshow:', error);
    stopTimer();
    slides = [];
    $('flavor').textContent = '';
    $('names').replaceChildren();
    $('storeWatermark').textContent = '';
    $('pause').disabled = true;
    $('stop').disabled = true;
    $('status').textContent = `Could not start slideshow: ${error.message}`;
  }
});
$('stop').addEventListener('click', () => {
  if (!stopped) {
    stop();
    return;
  }
  stopped = false;
  index = 0;
  $('status').textContent = '';
  $('pause').disabled = false;
  $('stop').textContent = 'Stop';
  renderSlide();
  startTimer();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if ($('controlsPanel').open) {
    $('controlsPanel').open = false;
    $('controlsPanel').querySelector('summary').focus();
  } else if (slides.length && !stopped) {
    stop();
  }
});
$('speed').addEventListener('change', () => {
  secondsPerSlide = Number($('speed').value);
  startTimer();
});
$('pause').addEventListener('click', () => {
  paused = !paused;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  $('slideshow').classList.toggle('is-paused', paused);
  startTimer();
});

async function initialize() {
  $('controlsPanel').open = false;
  try {
    const isDemo = new URLSearchParams(location.search).get('demo') === '1';
    const raw = sessionStorage.getItem('mynutrition-slideshow');
    sessionStorage.removeItem('mynutrition-slideshow');
    if (raw) {
      $('backLink').href = isDemo ? '/demo/' : '/mynutrition/';
      $('backLink').textContent = isDemo ? 'Back to demo' : 'Back to MyNutrition';
      $('homeLink').hidden = false;
      startSlideshow(JSON.parse(raw));
    } else if (isDemo) {
      $('backLink').href = '/demo/';
      $('backLink').textContent = 'Back to demo';
      $('homeLink').hidden = false;
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
