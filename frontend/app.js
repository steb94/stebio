(() => {
  const BASE_URL = "https://stebio.onrender.com";  // fixed

  // New DOM elements for marketplace home
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  const categoryBar = document.getElementById('categoryBar');
  const sortSelect = document.getElementById('sort-select');
  const productGrid = document.getElementById('productGrid');
  const statProducts = document.getElementById('stat-products');
  const statOrders = document.getElementById('stat-orders');

  // Track the current active category for filtering
  let activeCategory = 'All';
  /**
   * Render a list of products into the product grid. Each product card
   * displays a placeholder image (can be replaced with a product image in
   * future), the title, a truncated description, the price, the type and a
   * "View" button which loads the product detail view.
   *
   * @param {Array} products A list of product objects
   */
  function renderProductGrid(products) {
    if (!productGrid) return;
    productGrid.innerHTML = '';
    products.forEach((product) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      // Use a simple placeholder image; real images can be added via product data
      const image = document.createElement('div');
      image.className = 'product-image';
      card.appendChild(image);
      const title = document.createElement('h4');
      title.textContent = product.title;
      card.appendChild(title);
      const desc = document.createElement('p');
      desc.textContent = product.description ? product.description.substring(0, 100) + (product.description.length > 100 ? '…' : '') : '';
      card.appendChild(desc);
      const meta = document.createElement('p');
      meta.className = 'product-meta';
      meta.innerHTML = `$${product.price.toFixed(2)} · ${product.type.replace('_', ' ')}`;
      card.appendChild(meta);
      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', () => {
        
        window.location.href = `product.html?id=${product.id}`;
      });
      card.appendChild(viewBtn);
      productGrid.appendChild(card);
    });
  }

  /**
   * Update the statistic cards with data returned from the /api/stats endpoint.
   *
   * @param {Object} stats An object with totalProducts, totalStores and totalOrders
   */
  function renderStats(stats) {
    if (statProducts) statProducts.textContent = stats.totalProducts;
    if (statStores) statStores.textContent = stats.totalStores;
    if (statOrders) statOrders.textContent = stats.totalOrders;
  }

  /**
   * Set the currently active category button. Removes the .active class from
   * all category buttons and adds it to the provided element.
   *
   * @param {HTMLElement} btn The category button that was clicked
   */
  function setActiveCategory(btn) {
    if (!categoryBar) return;
    Array.from(categoryBar.querySelectorAll('button')).forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.getAttribute('data-category');
  }

  /**
   * Fetch and render platform statistics. Called on initial load.
   */
  async function loadStats() {
    try {
      const data = await apiFetch('/api/stats');
      renderStats(data);
    } catch (_) {
      /* handled via showMessage in apiFetch */
    }
  }

  /**
   * Fetch and render products. If a search query is provided, the search API
   * is used; otherwise the generic products endpoint is called. The type
   * parameter corresponds to the active category; sort controls the order.
   *
   * @param {Object} options Options object
   * @param {string} [options.query] Search term; if present triggers search
   * @param {string} [options.type] Product type filter
   * @param {string} [options.sort] Sort key
   */
  async function loadProducts({ query = '', type = 'All', sort = 'newest' } = {}) {
    try {
      let data;
      const params = new URLSearchParams();
      if (query) {
        params.set('query', query);
        if (sort) params.set('sort', sort);
        data = await apiFetch(`/api/products/search?${params.toString()}`);
      } else {
        if (type) params.set('type', type);
        if (sort) params.set('sort', sort);
        data = await apiFetch(`/api/products?${params.toString()}`);
      }
      renderProductGrid(data.products || []);
    } catch (_) {
      /* handled via showMessage */
    }
  }

  // Event listeners for search, category selection and sorting
  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      const term = searchInput.value.trim();
      loadProducts({ query: term, sort: sortSelect ? sortSelect.value : 'newest' });
    });
  }
  if (categoryBar) {
    categoryBar.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      setActiveCategory(btn);
      if (searchInput) searchInput.value = '';
      loadProducts({ type: btn.getAttribute('data-category'), sort: sortSelect ? sortSelect.value : 'newest' });
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const sort = sortSelect.value;
      const term = searchInput ? searchInput.value.trim() : '';
      if (term) {
        loadProducts({ query: term, sort });
      } else {
        loadProducts({ type: activeCategory, sort });
      }
    });
  }

  // Kick off initial data load once the page is ready
  document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadProducts({ type: activeCategory, sort: 'newest' });
  });

