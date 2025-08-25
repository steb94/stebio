/*
 * server.js
 *
 * The main entry point for the STEB.IO backend. This Express server
 * exposes RESTful endpoints for user authentication, store and product
 * management, checkout flows, affiliate tracking, support tickets and
 * more. For a full production deployment you would split these
 * responsibilities into multiple files and add persistent storage,
 * validation and proper error handling. This demonstration focuses
 * on clarity and simplicity.
 */

const express = require('express');
const cors = require('cors');
const {
  User,
  Store,
  Product,
  Order,
  AffiliateReferral,
  SupportTicket,
  randomToken,
} = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Use CORS to allow requests from the front‑end (e.g. http://localhost:3001)
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// In‑memory session storage: maps session tokens to user IDs. In a
// real application you should use secure HTTP‑only cookies and a
// persistent session store (e.g. Redis).
const sessions = {};

/**
 * Authentication middleware
 *
 * Checks for an Authorization header with a Bearer token. If the
 * token matches a stored session, attaches the corresponding user
 * object to req.currentUser. Otherwise, responds with 401.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.split(' ')[1];
  const userId = sessions[token];
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const user = User.findById(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.currentUser = user;
  req.token = token;
  next();
}

/**
 * Registers a new user.
 *
 * Expects JSON body: { email, password, name, isSeller }
 * Optionally accepts a referral code in the query string (?ref=CODE)
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, isSeller } = req.body;
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: 'Email, password and name are required' });
    }
    const user = await User.create({
      email,
      password,
      name,
      isSeller: !!isSeller,
    });
    // If there is a referral code, record it
    const refCode = req.query.ref;
    if (refCode) {
      const referrer = User._data.find((u) => u.referralCode === refCode);
      if (referrer) {
        AffiliateReferral.create({
          referrerId: referrer.id,
          referredUserId: user.id,
        });
      }
    }
    // Log the user in by generating a session token
    const token = randomToken(24);
    sessions[token] = user.id;
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSeller: user.isSeller,
        referralCode: user.referralCode,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Logs a user in.
 *
 * Expects JSON body: { email, password }
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required' });
    }
    const user = await User.verify(email, password);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const token = randomToken(24);
    sessions[token] = user.id;
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSeller: user.isSeller,
        referralCode: user.referralCode,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Returns the current logged in user's profile.
 */
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = req.currentUser;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    referralCode: user.referralCode,
  });
});

/**
 * Logout: invalidates the current session token.
 */
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = req.token;
  delete sessions[token];
  res.json({ success: true });
});

/**
 * Creates a new store for the current user.
 *
 * Expects JSON body: { name, description, category, bannerImage }
 */
