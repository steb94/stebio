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
    image: 'sports.png',
    downloadLink: 'https://example.com/downloads/picks-pro.pdf'
  },
  {
    id: '2',
    storeId: '2',
    title: 'Crypto Signals Hub',
    description: 'Real‑time crypto trading signals and market analysis.',
    price: 19.99,
    type: 'Crypto',
    image: 'crypto.png',
    downloadLink: 'https://example.com/downloads/crypto-signals.pdf'
  },
  {
    id: '3',
    storeId: '3',
    title: 'Stock Market Mastery',
    description: 'Weekly stock picks and portfolio insights from analysts.',
    price: 29.99,
    type: 'Stocks',
    image: 'stocks.png',
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
    image: 'education.png',
    downloadLink: 'https://example.com/downloads/web-dev-bootcamp.pdf'
  },
  {
    id: '5',
    storeId: '4',
    title: 'Digital Marketing Essentials',
    description: 'Learn the fundamentals of digital marketing, SEO, and social media strategy.',
    price: 39.99,
    type: 'Education',
    image: 'education.png',
    downloadLink: 'https://example.com/downloads/digital-marketing-essentials.pdf'
  }
  ,
  // Additional products for gaming and productivity categories
  {
    id: '6',
    storeId: '5',
    title: 'Gaming Strategy Pack',
    description: 'Exclusive gaming strategies, tips and tricks for top titles to help you level up your play.',
    price: 14.99,
    type: 'Gaming',
    image: 'gaming.png',
    downloadLink: 'https://example.com/downloads/gaming-strategy-pack.pdf'
  },
  {
    id: '7',
    storeId: '6',
    title: 'Productivity Power Pack',
    description: 'Tools, templates and resources to streamline your workflow and boost productivity.',
    price: 24.99,
    type: 'Productivity',
    image: 'productivity.png',
    downloadLink: 'https://example.com/downloads/productivity-power-pack.pdf'
  }
  ,
  // New products for Forex, Fitness and Art categories
  {
    id: '8',
    storeId: '7',
    title: 'Forex Mastery Signals',
    description: 'High‑quality currency trading signals and analysis from professional forex traders.',
    price: 29.99,
    type: 'Forex',
    image: 'forex.png',
    downloadLink: 'https://example.com/downloads/forex-mastery-signals.pdf'
  },
  {
    id: '9',
    storeId: '8',
    title: '30‑Day Fitness Challenge',
    description: 'Access to daily workout routines and nutrition tips to kickstart your fitness journey.',
    price: 19.99,
    type: 'Fitness',
    image: 'fitness.png',
    downloadLink: 'https://example.com/downloads/30-day-fitness-challenge.pdf'
  },
  {
    id: '10',
    storeId: '9',
    title: 'Beginner Art Course',
    description: 'Step‑by‑step drawing and painting lessons to help you unleash your inner artist.',
    price: 34.99,
    type: 'Art',
    image: 'art.png',
    downloadLink: 'https://example.com/downloads/beginner-art-course.pdf'
  }
  ,
  // Start of auto‑generated sample products for demo stores
  // These products correspond to stores with IDs 10–40 below.  Each provides a
  // digital package or membership in a different niche similar to Whop’s
  // diverse marketplace.  A default placeholder image is used unless a
  // category‑specific image exists.
  {
    id: '11',
    storeId: '10',
    title: 'Photography Pro Pack',
    description: 'Comprehensive photography guides, presets and tips.',
    price: 29.99,
    type: 'Photography',
    image: 'store10.png',
    downloadLink: 'https://example.com/downloads/photography-pro-pack.pdf'
  },
  {
    id: '12',
    storeId: '11',
    title: 'Fashion Trends Guide',
    description: 'Weekly fashion insights, styling tips and trend forecasts.',
    price: 19.99,
    type: 'Fashion',
    image: 'store11.png',
    downloadLink: 'https://example.com/downloads/fashion-trends-guide.pdf'
  },
  {
    id: '13',
    storeId: '12',
    title: 'Music Producer Toolkit',
    description: 'Sample packs, tutorials and exclusive beats for aspiring producers.',
    price: 24.99,
    type: 'Music',
    image: 'store12.png',
    downloadLink: 'https://example.com/downloads/music-producer-toolkit.pdf'
  },
  {
    id: '14',
    storeId: '13',
    title: 'Travel Hacking Secrets',
    description: 'Insider strategies to save on flights and accommodation around the world.',
    price: 27.99,
    type: 'Travel',
    image: 'store13.png',
    downloadLink: 'https://example.com/downloads/travel-hacking-secrets.pdf'
  },
  {
    id: '15',
    storeId: '14',
    title: 'Gourmet Cooking Masterclass',
    description: 'Video lessons and recipes from professional chefs for delicious meals.',
    price: 34.99,
    type: 'Food',
    image: 'store14.png',
    downloadLink: 'https://example.com/downloads/gourmet-cooking-masterclass.pdf'
  },
  {
    id: '16',
    storeId: '15',
    title: 'Tech Entrepreneur Playbook',
    description: 'Guides on building and scaling tech startups, including fundraising tips.',
    price: 39.99,
    type: 'Technology',
    image: 'store15.png',
    downloadLink: 'https://example.com/downloads/tech-entrepreneur-playbook.pdf'
  },
  {
    id: '17',
    storeId: '16',
    title: 'Parenting Strategies Bundle',
    description: 'Expert advice and resources for raising happy, healthy children.',
    price: 14.99,
    type: 'Parenting',
    image: 'store16.png',
    downloadLink: 'https://example.com/downloads/parenting-strategies-bundle.pdf'
  },
  {
    id: '18',
    storeId: '17',
    title: 'Mindset & Motivation Course',
    description: 'Daily audio and video sessions to boost self‑discipline and productivity.',
    price: 21.99,
    type: 'Self‑Help',
    image: 'store17.png',
    downloadLink: 'https://example.com/downloads/mindset-and-motivation-course.pdf'
  },
  {
    id: '19',
    storeId: '18',
    title: 'Personal Finance Toolkit',
    description: 'Budgeting templates, investment guides and debt reduction plans.',
    price: 29.99,
    type: 'Finance',
    image: 'store18.png',
    downloadLink: 'https://example.com/downloads/personal-finance-toolkit.pdf'
  },
  {
    id: '20',
    storeId: '19',
    title: 'Real Estate Investing Blueprint',
    description: 'Training on finding, analyzing and financing profitable real estate deals.',
    price: 49.99,
    type: 'Real Estate',
    image: 'store19.png',
    downloadLink: 'https://example.com/downloads/real-estate-investing-blueprint.pdf'
  },
  {
    id: '21',
    storeId: '20',
    title: 'Gardening Mastery Course',
    description: 'Seasonal guides, planting schedules and pest control tips for gardeners.',
    price: 19.99,
    type: 'Gardening',
    image: 'store20.png',
    downloadLink: 'https://example.com/downloads/gardening-mastery-course.pdf'
  },
  {
    id: '22',
    storeId: '21',
    title: 'Pet Care Essentials',
    description: 'Training videos and nutrition plans for dogs, cats and other pets.',
    price: 12.99,
    type: 'Pets',
    image: 'store21.png',
    downloadLink: 'https://example.com/downloads/pet-care-essentials.pdf'
  },
  {
    id: '23',
    storeId: '22',
    title: 'Science Explorer Pack',
    description: 'Interactive experiments and resources for budding scientists of all ages.',
    price: 24.99,
    type: 'Science',
    image: 'store22.png',
    downloadLink: 'https://example.com/downloads/science-explorer-pack.pdf'
  },
  {
    id: '24',
    storeId: '23',
    title: 'Language Learning Kit',
    description: 'Audio lessons and practice exercises for multiple languages.',
    price: 29.99,
    type: 'Languages',
    image: 'store23.png',
    downloadLink: 'https://example.com/downloads/language-learning-kit.pdf'
  },
  {
    id: '25',
    storeId: '24',
    title: 'Entrepreneur Growth Pack',
    description: 'Resources and mastermind sessions for starting and growing your business.',
    price: 34.99,
    type: 'Entrepreneurship',
    image: 'store24.png',
    downloadLink: 'https://example.com/downloads/entrepreneur-growth-pack.pdf'
  },
  {
    id: '26',
    storeId: '25',
    title: 'Podcasting Essentials',
    description: 'Templates, tech recommendations and marketing strategies for podcast hosts.',
    price: 15.99,
    type: 'Podcasting',
    image: 'store25.png',
    downloadLink: 'https://example.com/downloads/podcasting-essentials.pdf'
  },
  {
    id: '27',
    storeId: '26',
    title: 'Design Inspiration Library',
    description: 'Curated design assets, style guides and creative prompts.',
    price: 18.99,
    type: 'Design',
    image: 'store26.png',
    downloadLink: 'https://example.com/downloads/design-inspiration-library.pdf'
  },
  {
    id: '28',
    storeId: '27',
    title: 'Beauty Secrets Course',
    description: 'Skincare routines, makeup tutorials and product recommendations.',
    price: 22.99,
    type: 'Beauty',
    image: 'store27.png',
    downloadLink: 'https://example.com/downloads/beauty-secrets-course.pdf'
  },
  {
    id: '29',
    storeId: '28',
    title: 'Home Decor Guide',
    description: 'Interior design tips, mood boards and DIY projects.',
    price: 17.99,
    type: 'Home Decor',
    image: 'store28.png',
    downloadLink: 'https://example.com/downloads/home-decor-guide.pdf'
  },
  {
    id: '30',
    storeId: '29',
    title: 'DIY Builder Bundle',
    description: 'Plans, tutorials and material lists for home improvement projects.',
    price: 27.99,
    type: 'DIY',
    image: 'store29.png',
    downloadLink: 'https://example.com/downloads/diy-builder-bundle.pdf'
  },
  {
    id: '31',
    storeId: '30',
    title: 'Automotive Repair Secrets',
    description: 'Step‑by‑step guides to diagnose and fix common car issues.',
    price: 23.99,
    type: 'Automotive',
    image: 'store30.png',
    downloadLink: 'https://example.com/downloads/automotive-repair-secrets.pdf'
  },
  {
    id: '32',
    storeId: '31',
    title: 'Outdoor Adventure Kit',
    description: 'Survival guides, packing lists and trail recommendations for adventurers.',
    price: 26.99,
    type: 'Outdoor',
    image: 'store31.png',
    downloadLink: 'https://example.com/downloads/outdoor-adventure-kit.pdf'
  },
  {
    id: '33',
    storeId: '32',
    title: 'Spiritual Journey Course',
    description: 'Meditation practices, journaling prompts and mindfulness exercises.',
    price: 19.99,
    type: 'Spirituality',
    image: 'store32.png',
    downloadLink: 'https://example.com/downloads/spiritual-journey-course.pdf'
  },
  {
    id: '34',
    storeId: '33',
    title: 'Wellness Lifestyle Program',
    description: 'Nutrition plans, yoga flows and holistic health resources.',
    price: 29.99,
    type: 'Wellness',
    image: 'store33.png',
    downloadLink: 'https://example.com/downloads/wellness-lifestyle-program.pdf'
  },
  {
    id: '35',
    storeId: '34',
    title: 'History Buff Bundle',
    description: 'Curated lectures and reading lists on world history topics.',
    price: 15.99,
    type: 'History',
    image: 'store34.png',
    downloadLink: 'https://example.com/downloads/history-buff-bundle.pdf'
  },
  {
    id: '36',
    storeId: '35',
    title: 'Creative Writing Workshop',
    description: 'Writing prompts, critique sessions and storytelling techniques.',
    price: 18.99,
    type: 'Writing',
    image: 'store35.png',
    downloadLink: 'https://example.com/downloads/creative-writing-workshop.pdf'
  },
  {
    id: '37',
    storeId: '36',
    title: 'Marketing Masterclass',
    description: 'Strategies for digital marketing, branding and customer acquisition.',
    price: 34.99,
    type: 'Marketing',
    image: 'store36.png',
    downloadLink: 'https://example.com/downloads/marketing-masterclass.pdf'
  },
  {
    id: '38',
    storeId: '37',
    title: 'Learn to Code Bundle',
    description: 'Interactive coding tutorials and projects for beginners and intermediates.',
    price: 29.99,
    type: 'Programming',
    image: 'store37.png',
    downloadLink: 'https://example.com/downloads/learn-to-code-bundle.pdf'
  },
  {
    id: '39',
    storeId: '38',
    title: 'Investing Fundamentals Course',
    description: 'Introduction to stock, bond and ETF investing for beginners.',
    price: 24.99,
    type: 'Investing',
    image: 'store38.png',
    downloadLink: 'https://example.com/downloads/investing-fundamentals-course.pdf'
  },
  {
    id: '40',
    storeId: '39',
    title: 'Magic Tricks Library',
    description: 'Learn sleight of hand, card tricks and stage magic secrets.',
    price: 16.99,
    type: 'Magic',
    image: 'store39.png',
    downloadLink: 'https://example.com/downloads/magic-tricks-library.pdf'
  },
  {
    id: '41',
    storeId: '40',
    title: 'Baking Essentials Course',
    description: 'Recipes, techniques and troubleshooting for cakes, breads and pastries.',
    price: 22.99,
    type: 'Cooking',
    image: 'store40.png',
    downloadLink: 'https://example.com/downloads/baking-essentials-course.pdf'
  }
];

