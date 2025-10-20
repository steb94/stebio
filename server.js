/*
 * Steb.io Extended Marketplace Server (no external dependencies)
 *
 * This server implements a full‑featured digital marketplace similar to Whop.
 * It exposes a JSON API under the `/api` prefix and serves a set of static
 * HTML/JS/CSS files for the front‑end.  Key capabilities include:
 *
 *   • User registration and login with roles (buyer, seller).
 *   • Store creation and management for sellers.
 *   • Product management with multiple types: digital downloads, memberships,
 *     and courses.  Sellers assign each product a category to improve
 *     discovery.
 *   • Secure purchase flow.  Purchases are stored and tracked, and
 *     authenticated buyers can download digital files, view membership
 *     benefits, or access course content after purchase.
 *   • Ratings and reviews.  Buyers can leave one review per product they
 *     purchased.  Average ratings are computed on the fly.
 *   • Marketplace search and filtering by category.  Buyers can search
 *     products by keyword, filter by category, and sort by rating, price
 *     or name.
 *   • Trending products and categories.  The server calculates trending
 *     products based on order volume and trending categories based on the
 *     number of products sold.  These are exposed via `/api/trending` and
 *     `/api/categories`.
 *   • Seller analytics.  Sellers can view aggregated statistics about their
 *     stores, including total sales per product, number of orders, and
 *     revenue.  This is exposed via `/api/seller/analytics`.
 *   • Global statistics for the marketplace, such as total users, stores,
 *     products, orders, and reviews via `/api/stats`.
 *
 * The server relies only on built‑in Node.js modules (http, fs, path,
 * crypto, and url) and persists all data to JSON files under the `data`
 * directory.  In production you should replace this with a real database
 * and add proper authentication, password hashing, and CSRF protection.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { URL } = require('url');

// -----------------------------------------------------------------------------
// Data persistence helpers
// -----------------------------------------------------------------------------
const DATA_DIR      = path.join(__dirname, 'data');
const USERS_FILE    = path.join(DATA_DIR, 'users.json');
const STORES_FILE   = path.join(DATA_DIR, 'stores.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE   = path.join(DATA_DIR, 'orders.json');
const REVIEWS_FILE  = path.join(DATA_DIR, 'reviews.json');

/**
 * Ensure the data directory and all JSON files exist.  If a file does not
 * exist, it is created with an empty array (`[]`).
 */
function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
  const files = [USERS_FILE, STORES_FILE, PRODUCTS_FILE, ORDERS_FILE, REVIEWS_FILE];
  files.forEach(f => {
    if (!fs.existsSync(f)) {
      fs.writeFileSync(f, '[]');
    }
  });
}

/**
 * Load a JSON file.  If parsing fails, return an empty array to avoid
 * breaking the API.
 * @param {string} filePath
 * @returns {Array|Object}
 */
function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return [];
  }
}

/**
 * Write a value to a JSON file with pretty formatting.
 * @param {string} filePath
 * @param {any} data
 */
function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------
/**
 * Send a JSON response with a given status code.
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {any} data
 */
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

/**
 * Send a text or HTML response with a given status code.
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {string} text
 * @param {string} [contentType]
 */
function sendText(res, status, text, contentType = 'text/plain') {
  res.writeHead(status, { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

/**
 * Serve a static file from disk.  If the file does not exist or cannot be
 * read, send a 404.  Otherwise set the appropriate MIME type based on
 * extension and send the contents.
 * @param {http.ServerResponse} res
 * @param {string} filePath
 */
function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length });
    res.end(data);
  });
}

/**
 * Parse the request body as JSON.  Returns an empty object if the body is
 * empty.  Rejects if JSON parsing fails.
 * @param {http.IncomingMessage} req
 * @returns {Promise<Object>}
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
  let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
      } else {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (err) {
          reject(new Error('Invalid JSON'));
        }
      }
    });
  });
}

/**
 * Authenticate the request.  Expects a token in the Authorization header.
 * Returns the corresponding user object or null.
 * @param {http.IncomingMessage} req
 * @returns {Object|null}
 */
function authenticate(req) {
  const token = req.headers['authorization'] || '';
  if (!token) return null;
  const users = loadJson(USERS_FILE);
  return users.find(u => u.token === token) || null;
}

