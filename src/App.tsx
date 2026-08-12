import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { Trash2, Edit3, Eye, Download, LogOut, Check, X, AlertCircle } from 'lucide-react';

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
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities] = useState(DEFAULT_ACTIVITIES);
  const [records, setRecords] = useState<any>({});
  const [journals, setJournals] = useState<any[]>([]);
  
  const [toast, setToast] = useState('');
  const [activeJournal, setActiveJournal] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [journalInput, setJournalInput] = useState({ title: '', content: '' });
  
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

  // LOGIC: Check & Timestamp
  const handleRecord = (day: Date, actId: number, actTime: string, currentStatus: string | undefined) => {
    const now = new Date();
    const [hours, minutes] = actTime.split(':').map(Number);
    const targetTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
    
    // Blokir jika sebelum waktunya + 1 menit
    const unlockTime = new Date(targetTime.getTime() + 60000); 
    if (now < unlockTime) {
      showToast(`Belum waktunya! Aktivitas ini baru bisa dilaporkan setelah ${unlockTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
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
          actualDay: now.toISOString().split('T')[0]
        }
      });
    }
  };

  // LOGIC: Clear Data
  const clearData = (type: 'day' | 'week' | 'month') => {
    const newRecords = { ...records };
    const todayStr = new Date().toISOString().split('T')[0];
    
    Object.keys(newRecords).forEach(key => {
      const recDate = key.split('-').slice(0, 3).join('-');
      if (type === 'day' && recDate === todayStr) delete newRecords[key];
      if (type === 'month' && recDate.startsWith(todayStr.substring(0, 7))) delete newRecords[key];
      // simplified week logic for brevity
    });
    setRecords(newRecords);
    showToast(`Data ${type} berhasil direset!`);
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
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#111' });
      const link = document.createElement('a');
      link.download = `Tafkir-Stats-${new Date().toISOString().split('T')[0]}.jpg`;
      link.href = canvas.toDataURL('image/jpeg');
      link.click();
    }
  };

  if (isInitializing) return <div className="min-h-screen bg-[#111] flex items-center justify-center text-orange-500">Memuat Sistem Tafkir...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center p-4">
        <div className="bg-white/5 border border-orange-500/30 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-black rounded-full border border-orange-500 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.5)]">
             <span className="text-orange-500 font-bold text-2xl">TC</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tafkir Corp</h1>
          <p className="text-orange-500 text-xs tracking-widest uppercase mb-8">Elevate The Level of Thinking</p>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all">
            Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  if (!dataLoaded) return <div className="min-h-screen bg-[#111] flex items-center justify-center text-orange-500">Menarik Data dari Server...</div>;

  return (
    <div className="min-h-screen bg-[#111] text-slate-200 font-sans p-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl font-bold flex items-center gap-2">
          <AlertCircle size={20} /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-black/50 border border-orange-500/30 rounded-2xl p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Tafkir Corp Tracker</h1>
            <p className="text-orange-500 text-xs tracking-widest uppercase">Elevate The Level of Thinking</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:block">{user.displayName}</span>
            <button onClick={() => signOut(auth)} className="text-red-400 hover:text-red-300"><LogOut size={20} /></button>
          </div>
        </div>

        {/* Tabel */}
        <div className="bg-black/50 border border-orange-500/20 rounded-2xl p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-orange-500 p-2 border-b border-orange-500/20">Aktivitas</th>
                {days.map(d => (
                  <th key={d.toISOString()} className="p-2 border-b border-orange-500/20 text-center">{d.getDate()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map(act => (
                <tr key={act.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-2 font-medium">{act.name} <span className="text-xs text-slate-500 block">{act.time}</span></td>
                  {days.map(d => {
                    const key = `${d.toISOString().split('T')[0]}-${act.id}`;
                    const rec = records[key];
                    return (
                      <td key={key} className="p-2 text-center relative group cursor-pointer" onClick={() => handleRecord(d, act.id, act.time, rec?.status)}>
                        {rec?.status === 'done' ? <Check className="mx-auto text-orange-500" size={18} /> : rec?.status === 'missed' ? <X className="mx-auto text-red-500" size={18} /> : <div className="w-4 h-4 mx-auto rounded-full bg-white/10" />}
                        {rec && (
                          <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-xs p-2 rounded w-max z-10 border border-orange-500/30">
                            Diisi: {new Date(rec.timestamp).toLocaleString()}<br/>
                            Status: {rec.actualDay === d.toISOString().split('T')[0] ? <span className="text-orange-400">Tepat Hari</span> : <span className="text-red-400">Rapelan/Beda Hari</span>}
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

        {/* Clear Data Panel */}
        <div className="bg-black/50 border border-orange-500/20 rounded-2xl p-4 flex justify-center gap-4">
          <button onClick={() => clearData('day')} className="px-4 py-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 text-sm">Reset Hari Ini</button>
          <button onClick={() => clearData('month')} className="px-4 py-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 text-sm">Reset Bulan Ini</button>
        </div>

        {/* Jurnal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-black/50 border border-orange-500/20 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-orange-500 mb-4">Arsip Jurnal</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {journals.map(j => (
                <div key={j.id} className="bg-white/5 p-3 rounded-lg border border-white/10 flex justify-between items-center group">
                  <div className="truncate pr-2">
                    <p className="font-medium truncate">{j.title}</p>
                    <p className="text-xs text-slate-500">{new Date(j.date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setActiveJournal(j); setIsViewModalOpen(true); }}><Eye size={16} className="text-blue-400" /></button>
                    <button onClick={() => { setActiveJournal(j); setJournalInput({title: j.title, content: j.content}); setIsViewModalOpen(false); }}><Edit3 size={16} className="text-orange-400" /></button>
                    <button onClick={() => setJournals(journals.filter(x => x.id !== j.id))}><Trash2 size={16} className="text-red-400" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 bg-black/50 border border-orange-500/20 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-orange-500 mb-4">{activeJournal && !isViewModalOpen ? 'Edit Jurnal' : 'Tulis Jurnal Baru'}</h3>
            <input type="text" placeholder="Judul..." value={journalInput.title} onChange={e => setJournalInput({...journalInput, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 mb-4 text-white focus:border-orange-500 outline-none" />
            <textarea placeholder="Tulis catatan atau doa hari ini..." value={journalInput.content} onChange={e => setJournalInput({...journalInput, content: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 h-32 text-white focus:border-orange-500 outline-none mb-4" />
            <button onClick={saveJournal} className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-500 font-medium">Simpan Jurnal</button>
          </div>
        </div>

        {/* Modal View Jurnal */}
        {isViewModalOpen && activeJournal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-orange-500 rounded-2xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-orange-500">{activeJournal.title}</h2>
                <button onClick={() => setIsViewModalOpen(false)}><X size={24} className="text-slate-400 hover:text-white" /></button>
              </div>
              <p className="text-sm text-slate-500 mb-6">{new Date(activeJournal.date).toLocaleString()}</p>
              <div className="whitespace-pre-wrap text-slate-300">{activeJournal.content}</div>
            </div>
          </div>
        )}

        {/* Grafik & Analisa */}
        <div ref={chartRef} className="bg-black border border-orange-500/30 rounded-2xl p-8 relative">
          <button onClick={exportChart} className="absolute top-8 right-8 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg text-sm hover:bg-white/20 text-orange-400 border border-orange-500/50">
            <Download size={16} /> Ekspor JPG
          </button>
          <h2 className="text-xl font-bold text-white mb-8 border-l-4 border-orange-500 pl-4">Analisa & Statistik</h2>
          
          <div className="h-64 w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[{name: 'Awal', progress: 0}, {name: 'Pertengahan', progress: 50}, {name: 'Akhir', progress: 100}]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <RechartsTooltip contentStyle={{backgroundColor: '#000', borderColor: '#f97316'}} />
                <Line type="monotone" dataKey="progress" stroke="#f97316" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-slate-500 text-sm">Grafik visualisasi data (Simulasi Dummy. Data asli akan dihitung seiring pengisian tabel).</p>
        </div>

      </div>
    </div>
  );
}