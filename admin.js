const state = {
  data: null,
  storeId: null,
  editingDrinkId: null,
  sourceMode: 'local',
};

const defaultFlavorProfiles = [
  'Apple', 'Banana', 'Blackberry', 'Blueberry', 'Blue Raspberry', 'Cherry', 'Coconut',
  'Cranberry', 'Grape', 'Lemonade', 'Lime', 'Limeade', 'Mango', 'Orange', 'Passion Fruit',
  'Peach', 'Pineapple', 'Pomegranate', 'Raspberry', 'Strawberry', 'Watermelon',
];
const $ = (selector) => document.querySelector(selector);
const sourceMode = $('#sourceMode');
const status = $('#status');

localStorage.setItem('mnr-admin-source', state.sourceMode);
sourceMode.value = state.sourceMode;
$('#resetDraftButton').classList.toggle('hidden', state.sourceMode !== 'local');
$('#saveButton').classList.toggle('hidden', state.sourceMode !== 'local');

sourceMode.addEventListener('change', () => {
  state.sourceMode = sourceMode.value;
  localStorage.setItem('mnr-admin-source', state.sourceMode);
  $('#resetDraftButton').classList.toggle('hidden', state.sourceMode !== 'local');
  $('#saveButton').classList.toggle('hidden', state.sourceMode !== 'local');
});

$('#loadButton').addEventListener('click', loadData);
$('#resetDraftButton').addEventListener('click', () => {
  localStorage.removeItem('mnr-admin-local-draft');
  loadData();
});
$('#storeSelect').addEventListener('change', () => {
  state.storeId = Number($('#storeSelect').value);
  render();
});
$('#addCategoryButton').addEventListener('click', addCategory);
$('#addDrinkButton').addEventListener('click', () => openDrinkDialog());
$('#addFlavorButton').addEventListener('click', addFlavor);
$('#saveButton').addEventListener('click', saveDraft);
$('#downloadButton').addEventListener('click', downloadData);
$('#cancelDrinkButton').addEventListener('click', () => $('#drinkDialog').close());
$('#drinkForm').addEventListener('submit', saveDrink);

async function loadData() {
  state.sourceMode = sourceMode.value;
  localStorage.setItem('mnr-admin-source', state.sourceMode);
  status.classList.remove('error');
  status.textContent = 'Loading data…';

  try {
    let response;
    if (state.sourceMode === 'local') {
      const draft = localStorage.getItem('mnr-admin-local-draft');
      if (draft) {
        state.data = JSON.parse(draft);
        validateData(state.data);
        state.storeId = state.data.stores.find((store) => store.active !== false)?.id ?? state.data.stores[0]?.id ?? null;
        $('#editor').classList.remove('hidden');
        render();
        status.textContent = 'Loaded saved browser draft. Discard it to reload data.json.';
        return;
      }
      response = await fetch('./data.json');
    } else {
      response = await fetch('/api/data');
    }

    if (!response.ok) {
      const details = (await response.text()).trim().slice(0, 300);
      throw new Error(
        `Could not load ${state.sourceMode} data (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`
        + (details ? ` Server response: ${details}` : ''),
      );
    }
    const data = await response.json();
    validateData(data);
    state.data = data;
    state.storeId = data.stores.find((store) => store.active !== false)?.id ?? data.stores[0]?.id ?? null;
    $('#editor').classList.remove('hidden');
    render();
    status.textContent = `Loaded ${state.sourceMode === 'local' ? 'site' : 'API'} data.`;
  } catch (error) {
    console.error(`Failed to load ${state.sourceMode} data:`, error);
    status.classList.add('error');
    status.textContent = state.sourceMode === 'api' && error instanceof TypeError
      ? `Could not reach /api/data. Check that the Worker route is deployed and allows requests from this site. (${error.message})`
      : error.message || 'Unable to load data.';
    $('#editor').classList.add('hidden');
  }
}

function validateData(data) {
  if (!data || !Array.isArray(data.stores) || !Array.isArray(data.categories) || !Array.isArray(data.drinkRecipes)) {
    throw new Error('The selected source did not return recipe data in the expected format.');
  }
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

  const flavors = storeFlavorProfiles();
  $('#flavorList').innerHTML = flavors.length
    ? flavors.map((flavor, index) => `
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
        return `<div class="item-row">
          <span><strong>${escapeHtml(drink.name)}</strong><br><small>${escapeHtml(category?.name || 'Uncategorized')}</small></span>
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

function addFlavor() {
  const flavor = prompt('Flavor profile name:')?.trim();
  if (!flavor) return;
  if (storeFlavorProfiles().some((item) => item.toLocaleLowerCase() === flavor.toLocaleLowerCase())) {
    status.textContent = 'That flavor profile already exists for this store.';
    return;
  }
  storeFlavorProfiles().push(flavor);
  render();
  markChanged();
}

function editFlavor(index) {
  const flavors = storeFlavorProfiles();
  const current = flavors[index];
  if (current == null) return;
  const flavor = prompt('Flavor profile name:', current)?.trim();
  if (!flavor) return;
  if (flavors.some((item, itemIndex) => itemIndex !== index && item.toLocaleLowerCase() === flavor.toLocaleLowerCase())) {
    status.textContent = 'That flavor profile already exists for this store.';
    return;
  }
  flavors[index] = flavor;
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
  $('#drinkIngredients').value = (drink?.ingredients || [])
    .map((ingredient) => `${normalizeSide(ingredient.side)}|${ingredient.name}|${ingredient.cost || 0}`)
    .join('\n');
  $('#formError').textContent = '';
  $('#drinkDialog').showModal();
}

function saveDrink(event) {
  event.preventDefault();
  const name = $('#drinkName').value.trim();
  const categoryId = Number($('#drinkCategory').value);
  const ingredientLines = $('#drinkIngredients').value.split(/\r?\n/).filter((line) => line.trim());
  const ingredients = [];

  for (const [index, line] of ingredientLines.entries()) {
    const [side, ingredientName, costText = '0'] = line.split('|').map((part) => part.trim());
    const cost = Number(costText);
    if (!['TOP', 'BOTTOM'].includes(side?.toUpperCase()) || !ingredientName || !Number.isFinite(cost) || cost < 0) {
      $('#formError').textContent = `Ingredient line ${index + 1} must be TOP|name|cost or BOTTOM|name|cost.`;
      return;
    }
    const current = state.editingDrinkId == null ? null : state.data.drinkRecipes.find((drink) => drink.id === state.editingDrinkId);
    const existing = current?.ingredients?.[index];
    ingredients.push({
      id: existing?.id ?? nextId(ingredients),
      name: ingredientName,
      cost,
      side: side.toUpperCase(),
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
  status.textContent = state.sourceMode === 'local'
    ? 'Unsaved changes. Save a browser draft or download the JSON.'
    : 'Changes are not saved to the API. Download the JSON to keep them.';
}

function saveDraft() {
  try {
    localStorage.setItem('mnr-admin-local-draft', JSON.stringify(state.data));
    status.textContent = 'Draft saved in this browser. Download JSON to publish the changes.';
  } catch (error) {
    status.textContent = `Could not save browser draft: ${error.message}`;
  }
}

function downloadData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'data.json';
  link.click();
  URL.revokeObjectURL(url);
  status.textContent = 'Downloaded data.json. Replace the site data file or upload it to your API to publish changes.';
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