://stebio.onrender.com';
  let token = localStorage.getItem('stebio_token') || null;
  let currentUser = null;

  // DOM elements
  const navUserInfo = document.getElementById('user-info');
  const logoutBtn = document.getElementById('logout-btn');
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');
  const sellerSection = document.getElementById('seller-section');
  const messagesDiv = document.getElementById('messages');
  const featuredDiv = document.getElementById('featured');
  const newestDiv = document.getElementById('newest');
  const storesDiv = document.getElementById('stores');
  const storeDetailsDiv = document.getElementById('store-details');
  const ordersDiv = document.getElementById('orders');
  const affiliateDiv = document.getElementById('affiliate');
  const ticketsDiv = document.getElementById('tickets');
  const myStoreDiv = document.getElementById('my-store');

  // Helper: display temporary messages
  function showMessage(msg, isError = false) {
    messagesDiv.textContent = msg;
    messagesDiv.style.color = isError ? '#d32f2f' : '#388e3c';
    if (msg) {
      setTimeout(() => {
        messagesDiv.textContent = '';
      }, 5000);
    }
  }

  // Helper: fetch wrapper with appropriate headers
  async function apiFetch(path, options = {}) {
    const headers = options.headers || {};
    headers['Content-Type'] = 'application/json';
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    try {
      const res = await fetch(BASE_URL + path, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    } catch (err) {
      showMessage(err.message, true);
      throw err;
    }
  }

  // Render marketplace products
  async function loadDiscover() {
    try {
      const data = await apiFetch('/api/marketplace/discover');
      renderProductList(data.featured, featuredDiv);
      renderProductList(data.newest, newestDiv);
    } catch (_) {
      /* errors handled in apiFetch */
    }
  }

  function renderProductList(products, container) {
    container.innerHTML = '';
    products.forEach((product) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h4>${product.title}</h4>
        <p>Price: $${product.price.toFixed(2)}</p>
        <p>Type: ${product.type}</p>
        <button data-product-id="${product.id}">View</button>`;
      card.querySelector('button').addEventListener('click', () => {
        loadProduct(product.id);
      });
      container.appendChild(card);
    });
  }

  // Load all stores
  async function loadStores() {
    try {
      const data = await apiFetch('/api/stores');
      storesDiv.innerHTML = '';
      data.stores.forEach((store) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<h4>${store.name}</h4>
          <p>${store.description || ''}</p>
          <p>Category: ${store.category}</p>
          <button data-store-id="${store.id}">View</button>`;
        card.querySelector('button').addEventListener('click', () => {
          loadStoreDetails(store.id);
        });
        storesDiv.appendChild(card);
      });
    } catch (_) {
      /* handled in apiFetch */
    }
  }

  // Show store details and its products
  async function loadStoreDetails(id) {
    try {
      const data = await apiFetch(`/api/stores/${id}`);
      storeDetailsDiv.innerHTML = '';
      const store = data.store;
      const products = data.products;
      const section = document.createElement('div');
      section.innerHTML = `<h3>${store.name}</h3>
        <p>${store.description || ''}</p>
        <p>Category: ${store.category}</p>
        <h4>Products</h4>`;
      const listDiv = document.createElement('div');
      listDiv.className = 'card-grid';
      products.forEach((p) => {
        const prodCard = document.createElement('div');
        prodCard.className = 'card';
        prodCard.innerHTML = `<h4>${p.title}</h4>
          <p>Price: $${p.price.toFixed(2)}</p>
          <p>Type: ${p.type}</p>
          <button data-product-id="${p.id}">View</button>`;
        prodCard.querySelector('button').addEventListener('click', () => {
          loadProduct(p.id);
        });
        listDiv.appendChild(prodCard);
      });
      section.appendChild(listDiv);
      storeDetailsDiv.appendChild(section);
    } catch (_) {
      /* errors handled */
    }
  }

  // Load single product details, show buy button
  async function loadProduct(id) {
    try {
      const data = await apiFetch(`/api/products/${id}`);
      const product = data.product;
      const store = data.store;
      // Render modal like section
      const detail = document.createElement('div');
      detail.className = 'card';
      detail.innerHTML = `<h4>${product.title}</h4>
        <p>${product.description || ''}</p>
        <p>Price: $${product.price.toFixed(2)}</p>
        <p>Type: ${product.type}</p>
        <p>Store: ${store.name}</p>`;
      if (token) {
        const buyBtn = document.createElement('button');
        buyBtn.textContent = 'Buy';
        buyBtn.addEventListener('click', async () => {
          try {
            await apiFetch('/api/checkout', {
              method: 'POST',
              body: JSON.stringify({ productId: id }),
            });
            showMessage('Order placed successfully!');
            await loadOrders();
          } catch (_) {
            /* handled */
          }
        });
        detail.appendChild(buyBtn);
      } else {
        const info = document.createElement('p');
        info.textContent = 'Please log in to purchase.';
        detail.appendChild(info);
      }
      // Clear previous details and show new
      storeDetailsDiv.innerHTML = '';
      storeDetailsDiv.appendChild(detail);
    } catch (_) {
      /* handled */
    }
  }

  // Load user orders
  async function loadOrders() {
    if (!token) return;
    try {
      const data = await apiFetch('/api/orders');
      ordersDiv.innerHTML = '';
      if (data.orders.length === 0) {
        ordersDiv.textContent = 'No orders yet.';
        return;
      }
      data.orders.forEach((o) => {
        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = `<h4>${o.product.title}</h4>
          <p>Status: ${o.status}</p>
          <p>Price: $${o.price.toFixed(2)}</p>`;
        // Cancel subscription if applicable
        if (o.status === 'active' && o.product.type === 'subscription') {
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel';
          cancelBtn.addEventListener('click', async () => {
            try {
              await apiFetch(`/api/orders/${o.id}/cancel`, { method: 'POST' });
              showMessage('Subscription cancelled');
              await loadOrders();
            } catch (_) {
              /* handled */
            }
          });
          item.appendChild(cancelBtn);
        }
        ordersDiv.appendChild(item);
      });
    } catch (_) {
      /* handled */
    }
  }

  // Load affiliate stats
  async function loadAffiliateStats() {
    if (!token) return;
    try {
      const data = await apiFetch('/api/affiliates/stats');
      affiliateDiv.innerHTML = `<p>Total referrals: ${data.referrals}</p>
        <p>Total earned: $${data.earnings}</p>`;
    } catch (_) {
      /* handled */
    }
  }

  // Load support tickets
  async function loadSupportTickets() {
    if (!token) return;
    try {
      const data = await apiFetch('/api/support');
      ticketsDiv.innerHTML = '';
      if (data.tickets.length === 0) {
        ticketsDiv.textContent = 'No tickets yet.';
        return;
      }
      data.tickets.forEach((t) => {
        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = `<h4>${t.subject}</h4>
          <p>${t.message}</p>
          <p>Ticket ID: ${t.id}</p>`;
        ticketsDiv.appendChild(item);
      });
    } catch (_) {
      /* handled */
    }
  }

  // Load seller information (store and update forms)
  async function loadSellerDashboard() {
    if (!token || !currentUser || !currentUser.isSeller) return;
    // Fetch the user's store(s) by filtering stores by ownerId.
    try {
      const data = await apiFetch('/api/stores');
      const myStores = data.stores.filter(
        (store) => store.ownerId === currentUser.id
      );
      myStoreDiv.innerHTML = '';
      const select = document.getElementById('product-store-id');
      select.innerHTML = '';
      if (myStores.length === 0) {
        myStoreDiv.textContent = 'You have no store yet.';
      } else {
        myStores.forEach((store) => {
          const s = document.createElement('div');
          s.className = 'card';
          s.innerHTML = `<h4>${store.name}</h4>
            <p>${store.description || ''}</p>
            <p>Category: ${store.category}</p>`;
          myStoreDiv.appendChild(s);
          // populate store select list
          const option = document.createElement('option');
          option.value = store.id;
          option.textContent = store.name;
          select.appendChild(option);
        });
      }
    } catch (_) {
      /* handled */
    }
  }

  // Setup event listeners for forms
  function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      try {
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        token = data.token;
        localStorage.setItem('stebio_token', token);
        currentUser = data.user;
        onLogin();
      } catch (_) {
        /* handled */
      }
    });
    // Register
    document
      .getElementById('register-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const isSeller = document.getElementById('register-seller').checked;
        try {
          const data = await apiFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, isSeller }),
          });
          token = data.token;
          localStorage.setItem('stebio_token', token);
          currentUser = data.user;
          onLogin();
        } catch (_) {
          /* handled */
        }
      });
    // Logout
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch (_) {
        /* ignore errors on logout */
      }
      token = null;
      currentUser = null;
      localStorage.removeItem('stebio_token');
      onLogout();
    });
   
      // Nav login/register links
  const linkLogin = document.getElementById('link-login');
  const linkRegister = document.getElementById('link-register');
  if (linkLogin) {
    linkLogin.addEventListener('click', (e) => {
      e.preventDefault();
      authSection.style.display = '';
      appSection.style.display = 'none';
      document.getElementById('tab-login').click();
    });
  }
  if (linkRegister) {
    linkRegister.addEventListener('click', (e) => {
      e.preventDefault();
      authSection.style.display = '';
      appSection.style.display = 'none';
      document.getElementById('tab-register').click();
    });
  }
