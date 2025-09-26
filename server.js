/**
 * server.js – complete Node.js backend for Steb.io
 *
 * This server handles user registration with email verification,
 * secure login, store and product management (including chat rooms as products),
 * posts, chat room messaging, and a Yelp‑style review system.
 *
 * Before running, install dependencies:
 *   npm install express body-parser cors bcryptjs jsonwebtoken nodemailer
 *
 * You must also configure environment variables for JWT_SECRET and your SMTP credentials:
 *   JWT_SECRET – secret key for signing verification and session tokens
 *   SMTP_HOST  – your email host (e.g. smtp.gmail.com)
 *   SMTP_PORT  – SMTP port (e.g. 587)
 *   SMTP_USER  – email username
 *   SMTP_PASS  – email password or app password
 *   MAIL_FROM  – from address for outgoing mail (e.g. "Steb.io <no-reply@steb.io>")
 */

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
app.use(express.static(__dirname)); // serve static files from project root

// In‑memory data stores (replace with database in production)
const users = [];        // { id, email, username, passwordHash, role, storeId, verified }
const stores = [];       // { id, ownerId, name }
const products = [];     // { id, storeId, title, description, image, type, price, supply, chatRoomId }
const chatRooms = [];    // { id, storeId, title, price, messages: [{ username, message, createdAt }] }
const posts = [];        // { storeId, posts: [{ content, mediaUrl, createdAt }] }
const reviews = [];      // { id, name, description, claimed, reviews: [{ author, text, createdAt }] }

/**
 * Generate a JWT token for email verification or sessions.
 * @param {Object} payload – data to encode (e.g. userId)
 * @param {String} expiresIn – token expiry (e.g. "30m", "7d")
 */
