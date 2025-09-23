// models.js

// Sample stores
const stores = [
  { id: 1, name: 'Crypto Store', owner: 'alice' },
  { id: 2, name: 'Fitness Hub', owner: 'bob' },
  { id: 3, name: 'Art Supplies', owner: 'carol' }
];

// Sample products
const products = [
  {
    id: 1,
    storeId: 1,
    title: 'Bitcoin Starter Kit',
    description: 'Learn about Bitcoin with our starter kit.',
    image: 'crypto.png',
    type: 'digital',
    price: 49.99,
    maxSupply: 1000
  },
  {
    id: 2,
    storeId: 2,
    title: 'Fitness Plan',
    description: 'Get fit with our 30‑day fitness plan.',
    image: 'fitness.png',
    type: 'digital',
    price: 19.99,
    maxSupply: 1000
  },
  {
    id: 3,
    storeId: 3,
    title: 'Art Brushes',
    description: 'A set of high‑quality art brushes.',
    image: 'art.png',
    type: 'physical',
    price: 29.99,
    maxSupply: 500
  }
];

// Orders
const orders = [];

// Private messages
const messages = [];
let nextMessageId = 1;

// Chat rooms per product: { id, productId, members:[{username, expiresAt}], messages:[{id, username, message, timestamp}] }
const chatRooms = [];

// Posts per store: { id, storeId, username, mediaUrl, content, timestamp }
const posts = [];
let nextPostId = 1;

/* -------- Basic helpers -------- */
function getAllProducts() {
  return products;
}
function getAllStores() {
  return stores;
}
function getAllOrders() {
  return orders;
}
function getProductById(id) {
  return products.find(p => p.id === Number(id));
}
function getStoreById(id) {
  return stores.find(s => s.id === Number(id));
}
function getProductsByStoreId(storeId) {
  return products.filter(p => p.storeId === Number(storeId));
}
function getOrderById(id) {
  return orders.find(o => o.id === Number(id));
}
function createOrder(order) {
  order.id = orders.length + 1;
  orders.push(order);
  return order;
}
function updateOrderStatus(id, status) {
  const o = getOrderById(id);
  if (o) o.status = status;
  return o;
}

/* -------- Personal messaging -------- */
function addMessage(sender, recipient, content) {
  const msg = {
    id: nextMessageId++,
    sender,
    recipient,
    content,
    timestamp: new Date().toISOString(),
    delivered: false
  };
  messages.push(msg);
  return msg;
}
function getMessagesForUser(username) {
  return messages.filter(m => m.sender === username || m.recipient === username);
}
function markMessageDelivered(id) {
  const m = messages.find(x => x.id === Number(id));
  if (m) m.delivered = true;
  return m;
}

/* -------- Chat helpers -------- */
function createChatRoom(productId) {
  let room = chatRooms.find(r => r.productId === Number(productId));
  if (!room) {
    room = {
      id: chatRooms.length + 1,
      productId: Number(productId),
      members: [],
      messages: []
    };
    chatRooms.push(room);
  }
  return room;
}
function getChatRoomByProductId(pid) {
  return chatRooms.find(r => r.productId === Number(pid));
}
function addUserToChat(productId, username, expiresAt) {
  const room = createChatRoom(productId);
  const existing = room.members.find(m => m.username === username);
  if (existing) {
    existing.expiresAt = expiresAt;
  } else {
    room.members.push({ username, expiresAt });
  }
}
function removeExpiredMembers() {
  const now = new Date();
  chatRooms.forEach(room => {
    room.members = room.members.filter(m => new Date(m.expiresAt) > now);
  });
}
function isUserInChat(productId, username) {
  removeExpiredMembers();
  const room = getChatRoomByProductId(productId);
  return room ? room.members.some(m => m.username === username) : false;
}
function addChatMessage(productId, username, message) {
  const room = getChatRoomByProductId(productId);
  if (!room) return null;
  const msg = {
    id: String(room.messages.length + 1),
    username,
    message,
    timestamp: new Date().toISOString()
  };
  room.messages.push(msg);
  return msg;
}
function getChatMessages(productId) {
  const room = getChatRoomByProductId(productId);
  return room ? room.messages : [];
}

/* -------- Posts helpers -------- */
function createPost(storeId, username, mediaUrl, content) {
  const post = {
    id: nextPostId++,
    storeId: Number(storeId),
    username,
    mediaUrl,
    content,
    timestamp: new Date().toISOString()
  };
  posts.push(post);
  return post;
}
function getPostsByStoreId(storeId) {
  return posts.filter(p => p.storeId === Number(storeId));
}

/* -------- Exports -------- */
module.exports = {
  products,
  stores,
  orders,
  getAllProducts,
  getAllStores,
  getAllOrders,
  getProductById,
  getStoreById,
  getProductsByStoreId,
  getOrderById,
  createOrder,
  updateOrderStatus,
  addMessage,
  getMessagesForUser,
  markMessageDelivered,
  chatRooms,
  createChatRoom,
  addUserToChat,
  isUserInChat,
  addChatMessage,
  getChatMessages,
  posts,
  createPost,
  getPostsByStoreId
};
