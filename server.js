const {
  ChatRoom,
  ChatRoomMessage,
  ChatAccess,
} = require('./models');

// Email/SMS notification helpers (configure your own credentials)
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Configure these environment variables or replace with your own values.
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const twilioSid = process.env.TWILIO_SID;
const twilioToken = process.env.TWILIO_TOKEN;
const twilioFrom = process.env.TWILIO_FROM;

let mailTransporter = null;
if (smtpUser && smtpPass) {
  mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass },
  });
}

function sendEmail(to, subject, text) {
  if (!mailTransporter) {
    console.log(`Email to ${to}: ${subject} – ${text}`);
    return;
  }
  return mailTransporter.sendMail({
    from: smtpUser,
    to,
    subject,
    text,
  }).catch((err) => {
    console.error('Email error:', err);
  });
}

let twilioClient = null;
if (twilioSid && twilioToken) {
  twilioClient = twilio(twilioSid, twilioToken);
}

function sendSms(to, body) {
  if (!twilioClient) {
    console.log(`SMS to ${to}: ${body}`);
    return;
  }
  return twilioClient.messages.create({
    body,
    from: twilioFrom,
    to,
  }).catch((err) => {
    console.error('SMS error:', err);
  });
}

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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serve index.html, css, js, images

/* ===== Product endpoints ===== */
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
    maxSupply: parseInt(maxSupply) || 0
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
    buyerName
  });
  // Grant chat access (default 7 days if not provided)
  const expiry = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  addUserToChat(productId, buyerName, expiry.toISOString());
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
// -----------------------------------------------------------------------------
// Chat rooms – sellers can create free or paid rooms; buyers can join and chat
// -----------------------------------------------------------------------------

// Create a chat room for a store (seller only)
app.post('/api/chatrooms', requireAuth, (req, res) => {
  const { storeId, title, price } = req.body;
  const store = Store.findById(parseInt(storeId, 10));
  if (!store) return res.status(404).json({ error: 'Store not found' });
  // Only the store owner may create rooms
  if (store.ownerId !== req.currentUser.id) {
    return res.status(403).json({ error: 'You do not own this store' });
  }
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Chat room title is required' });
  }
  const room = ChatRoom.create({
    storeId: store.id,
    ownerId: req.currentUser.id,
    title: title.trim(),
    price: parseFloat(price) || 0,
  });
  // Owners automatically have access to their room
  ChatAccess.grant(room.id, req.currentUser.id);
  res.json({ room });
});

// List chat rooms for a store (public)
app.get('/api/chatrooms/:storeId', (req, res) => {
  const storeId = parseInt(req.params.storeId, 10);
  const store = Store.findById(storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  const rooms = ChatRoom.listByStore(storeId);
  res.json({ rooms });
});

// Get a chat room by ID (public)
app.get('/api/chatroom/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  res.json(room);
});

// Join a chat room (requires payment if price > 0)
app.post('/api/chatroom/:id/join', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  // Owners always have access
  if (room.ownerId === req.currentUser.id) {
    ChatAccess.grant(id, req.currentUser.id);
    return res.json({ access: true });
  }
  // Paid rooms require an order – for demo, simply grant access; integrate Stripe etc. here
  if (room.price > 0) {
    // TODO: integrate payment gateway here (e.g. Stripe checkout)
    // After successful payment, grant access:
    ChatAccess.grant(id, req.currentUser.id);
    return res.json({ access: true });
  }
  // Free room: grant access instantly
  ChatAccess.grant(id, req.currentUser.id);
  res.json({ access: true });
});

// Fetch messages in a chat room (requires access)
app.get('/api/chatroom/:id/messages', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  const userId = req.currentUser.id;
  if (room.ownerId !== userId && room.price > 0 && !ChatAccess.hasAccess(id, userId)) {
    return res.status(403).json({ error: 'You do not have access to this chat room' });
  }
  const messages = ChatRoomMessage.listByChatRoom(id, 200);
  res.json({ messages });
});

// Send a message in a chat room (requires access)
app.post('/api/chatroom/:id/message', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const room = ChatRoom.findById(id);
  if (!room) return res.status(404).json({ error: 'Chat room not found' });
  const { message } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }
  const userId = req.currentUser.id;
  if (room.ownerId !== userId && room.price > 0 && !ChatAccess.hasAccess(id, userId)) {
    return res.status(403).json({ error: 'You do not have access to this chat room' });
  }
  const m = ChatRoomMessage.create({
    chatRoomId: id,
    userId,
    username: req.currentUser.username,
    message,
  });
  // Notify all participants except the sender
  const participants = ChatAccess.listUsers(id).filter((a) => a.userId !== userId);
  participants.forEach((a) => {
    const user = User.findById(a.userId);
    if (!user) return;
    const subject = `New message in chat: ${room.title}`;
    const text = `${req.currentUser.username} wrote: ${message}`;
    if (user.email) {
      sendEmail(user.email, subject, text);
    }
    if (user.phone) {
      sendSms(user.phone, text);
    }
  });
  res.json({ message: m });
});

/* ===== Chat endpoints ===== */
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

/* ===== Post endpoints ===== */
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
