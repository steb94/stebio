// Client-side logic for Steb.io marketplace

// Determine API base URL. If running on Render (production), point to the backend
// domain; otherwise use relative /api for local development. This allows the
// static frontend hosted at stebio-frontend.onrender.com to call the backend
// service hosted at stebio.onrender.com. When served locally (e.g. via
// `node server.js`), the API will be available at the same origin.
const API_BASE = window.location.hostname.includes('onrender.com')
  ? 'https://stebio.onrender.com/api'
  : '/api';

// DOM elements
const statProductsEl = document.getElementById('statProducts');
const statStoresEl = document.getElementById('statStores');
const statOrdersEl = document.getElementById('statOrders');
const productGrid = document.getElementById('productGrid');
const categoryBar = document.getElementById('categoryBar');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadMoreContainer = document.getElementById('loadMoreContainer');

// State
let allProducts = [];
let displayedCount = 0;
const PAGE_SIZE = 24;
let currentType = 'All';
let currentSort = 'newest';

// Fetch stats and update cards
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    statProductsEl.textContent = data.totalProducts;
    statStoresEl.textContent = data.totalStores;
    statOrdersEl.textContent = data.totalOrders;
  } catch (err) {
    console.error('Error fetching stats', err);
  }
}

// Fetch products by type and sort
async function fetchProducts(type = 'All', sort = 'newest') {
  currentType = type;
  currentSort = sort;
  try {
    const url = new URL(`${API_BASE}/products`);
    if (type && type !== 'All') {
      url.searchParams.set('type', type);
    } else {
      url.searchParams.set('type', 'All');
    }
    if (sort) url.searchParams.set('sort', sort);
    const res = await fetch(url);
    const data = await res.json();
    allProducts = data;
    displayedCount = 0;
    renderProducts();
  } catch (err) {
    console.error('Error fetching products', err);
  }
}

// Search products
async function searchProducts(query) {
  try {
    const url = new URL(`${API_BASE}/products/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('sort', currentSort);
    const res = await fetch(url);
    const data = await res.json();
    allProducts = data;
    displayedCount = 0;
    renderProducts();
  } catch (err) {
    console.error('Error searching products', err);
  }
}

// Render products into the grid with pagination
function renderProducts() {
  // Clear grid
  productGrid.innerHTML = '';
  // Determine slice of products to show
  const slice = allProducts.slice(0, PAGE_SIZE);
  displayedCount = slice.length;
  slice.forEach((p) => {
    const card = document.createElement('div');
    card.classList.add('product-card');
    // Product image (use provided image if available)
    const img = document.createElement('img');
    // Determine the image source. If p.image is defined and not a full URL or data URI, convert it to a GitHub raw URL.
    let imgSrc = p.image && p.image.trim() !== '' ? p.image : null;
    if (imgSrc && !/^https?:\/\//.test(imgSrc) && !/^data:/.test(imgSrc)) {
      imgSrc = `https://raw.githubusercontent.com/steb94/stebio/backend/server--.js/${imgSrc}`;
    }
    img.src = imgSrc || 'https://via.placeholder.com/300x150?text=Product';
    img.alt = p.title;
    // Title
    const title = document.createElement('h4');
    title.textContent = p.title;
    // Description (truncate)
    const desc = document.createElement('p');
    const descText = p.description.length > 80 ? p.description.slice(0, 77) + '...' : p.description;
    desc.textContent = descText;
    // Price
    const price = document.createElement('div');
    price.classList.add('price');
    price.textContent = `$${p.price.toFixed(2)}`;
    // Type
    const typeEl = document.createElement('div');
    typeEl.classList.add('type');
    typeEl.textContent = p.type;
    // Button
    const btn = document.createElement('a');
    // Link to product detail page with id param
    btn.href = `product.html?id=${p.id}`;
    btn.classList.add('button');
    btn.textContent = 'View';
    // Append
    card.appendChild(img);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(price);
    card.appendChild(typeEl);
    card.appendChild(btn);
    productGrid.appendChild(card);
  });
  // Show or hide load more
  if (allProducts.length > displayedCount) {
    loadMoreContainer.hidden = false;
  } else {
    loadMoreContainer.hidden = true;
  }
}

// Load more handler
function loadMore() {
  const nextSlice = allProducts.slice(displayedCount, displayedCount + PAGE_SIZE);
  displayedCount += nextSlice.length;
  nextSlice.forEach((p) => {
    const card = document.createElement('div');
    card.classList.add('product-card');
    const img = document.createElement('img');
    let imgSrc = p.image && p.image.trim() !== '' ? p.image : null;
    if (imgSrc && !/^https?:\/\//.test(imgSrc) && !/^data:/.test(imgSrc)) {
      imgSrc = `https://raw.githubusercontent.com/steb94/stebio/backend/server--.js/${imgSrc}`;
    }
    img.src = imgSrc || 'https://via.placeholder.com/300x150?text=Product';
    img.alt = p.title;
    const title = document.createElement('h4');
    title.textContent = p.title;
    const desc = document.createElement('p');
    const descText = p.description.length > 80 ? p.description.slice(0, 77) + '...' : p.description;
    desc.textContent = descText;
    const price = document.createElement('div');
    price.classList.add('price');
    price.textContent = `$${p.price.toFixed(2)}`;
    const typeEl = document.createElement('div');
    typeEl.classList.add('type');
    typeEl.textContent = p.type;
    const btn = document.createElement('a');
    btn.href = `product.html?id=${p.id}`;
    btn.classList.add('button');
    btn.textContent = 'View';
    card.appendChild(img);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(price);
    card.appendChild(typeEl);
    card.appendChild(btn);
    productGrid.appendChild(card);
  });
  if (displayedCount >= allProducts.length) {
    loadMoreContainer.hidden = true;
  }
}

// Event listeners
// Category click
categoryBar.addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') {
    const type = e.target.getAttribute('data-type');
    // Set active state
    Array.from(categoryBar.children).forEach((btn) => btn.classList.remove('active'));
    e.target.classList.add('active');
    fetchProducts(type, currentSort);
  }
});

// Sorting change
sortSelect.addEventListener('change', (e) => {
  const sort = e.target.value;
  currentSort = sort;
  // If there's a search query, re-search; else fetch products with current type
  const q = searchInput.value.trim();
  if (q) {
    searchProducts(q);
  } else {
    fetchProducts(currentType, sort);
  }
});

// Search button click
searchBtn.addEventListener('click', () => {
  const q = searchInput.value.trim();
  if (q) {
    searchProducts(q);
  } else {
    // If empty search, reload products list
    fetchProducts(currentType, currentSort);
  }
});

// Enter key on search input triggers search
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchBtn.click();
  }
});

// Load more click
loadMoreBtn.addEventListener('click', loadMore);

// Init
fetchStats();
fetchProducts('All', 'newest');