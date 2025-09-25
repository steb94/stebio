const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

let { ChatRoom, ChatRoomMessage } = require('./models');
if (!ChatRoom || !ChatRoomMessage) {
  class FallbackChatRoom {
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
        createdAt: new Date()
      };
      this._data.push(room);
      return room;
    }
    static findById(id) {
      return this._data.find(r => r.id === id);
    }
    static listByStore(storeId) {
      return this._data.filter(r => r.storeId === storeId);
    }
  }
  class FallbackChatRoomMessage {
    static _data = [];
    static create({ chatRoomId, userId, username, message }) {
      const m = {
        id: this._data.length + 1,
        chatRoomId,
        userId,
        username,
        message,
        createdAt: new Date()
      };
      this._data.push(m);
      return m;
    }
    static listByChatRoom(chatRoomId, limit = 200) {
      return this._data.filter(m => m.chatRoomId === chatRoomId).slice(-limit);
    }
  }
  ChatRoom = FallbackChatRoom;
  ChatRoomMessage = FallbackChatRoomMessage;
}

class ChatAccess {
  static _data = [];
  static _nextId = 1;
  static grant(roomId, userId) {
    if (!this._data.some(a => a.roomId === roomId && a.userId === userId)) {
      this._data.push({ id: this._nextId++, roomId, userId });
    }
    return true;
  }
  static hasAccess(roomId, userId) {
    return this._data.some(a => a.roomId === roomId && a.userId === userId);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ===== User management ===== */
const USERS_FILE = path.join(__dirname, 'users.json');
let users = [];
try {
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  }
} catch {
  users = [];
}
let nextUserId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
const sessions = {};
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

app.post('/api/users/register', (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
    }
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  const user = { id: nextUserId++, username, password, role: role || 'buyer' };
  users.push(user);
  saveUsers();
  const token = generateToken();
  sessions[token] = user.id;
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/api/users/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = generateToken();
  sessions[token] = user.id;
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/api/users/current', (req, res) => {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'Unauthorized' });
  const token = match[1];
  const userId = sessions[token];
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ id: user.id, username: user.username, role: user.role });
});

app.post('/api/users/logout', (req, res) => {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer (.+)$/);
  if (match) {
    const token = match[1];
    delete sessions[token];
  }
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'Unauthorized' });
  const token = match[1];
  const userId = sessions[token];
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.currentUser = user;
  return next();
}

/* ===== Stats endpoint for homepage ===== */
app.get('/api/stats', (req, res) => {
  res.json({
    totalProducts: getAllProducts().length,
    totalStores: getAllStores().length,
    totalOrders: getAllOrders().length
  });
});

