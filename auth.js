const navMyProducts = document.getElementById('navMyProducts');
// ... existing code that checks if a user is logged in ...
if (user) {
  // hide signup/login, show logout/dashboard/my-products
  navMyProducts.style.display = 'inline-block';
} else {
  navMyProducts.style.display = 'none';
}


  renderAuthLinks();
})();
