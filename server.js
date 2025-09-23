const path = require('path');
app.use(express.static(path.join(__dirname)));

// server.js

const express = require('express');
const cors = require('cors');
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

app.use(cors());
app.use(express.json());

/* ===== Product endpoints ===== */
app.get('/api/products', (req, res) => {
  res.json(getAllProducts());
});

app.get('/api/products/:id', (req, res) => {
  const product = getProductById(req.params.id);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

/* ===== Store endpoints ===== */
app.get('/api/stores', (req, res) => {
  res.json(getAllStores());
});

app.get('/api/stores/:id', (req, res) => {
  const store = getStoreById(req.params.id);
  if (store) {
    res.json(store);
  } else {
    res.status(404).json({ error: 'Store not found' });
  }
});

app.get('/api/stores/:id/products', (req, res) => {
  res.json(getProductsByStoreId(req.params.id));
});

/* ===== Order endpoints ===== */
app.get('/api/orders', (req, res) => {
  res.json(getAllOrders());
});

app.get('/api/orders/:id', (req, res) => {
  const order = getOrderById(req.params.id);
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
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
  // Give the buyer access to the product’s chat for the specified duration (default 7 days)
  const expiry = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  addUserToChat(productId, buyerName, expiry.toISOString());
  res.json(newOrder);
});

app.patch('/api/orders/:id', (req, res) => {
  const { status } = req.body;
  const updated = updateOrderStatus(req.params.id, status);
  if (updated) {
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

/* ===== Personal messaging endpoints ===== */
app.get('/api/messages', (req, res) => {
  const { user } = req.query;
  if (!user) {
    return res.status(400).json({ error: 'Missing user query parameter' });
  }
  res.json(getMessagesForUser(user));
});

app.post('/api/messages', (req, res) => {
  const { sender, recipient, content } = req.body;
  if (!sender || !recipient || !content) {
    return res.status(400).json({ error: 'Missing sender, recipient or content' });
  }
  const message = addMessage(sender, recipient, content);
  res.json(message);
});

app.patch('/api/messages/:id', (req, res) => {
  const msg = markMessageDelivered(req.params.id);
  if (msg) {
    res.json(msg);
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

/* ===== Chat endpoints ===== */
app.post('/api/chat/:productId/message', (req, res) => {
  const { productId } = req.params;
  const { username, message } = req.body;
  if (!username || !message) {
    return res.status(400).json({ error: 'Missing username or message' });
  }
  if (!isUserInChat(productId, username)) {
    return res
      .status(403)
      .json({ error: 'User not in chat room or membership expired' });
  }
  const msg = addChatMessage(productId, username, message);
  res.json(msg);
});

app.get('/api/chat/:productId/messages', (req, res) => {
  const { productId } = req.params;
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Missing username query parameter' });
  }
  if (!isUserInChat(productId, username)) {
    return res
      .status(403)
      .json({ error: 'User not in chat room or membership expired' });
  }
  res.json(getChatMessages(productId));
});

/* ===== Posts endpoints ===== */
app.post('/api/posts/:storeId', (req, res) => {
  const { storeId } = req.params;
  const { username, mediaUrl, content } = req.body;
  if (!username || (!mediaUrl && !content)) {
    return res.status(400).json({ error: 'Missing username or post content' });
  }
  const post = createPost(storeId, username, mediaUrl, content);
  res.json(post);
});

app.get('/api/posts/:storeId', (req, res) => {
  res.json(getPostsByStoreId(req.params.storeId));
});

/* ===== Dashboard summary ===== */
app.get('/api/dashboard', (req, res) => {
  const allProducts = getAllProducts();
  const allStores = getAllStores();
  const allOrders = getAllOrders();
  const totalSales = allOrders.reduce(
    (sum, o) => sum + (o.price || 0),
    0
  );
  res.json({
    totalProducts: allProducts.length,
    totalStores: allStores.length,
    totalOrders: allOrders.length,
    totalSales
  });
});

/* ===== Start server ===== */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
