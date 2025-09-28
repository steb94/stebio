// Shared authentication script for Steb.io
// Updates navigation links based on login state and handles logout.

(function () {
  const navLinks = document.getElementById('navLinks');
  const authLinks = document.querySelector('.auth-links');
  if (!authLinks) return;

  function renderAuthLinks() {
    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (loggedIn) {
      if (navLinks) navLinks.style.display = '';
      authLinks.innerHTML = '<a href="#" id="logoutBtn">Logout</a>';
      document.getElementById('logoutBtn').addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'index.html';
      });
    } else {
      if (navLinks) navLinks.style.display = 'none';
      authLinks.innerHTML = '<a href="login.html">Sign in</a>';
    }
  }

  renderAuthLinks();
})();
