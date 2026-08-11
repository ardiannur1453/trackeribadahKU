import React, { useState, useMemo, useEffect } from 'react';

// Membuat html2canvas secara dinamis agar aman dijalankan di Canvas ini
const loadHtml2Canvas = async () => {
  if (window.html2canvas) return window.html2canvas;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const DEFAULT_ACTIVITIES = [
  { id: 1, name: 'Shalat Tahajud', time: '03:00' },
  { id: 2, name: 'Shalat Subuh', time: '04:30' },
  { id: 3, name: 'Dzikir Pagi', time: '05:00' },
  { id: 4, name: 'Shalat Dhuha', time: '09:00' },
  { id: 5, name: 'Shalat Dzuhur', time: '12:00' },
  { id: 6, name: 'Shalat Ashar', time: '15:15' },
  { id: 7, name: 'Shalat Maghrib', time: '18:00' },
  { id: 8, name: 'Dzikir Petang', time: '18:30' },
  { id: 9, name: 'Shalat Isya', time: '19:15' },
  { id: 10, name: 'Tilawah Al-Quran', time: '20:00' }
];

// SVG Icons
const IconPlus = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const IconTrash = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const IconEdit = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const IconEye = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const IconSave = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>;
const IconX = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const IconChart = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>;
const IconCamera = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>;
const IconBook = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>;
const IconClock = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const IconAlert = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;

export default function IbadahTracker() {
  const [activities, setActivities] = useState(() => {
    const saved = localStorage.getItem('ibadah_activities');
    return saved ? JSON.parse(saved) : DEFAULT_ACTIVITIES;
  });

  const [records, setRecords] = useState(() => {
    const saved = localStorage.getItem('ibadah_records');
    return saved ? JSON.parse(saved) : {};
  });

  const [journals, setJournals] = useState(() => {
    const saved = localStorage.getItem('ibadah_journals');
    return saved ? JSON.parse(saved) : [];
  });

  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTime, setEditTime] = useState('');
  
  const [editorMode, setEditorMode] = useState('create'); 
  const [editJournalId, setEditJournalId] = useState(null);
  const [journalTitle, setJournalTitle] = useState('');
  const [journalContent, setJournalContent] = useState('');
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [viewingJournal, setViewingJournal] = useState(null);
  
  const [toastMsg, setToastMsg] = useState('');
  const [clearScope, setClearScope] = useState(''); // State untuk Reset Data
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  useEffect(() => { localStorage.setItem('ibadah_activities', JSON.stringify(activities)); }, [activities]);
  useEffect(() => { localStorage.setItem('ibadah_records', JSON.stringify(records)); }, [records]);
  useEffect(() => { localStorage.setItem('ibadah_journals', JSON.stringify(journals)); }, [journals]);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getDayName = (day) => {
    const date = new Date(selectedYear, selectedMonth, day);
    return date.toLocaleDateString('id-ID', { weekday: 'short' });
  };

  const getSortableMinutes = (timeStr) => {
    let [hours, minutes] = timeStr.split(':').map(Number);
    if (hours < 2) hours += 24; 
    return (hours - 2) * 60 + minutes;
  };

  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      return getSortableMinutes(a.time) - getSortableMinutes(b.time);
    });
  }, [activities]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => { setToastMsg(''); }, 3000);
  };

  const handleAddActivity = (e) => {
    e.preventDefault();
    if (!newName.trim() || !newTime) return;
    setActivities([...activities, { id: Date.now(), name: newName, time: newTime }]);
    setNewName('');
    setNewTime('');
  };

  const handleDeleteActivity = (id) => {
    setActivities(activities.filter(act => act.id !== id));
    const updatedRecords = { ...records };
    Object.keys(updatedRecords).forEach(key => {
      if (key.startsWith(`${id}-`)) delete updatedRecords[key];
    });
    setRecords(updatedRecords);
  };

  const handleEditClick = (act) => {
    setEditingId(act.id);
    setEditName(act.name);
    setEditTime(act.time);
  };
  
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditTime('');
  };

  const handleSaveEdit = (id) => {
    if (!editName.trim() || !editTime) return;
    setActivities(activities.map(act => act.id === id ? { ...act, name: editName, time: editTime } : act));
    setEditingId(null);
  };

  const getRecordKey = (activityId, day) => `${activityId}-${selectedYear}-${selectedMonth}-${day}`;

  const getRecordData = (recordValue) => {
    if (typeof recordValue === 'object' && recordValue !== null) {
      return { state: recordValue.state, timestamp: recordValue.timestamp, timestampMs: recordValue.timestampMs };
    }
    return { state: recordValue, timestamp: null, timestampMs: null };
  };

  // Penilaian Tepat Waktu (Formula Ketat)
  const checkIsOnTime = (timestampMs, day, actTime) => {
    if (!timestampMs) return false;
    const [h, m] = actTime.split(':').map(Number);
    
    const scheduledDate = new Date(selectedYear, selectedMonth, day, h, m);
    const scheduledMs = scheduledDate.getTime();
    const filledDateObj = new Date(timestampMs);
    
    // Validasi Tanggal Mutlak
    const isSameDay = filledDateObj.getDate() === day &&
                      filledDateObj.getMonth() === selectedMonth &&
                      filledDateObj.getFullYear() === selectedYear;
                      
    const diffHours = (timestampMs - scheduledMs) / (1000 * 60 * 60);
    // Maksimal lapor: 1 jam setelahnya. Minimal lapor: 2 jam sebelumnya (jika dilakukan sebelum waktunya)
    return isSameDay && diffHours <= 1 && diffHours >= -2;
  };

  const toggleRecord = (activityId, day, actTime) => {
    const now = new Date();
    const [actH, actM] = actTime.split(':').map(Number);
    
    const targetDate = new Date(selectedYear, selectedMonth, day, actH, actM);
    targetDate.setMinutes(targetDate.getMinutes() + 1);

    // Blokir jika sebelum waktunya
    if (now < targetDate) {
      showToast("Belum waktunya! Laporan hanya bisa diisi minimal 1 menit setelah waktu aktivitas.");
      return; 
    }

    const key = getRecordKey(activityId, day);
    const timeString = now.toLocaleDateString('id-ID', { 
      day: 'numeric', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
    const timeMs = now.getTime();

    setRecords(prev => {
      const currentData = prev[key];
      const { state: currentState } = getRecordData(currentData);
      const newRecords = { ...prev };
      
      if (currentState === undefined) {
        newRecords[key] = { state: true, timestamp: timeString, timestampMs: timeMs }; 
      } else if (currentState === true) {
        newRecords[key] = { state: false, timestamp: timeString, timestampMs: timeMs }; 
      } else {
        delete newRecords[key]; 
      }
      return newRecords;
    });
  };

  const handleExecuteClear = () => {
    if (!clearScope) return;
    
    const today = new Date();
    const currentDayNumber = today.getDate();
    let daysToClear = [];

    if (clearScope === 'daily') {
      daysToClear = [currentDayNumber];
    } else if (clearScope === 'weekly') {
      const weekIndex = Math.floor((currentDayNumber - 1) / 7);
      const startDay = weekIndex * 7 + 1;
      const endDay = Math.min(startDay + 6, daysInMonth);
      for(let i = startDay; i <= endDay; i++) daysToClear.push(i);
    } else if (clearScope === 'monthly') {
      for(let i = 1; i <= daysInMonth; i++) daysToClear.push(i);
    }

    setRecords(prev => {
      const newRecords = { ...prev };
      sortedActivities.forEach(act => {
        daysToClear.forEach(day => {
          const key = getRecordKey(act.id, day);
          delete newRecords[key];
        });
      });
      return newRecords;
    });

    showToast(`Data ${clearScope === 'daily' ? 'Harian' : clearScope === 'weekly' ? 'Mingguan' : 'Bulanan'} berhasil dihapus & di-update.`);
    setClearScope('');
  };

  const handlePrepareCreateJournal = () => {
    setEditorMode('create');
    setEditJournalId(null);
    setJournalTitle('');
    setJournalContent('');
  };

  const handlePrepareEditJournal = (journal) => {
    setEditorMode('edit');
    setEditJournalId(journal.id);
    setJournalTitle(journal.title);
    setJournalContent(journal.content);
  };

  const handleDeleteJournal = (id) => {
    setJournals(journals.filter(j => j.id !== id));
    if (editJournalId === id) handlePrepareCreateJournal();
  };

  const handleSaveJournal = () => {
    if (!journalTitle.trim()) return;
    if (editorMode === 'create') {
      setJournals([...journals, { id: Date.now(), title: journalTitle, content: journalContent }]);
    } else {
      setJournals(journals.map(j => j.id === editJournalId ? { ...j, title: journalTitle, content: journalContent } : j));
    }
    handlePrepareCreateJournal();
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2000); 
  };

  const handleExportGraphics = async () => {
    const element = document.getElementById('dashboard-graphics-area');
    if (!element) return;
    try {
      const html2canvas = await loadHtml2Canvas();
      const originalPadding = element.style.padding;
      const originalBg = element.style.backgroundColor;
      element.style.padding = '24px';
      element.style.backgroundColor = '#f8fafc';

      const canvas = await html2canvas(element, {
        scale: 2, 
        backgroundColor: '#f8fafc',
        ignoreElements: (el) => el.classList.contains('no-export')
      });
      
      element.style.padding = originalPadding;
      element.style.backgroundColor = originalBg;

      const image = canvas.toDataURL("image/jpeg", 0.9);
      const link = document.createElement('a');
      link.download = `Laporan_Grafik_Ibadah_${selectedMonth + 1}_${selectedYear}.jpg`;
      link.href = image;
      link.click();
    } catch (error) {
      console.warn("Gagal mengekspor gambar. Pastikan browser mendukung.");
    }
  };

  const stats = useMemo(() => {
    const totalActivities = sortedActivities.length;
    if (totalActivities === 0) return { daily: [], weekly: [], monthly: 0, totalDone: 0, totalMissed: 0, mostFrequent: [], leastFrequent: [], globalOnTime: 0, globalLate: 0, mostDiscipline: [], mostLate: [] };

    let globalDone = 0;
    let globalMissed = 0;
    let globalOnTime = 0;
    let globalLate = 0;
    
    const activityCounts = {};
    const timeliness = {};
    
    sortedActivities.forEach(act => {
      activityCounts[act.id] = 0;
      timeliness[act.id] = { onTime: 0, late: 0, total: 0 };
    });

    const daily = daysArray.map(day => {
      let completed = 0;
      sortedActivities.forEach(act => {
        const { state, timestampMs } = getRecordData(records[getRecordKey(act.id, day)]);
        if (state === true) {
          completed++;
          globalDone++;
          activityCounts[act.id]++;
        } else if (state === false) {
          globalMissed++;
        }
        
        if ((state === true || state === false) && timestampMs) {
          const isTepatWaktu = checkIsOnTime(timestampMs, day, act.time);
          
          if (isTepatWaktu) {
            globalOnTime++;
            timeliness[act.id].onTime++;
          } else {
            globalLate++;
            timeliness[act.id].late++;
          }
          timeliness[act.id].total++;
        }
      });
      return { day, percentage: Math.round((completed / totalActivities) * 100) || 0 };
    });

    const weeks = [
      { label: 'Pekan 1', days: daysArray.slice(0, 7) },
      { label: 'Pekan 2', days: daysArray.slice(7, 14) },
      { label: 'Pekan 3', days: daysArray.slice(14, 21) },
      { label: 'Pekan 4', days: daysArray.slice(21, 28) },
      { label: 'Pekan 5', days: daysArray.slice(28, daysInMonth) }
    ];

    const weekly = weeks.map(week => {
      let weekCompleted = 0;
      let weekTotal = week.days.length * totalActivities;
      week.days.forEach(day => {
        sortedActivities.forEach(act => {
          const { state } = getRecordData(records[getRecordKey(act.id, day)]);
          if (state === true) weekCompleted++;
        });
      });
      return { label: week.label, percentage: weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0 };
    });

    const monthly = Math.round((globalDone / (totalActivities * daysInMonth)) * 100) || 0;

    let maxCount = -1;
    let minCount = 9999;
    Object.keys(activityCounts).forEach(id => {
      const count = activityCounts[id];
      if (count > maxCount) maxCount = count;
      if (count < minCount) minCount = count;
    });

    const mostFrequent = sortedActivities.filter(act => activityCounts[act.id] === maxCount).map(act => act.name);
    const leastFrequent = sortedActivities.filter(act => activityCounts[act.id] === minCount).map(act => act.name);

    let mostDiscipline = [];
    let mostLate = [];
    
    // Analisa khusus Tepat Waktu (Syarat mutlak: onTime harus > 0)
    const disciplineActs = sortedActivities
      .filter(act => timeliness[act.id].total > 0 && timeliness[act.id].onTime > 0)
      .map(act => ({
        name: act.name,
        rate: timeliness[act.id].onTime / timeliness[act.id].total
      }))
      .sort((a, b) => b.rate - a.rate);

    if (disciplineActs.length > 0) {
      const highestRate = disciplineActs[0].rate;
      mostDiscipline = disciplineActs.filter(a => a.rate === highestRate).map(a => a.name);
    }

    // Analisa khusus Terlambat/Rapel (Syarat mutlak: late harus > 0)
    const lateActs = sortedActivities
      .filter(act => timeliness[act.id].total > 0 && timeliness[act.id].late > 0)
      .map(act => ({
        name: act.name,
        rate: timeliness[act.id].late / timeliness[act.id].total
      }))
      .sort((a, b) => b.rate - a.rate);

    if (lateActs.length > 0) {
      const highestLateRate = lateActs[0].rate;
      mostLate = lateActs.filter(a => a.rate === highestLateRate).map(a => a.name);
    }

    return { 
      daily, weekly, monthly, totalDone: globalDone, totalMissed: globalMissed, 
      mostFrequent, leastFrequent, maxCount, minCount,
      globalOnTime, globalLate, mostDiscipline, mostLate
    };
  }, [sortedActivities, records, daysArray, selectedMonth, selectedYear, daysInMonth]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8 relative">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] bg-slate-900 border-l-4 border-orange-500 text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-5">
          <span className="text-orange-500"><IconAlert /></span>
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Modal View Jurnal */}
      {viewingJournal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingJournal(null)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 bg-orange-500 text-white">
              <h3 className="text-xl sm:text-2xl font-bold pr-4">{viewingJournal.title}</h3>
              <button onClick={() => setViewingJournal(null)} className="text-white hover:text-orange-200 transition-colors p-2 shrink-0">
                <IconX />
              </button>
            </div>
            <div className="p-5 sm:p-6 overflow-y-auto whitespace-pre-wrap text-slate-700 leading-relaxed flex-1 text-[15px]">
              {viewingJournal.content || <em className="text-slate-400">Tidak ada isi catatan.</em>}
            </div>
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setViewingJournal(null)} className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg shadow-sm hover:bg-slate-700 transition-colors">Tutup</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        
        {}
        {/* Header Section (Tafkir Corp) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-[#111111] rounded-full flex items-center justify-center shrink-0 border-2 border-orange-500 overflow-hidden shadow-md">
                <svg viewBox="0 0 100 100" className="w-10 h-10">
                   <path d="M50 10 Q40 40 20 50 Q10 70 30 90 Q50 100 70 80 Q90 60 70 30 Q60 20 50 10 Z" fill="white"/>
                   <path d="M50 30 Q45 50 35 60 Q30 75 45 85 Q60 90 70 75 Q80 60 65 45 Q60 35 50 30 Z" fill="#111111"/>
                   <circle cx="55" cy="70" r="8" fill="white"/>
                </svg>
             </div>
             <div>
               <h1 className="text-2xl font-bold text-orange-500 tracking-tight">Tafkir Corp</h1>
               <p className="text-sm font-semibold text-slate-700 mt-0.5 tracking-wide uppercase">Elevate The Level of Thinking</p>
               <p className="text-xs text-slate-500 mt-1">Tracker Ibadah & Evaluasi Diri</p>
             </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
            <div className="flex gap-2 w-full sm:w-auto">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium text-slate-700 bg-white cursor-pointer">
                {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-24 px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium text-slate-700 bg-white" min="2000" max="2100"/>
            </div>
            <div className="text-center px-4 py-2 bg-orange-50 rounded-lg border border-orange-100 w-full sm:w-auto">
              <div className="text-xs font-bold text-orange-600 uppercase tracking-wider">Progress Bulan Ini</div>
              <div className="text-2xl font-black text-orange-500">{stats.monthly}%</div>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleAddActivity} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Ibadah / Aktivitas</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Cth: Tilawah Surat Al-Mulk" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1">Jam (Waktu)</label>
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
            </div>
            <button type="submit" disabled={!newName.trim() || !newTime} className="w-full sm:w-auto px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors flex justify-center items-center gap-2 h-[42px]">
              <IconPlus /> Tambah
            </button>
          </form>
        </div>

        {}
        {/* TABEL AKTIVITAS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto relative">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="sticky left-0 z-20 bg-slate-100 border-b border-r border-slate-200 py-3 px-4 text-left font-bold text-slate-700 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Aktivitas</th>
                  <th className="border-b border-r border-slate-200 py-3 px-3 font-bold text-slate-700 min-w-[80px]">Waktu</th>
                  {daysArray.map(day => (
                    <th key={day} className="border-b border-r border-slate-200 py-2 px-1 font-medium text-slate-600 min-w-[48px] text-center">
                      <div className="text-[10px] uppercase text-slate-400 mb-1">{getDayName(day)}</div>
                      <div className="text-sm">{day}</div>
                    </th>
                  ))}
                  <th className="border-b border-slate-200 py-3 px-3 font-bold text-slate-700 min-w-[80px] no-export">Opsi</th>
                </tr>
              </thead>
              <tbody>
                {sortedActivities.length === 0 ? (
                  <tr><td colSpan={daysInMonth + 3} className="py-8 text-center text-slate-500">Belum ada aktivitas yang ditambahkan.</td></tr>
                ) : (
                  sortedActivities.map((act, index) => {
                    let elapsedDays = 0;
                    const today = new Date();
                    if (selectedYear < today.getFullYear() || (selectedYear === today.getFullYear() && selectedMonth < today.getMonth())) elapsedDays = daysInMonth; 
                    else if (selectedYear === today.getFullYear() && selectedMonth === today.getMonth()) elapsedDays = today.getDate(); 
                    
                    const evaluatedDays = Math.floor(elapsedDays / 7) * 7;
                    let doneCount = 0, filledCount = 0;
                    
                    for (let day = 1; day <= evaluatedDays; day++) {
                      const { state } = getRecordData(records[getRecordKey(act.id, day)]);
                      if (state === true) doneCount++;
                      if (state !== undefined) filledCount++;
                    }
                    
                    const isUnderperforming = evaluatedDays > 0 && filledCount > 0 && (doneCount / evaluatedDays) < 0.5;
                    const defaultBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    const nameCellClass = isUnderperforming ? 'bg-red-50 text-red-700' : `${defaultBg} text-slate-800`;

                    return (
                      <tr key={act.id} className={`hover:bg-orange-50/50 transition-colors ${defaultBg}`}>
                        <td className={`sticky left-0 z-10 border-b border-r border-slate-200 py-2 px-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] font-medium ${nameCellClass}`}>
                          {editingId === act.id ? (
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1 rounded border border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm bg-white" autoFocus/>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span>{act.name}</span>
                              {isUnderperforming && <span title="Pengerjaan di bawah 50% pekan sebelumnya" className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-r border-slate-200 py-2 px-3 text-center text-orange-600 font-bold bg-orange-50/20">
                          {editingId === act.id ? (
                            <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full px-1 py-1 rounded border border-orange-300 text-sm bg-white text-center"/>
                          ) : (act.time)}
                        </td>
                        {daysArray.map(day => {
                          const { state, timestamp, timestampMs } = getRecordData(records[getRecordKey(act.id, day)]);
                          let isLateStatus = false;
                          
                          if (timestampMs) {
                            const isTepatWaktu = checkIsOnTime(timestampMs, day, act.time);
                            isLateStatus = !isTepatWaktu;
                          }
                          
                          return (
                            <td key={day} onClick={() => toggleRecord(act.id, day, act.time)} className="border-b border-r border-slate-200 py-2 px-1 text-center cursor-pointer transition-all hover:bg-slate-200/50 group relative">
                              <div className="flex justify-center items-center h-full min-h-[24px]">
                                {state === true && <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                {state === false && <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>}
                              </div>
                              
                              {/* Timestamp Tooltip Cerdas */}
                              {(state === true || state === false) && timestamp && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-50 pointer-events-none">
                                   <div className="bg-slate-800 text-white text-[10px] py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap flex flex-col items-center border border-slate-600">
                                      <span className="font-medium text-slate-300">Diisi: {timestamp}</span>
                                      {timestampMs && (
                                        <span className={`mt-0.5 font-bold ${isLateStatus ? 'text-red-400' : 'text-green-400'}`}>
                                          {isLateStatus ? 'Terlambat / Rapel' : 'Tepat Waktu'}
                                        </span>
                                      )}
                                   </div>
                                   <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-800 mx-auto"></div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="border-b border-slate-200 py-2 px-3 text-center no-export">
                          {editingId === act.id ? (
                            <div className="flex justify-center gap-1">
                              <button onClick={() => handleSaveEdit(act.id)} className="text-orange-500 hover:bg-orange-50 p-1 rounded"><IconSave /></button>
                              <button onClick={handleCancelEdit} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><IconX /></button>
                            </div>
                          ) : (
                            <div className="flex justify-center gap-1">
                              <button onClick={() => handleEditClick(act)} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><IconEdit /></button>
                              <button onClick={() => handleDeleteActivity(act.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded"><IconTrash /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {}
        {/* FITUR RESET / CLEAR DATA */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <IconTrash />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Manajemen Hapus Data</h3>
              <p className="text-xs text-slate-500">Pilih rentang data pelaporan yang ingin di-reset (dihapus).</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <select value={clearScope} onChange={(e) => setClearScope(e.target.value)} className="w-full sm:w-auto px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-slate-50 cursor-pointer">
              <option value="">-- Pilih Rentang Hapus --</option>
              <option value="daily">Harian (Tgl {currentDate.getDate()} Bulan Ini)</option>
              <option value="weekly">Mingguan (Pekan Ini)</option>
              <option value="monthly">Bulanan (Seluruh Bulan Ini)</option>
            </select>
            <button 
              onClick={handleExecuteClear} 
              disabled={!clearScope} 
              className="w-full sm:w-auto px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              Update (Eksekusi)
            </button>
          </div>
        </div>

        {/* FITUR JURNAL DI BAWAH TABEL */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row h-[400px]">
           <div className="w-full md:w-[40%] lg:w-1/3 bg-slate-50 border-r border-slate-200 p-4 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-md font-bold text-slate-800 flex items-center gap-2"><IconBook /> Jurnal & Doa</h2>
                <button onClick={handlePrepareCreateJournal} className={`p-1.5 rounded transition-colors ${editorMode === 'create' ? 'bg-orange-500 text-white' : 'bg-white text-orange-500 border border-orange-200 hover:bg-orange-50'}`} title="Buat Catatan Baru">
                  <IconPlus />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                {journals.map(j => (
                  <div key={j.id} className={`p-3 rounded-xl border transition-colors flex justify-between items-center group ${editJournalId === j.id ? 'bg-white border-orange-300 shadow-sm' : 'bg-transparent border-slate-200 hover:bg-slate-200/50'}`}>
                    <span className="font-medium text-sm truncate pr-2 text-slate-700">{j.title || 'Tanpa Judul'}</span>
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setViewingJournal(j)} className="text-slate-400 hover:text-orange-500 p-1.5 rounded hover:bg-orange-50" title="Baca"><IconEye /></button>
                      <button onClick={() => handlePrepareEditJournal(j)} className="text-slate-400 hover:text-blue-500 p-1.5 rounded hover:bg-blue-50" title="Edit"><IconEdit /></button>
                      <button onClick={() => handleDeleteJournal(j.id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50" title="Hapus"><IconTrash /></button>
                    </div>
                  </div>
                ))}
                {journals.length === 0 && <div className="text-xs text-slate-400 text-center py-6">Belum ada catatan.<br/>Klik tombol <strong>+</strong> untuk membuat.</div>}
              </div>
           </div>
           
           <div className="w-full md:w-[60%] lg:w-2/3 p-4 md:p-6 flex flex-col bg-white h-full relative">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3 border-b border-slate-100 pb-4">
                <div className="flex-1 flex flex-col">
                  <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1">{editorMode === 'create' ? 'Buat Catatan Baru' : 'Edit Catatan'}</span>
                  <input type="text" value={journalTitle} onChange={(e) => setJournalTitle(e.target.value)} placeholder="Ketik Judul..." className="text-xl font-bold text-slate-800 outline-none border-b-2 border-transparent focus:border-orange-300 bg-transparent transition-colors pb-1" />
                </div>
                <button onClick={handleSaveJournal} disabled={!journalTitle.trim()} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors">
                  <IconSave /> {showSavedMsg ? 'Tersimpan!' : 'Simpan'}
                </button>
              </div>
              <textarea value={journalContent} onChange={(e) => setJournalContent(e.target.value)} placeholder="Ketik isi doa, jurnal evaluasi, atau resolusi..." className="w-full flex-1 p-2 bg-transparent text-slate-700 focus:outline-none resize-none leading-relaxed"></textarea>
           </div>
        </div>

        {}
        {/* HEADER EXPORT GRAFIK */}
        <div className="flex justify-between items-end mt-8 px-2 border-b border-slate-200 pb-2">
           <h2 className="text-xl font-bold text-slate-800">Laporan & Statistik</h2>
           <button onClick={handleExportGraphics} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg shadow-md transition-colors flex items-center gap-2">
              <IconCamera /> Ekspor JPG
           </button>
        </div>

        {/* Area Khusus Diekspor (Dashboard Graphics) */}
        <div id="dashboard-graphics-area" className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-xl bg-slate-50 p-2 sm:p-0">
          
          {/* Daily Graph */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-2">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Progress Harian (%)</h2>
            <div className="h-40 flex items-end gap-1 sm:gap-2">
              {stats.daily.map((stat) => (
                <div key={stat.day} className="flex-1 flex flex-col items-center group relative">
                  <div className="w-full flex justify-center relative">
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] rounded px-2 py-1 pointer-events-none transition-opacity z-10">{stat.percentage}%</div>
                    <div className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 ${stat.percentage >= 80 ? 'bg-orange-500' : stat.percentage >= 40 ? 'bg-orange-300' : 'bg-slate-200'}`} style={{ height: `${Math.max(stat.percentage, 5)}%`, minHeight: '4px' }}></div>
                  </div>
                  <span className="text-[9px] text-slate-500 mt-2">{stat.day}</span>
                </div>
              ))}
            </div>
          </div>

          {}
          {/* Weekly & Status */}
          <div className="space-y-6 md:col-span-1">
            {/* Weekly */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-md font-bold text-slate-800 mb-3">Mingguan</h2>
              <div className="space-y-3">
                {stats.weekly.map((week, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">{week.label}</span>
                      <span className="text-slate-500 font-bold">{week.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${week.percentage}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Analisa Kedisiplinan Pelaporan (Pengecekan Tepat Waktu Secara Ketat) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-3">
             <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                <IconClock />
                <h2 className="text-lg font-bold text-slate-800">Analisa Kedisiplinan Waktu Pelaporan</h2>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Score Discipline */}
                <div className="flex flex-col justify-center items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center mb-2">Skor Tepat Waktu</span>
                   <div className="text-4xl font-black text-orange-500 mb-2">
                      {(stats.globalOnTime + stats.globalLate) > 0 ? Math.round((stats.globalOnTime / (stats.globalOnTime + stats.globalLate)) * 100) : 0}%
                   </div>
                   <div className="w-full flex h-3 rounded-full overflow-hidden bg-slate-200 mt-2">
                      <div className="bg-green-500" style={{ width: `${(stats.globalOnTime / (stats.globalOnTime + stats.globalLate)) * 100}%` }}></div>
                      <div className="bg-red-400" style={{ width: `${(stats.globalLate / (stats.globalOnTime + stats.globalLate)) * 100}%` }}></div>
                   </div>
                   <div className="flex justify-between w-full mt-2 text-[10px] font-medium text-slate-500">
                      <span>{stats.globalOnTime} Tepat Waktu</span>
                      <span>{stats.globalLate} Terlambat / Rapel</span>
                   </div>
                </div>

                {/* Most On Time */}
                <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                   <div className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Disiplin Lapor Sesuai Waktu</div>
                   {stats.mostDiscipline.length > 0 ? (
                     <ul className="list-disc list-inside text-sm font-medium text-slate-700 space-y-1">
                       {stats.mostDiscipline.map((name, i) => <li key={i}>{name}</li>)}
                     </ul>
                   ) : <span className="text-sm text-slate-400 italic">Belum ada data valid.</span>}
                </div>

                {/* Most Late */}
                <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                   <div className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Sering Lapor Terlambat/Dirapel</div>
                   {stats.mostLate.length > 0 ? (
                     <ul className="list-disc list-inside text-sm font-medium text-slate-700 space-y-1">
                       {stats.mostLate.map((name, i) => <li key={i}>{name}</li>)}
                     </ul>
                   ) : <span className="text-sm text-slate-400 italic">Belum ada data valid.</span>}
                </div>
             </div>
          </div>

          {}
          {/* Insight Aktivitas (Done vs Missed) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-3">
             <h2 className="text-lg font-bold text-slate-800 mb-4">Evaluasi Kuantitas Ibadah</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="flex flex-col justify-center border-r border-slate-100 pr-4">
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-orange-500">
                      <div className="text-3xl font-bold">
                        {stats.totalDone} <span className="text-sm font-semibold opacity-70">({(stats.totalDone + stats.totalMissed) > 0 ? Math.round((stats.totalDone / (stats.totalDone + stats.totalMissed)) * 100) : 0}%)</span>
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider">Dilakukan</div>
                    </div>
                    <div className="text-red-400 text-right">
                      <div className="text-3xl font-bold">
                        {stats.totalMissed} <span className="text-sm font-semibold opacity-70">({(stats.totalDone + stats.totalMissed) > 0 ? Math.round((stats.totalMissed / (stats.totalDone + stats.totalMissed)) * 100) : 0}%)</span>
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider">Terlewat</div>
                    </div>
                  </div>
                  <div className="w-full flex h-3 rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-orange-500" style={{ width: `${(stats.totalDone / (stats.totalDone + stats.totalMissed)) * 100}%` }}></div>
                    <div className="bg-red-400" style={{ width: `${(stats.totalMissed / (stats.totalDone + stats.totalMissed)) * 100}%` }}></div>
                  </div>
               </div>

               <div className="p-4 rounded-xl bg-orange-50/50 border border-orange-100/50">
                 <div className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Paling Konsisten</div>
                 {stats.mostFrequent.length > 0 && stats.maxCount > 0 ? (
                   <div><p className="font-semibold text-slate-800 text-sm">{stats.mostFrequent.join(', ')}</p></div>
                 ) : <p className="text-xs text-slate-400 italic">Data belum cukup.</p>}
               </div>
               
               <div className="p-4 rounded-xl bg-red-50/50 border border-red-100/50">
                 <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Sering Terlewat</div>
                 {stats.leastFrequent.length > 0 && stats.maxCount > 0 ? (
                   <div><p className="font-semibold text-slate-800 text-sm">{stats.leastFrequent.join(', ')}</p></div>
                 ) : <p className="text-xs text-slate-400 italic">Data belum cukup.</p>}
               </div>
             </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}