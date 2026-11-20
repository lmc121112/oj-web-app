'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatGMT7, localGMT7ToISO, isoToLocalGMT7Input } from '../../lib/time';

export default function AdminDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'contests' | 'problems' | 'testcases'>('users');

  // --- DỮ LIỆU CHUNG ---
  const [usersList, setUsersList] = useState<any[]>([]);
  const [contestsList, setContestsList] = useState<any[]>([]);
  const [problemsList, setProblemsList] = useState<any[]>([]);

  // --- TAB 1: TÀI KHOẢN ---
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');

  // --- TAB 2: CONTEST ---
  const [cId, setCId] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [timeMode, setTimeMode] = useState<'end_datetime' | 'duration'>('end_datetime');
  const [cStartLocal, setCStartLocal] = useState('');
  const [cEndLocal, setCEndLocal] = useState('');
  const [cDurationMins, setCDurationMins] = useState<number>(120);
  const [cRestrict, setCRestrict] = useState<boolean>(false);
  const [cAllowedUsers, setCAllowedUsers] = useState<string[]>([]);

  // --- TAB 3: BÀI TẬP ---
  const [pId, setPId] = useState('');
  const [pTitle, setPTitle] = useState('');
  const [pStatement, setPStatement] = useState('');
  const [pTimeLimit, setPTimeLimit] = useState<number>(1000);
  const [pMemLimit, setPMemLimit] = useState<number>(256);
  const [pContestId, setPContestId] = useState<string>('');
  const [pHideTests, setPHideTests] = useState<boolean>(false);

  // --- TAB 4: TEST CASES ---
  const [selectedProbForTc, setSelectedProbForTc] = useState<string>('');
  const [tcList, setTcList] = useState<any[]>([]);
  const [editingTcId, setEditingTcId] = useState<number | null>(null);
  const [tcOrder, setTcOrder] = useState<number>(1);
  const [tcInput, setTcInput] = useState('');
  const [tcOutput, setTcOutput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('oj_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        if (parsed.role === 'admin') {
          loadAllAdminData();
        }
      } catch {}
    }
  }, []);

  const loadAllAdminData = async () => {
    const [uRes, cRes, pRes] = await Promise.all([
      supabase.from('users').select('*').order('id', { ascending: true }),
      supabase.from('contests').select('*').order('created_at', { ascending: false }),
      supabase.from('problems').select('*').order('created_at', { ascending: true }),
    ]);
    if (uRes.data) setUsersList(uRes.data);
    if (cRes.data) setContestsList(cRes.data);
    if (pRes.data) {
      setProblemsList(pRes.data);
      if (pRes.data.length > 0 && !selectedProbForTc) {
        const defaultProb = pRes.data[0].id;
        setSelectedProbForTc(defaultProb);
        loadTestCases(defaultProb);
      }
    }
  };

  const loadTestCases = async (probId: string) => {
    if (!probId) {
      setTcList([]);
      return;
    }
    const { data } = await supabase
      .from('test_cases')
      .select('*')
      .eq('problem_id', probId)
      .order('test_order', { ascending: true });
    if (data) {
      setTcList(data);
      setTcOrder(data.length + 1);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', color: '#dc2626', fontWeight: 'bold' }}>
        ⛔ Khu vực này chỉ dành cho Quản trị viên (Admin).
      </div>
    );
  }

  // ==================== HANDLERS TAB 1: TÀI KHOẢN ====================
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    const { error } = await supabase.from('users').insert({
      username: newUsername.trim(),
      password: newPassword.trim(),
      role: newRole,
    });
    if (error) alert('Lỗi tạo tài khoản: ' + error.message);
    else {
      setNewUsername('');
      setNewPassword('');
      loadAllAdminData();
    }
  };

  const handleAdminChangePass = async (targetUser: any) => {
    const np = prompt(`Nhập mật khẩu mới cho tài khoản "${targetUser.username}":`);
    if (!np || !np.trim()) return;
    const { error } = await supabase.from('users').update({ password: np.trim() }).eq('id', targetUser.id);
    if (error) alert('Lỗi đổi mật khẩu: ' + error.message);
    else {
      alert('Đã đổi mật khẩu thành công!');
      loadAllAdminData();
    }
  };

  const handleDeleteAccount = async (targetUser: any) => {
    if (targetUser.id === user.id) {
      alert('Không thể tự xóa tài khoản Admin đang đăng nhập!');
      return;
    }
    if (!confirm(`Xóa tài khoản "${targetUser.username}"?`)) return;
    await supabase.from('users').delete().eq('id', targetUser.id);
    loadAllAdminData();
  };

  // ==================== HANDLERS TAB 2: CONTEST ====================
  const toggleAllowedUser = (uname: string) => {
    setCAllowedUsers((prev) =>
      prev.includes(uname) ? prev.filter((u) => u !== uname) : [...prev, uname]
    );
  };

  const handleSaveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cId.trim() || !cTitle.trim() || !cStartLocal) {
      alert('Vui lòng nhập Mã contest, Tên contest và Thời gian bắt đầu (GMT+7).');
      return;
    }

    const startIso = localGMT7ToISO(cStartLocal);
    let endIso = '';

    if (timeMode === 'end_datetime') {
      if (!cEndLocal) {
        alert('Vui lòng chọn Thời gian kết thúc (GMT+7).');
        return;
      }
      endIso = localGMT7ToISO(cEndLocal);
    } else {
      const startMs = new Date(startIso).getTime();
      endIso = new Date(startMs + Number(cDurationMins) * 60000).toISOString();
    }

    const { error } = await supabase.from('contests').upsert({
      id: cId.trim(),
      title: cTitle.trim(),
      start_time: startIso,
      end_time: endIso,
      restrict_users: cRestrict,
      allowed_users: cRestrict ? cAllowedUsers : [],
    });

    if (error) alert('Lỗi lưu Contest: ' + error.message);
    else {
      alert('Đã lưu Contest thành công!');
      setCId('');
      setCTitle('');
      setCStartLocal('');
      setCEndLocal('');
      setCRestrict(false);
      setCAllowedUsers([]);
      loadAllAdminData();
    }
  };

  const handleEditContestFill = (c: any) => {
    setCId(c.id);
    setCTitle(c.title);
    setTimeMode('end_datetime');
    setCStartLocal(isoToLocalGMT7Input(c.start_time));
    setCEndLocal(isoToLocalGMT7Input(c.end_time));
    setCRestrict(c.restrict_users);
    setCAllowedUsers(c.allowed_users || []);
  };

  const handleDeleteContest = async (id: string) => {
    if (!confirm(`Xóa contest "${id}"?`)) return;
    await supabase.from('contests').delete().eq('id', id);
    loadAllAdminData();
  };

  // ==================== HANDLERS TAB 3: BÀI TẬP ====================
  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pId.trim() || !pTitle.trim()) return;

    const { error } = await supabase.from('problems').upsert({
      id: pId.trim(),
      title: pTitle.trim(),
      statement: pStatement,
      time_limit_ms: Number(pTimeLimit),
      memory_limit_mb: Number(pMemLimit),
      contest_id: pContestId ? pContestId : null,
      hide_tests: pHideTests,
    });

    if (error) alert('Lỗi lưu bài tập: ' + error.message);
    else {
      alert('Đã lưu bài tập!');
      setPId('');
      setPTitle('');
      setPStatement('');
      setPTimeLimit(1000);
      setPMemLimit(256);
      setPContestId('');
      setPHideTests(false);
      loadAllAdminData();
    }
  };

  const handleEditProblemFill = (p: any) => {
    setPId(p.id);
    setPTitle(p.title);
    setPStatement(p.statement || '');
    setPTimeLimit(p.time_limit_ms);
    setPMemLimit(p.memory_limit_mb);
    setPContestId(p.contest_id || '');
    setPHideTests(Boolean(p.hide_tests));
  };

  const handleDeleteProblem = async (id: string) => {
    if (!confirm(`Xóa bài "${id}" và toàn bộ test case của bài này?`)) return;
    await supabase.from('problems').delete().eq('id', id);
    loadAllAdminData();
  };

  // ==================== HANDLERS TAB 4: TEST CASES ====================
  const handlePrepareNewTc = () => {
    setEditingTcId(null);
    setTcOrder(tcList.length + 1);
    setTcInput('');
    setTcOutput('');
  };

  const handleEditTcFill = (tc: any) => {
    setEditingTcId(tc.id);
    setTcOrder(tc.test_order);
    setTcInput(tc.input_data);
    setTcOutput(tc.expected_output);
  };

  const handleSaveTestCase = async () => {
    if (!selectedProbForTc) {
      alert('Vui lòng chọn bài tập trước!');
      return;
    }

    if (editingTcId) {
      const { error } = await supabase
        .from('test_cases')
        .update({
          test_order: Number(tcOrder),
          input_data: tcInput,
          expected_output: tcOutput,
        })
        .eq('id', editingTcId);

      if (error) alert('Lỗi cập nhật test: ' + error.message);
      else {
        alert('Đã cập nhật test case!');
        handlePrepareNewTc();
        loadTestCases(selectedProbForTc);
      }
    } else {
      const { error } = await supabase.from('test_cases').insert({
        problem_id: selectedProbForTc,
        test_order: Number(tcOrder),
        input_data: tcInput,
        expected_output: tcOutput,
      });

      if (error) alert('Lỗi thêm test: ' + error.message);
      else {
        alert('Đã lưu test case mới!');
        handlePrepareNewTc();
        loadTestCases(selectedProbForTc);
      }
    }
  };

  const handleDeleteTestCase = async (tcId: number) => {
    if (!confirm('Xóa test case này?')) return;
    await supabase.from('test_cases').delete().eq('id', tcId);
    loadTestCases(selectedProbForTc);
  };

  // Upload nhiều file .inp/.in và .out/.ans ghép cặp tự động
  const handleUploadTestFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedProbForTc) return;

    const pairs: Record<string, { inp?: string; out?: string }> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dotIdx = file.name.lastIndexOf('.');
      const baseName = dotIdx !== -1 ? file.name.substring(0, dotIdx) : file.name;
      const ext = dotIdx !== -1 ? file.name.substring(dotIdx + 1).toLowerCase() : '';
      const text = await file.text();

      if (!pairs[baseName]) pairs[baseName] = {};
      if (ext === 'inp' || ext === 'in') pairs[baseName].inp = text;
      else if (ext === 'out' || ext === 'ans') pairs[baseName].out = text;
    }

    const sortedKeys = Object.keys(pairs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    let currentOrder = tcList.length + 1;
    const rowsToInsert: any[] = [];

    for (const key of sortedKeys) {
      if (pairs[key].inp !== undefined && pairs[key].out !== undefined) {
        rowsToInsert.push({
          problem_id: selectedProbForTc,
          test_order: currentOrder++,
          input_data: pairs[key].inp,
          expected_output: pairs[key].out,
        });
      }
    }

    if (rowsToInsert.length === 0) {
      alert('Không tìm thấy cặp file hợp lệ! Hãy chọn đồng thời các cặp file trùng tên có đuôi .inp (hoặc .in) và .out (hoặc .ans).');
    } else {
      const { error } = await supabase.from('test_cases').insert(rowsToInsert);
      if (error) alert('Lỗi upload test cases: ' + error.message);
      else {
        alert(`Đã upload thành công ${rowsToInsert.length} test cases!`);
        loadTestCases(selectedProbForTc);
      }
    }
    e.target.value = '';
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Bảng Quản Trị Hệ Thống (Admin)</h2>

      {/* Thanh chuyển Tab */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'users', label: '1. Tài khoản (User/Admin)' },
          { id: 'contests', label: '2. Contest & Phân quyền' },
          { id: 'problems', label: '3. Bài tập' },
          { id: 'testcases', label: '4. Quản lý Test cases' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer',
              backgroundColor: activeTab === tab.id ? '#0f172a' : '#e2e8f0',
              color: activeTab === tab.id ? '#fff' : '#0f172a',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================= TAB 1: QUẢN LÝ TÀI KHOẢN ================= */}
      {activeTab === 'users' && (
        <div>
          <form onSubmit={handleAddAccount} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
            <input
              type="text"
              placeholder="Tên đăng nhập..."
              required
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="text"
              placeholder="Mật khẩu..."
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="user">User (Thí sinh)</option>
              <option value="admin">Admin (Quản trị)</option>
            </select>
            <button type="submit" style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              + Thêm tài khoản
            </button>
          </form>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>ID</th>
                <th style={{ padding: '10px' }}>Username</th>
                <th style={{ padding: '10px' }}>Mật khẩu</th>
                <th style={{ padding: '10px' }}>Vai trò</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px' }}>{u.id}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{u.username}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>{u.password}</td>
                  <td style={{ padding: '10px' }}>{u.role}</td>
                  <td style={{ padding: '10px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleAdminChangePass(u)} style={{ backgroundColor: '#eab308', color: '#000', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      Đổi pass
                    </button>
                    <button onClick={() => handleDeleteAccount(u)} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      Xóa acc
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= TAB 2: QUẢN LÝ CONTEST ================= */}
      {activeTab === 'contests' && (
        <div>
          <form onSubmit={handleSaveContest} style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '8px', marginBottom: '24px', display: 'grid', gap: '12px' }}>
            <h4 style={{ margin: 0 }}>Tạo / Cập nhật Contest (Múi giờ GMT+7 Hà Nội)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
              <input
                type="text"
                placeholder="Mã contest (vd: round1)"
                required
                value={cId}
                onChange={(e) => setCId(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <input
                type="text"
                placeholder="Tên kỳ thi (vd: Kỳ thi thử HSG9)"
                required
                value={cTitle}
                onChange={(e) => setCTitle(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            {/* Yêu cầu 11: 2 cách đặt thời gian cho contest */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '14px' }}>
              <b>Cách đặt thời gian:</b>
              <label>
                <input
                  type="radio"
                  checked={timeMode === 'end_datetime'}
                  onChange={() => setTimeMode('end_datetime')}
                /> Cách 1: Ngày/giờ bắt đầu & kết thúc
              </label>
              <label>
                <input
                  type="radio"
                  checked={timeMode === 'duration'}
                  onChange={() => setTimeMode('duration')}
                /> Cách 2: Ngày/giờ bắt đầu & thời lượng làm bài (phút)
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Thời gian bắt đầu (GMT+7):</label>
                <input
                  type="datetime-local"
                  required
                  value={cStartLocal}
                  onChange={(e) => setCStartLocal(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {timeMode === 'end_datetime' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Thời gian kết thúc (GMT+7):</label>
                  <input
                    type="datetime-local"
                    required
                    value={cEndLocal}
                    onChange={(e) => setCEndLocal(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Thời lượng làm bài (phút):</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={cDurationMins}
                    onChange={(e) => setCDurationMins(Number(e.target.value))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}
            </div>

            {/* Giới hạn user tham gia contest */}
            <div>
              <label style={{ fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={cRestrict}
                  onChange={(e) => setCRestrict(e.target.checked)}
                /> Bật giới hạn thí sinh tham gia (Chỉ những user được chọn bên dưới mới vào được)
              </label>

              {cRestrict && (
                <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {usersList.filter((u) => u.role !== 'admin').map((u) => (
                    <label key={u.id} style={{ fontSize: '14px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={cAllowedUsers.includes(u.username)}
                        onChange={() => toggleAllowedUser(u.username)}
                      /> {u.username}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <button type="submit" style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Lưu Contest
              </button>
            </div>
          </form>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>Mã</th>
                <th style={{ padding: '10px' }}>Tên Contest</th>
                <th style={{ padding: '10px' }}>Bắt đầu (GMT+7)</th>
                <th style={{ padding: '10px' }}>Kết thúc (GMT+7)</th>
                <th style={{ padding: '10px' }}>Giới hạn User</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {contestsList.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{c.id}</td>
                  <td style={{ padding: '10px' }}>{c.title}</td>
                  <td style={{ padding: '10px' }}>{formatGMT7(c.start_time)}</td>
                  <td style={{ padding: '10px' }}>{formatGMT7(c.end_time)}</td>
                  <td style={{ padding: '10px' }}>
                    {c.restrict_users ? (c.allowed_users || []).join(', ') || 'Chưa chọn ai' : 'Mọi tài khoản'}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleEditContestFill(c)} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Sửa</button>
                    <button onClick={() => handleDeleteContest(c.id)} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= TAB 3: QUẢN LÝ BÀI TẬP ================= */}
      {activeTab === 'problems' && (
        <div>
          <form onSubmit={handleSaveProblem} style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '8px', marginBottom: '24px', display: 'grid', gap: '12px' }}>
            <h4 style={{ margin: 0 }}>Thêm / Cập nhật Bài tập</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
              <input
                type="text"
                placeholder="Mã bài (vd: sumarr)"
                required
                value={pId}
                onChange={(e) => setPId(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <input
                type="text"
                placeholder="Tên bài tập"
                required
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <textarea
              rows={5}
              placeholder="Nội dung đề bài..."
              value={pStatement}
              onChange={(e) => setPStatement(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Time Limit (ms):</label>
                <input
                  type="number"
                  value={pTimeLimit}
                  onChange={(e) => setPTimeLimit(Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Memory Limit (MB):</label>
                <input
                  type="number"
                  value={pMemLimit}
                  onChange={(e) => setPMemLimit(Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Thuộc Contest (để trống nếu là Luyện tập tự do):</label>
                <select
                  value={pContestId}
                  onChange={(e) => setPContestId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Luyện tập tự do --</option>
                  {contestsList.map((c) => (
                    <option key={c.id} value={c.id}>Contest: {c.title} ({c.id})</option>
                  ))}
                </select>
              </div>
            </div>

            <label style={{ fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pHideTests}
                onChange={(e) => setPHideTests(e.target.checked)}
              /> Bật nút Hide Test (Ẩn Input/Output chi tiết khi thí sinh bấm vào ô màu)
            </label>

            <div>
              <button type="submit" style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Lưu Bài tập
              </button>
            </div>
          </form>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>Mã bài</th>
                <th style={{ padding: '10px' }}>Tên bài</th>
                <th style={{ padding: '10px' }}>Phân loại</th>
                <th style={{ padding: '10px' }}>Hide Test</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {problemsList.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{p.id}</td>
                  <td style={{ padding: '10px' }}>{p.title}</td>
                  <td style={{ padding: '10px' }}>{p.contest_id ? `Contest: ${p.contest_id}` : 'Luyện tập tự do'}</td>
                  <td style={{ padding: '10px' }}>{p.hide_tests ? 'Đang ẩn' : 'Công khai'}</td>
                  <td style={{ padding: '10px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleEditProblemFill(p)} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Sửa</button>
                    <button onClick={() => handleDeleteProblem(p.id)} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= TAB 4: QUẢN LÝ TEST CASES (YÊU CẦU 9) ================= */}
      {activeTab === 'testcases' && (
        <div>
          {/* Menu thả xuống chọn bài cần quản lý testcase */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold' }}>Chọn bài tập cần quản lý Test case:</label>
            <select
              value={selectedProbForTc}
              onChange={(e) => {
                setSelectedProbForTc(e.target.value);
                setEditingTcId(null);
                loadTestCases(e.target.value);
              }}
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 'bold' }}
            >
              {problemsList.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.id}] {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Bảng chỉnh sửa test (chỗ nhập liệu) với 2 nút ở trên và 1 nút ở dưới */}
          <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
            {/* Ở trên bảng chỉnh sửa test: 2 nút Thêm testcase & Upload testcase */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handlePrepareNewTc}
                style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                + Thêm testcase
              </button>

              <label
                style={{
                  backgroundColor: '#7c3aed',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                📤 Upload testcase (.inp/.in & .out/.ans)
                <input
                  type="file"
                  multiple
                  accept=".inp,.in,.out,.ans,.txt"
                  onChange={handleUploadTestFiles}
                  style={{ display: 'none' }}
                />
              </label>

              <span style={{ fontSize: '13px', color: '#475569' }}>
                {editingTcId ? `Đang sửa Test ID #${editingTcId}` : 'Chế độ: Nhập Testcase mới'}
              </span>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', marginRight: '8px' }}>Thứ tự Test #:</label>
              <input
                type="number"
                min={1}
                value={tcOrder}
                onChange={(e) => setTcOrder(Number(e.target.value))}
                style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Input dữ liệu vào:</label>
                <textarea
                  rows={5}
                  value={tcInput}
                  onChange={(e) => setTcInput(e.target.value)}
                  placeholder="Nhập dữ liệu Input..."
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Expected Output (Đáp án chuẩn):</label>
                <textarea
                  rows={5}
                  value={tcOutput}
                  onChange={(e) => setTcOutput(e.target.value)}
                  placeholder="Nhập dữ liệu Output chuẩn..."
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            {/* Ở dưới bảng chỉnh sửa test: nút Lưu testcase */}
            <button
              type="button"
              onClick={handleSaveTestCase}
              style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Lưu testcase
            </button>
          </div>

          {/* Bảng danh sách test case của bài đang chọn */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>Test #</th>
                <th style={{ padding: '10px' }}>Input (Xem trước)</th>
                <th style={{ padding: '10px' }}>Output chuẩn (Xem trước)</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {tcList.map((tc) => (
                <tr key={tc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>Test #{tc.test_order}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tc.input_data}
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tc.expected_output}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleEditTcFill(tc)}
                      style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteTestCase(tc.id)}
                      style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
