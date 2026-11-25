// Public Recipe Builder demo: fictional data, browser-only saves, no API or AI calls.
const demoDataUrl = '/recipe-builder-demo/demo.json';
const demoStorageKey = 'recipe-builder-demo-draft';

const state = {
  data: null,
  storeId: null,
  editingDrinkId: null,
  editingFlavorIndex: null,
  query: '',
};

const defaultFlavorProfiles = [];
const defaultStoreColors = {
  backgroundColor: '#f4f1ea',
  textColor: '#17212b',
  cardBackgroundColor: '#ffffff',
  cardTextColor: '#17212b',
  buttonColor: '#126e68',
};
const $ = (selector) => document.querySelector(selector);
const drinkPicker = $('#drinkPicker');
const drinkResult = $('#drinkResult');
const pickedDrinkName = $('#pickedDrinkName');
const pickButton = $('#pickButton');
let pickerDrinks = [];
let lastPickedIndex = -1;
const downloadName = 'recipe-builder-demo.json';
setStatus('Loading demo recipes…');

$('#resetDraftButton').addEventListener('click', () => {
  if (!confirm('Discard your saved demo edits and restore the sample recipes?')) return;
  try { localStorage.removeItem(demoStorageKey); }
  catch (error) { console.error('Could not clear demo edits:', error); }
  loadData();
});
$('#storeInfo').addEventListener('input', (event) => {
  const input = event.target.closest('[data-field]');
  const field = input?.dataset.field;
  if (!input || field !== 'name') return;

  const store = state.data.stores.find((item) => item.id === state.storeId);
  if (!store) return;
  store[field] = input.value;
  if (field === 'name') {
    const albumName = input.value.trim() || 'Album';
    $('#albumSummary').textContent = albumName;
    document.title = `${albumName} | Recipe Builder Demo`;
  }
  markChanged();
});
$('#storeColors').addEventListener('input', (event) => {
  const input = event.target.closest('input[data-color-field]');
  if (!input) return;
  const store = state.data.stores.find((item) => item.id === state.storeId);
  if (!store) return;
  store[input.dataset.colorField] = input.value;
  applyStoreTheme(store);
  markChanged();
});
$('#addCategoryButton').addEventListener('click', addCategory);
$('#addDrinkButton').addEventListener('click', () => openDrinkDialog());
$('#addFlavorButton').addEventListener('click', addFlavor);
$('#saveButton').addEventListener('click', saveData);
$('#downloadButton').addEventListener('click', downloadData);
$('#pickOneButton').addEventListener('click', openDrinkPicker);
$('#closePickerButton').addEventListener('click', () => drinkPicker.close());
pickButton.addEventListener('click', pickOneRecipe);
pickedDrinkName.addEventListener('click', showPickedRecipe);
$('#addIngredientButton').addEventListener('click', () => addIngredientRow());
$('#searchInput').addEventListener('input', (event) => {
  state.query = event.target.value.trim().toLocaleLowerCase();
  updateSearchClearButton();
  render();
});
$('#clearSearchButton').addEventListener('click', () => {
  $('#searchInput').value = '';
  state.query = '';
  updateSearchClearButton();
  render();
  $('#searchInput').focus();
});
$('#cancelDrinkButton').addEventListener('click', () => $('#drinkDialog').close());
$('#drinkForm').addEventListener('submit', saveDrink);
$('#cancelFlavorButton').addEventListener('click', () => $('#flavorDialog').close());
$('#flavorForm').addEventListener('submit', saveFlavor);

loadData();

