'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatGMT7 } from '../../lib/time';

function getVerdictColor(verdict: string | null, status: string): string {
  if (status !== 'Finished' || verdict === 'G') return '#0f172a'; // Đen cho G (Grading)
  switch (verdict) {
    case 'AC':
      return '#16a34a'; // Xanh lá
    case 'WA':
      return '#dc2626'; // Đỏ
    case 'TLE':
    case 'MLE':
    case 'OLE':
    case 'ILE':
      return '#64748b'; // Xám
    case 'RTE':
    case 'RE':
      return '#f59e0b'; // Vàng hơi cam
    case 'CE':
      return '#38bdf8'; // Xanh dương nhạt
    default:
      return '#64748b';
  }
}

export default function SubmissionsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [filterTab, setFilterTab] = useState<'mine' | 'all'>('mine');

  const fetchSubs = async () => {
    const { data } = await supabase
      .from('submissions')
      .select('*, problems(hide_tests)')
      .order('id', { ascending: false })
      .limit(100);
    if (data) setSubs(data);
  };

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }

    fetchSubs();
    const channel = supabase
      .channel('realtime-submissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        fetchSubs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCaseClick = (sub: any, tc: any) => {
    const isAdmin = user?.role === 'admin';
    const isHidden = sub.problems?.hide_tests && !isAdmin;

    if (tc.verdict === 'G' || sub.verdict === 'CE' || isHidden) {
      return;
    }
    setSelectedCase({
      subId: sub.id,
      probId: sub.problem_id,
      ...tc,
    });
  };

  // Lọc danh sách bài nộp theo trạng thái đăng nhập và tab đang chọn
  const displayedSubs = subs.filter((s) => {
    if (!user) return true; // Chưa đăng nhập thì hiện danh sách chung
    if (s.username === 'guest' || !s.username) return false; // Đã đăng nhập thì ẩn bài của guest
    if (filterTab === 'mine') return s.username === user.username;
    return true; // Tab "Tất cả bài nộp" (của các tài khoản đã đăng ký)
  });

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
        <h2 style={{ margin: 0 }}>Lịch sử & Kết quả chấm bài</h2>

        {/* 2 mục chuyển đổi khi đã đăng nhập */}
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
                fontSize: '13px',
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
                fontSize: '13px',
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

      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
        Bấm vào từng ô màu của test case (khi đã chấm xong và không bị ẩn test) để xem Input, Output, Thời gian chạy và Judge Response.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <th style={{ padding: '10px' }}>ID</th>
              <th style={{ padding: '10px' }}>Thí sinh</th>
              <th style={{ padding: '10px' }}>Bài tập</th>
              <th style={{ padding: '10px' }}>Ngôn ngữ</th>
              <th style={{ padding: '10px' }}>Trạng thái & Chi tiết từng Test</th>
              <th style={{ padding: '10px' }}>Max Time / Mem</th>
              <th style={{ padding: '10px' }}>Thời gian nộp</th>
            </tr>
          </thead>
          <tbody>
            {displayedSubs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  Chưa có bài nộp nào trong mục này.
                </td>
              </tr>
            ) : (
              displayedSubs.map((s) => {
                const overallVerdict = s.status === 'Finished' ? s.verdict : 'G';
                const overallColor = getVerdictColor(s.verdict, s.status);
                const tcs = Array.isArray(s.test_results) ? s.test_results : [];
                const isHidden = s.problems?.hide_tests && user?.role !== 'admin';

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>#{s.id}</td>
                    <td style={{ padding: '10px' }}>{s.username || 'guest'}</td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.problem_id}</td>
                    <td style={{ padding: '10px' }}>{s.language}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            color: overallVerdict === 'CE' || overallVerdict === 'RTE' ? '#0f172a' : '#fff',
                            fontWeight: 'bold',
                            backgroundColor: overallColor,
                            fontSize: '12px',
                          }}
                        >
                          {overallVerdict === 'G' ? 'Grading (G)' : overallVerdict}
                        </span>
                        {isHidden && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>(Đã ẩn chi tiết test)</span>
                        )}
                      </div>

                      {overallVerdict !== 'CE' && tcs.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {tcs.map((tc: any) => {
                            const boxColor = getVerdictColor(tc.verdict, 'Finished');
                            const clickable = tc.verdict !== 'G' && !isHidden;
                            return (
                              <button
                                key={tc.test_num}
                                type="button"
                                onClick={() => handleCaseClick(s, tc)}
                                title={`Test #${tc.test_num}: ${tc.verdict} (${tc.time_ms} ms)`}
                                style={{
                                  width: '32px',
                                  height: '28px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  backgroundColor: boxColor,
                                  color: tc.verdict === 'RTE' ? '#0f172a' : '#fff',
                                  fontWeight: 'bold',
                                  fontSize: '11px',
                                  cursor: clickable ? 'pointer' : 'default',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {tc.test_num}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      {s.exec_time_ms} ms / {s.memory_kb} KB
                    </td>
                    <td style={{ padding: '10px', fontSize: '12px', color: '#64748b' }}>
                      {formatGMT7(s.created_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Chi tiết từng Test Case */}
      {selectedCase && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>
                Chi tiết Test #{selectedCase.test_num} — Bài <span style={{ fontFamily: 'monospace' }}>{selectedCase.probId}</span> (Submission #{selectedCase.subId})
              </h3>
              <button
                onClick={() => setSelectedCase(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '14px' }}>
              <span>
                Kết quả: <b style={{ color: getVerdictColor(selectedCase.verdict, 'Finished') }}>{selectedCase.verdict}</b>
              </span>
              <span>
                Thời gian chạy code: <b>{selectedCase.time_ms} ms</b>
              </span>
              <span>
                Bộ nhớ: <b>{selectedCase.mem_kb} KB</b>
              </span>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Input:</label>
                <pre style={{ margin: 0, padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '6px', overflowX: 'auto', fontSize: '13px' }}>
                  {selectedCase.input || '(Trống)'}
                </pre>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Output chuẩn:</label>
                <pre style={{ margin: 0, padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '6px', overflowX: 'auto', fontSize: '13px' }}>
                  {selectedCase.expected || '(Trống)'}
                </pre>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Output của code bạn nộp:</label>
                <pre style={{ margin: 0, padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '6px', overflowX: 'auto', fontSize: '13px' }}>
                  {selectedCase.actual || '(Không có output)'}
                </pre>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Judge Response:</label>
                <pre style={{ margin: 0, padding: '10px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '6px', overflowX: 'auto', fontSize: '13px' }}>
                  {selectedCase.judge_msg}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