app.post('/api/store', requireAuth, (req, res) => {
  try {
    const { name, description, category, bannerImage } = req.body;
    if (!name || !category) {
      return res
        .status(400)
        .json({ error: 'Name and category are required' });
    }
    const store = Store.create({
      ownerId: req.currentUser.id,
      name,
      description: description || '',
      category,
      bannerImage: bannerImage || '',
    });
    res.json({ store });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Updates the logged in user's store. Only store owners may update their
 * own store.
 */
app.put('/api/store/:id', requireAuth, (req, res) => {
  const store = Store.findById(parseInt(req.params.id));
  if (!store) {
    return res.status(404).json({ error: 'Store not found' });
  }
  if (store.ownerId !== req.currentUser.id) {
    return res
      .status(403)
      .json({ error: 'You are not the owner of this store' });
  }
  const { name, description, category, bannerImage } = req.body;
  store.update({
    name: name || store.name,
    description: description || store.description,
    category: category || store.category,
    bannerImage: bannerImage || store.bannerImage,
  });
  res.json({ store });
});

/**
 * Returns a list of all stores. Supports optional query parameters:
 *   category: filter by category
 *   q: search term in store name or description
 */
app.get('/api/stores', (req, res) => {
  const { category, q } = req.query;
  let stores = Store.findAll();
  if (category) {
    stores = stores.filter(
      (s) => s.category.toLowerCase() === category.toLowerCase()
    );
  }
  if (q) {
    const term = q.toLowerCase();
    stores = stores.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term)
    );
  }
  // Include basic product listing in the response
  const result = stores.map((s) => ({
    ...s,
    products: Product.findByStore(s.id),
  }));
  res.json({ stores: result });
});

/**
 * Returns a single store by ID with its products.
 */
app.get('/api/stores/:id', (req, res) => {
  const store = Store.findById(parseInt(req.params.id));
  if (!store) {
    return res.status(404).json({ error: 'Store not found' });
  }
  const products = Product.findByStore(store.id);
  res.json({ store, products });
});

/**
 * Creates a new product within the current user's store.
 *
 * Expects JSON body: { storeId, title, description, price, type, billingInterval, trialDays, deliverables, affiliatePercent }
 */
app.post('/api/products', requireAuth, (req, res) => {
  try {
    const {
      storeId,
      title,
      description,
      price,
      type,
      billingInterval,
      trialDays,
      deliverables,
      affiliatePercent,
    } = req.body;
    const store = Store.findById(parseInt(storeId));
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    if (store.ownerId !== req.currentUser.id) {
      return res.status(403).json({ error: 'You do not own this store' });
    }
    if (!title || !price || !type) {
      return res
        .status(400)
        .json({ error: 'Title, price and type are required' });
    }
    const product = Product.create({
      storeId: store.id,
      title,
      description: description || '',
      price: Number(price),
      type,
      billingInterval:
        type === 'subscription' ? billingInterval || 'monthly' : null,
      trialDays: type === 'subscription' ? trialDays || null : null,
      deliverables: deliverables || [],
      affiliatePercent: affiliatePercent || 5,
    });
    res.json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Returns a product by ID.
 */
app.get('/api/products/:id', (req, res) => {
  const product = Product.findById(parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  const store = Store.findById(product.storeId);
  res.json({ product, store });
});

/**
 * Discover endpoint: returns a list of featured and new products.
 * For demonstration, we simply return all products sorted by ID.
 */
app.get('/api/marketplace/discover', (req, res) => {
  const products = Product.findAll();
  // In a real implementation you would select featured items based on
  // seller preferences or admin curation. Here we just return the
  // latest products as 'new' and the first few as 'featured'.
  const featured = products.slice(0, 5);
  const newest = [...products].reverse().slice(0, 10);
  res.json({ featured, newest });
});

/**
 * Creates a new order (checkout). This endpoint simulates the
 * checkout process. In a real implementation you would call Stripe
 * or PayPal to create a payment session and listen for webhooks to
 * confirm payment before activating the order. Here we assume the
 * payment succeeds immediately. Referral codes can be provided in
 * the body to attribute commissions.
 *
 * Expects JSON body: { productId, referralCode }
 */
app.post('/api/checkout', requireAuth, (req, res) => {
  const { productId, referralCode } = req.body;
  const product = Product.findById(parseInt(productId));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  // Determine affiliate referrer if a referral code is provided
  let referrerId = null;
  let commissionAmount = 0;
  if (referralCode) {
    const referrer = User._data.find((u) => u.referralCode === referralCode);
    if (referrer && referrer.id !== req.currentUser.id) {
      referrerId = referrer.id;
      commissionAmount = (
        product.price *
        (product.affiliatePercent / 100)
      ).toFixed(2);
      AffiliateReferral.create({
        referrerId,
        referredUserId: req.currentUser.id,
      });
    }
  }
  // Create order with status 'active' (simulate payment success)
  const now = new Date();
  let nextBillingAt = null;
  if (product.type === 'subscription') {
    // Set next billing date based on interval
    nextBillingAt = new Date(now.getTime());
    if (product.billingInterval === 'monthly') {
      nextBillingAt.setMonth(nextBillingAt.getMonth() + 1);
    } else if (product.billingInterval === 'yearly') {
      nextBillingAt.setFullYear(nextBillingAt.getFullYear() + 1);
    }
  }
  // Copy deliverables and assign license keys if present
  const deliverables = product.deliverables.map((d) => {
    // For license keys we simulate assignment by popping from a list
    if (d.type === 'license_keys' && Array.isArray(d.details.keys)) {
      const key = d.details.keys.shift();
      return { type: 'license_key', key };
    }
    return d;
  });
  const order = Order.create({
    userId: req.currentUser.id,
    productId: product.id,
    price: product.price,
    status: 'active',
    nextBillingAt,
    deliverables,
    affiliateReferrerId: referrerId,
    affiliateCommission: parseFloat(commissionAmount),
  });
  // In a real implementation you would grant access to deliverables here:
  // e.g. call Discord API to assign roles, send Telegram invites, etc.
  res.json({ order });
});

/**
 * Returns the authenticated user's orders (subscriptions and one‑time purchases).
 */
app.get('/api/orders', requireAuth, (req, res) => {
  const orders = Order.findByUser(req.currentUser.id);
  // Include product details for convenience
  const detailed = orders.map((o) => {
    const product = Product.findById(o.productId);
    return { ...o, product };
  });
  res.json({ orders: detailed });
});

/**
 * Cancels a subscription. Sets order status to cancelled and ends
 * access immediately. In a real implementation you would cancel the
 * subscription in Stripe and schedule role removal.
 */
app.post('/api/orders/:id/cancel', requireAuth, (req, res) => {
  const order = Order.findById(parseInt(req.params.id));
  if (!order || order.userId !== req.currentUser.id) {
    return res.status(404).json({ error: 'Order not found' });
  }
  const product = Product.findById(order.productId);
  if (product.type !== 'subscription') {
    return res.status(400).json({ error: 'Only subscriptions can be cancelled' });
  }
  order.update({
    status: 'cancelled',
    endedAt: new Date(),
    nextBillingAt: null,
  });
  // In a real implementation you would remove roles or revoke access here
  res.json({ order });
});

/**
 * Returns affiliate stats for the current user.
 */
app.get('/api/affiliates/stats', requireAuth, (req, res) => {
  const referrals = AffiliateReferral.findByReferrer(req.currentUser.id);
  // Compute earnings from orders
  const orders = Order.findAll().filter(
    (o) => o.affiliateReferrerId === req.currentUser.id
  );
  const totalEarned = orders.reduce(
    (sum, o) => sum + o.affiliateCommission,
    0
  );
  res.json({
    referrals: referrals.length,
    earnings: totalEarned.toFixed(2),
  });
});

/**
 * Submits a support ticket. Expects JSON body: { subject, message }
 */
app.post('/api/support', requireAuth, (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res
      .status(400)
      .json({ error: 'Subject and message are required' });
  }
  const ticket = SupportTicket.create({
    userId: req.currentUser.id,
    subject,
    message,
  });
  res.json({ ticket });
});

/**
 * Lists support tickets for the current user. In a full implementation
 * admin users would be able to view all tickets.
 */
app.get('/api/support', requireAuth, (req, res) => {
  const tickets = SupportTicket.findByUser(req.currentUser.id);
  res.json({ tickets });
});

// Default route
app.get('/', (req, res) => {
  res.send('STEB.IO backend is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`STEB.IO backend listening on port ${PORT}`);
});
/*
 * models.js
 *
 * This file defines simple in-memory models for STEB.IO. In a real
 * deployment you would back these models with a proper database
 * (e.g. PostgreSQL, MySQL, MongoDB, etc.), but for demonstration
 * purposes we store data in arrays. Each class provides static
 * methods to create, find and update records. IDs are auto-incremented.
 */

const crypto = require('crypto');

// Helper to generate unique IDs. In a database this would be handled
// automatically. Here we use a simple incrementing counter per model.
function idGenerator() {
  let id = 1;
  return () => id++;
}

// Helper to securely hash passwords. Uses Node's built in crypto module
// with PBKDF2. Returns a promise that resolves to a hex encoded hash.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      100000,
      64,
      'sha512',
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      }
    );
  });
}

