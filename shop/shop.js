const handoffKey = 'recipe-shopping-list';
const list = document.getElementById('shoppingList');
const status = document.getElementById('status');
const retailer = document.getElementById('retailer');

let amazonProducts = null;
let amazonProductsFailed = false;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
}

function ingredientWords(value) {
  return (value.toLowerCase().match(/[a-z0-9]+/g) || []).map((word) =>
    word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);
}

function matchingAmazonProducts(value) {
  const words = ingredientWords(value);
  const candidates = amazonProducts.filter((product) => {
    if (product.category === 'supply') return false;
    const name = ingredientWords(product.name);
    if (!name.length || name.length > words.length) return false;
    return words.some((_, index) =>
      name.every((word, offset) => words[index + offset] === word));
  });
  const longest = Math.max(0, ...candidates.map((product) => ingredientWords(product.name).length));
  return candidates.filter((product) => ingredientWords(product.name).length === longest);
}

function updateLink(row) {
  const value = row.dataset.ingredient.trim();
  const name = document.createElement('span');
  name.className = 'ingredient-name';
  name.textContent = row.dataset.ingredient;
  let message;
  let url;
  let label;
  let sponsored = false;
  if (!value) {
    message = 'No ingredient provided';
  } else if (retailer.value === 'amazon') {
    if (amazonProductsFailed) {
      message = 'Products unavailable';
    } else if (amazonProducts === null) {
      message = 'Checking for a product...';
    } else {
      const matches = matchingAmazonProducts(value);
      if (matches.length === 1) {
        url = matches[0].value;
        label = `View ${matches[0].name} on Amazon`;
        message = `View ${matches[0].name} on Amazon`;
        sponsored = true;
      } else {
        message = matches.length ? 'Multiple matches - open product picks below' : '';
      }
    }
  } else {
    const searchUrl = new URL('https://www.walmart.com/search');
    searchUrl.searchParams.set('q', value);
    url = searchUrl.href;
    label = `Search Walmart for ${value}`;
    message = 'Search Walmart';
  }
  if (url) {
    const link = document.createElement('a');
    link.className = 'ingredient-name search-link';
    link.href = url;
    link.target = '_blank';
    link.rel = sponsored ? 'sponsored noopener' : 'noopener noreferrer';
    link.setAttribute('aria-label', `${row.dataset.ingredient}: ${label}`);
    link.textContent = row.dataset.ingredient;
    row.replaceChildren(link);
  } else {
    row.replaceChildren(name);
    if (message) {
      const note = document.createElement('span');
      note.className = 'match-note';
      note.textContent = message;
      row.appendChild(note);
    }
  }
}

function addItem(value) {
  const row = document.createElement('div');
  row.className = 'shopping-item';
  row.dataset.ingredient = value;
  updateLink(row);
  list.append(row);
}

function updateLinks() {
  list.querySelectorAll('.shopping-item').forEach(updateLink);
}
retailer.addEventListener('change', updateLinks);
document.addEventListener('shop-products-loaded', (event) => {
  amazonProducts = event.detail;
  amazonProductsFailed = false;
  updateLinks();
});
document.addEventListener('shop-products-error', () => {
  amazonProducts = null;
  amazonProductsFailed = true;
  updateLinks();
});
document.getElementById('addIngredientForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.getElementById('newIngredient');
  const value = input.value.trim();
  if (!value) {
    input.setCustomValidity('Enter an ingredient.');
    input.reportValidity();
    return;
  }
  addItem(value);
  input.value = '';
  input.focus();
});
document.getElementById('newIngredient').addEventListener('input', (event) => {
  event.currentTarget.setCustomValidity('');
});

try {
  const raw = sessionStorage.getItem(handoffKey);
  if (raw !== null) {
    sessionStorage.removeItem(handoffKey);
    const handoff = JSON.parse(raw);
    if (!handoff || handoff.version !== 1 || !Array.isArray(handoff.items) ||
        handoff.items.some((item) => typeof item !== 'string')) {
      throw new Error('The shopping list has an invalid format.');
    }
    handoff.items.forEach((item) => addItem(item));
    setStatus(handoff.items.length ? 'Review your ingredient suggestions below.' : 'No TOP ingredients were found. Add an ingredient or browse the product picks below.');
  } else {
    setStatus('No recipe ingredients were provided. Add an ingredient or browse the product picks below.');
  }
} catch (error) {
  console.error('Could not load shopping list:', error);
  setStatus(`Could not load the recipe ingredients: ${error.message} You can still add an ingredient or browse the product picks below.`, true);
}
