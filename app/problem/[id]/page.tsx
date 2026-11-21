'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase';

// Nạp AceEditor phía client để tránh lỗi SSR
const AceEditor = dynamic(
  async () => {
    const ace = await import('react-ace');
    await import('ace-builds/src-noconflict/mode-c_cpp');
    await import('ace-builds/src-noconflict/mode-python');
    await import('ace-builds/src-noconflict/mode-java');
    await import('ace-builds/src-noconflict/mode-csharp');
    await import('ace-builds/src-noconflict/mode-rust');
    await import('ace-builds/src-noconflict/mode-pascal');
    await import('ace-builds/src-noconflict/theme-github');
    await import('ace-builds/src-noconflict/ext-language_tools');
    return ace.default;
  },
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: '24px', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'monospace' }}>
        Đang khởi tạo trình soạn thảo Ace Editor...
      </div>
    ),
  }
);

function getAceMode(lang: string): string {
  const l = (lang || '').toLowerCase();
  if (l.includes('cpp') || l === 'c') return 'c_cpp';
  if (l.includes('py')) return 'python';
  if (l.includes('java')) return 'java';
  if (l.includes('cs') || l.includes('sharp')) return 'csharp';
  if (l.includes('rust')) return 'rust';
  if (l.includes('pas')) return 'pascal';
  return 'c_cpp';
}

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

