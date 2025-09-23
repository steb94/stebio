// server.js

const express = require('express');
const cors = require('cors');
const path = require('path');

const {
  getAllProducts,
  getAllStores,
  getAllOrders,
  getProductById,
  getStoreById,
  getProductsByStoreId,
  getOrderById,
  createOrder,
  updateOrderStatus,
  addMessage,
  getMessagesForUser,
  markMessageDelivered,
  addUserToChat,
  isUserInChat,
  addChatMessage,
  getChatMessages,
  createPost,
  getPostsByStoreId
} = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the root directory (index.html, CSS, JS, etc.)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ===== Products ===== */
app.get('/api/products', (req, res) => {
  let result = getAllProducts();
  const { q, sort, type, minPrice, maxPrice } = req.query;
  if (q) {
    result = result.filter(p =>
      p.title.toLowerCase().includes(q.toLowerCase()) ||
      p.description.toLowerCase().includes(q.toLowerCase())
    );
  }
  if (type) {
    result = result.filter(p => p.type === type);
  }
  if (minPrice) {
    result = result.filter(p => p.price >= parseFloat(minPrice));
  }
  if (maxPrice) {
    result = result.filter(p => p.price <= parseFloat(maxPrice));
  }
  if (sort === 'asc') {
    result = result.slice().sort((a, b) => a.price - b.price);
  } else if (sort === 'desc') {
    result = result.slice().sort((a, b) => b.price - a.price);
  }
  res.json(result);
});
app.get('/api/products/:id', (req, res) => {
  const p = getProductById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});
app.post('/api/products', (req, res) => {
  const { storeId, title, description, image, type, price, maxSupply } = req.body;
  if (!storeId || !title || !price) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const newId = getAllProducts().length + 1;
  const product = {
    id: newId,
    storeId: Number(storeId),
    title,
    description,
    image,
    type,
    price: parseFloat(price),
    maxSupply: parseInt(maxSupply) || 0
  };
  getAllProducts().push(product);
  res.json(product);
});

/* ===== Stores ===== */
app.get('/api/stores', (req, res) => {
  res.json(getAllStores());
});
app.get('/api/stores/:id', (req, res) => {
  const store = getStoreById(req.params.id);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  res.json(store);
});
app.get('/api/stores/:id/products', (req, res) => {
  res.json(getProductsByStoreId(req.params.id));
});
app.post('/api/stores', (req, res) => {
  const { name, owner } = req.body;
  if (!name || !owner) {
    return res.status(400).json({ error: 'Missing name or owner' });
  }
  const newId = getAllStores().length + 1;
  const store = { id: newId, name, owner };
  getAllStores().push(store);
  res.json(store);
});

/* ===== Orders ===== */
app.get('/api/orders', (req, res) => {
  res.json(getAllOrders());
});
app.get('/api/orders/:id', (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});
app.post('/api/orders', (req, res) => {
  const { productId, buyerName, expiresAt } = req.body;
  const product = getProductById(productId);
  if (!product || !buyerName) {
    return res.status(400).json({ error: 'Invalid product or buyer name' });
  }
  const newOrder = createOrder({
    storeId: product.storeId,
    productId: product.id,
    productName: product.title,
    price: product.price,
    status: 'Processing',
    buyerName
  });
  const expiryDate = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  addUserToChat(productId, buyerName, expiryDate.toISOString());
  res.json(newOrder);
});
app.patch('/api/orders/:id', (req, res) => {
  const { status } = req.body;
  const updated = updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json(updated);
});

/* ===== Dashboard summary ===== */
app.get('/api/dashboard', (req, res) => {
  const products = getAllProducts();
  const stores = getAllStores();
  const orders = getAllOrders();
  const totalSales = orders.reduce((sum, o) => sum + (o.price || 0), 0);
  res.json({
    totalProducts: products.length,
    totalStores: stores.length,
    totalOrders: orders.length,
    totalSales
  });
});

/* ===== Personal messages ===== */
app.get('/api/messages', (req, res) => {
  const { user } = req.query;
  if (!user) return res.status(400).json({ error: 'Missing user' });
  res.json(getMessagesForUser(user));
});
app.post('/api/messages', (req, res) => {
  const { sender, recipient, content } = req.body;
  if (!sender || !recipient || !content) {
    return res.status(400).json({ error: 'Missing sender, recipient or content' });
  }
  res.json(addMessage(sender, recipient, content));
});
app.patch('/api/messages/:id', (req, res) => {
  const msg = markMessageDelivered(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  res.json(msg);
});

/* ===== Chat ===== */
app.get('/api/chat/:productId/messages', (req, res) => {
  const { username } = req.query;
  const { productId } = req.params;
  if (!username) return res.status(400).json({ error: 'Missing username' });
  if (!isUserInChat(productId, username)) {
    return res.status(403).json({ error: 'User not in chat or membership expired' });
  }
  res.json(getChatMessages(productId));
});
app.post('/api/chat/:productId/message', (req, res) => {
  const { productId } = req.params;
  const { username, message } = req.body;
  if (!username || !message) {
    return res.status(400).json({ error: 'Missing username or message' });
  }
  if (!isUserInChat(productId, username)) {
    return res.status(403).json({ error: 'User not in chat or membership expired' });
  }
  const msg = addChatMessage(productId, username, message);
  res.json(msg);
});

/* ===== Posts ===== */
app.get('/api/posts/:storeId', (req, res) => {
  res.json(getPostsByStoreId(req.params.storeId));
});
app.post('/api/posts/:storeId', (req, res) => {
  const { username, mediaUrl, content } = req.body;
  if (!username || (!mediaUrl && !content)) {
    return res.status(400).json({ error: 'Missing username or post content' });
  }
  res.json(createPost(req.params.storeId, username, mediaUrl, content));
});

/* ===== Fallback: serve index.html for unmatched routes ===== */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ===== Start server ===== */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  getAllProducts,
  getAllStores,
  getAllOrders,
  getProductById,
  getStoreById,
  getProductsByStoreId,
  getOrderById,
  createStore,
  createProduct,
  createOrder,
  updateOrderStatus,
  addMessage,
  getMessagesForUser,
  markMessageDelivered,
  addUserToChat,
  isUserInChat,
  addChatMessage,
  getChatMessages,
  createPost,
  getPostsByStoreId
} = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serve HTML/CSS/JS files in project root