function generateToken(payload, expiresIn = '30m') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Send a verification email with Nodemailer.
 * You must set SMTP_* env vars (see top of file).
 */
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

  const verificationUrl = `${process.env.BASE_URL || 'https://stebio.onrender.com'}/api/users/verify/${token}`;
  const mailOptions = {
    from: process.env.MAIL_FROM || 'Steb.io <no-reply@steb.io>',
    to: email,
    subject: 'Verify your Steb.io account',
    html: `
      <h2>Welcome to Steb.io!</h2>
      <p>Thanks for registering. Please click the link below to verify your email address:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>This link will expire in 30 minutes.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Helper to find user by username or email
function findUserByIdentifier(identifier) {
  return users.find(u => u.username === identifier || u.email === identifier);
}

// Middleware to authenticate using the session token
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/* ========== User Routes ========== */

/**
 * Register a new user.
 * Requires email, username, password. Sends a verification email.
 */
app.post('/api/users/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username and password are required' });
  }
  if (users.some(u => u.email === email || u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = users.length + 1;
  const newUser = {
    id: userId,
    email,
    username,
    passwordHash,
    role: 'seller',
    storeId: null,
    verified: false
  };
  users.push(newUser);
  // Generate verification token and send email
  const token = generateToken({ userId }, '30m');
  try {
    await sendVerificationEmail(email, token);
  } catch (err) {
    console.error('Error sending verification email:', err.message);
    return res.status(500).json({ error: 'Failed to send verification email' });
  }
  res.json({ message: 'Registration successful. Please check your email for verification link.' });
});

/**
 * Verify a user via email token.
 */
app.get('/api/users/verify/:token', (req, res) => {
  const { token } = req.params;
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(400).send('Invalid verification token.');
    }
    user.verified = true;
    res.send('Email verified! You may now log in.');
  } catch (err) {
    return res.status(400).send('Verification link is invalid or has expired.');
  }
});

/**
 * Login a user (email or username) and return a session token.
 * Only verified users can log in.
 */
app.post('/api/users/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email/username and password are required' });
  }
  const user = findUserByIdentifier(identifier);
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }
  if (!user.verified) {
    return res.status(403).json({ error: 'Please verify your email before logging in' });
  }
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  const token = generateToken({ userId: user.id }, '7d');
  res.json({
    token,
    username: user.username,
    role: user.role,
    storeId: user.storeId
  });
});

/* ========== Store Routes ========== */

/**
 * Create a store. User must be authenticated.
 */
app.post('/api/stores', authMiddleware, (req, res) => {
  const { name } = req.body;
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(401).json({ error: 'Invalid user' });
  }
  if (user.storeId) {
    return res.status(400).json({ error: 'User already has a store' });
  }
  const storeId = stores.length + 1;
  const store = { id: storeId, ownerId: user.id, name };
  stores.push(store);
  user.storeId = storeId;
  res.json({ id: storeId, name });
});

/* ========== Product Routes ========== */

/**
 * Get all products.
 */
app.get('/api/products', (req, res) => {
  res.json({ products });
});

/**
 * Get a single product by ID.
 */
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === Number(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

/**
 * Create a product. User must own a store.
 */
app.post('/api/products', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user || !user.storeId) {
    return res.status(400).json({ error: 'You must create a store first' });
  }
  const { title, description, image, type, price, supply } = req.body;
  const productId = products.length + 1;
  let chatRoomId = null;
  // If product type is ChatRoom, create a chat room and assign its ID to the product
  if (type === 'ChatRoom') {
    chatRoomId = chatRooms.length + 1;
    chatRooms.push({
      id: chatRoomId,
      storeId: user.storeId,
      title,
      price,
      messages: []
    });
  }
  const product = {
    id: productId,
    storeId: user.storeId,
    title,
    description: description || '',
    image: image || '',
    type,
    price: Number(price) || 0,
    supply: supply || null,
    chatRoomId
  };
  products.push(product);
  res.json(product);
});

/* ========== Chat Room Routes ========== */

/**
 * Get chat rooms for a store.
 */
app.get('/api/chatrooms/:storeId', (req, res) => {
  const storeRooms = chatRooms.filter(r => r.storeId === Number(req.params.storeId));
  res.json({ rooms: storeRooms });
});

/**
 * Create a chat room manually (not via product). Requires storeId.
 */
app.post('/api/chatrooms', authMiddleware, (req, res) => {
  const { storeId, title, price } = req.body;
  const user = users.find(u => u.id === req.userId);
  if (!user || user.storeId !== Number(storeId)) {
    return res.status(403).json({ error: 'Not authorized to create chat room' });
  }
  const roomId = chatRooms.length + 1;
  const room = { id: roomId, storeId: Number(storeId), title, price: Number(price) || 0, messages: [] };
  chatRooms.push(room);
  res.json(room);
});

/**
 * Get messages for a chat room.
 */
app.get('/api/chatrooms/:id/messages', (req, res) => {
  const room = chatRooms.find(r => r.id === Number(req.params.id));
  if (!room) {
    return res.status(404).json({ error: 'Chat room not found' });
  }
  res.json({ messages: room.messages });
});

/**
 * Post a new message to a chat room.
 * Requires auth; username comes from req.userId.
 */
app.post('/api/chatrooms/:id/message', authMiddleware, (req, res) => {
  const room = chatRooms.find(r => r.id === Number(req.params.id));
  if (!room) {
    return res.status(404).json({ error: 'Chat room not found' });
  }
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(401).json({ error: 'Invalid user' });
  }
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  const newMsg = { username: user.username, message, createdAt: new Date() };
  room.messages.push(newMsg);
  res.json(newMsg);
});

/* ========== Post Routes ========== */

/**
 * Get posts for a store.
 */
app.get('/api/posts/:storeId', (req, res) => {
  const entry = posts.find(p => p.storeId === Number(req.params.storeId));
  res.json({ posts: entry ? entry.posts : [] });
});

/**
 * Create a post for a store (requires auth and store ownership).
 */
app.post('/api/posts/:storeId', authMiddleware, (req, res) => {
  const { storeId } = req.params;
  const { content, mediaUrl } = req.body;
  const user = users.find(u => u.id === req.userId);
  if (!user || user.storeId !== Number(storeId)) {
    return res.status(403).json({ error: 'Not authorized to post to this store' });
  }
  let entry = posts.find(p => p.storeId === Number(storeId));
  if (!entry) {
    entry = { storeId: Number(storeId), posts: [] };
    posts.push(entry);
  }
  const newPost = { content: content || '', mediaUrl: mediaUrl || '', createdAt: new Date() };
  entry.posts.push(newPost);
  res.json(newPost);
});

/* ========== Review Routes ========== */

/**
 * Create a new review page (unclaimed).
 */
app.post('/api/reviews/page', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const id = reviews.length + 1;
  const page = { id, name, description: description || '', claimed: false, reviews: [] };
  reviews.push(page);
  res.json(page);
});

/**
 * Get a review page by ID.
 */
app.get('/api/reviews/page/:id', (req, res) => {
  const page = reviews.find(r => r.id === Number(req.params.id));
  if (!page) {
    return res.status(404).send('Not found');
  }
  res.json(page);
});

/**
 * Add a review to a page.
 */
app.post('/api/reviews/:id', (req, res) => {
  const page = reviews.find(r => r.id === Number(req.params.id));
  if (!page) {
    return res.status(404).json({ error: 'Review page not found' });
  }
  const { author, text } = req.body;
  if (!author || !text) {
    return res.status(400).json({ error: 'Author and text are required' });
  }
  const review = { author, text, createdAt: new Date() };
  page.reviews.push(review);
  res.json(review);
});

/* ========== Dashboard & Stats Routes ========== */

/**
 * Get dashboard summary for a seller (must own a store).
 */
app.get('/api/dashboard', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user || !user.storeId) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const userStoreId = user.storeId;
  const totalOrders = 0; // orders not implemented; placeholder
  const storeProducts = products.filter(p => p.storeId === userStoreId);
  const totalSales = storeProducts.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  res.json({
    totalSales: totalSales.toFixed(2),
    totalOrders,
    totalProducts: storeProducts.length
  });
});

/**
 * General stats for homepage (total products, stores, orders).
 */
app.get('/api/stats', (req, res) => {
  res.json({
    totalProducts: products.length,
    totalStores: stores.length,
    totalOrders: 0 // orders not implemented
  });
});

/**
 * Health check endpoint.
 */
app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
