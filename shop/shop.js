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
  const input = row.querySelector('input');
  const search = row.querySelector('a');
  const value = input.value.trim();
  search.removeAttribute('href');
  search.removeAttribute('aria-label');
  search.setAttribute('aria-disabled', 'true');
  search.rel = 'noopener noreferrer';
  if (!value) {
    search.textContent = 'Enter an ingredient';
    return;
  }
  if (retailer.value === 'amazon') {
    if (amazonProductsFailed) {
      search.textContent = 'Amazon products unavailable';
      return;
    }
    if (amazonProducts === null) {
      search.textContent = 'Loading Amazon products...';
      return;
    }
    const matches = matchingAmazonProducts(value);
    if (matches.length !== 1) {
      search.textContent = matches.length ? 'See Amazon picks below' : 'No matching Amazon product';
      return;
    }
    search.textContent = 'Suggested Amazon product';
    search.href = matches[0].value;
    search.rel = 'sponsored noopener';
    search.removeAttribute('aria-disabled');
    search.setAttribute('aria-label', `View ${matches[0].name} on Amazon`);
    return;
  }
  const url = new URL('https://www.walmart.com/search');
  url.searchParams.set('q', value);
  search.textContent = 'Search Walmart';
  search.href = url.href;
  search.removeAttribute('aria-disabled');
  search.setAttribute('aria-label', `Search Walmart for ${value}`);
}

function addItem(value = '') {
  const row = document.createElement('div');
  row.className = 'shopping-item';
  const label = document.createElement('label');
  label.textContent = 'Ingredient';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  label.append(input);
  const search = document.createElement('a');
  search.className = 'search-link';
  search.target = '_blank';
  search.rel = 'noopener noreferrer';
  row.append(label, search);
  input.addEventListener('input', () => updateLink(row));
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
document.getElementById('addItem').addEventListener('click', () => {
  addItem();
  list.lastElementChild.querySelector('input').focus();
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
