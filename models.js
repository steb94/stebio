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
    downloadLink: 'https://example.com/downloads/picks-pro.pdf'
  },
  {
    id: '2',
    storeId: '2',
    title: 'Crypto Signals Hub',
    description: 'Real‑time crypto trading signals and market analysis.',
    price: 19.99,
    type: 'Crypto',
    downloadLink: 'https://example.com/downloads/crypto-signals.pdf'
  },
  {
    id: '3',
    storeId: '3',
    title: 'Stock Market Mastery',
    description: 'Weekly stock picks and portfolio insights from analysts.',
    price: 29.99,
    type: 'Stocks',
    downloadLink: 'https://example.com/downloads/stock-mastery.pdf'
  }
];

// Stores hold owner and basic info
const stores = [
  { id: '1', name: 'Pro Sports Store', owner: 'User1' },
  { id: '2', name: 'Crypto Signals Store', owner: 'User2' },
  { id: '3', name: 'Stock Picks Store', owner: 'User3' }
];

// Orders record purchases
const orders = [];

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
  getProductById,
  getStoreById,
  getProductsByStoreId
};