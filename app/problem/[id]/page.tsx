'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase';

// Tải Ace Editor ở phía Client để tránh lỗi SSR trên Next.js
const AceEditor = dynamic(
  async () => {
    const ace = await import('react-ace');
    await import('ace-builds/src-noconflict/mode-c_cpp');
    await import('ace-builds/src-noconflict/mode-python');
    await import('ace-builds/src-noconflict/mode-java');
    await import('ace-builds/src-noconflict/mode-csharp');
    await import('ace-builds/src-noconflict/mode-rust');
    await import('ace-builds/src-noconflict/theme-monokai');
    await import('ace-builds/src-noconflict/ext-language_tools');
    return ace;
  },
  { ssr: false }
);

const ACE_MODES: Record<string, string> = {
  cpp20: 'c_cpp',
  python: 'python',
  java: 'java',
  csharp: 'csharp',
  rust: 'rust',
};

export default function ProblemWorkspacePage() {
  const { id } = useParams();
  const router = useRouter();
  const [problem, setProblem] = useState<any>(null);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState('cpp20');
  const [sourceCode, setSourceCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accessDeniedMsg, setAccessDeniedMsg] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let currentUser: any = null;
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        setUser(currentUser);
      } catch {}
    }

    const init = async () => {
      // 1. Tải template code của Admin
      const { data: settingData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'code_templates')
        .single();

      const loadedTemplates = settingData?.value || {};
      setTemplates(loadedTemplates);
      setSourceCode(loadedTemplates['cpp20'] || '');

      // 2. Tải thông tin bài tập
      const { data: prob } = await supabase
        .from('problems')
        .select('*')
        .eq('id', id)
        .single();

      if (!prob) {
        setAccessDeniedMsg('Không tìm thấy bài tập này.');
        return;
      }

      // Kiểm tra quyền truy cập (Yêu cầu 5, 6)
      if (!prob.contest_id) {
        if (!currentUser && prob.id !== 'aplusb') {
          setAccessDeniedMsg('Bạn cần đăng nhập để truy cập bài tập này.');
          return;
        }
      } else {
        const { data: contest } = await supabase
          .from('contests')
          .select('*')
          .eq('id', prob.contest_id)
          .single();

        if (contest && currentUser?.role !== 'admin') {
          if (!currentUser) {
            setAccessDeniedMsg('Bạn không có quyền truy cập contest này.');
            return;
          }
          if (contest.restrict_users && !contest.allowed_users.includes(currentUser.username)) {
            setAccessDeniedMsg('Bạn không có quyền truy cập contest này.');
            return;
          }
          const now = Date.now();
          if (now < new Date(contest.start_time).getTime()) {
            setAccessDeniedMsg('Bài thi chưa mở.');
            return;
          }
          if (now > new Date(contest.end_time).getTime()) {
            setAccessDeniedMsg('Bài thi đã hết hạn.');
            return;
          }
        }
      }

      setProblem(prob);
    };

    init();
  }, [id]);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    setSourceCode(templates[newLang] || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceCode.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from('submissions').insert({
      problem_id: id,
      username: user ? user.username : 'guest',
      language,
      source_code: sourceCode,
    });

    if (!error) {
      router.push('/submissions');
    } else {
      alert('Lỗi nộp bài: ' + error.message);
      setSubmitting(false);
    }
  };

  if (accessDeniedMsg) {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', color: '#dc2626', fontWeight: 'bold' }}>
        ⛔ {accessDeniedMsg}
      </div>
    );
  }

  if (!problem) return <p>Đang tải không gian làm bài...</p>;

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Khung Mã bài & Đề bài (Yêu cầu 7) */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>
            <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>[{problem.id}]</span> {problem.title}
          </h2>
          <span style={{ fontSize: '14px', color: '#64748b' }}>
            Giới hạn: <b>{problem.time_limit_ms} ms</b> | <b>{problem.memory_limit_mb} MB</b>
          </span>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.65', fontSize: '15px' }}>{problem.statement}</div>
      </div>

      {/* Khung soạn thảo Ace Editor & Nút Nộp Bài (Yêu cầu 7, 8) */}
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold' }}>Trình soạn thảo mã nguồn (Ace Editor):</label>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 'bold' }}
          >
            <option value="cpp20">C++20 (GCC 13)</option>
            <option value="python">Python 3</option>
            <option value="java">Java (class Main)</option>
            <option value="csharp">C# (.NET 8)</option>
            <option value="rust">Rust</option>
          </select>
        </div>

        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
          <AceEditor
            mode={ACE_MODES[language] || 'c_cpp'}
            theme="monokai"
            name="oj-ace-editor"
            value={sourceCode}
            onChange={(val) => setSourceCode(val)}
            fontSize={15}
            width="100%"
            height="420px"
            showPrintMargin={false}
            setOptions={{
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              showLineNumbers: true,
              tabSize: 4,
            }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: '16px',
            padding: '10px 28px',
            backgroundColor: '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '15px',
          }}
        >
          {submitting ? 'Đang gửi bài...' : 'Nộp Bài'}
        </button>
      </form>
    </div>
  );
}
