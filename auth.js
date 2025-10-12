(function() {
  /**
   * Update the top navigation based on login state and user role.
   * Shows or hides links by ID. Expects that nav elements exist on the page.
   */
  function updateNav() {
    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    const role = localStorage.getItem('role');

    // Helper to show/hide an element by ID
    function show(id) {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    }
    function hide(id) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }

    if (loggedIn) {
      // When logged in, hide login/signup and show logout
      hide('navLogin');
      hide('navSignup');
      show('navLogout');
      if (role === 'seller') {
        // Determine if seller already has a store
        const storeId = localStorage.getItem('storeId');
        // Only show create store link if no store exists
        if (storeId) {
          hide('navCreateStore');
        } else {
          show('navCreateStore');
        }
        show('navCreateProduct');
        show('navDashboard');
        show('navMyProducts');
        show('navMyStore');
      } else {
        // Buyers: hide seller options
        hide('navCreateStore');
        hide('navCreateProduct');
        hide('navDashboard');
        hide('navMyProducts');
        hide('navMyStore');
      }
    } else {
      // Not logged in: show login/signup; hide seller/buyer specific links
      show('navLogin');
      show('navSignup');
      hide('navLogout');
      hide('navCreateStore');
      hide('navCreateProduct');
      hide('navDashboard');
      hide('navMyProducts');
      hide('navMyStore');
    }

    // Attach logout behaviour once
    const logoutLink = document.getElementById('navLogout');
    if (logoutLink && !logoutLink.dataset.bound) {
      logoutLink.dataset.bound = 'true';
      logoutLink.addEventListener('click', function(e) {
        e.preventDefault();
        // Clear auth-related localStorage keys
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('storeId');
        // Redirect to login page
        window.location.href = 'login.html';
      });
    }
  }

  // Run updateNav on page load
  document.addEventListener('DOMContentLoaded', updateNav);
})();
