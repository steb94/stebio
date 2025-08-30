/*
 * store.js
 *
 * Handles rendering a store profile page. The script reads the `id`
 * parameter from the URL, requests `/api/stores/:id` to get store
 * information along with its products, and renders them. Logged in users
 * will see their name in the nav and can logout; product cards link
 * out to the dedicated product pages.
 */

(() => {
  const BASE_URL = 'https://stebio.onrender.com';
  let token = localStorage.getItem('stebio_token') || null;
  const messagesDiv = document.getElementById('messages');
  const userInfoSpan = document.getElementById('user-info');
  const logoutBtn = document.getElementById('logout-btn');
  const storeDetailsDiv = document.getElementById('store-details');
  const productsGrid = document.getElementById('store-products');

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

  async function loadStore(id) {
    try {
      const data = await apiFetch(`/api/stores/${id}`);
      const { store, products } = data;
      // Render store details
      const section = document.createElement('div');
      section.className = 'store-detail-card';
      section.innerHTML = `<h2>${store.name}</h2>
        <p>${store.description || ''}</p>
        <p><strong>Category:</strong> ${store.category}</p>`;
      storeDetailsDiv.innerHTML = '';
      storeDetailsDiv.appendChild(section);
      // Render products in a grid
      productsGrid.innerHTML = '';
      products.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const image = document.createElement('div');
        image.className = 'product-image';
        card.appendChild(image);
        const title = document.createElement('h4');
        title.textContent = p.title;
        card.appendChild(title);
        const desc = document.createElement('p');
        desc.textContent = p.description ? p.description.substring(0, 100) + (p.description.length > 100 ? '…' : '') : '';
        card.appendChild(desc);
        const meta = document.createElement('p');
        meta.className = 'product-meta';
        meta.innerHTML = `$${p.price.toFixed(2)} · ${p.type.replace('_', ' ')}`;
        card.appendChild(meta);
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View';
        viewBtn.addEventListener('click', () => {
          window.location.href = `product.html?id=${p.id}`;
        });
        card.appendChild(viewBtn);
        productsGrid.appendChild(card);
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
        /* ignore errors */
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
      storeDetailsDiv.textContent = 'Store ID missing.';
      return;
    }
    await loadStore(id);
  });
})();
