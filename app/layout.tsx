'use client';
import './globals.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }

    // Đảm bảo xóa class dark nếu trình duyệt còn lưu từ trước
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('oj_theme');

    const handleOpenLogin = () => {
      setIsRegisterMode(false);
      setAuthError('');
      setShowAuthModal(true);
    };
    window.addEventListener('open-login-modal', handleOpenLogin);
    return () => window.removeEventListener('open-login-modal', handleOpenLogin);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setAuthError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    if (isRegisterMode) {
      const { data: existing } = await supabase
        .from('users')
        .select('username')
        .eq('username', cleanUser)
        .single();
      if (existing) {
        setAuthError('Tên đăng nhập đã tồn tại!');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .insert({ username: cleanUser, password, role: 'user' })
        .select('username, role')
        .single();

      if (error || !data) {
        setAuthError('Lỗi đăng ký: ' + (error?.message || 'Không xác định'));
        return;
      }
      localStorage.setItem('oj_user', JSON.stringify(data));
      setUser(data);
      setShowAuthModal(false);
      window.location.reload();
    } else {
      const { data, error } = await supabase
        .from('users')
        .select('username, role')
        .eq('username', cleanUser)
        .eq('password', password)
        .single();

      if (error || !data) {
        setAuthError('Sai tên đăng nhập hoặc mật khẩu!');
        return;
      }
      localStorage.setItem('oj_user', JSON.stringify(data));
      setUser(data);
      setShowAuthModal(false);
      window.location.reload();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('oj_user');
    setUser(null);
    window.location.reload();
  };

  return (
    <html lang="vi">
      <body style={{ margin: 0, backgroundColor: '#f1f5f9', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <header
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px', textDecoration: 'none' }}>
              ⚡ Online Judge
            </Link>
            <nav style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
              <Link href="/" style={{ color: '#e2e8f0', textDecoration: 'none' }}>Bài tập</Link>
              <Link href="/contests" style={{ color: '#e2e8f0', textDecoration: 'none' }}>Kỳ thi (Contests)</Link>
              <Link href="/submissions" style={{ color: '#e2e8f0', textDecoration: 'none' }}>Các bài nộp</Link>
              {user?.role === 'admin' && (
                <Link href="/admin" style={{ color: '#fbbf24', fontWeight: 'bold', textDecoration: 'none' }}>
                  Quản trị (Admin)
                </Link>
              )}
            </nav>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
            {user ? (
              <>
                <span>
                  Xin chào, <b>{user.username}</b>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setAuthError('');
                  setShowAuthModal(true);
                }}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Đăng nhập / Đăng ký
              </button>
            )}
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
              backgroundColor: 'rgba(0,0,0,0.6)',
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
                backgroundColor: '#fff',
                color: '#0f172a',
                padding: '24px',
                borderRadius: '10px',
                width: '100%',
                maxWidth: '380px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
                {isRegisterMode ? 'Đăng ký tài khoản mới' : 'Đăng nhập hệ thống'}
              </h3>

              <form onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                {authError && <div style={{ color: '#dc2626', fontSize: '13px' }}>{authError}</div>}
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {isRegisterMode ? 'Đăng ký' : 'Đăng nhập'}
                </button>
              </form>

              <div style={{ marginTop: '12px', fontSize: '13px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setAuthError('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {isRegisterMode ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
                </button>
              </div>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
