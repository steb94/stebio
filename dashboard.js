import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Dashboard() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    type: 'digital_download',
  });
  const [message, setMessage] = useState('');

  // Store management
  const [store, setStore] = useState(null);
  const [storeData, setStoreData] = useState({ name: '', description: '' });
  const [storeMessage, setStoreMessage] = useState('');

  // Fetch products and store on mount, redirect if not authenticated
  useEffect(() => {
    // Redirect to login if not authenticated
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }
    }

    async function fetchProducts() {
      try {
        const res = await fetch(`${process.env.API_BASE_URL}/api/products`);
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error(err);
      }
    }

    async function fetchStore() {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${process.env.API_BASE_URL}/api/stores/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) {
          setStore(null);
        } else {
          const data = await res.json();
          setStore(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchProducts();
    fetchStore();
  }, [router]);

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('You must be logged in as a seller');
      return;
    }
    try {
      const res = await fetch(`${process.env.API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          type: formData.type,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setProducts([...products, data]);
        setFormData({ name: '', description: '', price: '', type: 'digital_download' });
      } else {
        setMessage(data.message || 'Error creating product');
      }
    } catch (err) {
      setMessage('Error creating product');
    }
  };

  // Create store handler
  const handleStoreChange = e => {
    setStoreData({ ...storeData, [e.target.name]: e.target.value });
  };

  const handleCreateStore = async e => {
    e.preventDefault();
    setStoreMessage('');
    const token = localStorage.getItem('token');
    if (!token) {
      setStoreMessage('You must be logged in as a seller');
      return;
    }
    try {
      const res = await fetch(`${process.env.API_BASE_URL}/api/stores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: storeData.name,
          description: storeData.description,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStore(data);
        setStoreData({ name: '', description: '' });
      } else {
        setStoreMessage(data.message || 'Error creating store');
      }
    } catch (err) {
      setStoreMessage('Error creating store');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Dashboard</h1>
      <p>
        <Link href="/">Home</Link> |{' '}
        <button
          onClick={handleLogout}
          style={{
            border: 'none',
            background: 'none',
            color: 'blue',
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Logout
        </button>
      </p>
      {/* Store section */}
      {store ? (
        <div style={{ marginBottom: '1rem' }}>
          <h2>Your Store</h2>
          <p>
            <strong>Name:</strong> {store.name}
          </p>
          {store.description && (
            <p>
              <strong>Description:</strong> {store.description}
            </p>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: '1rem' }}>
          <h2>Create Your Store</h2>
          {storeMessage && <p style={{ color: 'red' }}>{storeMessage}</p>}
          <form onSubmit={handleCreateStore} style={{ maxWidth: '400px' }}>
            <label>
              Store Name:
              <input
                type="text"
                name="name"
                value={storeData.name}
                onChange={handleStoreChange}
                required
              />
            </label>
            <br />
            <label>
              Description:
              <textarea
                name="description"
                value={storeData.description}
                onChange={handleStoreChange}
              />
            </label>
            <br />
            <button type="submit">Create Store</button>
          </form>
        </div>
      )}

      {/* Product section */}
      {store && (
        <>
          {message && <p style={{ color: 'red' }}>{message}</p>}
          <h2>Create Product</h2>
          <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
            <label>
              Name:
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </label>
            <br />
            <label>
              Description:
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
              />
            </label>
            <br />
            <label>
              Price:
              <input
                type="number"
                step="0.01"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
              />
            </label>
            <br />
            <label>
              Type:
              <select name="type" value={formData.type} onChange={handleChange}>
                <option value="digital_download">Digital Download</option>
                <option value="membership">Membership</option>
                <option value="course">Course</option>
                <option value="service">Service</option>
                <option value="bundle">Bundle</option>
              </select>
            </label>
            <br />
            <button type="submit">Create Product</button>
          </form>
          <h2>All Products</h2>
          <ul>
            {products.map(product => (
              <li key={product.id}>
                <strong>{product.name}</strong> - $
                {product.price?.toFixed?.(2) || product.price} ({product.type})
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