// Helper to verify a password against a stored hash. Splits the
// stored value into salt and hash, then runs PBKDF2 again.
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      100000,
      64,
      'sha512',
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(hash === derivedKey.toString('hex'));
      }
    );
  });
}

// Helper to generate a random token string. Used for session tokens
// and affiliate codes. Uses URL safe base64 encoding.
function randomToken(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * User model
 *
 * Fields:
 *   id: integer primary key
 *   email: string
 *   passwordHash: string (salt:hash)
 *   name: string
 *   isSeller: boolean
 *   discordId: string | null (linked Discord account ID)
 *   telegramUsername: string | null
 *   referralCode: string (unique code generated on creation)
 */
class User {
  static _generateId = idGenerator();
  static _data = [];

  constructor({
    id,
    email,
    passwordHash,
    name,
    isSeller = false,
    discordId = null,
    telegramUsername = null,
    referralCode,
  }) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
    this.name = name;
    this.isSeller = isSeller;
    this.discordId = discordId;
    this.telegramUsername = telegramUsername;
    this.referralCode = referralCode;
  }

  static async create({ email, password, name, isSeller = false }) {
    // ensure email uniqueness
    const existing = User._data.find((u) => u.email === email);
    if (existing) throw new Error('User with this email already exists');
    const passwordHash = await hashPassword(password);
    const id = User._generateId();
    const referralCode = randomToken(6);
    const user = new User({
      id,
      email,
      passwordHash,
      name,
      isSeller,
      referralCode,
    });
    User._data.push(user);
    return user;
  }

  static findByEmail(email) {
    return User._data.find((u) => u.email === email);
  }

  static findById(id) {
    return User._data.find((u) => u.id === id);
  }

  static async verify(email, password) {
    const user = User.findByEmail(email);
    if (!user) return null;
    const ok = await verifyPassword(password, user.passwordHash);
    return ok ? user : null;
  }
}

