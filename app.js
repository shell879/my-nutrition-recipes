const state = {
  activeCategory: 'All',
  query: '',
  data: null,
};

const categoryFilters = document.getElementById('categoryFilters');
const recipeGrid = document.getElementById('recipeGrid');
const searchInput = document.getElementById('searchInput');
const storeName = document.getElementById('storeName');

function normalizeData(raw) {
  if (!raw) {
    return { store: { name: 'My Nutrition Recipes' }, categories: [], drinks: [] };
  }

  const rawStores = Array.isArray(raw.stores) ? raw.stores : [];
  const store = raw.store || rawStores.find((item) => item.active !== false) || rawStores[0] || { name: 'My Nutrition Recipes' };
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
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
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error('Unable to load recipe data');

  const raw = await response.json();
  state.data = normalizeData(raw);

  storeName.textContent = state.data.store?.name || 'My Nutrition Recipes';
  renderFilters();
  renderRecipes();
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

function recipeMatchesCategory(drink) {
  const categoryValue = drink.categoryId ?? drink.category ?? 'All';
  return state.activeCategory === 'All' || getCategoryName(categoryValue) === state.activeCategory;
}

function renderRecipes() {
  const recipeList = (state.data?.drinks || []).filter((drink) => {
    const haystack = `${drink.name || ''} ${(drink.ingredients || []).map((item) => item.name || '').join(' ')}`.toLowerCase();
    const matchesQuery = haystack.includes(state.query.toLowerCase());
    return recipeMatchesCategory(drink) && matchesQuery;
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
            <div class="ingredient-group">
              <strong>Top</strong>
              ${ingredientMarkup(topIngredients)}
            </div>
            <div class="ingredient-group">
              <strong>Bottom</strong>
              ${ingredientMarkup(bottomIngredients)}
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

searchInput.addEventListener('input', (event) => {
  state.query = event.target.value.trim();
  renderRecipes();
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

loadData().catch((error) => {
  recipeGrid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
