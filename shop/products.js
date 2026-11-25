const productApiBase = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8787' : '';
const productList = document.getElementById('curated-products');
const productStatus = document.getElementById('products-status');

async function loadProductPicks() {
  try {
    const response = await fetch(`${productApiBase}/api/data/shop/products`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Request failed (HTTP ${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error('The product list is invalid.');
    const categories = data.categories === undefined ? [
      { id: 'ingredient', name: 'Ingredients' },
      { id: 'supply', name: 'Kitchen supplies' },
      { id: 'uncategorized', name: 'Uncategorized' },
    ] : data.categories;
    if (!Array.isArray(categories) || categories.some((category) =>
      !category || typeof category.id !== 'string' || typeof category.name !== 'string') ||
      new Set(categories.map((category) => category.id)).size !== categories.length) {
      throw new Error('The product categories are invalid.');
    }
    const groups = categories.map((category) => ({ category: category.id, title: category.name, items: [] }));
    const availableProducts = data.products.map((product) => {
      if (!product || typeof product.name !== 'string' || typeof product.value !== 'string') {
        throw new Error('A product is invalid.');
      }
      const group = groups.find((entry) => entry.category ===
        (product.category === undefined ? 'uncategorized' : product.category));
      if (!group) throw new Error('A product category is invalid.');
      const url = new URL(product.value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !['amazon.com', 'www.amazon.com', 'amzn.to'].includes(url.hostname)) {
        throw new Error('A product link is invalid.');
      }
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'sponsored noopener';
      link.textContent = product.name;
      item.appendChild(link);
      group.items.push(item);
      return { name: product.name, value: url.href, category: group.category };
    });
    const sections = groups.filter((group) => group.items.length).map((group) => {
      const section = document.createElement('details');
      section.className = 'product-category';
      section.open = group.category === 'ingredient' || group.category === 'supply';
      const heading = document.createElement('summary');
      heading.textContent = group.title;
      const list = document.createElement('ul');
      list.append(...group.items);
      section.append(heading);
      if (group.category === 'ingredient' || group.category === 'supply') {
        // Supply photo: https://www.pexels.com/photo/kitchen-tools-and-plate-6996301/
        const image = document.createElement('img');
        image.className = `shop-category-image shop-category-image--${group.category}`;
        image.src = group.category === 'ingredient'
          ? '/images/shop-cookie-ingredients-ai.jpg'
          : '/images/shop-baking-tools.jpg';
        image.alt = '';
        image.width = group.category === 'ingredient' ? 1200 : 800;
        image.height = group.category === 'ingredient' ? 800 : 1198;
        image.loading = 'lazy';
        section.append(image);
      }
      section.append(list);
      return section;
    });
    productList.replaceChildren(...sections);
    productStatus.textContent = sections.length ? '' : 'No product picks are available yet.';
    document.dispatchEvent(new CustomEvent('shop-products-loaded', { detail: availableProducts }));
  } catch (error) {
    console.error('Could not load product picks:', error);
    productStatus.textContent = `Could not load product picks: ${error.message}`;
    productStatus.setAttribute('aria-live', 'assertive');
    document.dispatchEvent(new CustomEvent('shop-products-error'));
  }
}

loadProductPicks();