/**
 * Store model
 *
 * Represents a seller's store. Each user can own at most one store for
 * simplicity (but you could allow multiple stores per user). Stores
 * contain products.
 *
 * Fields:
 *   id: integer primary key
 *   ownerId: reference to User
 *   name: string
 *   description: string
 *   category: string
 *   bannerImage: string (URL or file path)
 */
class Store {
  static _generateId = idGenerator();
  static _data = [];

  constructor({ id, ownerId, name, description, category, bannerImage }) {
    this.id = id;
    this.ownerId = ownerId;
    this.name = name;
    this.description = description;
    this.category = category;
    this.bannerImage = bannerImage;
  }

  static create({ ownerId, name, description, category, bannerImage }) {
    // ensure user does not already have a store
    const existing = Store._data.find((s) => s.ownerId === ownerId);
    if (existing) throw new Error('User already has a store');
    const id = Store._generateId();
    const store = new Store({
      id,
      ownerId,
      name,
      description,
      category,
      bannerImage,
    });
    Store._data.push(store);
    return store;
  }

  static findById(id) {
    return Store._data.find((s) => s.id === id);
  }

  static findAll() {
    return Store._data;
  }

  static findByOwner(ownerId) {
    return Store._data.find((s) => s.ownerId === ownerId);
  }

  update(fields) {
    Object.assign(this, fields);
  }
}

/**
 * Product model
 *
 * A product belongs to a store and describes something a buyer can
 * purchase. It can represent a subscription (recurring) or a one-time
 * purchase. Products may include multiple deliverables, such as
 * downloadable files, Discord roles, Telegram access, or license keys.
 *
 * Fields:
 *   id: integer primary key
 *   storeId: reference to Store
 *   title: string
 *   description: string
 *   price: number (in USD for demonstration)
 *   type: 'subscription' | 'one_time'
 *   billingInterval: 'monthly' | 'yearly' | null
 *   trialDays: number | null
 *   deliverables: array of { type: string, details: object }
 *   affiliatePercent: number (0–100)
 */
class Product {
  static _generateId = idGenerator();
  static _data = [];

  constructor({
    id,
    storeId,
    title,
    description,
    price,
    type,
    billingInterval = null,
    trialDays = null,
    deliverables = [],
    affiliatePercent = 5,
  }) {
    this.id = id;
    this.storeId = storeId;
    this.title = title;
    this.description = description;
    this.price = price;
    this.type = type;
    this.billingInterval = billingInterval;
    this.trialDays = trialDays;
    this.deliverables = deliverables;
    this.affiliatePercent = affiliatePercent;
  }

  static create({
    storeId,
    title,
    description,
    price,
    type,
    billingInterval,
    trialDays,
    deliverables,
    affiliatePercent,
  }) {
    // check store exists
    const store = Store.findById(storeId);
    if (!store) throw new Error('Store not found');
    const id = Product._generateId();
    const product = new Product({
      id,
      storeId,
      title,
      description,
      price,
      type,
      billingInterval,
      trialDays,
      deliverables,
      affiliatePercent,
    });
    Product._data.push(product);
    return product;
  }

