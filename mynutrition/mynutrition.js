// Public MyNutrition menu. The Worker chooses the signed-in user's active
// store for /api/christmas; this menu and the older Christmas editor therefore
// show the same store data. Store listing and switching use the companion APIs.
const state = {
  activeCategory: 'All',
  selectedFlavors: new Set(),
  query: '',
  data: null,
};
const API_BASE =
  location.hostname === '127.0.0.1' || location.hostname === 'localhost'
    ? 'http://127.0.0.1:8787'
    : '';
const apiEndpoint = `${API_BASE}/api/christmas`;

const defaultFlavorProfiles = [
  'Apple',
  'Banana',
  'Blackberry',
  'Blueberry',
  'Blue Raspberry',
  'Cherry',
  'Coconut',
  'Cranberry',
  'Grape',
  'Lemonade',
  'Lime',
  'Limeade',
  'Mango',
  'Orange',
  'Passion Fruit',
  'Peach',
  'Pineapple',
  'Pomegranate',
  'Raspberry',
  'Strawberry',
  'Watermelon',
];
const previousDefaultFlavorProfiles = ['Mango', 'Lime', 'Peach'];
const categoryFilters = document.getElementById('categoryFilters');
const flavorFilters = document.getElementById('flavorFilters');
const flavorFilterPanel = document.getElementById('flavorFilterPanel');
const compactFlavorFilter = window.matchMedia('(max-width: 720px)');
const recipeGrid = document.getElementById('recipeGrid');
const searchInput = document.getElementById('searchInput');
const clearSearchButton = document.getElementById('clearSearchButton');
const storeName = document.getElementById('storeName');
const storeSwitcher = document.getElementById('storeSwitcher');
const joinStoreButton = document.getElementById('joinStoreButton');
const loadStatus = document.getElementById('loadStatus');
const drinkPicker = document.getElementById('drinkPicker');
const openPickerButton = document.getElementById('openPickerButton');
const closePickerButton = document.getElementById('closePickerButton');
const pickButton = document.getElementById('pickButton');
const drinkName = document.getElementById('drinkName');
const drinkCount = document.getElementById('drinkCount');
const drinkResult = document.getElementById('drinkResult');
let pickerDrinks = [];
let lastPickedIndex = -1;

flavorFilterPanel.open = !compactFlavorFilter.matches;
compactFlavorFilter.addEventListener('change', (event) => {
  flavorFilterPanel.open = !event.matches;
});

function normalizeData(raw) {
  if (!raw) {
    return { store: { name: 'My Nutrition Recipes' }, categories: [], drinks: [] };
  }

  const rawStores = Array.isArray(raw.stores) ? raw.stores : [];
  const store = raw.store || rawStores.find((item) => item.active !== false) || rawStores[0] || { name: 'My Nutrition Recipes' };
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  if (!Array.isArray(store.flavorProfiles)) {
    store.flavorProfiles = [...defaultFlavorProfiles];
  } else if (
    store.flavorProfiles.length === previousDefaultFlavorProfiles.length &&
    previousDefaultFlavorProfiles.every((flavor) => store.flavorProfiles.includes(flavor))
  ) {
    store.flavorProfiles = [...defaultFlavorProfiles];
  }

  const drinks = Array.isArray(raw.drinkRecipes)
    ? raw.drinkRecipes
    : Array.isArray(raw.drinks)
      ? raw.drinks
      : [];

  const filteredCategories = categories.filter((category) => {
    if (!category || !store || category.storeId == null) return true;
    return category.storeId === store.id;
  });

  const filteredDrinks = drinks.filter((drink) => {
    if (!drink || !store || drink.storeId == null) return true;
    return drink.storeId === store.id;
  });

  return {
    store,
    categories: filteredCategories,
    drinks: filteredDrinks,
  };
}

function getCategoryName(categoryId) {
  const categories = state.data?.categories || [];
  if (categoryId == null) return 'Uncategorized';

  const match = categories.find((category) => category.id === categoryId || category.name === categoryId);
  return match ? match.name : String(categoryId);
}

async function loadData() {
  setStatus('Loading recipes…');
  const response = await fetch(apiEndpoint, { cache: 'no-store' });
  if (!response.ok) {
    const details = (await response.text()).trim().slice(0, 300);
    throw new Error(
      `Could not load recipe data (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`
      + (details ? ` Server response: ${details}` : ''),
    );
  }

  const raw = await response.json();
  state.data = normalizeData(raw);

  storeName.textContent = state.data.store?.name || 'My Nutrition Recipes';
  applyStoreTheme(state.data.store);
  renderFilters();
  renderFlavorFilters();
  renderDrinkPicker();
  renderRecipes();
  setStatus(`Loaded recipes for ${state.data.store?.name || 'this store'}.`);
  loadStoreSwitcher();
}

