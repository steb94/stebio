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
      return res.status(400).json({
        error: 'Email, password and name are required',
      });
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
      return res.status(400).json({
        error: 'Name and category are required',
      });
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
 * Expects JSON body: { storeId, title, description, price, type,
 * billingInterval, trialDays, deliverables, affiliatePercent }
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
      return res.status(403).json({
        error: 'You do not own this store',
      });
    }
    if (!title || !price || !type) {
      return res.status(400).json({
        error: 'Title, price and type are required',
      });
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
 * Creates a new order (checkout). This endpoint simulates the checkout
 * process. In a real implementation you would call Stripe or PayPal
 * to create a payment session and listen for webhooks to confirm
 * payment before activating the order. Here we assume the payment
 * succeeds immediately. Referral codes can be provided in the body
 * to attribute commissions.
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
    const referrer = User._data.find(
      (u) => u.referralCode === referralCode
    );
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
 * Returns the authenticated user's orders (subscriptions and
 * one‑time purchases).
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
    return res
      .status(400)
      .json({ error: 'Only subscriptions can be cancelled' });
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
  const referrals = AffiliateReferral.findByReferrer(
    req.currentUser.id
  );
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
 * Lists support tickets for the current user. In a full
 * implementation admin users would be able to view all tickets.
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
