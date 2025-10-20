// Simple Express API skeleton for STEB.io marketplace
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';

// In-memory stores (for demonstration only). In production, use a database.
const users = [];
const products = [];

// Simple order store. In production, store orders in a database.
// Each order contains an id, buyerId, items (array of {productId, quantity}), total and status.
const orders = [];

// Root route to indicate server status
app.get('/', (req, res) => {
  res.send('STEB.io API server is running');
});

app.use(cors());
app.use(express.json());

// Helper function to generate JWT tokens
function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Authorization middleware for seller routes
function requireSeller(req, res, next) {
  if (req.user.role !== 'seller') {
    return res.status(403).json({ message: 'Seller role required' });
  }
  next();
}

// Routes

/**
 * User registration
 * Expects: { username, email, password, role }
 * Role can be 'buyer' or 'seller'.
 */
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (!['buyer', 'seller'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  // Check for existing user
  if (users.some(u => u.email === email)) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    username,
    email,
    password: hashedPassword,
    role
  };
  users.push(newUser);
  // Generate token
  const token = generateToken(newUser);
  res.status(201).json({ message: 'User registered', token });
});

/**
 * User login
 * Expects: { email, password }
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = generateToken(user);
  res.json({ message: 'Login successful', token });
});

/**
 * Create a new order
 * Expects: { items: [{ productId, quantity }] }
 * Computes total from product prices. Only authenticated users can create orders.
 */
app.post('/api/orders', authenticateToken, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must include at least one item' });
  }
  // Validate products exist and compute total
  let total = 0;
  const validatedItems = [];
  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) {
      return res.status(400).json({ message: `Product ${item.productId} does not exist` });
    }
    const quantity = Number(item.quantity) || 1;
    total += product.price * quantity;
    validatedItems.push({ productId: product.id, quantity });
  }
  const order = {
    id: uuidv4(),
    buyerId: req.user.id,
    items: validatedItems,
    total,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  res.status(201).json(order);
});

/**
 * List orders for the authenticated user
 * Buyers see their own orders. Sellers see orders containing their products.
 */
app.get('/api/orders', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  if (role === 'buyer') {
    const userOrders = orders.filter(o => o.buyerId === userId);
    return res.json(userOrders);
  }
  if (role === 'seller') {
    // Seller: return orders where any item belongs to seller's products
    const sellerProductIds = products.filter(p => p.ownerId === userId).map(p => p.id);
    const sellerOrders = orders.filter(o => o.items.some(item => sellerProductIds.includes(item.productId)));
    return res.json(sellerOrders);
  }
  // For admins or unknown roles, return all orders (in future implement admin role)
  res.json(orders);
});

/**
 * Create product (seller only)
 * Expects: { name, description, price, type }
 */
app.post('/api/products', authenticateToken, requireSeller, (req, res) => {
  const { name, description, price, type } = req.body;
  if (!name || !price || !type) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const product = {
    id: uuidv4(),
    name,
    description: description || '',
    price: parseFloat(price),
    type,
    ownerId: req.user.id,
    createdAt: new Date().toISOString()
  };
  products.push(product);
  res.status(201).json(product);
});

/**
 * Get all products
 */
app.get('/api/products', (req, res) => {
  res.json(products);
});

/**
 * Get product by ID
 */
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json(product);
});

/**
 * Update product (seller only, must own product)
 */
app.put('/api/products/:id', authenticateToken, requireSeller, (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  if (product.ownerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to update this product' });
  }
  const { name, description, price, type } = req.body;
  if (name) product.name = name;
  if (description) product.description = description;
  if (price) product.price = parseFloat(price);
  if (type) product.type = type;
  res.json(product);
});

/**
 * Delete product (seller only, must own product)
 */
app.delete('/api/products/:id', authenticateToken, requireSeller, (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: 'Product not found' });
  }
  const product = products[index];
  if (product.ownerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to delete this product' });
  }
  products.splice(index, 1);
  res.json({ message: 'Product deleted' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
