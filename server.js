// server.js – updated backend with persistent storage and role-based user management

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Utility functions for reading/writing JSON files
const dataDir = __dirname;
function loadData(filename) {
  try {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf8');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(`Failed to load ${filename}:`, err.message);
    return [];
  }
}
function saveData(filename, data) {
  try {
    const filePath = path.join(dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Failed to save ${filename}:`, err.message);
  }
}

// In-memory collections backed by JSON files on disk
let users    = loadData('users.json');
let stores   = loadData('stores.json');
let products = loadData('products.json');
let orders   = loadData('orders.json');

// In-memory collections not yet persisted
const chatRooms    = [];
const posts        = [];
const reviewsPages = [];

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// JWT helpers
function generateToken(payload, expiresIn = '30m') {
  const secret = process.env.JWT_SECRET || 'changeme';
  return jwt.sign(payload, secret, { expiresIn });
}

// Basic email sender
async function sendEmail(to, subject, html) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  });
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'Steb.io <no-reply@steb.io>',
      to,
      subject,
      html
    });
    console.log('Sent email to', to);
  } catch (err) {
    console.warn('Failed to send email:', err.message);
  }
}

// Helpers
function findUser(identifier) {
  return users.find(u => u.email === identifier || u.username === identifier);
}
function authMiddleware(req, res, next) {
  const token = (req.headers.authorization || '').replace(/Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/* ========================= User routes ========================= */

// Sign up new user (buyer or seller)
app.post('/api/users/signup', async (req, res) => {
  const { email, username, password, role } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (users.some(u => u.email === email || u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const id = users.length + 1;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id,
    email,
    username,
    passwordHash,
    role: role === 'buyer' ? 'buyer' : 'seller',
    storeId: null,
    verified: false,
    resetToken: null,
    resetExpires: null
  };
  users.push(user);
  saveData('users.json', users);
  const token = generateToken({ userId: user.id }, '30m');
  const verifyUrl = `${process.env.BASE_URL || 'https://stebio.onrender.com'}/verify-email.html?token=${token}`;
  const html = `<h2>Welcome to Steb.io!</h2><p>Please verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
  await sendEmail(email, 'Verify your Steb.io account', html);
  res.json({ message: 'Registration successful. Please check your email to verify your account.' });
});

// Email verification
app.get('/api/users/verify/:token', (req, res) => {
  const { token } = req.params;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    const user = users.find(u => u.id === payload.userId);
    if (!user) throw new Error('User not found');
    user.verified = true;
    saveData('users.json', users);
    res.send('Email verified successfully. You may now log in.');
  } catch {
    res.status(400).send('Verification link invalid or expired.');
  }
});

// Login
app.post('/api/users/login', async (req, res) => {
  const { identifier, password } = req.body;
  const user = findUser(identifier);
  if (!user || !user.verified) {
    return res.status(400).json({ error: 'User not found or not verified' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
  const token = generateToken({ userId: user.id }, '7d');
  res.json({ token, username: user.username, role: user.role, storeId: user.storeId });
});

// Forgot password
app.post('/api/users/forgot', async (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  // Always respond with success to avoid disclosing accounts
  if (!user) return res.json({ message: 'If this email is registered, a reset link has been sent.' });
  const token = generateToken({ userId: user.id }, '1h');
  user.resetToken = token;
  user.resetExpires = Date.now() + 3600000;
  saveData('users.json', users);
  const resetUrl = `${process.env.BASE_URL || 'https://stebio.onrender.com'}/reset-password.html?token=${token}`;
  const html = `<p>You requested a password reset.</p><p>Click to reset: <a href="${resetUrl}">${resetUrl}</a></p>`;
  await sendEmail(email, 'Reset your Steb.io password', html);
  res.json({ message: 'If this email is registered, a reset link has been sent.' });
});

// Reset password
app.post('/api/users/reset', async (req, res) => {
  const { token, password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  let user = null;
  users.forEach(u => {
    if (u.resetToken === token && u.resetExpires > Date.now()) user = u;
  });
  if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });
  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetToken = null;
  user.resetExpires = null;
  saveData('users.json', users);
  res.json({ message: 'Password reset successful. You may now log in.' });
});

/* ========================= Store routes ========================= */

// Create store (sellers only)
app.post('/api/stores', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const user = users.find(u => u.id === req.userId);
  if (!user || user.role !== 'seller') {
    return res.status(400).json({ error: 'Only sellers can create stores' });
  }
  if (user.storeId) return res.status(400).json({ error: 'Store already exists' });
  const id    = stores.length + 1;
  const store = { id, ownerId: user.id, name };
  stores.push(store);
  user.storeId = id;
  saveData('stores.json', stores);
  saveData('users.json', users);
  res.json(store);
});

// Get store by ID
app.get('/api/stores/:id', (req, res) => {
  const storeId = Number(req.params.id);
  const store   = stores.find(s => s.id === storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  const storeProducts = products.filter(p => p.storeId === storeId);
  const storePosts    = posts.filter(p => p.storeId === storeId);
  const storeRooms    = chatRooms.filter(r => r.storeId === storeId);
  res.json({ store, products: storeProducts, posts: storePosts, chatRooms: storeRooms });
});

/* ========================= Product routes ========================= */

// Get all products or by storeId
app.get('/api/products', (req, res) => {
  const { storeId } = req.query;
  if (storeId) {
    return res.json(products.filter(p => p.storeId === Number(storeId)));
  }
  res.json(products);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const prod = products.find(p => p.id === Number(req.params.id));
  if (!prod) return res.status(404).json({ error: 'Not found' });
  res.json(prod);
});

// Create product (sellers only, must have store)
app.post('/api/products', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user || user.role !== 'seller' || !user.storeId) {
    return res.status(400).json({ error: 'Must be a seller with a store' });
  }
  const {
    title, headline, description, imageUrl,
    type, category, pricing, payments,
    features, faqs, advanced
  } = req.body;
  if (!title || !type) {
    return res.status(400).json({ error: 'Title and type required' });
  }
  const id = products.length + 1;
  const product = {
    id,
    storeId: user.storeId,
    title,
    headline: headline || '',
    description: description || '',
    imageUrl: imageUrl || '',
    type,
    category: category || '',
    pricing: Array.isArray(pricing) ? pricing : [],
    payments: payments || {},
    features: Array.isArray(features) ? features : [],
    faqs: Array.isArray(faqs) ? faqs : [],
    advanced: advanced || {}
  };
  products.push(product);
  saveData('products.json', products);
  res.json(product);
});

