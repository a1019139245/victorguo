var VERSION = 'v8';

// 缓存
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(VERSION).then(function(cache) {
      return cache.addAll([
        './start.html',
          './page2.html',
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
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                alert(event.request)
                if (response) {
                    return response;
                }

                // 因为 event.request 流已经在 caches.match 中使用过一次，
                // 那么该流是不能再次使用的。我们只能得到它的副本，拿去使用。
                var fetchRequest = event.request.clone();

                // fetch 的通过信方式，得到 Request 对象，然后发送请求
                return fetch(fetchRequest).then(
                    function(response) {
                        // 检查是否成功
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // 如果成功，该 response 一是要拿给浏览器渲染，而是要进行缓存。
                        // 不过需要记住，由于 caches.put 使用的是文件的响应流，一旦使用，
                        // 那么返回的 response 就无法访问造成失败，所以，这里需要复制一份。
                        var responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
});
// 捕获请求并返回缓存数据
// self.addEventListener('fetch', function(event) {
//   event.respondWith(caches.match(event.request).catch(function() {
//     return fetch(event.request);
//   }).then(function(response) {
//     caches.open(VERSION).then(function(cache) {
//       cache.put(event.request, response);
//     });
//     return response.clone();
//   }).catch(function() {
//     return caches.match('./static/mm1.jpg');
//   }));
// });

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

