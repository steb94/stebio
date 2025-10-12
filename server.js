const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

/**
 * Simple REST API and WebSocket server for the Steb.io marketplace.
 *
 * This server implements user authentication, store and product management,
 * chatroom creation, and a Socket.IO real‑time chat system.  Data is persisted
 * in JSON files in the same directory (`users.json`, `stores.json`,
 * `products.json`, `chatrooms.json`).  Authentication is token‑based: when a
 * user logs in successfully, a random token is generated and returned to the
 * client.  The client must include this token in the `Authorization` header
 * when creating stores, products, or chatrooms.  Note: this is a demonstration
 * implementation and does not use secure password hashing or JWT.  Do not
 * deploy as‑is in production without adding proper security.
 */

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());

// Paths for data files
const USERS_FILE = path.join(__dirname, 'users.json');
const STORES_FILE = path.join(__dirname, 'stores.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const CHATROOMS_FILE = path.join(__dirname, 'chatrooms.json');

// Utility functions to load/save JSON data
function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading', file, err);
    return fallback;
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// In‑memory map of tokens to user IDs.  Populated on login.
const tokens = {};

// Helper: find user by token.  Returns user object or null.
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const userId = tokens[token];
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const users = loadJson(USERS_FILE, []);
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Invalid user' });
  }
  req.user = user;
  req.token = token;
  next();
}

// Generate a simple random token
function generateToken() {
  return uuidv4();
}

// POST /api/users/signup
// body: { email, username, password, role }
app.post('/api/users/signup', (req, res) => {
  const { email, username, password, role } = req.body;
  if (!email || !username || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const users = loadJson(USERS_FILE, []);
  // check duplicates
  if (users.some(u => u.email === email || u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const user = {
    id: uuidv4(),
    email,
    username,
    password, // In production, hash passwords!
    role,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveJson(USERS_FILE, users);
  res.json({ message: 'Registration successful! Please verify your email and then log in.' });
});

// POST /api/users/login
// body: { identifier, password }
app.post('/api/users/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Missing identifier or password' });
  }
  const users = loadJson(USERS_FILE, []);
  const user = users.find(u => (u.email === identifier || u.username === identifier) && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = generateToken();
  tokens[token] = user.id;
  const response = {
    message: 'Login successful',
    username: user.username,
    role: user.role,
    token,
    storeId: null,
  };
  // If seller, include their store ID if exists
  if (user.role === 'seller') {
    const stores = loadJson(STORES_FILE, []);
    const store = stores.find(s => s.ownerId === user.id);
    if (store) response.storeId = store.id;
  }
  res.json(response);
});

// POST /api/stores
// Create a new store for a seller
app.post('/api/stores', authMiddleware, (req, res) => {
  const user = req.user;
  if (user.role !== 'seller') {
    return res.status(403).json({ error: 'Only sellers can create stores' });
  }
  const { name, description, imageUrl } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Store name is required' });
  }
  const stores = loadJson(STORES_FILE, []);
  // Ensure user doesn't already have a store
  if (stores.some(s => s.ownerId === user.id)) {
    return res.status(400).json({ error: 'Store already exists' });
  }
  const store = {
    id: uuidv4(),
    ownerId: user.id,
    name,
    description: description || '',
    imageUrl: imageUrl || '',
    createdAt: new Date().toISOString(),
  };
  stores.push(store);
  saveJson(STORES_FILE, stores);
  res.json({ message: 'Store created successfully', id: store.id });
});

// GET /api/stores/:id
app.get('/api/stores/:id', (req, res) => {
  const { id } = req.params;
  const stores = loadJson(STORES_FILE, []);
  const store = stores.find(s => s.id === id);
  if (!store) {
    return res.status(404).json({ error: 'Store not found' });
  }
  res.json(store);
});

