// Simple in-memory data models for Steb.io marketplace

// Each product has: id, storeId, title, description, price, type, downloadLink (sensitive)
const products = [
  {
    id: '1',
    storeId: '1',
    title: 'Sports Picks Pro',
    description: 'Daily sports betting picks from veteran handicappers.',
    price: 9.99,
    type: 'Sports',
    image: 'images/sports.png',
    downloadLink: 'https://example.com/downloads/picks-pro.pdf'
  },
  {
    id: '2',
    storeId: '2',
    title: 'Crypto Signals Hub',
    description: 'Real‑time crypto trading signals and market analysis.',
    price: 19.99,
    type: 'Crypto',
    image: 'images/crypto.png',
    downloadLink: 'https://example.com/downloads/crypto-signals.pdf'
  },
  {
    id: '3',
    storeId: '3',
    title: 'Stock Market Mastery',
    description: 'Weekly stock picks and portfolio insights from analysts.',
    price: 29.99,
    type: 'Stocks',
    image: 'images/stocks.png',
    downloadLink: 'https://example.com/downloads/stock-mastery.pdf'
  },
  // New education products for a course store
  {
    id: '4',
    storeId: '4',
    title: 'Web Dev Bootcamp',
    description: 'Comprehensive web development course covering HTML, CSS, JavaScript and backend basics.',
    price: 49.99,
    type: 'Education',
    image: 'images/education.png',
    downloadLink: 'https://example.com/downloads/web-dev-bootcamp.pdf'
  },
  {
    id: '5',
    storeId: '4',
    title: 'Digital Marketing Essentials',
    description: 'Learn the fundamentals of digital marketing, SEO, and social media strategy.',
    price: 39.99,
    type: 'Education',
    image: 'images/education.png',
    downloadLink: 'https://example.com/downloads/digital-marketing-essentials.pdf'
  }
];

// Stores hold owner and basic info
const stores = [
  { id: '1', name: 'Pro Sports Store', owner: 'User1' },
  { id: '2', name: 'Crypto Signals Store', owner: 'User2' },
  { id: '3', name: 'Stock Picks Store', owner: 'User3' },
  { id: '4', name: 'Course Masters', owner: 'User4' }
];

// Orders record purchases; includes id, productId, productName, price, status, storeId
const orders = [
  {
    id: '1',
    productId: '1',
    productName: 'Sports Picks Pro',
    price: 9.99,
    status: 'Completed',
    storeId: '1'
  },
  {
    id: '2',
    productId: '2',
    productName: 'Crypto Signals Hub',
    price: 19.99,
    status: 'Processing',
    storeId: '2'
  },
  {
    id: '3',
    productId: '1',
    productName: 'Sports Picks Pro',
    price: 9.99,
    status: 'Completed',
    storeId: '1'
  },
  {
    id: '4',
    productId: '3',
    productName: 'Stock Market Mastery',
    price: 29.99,
    status: 'Completed',
    storeId: '3'
  }
];

// Helper functions to fetch data
function getAllProducts() {
  return products;
}

function getAllStores() {
  return stores;
}

function getAllOrders() {
  return orders;
}

// Fetch a single order by its id
function getOrderById(id) {
  return orders.find((o) => o.id === id);
}

// Update an order's status by id; returns updated order or null if not found
function updateOrderStatus(id, newStatus) {
  const order = orders.find((o) => o.id === id);
  if (!order) return null;
  order.status = newStatus;
  return order;
}

// Fetch a single product by its id
function getProductById(id) {
  return products.find((p) => p.id === id);
}

// Fetch a single store by its id
function getStoreById(id) {
  return stores.find((s) => s.id === id);
}

// Fetch all products belonging to a specific store
function getProductsByStoreId(storeId) {
  return products.filter((p) => p.storeId === storeId);
}

module.exports = {
  products,
  stores,
  orders,
  getAllProducts,
  getAllStores,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getProductById,
  getStoreById,
  getProductsByStoreId
};