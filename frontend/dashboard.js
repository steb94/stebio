/*
 * dashboard.js
 *
 * Implements a simple seller/buyer dashboard page. The dashboard shows
 * summary statistics (number of products, orders and total sales), a
 * minimalist bar chart visualizing these values, links to management
 * actions and a list of the user's orders. Data is fetched from
 * existing API endpoints: /api/stores and /api/orders. Note that
 * for demonstration purposes sales represent the sum of order prices
 * for the logged in user (buyer perspective); a production seller
 * dashboard would aggregate across the seller's products/orders.
 */

(() => {
  const BASE_URL = 'https://stebio.onrender.com';
  let token = localStorage.getItem('stebio_token') || null;
  const messagesDiv = document.getElementById('messages');
  const userInfoSpan = document.getElementById('user-info');
  const logoutBtn = document.getElementById('logout-btn');
  const summaryDiv = document.getElementById('dashboard-summary');
  const chartDiv = document.getElementById('dashboard-chart');
  const ordersDiv = document.getElementById('dashboard-orders');

  function showMessage(msg, isError = false) {
    messagesDiv.textContent = msg;
    messagesDiv.style.color = isError ? '#d32f2f' : '#388e3c';
    if (msg) {
      setTimeout(() => {
        messagesDiv.textContent = '';
      }, 5000);
    }
  }

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

  async function initUser() {
    if (!token) return null;
    try {
      const data = await apiFetch('/api/auth/me');
      userInfoSpan.textContent = `Logged in as ${data.name}`;
      logoutBtn.style.display = '';
      return data;
    } catch (_) {
      token = null;
      localStorage.removeItem('stebio_token');
      return null;
    }
  }

  async function loadSummary(user) {
    // Compute product count by filtering stores owned by the user
    let productCount = 0;
    try {
      const storesData = await apiFetch('/api/stores');
      const myStores = storesData.stores.filter((s) => s.ownerId === user.id);
      myStores.forEach((store) => {
        productCount += store.products.length;
      });
    } catch (_) {
      // ignore; counts remain zero
    }
    // Compute order count and total sales (buyer perspective)
    let orderCount = 0;
    let totalSales = 0;
    try {
      const ordersData = await apiFetch('/api/orders');
      ordersData.orders.forEach((o) => {
        orderCount++;
        totalSales += o.price;
      });
    } catch (_) {
      // ignore
    }
    renderSummary({ productCount, orderCount, totalSales });
    renderChart({ productCount, orderCount, totalSales });
  }

  function renderSummary({ productCount, orderCount, totalSales }) {
    summaryDiv.innerHTML = '';
    const cards = [
      { value: productCount, label: 'Your Products' },
      { value: orderCount, label: 'Your Orders' },
      { value: `$${totalSales.toFixed(2)}`, label: 'Your Sales' },
    ];
    cards.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.innerHTML = `<span class="stat-value">${c.value}</span><span class="stat-label">${c.label}</span>`;
      summaryDiv.appendChild(card);
    });
  }

  /**
   * Render a basic bar chart using inline SVG. The chart displays three
   * bars corresponding to product count, order count and total sales.
   * The bars are scaled relative to the largest value.
   */
  function renderChart({ productCount, orderCount, totalSales }) {
    chartDiv.innerHTML = '';
    const values = [productCount, orderCount, totalSales];
    const labels = ['Products', 'Orders', 'Sales'];
    const maxVal = Math.max(...values, 1);
    const width = 400;
    const height = 200;
    const barWidth = 80;
    const barSpacing = (width - barWidth * values.length) / (values.length + 1);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height + 40);
    // Draw bars
    values.forEach((val, i) => {
      const barHeight = (val / maxVal) * height;
      const x = barSpacing + i * (barWidth + barSpacing);
      const y = height - barHeight;
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barWidth);
      rect.setAttribute('height', barHeight);
      rect.setAttribute('fill', i === 2 ? '#10b981' : '#4f46e5');
      svg.appendChild(rect);
      // Add value label above the bar
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', x + barWidth / 2);
      text.setAttribute('y', y - 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', '#333');
      text.textContent = val instanceof Number || typeof val === 'number' ? val : val;
      svg.appendChild(text);
      // Add category label below the bar
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', x + barWidth / 2);
      label.setAttribute('y', height + 20);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '12');
      label.setAttribute('fill', '#333');
      label.textContent = labels[i];
      svg.appendChild(label);
    });
    chartDiv.appendChild(svg);
  }

  /**
   * Render a list of the user's orders. Each entry shows product title,
   * status and price. If the order is an active subscription, a cancel
   * button is provided to stop the subscription.
   */
  async function loadOrdersList() {
    ordersDiv.innerHTML = '';
    if (!token) {
      ordersDiv.textContent = 'Please log in to view your orders.';
      return;
    }
    try {
      const data = await apiFetch('/api/orders');
      if (data.orders.length === 0) {
        ordersDiv.textContent = 'You have no orders yet.';
        return;
      }
      data.orders.forEach((o) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<h4>${o.product.title}</h4>\n          <p>Status: ${o.status}</p>\n          <p>Price: $${o.price.toFixed(2)}</p>`;
        // Cancel subscription option
        if (o.status === 'active' && o.product.type === 'subscription') {
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel Subscription';
          cancelBtn.addEventListener('click', async () => {
            try {
              await apiFetch(`/api/orders/${o.id}/cancel`, { method: 'POST' });
              showMessage('Subscription cancelled');
              await loadOrdersList();
            } catch (_) {
              /* handled */
            }
          });
          card.appendChild(cancelBtn);
        }
        ordersDiv.appendChild(card);
      });
    } catch (_) {
      /* handled */
    }
  }

  function setupLogout() {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch (_) {
        /* ignore */
      }
      token = null;
      localStorage.removeItem('stebio_token');
      window.location.href = 'index.html';
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    setupLogout();
    const user = await initUser();
    if (!user) {
      summaryDiv.textContent = 'Please log in to view your dashboard.';
      return;
    }
    await loadSummary(user);
    await loadOrdersList();
  });
})();
