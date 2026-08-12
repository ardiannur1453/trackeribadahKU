import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { Trash2, Edit3, Eye, Download, LogOut, Check, X, AlertCircle, RefreshCw } from 'lucide-react';

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyChCsY6yUMGAE4DMVXD3lHoQRCfyw4KqYA",
  authDomain: "trackeribadahku.firebaseapp.com",
  projectId: "trackeribadahku",
  storageBucket: "trackeribadahku.firebasestorage.app",
  messagingSenderId: "741356518968",
  appId: "1:741356518968:web:b918e6b470d36a29bbf0cd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

export default function IbadahTracker() {
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [currentDate] = useState(new Date());
  const [activities] = useState(DEFAULT_ACTIVITIES);
  const [records, setRecords] = useState<any>({});
  const [journals, setJournals] = useState<any[]>([]);
  
  const [toast, setToast] = useState('');
  const [activeJournal, setActiveJournal] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [journalInput, setJournalInput] = useState({ title: '', content: '' });
  
  const [clearScope, setClearScope] = useState<'day' | 'week' | 'month'>('day');
  
  const chartRef = useRef<HTMLDivElement>(null);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.records) setRecords(data.records);
            if (data.journals) setJournals(data.journals);
          }
          setDataLoaded(true);
        } catch (error) {
          console.error(error);
          setDataLoaded(true);
        }
      };
      fetchData();
    }
  }, [user]);

  // Save Data
  useEffect(() => {
    if (user && dataLoaded) {
      const timer = setTimeout(() => {
        setDoc(doc(db, 'users', user.uid), { records, journals }, { merge: true });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [records, journals, user, dataLoaded]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  };
  const days = getDaysInMonth(currentDate);

  // LOGIC: Check & Timestamp dengan Blokir 1 Menit
  const handleRecord = (day: Date, actId: number, actTime: string, currentStatus: string | undefined) => {
    const now = new Date();
    const [hours, minutes] = actTime.split(':').map(Number);
    const targetTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
    
    // Blokir jika sebelum waktunya + 1 menit
    const unlockTime = new Date(targetTime.getTime() + 60000); 
    if (now < unlockTime) {
      showToast(`Belum waktunya! Laporan dibuka pukul ${unlockTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
      return;
    }

    const key = `${day.toISOString().split('T')[0]}-${actId}`;
    let newStatus = 'done';
    if (currentStatus === 'done') newStatus = 'missed';
    if (currentStatus === 'missed') newStatus = 'none';

    if (newStatus === 'none') {
      const newRecs = { ...records };
      delete newRecs[key];
      setRecords(newRecs);
    } else {
      setRecords({
        ...records,
        [key]: {
          status: newStatus,
          timestamp: now.getTime(),
          actualDay: now.toISOString().split('T')[0] // Mencatat hari riil saat ditekan
        }
      });
    }
  };

  // LOGIC: Clear Data dengan Tombol Update
  const executeClearData = () => {
    const newRecords = { ...records };
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    Object.keys(newRecords).forEach(key => {
      const recDateStr = key.split('-').slice(0, 3).join('-');
      const recDate = new Date(recDateStr);
      
      if (clearScope === 'day' && recDateStr === todayStr) {
        delete newRecords[key];
      } else if (clearScope === 'month' && recDateStr.startsWith(todayStr.substring(0, 7))) {
        delete newRecords[key];
      } else if (clearScope === 'week') {
        const diff = Math.floor((today.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24));
        // Reset jika dalam rentang 7 hari ke belakang
        if (diff >= 0 && diff <= 7) {
          delete newRecords[key];
        }
      }
    });
    setRecords(newRecords);
    showToast(`Data ${clearScope === 'day' ? 'Harian' : clearScope === 'week' ? 'Mingguan' : 'Bulanan'} berhasil direset!`);
  };

  // LOGIC: Journaling
  const saveJournal = () => {
    if (!journalInput.title) return showToast("Judul jurnal tidak boleh kosong");
    const newJ = {
      id: activeJournal ? activeJournal.id : Date.now(),
      title: journalInput.title,
      content: journalInput.content,
      date: new Date().toISOString()
    };
    if (activeJournal) {
      setJournals(journals.map(j => j.id === activeJournal.id ? newJ : j));
    } else {
      setJournals([newJ, ...journals]);
    }
    setJournalInput({ title: '', content: '' });
    setActiveJournal(null);
    showToast("Jurnal berhasil disimpan!");
  };

  const exportChart = async () => {
    if (chartRef.current) {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `Tafkir-Stats-${new Date().toISOString().split('T')[0]}.jpg`;
      link.href = canvas.toDataURL('image/jpeg');
      link.click();
    }
  };

  // Kalkulasi Statistik
  const calcStats = () => {
    let totalDone = 0;
    let totalMissed = 0;
    
    // Analisis Kedisiplinan Waktu (Tepat vs Terlambat)
    const timeStats: Record<number, { onTime: number, totalValid: number }> = {};
    activities.forEach(a => timeStats[a.id] = { onTime: 0, totalValid: 0 });

    Object.entries(records).forEach(([key, val]: [string, any]) => {
      if (val.status === 'done') totalDone++;
      if (val.status === 'missed') totalMissed++;

      if (val.status === 'done' || val.status === 'missed') {
        const [y, m, d, actId] = key.split('-');
        const activityId = parseInt(actId);
        const recordDateStr = `${y}-${m}-${d}`;
        const activity = activities.find(a => a.id === activityId);
        
        if (activity) {
          timeStats[activityId].totalValid++;
          // Cek Tepat Waktu: Tanggal isi harus sama dengan tanggal jadwal, dan maksimal lewat 1 jam
          if (val.actualDay === recordDateStr) {
            const [h, min] = activity.time.split(':').map(Number);
            const targetTime = new Date(parseInt(y), parseInt(m)-1, parseInt(d), h, min).getTime();
            const timeDiffHours = (val.timestamp - targetTime) / (1000 * 60 * 60);
            
            if (timeDiffHours <= 1 && timeDiffHours >= -2) { // Tepat waktu (max 1 jam setelah, 2 jam sebelum)
              timeStats[activityId].onTime++;
            }
          }
        }
      }
    });

    const totalFilled = totalDone + totalMissed;
    const donePercent = totalFilled ? Math.round((totalDone / totalFilled) * 100) : 0;
    const missedPercent = totalFilled ? Math.round((totalMissed / totalFilled) * 100) : 0;

    return { totalDone, totalMissed, donePercent, missedPercent, timeStats };
  };

  const stats = calcStats();

  if (isInitializing) return <div className="min-h-screen bg-[#111] flex items-center justify-center text-orange-500">Memuat Sistem Tafkir...</div>;

  // --- HALAMAN LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center p-4">
        <div className="bg-white/5 border border-orange-500/30 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative overflow-hidden">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="w-20 h-20 mx-auto mb-6 bg-black rounded-full border border-orange-500 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.5)]">
             <span className="text-orange-500 font-bold text-2xl">TC</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tafkir Corp</h1>
          <p className="text-orange-500 text-xs tracking-widest uppercase mb-8">Elevate The Level of Thinking</p>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-orange-500/30">
            Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  if (!dataLoaded) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-orange-500 font-bold">Menarik Data dari Brankas Server...</div>;

  // --- HALAMAN UTAMA (TEMA TERANG/SLATE-50) ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-2xl font-medium flex items-center gap-2 border-l-4 border-orange-500 animate-bounce">
          <AlertCircle size={20} className="text-orange-500" /> {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Identitas Tafkir */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-900 rounded-full border-2 border-orange-500 flex items-center justify-center shadow-md">
               <span className="text-orange-500 font-bold text-xl">TC</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-wide">Tafkir Corp</h1>
              <p className="text-xs text-orange-600 font-bold uppercase tracking-[0.2em] mt-1">Elevate The Level of Thinking</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
             <div className="text-right hidden sm:block">
               <div className="text-sm font-semibold text-slate-800">{user.displayName}</div>
               <div className="text-xs text-slate-500">Tersinkronisasi Cloud</div>
             </div>
             <button onClick={() => signOut(auth)} className="ml-2 bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-1">
               <LogOut size={16}/> Keluar
             </button>
          </div>
        </div>

        {/* Tabel Aktivitas (Desain Terbaca & Lengkap) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
             <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                Tabel Pelaporan Harian
             </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="text-left text-slate-700 font-bold p-4 sticky left-0 bg-slate-100 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[150px]">Aktivitas</th>
                  {days.map(d => (
                    <th key={d.toISOString()} className="p-3 text-center font-semibold text-slate-600 min-w-[40px]">{d.getDate()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map((act, idx) => (
                  <tr key={act.id} className={idx % 2 === 0 ? 'bg-white hover:bg-orange-50/50' : 'bg-slate-50 hover:bg-orange-50/50'}>
                    <td className="p-4 font-medium text-slate-800 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100" style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      {act.name} <span className="text-xs text-orange-600 font-bold ml-2 bg-orange-100 px-2 py-0.5 rounded">{act.time}</span>
                    </td>
                    {days.map(d => {
                      const key = `${d.toISOString().split('T')[0]}-${act.id}`;
                      const rec = records[key];
                      return (
                        <td key={key} className="p-2 text-center relative group cursor-pointer border-r border-slate-100/50" onClick={() => handleRecord(d, act.id, act.time, rec?.status)}>
                          {rec?.status === 'done' ? (
                             <div className="w-7 h-7 mx-auto bg-green-100 rounded flex items-center justify-center border border-green-200"><Check className="text-green-600" size={16} /></div>
                          ) : rec?.status === 'missed' ? (
                             <div className="w-7 h-7 mx-auto bg-red-100 rounded flex items-center justify-center border border-red-200"><X className="text-red-600" size={16} /></div>
                          ) : (
                             <div className="w-7 h-7 mx-auto rounded bg-slate-100 border border-slate-200 hover:border-orange-300 transition-colors" />
                          )}
                          
                          {/* Tooltip Pintar */}
                          {rec && (
                            <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl w-max z-30 pointer-events-none">
                              <p className="font-semibold border-b border-slate-700 pb-1 mb-1">{act.name} ({d.getDate()}/{d.getMonth()+1})</p>
                              <p className="text-slate-300">Waktu Isi: {new Date(rec.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                              <p className="mt-1">
                                Status: {rec.actualDay === d.toISOString().split('T')[0] 
                                  ? <span className="text-green-400 font-bold tracking-wide">TEPAT HARI</span> 
                                  : <span className="text-red-400 font-bold tracking-wide">RAPELAN</span>}
                              </p>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Panel Clear Data Terintegrasi */}
          <div className="bg-slate-100 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-4 text-sm font-medium text-slate-700">
               <span className="flex items-center gap-2"><Trash2 size={16} className="text-slate-400"/> Hapus Data:</span>
               <label className="flex items-center gap-1 cursor-pointer hover:text-orange-600"><input type="radio" name="clearScope" checked={clearScope === 'day'} onChange={() => setClearScope('day')} className="accent-orange-600" /> Harian</label>
               <label className="flex items-center gap-1 cursor-pointer hover:text-orange-600"><input type="radio" name="clearScope" checked={clearScope === 'week'} onChange={() => setClearScope('week')} className="accent-orange-600" /> Mingguan</label>
               <label className="flex items-center gap-1 cursor-pointer hover:text-orange-600"><input type="radio" name="clearScope" checked={clearScope === 'month'} onChange={() => setClearScope('month')} className="accent-orange-600" /> Bulanan</label>
             </div>
             <button onClick={executeClearData} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors">
               <RefreshCw size={16} /> Update (Eksekusi Hapus)
             </button>
          </div>
        </div>

        {/* Manajemen Jurnal Pop-up */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span> Arsip Jurnal
            </h3>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2">
              {journals.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Belum ada jurnal tersimpan.</p> : journals.map(j => (
                <div key={j.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-start group hover:border-orange-300 transition-colors">
                  <div className="truncate pr-2">
                    <p className="font-bold text-slate-700 truncate">{j.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(j.date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
                  </div>
                  <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setActiveJournal(j); setIsViewModalOpen(true); }} className="p-1 hover:bg-slate-200 rounded text-blue-600"><Eye size={16} /></button>
                    <button onClick={() => { setActiveJournal(j); setJournalInput({title: j.title, content: j.content}); setIsViewModalOpen(false); }} className="p-1 hover:bg-slate-200 rounded text-orange-600"><Edit3 size={16} /></button>
                    <button onClick={() => setJournals(journals.filter(x => x.id !== j.id))} className="p-1 hover:bg-slate-200 rounded text-red-600"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span> {activeJournal && !isViewModalOpen ? 'Edit Jurnal' : 'Tulis Jurnal Baru'}
            </h3>
            <input type="text" placeholder="Judul Jurnal / Catatan..." value={journalInput.title} onChange={e => setJournalInput({...journalInput, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-slate-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all font-medium" />
            <textarea placeholder="Tuliskan evaluasi, syukur, atau doa Anda hari ini..." value={journalInput.content} onChange={e => setJournalInput({...journalInput, content: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 h-40 text-slate-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all resize-none mb-4" />
            <div className="flex justify-end">
               <button onClick={saveJournal} className="bg-orange-600 text-white px-6 py-2.5 rounded-xl hover:bg-orange-700 font-bold shadow-md shadow-orange-500/20 transition-all">Simpan Jurnal</button>
            </div>
          </div>
        </div>

        {/* Modal View Jurnal */}
        {isViewModalOpen && activeJournal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative">
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
              <h2 className="text-2xl font-bold text-slate-800 mb-2 pr-10">{activeJournal.title}</h2>
              <p className="text-sm text-orange-600 font-medium mb-6">{new Date(activeJournal.date).toLocaleString('id-ID', {weekday: 'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'})}</p>
              <div className="whitespace-pre-wrap text-slate-700 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-[60vh] overflow-y-auto">{activeJournal.content}</div>
            </div>
          </div>
        )}

        {/* Area Analisa & Ekspor (Khusus Area Ini yang Diekspor) */}
        <div ref={chartRef} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 relative">
          <button onClick={exportChart} className="absolute top-8 right-8 flex items-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-600 px-4 py-2 rounded-xl text-sm font-bold border border-orange-200 transition-colors">
            <Download size={16} /> Ekspor Laporan JPG
          </button>
          
          <h2 className="text-xl font-bold text-slate-800 mb-8 border-l-4 border-orange-500 pl-4">Analisa Kuantitas & Kedisiplinan</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Box Kuantitas */}
             <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <h3 className="text-slate-700 font-bold mb-6 text-center">Evaluasi Kuantitas Ibadah</h3>
                
                <div className="space-y-6">
                   <div>
                     <div className="flex justify-between text-sm font-semibold mb-2 text-slate-600">
                        <span>Terlaksana ({stats.totalDone}x)</span>
                        <span className="text-green-600">{stats.donePercent}%</span>
                     </div>
                     <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: `${stats.donePercent}%` }}></div>
                     </div>
                   </div>

                   <div>
                     <div className="flex justify-between text-sm font-semibold mb-2 text-slate-600">
                        <span>Terlewat/Bolong ({stats.totalMissed}x)</span>
                        <span className="text-red-500">{stats.missedPercent}%</span>
                     </div>
                     <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full transition-all duration-1000" style={{ width: `${stats.missedPercent}%` }}></div>
                     </div>
                   </div>
                </div>
             </div>

             {/* Box Kedisiplinan */}
             <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <h3 className="text-slate-700 font-bold mb-4 text-center">Disiplin Lapor Sesuai Waktu (Tanpa Rapel)</h3>
                <p className="text-xs text-slate-500 text-center mb-6">Persentase pelaporan Tepat Waktu (Max 1 jam setelah aktivitas)</p>
                
                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                   {activities.map(act => {
                      const stat = stats.timeStats[act.id];
                      // Menampilkan jika minimal ada 1 data laporan valid
                      if (stat.totalValid === 0) return null;
                      
                      const onTimePercent = Math.round((stat.onTime / stat.totalValid) * 100);
                      
                      return (
                         <div key={act.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                            <span className="text-sm font-medium text-slate-700">{act.name}</span>
                            <div className="flex items-center gap-3">
                               <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${onTimePercent >= 80 ? 'bg-green-500' : onTimePercent >= 50 ? 'bg-orange-400' : 'bg-red-500'}`} style={{ width: `${onTimePercent}%` }}></div>
                               </div>
                               <span className={`text-sm font-bold min-w-[40px] text-right ${onTimePercent >= 80 ? 'text-green-600' : onTimePercent >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                                  {onTimePercent}%
                               </span>
                            </div>
                         </div>
                      );
                   })}
                   {activities.every(a => stats.timeStats[a.id].totalValid === 0) && (
                      <div className="text-center py-6 text-slate-400 text-sm italic border-2 border-dashed border-slate-200 rounded-xl">
                         Belum ada aktivitas yang dilaporkan secara valid.
                      </div>
                   )}
                </div>
             </div>
          </div>
          <div className="mt-8 pt-4 border-t border-slate-100 text-center">
             <span className="text-orange-500 font-bold tracking-widest text-xs uppercase opacity-50">Tafkir Corp Internal System</span>
          </div>
        </div>

      </div>
    </div>
  );
}