async function loadStoreSwitcher() {
  try {
    const response = await fetch(`${API_BASE}/api/my-stores`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Store list request failed (HTTP ${response.status}).`);
    }
    if (!Array.isArray(data.stores)) {
      throw new Error('The store list response has an invalid format.');
    }

    storeSwitcher.innerHTML = data.stores
      .map((store) => `<option value="${escapeHtml(store.storeId)}">${escapeHtml(store.name)}</option>`)
      .join('');
    storeSwitcher.disabled = data.stores.length < 2;
    const activeStore = data.stores.find((store) => store.active);
    if (activeStore) storeSwitcher.value = String(activeStore.storeId);
  } catch (error) {
    console.error('Failed to load store list:', error);
    storeSwitcher.disabled = false;
    setStatus(`Recipes loaded, but stores could not be listed: ${error.message}`, true);
  }
}

joinStoreButton.addEventListener('click', async () => {
  const value = prompt('Enter the store ID to join:');
  if (value == null || !value.trim()) return;

  const storeId = Number(value);
  if (!Number.isSafeInteger(storeId) || storeId <= 0) {
    setStatus('Enter a valid positive store ID.', true);
    return;
  }

  joinStoreButton.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/join-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Join request failed (HTTP ${response.status}).`);
    }
    await loadData();
  } catch (error) {
    console.error('Failed to join store:', error);
    setStatus(`Could not join store: ${error.message}`, true);
  } finally {
    joinStoreButton.disabled = false;
  }
});