export default function ProblemDetailPage() {
  const params = useParams();
  const problemId = decodeURIComponent(String(params?.id || ''));

  const [user, setUser] = useState<any>(null);
  const [problem, setProblem] = useState<any>(null);
  const [contest, setContest] = useState<any>(null);
  const [contestProblems, setContestProblems] = useState<any[]>([]);
  const [sampleTest, setSampleTest] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  const [language, setLanguage] = useState('cpp20');
  const [sourceCode, setSourceCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [latestSub, setLatestSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }

    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadProblemData = async () => {
      if (!problemId) return;
      setLoading(true);
      setLatestSub(null);

      const [pRes, tplRes] = await Promise.all([
        supabase.from('problems').select('*').eq('id', problemId).single(),
        supabase.from('language_templates').select('*').order('id', { ascending: true }),
      ]);

      const prob = pRes.data;
      setProblem(prob);

      if (tplRes.data && tplRes.data.length > 0) {
        setTemplates(tplRes.data);
        const defaultTpl =
          tplRes.data.find((t: any) => t.language === 'cpp20' || t.language === 'cpp') ||
          tplRes.data[0];
        setLanguage(defaultTpl.language);
        setSourceCode(defaultTpl.template_code || '');
      } else {
        setSourceCode(
          `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(nullptr);\n    \n    return 0;\n}\n`
        );
      }

      if (prob) {
        if (!prob.hide_tests) {
          const { data: tcs } = await supabase
            .from('test_cases')
            .select('input_data, expected_output')
            .eq('problem_id', prob.id)
            .order('test_order', { ascending: true })
            .limit(1);
          if (tcs && tcs.length > 0) setSampleTest(tcs[0]);
          else setSampleTest(null);
        } else {
          setSampleTest(null);
        }

        if (prob.contest_id) {
          const [cRes, cpRes] = await Promise.all([
            supabase.from('contests').select('*').eq('id', prob.contest_id).single(),
            supabase
              .from('problems')
              .select('id, title, problem_order')
              .eq('contest_id', prob.contest_id)
              .order('problem_order', { ascending: true })
              .order('created_at', { ascending: true }),
          ]);
          if (cRes.data) setContest(cRes.data);
          if (cpRes.data) setContestProblems(cpRes.data);
        } else {
          setContest(null);
          setContestProblems([]);
        }
      }

      setLoading(false);
    };

    loadProblemData();
  }, [problemId]);

  // Theo dõi trạng thái chấm real-time từ judge.cpp
  useEffect(() => {
    if (!latestSub?.id) return;
    if (latestSub.status === 'Finished') return;

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', latestSub.id)
        .single();
      if (data) {
        setLatestSub(data);
        if (data.status === 'Finished') {
          clearInterval(poll);
        }
      }
    }, 1000);

    return () => clearInterval(poll);
  }, [latestSub?.id, latestSub?.status]);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const found = templates.find((t: any) => t.language === newLang);
    if (found) {
      setSourceCode(found.template_code || '');
    }
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem || !sourceCode.trim()) return;

    if (problem.contest_id && !user) {
      alert('Bạn cần đăng nhập để nộp bài trong Contest!');
      window.dispatchEvent(new Event('open-login-modal'));
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        problem_id: problem.id,
        username: user ? user.username : 'guest',
        language,
        source_code: sourceCode,
        status: 'Pending',
      })
      .select('*')
      .single();

    setSubmitting(false);

    if (error) {
      alert('Lỗi gửi bài nộp: ' + error.message);
    } else if (data) {
      setLatestSub(data);
    }
  };

  if (loading) {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
        Đang tải đề bài...
      </div>
    );
  }

  if (!problem) {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', color: '#dc2626' }}>
        ❌ Không tìm thấy bài tập có mã <code>{problemId}</code>.
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const contestStartMs = contest ? new Date(contest.start_time).getTime() : 0;
  const contestEndMs = contest ? new Date(contest.end_time).getTime() : 0;
  const isContestUpcoming = Boolean(contest && nowMs < contestStartMs);
  const isContestRunning = Boolean(contest && nowMs >= contestStartMs && nowMs <= contestEndMs);
  const isContestEnded = Boolean(contest && nowMs > contestEndMs);

  if (problem.contest_id && !user) {
    return (
      <div style={{ background: '#fff', padding: '40px 24px', borderRadius: '10px', textAlign: 'center', maxWidth: '540px', margin: '40px auto' }}>
        <h2 style={{ color: '#dc2626', marginTop: 0 }}>Bạn cần đăng nhập để tham gia contest</h2>
        <p style={{ fontSize: '14px', color: '#64748b' }}>
          Bài tập <b>{problem.title}</b> thuộc kỳ thi <code>{problem.contest_id}</code>.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('open-login-modal'))}
          style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  if (
    contest &&
    !isAdmin &&
    contest.restrict_users &&
    !(contest.allowed_users || []).includes(user?.username)
  ) {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', color: '#dc2626', fontWeight: 'bold' }}>
        ⛔ Bạn không nằm trong danh sách thí sinh được phép truy cập kỳ thi này.
      </div>
    );
  }

  if (isContestUpcoming && !isAdmin) {
    return (
      <div style={{ background: '#fff', padding: '32px', borderRadius: '8px', textAlign: 'center' }}>
        <h3 style={{ color: '#d97706', marginTop: 0 }}>⏳ Kỳ thi chưa bắt đầu</h3>
        <p>Đề bài sẽ tự động mở sau: <b>{formatCountdown(contestStartMs - nowMs)}</b></p>
        <Link href={`/contests/${contest.id}`} style={{ color: '#2563eb', fontWeight: 'bold' }}>
          ← Quay về phòng chờ Contest
        </Link>
      </div>
    );
  }

  const shouldHideGrading = Boolean(
    problem.contest_id && problem.hide_grading && !isContestEnded && !isAdmin
  );

  const ioText =
    problem.io_mode === 'file'
      ? `File: ${problem.io_filename}.in / ${problem.io_filename}.out`
      : 'stdin / stdout';

  const testResults: any[] = Array.isArray(latestSub?.test_results) ? latestSub.test_results : [];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: contest ? 'minmax(0, 1fr) 250px' : 'minmax(0, 1fr)',
        gap: '20px',
        alignItems: 'start',
      }}
    >
      {/* CỘT CHÍNH: ĐỀ BÀI & ACE EDITOR */}
      <div style={{ display: 'grid', gap: '20px' }}>
        {/* Khung Đề bài */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0 }}>
                {problem.title}{' '}
                <span style={{ fontSize: '14px', fontFamily: 'monospace', color: '#64748b' }}>
                  [{problem.id}]
                </span>
              </h2>
              <Link
                href="/submissions"
                style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: 'bold' }}
              >
                📜 Lịch sử nộp bài →
              </Link>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px', fontSize: '13px', color: '#475569' }}>
              <span>⏱ Thời gian: <b>{problem.time_limit_ms} ms</b></span>
              <span>💾 Bộ nhớ: <b>{problem.memory_limit_mb} MB</b></span>
              <span>⌨️ Input/Output: <code style={{ fontWeight: 'bold' }}>{ioText}</code></span>
              {problem.contest_id && (
                <span>
                  🏆 Contest: <b>{problem.contest_id}</b>
                  {problem.hide_grading ? ' (Chế độ OI: Ẩn kết quả trong giờ)' : ''}
                </span>
              )}
            </div>

            {problem.io_mode === 'file' && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  fontSize: '13px',
                }}
              >
                📌 <b>Lưu ý đọc/ghi tệp:</b> Chương trình của bạn cần đọc dữ liệu từ tệp{' '}
                <code>{problem.io_filename}.in</code> và ghi kết quả ra tệp{' '}
                <code>{problem.io_filename}.out</code>.
              </div>
            )}
          </div>

          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: '15px' }}>
            {problem.statement || 'Chưa có nội dung mô tả chi tiết cho bài tập này.'}
          </div>

          {sampleTest && (
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Ví dụ mẫu</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#64748b
