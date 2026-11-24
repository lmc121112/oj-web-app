'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { formatGMT7 } from '../../../lib/time';

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return days > 0
    ? `${days} ngày ${pad(hours)}:${pad(mins)}:${pad(secs)}`
    : `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

export default function ContestRoomPage() {
  const params = useParams();
  const contestId = decodeURIComponent(String(params?.id || ''));

  const [user, setUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [contest, setContest] = useState<any>(null);
  const [problems, setProblems] = useState<any[]>([]);
  const [solvedSet, setSolvedSet] = useState<Set<string>>(new Set());
  const [submittedSet, setSubmittedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    let currentUser: any = null;
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        setUser(currentUser);
      } catch {}
    }
    setCheckedAuth(true);

    const loadContestRoom = async () => {
      if (!contestId) return;
      const [cRes, pRes] = await Promise.all([
        supabase.from('contests').select('*').eq('id', contestId).single(),
        supabase
          .from('problems')
          .select('*')
          .eq('contest_id', contestId)
          .order('problem_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      if (cRes.data) setContest(cRes.data);
      if (pRes.data) setProblems(pRes.data);

      if (currentUser && pRes.data && pRes.data.length > 0) {
        const probIds = pRes.data.map((p: any) => p.id);
        const { data: mySubs } = await supabase
          .from('submissions')
          .select('problem_id, status')
          .eq('username', currentUser.username)
          .in('problem_id', probIds);

        if (mySubs) {
          const ac = new Set<string>();
          const sub = new Set<string>();
          mySubs.forEach((s: any) => {
            sub.add(s.problem_id);
            if (s.status === 'Accepted') ac.add(s.problem_id);
          });
          setSolvedSet(ac);
          setSubmittedSet(sub);
        }
      }
      setLoading(false);
    };

    loadContestRoom();

    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [contestId]);

  // Chưa đăng nhập -> Yêu cầu đăng nhập
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
            cursor: 'pointer',
          }}
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
        Đang tải thông tin phòng thi...
      </div>
    );
  }

  if (!contest) {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', color: '#dc2626' }}>
        ❌ Không tìm thấy Contest có mã <code>{contestId}</code>.
      </div>
    );
  }

  // Kiểm tra quyền user đối với contest bị giới hạn
  if (
    user?.role !== 'admin' &&
    contest.restrict_users &&
    !(contest.allowed_users || []).includes(user?.username)
  ) {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', color: '#dc2626', fontWeight: 'bold' }}>
        ⛔ Tài khoản <b>{user.username}</b> không nằm trong danh sách được phép tham gia kỳ thi này.
      </div>
    );
  }

  const startMs = new Date(contest.start_time).getTime();
  const endMs = new Date(contest.end_time).getTime();
  const isUpcoming = nowMs < startMs;
  const isRunning = nowMs >= startMs && nowMs <= endMs;
  const isEnded = nowMs > endMs;
  const isLockedForUser = (isUpcoming || isEnded) && user?.role !== 'admin';

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Banner thông tin Contest & Đồng hồ đếm ngược */}
      <div
        style={{
          background: '#fff',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ marginBottom: '6px' }}>
            <Link href="/contests" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
              ← Quay lại danh sách Contest
            </Link>
          </div>
          <h2 style={{ margin: '0 0 6px 0' }}>
            🏆 {contest.title}{' '}
            <span style={{ fontSize: '14px', fontFamily: 'monospace', color: '#64748b' }}>
              [{contest.id}]
            </span>
          </h2>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Thời gian: <b>{formatGMT7(contest.start_time)}</b> → <b>{formatGMT7(contest.end_time)}</b> (GMT+7)
          </div>
        </div>

        {/* Khung đồng hồ đếm ngược */}
        <div
          style={{
            padding: '12px 20px',
            borderRadius: '8px',
            border: `2px solid ${isRunning ? '#16a34a' : isUpcoming ? '#d97706' : '#64748b'}`,
            backgroundColor: isRunning
              ? 'rgba(22, 163, 74, 0.08)'
              : isUpcoming
              ? 'rgba(245, 158, 11, 0.08)'
              : 'rgba(100, 116, 139, 0.08)',
            textAlign: 'center',
            minWidth: '210px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
            {isUpcoming
              ? '⏳ Bắt đầu sau'
              : isRunning
              ? '🟢 Thời gian còn lại'
              : '🏁 Trạng thái kỳ thi'}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {isUpcoming
              ? formatCountdown(startMs - nowMs)
              : isRunning
              ? formatCountdown(endMs - nowMs)
              : 'Đã kết thúc'}
          </div>
        </div>
      </div>

      {/* Danh sách bài tập trong Contest */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '14px' }}>Danh sách Bài thi ({problems.length} bài)</h3>

        {problems.length === 0 ? (
          <p style={{ color: '#64748b' }}>Kỳ thi này chưa có bài tập nào.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 10px', width: '60px' }}>Bài</th>
                  <th style={{ padding: '12px 10px', width: '90px' }}>Trạng thái</th>
                  <th style={{ padding: '12px 10px' }}>Mã bài</th>
                  <th style={{ padding: '12px 10px' }}>Tên bài tập</th>
                  <th style={{ padding: '12px 10px' }}>Kiểu I/O</th>
                  <th style={{ padding: '12px 10px' }}>Chế độ chấm</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p, idx) => {
                  const isSolved = solvedSet.has(p.id);
                  const isSub = submittedSet.has(p.id);
                  const hideResultNow = Boolean(p.hide_grading && !isEnded && user?.role !== 'admin');

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold', fontSize: '15px' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>
                        {hideResultNow ? (
                          isSub ? (
                            <span style={{ color: '#2563eb' }}>📩 Đã nộp</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )
                        ) : isSolved ? (
                          <span style={{ color: '#16a34a' }}>✔ AC</span>
                        ) : isSub ? (
                          <span style={{ color: '#d97706' }}>● Đã thử</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {isLockedForUser ? (
                          <span style={{ color: '#64748b' }}>{p.id}</span>
                        ) : (
                          <Link href={`/problem/${p.id}`} style={{ textDecoration: 'none', color: '#2563eb' }}>
                            {p.id}
                          </Link>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                        {isLockedForUser ? (
                          <span style={{ color: '#64748b' }}>{p.title}</span>
                        ) : (
                          <Link href={`/problem/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {p.title}
                          </Link>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                        {p.io_mode === 'file' ? `${p.io_filename}.in / .out` : 'stdin / stdout'}
                      </td>
                      <td style={{ padding: '12px 10px', fontSize: '12px' }}>
                        {p.hide_grading ? '🔒 OI (Ẩn kết quả trong giờ)' : 'ICPC / Công khai'}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        {isLockedForUser ? (
                          <span
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#e2e8f0',
                              color: '#64748b',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 'bold',
                            }}
                          >
                            🔒 Chưa mở
                          </span>
                        ) : (
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
                            Mở đề bài →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