/* ========= Product endpoints ========= */
app.get('/api/products', (req, res) => {
  let result = getAllProducts();
  const { q, sort, type, minPrice, maxPrice } = req.query;
  if (q) {
    result = result.filter(p =>
      p.title.toLowerCase().includes(q.toLowerCase()) ||
      p.description.toLowerCase().includes(q.toLowerCase())
    );
  }
  if (type) result = result.filter(p => p.type === type);
  if (minPrice) result = result.filter(p => p.price >= parseFloat(minPrice));
  if (maxPrice) result = result.filter(p => p.price <= parseFloat(maxPrice));
  if (sort === 'asc') {
    result = result.slice().sort((a, b) => a.price - b.price);
  } else if (sort === 'desc') {
    result = result.slice().sort((a, b) => b.price - a.price);
  }
  res.json(result);
});
app.get('/api/products/:id', (req, res) => {
  const prod = getProductById(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Product not found' });
  res.json(prod);
});
app.post('/api/products', (req, res) => {
  const { storeId, title, description, image, type, price, maxSupply } = req.body;
  if (!storeId || !title || !price) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const product = createProduct({
    storeId: Number(storeId),
    title,
    description,
    image,
    type,
    price: parseFloat(price),
    maxSupply: parseInt(maxSupply) || 0
  });
  res.json(product);
});

/* ========= Store endpoints ========= */
app.get('/api/stores', (req, res) => {
  res.json(getAllStores());
});
app.get('/api/stores/:id', (req, res) => {
  const store = getStoreById(req.params.id);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  res.json(store);
});
app.get('/api/stores/:id/products', (req, res) => {
  res.json(getProductsByStoreId(req.params.id));
});
app.post('/api/stores', (req, res) => {
  const { name, owner } = req.body;
  if (!name || !owner) {
    return res.status(400).json({ error: 'Missing name or owner' });
  }
  res.json(createStore(name, owner));
});

/* ========= Orders endpoints ========= */
app.get('/api/orders', (req, res) => {
  res.json(getAllOrders());
});
app.get('/api/orders/:id', (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});
app.post('/api/orders', (req, res) => {
  const { productId, buyerName, expiresAt } = req.body;
  const product = getProductById(productId);
  if (!product || !buyerName) {
    return res.status(400).json({ error: 'Invalid product or buyerName' });
  }
  const newOrder = createOrder({
    storeId: product.storeId,
    productId: product.id,
    productName: product.title,
    price: product.price,
    status: 'Processing',
    buyerName
  });
  // Give buyer chat access for default 7 days or specified expiry
  const expiryDate = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  addUserToChat(productId, buyerName, expiryDate.toISOString());
  res.json(newOrder);
});
app.patch('/api/orders/:id', (req, res) => {
  const { status } = req.body;
  const updated = updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json(updated);
});

/* ========= Dashboard summary ========= */
app.get('/api/dashboard', (req, res) => {
  const products = getAllProducts();
  const stores = getAllStores();
  const orders = getAllOrders();
  const totalSales = orders.reduce((sum, o) => sum + (o.price || 0), 0);
  res.json({
    totalProducts: products.length,
    totalStores: stores.length,
    totalOrders: orders.length,
    totalSales
  });
});

/* ========= Personal messages ========= */
app.get('/api/messages', (req, res) => {
  const { user } = req.query;
  if (!user) return res.status(400).json({ error: 'Missing user' });
  res.json(getMessagesForUser(user));
});
app.post('/api/messages', (req, res) => {
  const { sender, recipient, content } = req.body;
  if (!sender || !recipient || !content) {
    return res.status(400).json({ error: 'Missing sender, recipient or content' });
  }
  res.json(addMessage(sender, recipient, content));
});
app.patch('/api/messages/:id', (req, res) => {
  const msg = markMessageDelivered(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  res.json(msg);
});

/* ========= Chat endpoints ========= */
app.get('/api/chat/:productId/messages', (req, res) => {
  const { username } = req.query;
  const { productId } = req.params;
  if (!username) return res.status(400).json({ error: 'Missing username' });
  if (!isUserInChat(productId, username)) {
    return res.status(403).json({ error: 'User not in chat or membership expired' });
  }
  res.json(getChatMessages(productId));
});
app.post('/api/chat/:productId/message', (req, res) => {
  const { productId } = req.params;
  const { username, message } = req.body;
  if (!username || !message) {
    return res.status(400).json({ error: 'Missing username or message' });
  }
  if (!isUserInChat(productId, username)) {
    return res.status(403).json({ error: 'User not in chat or membership expired' });
  }
  res.json(addChatMessage(productId, username, message));
});

/* ========= Post endpoints ========= */
app.get('/api/posts/:storeId', (req, res) => {
  res.json(getPostsByStoreId(req.params.storeId));
});
app.post('/api/posts/:storeId', (req, res) => {
  const { username, mediaUrl, content } = req.body;
  if (!username || (!mediaUrl && !content)) {
    return res.status(400).json({ error: 'Missing username or post content' });
  }
  res.json(createPost(req.params.storeId, username, mediaUrl, content));
});

/* ========= Fallback: serve index.html ========= */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ========= Start server ========= */
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
