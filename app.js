const state = {
  activeCategory: 'All',
  query: '',
  data: null,
};

const categoryFilters = document.getElementById('categoryFilters');
const recipeGrid = document.getElementById('recipeGrid');
const searchInput = document.getElementById('searchInput');
const storeName = document.getElementById('storeName');

async function loadData() {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error('Unable to load recipe data');
  state.data = await response.json();

  storeName.textContent = state.data.store?.name || 'My Nutrition Recipes';
  renderFilters();
  renderRecipes();
}

function renderFilters() {
  const categories = ['All', ...(state.data.categories || []).map((category) => category.name)];

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

function renderRecipes() {
  const recipeList = (state.data?.drinks || []).filter((drink) => {
    const matchesCategory = state.activeCategory === 'All' || drink.category === state.activeCategory;
    const haystack = `${drink.name} ${drink.ingredients.map((item) => item.name).join(' ')}`.toLowerCase();
    const matchesQuery = haystack.includes(state.query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  if (recipeList.length === 0) {
    recipeGrid.innerHTML = '<div class="empty-state">No recipes match the selected filters.</div>';
    return;
  }

  recipeGrid.innerHTML = recipeList
    .map((drink) => {
      const topIngredients = drink.ingredients.filter((item) => item.side === 'TOP');
      const bottomIngredients = drink.ingredients.filter((item) => item.side === 'BOTTOM');

      const ingredientMarkup = (ingredients) =>
        ingredients.length
          ? `<ul>${ingredients
              .map((item) => `<li>${escapeHtml(item.name)}</li>`)
              .join('')}</ul>`
          : '<ul><li>—</li></ul>';

      return `
        <article class="recipe-card">
          <h2>${escapeHtml(drink.name)}</h2>
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
