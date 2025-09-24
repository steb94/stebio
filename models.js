// models.js

// Predefined sample stores
const stores = [
  { id: 1, name: 'Crypto Store', owner: 'alice' },
  { id: 2, name: 'Fitness Hub', owner: 'bob' },
  { id: 3, name: 'Art Supplies', owner: 'carol' }
];

// Predefined sample products
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

// Dynamic arrays
const orders = [];
const messages = [];
let nextMessageId = 1;

const chatRooms = []; // { id, productId, members:[{ username, expiresAt }], messages:[{ id, username, message, timestamp }] }
const posts = [];     // { id, storeId, username, mediaUrl, content, timestamp }
let nextPostId = 1;

/* ===== Basic helpers ===== */
function getAllProducts() { return products; }
function getAllStores() { return stores; }
function getAllOrders() { return orders; }
function getProductById(id) { return products.find(p => p.id === Number(id)); }
function getStoreById(id) { return stores.find(s => s.id === Number(id)); }
function getProductsByStoreId(storeId) { return products.filter(p => p.storeId === Number(storeId)); }
function getOrderById(id) { return orders.find(o => o.id === Number(id)); }
function createStore(name, owner) {
  const id = stores.length + 1;
  const store = { id, name, owner };
  stores.push(store);
  return store;
}
function createProduct(data) {
  const id = products.length + 1;
  const product = { id, ...data };
  products.push(product);
  return product;
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

/* ===== Personal messages ===== */
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
  const msg = messages.find(m => m.id === Number(id));
  if (msg) msg.delivered = true;
  return msg;
}

/* ===== Chat helpers ===== */
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
function getChatRoomByProductId(productId) {
  return chatRooms.find(r => r.productId === Number(productId));
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

/* ===== Post helpers ===== */
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
// --- Chat Room Models -------------------------------------------------------

// Chat rooms belong to stores and can be free or paid.
class ChatRoom {
  static _data = [];
  static _id = 1;
  static _nextId() { return this._id++; }

  static create({ storeId, ownerId, title, price = 0 }) {
    const room = {
      id: this._nextId(),
      storeId,
      ownerId,
      title,
      price: Number(price) || 0,
      createdAt: new Date(),
    };
    this._data.push(room);
    return room;
  }

  static findById(id) {
    return this._data.find((r) => r.id === id);
  }

  static listByStore(storeId) {
    return this._data.filter((r) => r.storeId === storeId);
  }
}

// A simple message model scoped to chat rooms.
class ChatRoomMessage {
  static _data = [];
  static _id = 1;
  static _nextId() { return this._id++; }

  static create({ chatRoomId, userId, username, message }) {
    const m = {
      id: this._nextId(),
      chatRoomId,
      userId,
      username,
      message: String(message || '').slice(0, 2000),
      createdAt: new Date(),
    };
    this._data.push(m);
    return m;
  }

  static listByChatRoom(chatRoomId, limit = 200) {
    return this._data
      .filter((m) => m.chatRoomId === chatRoomId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-limit);
  }
}

// Tracks which users have access to which chat rooms.
class ChatAccess {
  static _data = [];

  static grant(chatRoomId, userId) {
    const existing = this._data.find(
      (a) => a.chatRoomId === chatRoomId && a.userId === userId,
    );
    if (!existing) {
      this._data.push({
        chatRoomId,
        userId,
        grantedAt: new Date(),
      });
    }
  }

  static hasAccess(chatRoomId, userId) {
    return this._data.some(
      (a) => a.chatRoomId === chatRoomId && a.userId === userId,
    );
  }

  static listUsers(chatRoomId) {
    return this._data.filter((a) => a.chatRoomId === chatRoomId);
  }
}

module.exports.ChatRoom = ChatRoom;
module.exports.ChatRoomMessage = ChatRoomMessage;
module.exports.ChatAccess = ChatAccess;

/* ===== Exports ===== */
module.exports = {
  products,
  stores,
  orders,
  chatRooms,
  posts,
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
  createChatRoom,
  getChatRoomByProductId,
  addUserToChat,
  isUserInChat,
  addChatMessage,
  getChatMessages,
  createPost,
  getPostsByStoreId
};
