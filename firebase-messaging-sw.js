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

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "🌿 รายงานคุณภาพอากาศ มหิดล";
  const options = {
    body: payload.notification?.body || payload.data?.body || "อัปเดตข้อมูลคุณภาพอากาศล่าสุด",
    icon: 'https://oppe-sustainability.github.io/OPPE/icon-192.png',
    badge: 'https://oppe-sustainability.github.io/OPPE/icon-192.png',
    tag: 'mahidol-aqi-daily',
    renotify: true,
    data: {
      url: payload.data?.url || 'https://oppe-sustainability.github.io/OPPE/'
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || 'https://oppe-sustainability.github.io/OPPE/';

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