var VERSION = 'v7';

// 缓存
self.addEventListener('install', function(event) {
  event.waitUntil(
      // 安装阶段跳过等待，直接进入 active
      self.skipWaiting()
    caches.open(VERSION).then(function(cache) {
      return cache.addAll([
        './start.html',
        './static/jquery.min.js',
        './static/mm1.jpg'
      ]);
    })
  );
});

// 缓存更新
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // 如果当前版本和缓存版本不一致
          if (cacheName !== VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 捕获请求并返回缓存数据
self.addEventListener('fetch', function(event) {
  event.respondWith(caches.match(event.request).catch(function() {
    return fetch(event.request);
  }).then(function(response) {
    caches.open(VERSION).then(function(cache) {
      cache.put(event.request, response);
    });
    return response.clone();
  }).catch(function() {
    return caches.match('./static/mm1.jpg');
  }));
});

self.addEventListener('offline', function () {
    Notification.requestPermission().then(function(grant) {
        if (grant !== 'granted') {
            return;
        }
    const notification = new Notification("Hi，网络不给力哟", {
        body: '您的网络貌似离线',
        icon: '//lzw.me/images/avatar/lzwme-80x80.png'
    })
    notification.onclick = function () {
        notification.close();
    }
    })
});

