const firebaseConfig = {
  apiKey: "AIzaSyBYh9A6rnlE-fk59R__ZxZT6AMfMwreIJc",
  authDomain: "pwa-aqi-alert.firebaseapp.com",
  projectId: "pwa-aqi-alert",
  storageBucket: "pwa-aqi-alert.firebasestorage.app",
  messagingSenderId: "351293220998",
  appId: "1:351293220998:web:631e82ed1049c986d60907"
};
const VAPID_KEY = "BOnPd9wbT5Qnh3NvqkIv4r1NXQhbTFPE8JKejT1Hwv3j7s0rzEwGiigr5BtopQ_aNcP77NTQmmv6C-5oZddc3fc";

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

function initPushNotification(gasUrl) {
  const subscribeForm = document.getElementById('subscribeForm');
  const subscribeBtn = document.getElementById('subscribeBtn');
  const statusMsg = document.getElementById('status-msg');
  const userEmailInput = document.getElementById('userEmail');

  if (!subscribeBtn) return;

  // ฟังก์ชันหลักในการขอสิทธิ์และลงทะเบียน Token
  const handleSubscription = async (e) => {
    if (e) e.preventDefault();

    const email = userEmailInput ? userEmailInput.value.trim() : '';
    if (!email) {
      if (statusMsg) {
        statusMsg.className = 'error';
        statusMsg.textContent = 'กรุณากรอกอีเมลก่อนเปิดรับการแจ้งเตือน';
      }
      if (userEmailInput) userEmailInput.focus();
      return;
    }

    subscribeBtn.disabled = true;
    if (statusMsg) {
      statusMsg.className = '';
      statusMsg.textContent = 'กำลังขอสิทธิ์การแจ้งเตือน...';
    }

    try {
      // 1. ขอสิทธิ์แจ้งเตือนจากบราวเซอร์
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (statusMsg) {
          statusMsg.className = 'error';
          statusMsg.textContent = 'กรุณากด "อนุญาต" (Allow) การแจ้งเตือนในระบบ';
        }
        subscribeBtn.disabled = false;
        return;
      }

      if (statusMsg) statusMsg.textContent = 'กำลังลงทะเบียน Service Worker...';

      // 2. ตรวจสอบและลงทะเบียน Service Worker
      const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' });
      await navigator.serviceWorker.ready;

      if (statusMsg) statusMsg.textContent = 'กำลังขอ FCM Token...';

      // 3. ขอ FCM Token
      const currentToken = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (currentToken) {
        if (statusMsg) statusMsg.textContent = 'กำลังบันทึกลงฐานข้อมูล...';

        // 4. ส่ง Token ไปบันทึกลง Google Sheets
        await fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ token: currentToken, email: email })
        });

        if (statusMsg) {
          statusMsg.className = 'success';
          statusMsg.textContent = '✅ ลงทะเบียนสำเร็จ! เครื่องพร้อมรับการแจ้งเตือนแล้ว';
        }
        subscribeBtn.textContent = 'เปิดแจ้งเตือนแล้ว';
        if (userEmailInput) userEmailInput.disabled = true;
      } else {
        throw new Error('ไม่สามารถขอรับ FCM Token ได้');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      if (statusMsg) {
        statusMsg.className = 'error';
        statusMsg.textContent = 'ข้อผิดพลาด: ' + (err.message || err);
      }
      subscribeBtn.disabled = false;
    }
  };

  // ดักจับทั้งการ Submit ฟอร์ม และการคลิกปุ่มโดยตรง
  if (subscribeForm) {
    subscribeForm.addEventListener('submit', handleSubscription);
  }
  subscribeBtn.addEventListener('click', handleSubscription);

  // ดักจับ Foreground Notification เมื่อเปิดแอปอยู่
  messaging.onMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "🌿 รายงานคุณภาพอากาศ มหิดล";
    const body = payload.notification?.body || payload.data?.body || "";

    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body: body,
          icon: 'https://oppe-sustainability.github.io/OPPE/icon-192.png',
          badge: 'https://oppe-sustainability.github.io/OPPE/icon-192.png',
          tag: 'mahidol-aqi-daily',
          renotify: true
        });
      });
    }
  });
}

// [ใส่คืนจุดที่ตกหล่น 2]: ฟังก์ชันล้าง Token และขอใหม่กรณีเกิดปัญหา
async function fixAndResubscribe(gasUrl) {
  const statusMsg = document.getElementById('status-msg');
  const userEmailInput = document.getElementById('userEmail');
  
  if (statusMsg) {
    statusMsg.className = '';
    statusMsg.textContent = 'กำลังซ่อมแซมและเชื่อมต่อระบบใหม่...';
  }

  try {
    await messaging.deleteToken();
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (let registration of registrations) {
      await registration.unregister();
    }

    const newReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' });
    await navigator.serviceWorker.ready;

    const freshToken = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: newReg
    });

    if (freshToken) {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          token: freshToken,
          email: userEmailInput ? userEmailInput.value.trim() : "Re-subscribed User"
        })
      });

      if (statusMsg) {
        statusMsg.className = 'success';
        statusMsg.textContent = '✅ ซ่อมแซมระบบสำเร็จ! เครื่องพร้อมรับการแจ้งเตือนแล้ว';
      }
    }
  } catch (err) {
    if (statusMsg) {
      statusMsg.className = 'error';
      statusMsg.textContent = 'กรุณาแตะไอคอนรูปกุญแจ/ตั้งค่าข้าง URL เพื่อกดอนุญาตแจ้งเตือน';
    }
  }
}