// POST /api/products
// Create a product for seller's store
app.post('/api/products', authMiddleware, (req, res) => {
  const user = req.user;
  if (user.role !== 'seller') {
    return res.status(403).json({ error: 'Only sellers can create products' });
  }
  const stores = loadJson(STORES_FILE, []);
  const store = stores.find(s => s.ownerId === user.id);
  if (!store) {
    return res.status(400).json({ error: 'Store does not exist' });
  }
  const {
    title,
    headline,
    description,
    imageUrl,
    videoUrl,
    type,
    pricing,
    paymentMethods,
    features,
    faqs,
    affiliateRate,
    redirectUrl,
    chatRoomId,
  } = req.body;
  if (!title || !description || !type) {
    return res.status(400).json({ error: 'Missing required product fields' });
  }
  const products = loadJson(PRODUCTS_FILE, []);
  const product = {
    id: uuidv4(),
    storeId: store.id,
    title,
    headline: headline || '',
    description,
    imageUrl: imageUrl || '',
    videoUrl: videoUrl || '',
    type,
    pricing: Array.isArray(pricing) ? pricing : [],
    paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [],
    features: Array.isArray(features) ? features : [],
    faqs: Array.isArray(faqs) ? faqs : [],
    affiliateRate: affiliateRate || null,
    redirectUrl: redirectUrl || null,
    chatRoomId: chatRoomId || null,
    createdAt: new Date().toISOString(),
  };
  products.push(product);
  saveJson(PRODUCTS_FILE, products);
  res.json({ message: 'Product created successfully', id: product.id });
});

// GET /api/products
// Return list of products; optional storeId filter
app.get('/api/products', (req, res) => {
  const { storeId } = req.query;
  const products = loadJson(PRODUCTS_FILE, []);
  const filtered = storeId ? products.filter(p => String(p.storeId) === String(storeId)) : products;
  res.json(filtered);
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const products = loadJson(PRODUCTS_FILE, []);
  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// POST /api/products/:id/checkout
// Simulate purchase
app.post('/api/products/:id/checkout', authMiddleware, (req, res) => {
  const { id } = req.params;
  const products = loadJson(PRODUCTS_FILE, []);
  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  // In real implementation, process payment here
  res.json({ message: 'Purchase successful', productId: id });
});

// POST /api/chatrooms
// Create a chat room for a product
app.post('/api/chatrooms', authMiddleware, (req, res) => {
  const user = req.user;
  if (user.role !== 'seller') {
    return res.status(403).json({ error: 'Only sellers can create chat rooms' });
  }
  const chatrooms = loadJson(CHATROOMS_FILE, []);
  const room = {
    id: uuidv4(),
    ownerId: user.id,
    createdAt: new Date().toISOString(),
  };
  chatrooms.push(room);
  saveJson(CHATROOMS_FILE, chatrooms);
  res.json(room);
});

// GET /api/stats
// Return marketplace stats; optional storeId filter
app.get('/api/stats', (req, res) => {
  const { storeId } = req.query;
  const products = loadJson(PRODUCTS_FILE, []);
  const stores = loadJson(STORES_FILE, []);
  let targetProducts = products;
  if (storeId) {
    targetProducts = products.filter(p => String(p.storeId) === String(storeId));
  }
  const totalProducts = targetProducts.length;
  const totalStores = storeId ? 1 : stores.length;
  // Simple counts; no orders or revenue tracking implemented
  res.json({ totalProducts, totalStores, totalOrders: 0, totalRevenue: 0 });
});

// Socket.IO chat server
io.on('connection', (socket) => {
  // When client joins a room
  socket.on('join', ({ room }) => {
    if (room) {
      socket.join(room);
    }
  });
  // When client sends a message
  socket.on('message', ({ room, text, username }) => {
    if (room && text) {
      io.to(room).emit('message', {
        username: username || 'User',
        text,
        timestamp: new Date().toISOString(),
      });
    }
  });
});

// Serve the static files (front‑end) from the 'public' directory if needed.
// For this example, the front‑end files are assumed to be served separately.

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
