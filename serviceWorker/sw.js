'use strict';

const version = 'gt_v13';
const __DEVELOPMENT__ = false;
const __DEBUG__ = true;
const offlineResources = [
    './',
    './offline.html',
    './jquery.min.js',
    './all.png'
];

const ignoreCache = [
    /https?:\/\/hm.baidu.com\//,
    /https?:\/\/cdn.bootcss.com\//,
    /https?:\/\/static.duoshuo.com\//,
    /https?:\/\/www.google-analytics.com\//,
    /https?:\/\/dn-lbstatics.qbox.me\//,
    /https?:\/\/ajax.cloudflare.com\//,
    /https?:\/\/cdn1.lncld.net\//,
    /https?:\/\/api.leancloud.cn\//,
    /https?:\/\/lzw.me\/wp\-admin/
];

// 慎重使用全局可变变量，因为 serviceWork 不可控的停止和重启，会导致它们的取值在后续读取时无法预测
let port;


/**
 * common function
 */

function developmentMode() {
    return __DEVELOPMENT__ || __DEBUG__;
}

function cacheKey() {
    return [version, ...arguments].join(':');
}

function log() {
    if (developmentMode()) {
        console.log("SW:", ...arguments);
    }
}

// 不需要缓存的请求
function shouldAlwaysFetch(request) {
    return __DEVELOPMENT__ ||
        request.method !== 'GET' ||
        ignoreCache.some(regex => request.url.match(regex));
}

// 缓存 html 页面
function shouldFetchAndCache(request) {
    return (/text\/html/i).test(request.headers.get('Accept'));
}

// 发送 Notification 通知
function sendNotify(title, options, event) {
    if (Notification.permission !== 'granted') {
        log('Not granted Notification permission.');

        // 无授权时，向来源页面申请授权
        if (port && port.postMessage) {
            port.postMessage({
                type: 'applyNotify',
                info: {title, options}
            });
        }

        return;
    }

    const notificationPromise = self.registration.showNotification(title || 'Hi：', Object.assign({
        body: '这是一个通知示例',
        icon: '//lzw.me/images/avatar/lzwme-80x80.png',
        tag: 'push'
    }, options));

    return event && event.waitUntil(notificationPromise);
}

/**
 * onClickNotify
 */

function onClickNotify(event) {
    event.notification.close();
    const url = "https://lzw.me";

    event.waitUntil(
        self.clients.matchAll({
            type: "window"
        })
            .then(() => {
                if (self.clients.openWindow) {
                    return self.clients.openWindow(url);
                }
            })
    );
}


// const notification = new Notification("Hi，网络不给力哟", {
//     body: '您的网络貌似离线了,可访问部分网页',
//     icon: './image/all.png'
// });
// notification.onclick = function () {
//     notification.close();
// };
/**
 * Install 安装
 */
self.addEventListener('install', onInstall);

function onInstall(event) {
    log('install event in progress.');
    event.waitUntil(
        caches.open(cacheKey('offline'))
            .then(cache => cache.addAll(offlineResources)) //添加需要缓存的静态资源
            .then(() => log('installation complete! version: ' + version))
            .then(() => self.skipWaiting())
    );
}

/**
 * Fetch
 */

// 当网络离线或请求发生了错误，使用离线资源替代 request 请求
function offlineResponse(request) {
    log('(offline)', request.method, request.url);
    if (request.url.match(/\.(jpg|png|gif|svg|jpeg)(\?.*)?$/)) {
        return caches.match('/wp-content/themes/Kratos/images/default.jpg');
    } else {
        return caches.match('./offline.html');
    }
}

// 从缓存读取或使用离线资源替代
function cachedOrOffline(request) {
    return caches
        .match(request)
        .then((response) => response || offlineResponse(request));
}

