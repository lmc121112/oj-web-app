'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function PracticePage() {
  const [problems, setProblems] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }

    // Chỉ lấy các bài luyện tập tự do (contest_id IS NULL)
    supabase
      .from('problems')
      .select('id, title, time_limit_ms, memory_limit_mb')
      .is('contest_id', null)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setProblems(data);
        setLoading(false);
      });
  }, []);

  const openLogin = () => {
    window.dispatchEvent(new Event('open-login-modal'));
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Danh sách bài luyện tập tự do</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
        {user
          ? `Xin chào ${user.username}, bạn có quyền truy cập toàn bộ bài luyện tập tự do.`
          : 'Bạn chưa đăng nhập. Hiện chỉ có thể làm bài mẫu "aplusb". Vui lòng đăng nhập để mở khóa các bài còn lại.'}
      </p>

      {loading ? (
        <p>Đang tải danh sách bài...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <th style={{ padding: '12px' }}>Mã bài</th>
              <th style={{ padding: '12px' }}>Tên bài</th>
              <th style={{ padding: '12px' }}>Giới hạn</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p) => {
              // Yêu cầu 5: Chưa đăng nhập chỉ làm được bài aplusb
              const canAccess = Boolean(user) || p.id === 'aplusb';

              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>{p.id}</td>
                  <td style={{ padding: '12px' }}>{p.title}</td>
                  <td style={{ padding: '12px', color: '#64748b', fontSize: '14px' }}>
                    {p.time_limit_ms} ms / {p.memory_limit_mb} MB
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {canAccess ? (
                      <Link
                        href={`/problem/${p.id}`}
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#16a34a',
                          color: '#fff',
                          padding: '7px 16px',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontWeight: 'bold',
                          fontSize: '14px',
                        }}
                      >
                        Vào bài
                      </Link>
                    ) : (
                      <button
                        onClick={openLogin}
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
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
