/*
 * product.js
 *
 * Handles fetching and rendering details for a single product on the
 * dedicated product page. The page reads the `id` query parameter from
 * the URL, requests `/api/products/:id` from the backend and displays
 * the product along with its store information. If the user is logged in
 * (based on localStorage token), a "Buy" button is shown. Clicking
 * "Buy" submits a checkout request and shows a confirmation message.
 */

(() => {
  const BASE_URL = 'https://stebio.onrender.com';
  let token = localStorage.getItem('stebio_token') || null;
  const messagesDiv = document.getElementById('messages');
  const userInfoSpan = document.getElementById('user-info');
  const logoutBtn = document.getElementById('logout-btn');
  const productContainer = document.getElementById('product-details');

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
    if (!token) return;
    try {
      const data = await apiFetch('/api/auth/me');
      userInfoSpan.textContent = `Logged in as ${data.name}`;
      logoutBtn.style.display = '';
    } catch (_) {
      token = null;
      localStorage.removeItem('stebio_token');
    }
  }

  async function loadProduct(id) {
    try {
      const data = await apiFetch(`/api/products/${id}`);
      const { product, store } = data;
      const card = document.createElement('div');
      card.className = 'product-detail-card';
      card.innerHTML = `<h2>${product.title}</h2>
        <p>${product.description || ''}</p>
        <p><strong>Price:</strong> $${product.price.toFixed(2)}</p>
        <p><strong>Type:</strong> ${product.type.replace('_', ' ')}</p>
        <p><strong>Store:</strong> <a href="store.html?id=${store.id}">${store.name}</a></p>`;
      if (token) {
        const buyBtn = document.createElement('button');
        buyBtn.textContent = 'Buy Now';
        buyBtn.addEventListener('click', async () => {
          try {
            await apiFetch('/api/checkout', {
              method: 'POST',
              body: JSON.stringify({ productId: id }),
            });
            showMessage('Order placed successfully!');
          } catch (_) {
            /* handled */
          }
        });
        card.appendChild(buyBtn);
      } else {
        const info = document.createElement('p');
        info.textContent = 'Please log in to purchase this product.';
        card.appendChild(info);
      }
      productContainer.innerHTML = '';
      productContainer.appendChild(card);
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
    await initUser();
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      productContainer.textContent = 'Product ID missing.';
      return;
    }
    loadProduct(id);
  });
})();