/**
 * Utility to compute unique categories across products.  Each product has a
 * `category` property (string).  The result is an array of objects with
 * `{ category, productCount, orderCount }` sorted by orderCount descending.
 */
function computeCategoryStats() {
  const products = loadJson(PRODUCTS_FILE);
  const orders   = loadJson(ORDERS_FILE);
  const categoryMap = {};
  products.forEach(p => {
    if (!categoryMap[p.category]) {
      categoryMap[p.category] = { productCount: 0, orderCount: 0 };
    }
    categoryMap[p.category].productCount += 1;
  });
  orders.forEach(o => {
    const prod = products.find(p => p.id === o.productId);
    if (prod) {
      categoryMap[prod.category].orderCount += 1;
    }
  });
  const entries = Object.entries(categoryMap).map(([category, stats]) => ({ category, ...stats }));
  entries.sort((a, b) => b.orderCount - a.orderCount);
  return entries;
}

/**
 * Compute trending products.  Trending products are those with the highest
 * order counts in a recent timeframe (e.g. last 30 days) or overall if no
 * timeframe is supplied.  Returns an array of products sorted by order count
 * descending.  Each product object is augmented with `orderCount`.
 * @param {number|null} days Time window in days or null for all time
 */
function computeTrendingProducts(days = null) {
  const products = loadJson(PRODUCTS_FILE);
  const orders   = loadJson(ORDERS_FILE);
  const now = new Date();
  // Build a count map productId -> count
  const counts = {};
  orders.forEach(o => {
    if (days !== null) {
      const orderDate = new Date(o.date);
      const ageMs = now - orderDate;
      if (ageMs > days * 86400000) return;
    }
    counts[o.productId] = (counts[o.productId] || 0) + 1;
  });
  // Attach counts to products
  const prodsWithCounts = products.map(p => ({ ...p, orderCount: counts[p.id] || 0 }));
  prodsWithCounts.sort((a, b) => b.orderCount - a.orderCount);
  return prodsWithCounts;
}

/**
 * Compute seller analytics for a given user.  Returns an object with
 * `totalSales`, `totalOrders`, `topProducts` and `storeStats`.  `storeStats`
 * is an array with stats per store: { storeId, storeName, totalSales,
 * totalOrders }.
 * @param {Object} user
 */
function computeSellerAnalytics(user) {
  const orders   = loadJson(ORDERS_FILE);
  const products = loadJson(PRODUCTS_FILE);
  const stores   = loadJson(STORES_FILE).filter(s => s.ownerId === user.id);
  let totalSales = 0;
  let totalOrders= 0;
  const prodSales = {}; // productId -> { count, revenue }
  stores.forEach(store => {
    store.productIds.forEach(pid => {
      prodSales[pid] = { count: 0, revenue: 0 };
    });
  });
  orders.forEach(o => {
    if (!prodSales[o.productId]) return;
    const prod = products.find(p => p.id === o.productId);
    if (!prod) return;
    prodSales[o.productId].count += 1;
    prodSales[o.productId].revenue += prod.price;
    totalSales += prod.price;
    totalOrders += 1;
  });
  const topProducts = Object.entries(prodSales).map(([pid, stats]) => {
    const prod = products.find(p => p.id === pid);
    return {
      id: pid,
      name: prod ? prod.name : 'Unknown',
      count: stats.count,
      revenue: stats.revenue
    };
  }).sort((a, b) => b.count - a.count);
  const storeStats = stores.map(store => {
    let ordersCount = 0;
    let revenue = 0;
    store.productIds.forEach(pid => {
      ordersCount += prodSales[pid] ? prodSales[pid].count : 0;
      revenue     += prodSales[pid] ? prodSales[pid].revenue : 0;
    });
    return { storeId: store.id, storeName: store.name, totalOrders: ordersCount, totalSales: revenue };
  });
  return { totalSales, totalOrders, topProducts, storeStats };
}

