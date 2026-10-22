package ai.antop.gunpla.variation.entity

// 바리에이션 화살표 방향 — 원본 카드의 어느 변에서 나가는지 (바리에이션 카드에는 반대쪽 변으로 들어간다)
// 예) RIGHT: 원본 오른쪽 → 바리에이션 왼쪽
enum class VariationLinkDirection {
    UP,
    RIGHT,
    DOWN,
    LEFT,
}
