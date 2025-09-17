/*
 * Express server for Steb.io marketplace
 *
 * Implements product search/filter/sort and stats endpoints.
 * Existing routes (e.g., auth, orders) would be defined below this file
 * and are untouched by these changes.
 */

const express = require('express');
const cors = require('cors');

const {
  getAllProducts,
  getAllStores,
  getAllOrders,
  getProductById,
  getStoreById,
  getProductsByStoreId
  , getOrderById
  , updateOrderStatus
  , addMessage
  , getMessagesForUser
  , markMessageDelivered
} = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

// Sort helper based on query parameter
function sortProducts(list, sort) {
  if (!sort) return list;
  const productsCopy = [...list];
  switch (sort) {
    case 'price_asc':
      productsCopy.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      productsCopy.sort((a, b) => b.price - a.price);
      break;
    case 'newest':
    default:
      // assume IDs increment with new products; parseInt for numeric compare
      productsCopy.sort((a, b) => parseInt(b.id, 10) - parseInt(a.id, 10));
      break;
  }
  return productsCopy;
}

// Remove sensitive fields from product response
function sanitizeProducts(list) {
  // Remove sensitive downloadLink and normalize image paths by stripping
  // any leading "images/" directory so the frontend can load images at the
  // root of the static site. This avoids broken image links if the static
  // hosting platform does not preserve directory structure.
  return list.map(({ downloadLink, ...safeFields }) => {
    const sanitized = { ...safeFields };
    // Normalize image path: if it starts with 'images/', strip the prefix
    if (sanitized.image && typeof sanitized.image === 'string' && sanitized.image.startsWith('images/')) {
      sanitized.image = sanitized.image.replace(/^images\//, '');
    }
    return sanitized;
  });
}

// GET /api/products/search?query=keyword&sort={price_asc|price_desc|newest}
app.get('/api/products/search', (req, res) => {
  const { query, sort } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }
  const q = query.toLowerCase();
  const results = getAllProducts().filter(
    (p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
  );
  const sorted = sortProducts(results, sort);
  return res.json(sanitizeProducts(sorted));
});

// GET /api/products?type={category|All}&sort={price_asc|price_desc|newest}
app.get('/api/products', (req, res) => {
  const { type = 'All', sort } = req.query;
  let results = getAllProducts();
  if (type && type !== 'All') {
    const typeLower = type.toLowerCase();
    results = results.filter((p) => p.type.toLowerCase() === typeLower);
  }
  const sorted = sortProducts(results, sort);
  return res.json(sanitizeProducts(sorted));
});

// GET /api/products/:id -> single product by id (sanitized)
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const product = getProductById(id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  // sanitize: remove downloadLink
  const { downloadLink, ...safeProduct } = product;
  // Normalize image path if stored in images folder
  if (safeProduct.image && typeof safeProduct.image === 'string' && safeProduct.image.startsWith('images/')) {
    safeProduct.image = safeProduct.image.replace(/^images\//, '');
  }
  res.json(safeProduct);
});

// GET /api/stores/:id -> return store info and its products (sanitized)
app.get('/api/stores/:id', (req, res) => {
  const { id } = req.params;
  const store = getStoreById(id);
  if (!store) {
    return res.status(404).json({ error: 'Store not found' });
  }
  const products = getProductsByStoreId(id).map(({ downloadLink, ...safe }) => {
    // Normalize image path for each product
    if (safe.image && typeof safe.image === 'string' && safe.image.startsWith('images/')) {
      safe.image = safe.image.replace(/^images\//, '');
    }
    return safe;
  });
  res.json({ store, products });
});

// GET /api/stores/:id/products -> only products for a store (sanitized)
app.get('/api/stores/:id/products', (req, res) => {
  const { id } = req.params;
  const store = getStoreById(id);
  if (!store) {
    return res.status(404).json({ error: 'Store not found' });
  }
  const products = getProductsByStoreId(id).map(({ downloadLink, ...safe }) => {
    if (safe.image && typeof safe.image === 'string' && safe.image.startsWith('images/')) {
      safe.image = safe.image.replace(/^images\//, '');
    }
    return safe;
  });
  res.json(products);
});

// GET /api/stats -> { totalProducts, totalStores, totalOrders }
app.get('/api/stats', (_req, res) => {
  const totalProducts = getAllProducts().length;
  const totalStores = getAllStores().length;
  const totalOrders = getAllOrders().length;
  res.json({ totalProducts, totalStores, totalOrders });
});

// GET /api/dashboard -> summary for seller dashboard
// In a real app this would be scoped to the authenticated seller, but here we return
// aggregate totals and total revenue for demonstration purposes.
app.get('/api/dashboard', (_req, res) => {
  const products = getAllProducts();
  const orders = getAllOrders();
  const totalProducts = products.length;
  const totalOrders = orders.length;
  // Calculate total sales (sum of order prices)
  const totalSales = orders.reduce((sum, o) => sum + o.price, 0);
  res.json({ totalProducts, totalOrders, totalSales });
});

// GET /api/orders -> return all orders (sanitized)
app.get('/api/orders', (_req, res) => {
  const orders = getAllOrders().map(({ id, productId, productName, price, status, storeId }) => ({ id, productId, productName, price, status, storeId }));
  res.json(orders);
});

// PATCH /api/orders/:id -> update order status
app.patch('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Missing status' });
  }
  const updated = updateOrderStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({ id: updated.id, status: updated.status });
});

/* Placeholder for existing routes (auth, orders, support). In a full implementation
 * these would be imported from other modules.
 */

// Simple messaging endpoints
// POST /api/messages -> send a new message from one user to another.  Body should
// contain fromUser, toUser, content, and optional subject.  Returns the
// message object.  In a real system this would trigger an email notification.
app.post('/api/messages', (req, res) => {
  const { fromUser, toUser, subject, content } = req.body;
  if (!fromUser || !toUser || !content) {
    return res.status(400).json({ error: 'Missing fromUser, toUser or content' });
  }
  const msg = addMessage({ fromUser, toUser, subject, content });
  // Simulate immediate delivery for demonstration
  markMessageDelivered(msg.id);
  res.status(201).json(msg);
});

// GET /api/messages/:user -> return all messages sent to or from a user
app.get('/api/messages/:user', (req, res) => {
  const { user } = req.params;
  const msgs = getMessagesForUser(user);
  res.json(msgs);
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Steb.io backend listening on port ${PORT}`);
});