'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: number; username: string; role: string } | null>(null);
  const [needInitAdmin, setNeedInitAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Form state cho Đăng nhập & Tạo Admin lần đầu
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    // Khôi phục giao diện Sáng / Tối
    const savedTheme = localStorage.getItem('oj_theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const checkSystem = async () => {
      // 1. Kiểm tra xem hệ thống đã có tài khoản admin nào chưa
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (!admins || admins.length === 0) {
        setNeedInitAdmin(true);
      }

      // 2. Khôi phục phiên đăng nhập từ localStorage
      const saved = localStorage.getItem('oj_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const { data: dbUser } = await supabase
            .from('users')
            .select('id, username, role')
            .eq('id', parsed.id)
            .single();
          if (dbUser) {
            setUser(dbUser);
            localStorage.setItem('oj_user', JSON.stringify(dbUser));
          } else {
            localStorage.removeItem('oj_user');
          }
        } catch {
          localStorage.removeItem('oj_user');
        }
      }
      setLoadingAuth(false);
    };

    checkSystem();

    const openLoginHandler = () => {
      setAuthError('');
      setUsernameInput('');
      setPasswordInput('');
      setShowLoginModal(true);
    };
    window.addEventListener('open-login-modal', openLoginHandler);
    return () => window.removeEventListener('open-login-modal', openLoginHandler);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('oj_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('oj_theme', 'light');
    }
  };

  // Xử lý tạo tài khoản Admin mặc định lần đầu
  const handleCreateDefaultAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .insert({ username: usernameInput.trim(), password: passwordInput.trim(), role: 'admin' })
      .select('id, username, role')
      .single();

    if (error) {
      setAuthError('Lỗi khởi tạo Admin: ' + error.message);
    } else if (data) {
      setUser(data);
      localStorage.setItem('oj_user', JSON.stringify(data));
      setNeedInitAdmin(false);
      window.location.reload();
    }
  };

  // Xử lý đăng nhập
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('username', usernameInput.trim())
      .eq('password', passwordInput.trim())
      .single();

    if (error || !data) {
      setAuthError('Sai tên đăng nhập hoặc mật khẩu!');
    } else {
      setUser(data);
      localStorage.setItem('oj_user', JSON.stringify(data));
      setShowLoginModal(false);
      window.location.reload();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('oj_user');
    setUser(null);
    window.location.href = '/';
  };

  return (
    <html lang="vi">
      <body>
        {/* Thanh điều hướng */}
        <nav
          style={{
            backgroundColor: 'var(--bg-nav)',
            color: '#fff',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '18px' }}>
              ⚡ Online Judge
            </Link>
            <Link href="/" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '15px' }}>
              Luyện tập tự do
            </Link>
            <Link href="/contests" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '15px' }}>
              Contest
            </Link>
            <Link href="/submissions" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '15px' }}>
              Bài nộp
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin" style={{ color: '#fbbf24', fontWeight: 'bold', textDecoration: 'none', fontSize: '15px' }}>
                ⚙ Quản trị Admin
              </Link>
            )}
          </div>

          {/* Góc trên bên phải: Dark Mode, Giờ hệ thống, Tài khoản */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={toggleDarkMode}
              title={darkMode ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối (Dark Mode)'}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {darkMode ? '☀️ Sáng' : '🌙 Tối'}
            </button>

            <span style={{ fontSize: '12px', color: '#94a3b8' }}>GMT+7 (Hà Nội)</span>

            {!loadingAuth &&
              (user ? (
                <>
                  <Link href="/account" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
                    👤 {user.username} ({user.role})
                  </Link>
                  <button
                    onClick={handleLogout}
                    style={{
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                    }}
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setAuthError('');
                    setUsernameInput('');
                    setPasswordInput('');
                    setShowLoginModal(true);
                  }}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                >
                  Đăng nhập
                </button>
              ))}
          </div>
        </nav>

        {/* Nội dung chính */}
        <main style={{ maxWidth: '1160px', margin: '24px auto', padding: '0 16px' }}>{children}</main>

        {/* Modal Bắt buộc tạo Admin lần đầu */}
        {needInitAdmin && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <form
              onSubmit={handleCreateDefaultAdmin}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                padding: '28px',
                borderRadius: '10px',
                width: '380px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              }}
            >
              <h3 style={{ marginTop: 0, color: '#dc2626' }}>⚠ Khởi tạo Admin mặc định</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Hệ thống phát hiện chưa có tài khoản quản trị viên nào. Vui lòng tạo tài khoản <b>Admin</b> đầu tiên để vận hành Online Judge.
              </p>
              {authError && <p style={{ color: '#dc2626', fontSize: '13px' }}>{authError}</p>}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Tên đăng nhập Admin</label>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-input)' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Mật khẩu Admin</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-input)' }}
                />
              </div>
              <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Tạo tài khoản Admin & Bắt đầu
              </button>
            </form>
          </div>
        )}

        {/* Modal Đăng nhập */}
        {showLoginModal && !needInitAdmin && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
            <form
              onSubmit={handleLogin}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                padding: '24px',
                borderRadius: '10px',
                width: '350px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>Đăng nhập hệ thống</h3>
                <button type="button" onClick={() => setShowLoginModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '18px', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
              {authError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 10px 0' }}>{authError}</p>}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Tài khoản</label>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-input)' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Mật khẩu</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-input)' }}
                />
              </div>
              <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Đăng nhập
              </button>
            </form>
          </div>
        )}
      </body>
    </html>
  );
}
