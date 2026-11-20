'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';

const AceEditor = dynamic(
  async () => {
    const ace = await import('react-ace');
    await import('ace-builds/src-noconflict/mode-c_cpp');
    await import('ace-builds/src-noconflict/mode-python');
    await import('ace-builds/src-noconflict/mode-java');
    await import('ace-builds/src-noconflict/mode-csharp');
    await import('ace-builds/src-noconflict/mode-rust');
    await import('ace-builds/src-noconflict/theme-monokai');
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

export default function AccountManagementPage() {
  const [user, setUser] = useState<any>(null);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');

  // State cho Template code (chỉ Admin)
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [selectedLang, setSelectedLang] = useState('cpp20');
  const [tplMsg, setTplMsg] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setUser(parsed);

      if (parsed.role === 'admin') {
        supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'code_templates')
          .single()
          .then(({ data }) => {
            if (data?.value) setTemplates(data.value);
          });
      }
    } catch {}
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg('');
    if (!user) return;

    const { data: checkUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .eq('password', oldPass.trim())
      .single();

    if (!checkUser) {
      setPassMsg('❌ Mật khẩu hiện tại không chính xác!');
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ password: newPass.trim() })
      .eq('id', user.id);

    if (error) {
      setPassMsg('❌ Lỗi cập nhật: ' + error.message);
    } else {
      setPassMsg('✅ Đổi mật khẩu thành công!');
      setOldPass('');
      setNewPass('');
    }
  };

  const handleSaveTemplate = async () => {
    setTplMsg('');
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'code_templates', value: templates });

    if (error) {
      setTplMsg('❌ Lỗi lưu template: ' + error.message);
    } else {
      setTplMsg(`✅ Đã lưu template mặc định cho ngôn ngữ ${selectedLang.toUpperCase()}!`);
    }
  };

  if (!user) {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
        Vui lòng đăng nhập để quản lý tài khoản.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Mục đổi mật khẩu (cho tất cả User & Admin) */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0 }}>Quản lý tài khoản: {user.username}</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Vai trò: <b>{user.role === 'admin' ? 'Quản trị viên (Admin)' : 'Thí sinh (User)'}</b>
        </p>

        <form onSubmit={handleChangePassword} style={{ maxWidth: '400px', marginTop: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Đổi mật khẩu cá nhân</h4>
          {passMsg && <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{passMsg}</p>}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Mật khẩu hiện tại</label>
            <input
              type="password"
              required
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Mật khẩu mới</label>
            <input
              type="password"
              required
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>
          <button
            type="submit"
            style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Cập nhật mật khẩu
          </button>
        </form>
      </div>

      {/* Mục thay thế Template code mặc định cho từng ngôn ngữ (Chỉ Admin) */}
      {user.role === 'admin' && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0 }}>Cấu hình Template code mặc định (Chỉ Admin)</h3>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Đoạn mã nguồn mẫu sẽ tự động hiển thị trong Ace Editor khi thí sinh chọn ngôn ngữ tương ứng.
          </p>

          <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label><b>Chọn ngôn ngữ:</b></label>
            <select
              value={selectedLang}
              onChange={(e) => {
                setSelectedLang(e.target.value);
                setTplMsg('');
              }}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
            >
              <option value="cpp20">C++20</option>
              <option value="python">Python 3</option>
              <option value="java">Java</option>
              <option value="csharp">C#</option>
              <option value="rust">Rust</option>
            </select>
          </div>

          <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
            <AceEditor
              mode={ACE_MODES[selectedLang] || 'c_cpp'}
              theme="monokai"
              name="admin-template-editor"
              value={templates[selectedLang] || ''}
              onChange={(val) => setTemplates({ ...templates, [selectedLang]: val })}
              fontSize={14}
              width="100%"
              height="280px"
              showPrintMargin={false}
            />
          </div>

          <button
            type="button"
            onClick={handleSaveTemplate}
            style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Lưu Template
          </button>
          {tplMsg && <span style={{ marginLeft: '14px', fontWeight: 'bold', fontSize: '14px' }}>{tplMsg}</span>}
        </div>
      )}
    </div>
  );
}
