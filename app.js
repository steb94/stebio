/*
 * Extended client-side API and UI helper functions for the Steb.io
 * digital marketplace.  This script works with the extended back‑end
 * implemented in server.js and adds rich features inspired by
 * platforms like Whop.  The following capabilities are provided:
 *
 *   • Sign‑up and login with persistent tokens in localStorage.
 *   • Store creation and product management for sellers, including
 *     category assignment.  Products can be digital downloads,
 *     memberships or courses.
 *   • Marketplace search with filtering by category and sorting by
 *     rating, price or name in ascending/descending order.  Results
 *     are loaded dynamically into a product grid.
 *   • Global statistics showing counts of users, stores, products,
 *     orders and reviews.
 *   • Category statistics and trending data.  Categories are ranked by
 *     product count and order count, and trending products are
 *     determined by recent order volume.  These are displayed on the
 *     home page.
 *   • Seller analytics with total sales, total orders, top products
 *     and per‑store statistics.  Sellers see a summary of their
 *     performance on the dashboard.
 *   • Product detail retrieval, purchases, protected content access
 *     and review submission.
 *
 * All API calls go through apiRequest(), which automatically
 * prepends the appropriate /api prefix and attaches the token from
 * localStorage when present.  Error responses throw and are caught
 * in the page‑specific loaders to display user‑friendly messages.
 */

// Determine the API base URL based on environment.  All API endpoints on
// the back‑end are namespaced under "/api".  When deployed on Render the
// root URL will include the domain (e.g. https://stebio.onrender.com),
// whereas in local development we use a relative path.  We append
// "/api" here so that all client requests target the correct API
// namespace.  For example, apiRequest('/signup') will call
// https://stebio.onrender.com/api/signup in production or
// /api/signup in development.
const API_BASE = window.location.hostname.includes('onrender.com')
  ? 'https://stebio.onrender.com/api'
  : '/api';

/**
 * Generic helper for making API requests.  It automatically attaches
 * the authentication token (if present) and sets the default
 * Content‑Type header for JSON bodies.  It throws an object parsed
 * from the response body if the response has an error status.
 *
 * @param {string} path The API path beginning with a slash (e.g. '/signup').
 * @param {object} options Fetch API options (method, headers, body, etc.).
 * @returns {Promise<object>} Resolves with the parsed response JSON.
 */
async function apiRequest(path, options = {}) {
  const opts = Object.assign({ headers: {} }, options);
  // Always send JSON by default unless body is FormData
  if (!opts.headers['Content-Type'] && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem('token');
  if (token) {
    opts.headers['Authorization'] = token;
  }
  const response = await fetch(`${API_BASE}${path}`, opts);
  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = { error: 'Invalid response from server' };
  }
  if (!response.ok) {
    throw data;
  }
  return data;
}

// ----------------------------------------------
// Authentication and user management
// ----------------------------------------------

/**
 * Register a new user.  On success the authentication token and
 * user info are stored in localStorage.  Roles can be 'buyer' or
 * 'seller'.
 * @param {string} username
 * @param {string} password
 * @param {string} role 'buyer' or 'seller'
 */
async function signup(username, password, role) {
  try {
    const data = await apiRequest('/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.username);
    localStorage.setItem('role', data.user.role);
    return data;
  } catch (err) {
    return { error: err.error || 'Signup failed' };
  }
}

/**
 * Log in an existing user.  On success stores token and user info
 * in localStorage.
 * @param {string} username
 * @param {string} password
 */
async function login(username, password) {
  try {
    const data = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.username);
    localStorage.setItem('role', data.user.role);
    return data;
  } catch (err) {
    return { error: err.error || 'Login failed' };
  }
}

/**
 * Create a new store (seller only).
 * @param {string} name The store name.
 * @param {string} description Store description.
 */
