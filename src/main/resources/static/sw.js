/**
 * Service Worker — 건담 목록 PWA
 *
 * 전략:
 *  - 정적 자산(CSS/JS/벤더/파비콘): Cache-first (설치 시 사전 캐시 + 런타임 캐시)
 *  - 제품 API (/api/products/**): Network-first (온라인일 때 최신 데이터, 오프라인 시 캐시)
 *  - 페이지 / 그 외: Network-first
 *
 * Context-path 대응:
 *  sw.js 위치로부터 BASE 경로를 추출하여 모든 경로 비교에 사용.
 *  예) 컨텍스트 경로 /app 이면 BASE = '/app', 루트이면 BASE = ''
 */

const CACHE_NAME = 'gunpla-v1';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');

const PRECACHE_ASSETS = [
    BASE + '/',
    BASE + '/css/common.css',
    BASE + '/css/user.css',
    BASE + '/vendor/ag-grid/ag-grid.min.css',
    BASE + '/vendor/ag-grid/ag-theme-alpine.min.css',
    BASE + '/vendor/ag-grid/ag-grid-community.min.js',
    BASE + '/vendor/font-awesome/css/all.min.css',
];

// 설치: 핵심 정적 자산 사전 캐시
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting()),
    );
});

// 활성화: 이전 버전 캐시 삭제
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
            ))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // 동일 출처 GET 요청만 처리
    if (url.origin !== self.location.origin || request.method !== 'GET') return;

    const path = url.pathname;

    if (path.startsWith(BASE + '/api/products')) {
        event.respondWith(networkFirst(request));
        return;
    }

    if (isStaticAsset(path)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    event.respondWith(networkFirst(request));
});

function isStaticAsset(path) {
    return path.startsWith(BASE + '/css/')
        || path.startsWith(BASE + '/js/')
        || path.startsWith(BASE + '/vendor/')
        || path.startsWith(BASE + '/favicon/');
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}
