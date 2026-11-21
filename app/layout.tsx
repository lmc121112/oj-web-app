'use client';
import './globals.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }

    document.documentElement.classList.remove('dark');
    localStorage.removeItem('oj_theme');

    // Kiểm tra xem hệ thống đã có tài khoản Admin nào chưa
    const checkInitialAdmin = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (!error && (!data || data.length === 0)) {
        // Nếu chưa có Admin -> xóa session cũ (nếu có) và ép buộc khởi tạo Admin đầu tiên
        localStorage.removeItem('oj_user');
        setUser(null);
        setNeedsAdminSetup(true);
      } else {
        setNeedsAdminSetup(false);
      }
      setCheckingAdmin(false);
    };

    checkInitialAdmin();

    const handleOpenLogin = () => {
      setIsRegisterMode(false);
      setAuthError('');
      setShowAuthModal(true);
    };
    window.addEventListener('open-login-modal', handleOpenLogin);
    return () => window.removeEventListener('open-login-modal', handleOpenLogin);
  }, []);

  // Xử lý khởi tạo tài khoản Admin đầu tiên bắt buộc
  const handleCreateFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanUser = username.trim();

    if (!cleanUser || !password) {
      setAuthError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu Admin.');
      return;
    }
    if (password.length < 4) {
      setAuthError('Mật khẩu Admin cần tối thiểu 4 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Mật khẩu xác nhận không khớp!');
      return;
    }

    setAuthLoading(true);
    // Kiểm tra lại lần nữa tránh tạo trùng
    const { data: existingAdmins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (existingAdmins && existingAdmins.length > 0) {
      setNeedsAdminSetup(false);
      setAuthLoading(false);
      window.location.reload();
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(
        { username: cleanUser, password, role: 'admin' },
        { onConflict: 'username' }
      )
      .select('id, username, role')
      .single();

    setAuthLoading(false);

    if (error || !data) {
      setAuthError('Lỗi khởi tạo Admin: ' + (error?.message || 'Không xác định'));
      return;
    }

    localStorage.setItem('oj_user', JSON.stringify(data));
    setUser(data);
    setNeedsAdminSetup(false);
    window.location.reload();
  };

  // Xử lý Đăng nhập / Đăng ký thông thường khi đã có Admin
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setAuthError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setAuthLoading(true);
    if (isRegisterMode) {
      const { data: existing } = await supabase
        .from('users')
        .select('username')
        .eq('username', cleanUser)
        .maybeSingle();
      if (existing) {
        setAuthError('Tên đăng nhập đã tồn tại!');
        setAuthLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .insert({ username: cleanUser, password, role: 'user' })
        .select('id, username, role')
        .single();

      setAuthLoading(false);
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
        .select('id, username, role')
        .eq('username', cleanUser)
        .eq('password', password)
        .maybeSingle();

      setAuthLoading(false);
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
                <Link
                  href="/account"
                  title="Bấm để đổi mật khẩu và chỉnh sửa template code"
                  style={{
                    color: '#f8fafc',
                    textDecoration: 'none',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>👤 Xin chào,</span>
                  <b style={{ color: '#93c5fd', textDecoration: 'underline' }}>{user.username}</b>
                </Link>
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
          {checkingAdmin ? (
            <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
              Đang kiểm tra trạng thái hệ thống...
            </div>
          ) : (
            children
          )}
        </main>

        {/* MODAL BẮT BUỘC KHỞI TẠO ADMIN ĐẦU TIÊN (KHÔNG THỂ ĐÓNG NẾU CHƯA TẠO XONG) */}
        {!checkingAdmin && needsAdminSetup && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2000,
              padding: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#fff',
                color: '#0f172a',
                padding: '28px',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '420px',
                boxShadow: '0 20px 35px rgba(0,0,0,0.35)',
                borderTop: '5px solid #dc2626',
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#dc2626', fontSize: '20px' }}>
                🛡️ Khởi tạo Quản trị viên (Admin)
              </h3>
              <p style={{ marginTop: 0, marginBottom: '18px', fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
                Hệ thống hiện chưa có tài khoản <b>Admin</b> nào. Bạn bắt buộc phải thiết lập tài khoản Quản trị viên đầu tiên trước khi sử dụng Online Judge.
              </p>

              <form onSubmit={handleCreateFirstAdmin} style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                    Tên đăng nhập Admin
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ví dụ: admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                    Mật khẩu Admin
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu quản trị"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                    Xác nhận mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập lại mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {authError && (
                  <div style={{ color: '#dc2626', fontSize: '13px', fontWeight: 'bold' }}>
                    ❌ {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    marginTop: '4px',
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '11px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    cursor: authLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {authLoading ? 'Đang khởi tạo...' : '🚀 Tạo tài khoản Admin & Bắt đầu'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Đăng nhập / Đăng ký thông thường */}
        {!needsAdminSetup && showAuthModal && (
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
                  disabled={authLoading}
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
                  {authLoading ? 'Đang xử lý...' : isRegisterMode ? 'Đăng ký' : 'Đăng nhập'}
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
