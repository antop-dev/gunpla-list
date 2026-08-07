/**
 * Service Worker Kill Switch — 과거(2026-07-10~08-03) PWA 서비스워커가
 * 아직 등록되어 있는 브라우저를 정리하기 위한 스크립트.
 * 신규 방문자는 서비스워커 등록 코드가 이미 제거되어 이 파일을 요청하지 않음.
 * 캐시를 모두 지우고 스스로 등록 해제한 뒤, 열린 탭을 새로고침한다.
 */
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(key => caches.delete(key))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then(clientsList => clientsList.forEach(client => client.navigate(client.url))),
    );
});

// fetch 핸들러 없음 — 모든 요청은 네트워크로 그대로 통과