async function loadData() {
  try {
    let data;
    let restored = false;
    try {
      const draft = localStorage.getItem(demoStorageKey);
      if (draft) {
        data = JSON.parse(draft);
        validateData(data);
        restored = true;
      }
    } catch (error) {
      console.error('Ignoring unreadable demo edits:', error);
      data = undefined;
    }
    if (!data) {
      const response = await fetch(demoDataUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load the demo recipes (HTTP ${response.status}).`);
      data = await response.json();
      validateData(data);
    }
    state.data = data;
    state.storeId = data.stores.find((store) => store.active !== false)?.id ?? data.stores[0]?.id ?? null;
    $('#editor').classList.remove('hidden');
    $('#resetDraftButton').classList.toggle('hidden', !restored);
    render();
    setStatus(restored
      ? 'Loaded your saved demo edits. Reset the demo to restore the sample recipes.'
      : 'Loaded the sample Christmas recipes. Edits stay in this browser only.');
  } catch (error) {
    console.error('Failed to load demo data:', error);
    setStatus(error.message || 'Unable to load the demo.', true);
    $('#editor').classList.add('hidden');
  }
}

function setStatus(message, isError = false) {
  const status = $('#loadStatus');
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
}

function validateData(data) {
  if (!data || !Array.isArray(data.stores) || !Array.isArray(data.categories) || !Array.isArray(data.drinkRecipes)) {
    throw new Error('The selected source did not return recipe data in the expected format.');
  }
}

function contrastingTextColor(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16) / 255);
  const luminance = channels
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.179 ? '#17212b' : '#ffffff';
}

function applyStoreTheme(store) {
  const colorOr = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  const buttonColor = colorOr(store?.buttonColor, defaultStoreColors.buttonColor);
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--page-background', colorOr(store?.backgroundColor, defaultStoreColors.backgroundColor));
  rootStyle.setProperty('--page-text', colorOr(store?.textColor, defaultStoreColors.textColor));
  rootStyle.setProperty('--card-background', colorOr(store?.cardBackgroundColor, defaultStoreColors.cardBackgroundColor));
  rootStyle.setProperty('--card-text', colorOr(store?.cardTextColor, defaultStoreColors.cardTextColor));
  rootStyle.setProperty('--button-background', buttonColor);
  rootStyle.setProperty('--button-text', colorOr(store?.buttonTextColor, contrastingTextColor(buttonColor)));
}

function storeCategories() {
  return state.data.categories.filter((category) => category.storeId === state.storeId);
}

function storeDrinks() {
  return state.data.drinkRecipes.filter((drink) => drink.storeId === state.storeId);
}

function storeFlavorProfiles() {
  const store = state.data.stores.find((item) => item.id === state.storeId);
  if (!Array.isArray(store.flavorProfiles)) store.flavorProfiles = [...defaultFlavorProfiles];
  return store.flavorProfiles;
}

function render() {
  const stores = state.data.stores;
  const store = stores.find((item) => item.id === state.storeId);
  $('#storeInfo [data-field="name"]').value = store?.name || '';
  const albumName = store?.name || 'Album';
  $('#albumSummary').textContent = albumName;
  document.title = `${albumName} | Recipe Builder Demo`;
  applyStoreTheme(store);
  $('#storeColors').querySelectorAll('input[data-color-field]').forEach((input) => {
    const field = input.dataset.colorField;
    const color = store?.[field];
    const buttonColor = /^#[0-9a-f]{6}$/i.test(store?.buttonColor || '')
      ? store.buttonColor
      : defaultStoreColors.buttonColor;
    input.value = /^#[0-9a-f]{6}$/i.test(color || '')
      ? color
      : field === 'buttonTextColor'
        ? contrastingTextColor(buttonColor)
        : defaultStoreColors[field];
  });

  const categories = storeCategories();
  $('#categoryList').innerHTML = categories.length
    ? categories.map((category) => `
        <div class="item-row">
          <span>${escapeHtml(category.name)}${category.active === false ? ' (inactive)' : ''}</span>
          <div class="item-actions">
            <button type="button" data-action="edit-category" data-id="${escapeHtml(category.id)}">Edit</button>
            <button type="button" data-action="delete-category" data-id="${escapeHtml(category.id)}">Delete</button>
          </div>
        </div>`).join('')
    : '<p>No categories in this album.</p>';

  const flavors = storeFlavorProfiles()
    .map((flavor, index) => ({ flavor, index }))
    .sort((a, b) => a.flavor.localeCompare(b.flavor, undefined, { sensitivity: 'base' }));
  $('#flavorList').innerHTML = flavors.length
    ? flavors.map(({ flavor, index }) => `
        <div class="item-row">
          <span>${escapeHtml(flavor)}</span>
          <div class="item-actions">
            <button type="button" data-action="edit-flavor" data-index="${index}">Edit</button>
            <button type="button" data-action="delete-flavor" data-index="${index}">Remove</button>
          </div>
        </div>`).join('')
    : '<p>No flavor profiles in this store.</p>';

  const drinks = storeDrinks();
  const matchingDrinks = drinks.filter((drink) => {
    const ingredients = Array.isArray(drink.ingredients) ? drink.ingredients : [];
    const haystack = `${drink.name || ''} ${ingredients.map((item) => item.name || '').join(' ')}`;
    return haystack.toLocaleLowerCase().includes(state.query);
  });
  $('#drinkList').innerHTML = matchingDrinks.length
    ? matchingDrinks.map((drink) => {
        const category = categories.find((item) => item.id === drink.categoryId);
        const ingredients = Array.isArray(drink.ingredients) ? drink.ingredients : [];
        const topIngredients = ingredients.filter((item) => String(item.side || '').toUpperCase() === 'TOP');
        const bottomIngredients = ingredients.filter((item) => String(item.side || '').toUpperCase() === 'BOTTOM');
        const ingredientMarkup = (items) =>
          items.length
            ? `<ul>${items.map((item) => `<li>${escapeHtml(item.name || 'Ingredient')}</li>`).join('')}</ul>`
            : '<ul><li>—</li></ul>';
        const drinkDetails = `<div class="drink-details">
          <div class="drink-heading">
            <strong>${escapeHtml(drink.name)}</strong>
            <small>${escapeHtml(category?.name || 'Uncategorized')}</small>
          </div>
          <div class="ingredients">
            ${ingredientMarkup(topIngredients)}
            <hr class="ingredient-divider" />
            ${ingredientMarkup(bottomIngredients)}
          </div>
        </div>`;
        return `<div class="item-row">
          ${drinkDetails}
          <div class="item-actions">
            <button type="button" data-action="shop-drink" data-id="${escapeHtml(drink.id)}" aria-label="Shop ingredients for ${escapeHtml(drink.name)}">Shop</button>
            <button type="button" data-action="edit-drink" data-id="${escapeHtml(drink.id)}">Edit</button>
            <button type="button" data-action="delete-drink" data-id="${escapeHtml(drink.id)}">Delete</button>
          </div>
        </div>`;
      }).join('')
    : drinks.length ? '<p>No recipes match your search.</p>' : '<p>No recipes in this album.</p>';
}

function openDrinkPicker() {
  pickerDrinks = storeDrinks().filter((drink) => typeof drink?.name === 'string' && drink.name.trim());
  lastPickedIndex = -1;
  pickedDrinkName.disabled = true;
  pickedDrinkName.textContent = 'Tap the button to get started.';

  if (!pickerDrinks.length) {
    setStatus('There are no recipes in this store to pick from.', true);
    return;
  }

  $('#drinkCount').textContent = `Choose from ${pickerDrinks.length} recipes.`;
  drinkPicker.showModal();
}

function pickOneRecipe() {
  let nextIndex = Math.floor(Math.random() * pickerDrinks.length);
  if (pickerDrinks.length > 1 && nextIndex === lastPickedIndex) {
    nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (pickerDrinks.length - 1))) % pickerDrinks.length;
  }

  pickButton.disabled = true;
  pickedDrinkName.disabled = true;
  pickButton.textContent = 'Picking...';
  drinkResult.setAttribute('aria-busy', 'true');
  drinkResult.classList.add('is-spinning');

  const finishPick = () => {
    lastPickedIndex = nextIndex;
    pickedDrinkName.textContent = pickerDrinks[nextIndex].name.trim();
    pickedDrinkName.disabled = false;
    pickButton.disabled = false;
    pickButton.textContent = 'Pick One';
    drinkResult.setAttribute('aria-busy', 'false');
    drinkResult.classList.remove('is-spinning');
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    pickedDrinkName.textContent = 'Choosing a recipe...';
    window.setTimeout(finishPick, 250);
    return;
  }

  let spinIndex = lastPickedIndex < 0 ? nextIndex : lastPickedIndex;
  let ticks = 0;
  const totalTicks = 10;
  const spin = () => {
    ticks += 1;
    if (ticks === totalTicks) {
      finishPick();
      return;
    }

    spinIndex = (spinIndex + 1) % pickerDrinks.length;
    pickedDrinkName.textContent = pickerDrinks[spinIndex].name.trim();
    window.setTimeout(spin, 40 + ticks * 5);
  };

  window.setTimeout(spin, 40);
}

function showPickedRecipe() {
  if (lastPickedIndex < 0) return;

  const drink = pickerDrinks[lastPickedIndex];
  state.query = drink.name.trim().toLocaleLowerCase();
  $('#searchInput').value = drink.name.trim();
  updateSearchClearButton();
  render();
  drinkPicker.close();
  setStatus(`Picked "${drink.name.trim()}".`);
}

function updateSearchClearButton() {
  $('#clearSearchButton').hidden = !$('#searchInput').value;
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = Number(button.dataset.id);
  const index = Number(button.dataset.index);
  if (button.dataset.action === 'edit-category') editCategory(id);
  if (button.dataset.action === 'delete-category') deleteCategory(id);
  if (button.dataset.action === 'edit-drink') openDrinkDialog(id);
  if (button.dataset.action === 'shop-drink') shopRecipe(id);
  if (button.dataset.action === 'delete-drink') deleteDrink(id);
  if (button.dataset.action === 'edit-flavor') editFlavor(index);
  if (button.dataset.action === 'delete-flavor') deleteFlavor(index);
});

function shopRecipe(id) {
  const recipe = storeDrinks().find((item) => item.id === id);
  if (!recipe) {
    setStatus('Recipe not found in this album.', true);
    return;
  }
  const ingredients = (Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .filter((item) => String(item?.side || '').toUpperCase() === 'TOP')
    .map((item) => typeof item.name === 'string' ? item.name.trim() : '')
    .filter(Boolean);
  const key = 'recipe-shopping-list';
  let saved = false;
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, items: ingredients }));
    saved = true;
    const tab = window.open('/shop/', '_blank');
    if (!tab) throw new Error('The shop tab was blocked. Allow pop-ups and try again.');
    tab.opener = null;
  } catch (error) {
    console.error('Could not open shop:', error);
    setStatus(`Could not open shop: ${error.message}`, true);
  } finally {
    if (saved) {
      try { sessionStorage.removeItem(key); }
      catch (error) { console.error('Could not clear shopping handoff:', error); }
    }
  }
}

function addCategory() {
  const name = prompt('Category name:');
  if (!name?.trim()) return;
  const categories = storeCategories();
  state.data.categories.push({
    id: nextId(state.data.categories),
    storeId: state.storeId,
    name: name.trim(),
    displayOrder: categories.length + 1,
    active: true,
  });
  render();
  markChanged();
}

function editCategory(id) {
  const category = state.data.categories.find((item) => item.id === id);
  if (!category) return;
  const name = prompt('Category name:', category.name);
  if (!name?.trim()) return;
  category.name = name.trim();
  render();
  markChanged();
}

function deleteCategory(id) {
  const category = storeCategories().find((item) => item.id === id);
  if (!category) {
    setStatus('Category not found in this album.', true);
    return;
  }
  const count = state.data.drinkRecipes.filter((drink) => Number(drink.categoryId) === id).length;
  if (count) {
    setStatus(`Cannot delete "${category.name}": move its ${count} ${count === 1 ? 'recipe' : 'recipes'} to another category first.`, true);
    return;
  }
  if (!confirm(`Delete category "${category.name}"?`)) return;
  state.data.categories = state.data.categories.filter((item) => item !== category);
  render();
  markChanged();
}

function addFlavor() {
  openFlavorDialog();
}

function editFlavor(index) {
  const flavors = storeFlavorProfiles();
  if (flavors[index] == null) return;
  openFlavorDialog(index);
}

function openFlavorDialog(index = null) {
  state.editingFlavorIndex = index;
  $('#flavorDialogTitle').textContent = index == null ? 'Add flavor' : 'Edit flavor';
  $('#flavorName').value = index == null ? '' : storeFlavorProfiles()[index];
  $('#flavorFormError').textContent = '';
  $('#flavorDialog').showModal();
  $('#flavorName').focus();
}

function saveFlavor(event) {
  event.preventDefault();
  const flavor = $('#flavorName').value.trim();
  const flavors = storeFlavorProfiles();
  const duplicate = flavors.some((item, index) =>
    index !== state.editingFlavorIndex && item.toLocaleLowerCase() === flavor.toLocaleLowerCase(),
  );
  if (duplicate) {
    $('#flavorFormError').textContent = 'That flavor profile already exists for this store.';
    return;
  }
  if (state.editingFlavorIndex == null) {
    flavors.push(flavor);
  } else {
    flavors[state.editingFlavorIndex] = flavor;
  }
  $('#flavorDialog').close();
  render();
  markChanged();
}

function deleteFlavor(index) {
  const flavors = storeFlavorProfiles();
  const flavor = flavors[index];
  if (flavor == null || !confirm(`Remove "${flavor}" from this store's flavor filters?`)) return;
  flavors.splice(index, 1);
  render();
  markChanged();
}

function openDrinkDialog(id = null) {
  const drink = id == null ? null : state.data.drinkRecipes.find((item) => item.id === id);
  const activeCategories = storeCategories().filter((category) => category.active !== false);
  if (!activeCategories.length) {
    state.data.categories.push({
      id: nextId(state.data.categories),
      storeId: state.storeId,
      name: ' ',
      displayOrder: storeCategories().length + 1,
      active: true,
    });
    render();
    markChanged();
  }

  state.editingDrinkId = drink?.id ?? null;
  $('#drinkDialogTitle').textContent = drink ? 'Edit recipe' : 'Add recipe';
  $('#drinkName').value = drink?.name || '';
  $('#drinkCategory').innerHTML = storeCategories()
    .filter((category) => category.active !== false)
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
    .join('');
  if (drink) $('#drinkCategory').value = String(drink.categoryId);
  $('#drinkIngredients').replaceChildren();
  const ingredients = drink?.ingredients || [];
  if (ingredients.length) {
    ingredients.forEach(addIngredientRow);
  } else {
    addIngredientRow();
  }
  $('#formError').textContent = '';
  $('#drinkDialog').showModal();
}

function addIngredientRow(ingredient = {}) {
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  if (ingredient.id != null) row.dataset.ingredientId = ingredient.id;

  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Ingredient';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'ingredient-name';
  nameInput.value = ingredient.name || '';
  nameLabel.append(nameInput);

  const sideLabel = document.createElement('label');
  sideLabel.textContent = 'Position';
  const sideSelect = document.createElement('select');
  sideSelect.className = 'ingredient-side';
  sideSelect.innerHTML = '<option value="TOP">Top</option><option value="BOTTOM">Bottom</option>';
  sideSelect.value = normalizeSide(ingredient.side);
  sideLabel.append(sideSelect);

  const costLabel = document.createElement('label');
  costLabel.textContent = 'Cost';
  const costInput = document.createElement('input');
  costInput.type = 'number';
  costInput.className = 'ingredient-cost';
  costInput.min = '0';
  costInput.step = 'any';
  costInput.value = ingredient.cost ?? 0;
  costLabel.append(costInput);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'remove-ingredient';
  removeButton.textContent = 'Remove';
  removeButton.setAttribute('aria-label', `Remove ${ingredient.name || 'ingredient'}`);
  removeButton.addEventListener('click', () => row.remove());

  row.append(nameLabel, sideLabel, costLabel, removeButton);
  $('#drinkIngredients').append(row);
}

function saveDrink(event) {
  event.preventDefault();
  const name = $('#drinkName').value.trim();
  const categoryId = Number($('#drinkCategory').value);
  const ingredients = [];

  for (const [index, row] of [...$('#drinkIngredients').children].entries()) {
    const ingredientName = row.querySelector('.ingredient-name').value.trim();
    const side = row.querySelector('.ingredient-side').value;
    const costText = row.querySelector('.ingredient-cost').value;
    if (!ingredientName && costText === '0') continue;
    const cost = Number(costText);
    if (!ingredientName || !['TOP', 'BOTTOM'].includes(side) || costText === '' || !Number.isFinite(cost) || cost < 0) {
      $('#formError').textContent = `Ingredient ${index + 1} needs a name and a valid non-negative cost.`;
      return;
    }
    ingredients.push({
      id: row.dataset.ingredientId ? Number(row.dataset.ingredientId) : nextId(ingredients),
      name: ingredientName,
      cost,
      side,
      displayOrder: index + 1,
    });
  }

  const previous = state.editingDrinkId == null ? null : state.data.drinkRecipes.find((drink) => drink.id === state.editingDrinkId);
  if (previous) {
    previous.name = name;
    previous.categoryId = categoryId;
    previous.ingredients = ingredients;
  } else {
    state.data.drinkRecipes.push({
      id: nextId(state.data.drinkRecipes),
      storeId: state.storeId,
      name,
      categoryId,
      ingredients,
    });
  }

  $('#drinkDialog').close();
  render();
  markChanged();
}

function deleteDrink(id) {
  const drink = state.data.drinkRecipes.find((item) => item.id === id);
  if (!drink || !confirm(`Delete "${drink.name}"?`)) return;
  state.data.drinkRecipes = state.data.drinkRecipes.filter((item) => item.id !== id);
  render();
  markChanged();
}

function markChanged() {
  setStatus('Unsaved changes. Select Save to keep them in this browser.');
}

function saveData() {
  try {
    localStorage.setItem(demoStorageKey, JSON.stringify(state.data));
    $('#resetDraftButton').classList.remove('hidden');
    setStatus('Saved in this browser only. Nothing was sent to a server.');
  } catch (error) {
    setStatus(`Could not save in this browser: ${error.message}`, true);
  }
}

function downloadData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${downloadName}.`);
}

function normalizeSide(side) {
  return String(side || '').toUpperCase() === 'BOTTOM' || String(side).toUpperCase() === 'RIGHT' ? 'BOTTOM' : 'TOP';
}

function nextId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}
