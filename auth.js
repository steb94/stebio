/*
 * Auth utility for Steb.io (frontend directory)
 * This script updates the navigation auth links based on login state.
 * If a user is logged in (flag stored in localStorage), it displays a welcome message
 * and a logout link. Otherwise it shows a sign in link.
 */
(function() {
  // Find the auth-links container on the page
  const authLinks = document.querySelector('.auth-links');
  if (!authLinks) return;
  const loggedIn = localStorage.getItem('loggedIn') === 'true';
  if (loggedIn) {
    const username = localStorage.getItem('username') || 'User';
    // Create welcome text and logout link
    authLinks.innerHTML = `<span>Hi, ${username}</span> | <a href="#" id="logout-link">Logout</a>`;
    // Attach click handler to logout
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Clear login info and reload page
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('username');
        location.reload();
      });
    }
  } else {
    // Not logged in: show sign in and sign up links
    authLinks.innerHTML = '<a href="dashboard.html" id="login-link">Sign In</a> | <a href="signup.html" id="signup-link">Sign Up</a>';
  }
})();