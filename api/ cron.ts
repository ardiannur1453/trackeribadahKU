// [FIXED] Menggunakan Impor Modular untuk memangkas ukuran Serverless dari 100MB menjadi ~3MB
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Inisialisasi Firebase Admin dengan Environment Variables Vercel
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel sering memecah string baris baru (\n), kita harus me-replace nya
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    }),
  });
}

const db = getFirestore();
const messaging = getMessaging();

export default async function handler(req: any, res: any) {
  // Pengaman Opsional: Verifikasi Token Cron jika diperlukan Vercel
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Peringatan: Upaya trigger cron tanpa otorisasi.');
    // Untuk tahap uji coba, kita biarkan lolos.
  }

  try {
    const now = Date.now();
    const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;
    const thresholdTime = now - THREE_DAYS_IN_MS;

    console.log("Memulai pemindaian member inaktif (Lebih dari 3 Hari)...");

    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('notifEnabled', '==', true).get();

    let countNotified = 0;
    let inactiveUsersList: string[] = [];
    const notificationPromises: Promise<any>[] = [];

    snapshot.forEach((doc) => {
      const userData = doc.data();
      const lastAct = userData.lastActivity || userData.lastLogin || 0;
      
      // Jika user sudah tidak aktif > 3 hari dan punya token
      if (lastAct < thresholdTime && userData.fcmToken) {
        inactiveUsersList.push(userData.displayName || 'Anonim');
        countNotified++;

        // 1. Tembakkan Push Notification langsung ke HP User
        const message = {
          token: userData.fcmToken,
          notification: {
            title: 'Kami Rindu Semangat Anda! 🌟',
            body: `Halo ${userData.displayName?.split(' ')[0] || 'Kak'}, sudah 3 hari komitmen ibadahmu kosong. Yuk isi sekarang agar rantai pahalamu tidak terputus!`,
          }
        };
        notificationPromises.push(messaging.send(message).catch((e: any) => console.log('Gagal kirim ke user:', e)));
        
        // 2. Suntikkan ke sistem Lonceng Dalam Aplikasi (In-App)
        notificationPromises.push(db.collection('notifications').add({
           title: 'Peringatan: Aktivitas Kosong',
           body: 'Anda telah melewati batas inaktif 3 hari. Segera perbarui laporan Anda agar Health Points (HP) tidak menurun drastis.',
           targetId: doc.id,
           senderName: 'Sistem Tafkir',
           timestamp: now
        }));
      }
    });

    // 3. Laporkan hasil pindaian kepada Para Admin via Lonceng In-App
    if (inactiveUsersList.length > 0) {
       const adminSnap = await usersRef.where('role', 'in', ['admin', 'superadmin']).get();
       
       adminSnap.forEach((adminDoc) => {
          notificationPromises.push(db.collection('notifications').add({
             title: 'Laporan Patroli: Member Pasif',
             body: `Radar mendeteksi ${inactiveUsersList.length} member telah pasif > 3 hari. Di antaranya: ${inactiveUsersList.slice(0,3).join(', ')}. Harap lakukan follow-up personal.`,
             targetId: adminDoc.id,
             senderName: 'Sistem Tafkir',
             timestamp: now
          }));
       });
    }

    await Promise.all(notificationPromises);
    res.status(200).json({ success: true, message: `Berhasil memproses ${countNotified} user inaktif.` });
  } catch (error: any) {
    console.error("Kesalahan Mesin Cron:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}