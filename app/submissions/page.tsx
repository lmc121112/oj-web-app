'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { formatGMT7 } from '../../lib/time';

export default function SubmissionsPage() {
  const [user, setUser] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [problemsMap, setProblemsMap] = useState<Record<string, any>>({});
  const [contestsMap, setContestsMap] = useState<Record<string, any>>({});
  const [filterTab, setFilterTab] = useState<'mine' | 'all'>('mine');
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }

    const fetchAll = async () => {
      const [sRes, pRes, cRes] = await Promise.all([
        supabase
          .from('submissions')
          .select('*')
          .order('id', { ascending: false })
          .limit(150),
        supabase.from('problems').select('id, title, contest_id, hide_tests, hide_grading'),
        supabase.from('contests').select('id, title, end_time'),
      ]);

      if (sRes.data) setSubmissions(sRes.data);

      if (pRes.data) {
        const pMap: Record<string, any> = {};
        pRes.data.forEach((p: any) => {
          pMap[p.id] = p;
        });
        setProblemsMap(pMap);
      }

      if (cRes.data) {
        const cMap: Record<string, any> = {};
        cRes.data.forEach((c: any) => {
          cMap[c.id] = c;
        });
        setContestsMap(cMap);
      }
    };

    fetchAll();

    // Auto refresh nhẹ để cập nhật bài đang chấm
    const poll = setInterval(fetchAll, 3000);
    const clock = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  // Kiểm tra xem một bài nộp có đang bị ẩn quá trình chấm (OI Mode) không
  const isGradingHidden = (sub: any) => {
    if (user?.role === 'admin') return false;
    const prob = problemsMap[sub.problem_id];
    if (!prob || !prob.contest_id || !prob.hide_grading) return false;
    const contest = contestsMap[prob.contest_id];
    if (!contest) return false;
    return nowMs <= new Date(contest.end_time).getTime();
  };

  // Lọc bài nộp theo trạng thái đăng nhập (giữ nguyên 2 tab khi đã đăng nhập)
  const displayedSubs = submissions.filter((s) => {
    if (!user) {
      // Chưa đăng nhập: chỉ hiện bài của guest
      return s.username === 'guest' || !s.username;
    }
    // Đã đăng nhập: ẩn toàn bộ bài của guest
    if (s.username === 'guest' || !s.username) return false;
    if (filterTab === 'mine') {
      return s.username === user.username;
    }
    return true;
  });

  const renderStatusBadge = (status: string) => {
    let color = '#dc2626';
    if (status === 'Accepted') color = '#16a34a';
    else if (status === 'Pending' || status === 'Judging') color = '#2563eb';
    else if (status === 'Time Limit Exceeded') color = '#d97706';

    return <span style={{ fontWeight: 'bold', color }}>{status}</span>;
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <h2 style={{ margin: 0 }}>Các bài nộp (Submissions)</h2>

        {/* Giữ nguyên 2 mục chuyển đổi khi đã đăng nhập */}
        {user && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setFilterTab('mine')}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: filterTab === 'mine' ? '#2563eb' : '#e2e8f0',
                color: filterTab === 'mine' ? '#fff' : '#0f172a',
              }}
            >
              Bài nộp của tôi
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: filterTab === 'all' ? '#2563eb' : '#e2e8f0',
                color: filterTab === 'all' ? '#fff' : '#0f172a',
              }}
            >
              Tất cả bài nộp
            </button>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '10px' }}>ID</th>
              <th style={{ padding: '10px' }}>Thí sinh</th>
              <th style={{ padding: '10px' }}>Bài tập</th>
              <th style={{ padding: '10px' }}>Thuộc Contest</th>
              <th style={{ padding: '10px' }}>Ngôn ngữ</th>
              <th style={{ padding: '10px' }}>Trạng thái &amp; Chi tiết từng Test</th>
              <th style={{ padding: '10px' }}>Max Time / Mem</th>
              <th style={{ padding: '10px' }}>Thời gian nộp</th>
            </tr>
          </thead>
          <tbody>
            {displayedSubs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  Chưa có bài nộp nào trong mục này.
                </td>
              </tr>
            ) : (
              displayedSubs.map((s) => {
                const prob = problemsMap[s.problem_id];
                const contestId = prob?.contest_id || null;
                const hideNow = isGradingHidden(s);
                const hideTestDetail = Boolean(prob?.hide_tests && user?.role !== 'admin');
                const testResults: any[] = Array.isArray(s.test_results) ? s.test_results : [];

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>#{s.id}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{s.username || 'guest'}</td>
                    <td style={{ padding: '10px' }}>
                      <Link
                        href={`/problem/${s.problem_id}`}
                        style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {prob ? `${prob.title} (${s.problem_id})` : s.problem_id}
                      </Link>
                    </td>

                    {/* Yêu cầu 10: Cột Thuộc Contest */}
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      {contestId ? (
                        <Link
                          href={`/contests/${contestId}`}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(37, 99, 235, 0.12)',
                            color: '#2563eb',
                            textDecoration: 'none',
                            fontWeight: 'bold',
                            fontSize: '12px',
                          }}
                        >
                          {contestId}
                        </Link>
                      ) : (
                        <span style={{ color: '#64748b', fontFamily: 'inherit' }}>Không</span>
                      )}
                    </td>

                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>{s.language}</td>

                    {/* Trạng thái & Chi tiết từng test (tự động che kín nếu đang trong giờ OI Mode) */}
                    <td style={{ padding: '10px' }}>
                      {hideNow ? (
                        <span style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '13px' }}>
                          🔒 Đã nộp (Ẩn kết quả đến hết Contest)
                        </span>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {renderStatusBadge(s.status)}
                            {user && !hideTestDetail && testResults.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedSub(s)}
                                style={{
                                  backgroundColor: '#e2e8f0',
                                  color: '#0f172a',
                                  border: 'none',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                }}
                              >
                                Chi tiết ({testResults.length} test)
                              </button>
                            )}
                          </div>

                          {/* Thanh màu mini từng test case */}
                          {testResults.length > 0 && (
                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '5px' }}>
                              {testResults.map((tr: any, i: number) => (
                                <span
                                  key={i}
                                  title={`Test #${tr.test_order || i + 1}: ${tr.status}`}
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '2px',
                                    display: 'inline-block',
                                    backgroundColor:
                                      tr.status === 'Accepted'
                                        ? '#16a34a'
                                        : tr.status === 'Time Limit Exceeded'
                                        ? '#d97706'
                                        : '#dc2626',
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '10px', fontSize: '13px', fontFamily: 'monospace' }}>
                      {hideNow
                        ? '— / —'
                        : `${s.execution_time_ms ?? '-'} ms / ${s.memory_used_kb ?? '-'} KB`}
                    </td>

                    <td style={{ padding: '10px', fontSize: '13px' }}>{formatGMT7(s.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal xem chi tiết từng Test case */}
      {selectedSub && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              padding: '24px',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0 }}>
                Chi tiết bài nộp #{selectedSub.id} ({selectedSub.problem_id})
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'inherit' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {(selectedSub.test_results || []).map((tr: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
                    <span>
                      Test #{tr.test_order || idx + 1}:{' '}
                      <span style={{ color: tr.status === 'Accepted' ? '#16a34a' : '#dc2626' }}>
                        {tr.status}
                      </span>
                    </span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {tr.time_ms ?? '-'} ms | {tr.memory_kb ?? '-'} KB
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
