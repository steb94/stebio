// auth.js – Client-side navigation logic for Steb.io.

(function() {
  function renderAuth() {
    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    const role     = localStorage.getItem('role');
    // Grab nav elements by ID
    const navSignup       = document.getElementById('navSignup');
    const navLogin        = document.getElementById('navLogin');
    const navLogout       = document.getElementById('navLogout');
    const navCreateStore  = document.getElementById('navCreateStore');
    const navCreateProduct= document.getElementById('navCreateProduct');
    const navDashboard    = document.getElementById('navDashboard');
    const navMyProducts   = document.getElementById('navMyProducts');
    if (!navSignup || !navLogin || !navLogout) return;
    if (loggedIn) {
      navSignup.style.display = 'none';
      navLogin.style.display  = 'none';
      navLogout.style.display = 'inline-block';
      if (role === 'seller') {
        if (navCreateStore)   navCreateStore.style.display   = 'inline-block';
        if (navCreateProduct) navCreateProduct.style.display = 'inline-block';
        if (navDashboard)     navDashboard.style.display     = 'inline-block';
        if (navMyProducts)    navMyProducts.style.display    = 'none';
      } else {
        if (navCreateStore)   navCreateStore.style.display   = 'none';
        if (navCreateProduct) navCreateProduct.style.display = 'none';
        if (navDashboard)     navDashboard.style.display     = 'none';
        if (navMyProducts)    navMyProducts.style.display    = 'inline-block';
      }
    } else {
      navSignup.style.display      = 'inline-block';
      navLogin.style.display       = 'inline-block';
      navLogout.style.display      = 'none';
      if (navCreateStore)   navCreateStore.style.display   = 'none';
      if (navCreateProduct) navCreateProduct.style.display = 'none';
      if (navDashboard)     navDashboard.style.display     = 'none';
      if (navMyProducts)    navMyProducts.style.display    = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const logoutEl = document.getElementById('navLogout');
    if (logoutEl) {
      logoutEl.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'index.html';
      });
    }
    renderAuth();
  });
})();
