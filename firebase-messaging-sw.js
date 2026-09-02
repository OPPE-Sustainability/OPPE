importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBYh9A6rnlE-fk59R__ZxZT6AMfMwreIJc",
  authDomain: "pwa-aqi-alert.firebaseapp.com",
  projectId: "pwa-aqi-alert",
  storageBucket: "pwa-aqi-alert.firebasestorage.app",
  messagingSenderId: "351293220998",
  appId: "1:351293220998:web:631e82ed1049c986d60907"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// รับข้อความ Background จาก Firebase และใส่ tag ป้องกันการเด้งซ้อน
// ใน firebase-messaging-sw.js
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "🌿 รายงานคุณภาพอากาศ มหิดล";
  const options = {
    body: payload.notification?.body || payload.data?.body || "อัปเดตข้อมูลคุณภาพอากาศล่าสุด",
    icon: 'https://cosin789.github.io/PWA_AQI_ALERT/Icon_PWA.png',
    badge: 'https://cosin789.github.io/PWA_AQI_ALERT/icon-192.png',
    tag: 'mahidol-aqi-daily', // 👈 ปรับให้ตรงกัน
    renotify: true,
    data: {
      url: payload.data?.url || 'https://cosin789.github.io/PWA_AQI_ALERT/'
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || 'https://cosin789.github.io/PWA_AQI_ALERT/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});