// Stores hold owner and basic info
const stores = [
  { id: '1', name: 'Pro Sports Store', owner: 'User1' },
  { id: '2', name: 'Crypto Signals Store', owner: 'User2' },
  { id: '3', name: 'Stock Picks Store', owner: 'User3' },
  { id: '4', name: 'Course Masters', owner: 'User4' }
  ,
  // New stores for additional categories
  { id: '5', name: 'Gaming Insider Store', owner: 'User5' },
  { id: '6', name: 'Productivity Tools Store', owner: 'User6' }
  ,
  // Stores for new categories
  { id: '7', name: 'Forex Experts Store', owner: 'User7' },
  { id: '8', name: 'Fit Life Coaches', owner: 'User8' },
  { id: '9', name: 'Art Academy', owner: 'User9' }
  ,
  // Auto‑generated demo stores corresponding to the extra products above
  { id: '10', name: 'Photography Pro Store', owner: 'User10' },
  { id: '11', name: 'Fashion Insights Store', owner: 'User11' },
  { id: '12', name: 'Music Producers Hub', owner: 'User12' },
  { id: '13', name: 'Travel Hacks Club', owner: 'User13' },
  { id: '14', name: 'Gourmet Food House', owner: 'User14' },
  { id: '15', name: 'Tech Entrepreneurs Guild', owner: 'User15' },
  { id: '16', name: 'Parenting Pros Store', owner: 'User16' },
  { id: '17', name: 'Self‑Help Academy', owner: 'User17' },
  { id: '18', name: 'Finance Wizards', owner: 'User18' },
  { id: '19', name: 'Real Estate Investors', owner: 'User19' },
  { id: '20', name: 'Gardeners United', owner: 'User20' },
  { id: '21', name: 'Pet Lovers World', owner: 'User21' },
  { id: '22', name: 'Science Lab Store', owner: 'User22' },
  { id: '23', name: 'Language Learners Hub', owner: 'User23' },
  { id: '24', name: 'Entrepreneur Network', owner: 'User24' },
  { id: '25', name: 'Podcast Creators Club', owner: 'User25' },
  { id: '26', name: 'Design Resources Shop', owner: 'User26' },
  { id: '27', name: 'Beauty Experts Store', owner: 'User27' },
  { id: '28', name: 'Home Decor Central', owner: 'User28' },
  { id: '29', name: 'DIY Builders Hub', owner: 'User29' },
  { id: '30', name: 'Auto Repair Academy', owner: 'User30' },
  { id: '31', name: 'Outdoor Adventures Store', owner: 'User31' },
  { id: '32', name: 'Spirituality Sanctuary', owner: 'User32' },
  { id: '33', name: 'Wellness Workshop', owner: 'User33' },
  { id: '34', name: 'History Academy', owner: 'User34' },
  { id: '35', name: 'Writing Studio', owner: 'User35' },
  { id: '36', name: 'Marketing Academy', owner: 'User36' },
  { id: '37', name: 'Coding School', owner: 'User37' },
  { id: '38', name: 'Investing Hub', owner: 'User38' },
  { id: '39', name: 'Magic Tricks Store', owner: 'User39' },
  { id: '40', name: 'Baking Club', owner: 'User40' }
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
  ,
  // Additional orders for demonstration
  {
    id: '5',
    productId: '8',
    productName: 'Forex Mastery Signals',
    price: 29.99,
    status: 'Completed',
    storeId: '7'
  },
  {
    id: '6',
    productId: '9',
    productName: '30‑Day Fitness Challenge',
    price: 19.99,
    status: 'Processing',
    storeId: '8'
  },
  {
    id: '7',
    productId: '10',
    productName: 'Beginner Art Course',
    price: 34.99,
    status: 'Completed',
    storeId: '9'
  }
];

// Simple in‑memory messages store.  Each message has: id, fromUser, toUser,
// subject (optional), content, timestamp, delivered (boolean).  This
// demonstrates basic messaging between buyers and sellers.
const messages = [];

// Add a new message
function addMessage({ fromUser, toUser, subject, content }) {
  const id = (messages.length + 1).toString();
  const timestamp = new Date().toISOString();
  const message = { id, fromUser, toUser, subject: subject || '', content, timestamp, delivered: false };
  messages.push(message);
  return message;
}

// Retrieve messages for a given user (either sent to or from)
function getMessagesForUser(user) {
  return messages.filter((m) => m.fromUser === user || m.toUser === user);
}

// Mark a message as delivered (e.g., after email notification)
function markMessageDelivered(id) {
  const msg = messages.find((m) => m.id === id);
  if (msg) {
    msg.delivered = true;
  }
  return msg;
}

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
  , messages,
  addMessage,
  getMessagesForUser,
  markMessageDelivered
};