// Support form
    document
      .getElementById('support-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = document.getElementById('support-subject').value;
        const message = document.getElementById('support-message').value;
        try {
          await apiFetch('/api/support', {
            method: 'POST',
            body: JSON.stringify({ subject, message }),
          });
          showMessage('Ticket submitted');
          document.getElementById('support-form').reset();
          await loadSupportTickets();
        } catch (_) {
          /* handled */
        }
      });
    // Store form
    document
      .getElementById('store-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const storeId = document.getElementById('store-id').value;
        const name = document.getElementById('store-name').value;
        const description = document.getElementById('store-description').value;
        const category = document.getElementById('store-category').value;
        const bannerImage = document.getElementById('store-banner').value;
        try {
          if (storeId) {
            await apiFetch(`/api/store/${storeId}`, {
              method: 'PUT',
              body: JSON.stringify({ name, description, category, bannerImage }),
            });
            showMessage('Store updated');
          } else {
            await apiFetch('/api/store', {
              method: 'POST',
              body: JSON.stringify({ name, description, category, bannerImage }),
            });
            showMessage('Store created');
          }
          document.getElementById('store-form').reset();
          await loadStores();
          await loadSellerDashboard();
        } catch (_) {
          /* handled */
        }
      });
    // Product form
    document
      .getElementById('product-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const storeId = document.getElementById('product-store-id').value;
        const title = document.getElementById('product-title').value;
        const description = document.getElementById('product-description').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const type = document.getElementById('product-type').value;
        const billingInterval = document.getElementById('billing-interval').value;
        const trialDays = parseInt(
          document.getElementById('trial-days').value || '0',
          10
        );
        try {
          await apiFetch('/api/products', {
            method: 'POST',
            body: JSON.stringify({
              storeId,
              title,
              description,
              price,
              type,
              billingInterval,
              trialDays,
            }),
          });
          showMessage('Product created');
          document.getElementById('product-form').reset();
          await loadStores();
          await loadSellerDashboard();
        } catch (_) {
          /* handled */
        }
      });
  }

  // Called after successful login/registration
  function onLogin() {
    authSection.style.display = 'none';
    appSection.style.display = '';
      document.getElementById('link-login').style.display = 'none';
  document.getElementById('link-register').style.display = 'none';
    logoutBtn.style.display = '';
    navUserInfo.textContent = `Logged in as ${currentUser.name}`;
    // Load user specific data
    loadOrders();
    loadAffiliateStats();
    loadSupportTickets();
    loadStores();
    loadSellerDashboard();
    if (currentUser.isSeller) {
      sellerSection.style.display = '';
    } else {
      sellerSection.style.display = 'none';
    }
  }

  // Called on logout
  function onLogout() {
  authSection.style.display = 'none';
  appSection.style.display = '';
    
  logoutBtn.style.display = 'none';
  document.getElementById('link-login').style.display = '';
  document.getElementById('link-register').style.display = '';
  navUserInfo.textContent = '';
  // Clear user specific sections
  ordersDiv.innerHTML = '';
  affiliateDiv.innerHTML = '';
  ticketsDiv.innerHTML = '';
  myStoreDiv.innerHTML = '';
  sellerSection.style.display = 'none';

  // Initialize application: check token and load marketplace/stores
  async function init() {
    setupEventListeners();
    // Always load discovery and stores (even if not logged in)
    await loadDiscover();
    await loadStores();
    if (token) {
      try {
        const data = await apiFetch('/api/auth/me');
        currentUser = data;
        onLogin();
      } catch (_) {
        // token invalid, clear
        token = null;
        localStorage.removeItem('stebio_token');
        onLogout();
      }
    }
  }

  // Run init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', init);
})();
