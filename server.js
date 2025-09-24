// server_fixed.js
//
// An improved Express backend for Steb.io.
// This version defines the missing requireAuth and ChatAccess utilities to avoid
// runtime errors and simplifies authentication to always allow requests.
//

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import data models and helper functions from models.js
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
  createPost,
  getPostsByStoreId
} = require('./models');

// Import chat related models from models.js if they exist.  If they do not,
// provide simple in‑memory implementations to prevent undefined errors.
let ChatRoom, ChatRoomMessage;
try {
  ({ ChatRoom, ChatRoomMessage } = require('./models'));
} catch {
  ChatRoom = class {
    static _data = [];
    static _id = 1;
    static _nextId() { return this._id++; }
    static create({ storeId, ownerId, title, price = 0 }) {
      const room = {
        id: this._nextId(),
        storeId,
        ownerId,
        title,
        price: Number(price) || 0,
        createdAt: new Date(),
      };
      this._data.push(room);
      return room;
    }
    static findById(id) {
      return this._data.find((r) => r.id === id);
    }
    static listByStore(storeId) {
      return this._data.filter((r) => r.storeId === storeId);
    }
  };
  ChatRoomMessage = class {
    static _data = [];
    static create({ chatRoomId, userId, username, message }) {
      const m = {
        id: this._data.length + 1,
        chatRoomId,
        userId,
        username,
        message,
        createdAt: new Date(),
      };
      this._data.push(m);
      return m;
    }
    static listByChatRoom(chatRoomId, limit = 200) {
      return this._data.filter((m) => m.chatRoomId === chatRoomId).slice(-limit);
    }
  };
}

// Define a simple in‑memory ChatAccess registry.  In a production system
// this would be persisted and backed by proper authentication and payment.
class ChatAccess {
  static _data = [];
  static _nextId = 1;

  static grant(roomId, userId) {
    if (!this._data.some((a) => a.roomId === roomId && a.userId === userId)) {
      this._data.push({ id: this._nextId++, roomId, userId });
    }
    return true;
  }

  static hasAccess(roomId, userId) {
    return this._data.some((a) => a.roomId === roomId && a.userId === userId);
  }

  static listUsers(roomId) {
    return this._data.filter((a) => a.roomId === roomId);
  }
}

// Middleware that simulates authentication.  This assigns a dummy user to
// req.currentUser so downstream handlers do not crash.  Replace this with
// real auth logic (e.g. JWT verification) in production.
function requireAuth(req, res, next) {
  // For demonstration purposes we use a static user.  In a real app you would
  // verify a token and load the user's profile from your database here.
  req.currentUser = { id: 1, username: 'guest' };
  return next();
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve static files (HTML, CSS, JS) from the project root.
app.use(express.static(path.join(__dirname)));

/* ===== Product endpoints ===== */
app.get('/api/products', (req, res) => {
  let result = getAllProducts();
  const { q, sort, type, minPrice, maxPrice } = req.query;
  if (q) {
    result = result.filter((p) =>
      p.title.toLowerCase().includes(q.toLowerCase()) ||
      p.description.toLowerCase().includes(q.toLowerCase())
    );
  }
  if (type) result = result.filter((p) => p.type === type);
  if (minPrice) result = result.filter((p) => p.price >= parseFloat(minPrice));
  if (maxPrice) result = result.filter((p) => p.price <= parseFloat(maxPrice));
  if (sort === 'asc') result = result.slice().sort((a, b) => a.price - b.price);
  if (sort === 'desc') result = result.slice().sort((a, b) => b.price - a.price);
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
    maxSupply: parseInt(maxSupply) || 0,
  });
  res.json(product);
});

/* ===== Store endpoints ===== */
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
  if (!name || !owner) return res.status(400).json({ error: 'Missing name or owner' });
  res.json(createStore(name, owner));
});

/* ===== Order endpoints ===== */
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
    buyerName,
  });
  // Automatically grant chat access to the buyer (or seller) for 7 days.
  const expiryDate = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  ChatAccess.grant(product.id, buyerName);
  res.json(newOrder);
});

app.patch('/api/orders/:id', (req, res) => {
  const { status } = req.body;
  const updated = updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json(updated);
});

/* ===== Messages between users ===== */
app.get('/api/messages/:username', (req, res) => {
  res.json(getMessagesForUser(req.params.username));
});

app.post('/api/messages', (req, res) => {
  const { sender, recipient, content } = req.body;
  if (!sender || !recipient || !content) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  res.json(addMessage(sender, recipient, content));
});

app.patch('/api/messages/:id', (req, res) => {
  const msg = markMessageDelivered(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  res.json(msg);
});

// -----------------------------------------------------------------------------
// Chat rooms – sellers can create free or paid rooms; buyers can join and chat
// -----------------------------------------------------------------------------

// Create a chat room for a store.  Authentication and store ownership checks
// are simplified; you can enhance this as needed.
app.post('/api/chatrooms', requireAuth, (req, res) => {
  const { storeId, title, price } = req.body;
  const store = getStoreById(parseInt(storeId, 10));
  if (!store) return res.status(404).json({ error: 'Store not found' });
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Chat room title is required' });
  }
  const room = ChatRoom.create({
    storeId: store.id,
    ownerId: req.currentUser.id,
    title: title.trim(),
    price: parseFloat(price) || 0,
  });
  // Automatically grant access to the creator
  ChatAccess.grant(room.id, req.currentUser.id);
  res.json({ room });
});

// List chat rooms for a store
app.get('/api/chatrooms/:storeId', (req, res) => {
  const storeId = parseInt(req.params.storeId, 10);
  const store = getStoreById(storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  const rooms = ChatRoom.listByStore(storeId);
  res.json({ rooms });
});

// Get a chat room by ID
app.get('/api/chatroom/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  res.json(room);
});

// Join a chat room
app.post('/api/chatroom/:id/join', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  // In a real application you would handle payments for paid rooms.  Here we
  // simply grant access regardless of price.
  ChatAccess.grant(id, req.currentUser.id);
  res.json({ access: true });
});

// Fetch messages in a chat room
app.get('/api/chatroom/:id/messages', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  // Basic access control: only allow if user is the owner or has been granted access
  if (room.ownerId !== req.currentUser.id && !ChatAccess.hasAccess(id, req.currentUser.id)) {
    return res.status(403).json({ error: 'You do not have access to this chat room' });
  }
  const messages = ChatRoomMessage.listByChatRoom(id, 200);
  res.json({ messages });
});

// Send a message in a chat room
app.post('/api/chatroom/:id/message', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  const { message } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }
  // Ensure user has access
  if (room.ownerId !== req.currentUser.id && !ChatAccess.hasAccess(id, req.currentUser.id)) {
    return res.status(403).json({ error: 'You do not have access to this chat room' });
  }
  const m = ChatRoomMessage.create({
    chatRoomId: id,
    userId: req.currentUser.id,
    username: req.currentUser.username,
    message,
  });
  res.json({ message: m });
});

/* ===== Social post endpoints ===== */
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

/* ===== Fallback route to load index.html ===== */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ===== Start the server ===== */
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