// 从网络请求，并将请求成功的资源缓存
function networkedAndCache(request) {
    return fetch(request)
        .then(response => {
            const copy = response.clone();

            caches.open(cacheKey('resources'))
                .then(cache => {
                    cache.put(request, copy);
                });

            log("(network: cache write)", request.method, request.url);
            return response;
        });
}

// 优先从 cache 读取，读取失败则从网络请求并缓存。网络请求也失败，则使用离线资源替代
function cachedOrNetworked(request) {
    return caches.match(request)
        .then((response) => {
            log(response ? '(cached)' : '(network: cache miss)', request.method, request.url);
            return response ||
                networkedAndCache(request)
                    .catch(() => offlineResponse(request));
        });
}

// 优先从网络请求，失败则使用离线资源替代
function networkedOrOffline(request) {
    return fetch(request)
        .then(response => {
            log('(network)', request.method, request.url);
            return response;
        })
        .catch(() => offlineResponse(request));
}

function onFetch(event) {
    const request = event.request;
    // 应当永远从网络请求的资源
    // 如果请求失败，则使用离线资源替代
    if (shouldAlwaysFetch(request)) {
        console.log('fetch2', request)
        log('AlwaysFetch request: ', event.request.url);
        event.respondWith(networkedOrOffline(request));
        return;
    }

    // 应当从网络请求并缓存的资源
    // 如果请求失败，则尝试从缓存读取，读取失败则使用离线资源替代
    if (shouldFetchAndCache(request)) {
        event.respondWith(
            networkedAndCache(request).catch(() => cachedOrOffline(request))
        );
        return;
    }

    event.respondWith(cachedOrNetworked(request));
}

/**
 * Activate
 */

function removeOldCache() {
    return caches
        .keys()
        .then(keys =>
            Promise.all( // 等待所有旧的资源都清理完成
                keys
                    .filter(key => !key.startsWith(version)) // 过滤不需要删除的资源
                    .map(key => {
                        console.log('缓存', caches)
                        caches.delete(key)
                    }) // 删除旧版本资源，返回为 Promise 对象
            )
        )
        .then(() => {
            log('removeOldCache completed.');
        });
}

function onActivate(event) {
    log('activate event in progress.');
    event.waitUntil(Promise.all([
        // 更新客户端
        self.clients.claim(),
        removeOldCache()
    ]))
}

/**
 * onPush
 */

function onPush(event) {
    log('onPush ', event);
    sendNotify('Hi:', {
        body: `【${new Date()}】发生了一次 Push 同步事件 ~`
    }, event);
}


/**
 * onSync
 */

function onSync(event) {
    log('onSync', event);
    sendNotify('Hi:', {
        body: `【${new Date()}】发生了一次 Sync 同步事件 ~`
    }, event);
}

/**
 * onMessage
 */

function onMessage(event) {
    log('onMessage', event);

    if (event.ports) {
        port = event.ports[0];
    }

    if (!event.data) {
        return;
    }

    // 如果是要求一条通知，则发送
    if (event.data.type === 'notify') {
        const {title, options} = event.data.info || {};
        sendNotify(title, options, event);
    }
}

log("Hello from ServiceWorker land!", version);

self.addEventListener('install', onInstall);
self.addEventListener('fetch', onFetch);
self.addEventListener("activate", onActivate);
self.addEventListener("push", onPush);
self.addEventListener("sync", onSync);
self.addEventListener('message', onMessage);
self.addEventListener("notificationclick", onClickNotify);
//
// window.addEventListener('beforeinstallprompt', function(event) {
//     // 阻止该行为，只需要返回 false
//     // event.preventDefault();
//     // deferredPrompt = event;
//     // return false;
//     // 统计用户的选择
//     event.userChoice.then(function(choiceResult) {
//         console.log(choiceResult.outcome); // 为 dismissed 或 accepted
//         if(choiceResult.outcome === 'dismissed') {
//             alert('quxiao')
//             console.log('User cancelled home screen install');
//         } else {
//             alert('tianjia')
//             console.log('User added to home screen');
//         }
//     });
// });

