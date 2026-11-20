'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { formatGMT7 } from '../../lib/time';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (days > 0 ? `${days} ngày ` : '') + `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

export default function ContestsPage() {
  const [contests, setContests] = useState<any[]>([]);
  const [problemsByContest, setProblemsByContest] = useState<Record<string, any[]>>({});
  const [user, setUser] = useState<any>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [activeContestId, setActiveContestId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }

    const loadData = async () => {
      const { data: cData } = await supabase
        .from('contests')
        .select('*')
        .order('start_time', { ascending: false });
      if (cData) setContests(cData);

      const { data: pData } = await supabase
        .from('problems')
        .select('id, title, time_limit_ms, memory_limit_mb, contest_id')
        .not('contest_id', 'is', null)
        .order('created_at', { ascending: true });

      if (pData) {
        const grouped: Record<string, any[]> = {};
        for (const p of pData) {
          if (!grouped[p.contest_id]) grouped[p.contest_id] = [];
          grouped[p.contest_id].push(p);
        }
        setProblemsByContest(grouped);
      }
    };

    loadData();
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const checkUserAllowed = (c: any) => {
    if (user?.role === 'admin') return true;
    if (!user) return false;
    if (!c.restrict_users) return true;
    return Array.isArray(c.allowed_users) && c.allowed_users.includes(user.username);
  };

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0 }}>Danh sách Kỳ thi (Contest)</h2>
        {contests.length === 0 ? (
          <p style={{ color: '#64748b' }}>Hiện chưa có contest nào được tạo.</p>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {contests.map((c) => {
              const startMs = new Date(c.start_time).getTime();
              const endMs = new Date(c.end_time).getTime();
              const isBefore = nowMs < startMs;
              const isEnded = nowMs > endMs;
              const isRunning = !isBefore && !isEnded;
              const allowed = checkUserAllowed(c);
              const isExpanded = activeContestId === c.id;

              return (
                <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 6px 0' }}>{c.title}</h3>
                      <div style={{ fontSize: '13px', color: '#475569' }}>
                        <div>Bắt đầu: <b>{formatGMT7(c.start_time)}</b></div>
                        <div>Kết thúc: <b>{formatGMT7(c.end_time)}</b></div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {/* Hiển thị đồng hồ đếm ngược (Yêu cầu 6) */}
                      <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                        {isBefore && (
                          <span style={{ color: '#d97706' }}>
                            ⏳ Bắt đầu sau: {formatCountdown(startMs - nowMs)}
                          </span>
                        )}
                        {isRunning && (
                          <span style={{ color: '#16a34a' }}>
                            🔥 Thời gian còn lại: {formatCountdown(endMs - nowMs)}
                          </span>
                        )}
                        {isEnded && (
                          <span style={{ color: '#64748b' }}>⏹ Đã kết thúc</span>
                        )}
                      </div>

                      {/* Nút Tham gia contest (Yêu cầu 5) */}
                      {!allowed ? (
                        <button
                          onClick={() => alert('Bạn không có quyền truy cập contest này')}
                          style={{
                            backgroundColor: '#94a3b8',
                            color: '#fff',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'not-allowed',
                            fontWeight: 'bold',
                          }}
                        >
                          Tham gia contest
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveContestId(isExpanded ? null : c.id)}
                          style={{
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                          }}
                        >
                          {isExpanded ? 'Thu gọn danh sách bài' : 'Tham gia contest'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Danh sách bài bên trong Contest */}
                  {isExpanded && allowed && (
                    <div style={{ marginTop: '16px', backgroundColor: '#fff', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px' }}>Mã bài</th>
                            <th style={{ padding: '8px' }}>Tên bài</th>
                            <th style={{ padding: '8px' }}>Giới hạn</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(problemsByContest[c.id] || []).map((p) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 'bold' }}>{p.id}</td>
                              <td style={{ padding: '8px' }}>{p.title}</td>
                              <td style={{ padding: '8px', fontSize: '13px', color: '#64748b' }}>
                                {p.time_limit_ms} ms / {p.memory_limit_mb} MB
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                {/* Yêu cầu 6: Chưa mở / Hết hạn / Vào bài */}
                                {isBefore ? (
                                  <button
                                    disabled
                                    style={{
                                      backgroundColor: '#94a3b8',
                                      color: '#fff',
                                      border: 'none',
                                      padding: '6px 14px',
                                      borderRadius: '6px',
                                      cursor: 'not-allowed',
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    Chưa mở
                                  </button>
                                ) : isEnded ? (
                                  <button
                                    disabled
                                    style={{
                                      backgroundColor: '#94a3b8',
                                      color: '#fff',
                                      border: 'none',
                                      padding: '6px 14px',
                                      borderRadius: '6px',
                                      cursor: 'not-allowed',
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    Hết hạn
                                  </button>
                                ) : (
                                  <Link
                                    href={`/problem/${p.id}`}
                                    style={{
                                      display: 'inline-block',
                                      backgroundColor: '#16a34a',
                                      color: '#fff',
                                      padding: '6px 14px',
                                      borderRadius: '6px',
                                      textDecoration: 'none',
                                      fontWeight: 'bold',
                                      fontSize: '14px',
                                    }}
                                  >
                                    Vào bài
                                  </Link>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
