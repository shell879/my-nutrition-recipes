const state = {
  data: null,
  storeId: null,
  editingDrinkId: null,
  editingFlavorIndex: null,
  sourceMode: 'api',
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
const sourceModes = document.querySelectorAll('input[name="sourceMode"]');
const apiEndpoint = '/api/christmas';
const localDataName = 'christmas.json';
const localDataUrl = new URL('../christmas.json', window.location.href);
const draftStorageKey = 'mnr-christmas-admin-local-draft';
const downloadName = 'christmas.json';
let loadRequestId = 0;

localStorage.setItem('mnr-christmas-admin-source', state.sourceMode);
$(`input[name="sourceMode"][value="${state.sourceMode}"]`).checked = true;
$('#resetDraftButton').classList.toggle('hidden', state.sourceMode !== 'local');
$('#saveButton').textContent = state.sourceMode === 'api' ? 'Save all to API' : 'Save draft';
setStatus('Loading API data…');

sourceModes.forEach((sourceMode) => sourceMode.addEventListener('change', () => {
  state.sourceMode = sourceMode.value;
  localStorage.setItem('mnr-christmas-admin-source', state.sourceMode);
  $('#resetDraftButton').classList.toggle('hidden', state.sourceMode !== 'local');
  $('#saveButton').textContent = state.sourceMode === 'api' ? 'Save all to API' : 'Save draft';
  loadData();
}));

$('#resetDraftButton').addEventListener('click', () => {
  localStorage.removeItem(draftStorageKey);
  loadData();
});
$('#storeSelect').addEventListener('change', () => {
  state.storeId = Number($('#storeSelect').value);
  render();
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
$('#addIngredientButton').addEventListener('click', () => addIngredientRow());
// ── Image Scan ──
$('#selfie').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  setStatus('Scanning image…');

  try {
    console.log('Original file:', file.type, file.size, 'bytes');
    const resized = await resizeImage(file, 1280);
    console.log('Resized:', resized.type, resized.size, 'bytes');

    const formData = new FormData();
    formData.append('file', resized, 'scan.jpg');

    const res = await fetch('/api/scan', { method: 'POST', body: formData });
    const data = await res.json();
    console.log('Scan response:', res.status, data);

    if (!res.ok) {
      let detail = data.error || 'Unknown error';
      if (data.message) detail += ' — ' + data.message;
      if (data.raw) detail += ' — Raw: ' + data.raw.slice(0, 200);
      setStatus('Scan failed: ' + detail, true);
      event.target.value = '';
      return;
    }

    openDrinkDialog();
    $('#drinkName').value = data.name || '';
    $('#drinkIngredients').replaceChildren();
    if (data.ingredients && data.ingredients.length) {
      data.ingredients.forEach((ing) => addIngredientRow(ing));
    } else {
      addIngredientRow();
    }

    setStatus('Scan complete — review and save the recipe.');
  } catch (err) {
    console.error('Scan error:', err);
    setStatus('Scan failed: ' + err.message, true);
  } finally {
    event.target.value = '';
  }
});

// Resize image to max width using canvas
async function resizeImage(file, maxWidth) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();

  if (img.width <= maxWidth) return file;

  const scale = maxWidth / img.width;
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
  });
}

$('#cancelDrinkButton').addEventListener('click', () => $('#drinkDialog').close());
$('#drinkForm').addEventListener('submit', saveDrink);
$('#cancelFlavorButton').addEventListener('click', () => $('#flavorDialog').close());
$('#flavorForm').addEventListener('submit', saveFlavor);

loadData();