/* ========================= Order routes ========================= */

// Create order (e.g. after payment)
app.post('/api/orders', authMiddleware, (req, res) => {
  const { productId } = req.body;
  const product = products.find(p => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const id = orders.length + 1;
  const order = { id, userId: req.userId, productId: product.id, purchasedAt: new Date() };
  orders.push(order);
  saveData('orders.json', orders);
  res.json(order);
});

// Get products purchased by logged‑in user
app.get('/api/my-products', authMiddleware, (req, res) => {
  const myOrders = orders.filter(o => o.userId === req.userId);
  const myProducts = myOrders.map(o => {
    const prod = products.find(p => p.id === o.productId);
    if (!prod) return null;
    const firstTier = Array.isArray(prod.pricing) && prod.pricing.length > 0 ? prod.pricing[0] : null;
    const price     = firstTier ? firstTier.price : prod.price || 0;
    return {
      title:    prod.title,
      headline: prod.headline,
      imageUrl: prod.imageUrl,
      price
    };
  }).filter(Boolean);
  res.json(myProducts);
});

/* ========================= Chat, posts and reviews (unchanged) ========================= */

app.post('/api/chatrooms', authMiddleware, (req, res) => {
  const { storeId, title, price } = req.body;
  const user = users.find(u => u.id === req.userId);
  if (!user || user.role !== 'seller' || user.storeId !== Number(storeId)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const id = chatRooms.length + 1;
  chatRooms.push({ id, storeId: Number(storeId), title: title || '', price: Number(price) || 0, messages: [] });
  res.json(chatRooms[chatRooms.length - 1]);
});
app.get('/api/chatrooms/:storeId', (req, res) => {
  const storeId = Number(req.params.storeId);
  const rooms = chatRooms.filter(r => r.storeId === storeId);
  res.json({ rooms });
});
app.post('/api/chatrooms/:id/messages', authMiddleware, (req, res) => {
  const room = chatRooms.find(r => r.id === Number(req.params.id));
  if (!room) return res.status(404).json({ error: 'Not found' });
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  room.messages.push({ id: room.messages.length + 1, userId: req.userId, message, timestamp: new Date() });
  res.json({ message });
});
app.post('/api/posts', authMiddleware, (req, res) => {
  const { storeId, title, content } = req.body;
  const user = users.find(u => u.id === req.userId);
  if (!user || user.role !== 'seller' || user.storeId !== Number(storeId)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const id = posts.length + 1;
  posts.push({ id, storeId: Number(storeId), title: title || '', content: content || '', mediaUrl: '', timestamp: new Date() });
  res.json(posts[posts.length - 1]);
});
app.get('/api/posts/:storeId', (req, res) => {
  const storeId = Number(req.params.storeId);
  const storePosts = posts.filter(p => p.storeId === storeId);
  res.json({ posts: storePosts });
});
app.post('/api/reviews/pages', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = reviewsPages.length + 1;
  reviewsPages.push({ id, name, description: description || '', claimed: false, reviews: [] });
  res.json(reviewsPages[reviewsPages.length - 1]);
});
app.get('/api/reviews/pages/:id', (req, res) => {
  const page = reviewsPages.find(r => r.id === Number(req.params.id));
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});
app.post('/api/reviews/pages/:id', (req, res) => {
  const page = reviewsPages.find(r => r.id === Number(req.params.id));
  if (!page) return res.status(404).json({ error: 'Page not found' });
  const { author, text } = req.body;
  if (!author || !text) return res.status(400).json({ error: 'Author and text required' });
  page.reviews.push({ author, text, createdAt: new Date() });
  res.json({ author, text });
});

/* ========================= Stats and health ========================= */

// Seller dashboard
app.get('/api/dashboard', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user || user.role !== 'seller' || !user.storeId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const storeProducts = products.filter(p => p.storeId === user.storeId);
  const totalSales = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  res.json({ totalSales: totalSales.toFixed(2), totalOrders: orders.length, totalProducts: storeProducts.length });
});

// Overall stats
app.get('/api/stats', (req, res) => {
  res.json({ totalProducts: products.length, totalStores: stores.length, totalOrders: orders.length });
});

// Health check
app.get('/api/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
