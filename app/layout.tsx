'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // Dọn dẹp class/storage dark mode cũ nếu còn sót
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('oj_theme');

    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }

    const handleOpenModal = () => {
      setAuthMode('login');
      setShowAuthModal(true);
    };
    window.addEventListener('open-login-modal', handleOpenModal);
    return () => window.removeEventListener('open-login-modal', handleOpenModal);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) return;
    setAuthLoading(true);

    if (authMode === 'login') {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', cleanUser)
        .eq('password', password)
        .single();

      setAuthLoading(false);
      if (error || !data) {
        alert('Sai tên đăng nhập hoặc mật khẩu!');
        return;
      }
      localStorage.setItem('oj_user', JSON.stringify(data));
      setUser(data);
      setShowAuthModal(false);
      setUsername('');
      setPassword('');
      window.location.reload();
    } else {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', cleanUser)
        .maybeSingle();

      if (existing) {
        setAuthLoading(false);
        alert('Tên đăng nhập đã tồn tại!');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .insert({ username: cleanUser, password, role: 'user' })
        .select('*')
        .single();

      setAuthLoading(false);
      if (error || !data) {
        alert('Lỗi đăng ký: ' + (error?.message || 'Không xác định'));
        return;
      }
      localStorage.setItem('oj_user', JSON.stringify(data));
      setUser(data);
      setShowAuthModal(false);
      setUsername('');
      setPassword('');
      window.location.reload();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('oj_user');
    setUser(null);
    window.location.reload();
  };

  const navLinkStyle = (active: boolean): React.CSSProperties => ({
    color: active ? '#ffffff' : '#cbd5e1',
    textDecoration: 'none',
    fontWeight: active ? 'bold' : 500,
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: active ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
    fontSize: '14px',
  });

  return (
    <html lang="vi">
      <body style={{ backgroundColor: '#f8fafc', color: '#0f172a', minHeight: '100vh' }}>
        <header
          style={{
            backgroundColor: '#0f172a',
            color: '#fff',
            padding: '12px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          <div
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <Link
                href="/"
                style={{
                  color: '#38bdf8',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  textDecoration: 'none',
                  letterSpacing: '0.3px',
                }}
              >
                ⚡ Online Judge
              </Link>

              <nav style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <Link href="/" style={navLinkStyle(pathname === '/')}>
                  Bài tập
                </Link>
                <Link href="/contests" style={navLinkStyle(pathname?.startsWith('/contests') ?? false)}>
                  Kỳ thi (Contests)
                </Link>
                <Link href="/submissions" style={navLinkStyle(pathname === '/submissions')}>
                  Các bài nộp
                </Link>
                {user?.role === 'admin' && (
                  <Link href="/admin" style={navLinkStyle(pathname === '/admin')}>
                    Quản trị (Admin)
                  </Link>
                )}
              </nav>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {user ? (
                <>
                  <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                    Xin chào, <b>{user.username}</b>{' '}
                    {user.role === 'admin' && (
                      <span
                        style={{
                          backgroundColor: '#dc2626',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          marginLeft: '4px',
                        }}
                      >
                        ADMIN
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      backgroundColor: '#334155',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Đăng nhập / Đăng ký
                </button>
              )}
            </div>
          </div>
        </header>

        <main style={{ maxWidth: '1200px', margin: '24px auto', padding: '0 16px' }}>
          {children}
        </main>

        {/* Modal Đăng nhập / Đăng ký */}
        {showAuthModal && (
          <div
            onClick={() => setShowAuthModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#ffffff',
                color: '#0f172a',
                padding: '24px',
                borderRadius: '10px',
                width: '100%',
                maxWidth: '380px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>
                  {authMode === 'login' ? 'Đăng nhập hệ thống' : 'Đăng ký tài khoản'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >
                  {authLoading
                    ? 'Đang xử lý...'
                    : authMode === 'login'
                    ? 'Đăng nhập'
                    : 'Tạo tài khoản'}
                </button>
              </form>

              <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                {authMode === 'login' ? (
                  <>
                    Chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Đăng ký ngay
                    </button>
                  </>
                ) : (
                  <>
                    Đã có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Đăng nhập
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
