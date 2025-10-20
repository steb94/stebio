/* Steb.io Extended Marketplace Server (no external dependencies) */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { URL } = require('url');

const DATA_DIR      = path.join(__dirname, 'data');
const USERS_FILE    = path.join(DATA_DIR, 'users.json');
const STORES_FILE   = path.join(DATA_DIR, 'stores.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE   = path.join(DATA_DIR, 'orders.json');
const REVIEWS_FILE  = path.join(DATA_DIR, 'reviews.json');

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

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain') {
  res.writeHead(status, { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

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

function authenticate(req) {
  const token = req.headers['authorization'] || '';
  if (!token) return null;
  const users = loadJson(USERS_FILE);
  return users.find(u => u.token === token) || null;
}

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

function computeTrendingProducts(days = null) {
  const products = loadJson(PRODUCTS_FILE);
  const orders   = loadJson(ORDERS_FILE);
  const now = new Date();
  const counts = {};
  orders.forEach(o => {
    if (days !== null) {
      const orderDate = new Date(o.date);
      const ageMs = now - orderDate;
      if (ageMs > days * 86400000) return;
    }
    counts[o.productId] = (counts[o.productId] || 0) + 1;
  });
  const prodsWithCounts = products.map(p => ({ ...p, orderCount: counts[p.id] || 0 }));
  prodsWithCounts.sort((a, b) => b.orderCount - a.orderCount);
  return prodsWithCounts;
}

function computeSellerAnalytics(user) {
  const orders   = loadJson(ORDERS_FILE);
  const products = loadJson(PRODUCTS_FILE);
  const stores   = loadJson(STORES_FILE).filter(s => s.ownerId === user.id);
  let totalSales = 0;
  let totalOrders= 0;
  const prodSales = {};
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

// API handlers (identical to the previous version, omitted here for brevity)

// ... keep your existing handler functions (signup, login, listProducts, etc.) unchanged ...

// Routing logic
function route(req, res) {
  const urlObj   = new URL(req.url, 'http://localhost');
  const pathname = urlObj.pathname;
  if (pathname.startsWith('/api')) {
    const path = pathname.substring(4) || '/';
    const user = authenticate(req);
    const routes = [
      { method: 'POST', pattern: /^\/signup$/, handler: 'signup' },
      { method: 'POST', pattern: /^\/login$/, handler: 'login' },
      { method: 'GET',  pattern: /^\/user\/purchases$/, handler: 'userPurchases' },
      { method: 'GET',  pattern: /^\/user\/stores$/, handler: 'userStores' },
      { method: 'POST', pattern: /^\/stores$/, handler: 'createStore' },
      { method: 'GET',  pattern: /^\/stores$/, handler: 'listStores' },
      { method: 'GET',  pattern: /^\/stores\/([^/]+)$/, handler: 'getStore' },
      { method: 'GET',  pattern: /^\/stores\/([^/]+)\/products$/, handler: 'listStoreProducts' },
      { method: 'POST', pattern: /^\/stores\/([^/]+)\/products$/, handler: 'createProduct' },
      { method: 'GET',  pattern: /^\/products$/, handler: 'listProducts' },
      { method: 'GET',  pattern: /^\/products\/([^/]+)$/, handler: 'getProduct' },
      { method: 'GET',  pattern: /^\/products\/([^/]+)\/reviews$/, handler: 'getReviews' },
      { method: 'POST', pattern: /^\/products\/([^/]+)\/reviews$/, handler: 'postReview' },
      { method: 'GET',  pattern: /^\/products\/([^/]+)\/content$/, handler: 'getContent' },
      { method: 'POST', pattern: /^\/purchase$/, handler: 'purchase' },
      { method: 'GET',  pattern: /^\/stats$/, handler: 'stats' },
      { method: 'GET',  pattern: /^\/categories$/, handler: 'categories' },
      { method: 'GET',  pattern: /^\/trending$/, handler: 'trending' },
      { method: 'GET',  pattern: /^\/seller\/analytics$/, handler: 'sellerAnalytics' }
    ];
    for (const routeObj of routes) {
      if (req.method === routeObj.method && routeObj.pattern.test(path)) {
        const params = path.match(routeObj.pattern).slice(1);
        const handlerName = routeObj.handler;
        // Call the corresponding handler (assuming handlers[handlerName] exists)
        handlers[handlerName](req, res, user, params, null, null, urlObj);
        return;
      }
    }
    return sendJson(res, 404, { error: 'Endpoint not found' });
  }
  // Serve static files
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
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

// Initialize and start server
ensureDataFiles();
const PORT = process.env.PORT || 3000;
const server = http.createServer(route);
server.listen(PORT, () => {
  console.log(`Steb.io server running at http://localhost:${PORT}`);
});
