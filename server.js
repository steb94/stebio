/*
 * Steb.io back-end server
 *
 * This file provides a simple Express server with in-memory JSON data
 * storage and a Socket.IO instance for real-time chat.  It supports
 * user signup/login, store and product creation, listing products,
 * and per-room chat.  A special `global` room powers the main site
 * chat.  Clients can join any room by ID and send messages to that
 * room, leveraging Socket.IO rooms.
 *
 * To run this server you will need to install a few packages:
 *   npm install express cors socket.io uuid
 *
 * The server persists data to JSON files in a `data` folder.  On
 * startup it ensures the files exist.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

// -----------------------------------------------------------------------------
// Data persistence helpers
// -----------------------------------------------------------------------------

const DATA_DIR      = path.join(__dirname, 'data');
const USERS_FILE    = path.join(DATA_DIR, 'users.json');
const STORES_FILE   = path.join(DATA_DIR, 'stores.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]');
  }
  if (!fs.existsSync(STORES_FILE)) {
    fs.writeFileSync(STORES_FILE, '[]');
  }
  if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, '[]');
  }
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return [];
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// -----------------------------------------------------------------------------
// Express app and middleware
// -----------------------------------------------------------------------------

ensureDataFiles();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -----------------------------------------------------------------------------
// NEW: static file serving
// Serve static files (HTML, CSS, JS) from the current directory.
// This makes /index.html, /login.html, /signup.html etc. accessible.
app.use(express.static(path.join(__dirname)));

// NEW: root route
// When visiting '/', send the index.html file.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// -----------------------------------------------------------------------------
// Authentication middleware
// -----------------------------------------------------------------------------
function auth(req, res, next) {
  const token = req.headers.authorization || '';
  const users = loadJson(USERS_FILE);
  const user  = users.find(u => u.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
}

// -----------------------------------------------------------------------------
// User management endpoints
// -----------------------------------------------------------------------------

// POST /signup – create a new account
app.post('/signup', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const users = loadJson(USERS_FILE);
  if (users.some(u => u.username === username)) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  const token    = uuidv4();
  const newUser  = { id: uuidv4(), username, password, role: role || 'buyer', token };
  users.push(newUser);
  saveJson(USERS_FILE, users);
  res.json({ token, user: { id: newUser.id, username, role: newUser.role } });
});

// POST /login – authenticate and return token
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadJson(USERS_FILE);
  const user  = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Return existing token
  res.json({ token: user.token, user: { id: user.id, username: user.username, role: user.role } });
});

// -----------------------------------------------------------------------------
// Store and product management endpoints
// -----------------------------------------------------------------------------

// POST /stores – create a new store (seller only)
app.post('/stores', auth, (req, res) => {
  if (req.user.role !== 'seller') {
    return res.status(403).json({ error: 'Only sellers can create stores' });
  }
  const { name, imageUrl } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Store name is required' });
  }
  const stores   = loadJson(STORES_FILE);
  const newStore = { id: uuidv4(), name, imageUrl: imageUrl || '', ownerId: req.user.id };
  stores.push(newStore);
  saveJson(STORES_FILE, stores);
  res.json(newStore);
});

// GET /stores – list all stores
app.get('/stores', (req, res) => {
  const stores = loadJson(STORES_FILE);
  res.json(stores);
});

// POST /stores/:storeId/products – add a product to a store (seller only)
app.post('/stores/:storeId/products', auth, (req, res) => {
  const { storeId } = req.params;
  const stores = loadJson(STORES_FILE);
  const store  = stores.find(s => s.id === storeId);
  if (!store) {
    return res.status(404).json({ error: 'Store not found' });
  }
  if (store.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to add products to this store' });
  }
  const { name, description, price, features, faqs, imageUrl, videoUrl } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  const products   = loadJson(PRODUCTS_FILE);
  const productId  = uuidv4();
  const chatRoomId = uuidv4(); // unique chat room per product
  const newProduct = {
    id: productId,
    storeId,
    name,
    description: description || '',
    price,
    features: features || [],
    faqs: faqs || [],
    imageUrl: imageUrl || '',
    videoUrl: videoUrl || '',
    chatRoomId,
    createdAt: new Date().toISOString()
  };
  products.push(newProduct);
  saveJson(PRODUCTS_FILE, products);
  res.json(newProduct);
});

// GET /stores/:storeId/products – list products for a store
app.get('/stores/:storeId/products', (req, res) => {
  const { storeId } = req.params;
  const products    = loadJson(PRODUCTS_FILE).filter(p => p.storeId === storeId);
  res.json(products);
});

// GET /stores/:storeId/products/:productId – get a specific product
app.get('/stores/:storeId/products/:productId', (req, res) => {
  const { productId } = req.params;
  const products      = loadJson(PRODUCTS_FILE);
  const product       = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// -----------------------------------------------------------------------------
// Socket.IO chat implementation
// -----------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Join a room (product chat or global chat)
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    // Optionally notify others in the room
    socket.to(roomId).emit('message', {
      sender: 'System',
      content: 'A new participant has joined the chat',
      roomId
    });
  });

  // Handle incoming messages with token validation
  socket.on('sendMessage', ({ roomId, content, token }) => {
    /*
     * Only authenticated users should be allowed to send chat messages.  We
     * validate the provided token against our user store.  If the token is
     * invalid or absent, notify the sender that they need to log in before
     * sending messages.  Otherwise, broadcast the message to the specified
     * room, attributing it to the authenticated user's username.  This
     * server-side check prevents unauthenticated posts.
     */
    const users = loadJson(USERS_FILE);
    const user  = users.find(u => u.token === token);
    if (!user) {
      // Notify only the sender that they must log in to chat
      socket.emit('message', {
        sender: 'System',
        content: 'You must be logged in to chat. Please sign up or log in.',
        roomId
      });
      return;
    }
    const sender = user.username || 'Anonymous';
    io.to(roomId).emit('message', { sender, content, roomId });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// -----------------------------------------------------------------------------
// Start the server
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Steb.io server running on http://localhost:${PORT}`);
});
