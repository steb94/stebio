// Shared authentication script for Steb.io
// Updates navigation links based on login state and handles logout.

(function () {
  const authLinks = document.querySelector('.auth-links');
  if (!authLinks) return;

  function renderAuthLinks() {
    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (loggedIn) {
      authLinks.innerHTML = '<a href="#" id="logoutBtn">Logout</a>';
      const btn = document.getElementById('logoutBtn');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        // Clear all stored auth data
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('storeId');
        // Return to home page
        window.location.href = 'index.html';
      });
    } else {
      authLinks.innerHTML = '<a href="login.html">Sign in</a>';
    }
  }

  renderAuthLinks();
})();
