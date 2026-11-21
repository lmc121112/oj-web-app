'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { formatGMT7 } from '../../lib/time';

export default function ContestsListPage() {
  const [user, setUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [contests, setContests] = useState<any[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }
    setCheckedAuth(true);

    const fetchContests = async () => {
      const { data } = await supabase
        .from('contests')
        .select('*')
        .order('start_time', { ascending: false });
      if (data) setContests(data);
      setLoading(false);
    };

    fetchContests();

    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Yêu cầu 2: Chưa đăng nhập thì thông báo bắt buộc đăng nhập
  if (checkedAuth && !user) {
    return (
      <div
        style={{
          background: '#fff',
          padding: '40px 24px',
          borderRadius: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '540px',
          margin: '40px auto',
        }}
      >
        <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔒</div>
        <h2 style={{ margin: '0 0 10px 0', color: '#dc2626' }}>
          Bạn cần đăng nhập để tham gia contest
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
          Vui lòng đăng nhập bằng tài khoản thí sinh hoặc quản trị viên để xem danh sách kỳ thi và vào phòng thi.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('open-login-modal'))}
          style={{
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  const filteredContests = contests.filter((c) => {
    const kw = searchCode.trim().toLowerCase();
    if (!kw) return true;
    return (
      c.id.toLowerCase().includes(kw) ||
      (c.title || '').toLowerCase().includes(kw)
    );
  });

  const getContestStatus = (c: any) => {
    const start = new Date(c.start_time).getTime();
    const end = new Date(c.end_time).getTime();
    if (nowMs < start) {
      return { label: '⏳ Sắp diễn ra', color: '#d97706', bg: 'rgba(245, 158, 11, 0.12)', state: 'upcoming' };
    }
    if (nowMs <= end) {
      return { label: '🟢 Đang diễn ra', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)', state: 'running' };
    }
    return { label: '🏁 Đã kết thúc', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', state: 'ended' };
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Danh sách Kỳ thi (Contests)</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Bấm &ldquo;Tham gia Contest&rdquo; để mở không gian phòng thi riêng của kỳ thi đó.
          </p>
        </div>

        {/* Ô tìm kiếm contest theo mã / tên (Yêu cầu 4) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="🔍 Tìm theo mã contest hoặc tên..."
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
        <p style={{ color: '#64748b' }}>Đang tải danh sách kỳ thi...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 10px' }}>Mã Contest</th>
                <th style={{ padding: '12px 10px' }}>Tên Kỳ thi</th>
                <th style={{ padding: '12px 10px' }}>Bắt đầu (GMT+7)</th>
                <th style={{ padding: '12px 10px' }}>Kết thúc (GMT+7)</th>
                <th style={{ padding: '12px 10px' }}>Trạng thái</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredContests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    {searchCode
                      ? `Không tìm thấy contest nào khớp với mã/tên "${searchCode}".`
                      : 'Hiện chưa có kỳ thi nào được tạo.'}
                  </td>
                </tr>
              ) : (
                filteredContests.map((c) => {
                  const status = getContestStatus(c);
                  const isRestricted =
                    user?.role !== 'admin' &&
                    c.restrict_users &&
                    !(c.allowed_users || []).includes(user?.username);

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{c.id}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                        {c.title}
                        {c.restrict_users && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#92400e' }}>
                            Giới hạn thí sinh
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px' }}>{formatGMT7(c.start_time)}</td>
                      <td style={{ padding: '12px 10px' }}>{formatGMT7(c.end_time)}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: status.color,
                            backgroundColor: status.bg,
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        {isRestricted ? (
                          <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 'bold' }}>
                            ⛔ Không có quyền tham gia
                          </span>
                        ) : (
                          /* Yêu cầu 3: Mở sang tab/trang riêng chứa danh sách bài của contest */
                          <Link
                            href={`/contests/${c.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              backgroundColor: status.state === 'running' ? '#16a34a' : '#2563eb',
                              color: '#fff',
                              padding: '7px 14px',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontSize: '13px',
                              fontWeight: 'bold',
                            }}
                          >
                            {status.state === 'running'
                              ? 'Tham gia Contest ↗'
                              : status.state === 'upcoming'
                              ? 'Vào phòng chờ ↗'
                              : 'Xem lại Contest ↗'}
                          </Link>
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