/* ===== Dashboard summary ===== */
app.get('/api/dashboard', requireAuth, (req, res) => {
  const totalSales = getAllOrders().reduce((sum, o) => sum + (o.price || 0), 0);
  const totalOrders = getAllOrders().length;
  const totalProducts = getAllProducts().length;
  res.json({ totalSales, totalOrders, totalProducts });
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
app.post('/api/stores', requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Store name is required' });
  if (req.currentUser.role !== 'seller') {
    return res.status(403).json({ error: 'Only sellers can create a store' });
  }
  const store = createStore(name, req.currentUser.username);
  res.json(store);
});

/* ===== Product endpoints ===== */
app.get('/api/products', (req, res) => {
  let result = getAllProducts();
  const { type, sort } = req.query;
  if (type && type !== 'All') {
    result = result.filter(p => p.type === type);
  }
  if (sort === 'price_asc') result = result.slice().sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') result = result.slice().sort((a, b) => b.price - a.price);
  else if (sort === 'newest') result = result.slice().sort((a, b) => b.id - a.id);
  res.json(result);
});
app.get('/api/products/:id', (req, res) => {
  const prod = getProductById(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Product not found' });
  res.json(prod);
});
app.get('/api/products/search', (req, res) => {
  const query = (req.query.query || '').toLowerCase();
  const sort = req.query.sort || 'newest';
  let results = getAllProducts().filter(p =>
    p.title.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
  );
  if (sort === 'price_asc') results = results.slice().sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') results = results.slice().sort((a, b) => b.price - a.price);
  else results = results.slice().sort((a, b) => b.id - a.id);
  res.json(results);
});
app.post('/api/products', requireAuth, (req, res) => {
  if (req.currentUser.role !== 'seller') {
    return res.status(403).json({ error: 'Only sellers can create products' });
  }
  const { storeId, title, description, image, type, price, maxSupply } = req.body || {};
  if (!storeId || !title || isNaN(parseFloat(price))) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const store = getStoreById(storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  if (store.owner !== req.currentUser.username) {
    return res.status(403).json({ error: 'You do not own this store' });
  }
  const product = createProduct({
    storeId: Number(storeId),
    title,
    description,
    image,
    type,
    price: parseFloat(price),
    maxSupply: maxSupply ? parseInt(maxSupply) : 0
  });
  res.json(product);
});

/* ===== Order endpoints ===== */
app.get('/api/orders', requireAuth, (req, res) => {
  res.json(getAllOrders());
});
app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});
app.post('/api/orders', requireAuth, (req, res) => {
  const { productId } = req.body || {};
  const product = getProductById(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const newOrder = createOrder({
    storeId: product.storeId,
    productId: product.id,
    productName: product.title,
    price: product.price,
    status: 'Processing',
    buyerName: req.currentUser.username
  });
  res.json(newOrder);
});
app.patch('/api/orders/:id', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Status required' });
  const updated = updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json(updated);
});

/* ===== Personal messages ===== */
app.get('/api/messages/:username', requireAuth, (req, res) => {
  res.json(getMessagesForUser(req.params.username));
});
app.post('/api/messages', requireAuth, (req, res) => {
  const { recipient, content } = req.body || {};
  const sender = req.currentUser.username;
  if (!recipient || !content) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  res.json(addMessage(sender, recipient, content));
});
app.patch('/api/messages/:id', requireAuth, (req, res) => {
  const msg = markMessageDelivered(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  res.json(msg);
});

/* ===== Chat room endpoints ===== */
app.post('/api/chatrooms', requireAuth, (req, res) => {
  if (req.currentUser.role !== 'seller') {
    return res.status(403).json({ error: 'Only sellers can create chat rooms' });
  }
  const { storeId, title, price } = req.body || {};
  if (!storeId || !title) return res.status(400).json({ error: 'StoreId and title required' });
  const store = getStoreById(storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  if (store.owner !== req.currentUser.username) {
    return res.status(403).json({ error: 'You do not own this store' });
  }
  const room = ChatRoom.create({
    storeId: Number(storeId),
    ownerId: req.currentUser.id,
    title: title.trim(),
    price: parseFloat(price) || 0
  });
  ChatAccess.grant(room.id, req.currentUser.id);
  res.json({ room });
});
app.get('/api/chatrooms/:storeId', (req, res) => {
  const storeId = parseInt(req.params.storeId, 10);
  const store = getStoreById(storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  const rooms = ChatRoom.listByStore(storeId);
  res.json({ rooms });
});
app.get('/api/chatroom/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  res.json(room);
});
app.post('/api/chatroom/:id/join', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  ChatAccess.grant(id, req.currentUser.id);
  res.json({ access: true });
});
app.get('/api/chatroom/:id/messages', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  if (room.ownerId !== req.currentUser.id && !ChatAccess.hasAccess(id, req.currentUser.id)) {
    return res.status(403).json({ error: 'You do not have access to this chat room' });
  }
  const messages = ChatRoomMessage.listByChatRoom(id, 200);
  res.json({ messages });
});
app.post('/api/chatroom/:id/message', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  const { message } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message required' });
  }
  if (room.ownerId !== req.currentUser.id && !ChatAccess.hasAccess(id, req.currentUser.id)) {
    return res.status(403).json({ error: 'You do not have access to this chat room' });
  }
  const m = ChatRoomMessage.create({
    chatRoomId: id,
    userId: req.currentUser.id,
    username: req.currentUser.username,
    message
  });
  res.json({ message: m });
});

/* ===== Post endpoints ===== */
app.get('/api/posts/:storeId', (req, res) => {
  res.json(getPostsByStoreId(req.params.storeId));
});
app.post('/api/posts/:storeId', requireAuth, (req, res) => {
  const { content, mediaUrl } = req.body || {};
  if (!content && !mediaUrl) {
    return res.status(400).json({ error: 'Post content or media URL required' });
  }
  const storeId = parseInt(req.params.storeId, 10);
  const store = getStoreById(storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  if (store.owner !== req.currentUser.username) {
    return res.status(403).json({ error: 'You do not own this store' });
  }
  const post = createPost(storeId, req.currentUser.username, mediaUrl, content);
  res.json(post);
});

/* ===== Fallback route for SPA ===== */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
