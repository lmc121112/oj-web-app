'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: number; username: string; role: string } | null>(null);
  const [needInitAdmin, setNeedInitAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Form state cho Đăng nhập & Tạo Admin lần đầu
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const checkSystem = async () => {
      // 1. Kiểm tra xem hệ thống đã có tài khoản admin nào chưa (Yêu cầu 10)
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
          // Xác thực lại với DB xem tài khoản còn tồn tại không
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

    // Lắng nghe sự kiện mở modal đăng nhập từ các trang con (Yêu cầu 5)
    const openLoginHandler = () => {
      setAuthError('');
      setUsernameInput('');
      setPasswordInput('');
      setShowLoginModal(true);
    };
    window.addEventListener('open-login-modal', openLoginHandler);
    return () => window.removeEventListener('open-login-modal', openLoginHandler);
  }, []);

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
      <body style={{ fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0, backgroundColor: '#f1f5f9', color: '#0f172a' }}>
        {/* Thanh điều hướng */}
        <nav style={{ backgroundColor: '#0f172a', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '18px' }}>
              ⚡ Online Judge
            </Link>
            <Link href="/" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '15px' }}>Luyện tập tự do</Link>
            <Link href="/contests" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '15px' }}>Contest</Link>
            <Link href="/submissions" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '15px' }}>Bài nộp</Link>
            {user?.role === 'admin' && (
              <Link href="/admin" style={{ color: '#fbbf24', fontWeight: 'bold', textDecoration: 'none', fontSize: '15px' }}>
                ⚙ Quản trị Admin
              </Link>
            )}
          </div>

          {/* Góc trên bên phải: Quản lý tài khoản & Đăng nhập/Đăng xuất */}
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>GMT+7 (Hà Nội)</span>
            {!loadingAuth && (
              user ? (
                <>
                  <Link href="/account" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
                    👤 {user.username} ({user.role})
                  </Link>
                  <button
                    onClick={handleLogout}
                    style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
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
                  style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                >
                  Đăng nhập
                </button>
              )
            )}
          </div>
        </nav>

        {/* Nội dung chính */}
        <main style={{ maxWidth: '1100px', margin: '24px auto', padding: '0 16px' }}>
          {children}
        </main>

        {/* Modal Bắt buộc tạo Admin lần đầu (Yêu cầu 10) */}
        {needInitAdmin && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <form onSubmit={handleCreateDefaultAdmin} style={{ backgroundColor: '#fff', padding: '28px', borderRadius: '10px', width: '380px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
              <h3 style={{ marginTop: 0, color: '#dc2626' }}>⚠ Khởi tạo Admin mặc định</h3>
              <p style={{ fontSize: '14px', color: '#475569' }}>
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
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Mật khẩu Admin</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Tạo tài khoản Admin & Bắt đầu
              </button>
            </form>
          </div>
        )}

        {/* Modal Đăng nhập (Yêu cầu 5) */}
        {showLoginModal && !needInitAdmin && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
            <form onSubmit={handleLogin} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '10px', width: '350px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>Đăng nhập hệ thống</h3>
                <button type="button" onClick={() => setShowLoginModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
              {authError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 10px 0' }}>{authError}</p>}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Tài khoản</label>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Mật khẩu</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
