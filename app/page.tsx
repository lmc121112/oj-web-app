'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function PracticeHomePage() {
  const [user, setUser] = useState<any>(null);
  const [problems, setProblems] = useState<any[]>([]);
  const [solvedSet, setSolvedSet] = useState<Set<string>>(new Set());
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPracticeData = async () => {
      // Chỉ lấy bài luyện tập tự do (contest_id IS NULL)
      const { data: probs } = await supabase
        .from('problems')
        .select('*')
        .is('contest_id', null)
        .order('problem_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (probs) setProblems(probs);

      // Đánh dấu bài đã AC nếu đã đăng nhập
      const saved = localStorage.getItem('oj_user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          setUser(u);
          const { data: acSubs } = await supabase
            .from('submissions')
            .select('problem_id')
            .eq('username', u.username)
            .eq('status', 'Accepted');
          if (acSubs) {
            setSolvedSet(new Set(acSubs.map((s: any) => s.problem_id)));
          }
        } catch {}
      }
      setLoading(false);
    };

    fetchPracticeData();
  }, []);

  const filteredProblems = problems.filter((p) => {
    const kw = searchCode.trim().toLowerCase();
    if (!kw) return true;
    return (
      p.id.toLowerCase().includes(kw) ||
      (p.title || '').toLowerCase().includes(kw)
    );
  });

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Danh sách Bài tập Luyện tập tự do</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Các bài tập công khai để rèn luyện thuật toán không giới hạn thời gian.
          </p>
        </div>

        {/* Ô tìm kiếm bài theo mã / tên */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="🔍 Tìm theo mã bài hoặc tên bài..."
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              width: '260px',
              fontSize: '14px',
            }}
          />
          {searchCode && (
            <button
              type="button"
              onClick={() => setSearchCode('')}
              style={{
                backgroundColor: '#e2e8f0',
                color: '#0f172a',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
              }}
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Đang tải danh sách bài tập...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 10px', width: '70px' }}>Trạng thái</th>
                <th style={{ padding: '12px 10px' }}>Mã bài</th>
                <th style={{ padding: '12px 10px' }}>Tên bài tập</th>
                <th style={{ padding: '12px 10px' }}>Kiểu I/O</th>
                <th style={{ padding: '12px 10px' }}>Giới hạn</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredProblems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    {searchCode
                      ? `Không tìm thấy bài tập nào khớp với từ khóa "${searchCode}".`
                      : 'Chưa có bài tập luyện tập tự do nào.'}
                  </td>
                </tr>
              ) : (
                filteredProblems.map((p) => {
                  const isSolved = solvedSet.has(p.id);
                  const canGuestAccess = Boolean(user) || p.id.toLowerCase() === 'aplusb';

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold', color: isSolved ? '#16a34a' : '#94a3b8' }}>
                        {isSolved ? '✔ AC' : '—'}
                      </td>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {canGuestAccess ? (
                          <Link href={`/problem/${p.id}`} style={{ textDecoration: 'none', color: '#2563eb' }}>
                            {p.id}
                          </Link>
                        ) : (
                          <span style={{ color: '#64748b' }}>{p.id}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                        {canGuestAccess ? (
                          <Link href={`/problem/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {p.title}
                          </Link>
                        ) : (
                          <span>{p.title}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                        {p.io_mode === 'file' ? `${p.io_filename}.in / .out` : 'stdin / stdout'}
                      </td>
                      <td style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>
                        {p.time_limit_ms}ms / {p.memory_limit_mb}MB
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        {canGuestAccess ? (
                          <Link
                            href={`/problem/${p.id}`}
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#2563eb',
                              color: '#fff',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontSize: '13px',
                              fontWeight: 'bold',
                            }}
                          >
                            Làm bài →
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => window.dispatchEvent(new Event('open-login-modal'))}
                            style={{
                              backgroundColor: '#f59e0b',
                              color: '#fff',
                              border: 'none',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                            }}
                          >
                            🔒 Đăng nhập
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