// -----------------------------------------------------------------------------
// API handlers
// -----------------------------------------------------------------------------
const handlers = {

  // POST /signup
  async signup(req, res) {
    const body = await parseBody(req).catch(err => {
      sendJson(res, 400, { error: err.message });
    });
    if (!body) return;
    const { username, password, role } = body;
    if (!username || !password) {
      return sendJson(res, 400, { error: 'Username and password are required' });
    }
    const users = loadJson(USERS_FILE);
    if (users.some(u => u.username === username)) {
      return sendJson(res, 409, { error: 'Username already exists' });
    }
    const newUser = {
      id: randomUUID(),
      username,
      password,
      role: role === 'seller' ? 'seller' : 'buyer',
      token: randomUUID(),
      purchases: [],
      storeIds: []
    };
    users.push(newUser);
    saveJson(USERS_FILE, users);
    return sendJson(res, 201, {
      token: newUser.token,
      user: { id: newUser.id, username: newUser.username, role: newUser.role }
    });
  },

  // POST /login
  async login(req, res) {
    const body = await parseBody(req).catch(err => {
      sendJson(res, 400, { error: err.message });
    });
    if (!body) return;
    const { username, password } = body;
    if (!username || !password) {
      return sendJson(res, 400, { error: 'Username and password are required' });
    }
    const users = loadJson(USERS_FILE);
    const user  = users.find(u => u.username === username && u.password === password);
    if (!user) {
      return sendJson(res, 401, { error: 'Invalid credentials' });
    }
    return sendJson(res, 200, {
      token: user.token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  },

  // GET /user/purchases
  userPurchases(req, res, user) {
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    const purchases = user.purchases;
    const products = loadJson(PRODUCTS_FILE);
    const result = purchases.map(p => {
      const prod = products.find(pr => pr.id === p.productId);
      return prod ? { ...prod, purchaseDate: p.date } : null;
    }).filter(Boolean);
    return sendJson(res, 200, result);
  },

  // GET /user/stores
  userStores(req, res, user) {
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    if (user.role !== 'seller') {
      return sendJson(res, 403, { error: 'Only sellers can view their stores' });
    }
    const stores = loadJson(STORES_FILE).filter(s => s.ownerId === user.id);
    return sendJson(res, 200, stores);
  },

  // POST /stores
  async createStore(req, res, user) {
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    if (user.role !== 'seller') {
      return sendJson(res, 403, { error: 'Only sellers can create stores' });
    }
    const body = await parseBody(req).catch(err => {
      sendJson(res, 400, { error: err.message });
    });
    if (!body) return;
    const { name, description } = body;
    if (!name) {
      return sendJson(res, 400, { error: 'Store name is required' });
    }
    const stores   = loadJson(STORES_FILE);
    const newStore = {
      id: randomUUID(),
      name,
      description: description || '',
      ownerId: user.id,
      productIds: []
    };
    stores.push(newStore);
    saveJson(STORES_FILE, stores);
    // update user's storeIds
    const users = loadJson(USERS_FILE);
    const u     = users.find(u => u.id === user.id);
    if (u) {
      u.storeIds.push(newStore.id);
      saveJson(USERS_FILE, users);
    }
    return sendJson(res, 201, newStore);
  },

  // GET /stores
  listStores(req, res) {
    const stores = loadJson(STORES_FILE);
    return sendJson(res, 200, stores);
  },

  // GET /stores/:storeId
  async getStore(req, res, user, params) {
    const storeId = params[0];
    const stores  = loadJson(STORES_FILE);
    const store   = stores.find(s => s.id === storeId);
    if (!store) {
      return sendJson(res, 404, { error: 'Store not found' });
    }
    const products = loadJson(PRODUCTS_FILE).filter(p => p.storeId === storeId);
    return sendJson(res, 200, { ...store, products });
  },

  // GET /stores/:storeId/products
  async listStoreProducts(req, res, user, params) {
    const storeId = params[0];
    const products = loadJson(PRODUCTS_FILE).filter(p => p.storeId === storeId);
    return sendJson(res, 200, products);
  },

  // POST /stores/:storeId/products
  async createProduct(req, res, user, params) {
    const storeId = params[0];
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    if (user.role !== 'seller') {
      return sendJson(res, 403, { error: 'Only sellers can create products' });
    }
    const stores = loadJson(STORES_FILE);
    const store  = stores.find(s => s.id === storeId);
    if (!store) {
      return sendJson(res, 404, { error: 'Store not found' });
    }
    if (store.ownerId !== user.id) {
      return sendJson(res, 403, { error: 'Not authorized to add products to this store' });
    }
    const body = await parseBody(req).catch(err => {
      sendJson(res, 400, { error: err.message });
    });
    if (!body) return;
    const { type, name, description, price, category, fileUrl, membershipBenefits, courseContent } = body;
    if (!type || !name || price === undefined || !category) {
      return sendJson(res, 400, { error: 'type, name, price and category are required' });
    }
    const products = loadJson(PRODUCTS_FILE);
    const newProduct = {
      id: randomUUID(),
      storeId,
      type,
      name,
      description: description || '',
      price: Number(price),
      category,
      fileUrl: fileUrl || '',
      membershipBenefits: membershipBenefits || '',
      courseContent: Array.isArray(courseContent) ? courseContent : [],
      createdAt: new Date().toISOString(),
      rating: 0
    };
    products.push(newProduct);
    saveJson(PRODUCTS_FILE, products);
    // Update store's product list
    store.productIds.push(newProduct.id);
    saveJson(STORES_FILE, stores);
    return sendJson(res, 201, newProduct);
  },

  /**
   * GET /products
   * List all products with optional search, category filter and sorting.
   * Query params: q (keyword), category, sort ("rating" | "price" | "name"),
   * order ("asc" | "desc"), limit.
   */
  async listProducts(req, res, user, params, body, urlObj) {
    const query    = urlObj.searchParams.get('q');
    const category = urlObj.searchParams.get('category');
    const sort     = urlObj.searchParams.get('sort');
    const order    = urlObj.searchParams.get('order') || 'desc';
    const limitStr = urlObj.searchParams.get('limit');
    let products = loadJson(PRODUCTS_FILE);
    // Filter by search query
    if (query) {
      const q = query.toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    // Filter by category
    if (category) {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    // Sort results by rating, price or name.  Default order is descending
    if (sort === 'rating') {
      products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      if (order === 'asc') products.reverse();
    } else if (sort === 'price') {
      products.sort((a, b) => a.price - b.price);
      if (order === 'desc') products.reverse();
    } else if (sort === 'name') {
      products.sort((a, b) => a.name.localeCompare(b.name));
      if (order === 'desc') products.reverse();
    }
    // Limit
    const limit = limitStr ? parseInt(limitStr, 10) : null;
    if (limit && products.length > limit) {
      products = products.slice(0, limit);
    }
    return sendJson(res, 200, products);
  },

  /**
   * GET /products/:productId
   * Retrieve a single product by ID, including its reviews and average rating.
   */
  async getProduct(req, res, user, params) {
    const productId = params[0];
    const products  = loadJson(PRODUCTS_FILE);
    const product   = products.find(p => p.id === productId);
    if (!product) {
      return sendJson(res, 404, { error: 'Product not found' });
    }
    // Compute rating from reviews
    const reviews = loadJson(REVIEWS_FILE).filter(r => r.productId === productId);
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / (reviews.length || 1);
    const rating = Math.round(avg * 10) / 10;
    return sendJson(res, 200, { ...product, rating, reviews });
  },

  /**
   * GET /products/:productId/reviews
   * Return reviews for a product.
   */
  getReviews(req, res, user, params) {
    const productId = params[0];
    const reviews = loadJson(REVIEWS_FILE).filter(r => r.productId === productId);
    return sendJson(res, 200, reviews);
  },

  /**
   * POST /products/:productId/reviews
   * Submit or update a review for a product.  Authenticated buyers only.
   * Body: { rating: number, comment: string }
   */
  async postReview(req, res, user, params) {
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    const productId = params[0];
    const body = await parseBody(req).catch(err => {
      sendJson(res, 400, { error: err.message });
    });
    if (!body) return;
    const { rating, comment } = body;
    if (!rating || rating < 1 || rating > 5) {
      return sendJson(res, 400, { error: 'Rating must be between 1 and 5' });
    }
    // ensure user purchased the product
    if (!user.purchases.some(p => p.productId === productId)) {
      return sendJson(res, 403, { error: 'You can only review products you purchased' });
    }
    const reviews = loadJson(REVIEWS_FILE);
    let review = reviews.find(r => r.productId === productId && r.userId === user.id);
    if (review) {
      review.rating = rating;
      review.comment = comment || '';
      review.date = new Date().toISOString();
    } else {
      reviews.push({ id: randomUUID(), productId, userId: user.id, rating, comment: comment || '', date: new Date().toISOString() });
    }
    saveJson(REVIEWS_FILE, reviews);
    // recompute average rating on product
    const products = loadJson(PRODUCTS_FILE);
    const product = products.find(p => p.id === productId);
    if (product) {
      const prodReviews = reviews.filter(r => r.productId === productId);
      const avg = prodReviews.reduce((sum, r) => sum + r.rating, 0) / (prodReviews.length || 1);
      product.rating = Math.round(avg * 10) / 10;
      saveJson(PRODUCTS_FILE, products);
    }
    return sendJson(res, 200, { message: 'Review submitted', rating: product ? product.rating : rating });
  },

  /**
   * GET /products/:productId/content
   * Return protected content for a purchased product.  For digital products
   * return { fileUrl }, for memberships return { membershipBenefits },
   * and for courses return { courseContent }.
   */
  getContent(req, res, user, params) {
    const productId = params[0];
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    const products = loadJson(PRODUCTS_FILE);
    const product  = products.find(p => p.id === productId);
    if (!product) {
      return sendJson(res, 404, { error: 'Product not found' });
    }
    if (!user.purchases.some(p => p.productId === productId)) {
      return sendJson(res, 403, { error: 'You do not have access to this content' });
    }
    if (product.type === 'digital') {
      return sendJson(res, 200, { fileUrl: product.fileUrl });
    }
    if (product.type === 'membership') {
      return sendJson(res, 200, { membershipBenefits: product.membershipBenefits });
    }
    if (product.type === 'course') {
      return sendJson(res, 200, { courseContent: product.courseContent });
    }
    return sendJson(res, 200, {});
  },

  /**
   * POST /purchase
   * Purchase a product.  Authenticated users only.  Body: { productId }
   */
  async purchase(req, res, user) {
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    const body = await parseBody(req).catch(err => {
      sendJson(res, 400, { error: err.message });
    });
    if (!body) return;
    const { productId } = body;
    if (!productId) {
      return sendJson(res, 400, { error: 'productId is required' });
    }
    const products = loadJson(PRODUCTS_FILE);
    const product  = products.find(p => p.id === productId);
    if (!product) {
      return sendJson(res, 404, { error: 'Product not found' });
    }
    // record order
    const orders = loadJson(ORDERS_FILE);
    const newOrder = {
      id: randomUUID(),
      userId: user.id,
      storeId: product.storeId,
      productId,
      price: product.price,
      date: new Date().toISOString()
    };
    orders.push(newOrder);
    saveJson(ORDERS_FILE, orders);
    // update user's purchases
    const users = loadJson(USERS_FILE);
    const u = users.find(u => u.id === user.id);
    if (u) {
      u.purchases.push({ productId, date: newOrder.date });
      saveJson(USERS_FILE, users);
    }
    return sendJson(res, 200, { message: 'Purchase successful', orderId: newOrder.id });
  },

  /**
   * GET /stats
   * Return global statistics: number of users, stores, products, orders and reviews.\n   */
  stats(req, res) {
    const users    = loadJson(USERS_FILE);
    const stores   = loadJson(STORES_FILE);
    const products = loadJson(PRODUCTS_FILE);
    const orders   = loadJson(ORDERS_FILE);
    const reviews  = loadJson(REVIEWS_FILE);
    return sendJson(res, 200, {
      users: users.length,
      stores: stores.length,
      products: products.length,
      orders: orders.length,
      reviews: reviews.length
    });
  },

  /**
   * GET /categories
   * Return statistics for each product category: productCount, orderCount.  A
   * category is included if there is at least one product or order.  Sorted
   * descending by orderCount.
   */
  categories(req, res) {
    const categories = computeCategoryStats();
    return sendJson(res, 200, categories);
  },

  /**
   * GET /trending
   * Return trending products and categories.  Query param `days` can specify
   * a time window (e.g. 30 for last 30 days).  The response is
   * { products: [...], categories: [...] }.
   */
  trending(req, res, user, params, body, urlObj) {
    const daysStr = urlObj.searchParams.get('days');
    let days = null;
    if (daysStr) {
      const d = parseInt(daysStr, 10);
      if (!isNaN(d) && d > 0) {
        days = d;
      }
    }
    const products   = computeTrendingProducts(days);
    const categories = computeCategoryStats();
    return sendJson(res, 200, { products, categories });
  },

  /**
   * GET /seller/analytics
   * Return seller analytics for the current authenticated seller.\n   */
  sellerAnalytics(req, res, user) {
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    if (user.role !== 'seller') {
      return sendJson(res, 403, { error: 'Only sellers have analytics' });
    }
    const analytics = computeSellerAnalytics(user);
    return sendJson(res, 200, analytics);
  }

};

// -----------------------------------------------------------------------------
// Routing
// -----------------------------------------------------------------------------
/**
 * Parse the URL and route to the appropriate handler.  API routes are
 * prefixed with /api; all other requests are served as static files.\n   */
function route(req, res) {
  const urlObj   = new URL(req.url, 'http://localhost');
  const pathname = urlObj.pathname;
  // API routes
  if (pathname.startsWith('/api')) {
    const path = pathname.substring(4) || '/';
    // Authentication
    const user = authenticate(req);
    // Define route patterns and map to handler names.  Order matters.
    const routes = [
      { method: 'POST', pattern: /^\\/signup$/, handler: 'signup' },
      { method: 'POST', pattern: /^\\/login$/, handler: 'login' },
      { method: 'GET',  pattern: /^\\/user\\/purchases$/, handler: 'userPurchases' },
      { method: 'GET',  pattern: /^\\/user\\/stores$/, handler: 'userStores' },
      { method: 'POST', pattern: /^\\/stores$/, handler: 'createStore' },
      { method: 'GET',  pattern: /^\\/stores$/, handler: 'listStores' },
      { method: 'GET',  pattern: /^\\/stores\\/([^/]+)$/, handler: 'getStore' },
      { method: 'GET',  pattern: /^\\/stores\\/([^/]+)\\/products$/, handler: 'listStoreProducts' },
      { method: 'POST', pattern: /^\\/stores\\/([^/]+)\\/products$/, handler: 'createProduct' },
      { method: 'GET',  pattern: /^\\/products$/, handler: 'listProducts' },
      { method: 'GET',  pattern: /^\\/products\\/([^/]+)$/, handler: 'getProduct' },
      { method: 'GET',  pattern: /^\\/products\\/([^/]+)\\/reviews$/, handler: 'getReviews' },
      { method: 'POST', pattern: /^\\/products\\/([^/]+)\\/reviews$/, handler: 'postReview' },
      { method: 'GET',  pattern: /^\\/products\\/([^/]+)\\/content$/, handler: 'getContent' },
      { method: 'POST', pattern: /^\\/purchase$/, handler: 'purchase' },
      { method: 'GET',  pattern: /^\\/stats$/, handler: 'stats' },
      { method: 'GET',  pattern: /^\\/categories$/, handler: 'categories' },
      { method: 'GET',  pattern: /^\\/trending$/, handler: 'trending' },
      { method: 'GET',  pattern: /^\\/seller\\/analytics$/, handler: 'sellerAnalytics' }
    ];
    for (const route of routes) {
      if (req.method === route.method && route.pattern.test(path)) {
        const params = path.match(route.pattern).slice(1);
        const handlerName = route.handler;
        const handlerFn   = handlers[handlerName];
        if (!handlerFn) {
          return sendJson(res, 500, { error: 'Handler not implemented' });
        }
        try {
          handlerFn(req, res, user, params, null, null, urlObj);
          return;
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      }
    }
    // No matching route
    return sendJson(res, 404, { error: 'Endpoint not found' });
  }
  // Serve static files
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  // Prevent directory traversal attacks
  if (!filePath.startsWith(__dirname)) {
    return sendText(res, 403, 'Forbidden');
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return sendText(res, 404, 'Not Found');
    }
    sendFile(res, filePath);
  });
}

// Start server
ensureDataFiles();
const PORT = process.env.PORT || 3000;
const server = http.createServer(route);
server.listen(PORT, () => {
  console.log(`Steb.io server running at http://localhost:${PORT}`);
});
