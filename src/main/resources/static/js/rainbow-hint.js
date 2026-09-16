/* 한 번만 보여주는 안내 효과 — 무지개 스타일(common.css 의 .rainbow-text / .rainbow-border)과 함께 쓴다
 *
 *   <a class="rainbow-text">Donate</a>                             항상 무지개 (안내가 아님)
 *   <button class="rainbow-border" data-hint="product-request">    마우스를 한 번 올리면 사라지고 다시 안 나옴
 *
 * data-hint 값이 기억하는 이름이다 — 이름만 새로 지어 붙이면 그대로 동작한다.
 * 이 파일은 <head> 에서 읽어야 한다. 화면이 그려지기 전에 '이미 본 안내'를 꺼야
 * 다시 찾은 사람에게 무지개가 잠깐 비쳤다 사라지지 않는다.
 */
(function () {
    const PREFIX = 'hint:';
    // 이름은 선택자에 그대로 들어가므로 영문/숫자/-/_ 만 허용한다
    const NAME = /^[\w-]+$/;

    const seen = Object.keys(localStorage)
        .filter(key => key.startsWith(PREFIX))
        .map(key => key.slice(PREFIX.length))
        .filter(name => NAME.test(name));

    if (seen.length) {
        const style = document.createElement('style');
        style.textContent = seen.map(name => `
            [data-hint="${name}"].rainbow-border::after { display: none; }
            [data-hint="${name}"].rainbow-text {
                background: none;
                -webkit-text-fill-color: currentColor;
                color: inherit;
                font-weight: inherit;
                animation: none;
            }`).join('');
        document.head.appendChild(style);
    }

    // 마우스를 한 번 올리면 알아본 것으로 보고 그 안내만 끈다 (효과 클래스를 떼면 원래 모습으로 돌아간다)
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-hint]').forEach(el => {
            const name = el.dataset.hint;
            if (!NAME.test(name)) return;
            el.addEventListener('mouseenter', () => {
                localStorage.setItem(PREFIX + name, '1');
                el.classList.remove('rainbow-border', 'rainbow-text');
            }, { once: true });
        });
    });
})();
