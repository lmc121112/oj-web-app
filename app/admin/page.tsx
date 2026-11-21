'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatGMT7, localGMT7ToISO, isoToLocalGMT7Input } from '../../lib/time';

// Danh sách tên file dành riêng cho hệ thống chấm (tránh xung đột khi chạy File I/O)
const RESERVED_IO_NAMES = new Set([
  'input',
  'output',
  'stdin',
  'stdout',
  'stderr',
  'main',
  'solution',
  'code',
  'prog',
  'a',
  'box',
  'meta',
  'result',
  'verdict',
  'compile',
]);

export default function AdminDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'contests' | 'problems' | 'danger'>('users');

  // --- DỮ LIỆU CHUNG ---
  const [usersList, setUsersList] = useState<any[]>([]);
  const [contestsList, setContestsList] = useState<any[]>([]);
  const [problemsList, setProblemsList] = useState<any[]>([]);

  // --- TAB 1: TÀI KHOẢN ---
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');

  // --- TAB 2: CONTEST (4 CHẾ ĐỘ ĐẶT GIỜ) ---
  const [cId, setCId] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [timeMode, setTimeMode] = useState<
    'start_end' | 'start_duration' | 'now_end' | 'now_duration'
  >('start_end');
  const [cStartLocal, setCStartLocal] = useState('');
  const [cEndLocal, setCEndLocal] = useState('');
  const [cDurationMins, setCDurationMins] = useState<number>(120);
  const [cRestrict, setCRestrict] = useState<boolean>(false);
  const [cAllowedUsers, setCAllowedUsers] = useState<string[]>([]);

  // --- TAB 3: BÀI TẬP & TEST CASES (GỘP CHUNG) ---
  const [pId, setPId] = useState('');
  const [pTitle, setPTitle] = useState('');
  const [pStatement, setPStatement] = useState('');
  const [pTimeLimit, setPTimeLimit] = useState<number>(1000);
  const [pMemLimit, setPMemLimit] = useState<number>(256);
  const [pContestId, setPContestId] = useState<string>('');
  const [pOrder, setPOrder] = useState<number>(1);
  const [pIoMode, setPIoMode] = useState<'stdio' | 'file'>('stdio');
  const [pIoFilename, setPIoFilename] = useState<string>('');
  const [pHideTests, setPHideTests] = useState<boolean>(false);
  const [pHideGrading, setPHideGrading] = useState<boolean>(false);

  // Modal nhân bản bài Luyện tập tự do vào Contest
  const [cloneSourceProb, setCloneSourceProb] = useState<any>(null);
  const [cloneTargetContestId, setCloneTargetContestId] = useState<string>('');
  const [cloneNewProbId, setCloneNewProbId] = useState<string>('');
  const [cloneOrder, setCloneOrder] = useState<number>(1);
  const [cloneHideTests, setCloneHideTests] = useState<boolean>(false);
  const [cloneHideGrading, setCloneHideGrading] = useState<boolean>(true);
  const [isCloningToContest, setIsCloningToContest] = useState<boolean>(false);

  // Quản lý Test cases gắn liền với bài đang chọn
  const [selectedProbForTc, setSelectedProbForTc] = useState<string>('');
  const [tcList, setTcList] = useState<any[]>([]);
  const [editingTcId, setEditingTcId] = useState<number | null>(null);
  const [tcOrder, setTcOrder] = useState<number>(1);
  const [tcInput, setTcInput] = useState('');
  const [tcOutput, setTcOutput] = useState('');

  // --- TAB 4: DANGER ZONE ---
  const [isResettingOj, setIsResettingOj] = useState(false);

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
      supabase
        .from('problems')
        .select('*')
        .order('problem_order', { ascending: true })
        .order('created_at', { ascending: true }),
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

  // ==================== HANDLERS TAB 2: CONTEST (4 CHẾ ĐỘ GIỜ) ====================
  const toggleAllowedUser = (uname: string) => {
    setCAllowedUsers((prev) =>
      prev.includes(uname) ? prev.filter((u) => u !== uname) : [...prev, uname]
    );
  };

  const handleSaveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cId.trim() || !cTitle.trim()) {
      alert('Vui lòng nhập Mã contest và Tên contest.');
      return;
    }

    let startIso = '';
    let endIso = '';

    if (timeMode === 'start_end') {
      if (!cStartLocal || !cEndLocal) {
        alert('Vui lòng chọn đầy đủ Thời gian bắt đầu và Thời gian kết thúc (GMT+7).');
        return;
      }
      startIso = localGMT7ToISO(cStartLocal);
      endIso = localGMT7ToISO(cEndLocal);
    } else if (timeMode === 'start_duration') {
      if (!cStartLocal || Number(cDurationMins) <= 0) {
        alert('Vui lòng chọn Thời gian bắt đầu và Thời lượng làm bài hợp lệ.');
        return;
      }
      startIso = localGMT7ToISO(cStartLocal);
      endIso = new Date(new Date(startIso).getTime() + Number(cDurationMins) * 60000).toISOString();
    } else if (timeMode === 'now_end') {
      if (!cEndLocal) {
        alert('Vui lòng chọn Thời gian kết thúc (GMT+7).');
        return;
      }
      startIso = new Date().toISOString();
      endIso = localGMT7ToISO(cEndLocal);
    } else if (timeMode === 'now_duration') {
      if (Number(cDurationMins) <= 0) {
        alert('Vui lòng nhập Thời lượng làm bài lớn hơn 0 phút.');
        return;
      }
      const now = new Date();
      startIso = now.toISOString();
      endIso = new Date(now.getTime() + Number(cDurationMins) * 60000).toISOString();
    }

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      alert('Thời gian kết thúc phải nằm sau Thời gian bắt đầu!');
      return;
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
      setCDurationMins(120);
      setCRestrict(false);
      setCAllowedUsers([]);
      loadAllAdminData();
    }
  };

  const handleEditContestFill = (c: any) => {
    setCId(c.id);
    setCTitle(c.title);
    setTimeMode('start_end');
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

  // ==================== HANDLERS TAB 3: BÀI TẬP & TEST CASES ====================
  const resetProblemForm = () => {
    setPId('');
    setPTitle('');
    setPStatement('');
    setPTimeLimit(1000);
    setPMemLimit(256);
    setPContestId('');
    setPOrder(problemsList.length + 1);
    setPIoMode('stdio');
    setPIoFilename('');
    setPHideTests(false);
    setPHideGrading(false);
  };

  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = pId.trim();
    if (!cleanId || !pTitle.trim()) return;

    // Kiểm tra và chống xung đột File I/O (.in / .out)
    let cleanIoFilename = '';
    if (pIoMode === 'file') {
      // Loại bỏ đuôi .in/.inp/.out/.ans nếu admin lỡ nhập kèm, chỉ giữ tên gốc
      cleanIoFilename = pIoFilename
        .trim()
        .replace(/\.(in|inp|out|ans|txt)$/i, '');

      if (!cleanIoFilename) {
        alert('Vui lòng nhập Tên file Input/Output (ví dụ: CHINHPHUONG) khi chọn chế độ File (.in / .out)!');
        return;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(cleanIoFilename)) {
        alert('Tên file chỉ được chứa chữ cái không dấu, chữ số, dấu gạch dưới (_) hoặc gạch ngang (-)!');
        return;
      }

      if (RESERVED_IO_NAMES.has(cleanIoFilename.toLowerCase())) {
        alert(
          `Xung đột hệ thống: Tên file "${cleanIoFilename}" trùng với tệp nội bộ của trình chấm (input, output, main, box...). Vui lòng đặt tên khác (ví dụ: ${cleanId.toUpperCase()})!`
        );
        return;
      }

      // Chống trùng tên file giữa 2 bài trong cùng 1 contest
      if (pContestId) {
        const conflictProb = problemsList.find(
          (item) =>
            item.id !== cleanId &&
            item.contest_id === pContestId &&
            item.io_mode === 'file' &&
            (item.io_filename || '').toLowerCase() === cleanIoFilename.toLowerCase()
        );
        if (conflictProb) {
          alert(
            `Xung đột file trong Contest: Bài [${conflictProb.id}] "${conflictProb.title}" đang sử dụng tên file "${cleanIoFilename}.in / ${cleanIoFilename}.out". Vui lòng chọn tên file khác!`
          );
          return;
        }
      }
    }

    const { error } = await supabase.from('problems').upsert({
      id: cleanId,
      title: pTitle.trim(),
      statement: pStatement,
      time_limit_ms: Number(pTimeLimit),
      memory_limit_mb: Number(pMemLimit),
      contest_id: pContestId ? pContestId : null,
      problem_order: Number(pOrder) || 1,
      io_mode: pIoMode,
      io_filename: pIoMode === 'file' ? cleanIoFilename : '',
      hide_tests: pHideTests,
      hide_grading: pContestId ? pHideGrading : false, // Chỉ áp dụng khi bài thuộc contest
    });

    if (error) {
      alert('Lỗi lưu bài tập: ' + error.message);
    } else {
      alert(`Đã lưu bài tập [${cleanId}]! Bạn có thể quản lý Test cases cho bài này ngay bên dưới.`);
      setSelectedProbForTc(cleanId);
      setEditingTcId(null);
      await loadAllAdminData();
      await loadTestCases(cleanId);
    }
  };

  const handleEditProblemFill = (p: any) => {
    setPId(p.id);
    setPTitle(p.title);
    setPStatement(p.statement || '');
    setPTimeLimit(p.time_limit_ms);
    setPMemLimit(p.memory_limit_mb);
    setPContestId(p.contest_id || '');
    setPOrder(p.problem_order || 1);
    setPIoMode(p.io_mode === 'file' ? 'file' : 'stdio');
    setPIoFilename(p.io_filename || '');
    setPHideTests(Boolean(p.hide_tests));
    setPHideGrading(Boolean(p.contest_id && p.hide_grading));

    // Đồng bộ luôn sang khung quản lý Test cases ngay bên dưới
    setSelectedProbForTc(p.id);
    setEditingTcId(null);
    loadTestCases(p.id);
  };

  const handleDeleteProblem = async (id: string) => {
    if (!confirm(`Xóa bài "${id}" và toàn bộ test case của bài này?`)) return;
    await supabase.from('problems').delete().eq('id', id);
    if (selectedProbForTc === id) {
      setSelectedProbForTc('');
      setTcList([]);
    }
    loadAllAdminData();
  };

  // --- MỞ MODAL & NHÂN BẢN BÀI LUYỆN TẬP TỰ DO VÀO CONTEST ---
  const handleOpenCloneModal = (sourceProb: any) => {
    if (contestsList.length === 0) {
      alert('Chưa có Contest nào trong hệ thống! Vui lòng tạo Contest ở Tab 2 trước.');
      return;
    }
    const defaultContest = contestsList[0].id;
    const countInContest = problemsList.filter((item) => item.contest_id === defaultContest).length;

    setCloneSourceProb(sourceProb);
    setCloneTargetContestId(defaultContest);
    setCloneNewProbId(`${defaultContest}_${sourceProb.id}`);
    setCloneOrder(countInContest + 1);
    setCloneHideTests(Boolean(sourceProb.hide_tests));
    setCloneHideGrading(true);
  };

  const handleCloneTargetContestChange = (newContestId: string) => {
    setCloneTargetContestId(newContestId);
    if (cloneSourceProb) {
      const countInContest = problemsList.filter((item) => item.contest_id === newContestId).length;
      setCloneNewProbId(`${newContestId}_${cloneSourceProb.id}`);
      setCloneOrder(countInContest + 1);
    }
  };

  const handleConfirmCloneToContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSourceProb || !cloneTargetContestId) return;

    const targetId = cloneNewProbId.trim();
    if (!targetId) {
      alert('Vui lòng nhập Mã bài trong Contest!');
      return;
    }

    if (problemsList.some((item) => item.id === targetId)) {
      alert(`Mã bài "${targetId}" đã tồn tại! Vui lòng nhập một mã bài khác cho Contest.`);
      return;
    }

    // Chống trùng tên file .in/.out giữa 2 bài trong cùng 1 contest nếu bài nguồn dùng File I/O
    if (cloneSourceProb.io_mode === 'file' && cloneSourceProb.io_filename) {
      const conflictProb = problemsList.find(
        (item) =>
          item.contest_id === cloneTargetContestId &&
          item.io_mode === 'file' &&
          (item.io_filename || '').toLowerCase() === cloneSourceProb.io_filename.toLowerCase()
      );
      if (conflictProb) {
        alert(
          `Xung đột file trong Contest: Bài [${conflictProb.id}] "${conflictProb.title}" đang dùng tệp "${cloneSourceProb.io_filename}.in / .out". Vui lòng đổi tên file ở một trong hai bài trước khi nhân bản!`
        );
        return;
      }
    }

    setIsCloningToContest(true);

    // 1. Tạo bản sao bài tập gắn vào Contest đích (giữ nguyên tên, đề, giới hạn, kiểu I/O)
    const { error: insertProbError } = await supabase.from('problems').insert({
      id: targetId,
      title: cloneSourceProb.title,
      statement: cloneSourceProb.statement || '',
      time_limit_ms: cloneSourceProb.time_limit_ms,
      memory_limit_mb: cloneSourceProb.memory_limit_mb,
      contest_id: cloneTargetContestId,
      problem_order: Number(cloneOrder) || 1,
      io_mode: cloneSourceProb.io_mode || 'stdio',
      io_filename: cloneSourceProb.io_mode === 'file' ? cloneSourceProb.io_filename : '',
      hide_tests: cloneHideTests,
      hide_grading: cloneHideGrading,
    });

    if (insertProbError) {
      setIsCloningToContest(false);
      alert('Lỗi nhân bản đề bài vào Contest: ' + insertProbError.message);
      return;
    }

    // 2. Lấy toàn bộ Test cases của bài Luyện tập tự do gốc và nhân bản sang bài mới
    const { data: sourceTcs, error: fetchTcError } = await supabase
      .from('test_cases')
      .select('test_order, input_data, expected_output')
      .eq('problem_id', cloneSourceProb.id)
      .order('test_order', { ascending: true });

    let copiedCount = 0;
    if (!fetchTcError && sourceTcs && sourceTcs.length > 0) {
      const clonedTcRows = sourceTcs.map((tc) => ({
        problem_id: targetId,
        test_order: tc.test_order,
        input_data: tc.input_data,
        expected_output: tc.expected_output,
      }));
      const { error: insertTcError } = await supabase.from('test_cases').insert(clonedTcRows);
      if (insertTcError) {
        setIsCloningToContest(false);
        alert(
          `Đã tạo đề bài [${targetId}] trong Contest nhưng lỗi khi sao chép Test cases: ${insertTcError.message}`
        );
        await loadAllAdminData();
        return;
      }
      copiedCount = clonedTcRows.length;
    }

    setIsCloningToContest(false);
    setCloneSourceProb(null);
    setSelectedProbForTc(targetId);
    await loadAllAdminData();
    await loadTestCases(targetId);

    alert(
      `✅ Đã sao chép nguyên vẹn bài [${cloneSourceProb.id}] "${cloneSourceProb.title}" (kèm ${copiedCount} test cases & cấu hình ${
        cloneSourceProb.io_mode === 'file'
          ? `File ${cloneSourceProb.io_filename}.in/.out`
          : 'stdin/stdout'
      }) vào Contest "${cloneTargetContestId}" với mã [${targetId}]!`
    );
  };

  // --- QUẢN LÝ TEST CASES ---
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
      alert('Vui lòng chọn hoặc lưu bài tập trước khi thêm test case!');
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
        alert(`Đã upload thành công ${rowsToInsert.length} test cases vào bài [${selectedProbForTc}]!`);
        loadTestCases(selectedProbForTc);
      }
    }
    e.target.value = '';
  };

  // ==================== HANDLER TAB 4: DANGER ZONE ====================
  const handleResetEntireOj = async () => {
    const confirmText = prompt(
      'CẢNH BÁO NGUY HIỂM: Thao tác này sẽ xóa vĩnh viễn toàn bộ tài khoản (kể cả Admin hiện tại), Contest, đề bài, lịch sử bài nộp và reset toàn bộ ID về 1.\n\nChỉ giữ lại đề bài + 2 test case của "aplusb" và template các ngôn ngữ lập trình.\n\nNhập chính xác chữ "RESET" để xác nhận:'
    );
    if (confirmText !== 'RESET') return;

    setIsResettingOj(true);
    const { error } = await supabase.rpc('reset_entire_oj');
    setIsResettingOj(false);

    if (error) {
      alert('Lỗi khi reset toàn bộ OJ: ' + error.message);
      return;
    }

    localStorage.removeItem('oj_user');
    alert('Đã reset toàn bộ OJ thành công! Hệ thống sẽ chuyển về trang chủ để khởi tạo lại Admin.');
    window.location.href = '/';
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Bảng Quản Trị Hệ Thống (Admin)</h2>

      {/* Thanh chuyển Tab (4 Tab gọn gàng) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'users', label: '1. Tài khoản (User/Admin)' },
          { id: 'contests', label: '2. Contest & Phân quyền' },
          { id: 'problems', label: '3. Bài tập & Test cases' },
          { id: 'danger', label: '4. Danger Zone' },
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
              backgroundColor:
                activeTab === tab.id
                  ? tab.id === 'danger'
                    ? '#dc2626'
                    : '#0f172a'
                  : tab.id === 'danger'
                  ? '#fee2e2'
                  : '#e2e8f0',
              color:
                activeTab === tab.id
                  ? '#fff'
                  : tab.id === 'danger'
                  ? '#dc2626'
                  : '#0f172a',
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

      {/* ================= TAB 2: QUẢN LÝ CONTEST (4 CÁCH ĐẶT GIỜ) ================= */}
      {activeTab === 'contests' && (
        <div>
          <form onSubmit={handleSaveContest} style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '8px', marginBottom: '24px', display: 'grid', gap: '14px', border: '1px solid #e2e8f0' }}>
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

            {/* 4 cách đặt thời gian cho contest */}
            <div style={{ display: 'grid', gap: '8px', fontSize: '14px', padding: '12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <b>Chọn cách đặt thời gian (4 chế độ):</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={timeMode === 'start_end'}
                    onChange={() => setTimeMode('start_end')}
                  />{' '}
                  <b>Cách 1:</b> Đặt ngày/giờ bắt đầu & kết thúc
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={timeMode === 'start_duration'}
                    onChange={() => setTimeMode('start_duration')}
                  />{' '}
                  <b>Cách 2:</b> Đặt ngày/giờ bắt đầu & thời lượng (phút)
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={timeMode === 'now_end'}
                    onChange={() => setTimeMode('now_end')}
                  />{' '}
                  <b>Cách 3:</b> Bắt đầu ngay & đặt ngày/giờ kết thúc
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={timeMode === 'now_duration'}
                    onChange={() => setTimeMode('now_duration')}
                  />{' '}
                  <b>Cách 4:</b> Bắt đầu ngay & đặt thời lượng (phút)
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              {(timeMode === 'start_end' || timeMode === 'start_duration') ? (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Thời gian bắt đầu (GMT+7):</label>
                  <input
                    type="datetime-local"
                    required
                    value={cStartLocal}
                    onChange={(e) => setCStartLocal(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              ) : (
                <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px dashed #16a34a', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#16a34a', fontWeight: 'bold' }}>
                  ⚡ Thời gian bắt đầu: Ngay lập tức khi bấm Lưu Contest
                </div>
              )}

              {(timeMode === 'start_end' || timeMode === 'now_end') ? (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Thời gian kết thúc (GMT+7):</label>
                  <input
                    type="datetime-local"
                    required
                    value={cEndLocal}
                    onChange={(e) => setCEndLocal(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
                />{' '}
                Bật giới hạn thí sinh tham gia (Chỉ những user được chọn bên dưới mới vào được)
              </label>

              {cRestrict && (
                <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {usersList.filter((u) => u.role !== 'admin').map((u) => (
                    <label key={u.id} style={{ fontSize: '14px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={cAllowedUsers.includes(u.username)}
                        onChange={() => toggleAllowedUser(u.username)}
                      />{' '}
                      {u.username}
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

      {/* ================= TAB 3: GỘP BÀI TẬP & QUẢN LÝ TEST CASES ================= */}
      {activeTab === 'problems' && (
        <div>
          {/* PHẦN A: FORM THÊM / SỬA ĐỀ BÀI */}
          <form onSubmit={handleSaveProblem} style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '8px', marginBottom: '24px', display: 'grid', gap: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0 }}>Phần 1: Thêm / Cập nhật Đề bài</h4>
              <button
                type="button"
                onClick={resetProblemForm}
                style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                + Làm mới form (Tạo bài mới)
              </button>
            </div>

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
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Time Limit (ms):</label>
                <input
                  type="number"
                  value={pTimeLimit}
                  onChange={(e) => setPTimeLimit(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Memory Limit (MB):</label>
                <input
                  type="number"
                  value={pMemLimit}
                  onChange={(e) => setPMemLimit(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Thuộc Contest:</label>
                <select
                  value={pContestId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPContestId(val);
                    if (!val) setPHideGrading(false); // Tự tắt ẩn quá trình chấm nếu là luyện tập tự do
                  }}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Luyện tập tự do --</option>
                  {contestsList.map((c) => (
                    <option key={c.id} value={c.id}>Contest: {c.title} ({c.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Thứ tự bài (1, 2, 3...):</label>
                <input
                  type="number"
                  min={1}
                  value={pOrder}
                  onChange={(e) => setPOrder(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            {/* Cấu hình kiểu Input / Output */}
            <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', fontSize: '14px' }}>
                <b>Kiểu đọc / ghi dữ liệu:</b>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={pIoMode === 'stdio'}
                    onChange={() => setPIoMode('stdio')}
                  />{' '}
                  Luồng chuẩn (<code>stdin / stdout</code>)
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={pIoMode === 'file'}
                    onChange={() => {
                      setPIoMode('file');
                      if (!pIoFilename && pId.trim()) {
                        setPIoFilename(pId.trim().toUpperCase());
                      }
                    }}
                  />{' '}
                  Đọc / ghi tệp (<code>.in / .out</code>)
                </label>
              </div>

              {pIoMode === 'file' && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Tên file (không kèm đuôi):</label>
                  <input
                    type="text"
                    placeholder="VD: CHINHPHUONG"
                    value={pIoFilename}
                    onChange={(e) => setPIoFilename(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Hệ thống sẽ tự sinh cặp tệp: <code>{pIoFilename.trim().replace(/\.(in|inp|out|ans|txt)$/i, '') || 'TENBAI'}.in</code> &amp;{' '}
                    <code>{pIoFilename.trim().replace(/\.(in|inp|out|ans|txt)$/i, '') || 'TENBAI'}.out</code> (đã bật chống xung đột tên file).
                  </span>
                </div>
              )}
            </div>

            {/* Các tùy chọn ẩn test & ẩn quá trình chấm */}
            <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
              <label style={{ fontWeight: 'bold', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pHideTests}
                  onChange={(e) => setPHideTests(e.target.checked)}
                />{' '}
                Ẩn chi tiết Test case (Thí sinh vẫn thấy màu AC/WA từng test nhưng không xem được Input/Output)
              </label>

              <label
                style={{
                  fontWeight: 'bold',
                  cursor: pContestId ? 'pointer' : 'not-allowed',
                  opacity: pContestId ? 1 : 0.55,
                }}
              >
                <input
                  type="checkbox"
                  disabled={!pContestId}
                  checked={pHideGrading}
                  onChange={(e) => setPHideGrading(e.target.checked)}
                />{' '}
                Ẩn toàn bộ quá trình chấm — Chế độ OI (Giấu sạch kết quả AC/WA trong lúc thi, chỉ công bố khi hết giờ Contest)
                {!pContestId && <span style={{ fontWeight: 'normal', fontSize: '12px', marginLeft: '6px' }}>(Chỉ bật được khi bài thuộc Contest)</span>}
              </label>
            </div>

            <div>
              <button type="submit" style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Lưu Bài tập
              </button>
            </div>
          </form>

          {/* PHẦN B: DANH SÁCH BÀI TẬP */}
          <h4 style={{ marginBottom: '10px' }}>Phần 2: Danh sách Bài tập (Bấm &ldquo;Sửa &amp; Test&rdquo; để chỉnh đề hoặc nạp Test cases)</h4>
          <div style={{ overflowX: 'auto', marginBottom: '32px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px' }}>STT</th>
                  <th style={{ padding: '10px' }}>Mã bài</th>
                  <th style={{ padding: '10px' }}>Tên bài</th>
                  <th style={{ padding: '10px' }}>Phân loại</th>
                  <th style={{ padding: '10px' }}>Kiểu I/O</th>
                  <th style={{ padding: '10px' }}>Chế độ ẩn</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {problemsList.map((p) => {
                  const isSelected = selectedProbForTc === p.id;
                  const isFreePractice = !p.contest_id;
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px' }}>#{p.problem_order || 1}</td>
                      <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{p.id}</td>
                      <td style={{ padding: '10px' }}>{p.title}</td>
                      <td style={{ padding: '10px' }}>{p.contest_id ? `Contest: ${p.contest_id}` : 'Luyện tập tự do'}</td>
                      <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
                        {p.io_mode === 'file' ? `${p.io_filename}.in / .out` : 'stdin / stdout'}
                      </td>
                      <td style={{ padding: '10px', fontSize: '12px' }}>
                        {p.hide_grading
                          ? '🔒 Ẩn toàn bộ chấm (OI)'
                          : p.hide_tests
                          ? '👁️‍🗨️ Ẩn chi tiết test'
                          : 'Công khai'}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {isFreePractice && (
                          <button
                            type="button"
                            onClick={() => handleOpenCloneModal(p)}
                            title="Sao chép toàn bộ đề, giới hạn, kiểu I/O và test cases vào một Contest"
                            style={{ backgroundColor: '#0d9488', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            📋 Thêm vào Contest
                          </button>
                        )}
                        <button
                          onClick={() => handleEditProblemFill(p)}
                          style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          Sửa &amp; Test
                        </button>
                        <button
                          onClick={() => handleDeleteProblem(p.id)}
                          style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MODAL THÊM BÀI LUYỆN TẬP TỰ DO VÀO CONTEST */}
          {cloneSourceProb && (
            <div
              onClick={() => !isCloningToContest && setCloneSourceProb(null)}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
                padding: '16px',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: '#fff',
                  color: '#0f172a',
                  padding: '24px',
                  borderRadius: '10px',
                  width: '100%',
                  maxWidth: '520px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '8px' }}>
                  📋 Thêm bài Luyện tập tự do vào Contest
                </h3>
                <p style={{ fontSize: '13px', color: '#475569', marginTop: 0, marginBottom: '14px', lineHeight: 1.5 }}>
                  Hệ thống sẽ giữ nguyên bài gốc <code>[{cloneSourceProb.id}]</code> ở kho Luyện tập tự do và tạo một bản sao độc lập trong Contest với đầy đủ: <b>tên bài, đề bài, giới hạn ({cloneSourceProb.time_limit_ms}ms / {cloneSourceProb.memory_limit_mb}MB), kiểu I/O ({cloneSourceProb.io_mode === 'file' ? `${cloneSourceProb.io_filename}.in/.out` : 'stdin/stdout'}) và toàn bộ test cases</b>.
                </p>

                <form onSubmit={handleConfirmCloneToContest} style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Chọn Contest đích:
                    </label>
                    <select
                      value={cloneTargetContestId}
                      onChange={(e) => handleCloneTargetContestChange(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {contestsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                        Mã bài trong Contest (không trùng mã gốc):
                      </label>
                      <input
                        type="text"
                        required
                        value={cloneNewProbId}
                        onChange={(e) => setCloneNewProbId(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                        Thứ tự bài (STT):
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={cloneOrder}
                        onChange={(e) => setCloneOrder(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '8px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <b>Cấu hình áp dụng riêng trong Contest:</b>
                    <label style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={cloneHideTests}
                        onChange={(e) => setCloneHideTests(e.target.checked)}
                      />{' '}
                      Ẩn chi tiết Test case (không cho xem Input/Output mẫu)
                    </label>
                    <label style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={cloneHideGrading}
                        onChange={(e) => setCloneHideGrading(e.target.checked)}
                      />{' '}
                      Ẩn toàn bộ quá trình chấm — Chế độ OI (chỉ hiện kết quả khi hết giờ Contest)
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      disabled={isCloningToContest}
                      onClick={() => setCloneSourceProb(null)}
                      style={{
                        backgroundColor: '#e2e8f0',
                        color: '#0f172a',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isCloningToContest}
                      style={{
                        backgroundColor: '#0d9488',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 18px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: isCloningToContest ? 'not-allowed' : 'pointer',
                        opacity: isCloningToContest ? 0.7 : 1,
                      }}
                    >
                      {isCloningToContest ? 'Đang sao chép...' : '✅ Xác nhận thêm vào Contest'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* PHẦN C: QUẢN LÝ TEST CASES NGAY TRÊN CÙNG TRANG */}
          <div style={{ borderTop: '2px solid #cbd5e1', paddingTop: '24px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0 }}>Phần 3: Quản lý Test cases cho bài:</h4>
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

            <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '20px' }}>
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
                  📤 Upload testcase (.inp/.in &amp; .out/.ans)
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
                    style={{ width: '100%', fontFamily: 'monospace', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Expected Output (Đáp án chuẩn):</label>
                  <textarea
                    rows={5}
                    value={tcOutput}
                    onChange={(e) => setTcOutput(e.target.value)}
                    placeholder="Nhập dữ liệu Output chuẩn..."
                    style={{ width: '100%', fontFamily: 'monospace', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveTestCase}
                style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Lưu testcase
              </button>
            </div>

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
                {tcList.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                      Bài tập này chưa có test case nào.
                    </td>
                  </tr>
                ) : (
                  tcList.map((tc) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: DANGER ZONE ================= */}
      {activeTab === 'danger' && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '2px solid #fca5a5',
            borderRadius: '8px',
            padding: '20px',
          }}
        >
          <h3 style={{ marginTop: 0, color: '#dc2626' }}>Danger Zone</h3>
          <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6, marginBottom: '16px' }}>
            Reset toàn bộ hệ thống Online Judge về trạng thái ban đầu: xóa sạch toàn bộ tài khoản (bao gồm cả Admin hiện tại),
            Contest, bài tập, lịch sử bài nộp và đặt lại toàn bộ bộ đếm <b>ID</b> về <b>1</b>. Hệ thống chỉ giữ lại đề bài + 2 test case
            của bài <code>aplusb</code> và template của các ngôn ngữ lập trình.
          </p>
          <button
            type="button"
            disabled={isResettingOj}
            onClick={handleResetEntireOj}
            style={{
              backgroundColor: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: isResettingOj ? 'not-allowed' : 'pointer',
              opacity: isResettingOj ? 0.7 : 1,
            }}
          >
            {isResettingOj ? 'Đang reset hệ thống...' : 'Reset toàn bộ OJ'}
          </button>
        </div>
      )}
    </div>
  );
}