storeSwitcher.addEventListener('change', async () => {
  const storeId = Number(storeSwitcher.value);
  if (!Number.isSafeInteger(storeId) || storeId <= 0) return;

  storeSwitcher.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/switch-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Store switch failed (HTTP ${response.status}).`);
    }
    state.activeCategory = 'All';
    state.selectedFlavors.clear();
    await loadData();
  } catch (error) {
    console.error('Failed to switch stores:', error);
    setStatus(`Could not switch stores: ${error.message}`, true);
    storeSwitcher.disabled = false;
  }
});

function setStatus(message, isError = false) {
  loadStatus.textContent = message;
  loadStatus.classList.toggle('error', isError);
  loadStatus.setAttribute('aria-live', isError ? 'assertive' : 'polite');
}

function renderDrinkPicker() {
  pickerDrinks = state.data.drinks
    .map((drink) => drink?.name)
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => name.trim());
  lastPickedIndex = -1;
  drinkName.disabled = true;

  if (pickerDrinks.length === 0) {
    drinkName.textContent = 'The drink list could not be loaded.';
    drinkCount.textContent = 'No drink recipes are available for this store.';
    openPickerButton.disabled = true;
    pickButton.disabled = true;
    return;
  }

  drinkName.textContent = 'Tap the button to get started.';
  drinkCount.textContent = `Choose from ${pickerDrinks.length} drink recipes.`;
  openPickerButton.disabled = false;
  pickButton.disabled = false;
}

openPickerButton.addEventListener('click', () => drinkPicker.showModal());
closePickerButton.addEventListener('click', () => drinkPicker.close());

drinkName.addEventListener('click', () => {
  if (lastPickedIndex < 0) return;

  state.query = pickerDrinks[lastPickedIndex];
  searchInput.value = state.query;
  updateSearchClearButton();
  state.activeCategory = 'All';
  state.selectedFlavors.clear();
  renderFilters();
  renderFlavorFilters();
  renderRecipes();
  drinkPicker.close();
  searchInput.focus();
});

pickButton.addEventListener('click', () => {
  let nextIndex = Math.floor(Math.random() * pickerDrinks.length);
  if (pickerDrinks.length > 1 && nextIndex === lastPickedIndex) {
    nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (pickerDrinks.length - 1))) % pickerDrinks.length;
  }

  pickButton.disabled = true;
  drinkName.disabled = true;
  pickButton.textContent = 'Picking...';
  drinkResult.setAttribute('aria-busy', 'true');
  drinkResult.classList.add('is-spinning');

  const finishPick = () => {
    lastPickedIndex = nextIndex;
    drinkName.disabled = false;
    pickButton.disabled = false;
    pickButton.textContent = 'Pick One';
    drinkResult.setAttribute('aria-busy', 'false');
    drinkResult.classList.remove('is-spinning');
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    drinkName.textContent = 'Choosing a drink...';
    window.setTimeout(() => {
      drinkName.textContent = pickerDrinks[nextIndex];
      finishPick();
    }, 500);
    return;
  }

  let spinIndex = lastPickedIndex < 0 ? nextIndex : lastPickedIndex;
  let ticks = 0;
  const totalTicks = 18;
  const spin = () => {
    ticks += 1;
    if (ticks === totalTicks) {
      drinkName.textContent = pickerDrinks[nextIndex];
      finishPick();
      return;
    }

    spinIndex = (spinIndex + 1) % pickerDrinks.length;
    drinkName.textContent = pickerDrinks[spinIndex];
    window.setTimeout(spin, 55 + ticks * 9);
  };

  window.setTimeout(spin, 55);
});

function colorOr(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
}

function contrastingTextColor(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16) / 255);
  const luminance =
    channels
      .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.179 ? '#17212b' : '#ffffff';
}

function applyStoreTheme(store) {
  const buttonColor = colorOr(store?.buttonColor, '#126e68');
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--bg', colorOr(store?.backgroundColor, '#f4f1ea'));
  rootStyle.setProperty('--ink', colorOr(store?.textColor, '#17212b'));
  rootStyle.setProperty('--card', colorOr(store?.cardBackgroundColor, '#ffffff'));
  rootStyle.setProperty('--card-ink', colorOr(store?.cardTextColor, '#17212b'));
  rootStyle.setProperty('--button', buttonColor);
  rootStyle.setProperty('--button-ink', colorOr(store?.buttonTextColor, contrastingTextColor(buttonColor)));
}

function renderFilters() {
  const categories = ['All', ...(state.data?.categories || []).map((category) => category.name)];

  categoryFilters.innerHTML = categories
    .map(
      (name) => `
        <button
          class="filter-btn ${state.activeCategory === name ? 'active' : ''}"
          type="button"
          data-filter="${name}"
        >
          ${name}
        </button>
      `
    )
    .join('');

  categoryFilters.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeCategory = button.dataset.filter;
      renderFilters();
      renderRecipes();
    });
  });
}

function renderFlavorFilters() {
  const profiles = state.data.store?.flavorProfiles || [];
  const sortedProfiles = [...profiles].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  flavorFilters.innerHTML = sortedProfiles.length
    ? sortedProfiles
        .map(
          (flavor) => `
            <label>
              <input type="checkbox" value="${escapeHtml(flavor)}" ${state.selectedFlavors.has(flavor) ? 'checked' : ''} />
              ${escapeHtml(flavor)}
            </label>
          `
        )
        .join('')
    : '<span>No flavor profiles have been added for this store.</span>';

  flavorFilters.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.selectedFlavors.add(checkbox.value);
      } else {
        state.selectedFlavors.delete(checkbox.value);
      }
      renderRecipes();
    });
  });
}

function containsFlavor(text, flavor) {
  const words = (value) => String(value || '').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const textWords = words(text);
  const flavorWords = words(flavor);
  return (
    flavorWords.length > 0 &&
    textWords.some((_, index) =>
      flavorWords.every((word, offset) => textWords[index + offset] === word)
    )
  );
}

function recipeMatchesCategory(drink) {
  const categoryValue = drink.categoryId ?? drink.category ?? 'All';
  return state.activeCategory === 'All' || getCategoryName(categoryValue) === state.activeCategory;
}

function renderRecipes() {
  const recipeList = (state.data?.drinks || []).filter((drink) => {
    const haystack = `${drink.name || ''} ${(drink.ingredients || []).map((item) => item.name || '').join(' ')}`.toLowerCase();
    const matchesQuery = haystack.includes(state.query.toLowerCase());
    const matchesFlavor =
      state.selectedFlavors.size === 0 ||
      [...state.selectedFlavors].some((flavor) =>
        [drink.name, ...(drink.ingredients || []).map((item) => item.name)].some((name) =>
          containsFlavor(name, flavor)
        )
      );
    return recipeMatchesCategory(drink) && matchesQuery && matchesFlavor;
  });

  if (recipeList.length === 0) {
    recipeGrid.innerHTML = '<div class="empty-state">No recipes match the selected filters.</div>';
    return;
  }

  recipeGrid.innerHTML = recipeList
    .map((drink) => {
      const ingredients = Array.isArray(drink.ingredients) ? drink.ingredients : [];
      const topIngredients = ingredients.filter((item) => String(item.side || '').toUpperCase() === 'TOP');
      const bottomIngredients = ingredients.filter((item) => String(item.side || '').toUpperCase() === 'BOTTOM');

      const ingredientMarkup = (items) =>
        items.length
          ? `<ul>${items
              .map((item) => `<li>${escapeHtml(item.name || 'Ingredient')}</li>`)
              .join('')}</ul>`
          : '<ul><li>—</li></ul>';

      return `
          <article class="recipe-card">
            <h2>${escapeHtml(drink.name || 'Untitled recipe')}</h2>
            <div class="ingredients">
              ${ingredientMarkup(topIngredients)}
              <hr class="ingredient-divider" />
              ${ingredientMarkup(bottomIngredients)}
            </div>
          </article>
      `;
    })
    .join('');
}

searchInput.addEventListener('input', (event) => {
  state.query = event.target.value.trim();
  updateSearchClearButton();
  renderRecipes();
});

clearSearchButton.addEventListener('click', () => {
  searchInput.value = '';
  state.query = '';
  updateSearchClearButton();
  renderRecipes();
  searchInput.focus();
});

function updateSearchClearButton() {
  clearSearchButton.hidden = !searchInput.value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function handleDataLoadError(error) {
  console.error('Failed to load recipe data:', error);
  setStatus(error.message || 'Unable to load recipe data.', true);
  drinkName.textContent = 'The drink list could not be loaded.';
  drinkCount.textContent = 'Unable to load drink recipes.';
  openPickerButton.disabled = true;
  pickButton.disabled = true;
  drinkName.disabled = true;
  recipeGrid.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Unable to load recipe data.')}</div>`;
}

loadData().catch(handleDataLoadError);
