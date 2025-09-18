// Update navigation links based on login state and handle logout
document.addEventListener('DOMContentLoaded', () => {
  const authLinks = document.querySelector('.auth-links');
  const loggedIn = localStorage.getItem('loggedIn') === 'true';
  const username = localStorage.getItem('username');

  function updateNav() {
    if (loggedIn && username) {
      authLinks.innerHTML = `
        <span>Hi, ${username}</span>
        <a href="#" id="logout-link">Logout</a>
      `;
      document.getElementById('logout-link').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('role');
        localStorage.removeItem('storeId');
        location.reload();
      });
    } else {
      authLinks.innerHTML = '<a href="signup.html" id="signup-link">Sign Up</a>';
    }
  }

  updateNav();
});
