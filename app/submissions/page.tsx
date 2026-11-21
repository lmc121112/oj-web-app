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

    const poll = setInterval(fetchAll, 2500);
    const clock = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  // Kiểm tra xem bài nộp có đang bị ẩn quá trình chấm (OI Mode) không
  const isGradingHidden = (sub: any) => {
    if (user?.role === 'admin') return false;
    const prob = problemsMap[sub.problem_id];
    if (!prob || !prob.contest_id || !prob.hide_grading) return false;
    const contest = contestsMap[prob.contest_id];
    if (!contest) return false;
    return nowMs <= new Date(contest.end_time).getTime();
  };

  // Lọc bài nộp (giữ nguyên 2 tab khi đã đăng nhập)
  const displayedSubs = submissions.filter((s) => {
    if (!user) {
      return s.username === 'guest' || !s.username;
    }
    if (s.username === 'guest' || !s.username) return false;
    if (filterTab === 'mine') {
      return s.username === user.username;
    }
    return true;
  });

  // Lấy verdict hiển thị chuẩn từ schema judge.cpp (verdict + status)
  const getDisplayVerdict = (sub: any) => {
    if (sub.status === 'Pending' || sub.status === 'Judging') {
      return sub.status;
    }
    return sub.verdict || sub.status || 'Unknown';
  };

  const getVerdictColor = (v: string) => {
    const up = (v || '').toUpperCase();
    if (up === 'AC' || up === 'ACCEPTED') return '#16a34a';
    if (up === 'PENDING' || up === 'JUDGING' || up === 'G') return '#2563eb';
    if (up === 'TLE' || up === 'TIME LIMIT EXCEEDED') return '#d97706';
    if (up === 'CE' || up === 'COMPILE ERROR') return '#9333ea';
    return '#dc2626';
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <h2 style={{ margin: 0 }}>Các bài nộp (Submissions)</h2>

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
                const displayVerdict = getDisplayVerdict(s);
                const maxTime = s.exec_time_ms ?? s.execution_time_ms;
                const maxMem = s.memory_kb ?? s.memory_used_kb;

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

                    <td style={{ padding: '10px' }}>
                      {hideNow ? (
                        <span style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '13px' }}>
                          🔒 Đã nộp (Ẩn kết quả đến hết Contest)
                        </span>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 'bold', color: getVerdictColor(displayVerdict) }}>
                              {displayVerdict}
                            </span>

                            {/* Cho phép bấm xem chi tiết nếu đã đăng nhập (kể cả CE hoặc có test_results) */}
                            {user && (!hideTestDetail || displayVerdict === 'CE') && (testResults.length > 0 || s.compile_message || s.source_code) && (
                              <button
                                type="button"
                                onClick={() => setSelectedSub(s)}
                                style={{
                                  backgroundColor: '#e2e8f0',
                                  color: '#0f172a',
                                  border: 'none',
                                  padding: '3px 9px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                }}
                              >
                                {testResults.length > 0 ? `Chi tiết (${testResults.length} test)` : 'Xem chi tiết'}
                              </button>
                            )}
                          </div>

                          {/* Thanh ô màu từng test case khớp judge.cpp (tr.verdict) */}
                          {testResults.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                              {testResults.map((tr: any, i: number) => {
                                const tv = tr.verdict || tr.status || 'G';
                                const tNum = tr.test_num || tr.test_order || i + 1;
                                const bg =
                                  tv === 'AC' || tv === 'Accepted'
                                    ? '#16a34a'
                                    : tv === 'G'
                                    ? '#1e293b'
                                    : tv === 'TLE' || tv === 'Time Limit Exceeded'
                                    ? '#d97706'
                                    : '#dc2626';
                                return (
                                  <span
                                    key={i}
                                    title={`Test #${tNum}: ${tv} (${tr.time_ms ?? 0}ms)`}
                                    style={{
                                      width: '13px',
                                      height: '13px',
                                      borderRadius: '2px',
                                      display: 'inline-block',
                                      backgroundColor: bg,
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '10px', fontSize: '13px', fontFamily: 'monospace' }}>
                      {hideNow
                        ? '— / —'
                        : `${maxTime ?? 0} ms / ${maxMem ?? 0} KB`}
                    </td>

                    <td style={{ padding: '10px', fontSize: '13px' }}>{formatGMT7(s.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Chi tiết Bài nộp đầy đủ (Test cases, Input/Expected/Actual, Compile Error, Source Code) */}
      {selectedSub && (
        <div
          onClick={() => setSelectedSub(null)}
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
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              padding: '24px',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '820px',
              maxHeight: '88vh',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0 }}>
                  Chi tiết bài nộp #{selectedSub.id} ({selectedSub.problem_id}) —{' '}
                  <span style={{ color: getVerdictColor(getDisplayVerdict(selectedSub)) }}>
                    {getDisplayVerdict(selectedSub)}
                  </span>
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Thí sinh: <b>{selectedSub.username}</b> | Ngôn ngữ: <code>{selectedSub.language}</code> | Max:{' '}
                  <code>{selectedSub.exec_time_ms ?? 0} ms / {selectedSub.memory_kb ?? 0} KB</code>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'inherit' }}
              >
                ✕
              </button>
            </div>

            {/* Lỗi biên dịch (nếu có) */}
            {selectedSub.compile_message && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '13px', marginBottom: '6px' }}>
                  Thông báo biên dịch (Compiler Output):
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '12px',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedSub.compile_message}
                </pre>
              </div>
            )}

            {/* Danh sách chi tiết từng Test case */}
            {Array.isArray(selectedSub.test_results) && selectedSub.test_results.length > 0 && (
              <div style={{ display: 'grid', gap: '12px', marginBottom: '18px' }}>
                {selectedSub.test_results.map((tr: any, idx: number) => {
                  const tv = tr.verdict || tr.status || 'G';
                  const tNum = tr.test_num || tr.test_order || idx + 1;
                  const hideTests = Boolean(
                    problemsMap[selectedSub.problem_id]?.hide_tests && user?.role !== 'admin'
                  );

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: hideTests ? 0 : '8px' }}>
                        <span>
                          Test #{tNum}:{' '}
                          <span style={{ color: getVerdictColor(tv) }}>{tv}</span>
                          {tr.judge_msg && (
                            <span style={{ fontWeight: 'normal', color: '#64748b', marginLeft: '8px' }}>
                              — {tr.judge_msg}
                            </span>
                          )}
                        </span>
                        <span style={{ fontFamily: 'monospace' }}>
                          {tr.time_ms ?? 0} ms | {tr.mem_kb ?? tr.memory_kb ?? 0} KB
                        </span>
                      </div>

                      {!hideTests && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '12px' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#64748b' }}>Input:</div>
                            <pre style={{ margin: 0, padding: '8px', borderRadius: '4px', backgroundColor: '#f1f5f9', maxHeight: '140px', overflow: 'auto', fontFamily: 'monospace' }}>
                              {tr.input ?? ''}
                            </pre>
                          </div>
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#64748b' }}>Đáp án chuẩn (Expected):</div>
                            <pre style={{ margin: 0, padding: '8px', borderRadius: '4px', backgroundColor: '#f1f5f9', maxHeight: '140px', overflow: 'auto', fontFamily: 'monospace' }}>
                              {tr.expected ?? ''}
                            </pre>
                          </div>
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#64748b' }}>Kết quả của bạn (Actual):</div>
                            <pre style={{ margin: 0, padding: '8px', borderRadius: '4px', backgroundColor: '#f1f5f9', maxHeight: '140px', overflow: 'auto', fontFamily: 'monospace' }}>
                              {tr.actual ?? ''}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mã nguồn đã nộp (chỉ hiện cho chính chủ hoặc Admin) */}
            {selectedSub.source_code && (user?.role === 'admin' || user?.username === selectedSub.username) && (
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>
                  Mã nguồn đã nộp:
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    fontSize: '12px',
                    overflowX: 'auto',
                    maxHeight: '280px',
                    fontFamily: 'Consolas, Monaco, monospace',
                  }}
                >
                  {selectedSub.source_code}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