async function loadData() {
  const requestId = ++loadRequestId;
  const sourceMode = $('input[name="sourceMode"]:checked').value;
  state.sourceMode = sourceMode;
  localStorage.setItem('mnr-christmas-admin-source', state.sourceMode);
  setStatus(`Loading ${sourceMode === 'local' ? 'Local' : 'API'} data…`);

  try {
    let response;
    if (sourceMode === 'local') {
      const draft = localStorage.getItem(draftStorageKey);
      if (draft) {
        state.data = JSON.parse(draft);
        validateData(state.data);
        state.storeId = state.data.stores.find((store) => store.active !== false)?.id ?? state.data.stores[0]?.id ?? null;
        $('#editor').classList.remove('hidden');
        render();
        setStatus(`Loaded saved browser draft. Discard it to reload ${localDataName}.`);
        return;
      }
      response = await fetch(localDataUrl);
    } else {
      response = await fetch(apiEndpoint);
    }
    if (requestId !== loadRequestId) return;

    if (!response.ok) {
      const details = (await response.text()).trim().slice(0, 300);
      throw new Error(
        `Could not load ${sourceMode} data (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`
        + (details ? ` Server response: ${details}` : ''),
      );
    }
    const data = await response.json();
    if (requestId !== loadRequestId) return;
    validateData(data);
    state.data = data;
    state.storeId = data.stores.find((store) => store.active !== false)?.id ?? data.stores[0]?.id ?? null;
    $('#editor').classList.remove('hidden');
    render();
    setStatus(`Loaded ${sourceMode === 'local' ? 'Local' : 'API'} data.`);
  } catch (error) {
    if (requestId !== loadRequestId) return;
    console.error(`Failed to load ${sourceMode} data:`, error);
    const message = sourceMode === 'api' && error instanceof TypeError
      ? `Could not reach ${apiEndpoint}. Check that the Worker route is deployed and allows requests from this site. (${error.message})`
      : sourceMode === 'local' && error instanceof TypeError
        ? `Could not reach ${localDataUrl.pathname}. Confirm ${localDataName} is served from the site root. (${error.message})`
        : error.message || `Unable to load ${sourceMode} data.`;
    setStatus(message, true);
    $('#editor').classList.add('hidden');
  }
}

function setStatus(message, isError = false) {
  const status = $('#loadStatus');
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  sourceModes.forEach((sourceMode) => {
    sourceMode.title = sourceMode.checked ? message : '';
  });
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
  $('#storeSelect').innerHTML = stores
    .map((store) => `<option value="${escapeHtml(store.id)}">${escapeHtml(store.name)}</option>`)
    .join('');
  $('#storeSelect').value = String(state.storeId);
  const store = stores.find((item) => item.id === state.storeId);
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
          </div>
        </div>`).join('')
    : '<p>No categories in this store.</p>';

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
  $('#drinkList').innerHTML = drinks.length
    ? drinks.map((drink) => {
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
            <button type="button" data-action="edit-drink" data-id="${escapeHtml(drink.id)}">Edit</button>
            <button type="button" data-action="delete-drink" data-id="${escapeHtml(drink.id)}">Delete</button>
          </div>
        </div>`;
      }).join('')
    : '<p>No drinks in this store.</p>';
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = Number(button.dataset.id);
  const index = Number(button.dataset.index);
  if (button.dataset.action === 'edit-category') editCategory(id);
  if (button.dataset.action === 'edit-drink') openDrinkDialog(id);
  if (button.dataset.action === 'delete-drink') deleteDrink(id);
  if (button.dataset.action === 'edit-flavor') editFlavor(index);
  if (button.dataset.action === 'delete-flavor') deleteFlavor(index);
});

function addCategory() {
  const name = prompt('Family name:');
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
  const name = prompt('Family name:', category.name);
  if (!name?.trim()) return;
  category.name = name.trim();
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
  state.editingDrinkId = drink?.id ?? null;
  $('#drinkDialogTitle').textContent = drink ? 'Edit drink' : 'Add drink';
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
  setStatus(state.sourceMode === 'local'
    ? 'Unsaved changes. Save a browser draft or download the JSON.'
    : 'Changes staged in this page. Save all to API when ready, or download the JSON.');
}

async function saveData() {
  if (state.sourceMode === 'local') {
    saveDraft();
    return;
  }

  const saveButton = $('#saveButton');
  saveButton.disabled = true;
  setStatus('Saving all changes to API…');
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      body: JSON.stringify(state.data),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const details = (await response.text()).trim().slice(0, 300);
      throw new Error(
        `Could not save API data (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`
        + (details ? ` Server response: ${details}` : ''),
      );
    }
    setStatus('Saved all changes to the API.');
  } catch (error) {
    console.error('Failed to save API data:', error);
    setStatus(error instanceof TypeError
      ? `Could not reach ${apiEndpoint}. Check that the Worker route is deployed and allows requests from this site. (${error.message})`
      : error.message || 'Unable to save data to the API.');
  } finally {
    saveButton.disabled = false;
  }
}

function saveDraft() {
  try {
    localStorage.setItem(draftStorageKey, JSON.stringify(state.data));
    setStatus('Draft saved in this browser. Download JSON to publish the changes.');
  } catch (error) {
    setStatus(`Could not save browser draft: ${error.message}`);
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
  setStatus(`Downloaded ${downloadName}. Replace the site data file or upload it to your API to publish changes.`);
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
