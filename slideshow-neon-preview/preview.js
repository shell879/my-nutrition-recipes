const slides = [
  {
    flavor: 'Berry',
    drinks: [
      ['Fruit Coolers', 'Berry Breeze'],
      ['Creamy Blends', 'Berry Pillow'],
      ['Fruit Coolers', 'Berry Sparkle'],
      ['Creamy Blends', 'Berry Sunrise']
    ]
  },
  {
    flavor: 'Tropical',
    drinks: [
      ['Tropical Sips', 'Mango Island'],
      ['Tropical Sips', 'Pineapple Sunshine'],
      ['Fruit Coolers', 'Citrus Garden'],
      ['Creamy Blends', 'Peach Cloud']
    ]
  },
  {
    flavor: 'Coffee',
    drinks: [
      ['Iced Coffee', 'Vanilla Coffee Chill'],
      ['Iced Coffee', 'Cocoa Coffee Frost'],
      ['Coffeehouse Lattes', 'Honey Latte'],
      ['Coffeehouse Lattes', 'Maple Latte']
    ]
  }
];

const preview = document.querySelector('.preview');
const flavor = document.getElementById('flavor');
const names = document.getElementById('names');
const pauseButton = document.getElementById('pause');
const stopButton = document.getElementById('stop');
const storeSelect = document.getElementById('store');
const speedSelect = document.getElementById('speed');
const controls = document.querySelector('.controls');
controls.open = false;
let index = 0;
let paused = false;
let stopped = false;
let timer;

function renderSlide() {
  const slide = slides[index];
  flavor.textContent = slide.flavor;
  names.replaceChildren();
  slide.drinks.forEach(([category, name]) => {
    const drink = document.createElement('div');
    drink.className = 'drink';
    const text = document.createElement('div');
    text.className = 'drink-text';
    const label = document.createElement('p');
    label.textContent = category;
    const title = document.createElement('h3');
    title.textContent = name;
    text.append(label, title);
    drink.appendChild(text);
    names.appendChild(drink);
  });
}

function startTimer() {
  window.clearInterval(timer);
  if (!paused && !stopped) timer = window.setInterval(() => changeSlide(1), Number(speedSelect.value) * 1000);
}

function changeSlide(direction) {
  index = (index + direction + slides.length) % slides.length;
  renderSlide();
}

pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
  preview.classList.toggle('is-paused', paused);
  startTimer();
});

stopButton.addEventListener('click', () => {
  stopped = !stopped;
  paused = false;
  preview.classList.remove('is-paused');
  pauseButton.textContent = 'Pause';
  pauseButton.disabled = stopped;
  stopButton.textContent = stopped ? 'Start' : 'Stop';
  document.getElementById('status').textContent = stopped ? 'Slideshow stopped.' : '';
  if (stopped) {
    flavor.textContent = '';
    names.replaceChildren();
  } else {
    index = 0;
    renderSlide();
  }
  startTimer();
});

storeSelect.addEventListener('change', () => {
  const storeName = storeSelect.options[storeSelect.selectedIndex].textContent;
  document.getElementById('storeWatermark').textContent = storeName;
  index = Number(storeSelect.value);
  if (!stopped) renderSlide();
  startTimer();
});

speedSelect.addEventListener('change', startTimer);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && controls.open) {
    controls.open = false;
    controls.querySelector('summary').focus();
  }
});

renderSlide();
startTimer();
