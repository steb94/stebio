/*
 * models.js
 *
 * This file defines simple in‑memory models for STEB.IO. In a real
 * deployment you would back these models with a proper database
 * (e.g. PostgreSQL, MySQL, MongoDB, etc.), but for demonstration
 * purposes we store data in arrays. Each class provides static
 * methods to create, find and update records. IDs are auto‑incremented.
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
 * simplicity. Stores contain products.
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
 * A product belongs to a store and describes something a buyer can purchase.
 * It can represent a subscription (recurring) or a one‑time purchase.
 * Products may include multiple deliverables, such as downloadable files,
 * Discord roles, Telegram access, or license keys.
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
 * Represents a purchase or subscription. Each order belongs to a user and a
 * product. The status can be 'active', 'cancelled', or 'expired'.
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
