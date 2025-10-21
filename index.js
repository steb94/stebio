import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';

const fetcher = url => fetch(url).then(res => res.json());

export default function Home() {
  const router = useRouter();
  const { data: products, error } = useSWR(
    `${process.env.API_BASE_URL}/api/products`,
    fetcher
  );
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Check for auth token in localStorage
    if (typeof window !== 'undefined') {
      const t = localStorage.getItem('token');
      setToken(t);
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      setToken(null);
      router.push('/');
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>STEB.io Marketplace</h1>
      <p>
        {token ? (
          <>
            <Link href="/dashboard">Dashboard</Link> |{' '}
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
          </>
        ) : (
          <>
            <Link href="/register">Register</Link> |{' '}
            <Link href="/login">Login</Link>
          </>
        )}
      </p>
      <h2>Products</h2>
      {error && <div>Error loading products</div>}
      {!products && <div>Loading...</div>}
      {products && (
        <ul>
          {products.map(product => (
            <li key={product.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{product.name}</strong> - ${product.price.toFixed(2)} ({product.type})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
