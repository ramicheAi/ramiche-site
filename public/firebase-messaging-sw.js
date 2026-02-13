/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker
// This file MUST live at the root of the public directory

importScripts("https://www.gstatic.com/firebasejs/11.3.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.3.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCM-bxw5yIdrLYeAZ1PfUmnoy-9tBBhiVY",
  authDomain: "apex-athlete-73755.firebaseapp.com",
  projectId: "apex-athlete-73755",
  storageBucket: "apex-athlete-73755.firebasestorage.app",
  messagingSenderId: "840367715029",
  appId: "1:840367715029:web:ad98e8de737958fa76285c",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const notificationTitle = title || "Apex Athlete";
  const notificationOptions = {
    body: body || "New update available",
    icon: icon || "/apex-icon.png",
    badge: "/apex-badge.png",
    tag: "apex-notification",
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/apex-athlete";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/apex-athlete") && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