  static findById(id) {
    return Product._data.find((p) => p.id === id);
  }

  static findAll() {
    return Product._data;
  }

  static findByStore(storeId) {
    return Product._data.filter((p) => p.storeId === storeId);
  }

  update(fields) {
    Object.assign(this, fields);
  }
}

/**
 * Order model
 *
 * Represents a purchase or subscription. Each order belongs to a user
 * and a product. The status can be 'active', 'cancelled', or 'expired'.
 *
 * Fields:
 *   id: integer primary key
 *   userId: reference to User
 *   productId: reference to Product
 *   price: number
 *   status: string
 *   nextBillingAt: Date | null
 *   endedAt: Date | null
 *   deliverables: array
 *   affiliateReferrerId: reference to User | null
 *   affiliateCommission: number
 */
class Order {
  static _generateId = idGenerator();
  static _data = [];

  constructor({
    id,
    userId,
    productId,
    price,
    status,
    nextBillingAt,
    endedAt,
    deliverables,
    affiliateReferrerId = null,
    affiliateCommission = 0,
  }) {
    this.id = id;
    this.userId = userId;
    this.productId = productId;
    this.price = price;
    this.status = status;
    this.nextBillingAt = nextBillingAt;
    this.endedAt = endedAt;
    this.deliverables = deliverables;
    this.affiliateReferrerId = affiliateReferrerId;
    this.affiliateCommission = affiliateCommission;
  }

  static create({
    userId,
    productId,
    price,
    status,
    nextBillingAt,
    deliverables,
    affiliateReferrerId,
    affiliateCommission,
  }) {
    const id = Order._generateId();
    const order = new Order({
      id,
      userId,
      productId,
      price,
      status,
      nextBillingAt,
      deliverables,
      affiliateReferrerId,
      affiliateCommission,
      endedAt: null,
    });
    Order._data.push(order);
    return order;
  }

  static findById(id) {
    return Order._data.find((o) => o.id === id);
  }

  static findByUser(userId) {
    return Order._data.filter((o) => o.userId === userId);
  }

  static findAll() {
    return Order._data;
  }

  update(fields) {
    Object.assign(this, fields);
  }
}

/**
 * AffiliateReferral model
 *
 * Tracks referrals between users. Each record notes the referrer and
 * the referred user. Commission amounts are stored per order, not here.
 *
 * Fields:
 *   id: integer primary key
 *   referrerId: reference to User
 *   referredUserId: reference to User
 */
class AffiliateReferral {
  static _generateId = idGenerator();
  static _data = [];

  constructor({ id, referrerId, referredUserId }) {
    this.id = id;
    this.referrerId = referrerId;
    this.referredUserId = referredUserId;
  }

  static create({ referrerId, referredUserId }) {
    const id = AffiliateReferral._generateId();
    const ref = new AffiliateReferral({ id, referrerId, referredUserId });
    AffiliateReferral._data.push(ref);
    return ref;
  }

  static findByReferrer(referrerId) {
    return AffiliateReferral._data.filter((r) => r.referrerId === referrerId);
  }
}

/**
 * SupportTicket model
 *
 * Users can submit support tickets. For simplicity, only the user and
 * admin (not implemented) can view their tickets.
 *
 * Fields:
 *   id: integer primary key
 *   userId: reference to User
 *   subject: string
 *   message: string
 */
class SupportTicket {
  static _generateId = idGenerator();
  static _data = [];

  constructor({ id, userId, subject, message }) {
    this.id = id;
    this.userId = userId;
    this.subject = subject;
    this.message = message;
  }

  static create({ userId, subject, message }) {
    const id = SupportTicket._generateId();
    const ticket = new SupportTicket({ id, userId, subject, message });
    SupportTicket._data.push(ticket);
    return ticket;
  }

  static findByUser(userId) {
    return SupportTicket._data.filter((t) => t.userId === userId);
  }
}

module.exports = {
  User,
  Store,
  Product,
  Order,
  AffiliateReferral,
  SupportTicket,
  randomToken,
};
