// server.js – complete Node.js backend for Steb.io
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // serve static files

// In-memory data stores (use a database in production)
const users = [];    // { id, email, username, passwordHash, role, storeId, verified }
const stores = [];   // { id, ownerId, name }
const products = []; // { id, storeId, title, description, image, type, price, supply, chatRoomId }
const chatRooms = [];// { id, storeId, title, price, messages: [] }
const posts = [];    // { storeId, posts: [] }
const reviewsPages = []; // { id, name, description, claimed, reviews: [] }

/* Helper functions */
function generateToken(payload, expiresIn = '30m') {
  return jwt.sign(payload, process.env.JWT_SECRET || 'changeme', { expiresIn });
}
async function sendVerificationEmail(email, token) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  const url = `${process.env.BASE_URL || 'https://stebio.onrender.com'}/api/users/verify/${token}`;
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'Steb.io <no-reply@steb.io>',
    to: email,
    subject: 'Verify your Steb.io account',
    html: `<p>Click to verify: <a href="${url}">${url}</a></p>`
  });
}
function findUser(identifier) {
  return users.find(u => u.username === identifier || u.email === identifier);
}
function authMiddleware(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/* User routes */
app.post('/api/users/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) return res.status(400).json({ error: 'Missing fields' });
  if (users.some(u => u.email === email || u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const id = users.length + 1;
  const passwordHash = await bcrypt.hash(password, 10);
  users.push({ id, email, username, passwordHash, role: 'seller', storeId: null, verified: false });
  const token = generateToken({ userId: id }, '30m');
  try {
    await sendVerificationEmail(email, token);
    res.json({ message: 'Check your email for verification link' });
  } catch {
    res.status(500).json({ error: 'Email sending failed' });
  }
});
app.get('/api/users/verify/:token', (req, res) => {
  try {
    const { userId } = jwt.verify(req.params.token, process.env.JWT_SECRET || 'changeme');
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(400).send('Invalid token');
    user.verified = true;
    res.send('Email verified! You may now log in.');
  } catch {
    res.status(400).send('Token invalid or expired');
  }
});
app.post('/api/users/login', async (req, res) => {
  const { identifier, password } = req.body;
  const user = findUser(identifier);
  if (!user || !user.verified) return res.status(400).json({ error: 'User not found or not verified' });
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(400).json({ error: 'Invalid credentials' });
  const token = generateToken({ userId: user.id }, '7d');
  res.json({ token, username: user.username, role: user.role, storeId: user.storeId });
});

/* Store routes */
app.post('/api/stores', authMiddleware, (req, res) => {
  const { name } = req.body;
  const user = users.find(u => u.id === req.userId);
  if (!user || user.storeId) return res.status(400).json({ error: 'Cannot create store' });
  const id = stores.length + 1;
  stores.push({ id, ownerId: user.id, name });
  user.storeId = id;
  res.json({ id, name });
});
app.get('/api/stores/:id', (req, res) => {
  const store = stores.find(s => s.id === Number(req.params.id));
  if (!store) return res.status(404).json({ error: 'Store not found' });
  const storeProducts = products.filter(p => p.storeId === store.id);
  const storePosts = posts.find(p => p.storeId === store.id) || { posts: [] };
  const storeRooms = chatRooms.filter(r => r.storeId === store.id);
  res.json({ store, products: storeProducts, posts: storePosts.posts, chatRooms: storeRooms });
});

/* Product routes */
app.get('/api/products', (req, res) => res.json({ products }));
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});
app.post('/api/products', authMiddleware, (req, res) => {
  const { title, description, image, type, price, supply } = req.body;
  const user = users.find(u => u.id === req.userId);
  if (!user || !user.storeId) return res.status(400).json({ error: 'Must have a store' });
  let chatRoomId = null;
  if (type === 'ChatRoom') {
    chatRoomId = chatRooms.length + 1;
    chatRooms.push({ id: chatRoomId, storeId: user.storeId, title, price: Number(price) || 0, messages: [] });
  }
  const id = products.length + 1;
  products.push({ id, storeId: user.storeId, title, description: description || '', image: image || '', type, price: Number(price) || 0, supply: supply || null, chatRoomId });
  res.json(products[products.length - 1]);
});

/* Chat room routes */
app.get('/api/chatrooms/:storeId', (req, res) => {
  const rooms = chatRooms.filter(r => r.storeId === Number(req.params.storeId));
  res.json({ rooms });
});
app.post('/api/chatrooms', authMiddleware, (req, res) => {
  const { storeId, title, price } = req.body;
  const user = users.find(u => u.id === req.userId);
  if (!user || user.storeId !== Number(storeId)) return res.status(403).json({ error: 'Not authorized' });
  const id = chatRooms.length + 1;
  chatRooms.push({ id, storeId: Number(storeId), title, price: Number(price) || 0, messages: [] });
  res.json(chatRooms[chatRooms.length - 1]);
});
app.get('/api/chatrooms/:id/messages', (req, res) => {
  const room = chatRooms.find(r => r.id === Number(req.params.id));
  if (!room) return res.status(404).json({ error: 'Not found' });
  res.json({ messages: room.messages });
});
app.post('/api/chatrooms/:id/message', authMiddleware, (req, res) => {
  const room = chatRooms.find(r => r.id === Number(req.params.id));
  const user = users.find(u => u.id === req.userId);
  if (!room || !user) return res.status(404).json({ error: 'Not found' });
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  const msg = { username: user.username, message, createdAt: new Date() };
  room.messages.push(msg);
  res.json(msg);
});

/* Post routes */
app.get('/api/posts/:storeId', (req, res) => {
  const entry = posts.find(p => p.storeId === Number(req.params.storeId));
  res.json({ posts: entry ? entry.posts : [] });
});
app.post('/api/posts/:storeId', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user || user.storeId !== Number(req.params.storeId)) return res.status(403).json({ error: 'Not allowed' });
  let entry = posts.find(p => p.storeId === Number(req.params.storeId));
  if (!entry) {
    entry = { storeId: Number(req.params.storeId), posts: [] };
    posts.push(entry);
  }
  const newPost = { content: req.body.content || '', mediaUrl: req.body.mediaUrl || '', createdAt: new Date() };
  entry.posts.push(newPost);
  res.json(newPost);
});

/* Reviews routes */
app.post('/api/reviews/page', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = reviewsPages.length + 1;
  reviewsPages.push({ id, name, description: description || '', claimed: false, reviews: [] });
  res.json(reviewsPages[reviewsPages.length - 1]);
});
app.get('/api/reviews/page/:id', (req, res) => {
  const page = reviewsPages.find(r => r.id === Number(req.params.id));
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});
app.post('/api/reviews/:id', (req, res) => {
  const page = reviewsPages.find(r => r.id === Number(req.params.id));
  if (!page) return res.status(404).json({ error: 'Page not found' });
  const { author, text } = req.body;
  if (!author || !text) return res.status(400).json({ error: 'Author and text required' });
  page.reviews.push({ author, text, createdAt: new Date() });
  res.json({ author, text });
});

/* Dashboard & stats */
app.get('/api/dashboard', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user || !user.storeId) return res.status(403).json({ error: 'Unauthorized' });
  const userProducts = products.filter(p => p.storeId === user.storeId);
  const totalSales = userProducts.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  res.json({ totalSales: totalSales.toFixed(2), totalOrders: 0, totalProducts: userProducts.length });
});
app.get('/api/stats', (req, res) => {
  res.json({ totalProducts: products.length, totalStores: stores.length, totalOrders: 0 });
});
app.get('/api/ping', (req, res) => res.send('pong'));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