async function createStore(name, description) {
  try {
    return await apiRequest('/stores', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
  } catch (err) {
    return { error: err.error || 'Failed to create store' };
  }
}

/**
 * Fetch stores owned by the current seller.
 */
function getUserStores() {
  return apiRequest('/user/stores');
}

/**
 * Fetch a list of all stores in the marketplace.
 */
function getStores() {
  return apiRequest('/stores');
}

/**
 * Fetch details for a single store along with its products.
 * @param {string} storeId
 */
function getStore(storeId) {
  return apiRequest(`/stores/${storeId}`);
}

/**
 * Fetch products belonging to a store.
 * @param {string} storeId
 */
function getStoreProducts(storeId) {
  return apiRequest(`/stores/${storeId}/products`);
}

/**
 * Create a new product in a store.  Requires seller role.  The
 * `product` object must include `type`, `name`, `description`,
 * `price` and `category` and may include `fileUrl`,
 * `membershipBenefits` and `courseContent`.
 * @param {string} storeId
 * @param {object} product
 */
async function createProduct(storeId, product) {
  try {
    return await apiRequest(`/stores/${storeId}/products`, {
      method: 'POST',
      body: JSON.stringify(product)
    });
  } catch (err) {
    return { error: err.error || 'Failed to create product' };
  }
}

/**
 * Fetch products with optional filters.  The options object can
 * include:
 *   query    – search string
 *   category – category name
 *   sort     – 'rating', 'price' or 'name'
 *   order    – 'asc' or 'desc'
 *   limit    – maximum number of products to return
 *
 * Results are always returned as an array.
 * @param {object} options
 */
function getProducts(options = {}) {
  let url = '/products';
  const params = [];
  if (options.query) {
    params.push(`q=${encodeURIComponent(options.query)}`);
  }
  if (options.category) {
    params.push(`category=${encodeURIComponent(options.category)}`);
  }
  if (options.sort) {
    params.push(`sort=${encodeURIComponent(options.sort)}`);
  }
  if (options.order) {
    params.push(`order=${encodeURIComponent(options.order)}`);
  }
  if (options.limit) {
    params.push(`limit=${encodeURIComponent(options.limit)}`);
  }
  if (params.length > 0) {
    url += '?' + params.join('&');
  }
  return apiRequest(url);
}

/**
 * Fetch a single product by ID.
 * @param {string} productId
 */
function getProduct(productId) {
  return apiRequest(`/products/${productId}`);
}

/**
 * Purchase a product.  Requires that the user is logged in.
 * @param {string} productId
 */
function purchaseProduct(productId) {
  return apiRequest('/purchase', {
    method: 'POST',
    body: JSON.stringify({ productId })
  });
}

/**
 * Fetch purchases for the logged‑in user.
 */
function getPurchases() {
  return apiRequest('/user/purchases');
}

/**
 * Fetch protected content for a purchased product.  Returns different
 * fields depending on the product type.
 * @param {string} productId
 */
function getProductContent(productId) {
  return apiRequest(`/products/${productId}/content`);
}

/**
 * Fetch reviews for a product.
 * @param {string} productId
 */
function getReviews(productId) {
  return apiRequest(`/products/${productId}/reviews`);
}

/**
 * Submit a review for a product.  Requires that the user purchased the
 * product.  Rating must be 1–5.  Returns updated average rating.
 * @param {string} productId
 * @param {number} rating 1–5
 * @param {string} comment Optional comment
 */
function submitReview(productId, rating, comment) {
  return apiRequest(`/products/${productId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment })
  });
}

/**
 * Fetch global site statistics (users, stores, products, orders and reviews).
 */
function getStats() {
  return apiRequest('/stats');
}

/**
 * Fetch category statistics.  Returns an array of objects with
 * `category`, `productCount` and `orderCount`, sorted descending by
 * orderCount.
 */
function getCategories() {
  return apiRequest('/categories');
}

/**
 * Fetch trending products and categories.  Optionally specify a
 * time window in days.  Returns an object with `products` and
 * `categories` arrays.
 * @param {number|null} days Number of days to look back or null for all time.
 */
function getTrending(days = null) {
  let url = '/trending';
  if (days) {
    url += `?days=${days}`;
  }
  return apiRequest(url);
}

/**
 * Fetch analytics for the logged‑in seller.  Returns an object with
 * `totalSales`, `totalOrders`, `topProducts` (array of objects with
 * id, name, count, revenue) and `storeStats` (array of objects with
 * storeId, storeName, totalSales, totalOrders).
 */
function getSellerAnalytics() {
  return apiRequest('/seller/analytics');
}

// --------------------------------------------------
// Page loaders
// --------------------------------------------------

/**
 * Populate the statistics section on the home page.
 */
async function loadStats() {
  try {
    const stats = await getStats();
    const statsDiv = document.getElementById('stats');
    if (statsDiv) {
      statsDiv.innerHTML = `<p><strong>Users:</strong> ${stats.users} | <strong>Stores:</strong> ${stats.stores} | <strong>Products:</strong> ${stats.products} | <strong>Orders:</strong> ${stats.orders} | <strong>Reviews:</strong> ${stats.reviews}</p>`;
    }
  } catch (err) {
    // quietly ignore stats errors
  }
}

/**
 * Load products into the grid on the home page.  Accepts an options
 * object that mirrors the parameters accepted by getProducts().
 * @param {object} options
 */
async function loadProducts(options = {}) {
  try {
    const products = await getProducts(options);
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (products.length === 0) {
      grid.innerHTML = '<p>No products found.</p>';
      return;
    }
    products.forEach(prod => {
      const card = document.createElement('div');
      card.classList.add('product-card');
      const ratingText = prod.rating ? `${prod.rating}/5` : 'No ratings';
      card.innerHTML = `
        <h3>${prod.name}</h3>
        <p><em>${prod.type}</em> | <strong>${prod.category}</strong></p>
        <p>${prod.description.substring(0, 100)}...</p>
        <p><strong>Price:</strong> $${prod.price}</p>
        <p><strong>Rating:</strong> ${ratingText}</p>
        <a class="btn" href="product.html?id=${prod.id}">View</a>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    const grid = document.getElementById('productsGrid');
    if (grid) {
      grid.innerHTML = `<p>Error loading products: ${err.error || err.message}</p>`;
    }
  }
}

/**
 * Load category statistics and populate the category select for filtering
 * as well as the trending categories section on the home page.
 */
async function loadCategories() {
  try {
    const categories = await getCategories();
    const select = document.getElementById('categorySelect');
    const trendingDiv = document.getElementById('trendingCategories');
    if (select) {
      select.innerHTML = '<option value="">All categories</option>';
    }
    if (trendingDiv) {
      trendingDiv.innerHTML = '';
    }
    categories.forEach(cat => {
      // populate filter select
      if (select) {
        const opt = document.createElement('option');
        opt.value = cat.category;
        opt.textContent = `${cat.category} (${cat.orderCount})`;
        select.appendChild(opt);
      }
      // populate trending categories list
      if (trendingDiv) {
        const span = document.createElement('span');
        span.classList.add('category-item');
        span.textContent = `${cat.category} (${cat.orderCount})`;
        trendingDiv.appendChild(span);
      }
    });
  } catch (err) {
    const trendingDiv = document.getElementById('trendingCategories');
    if (trendingDiv) {
      trendingDiv.innerHTML = `<p>Error loading categories: ${err.error || err.message}</p>`;
    }
  }
}

/**
 * Load trending products and display them in a dedicated section on the
 * home page.  Optionally specify a number of days for the lookback
 * period.
 * @param {number|null} days
 */
async function loadTrending(days = null) {
  try {
    const data = await getTrending(days);
    const products = data.products || [];
    const prodDiv = document.getElementById('trendingProducts');
    // trending categories are already rendered via loadCategories(), so
    // here we only handle trending products
    if (prodDiv) {
      prodDiv.innerHTML = '';
      const top = products.slice(0, 6); // show top 6 trending
      top.forEach(prod => {
        const card = document.createElement('div');
        card.classList.add('trending-card');
        const ratingText = prod.rating ? `${prod.rating}/5` : 'No ratings';
        card.innerHTML = `
          <h4>${prod.name}</h4>
          <p><em>${prod.category}</em></p>
          <p><strong>Price:</strong> $${prod.price}</p>
          <p><strong>Orders:</strong> ${prod.orderCount}</p>
          <p><strong>Rating:</strong> ${ratingText}</p>
          <a class="btn" href="product.html?id=${prod.id}">View</a>
        `;
        prodDiv.appendChild(card);
      });
    }
  } catch (err) {
    const prodDiv = document.getElementById('trendingProducts');
    if (prodDiv) {
      prodDiv.innerHTML = `<p>Error loading trending products: ${err.error || err.message}</p>`;
    }
  }
}

/**
 * Load and display seller analytics on the dashboard.  The analytics
 * section must exist in the HTML (id="analyticsSection").  It will
 * display total sales, total orders, top products and per‑store stats.
 */
async function loadSellerAnalytics() {
  try {
    const data = await getSellerAnalytics();
    const section = document.getElementById('analyticsSection');
    if (!section) return;
    section.innerHTML = '';
    const { totalSales, totalOrders, topProducts, storeStats } = data;
    const summary = document.createElement('div');
    summary.innerHTML = `<p><strong>Total Sales:</strong> $${totalSales.toFixed(2)} | <strong>Total Orders:</strong> ${totalOrders}</p>`;
    section.appendChild(summary);
    // Top products
    if (topProducts && topProducts.length > 0) {
      const topHeading = document.createElement('h4');
      topHeading.textContent = 'Top Products';
      section.appendChild(topHeading);
      const ul = document.createElement('ul');
      topProducts.forEach(tp => {
        const li = document.createElement('li');
        li.textContent = `${tp.name}: ${tp.count} orders, $${tp.revenue.toFixed(2)}`;
        ul.appendChild(li);
      });
      section.appendChild(ul);
    }
    // Store stats table
    if (storeStats && storeStats.length > 0) {
      const stHeading = document.createElement('h4');
      stHeading.textContent = 'Store Statistics';
      section.appendChild(stHeading);
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Store</th><th>Total Sales</th><th>Total Orders</th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      storeStats.forEach(stat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${stat.storeName}</td><td>$${stat.totalSales.toFixed(2)}</td><td>${stat.totalOrders}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      section.appendChild(table);
    }
    section.style.display = 'block';
  } catch (err) {
    const section = document.getElementById('analyticsSection');
    if (section) {
      section.innerHTML = `<p>Error loading analytics: ${err.error || err.message}</p>`;
      section.style.display = 'block';
    }
  }
}
// End of app.js
