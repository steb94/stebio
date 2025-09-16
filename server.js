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
  return list.map(({ downloadLink, ...safeFields }) => safeFields);
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
  res.json(safeProduct);
});

// GET /api/stores/:id -> return store info and its products (sanitized)
app.get('/api/stores/:id', (req, res) => {
  const { id } = req.params;
  const store = getStoreById(id);
  if (!store) {
    return res.status(404).json({ error: 'Store not found' });
  }
  const products = getProductsByStoreId(id).map(({ downloadLink, ...safe }) => safe);
  res.json({ store, products });
});

// GET /api/stores/:id/products -> only products for a store (sanitized)
app.get('/api/stores/:id/products', (req, res) => {
  const { id } = req.params;
  const store = getStoreById(id);
  if (!store) {
    return res.status(404).json({ error: 'Store not found' });
  }
  const products = getProductsByStoreId(id).map(({ downloadLink, ...safe }) => safe);
  res.json(products);
});

// GET /api/stats -> { totalProducts, totalStores, totalOrders }
app.get('/api/stats', (_req, res) => {
  const totalProducts = getAllProducts().length;
  const totalStores = getAllStores().length;
  const totalOrders = getAllOrders().length;
  res.json({ totalProducts, totalStores, totalOrders });
});

/* Placeholder for existing routes (auth, orders, support). In a full implementation
 * these would be imported from other modules.
 */

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Steb.io backend listening on port ${PORT}`);
});