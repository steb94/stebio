/*

 * support.js

 *

 * Handles the support page. Allows logged in users to submit support

 * tickets and view a list of their existing tickets. Tickets are

 * retrieved from the backend via /api/support. For unauthenticated

 * users, the page prompts them to log in.

 */



(() => {

  const BASE_URL = 'https://stebio.onrender.com';

  let token = localStorage.getItem('stebio_token') || null;

  const messagesDiv = document.getElementById('messages');

  const userInfoSpan = document.getElementById('user-info');

  const logoutBtn = document.getElementById('logout-btn');

  const supportForm = document.getElementById('support-form');

  const ticketsDiv = document.getElementById('support-tickets');



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



  async function loadSupportTickets() {

    ticketsDiv.innerHTML = '';

    if (!token) {

      ticketsDiv.textContent = 'Please log in to view your support tickets.';

      return;

    }

    try {

      const data = await apiFetch('/api/support');

      if (data.tickets.length === 0) {

        ticketsDiv.textContent = 'You have no support tickets.';

        return;

      }

      data.tickets.forEach((t) => {

        const item = document.createElement('div');

        item.className = 'card';

        item.innerHTML = `<h4>${t.subject}</h4>

          <p>Status: ${t.status}</p>

          <p>${t.message}</p>`;

        ticketsDiv.appendChild(item);

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



  function setupForm() {

    supportForm.addEventListener('submit', async (e) => {

      e.preventDefault();

      if (!token) {

        showMessage('Please log in to submit a support ticket.', true);

        return;

      }

      const subject = document.getElementById('support-subject').value;

      const message = document.getElementById('support-message').value;

      try {

        await apiFetch('/api/support', {

          method: 'POST',

          body: JSON.stringify({ subject, message }),

        });

        showMessage('Ticket submitted');

        supportForm.reset();

        await loadSupportTickets();

      } catch (_) {

        /* handled */

      }

    });

  }



  document.addEventListener('DOMContentLoaded', async () => {

    setupLogout();

    await initUser();

    setupForm();

    await loadSupportTickets();

  });

})();
