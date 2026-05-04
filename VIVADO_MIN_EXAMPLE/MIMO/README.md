# SPMIMO Lab2 — MIMO Channel Capacity 숫자 예제 정리

이 문서는 **Programming Exercise 2: MIMO Channel Capacity**의 Task 1–4를 가장 단순한 숫자 예제로 정리한 것이다.

> GitHub README.md에서 수식이 깨지는 문제를 줄이기 위해 모든 block equation은 ` ```math ... ``` ` 형식으로 작성하였다.

기본 가정:

- Channel은 receiver에서는 known
- Task 2에서는 transmitter에서는 channel unknown
- Task 3에서는 transmitter channel unknown/known을 비교
- SNR 예제는 대부분 `10 dB` 사용
- `10 dB`의 linear SNR:

```math
\gamma_0 = 10^{10/10} = 10
```

---

# Task 1 — Rayleigh Flat Fading Channel 생성 예제

Task 1은 `Nt × Nr`개의 독립 Rayleigh fading link를 만드는 것이다.

예를 들어:

```text
Tx = 2
Rx = 2
```

이면 MIMO channel matrix는 다음과 같다.

```math
H =
\begin{bmatrix}
h_{11} & h_{12} \\
h_{21} & h_{22}
\end{bmatrix}
```

보통 행은 Rx antenna, 열은 Tx antenna로 본다.

즉:

```math
H =
\begin{bmatrix}
\text{Rx1이 Tx1에서 받은 채널} & \text{Rx1이 Tx2에서 받은 채널} \\
\text{Rx2가 Tx1에서 받은 채널} & \text{Rx2가 Tx2에서 받은 채널}
\end{bmatrix}
```

각 채널 coefficient는 다음과 같이 만든다.

```math
h = h_i + jh_q
```

```math
h_i = \frac{1}{\sqrt{2}} \cdot real
```

```math
h_q = \frac{1}{\sqrt{2}} \cdot imag
```

여기서 `real`, `imag`는 서로 독립인 Gaussian random number이다.

---

## 간단한 숫자 예제

Gaussian random number가 다음과 같이 나왔다고 하자.

| Link | real | imag |
|---|---:|---:|
| Tx1 → Rx1 | 1.0 | 0.5 |
| Tx2 → Rx1 | -0.2 | 1.2 |
| Tx1 → Rx2 | 0.7 | -0.3 |
| Tx2 → Rx2 | -1.1 | -0.8 |

```math
\frac{1}{\sqrt{2}} \approx 0.7071
```

따라서:

```math
h_{11} = 0.7071 + j0.3536
```

```math
h_{12} = -0.1414 + j0.8485
```

```math
h_{21} = 0.4950 - j0.2121
```

```math
h_{22} = -0.7778 - j0.5657
```

최종 channel matrix는:

```math
H =
\begin{bmatrix}
0.7071 + j0.3536 & -0.1414 + j0.8485 \\
0.4950 - j0.2121 & -0.7778 - j0.5657
\end{bmatrix}
```

---

## C 배열 indexing 예제

1차원 배열에 저장하면 다음과 같이 볼 수 있다.

```c
hi[0] =  0.7071;   hq[0] =  0.3536;   // Rx1 <- Tx1
hi[1] = -0.1414;   hq[1] =  0.8485;   // Rx1 <- Tx2
hi[2] =  0.4950;   hq[2] = -0.2121;   // Rx2 <- Tx1
hi[3] = -0.7778;   hq[3] = -0.5657;   // Rx2 <- Tx2
```

indexing은 다음처럼 하면 된다.

```c
index = rx * txAntennas + tx;
```

`Tx = 2`, `Rx = 2`이면:

```text
rx = 0, tx = 0 -> index = 0 -> h11
rx = 0, tx = 1 -> index = 1 -> h12
rx = 1, tx = 0 -> index = 2 -> h21
rx = 1, tx = 1 -> index = 3 -> h22
```

Task 1의 핵심은:

```c
for (int rx = 0; rx < rxAntennas; rx++) {
    for (int tx = 0; tx < txAntennas; tx++) {
        int index = rx * txAntennas + tx;

        double real, imag;
        box_muller(&real, &imag);

        hi[index] = real / sqrt(2.0);
        hq[index] = imag / sqrt(2.0);
    }
}
```

즉 **2×2 MIMO는 독립 Rayleigh fading coefficient 4개를 만드는 것**이다.

---

# Task 2 — SNR에 따른 Capacity 계산 예제

Task 2에서는 transmitter는 channel을 모르고, receiver는 channel을 안다고 가정한다.

capacity 공식은 다음과 같다.

```math
C=\sum_{j=1}^{r}\log_2\left(1+\lambda_j\frac{\gamma_0}{N_t}\right)
```

여기서:

```text
γ0 = linear SNR
Nt = 송신 안테나 수
λj = H Hᴴ의 positive eigenvalue
r = channel rank
```

이번 예제에서는:

```math
SNR = 10 \text{ dB}
```

```math
\gamma_0 = 10
```

---

## 1. SISO `(Nt=1, Nr=1)`

채널을 가장 단순하게 다음과 같이 둔다.

```math
H = [1]
```

그러면:

```math
HH^H = [1]
```

eigenvalue는:

```math
\lambda_1 = 1
```

SISO에서는 `Nt = 1`이다.

```math
C = \log_2 \left(1 + 1 \cdot \frac{10}{1}\right)
```

```math
C = \log_2(11)
```

```math
C \approx 3.46 \text{ bps/Hz}
```

---

## 2. MISO `(Nt=2, Nr=1)`

MISO는 송신 안테나 2개, 수신 안테나 1개이다.

채널을 다음과 같이 둔다.

```math
H =
\begin{bmatrix}
1 & 1
\end{bmatrix}
```

그러면:

```math
HH^H =
\begin{bmatrix}
1 & 1
\end{bmatrix}
\begin{bmatrix}
1 \\
1
\end{bmatrix}
=
[2]
```

따라서:

```math
\lambda_1 = 2
```

하지만 MISO에서는 `Nt = 2`이다.

Tx가 channel을 모르면 송신 전력을 두 송신 안테나에 나누어 보내므로 공식 안에 `SNR / Nt`가 들어간다.

```math
C = \log_2 \left(1 + 2 \cdot \frac{10}{2}\right)
```

```math
C = \log_2(11)
```

```math
C \approx 3.46 \text{ bps/Hz}
```

즉 이 단순 예제에서는:

```text
MISO capacity = 3.46 bps/Hz
```

핵심은:

```text
MISO는 |h|² 합이 커지지만,
Tx channel unknown이면 송신 전력을 Nt로 나누어 써야 한다.
```

---

## 3. SIMO `(Nt=1, Nr=2)`

SIMO는 송신 안테나 1개, 수신 안테나 2개이다.

채널을 다음과 같이 둔다.

```math
H =
\begin{bmatrix}
1 \\
1
\end{bmatrix}
```

그러면:

```math
HH^H =
\begin{bmatrix}
1 \\
1
\end{bmatrix}
\begin{bmatrix}
1 & 1
\end{bmatrix}
=
\begin{bmatrix}
1 & 1 \\
1 & 1
\end{bmatrix}
```

이 행렬의 eigenvalue는:

```math
\lambda_1 = 2,\quad \lambda_2 = 0
```

positive eigenvalue만 쓰므로:

```math
\lambda_1 = 2
```

SIMO에서는 `Nt = 1`이다.

```math
C = \log_2 \left(1 + 2 \cdot \frac{10}{1}\right)
```

```math
C = \log_2(21)
```

```math
C \approx 4.39 \text{ bps/Hz}
```

핵심은:

```text
SIMO는 송신 전력을 나눌 필요가 없다.
수신 안테나가 2개라서 받은 신호 에너지가 합쳐진다.
```

---

## 4. MIMO `(Nt=2, Nr=2)`

가장 단순한 2×2 MIMO channel을 identity matrix로 둔다.

```math
H =
\begin{bmatrix}
1 & 0 \\
0 & 1
\end{bmatrix}
```

그러면:

```math
HH^H =
\begin{bmatrix}
1 & 0 \\
0 & 1
\end{bmatrix}
```

eigenvalue는:

```math
\lambda_1 = 1,\quad \lambda_2 = 1
```

rank는 2이다.

MIMO에서는 `Nt = 2`이다.

```math
C =
\log_2\left(1 + 1 \cdot \frac{10}{2}\right)
+
\log_2\left(1 + 1 \cdot \frac{10}{2}\right)
```

```math
C =
\log_2(6)+\log_2(6)
```

```math
C = 2\log_2(6)
```

```math
C \approx 5.17 \text{ bps/Hz}
```

---

## Task 2 정리

| Case | H | Eigenvalue λ | Nt | Capacity |
|---|---|---:|---:|---:|
| SISO `(1,1)` | `[1]` | 1 | 1 | 3.46 bps/Hz |
| MISO `(2,1)` | `[1 1]` | 2 | 2 | 3.46 bps/Hz |
| SIMO `(1,2)` | `[1; 1]` | 2 | 1 | 4.39 bps/Hz |
| MIMO `(2,2)` | `I` | 1, 1 | 2 | 5.17 bps/Hz |

직관:

```text
SISO: 하나의 통로만 있음

MISO: 송신 안테나 2개지만, Tx가 channel을 모르면 전력을 나누어 써야 함

SIMO: 수신 안테나 2개라서 에너지를 모을 수 있음

MIMO: 독립적인 공간 경로가 2개 있으면 capacity가 거의 두 개의 SISO처럼 더해짐
```

---

# Task 3 — Transmitter가 Channel을 아는 경우 비교

Task 3는 transmitter가 channel을 아는 경우와 모르는 경우를 비교하는 것이다.

비교 대상:

```text
SISO  (1,1)
SIMO  (1,2)
MISO  (2,1)
```

기본 조건:

```math
SNR = 10 \text{ dB}
```

```math
\gamma_0 = 10
```

---

## 1. SISO `(Nt=1, Nr=1)`

채널:

```math
H = [1]
```

eigenvalue:

```math
\lambda_1 = 1
```

### Tx channel unknown

```math
C = \log_2(1 + 1 \cdot 10)
```

```math
C = \log_2(11) \approx 3.46
```

### Tx channel known

SISO는 안테나가 하나뿐이므로 Tx가 channel을 알아도 할 수 있는 것이 없다.

```math
C = \log_2(11) \approx 3.46
```

정리:

```text
SISO unknown = 3.46 bps/Hz
SISO known   = 3.46 bps/Hz
```

---

## 2. SIMO `(Nt=1, Nr=2)`

채널:

```math
H =
\begin{bmatrix}
1 \\
1
\end{bmatrix}
```

eigenvalue:

```math
\lambda_1 = 2,\quad \lambda_2 = 0
```

positive eigenvalue만 쓰므로:

```math
\lambda_1 = 2
```

### Tx channel unknown

SIMO는 송신 안테나가 하나이므로 `Nt = 1`.

```math
C = \log_2(1 + 2 \cdot 10)
```

```math
C = \log_2(21) \approx 4.39
```

### Tx channel known

SIMO도 송신 안테나가 하나뿐이다.

즉 Tx가 channel을 알아도 beamforming이나 전력 분배를 할 대상이 없다.

```math
C = \log_2(21) \approx 4.39
```

정리:

```text
SIMO unknown = 4.39 bps/Hz
SIMO known   = 4.39 bps/Hz
```

---

## 3. MISO `(Nt=2, Nr=1)`

채널:

```math
H =
\begin{bmatrix}
1 & 1
\end{bmatrix}
```

```math
HH^H =
\begin{bmatrix}
1 & 1
\end{bmatrix}
\begin{bmatrix}
1 \\
1
\end{bmatrix}
=
[2]
```

eigenvalue:

```math
\lambda_1 = 2
```

---

### Tx channel unknown

Tx가 channel을 모르면 두 송신 안테나에 전력을 균등 분배한다.

```math
N_t = 2
```

```math
C_{\text{unknown}}
=
\log_2\left(1 + 2 \cdot \frac{10}{2}\right)
```

```math
C_{\text{unknown}}
=
\log_2(11)
```

```math
C_{\text{unknown}} \approx 3.46
```

---

### Tx channel known

Tx가 channel을 알면 두 송신 안테나의 신호를 수신기에서 같은 위상으로 합쳐지도록 보낼 수 있다.

이것이 MISO beamforming이다.

MISO known의 capacity는:

```math
C_{\text{known}}
=
\log_2\left(1 + \gamma_0 \|h\|^2\right)
```

여기서:

```math
h = [1 \quad 1]
```

```math
\|h\|^2 = |1|^2 + |1|^2 = 2
```

따라서:

```math
C_{\text{known}}
=
\log_2(1 + 10 \cdot 2)
```

```math
C_{\text{known}}
=
\log_2(21)
```

```math
C_{\text{known}} \approx 4.39
```

정리:

```text
MISO unknown = 3.46 bps/Hz
MISO known   = 4.39 bps/Hz
```

---

## Task 3 정리

| Case | Tx channel unknown | Tx channel known | Benefit? |
|---|---:|---:|---|
| SISO `(1,1)` | 3.46 | 3.46 | 없음 |
| SIMO `(1,2)` | 4.39 | 4.39 | 거의 없음 |
| MISO `(2,1)` | 3.46 | 4.39 | 있음 |

핵심 결론:

```text
SISO는 송신 안테나가 하나뿐이라서 transmitter가 channel을 알아도 capacity 이득이 없다.

SIMO도 송신 안테나가 하나뿐이라서 transmitter가 channel을 알아도 추가 이득이 없다.
수신기에서만 combining gain이 생긴다.

MISO는 송신 안테나가 여러 개이므로 transmitter가 channel을 알면 beamforming을 할 수 있다.
그래서 channel unknown일 때보다 capacity가 증가한다.
```

그래프에서는 보통 다음 관계가 보이면 된다.

```text
SISO unknown = SISO known

SIMO unknown = SIMO known

MISO known > MISO unknown
```

---

# Task 4 — Nt = Nr 증가에 따른 Capacity 예제

Task 4는 SNR이 아니라 안테나 개수 `Nt = Nr`를 바꾸면서 mean capacity를 보는 것이다.

Task 2:

```text
SNR을 바꾸면서 capacity를 본다.
```

Task 4:

```text
안테나 개수 Nt = Nr을 바꾸면서 capacity를 본다.
```

---

## 가장 간단한 숫자 예제

복잡한 random channel 대신 이해를 위해:

```math
H = I_N
```

이라고 하자.

즉:

### `Nt = Nr = 1`

```math
H = [1]
```

### `Nt = Nr = 2`

```math
H =
\begin{bmatrix}
1 & 0 \\
0 & 1
\end{bmatrix}
```

### `Nt = Nr = 4`

```math
H = I_4
```

이 경우 eigenvalue는 모두 1이다.

```math
\lambda_1 = \lambda_2 = ... = \lambda_N = 1
```

capacity 공식은:

```math
C = \sum_{j=1}^{N} \log_2\left(1+\lambda_j \frac{\gamma_0}{N_t}\right)
```

여기서 `Nt = N`, `λj = 1`이므로:

```math
C = N \log_2\left(1+\frac{\gamma_0}{N}\right)
```

---

## SNR = 10 dB 예제

```math
\gamma_0 = 10
```

### `Nt = Nr = 1`

```math
C = 1 \cdot \log_2\left(1+\frac{10}{1}\right)
```

```math
C = \log_2(11)
```

```math
C \approx 3.46
```

---

### `Nt = Nr = 2`

```math
C = 2 \cdot \log_2\left(1+\frac{10}{2}\right)
```

```math
C = 2\log_2(6)
```

```math
C \approx 5.17
```

---

### `Nt = Nr = 4`

```math
C = 4 \cdot \log_2\left(1+\frac{10}{4}\right)
```

```math
C = 4\log_2(3.5)
```

```math
C \approx 7.23
```

---

### `Nt = Nr = 6`

```math
C = 6 \cdot \log_2\left(1+\frac{10}{6}\right)
```

```math
C = 6\log_2(2.667)
```

```math
C \approx 8.49
```

---

## SNR = 10 dB 정리

| Nt = Nr | Capacity |
|---:|---:|
| 1 | 3.46 bps/Hz |
| 2 | 5.17 bps/Hz |
| 4 | 7.23 bps/Hz |
| 6 | 8.49 bps/Hz |

즉 안테나 수가 증가하면 capacity가 증가한다.

---

## 여러 SNR에서의 예제

| Nt = Nr | SNR 0 dB | SNR 10 dB | SNR 20 dB |
|---:|---:|---:|---:|
| 1 | 1.00 | 3.46 | 6.66 |
| 2 | 1.17 | 5.17 | 11.34 |
| 4 | 1.29 | 7.23 | 18.80 |
| 6 | 1.34 | 8.49 | 24.72 |

SNR linear 값은:

```text
0 dB  -> γ0 = 1
10 dB -> γ0 = 10
20 dB -> γ0 = 100
```

---

## Task 4의 핵심 해석

그래프를 그리면 x축은:

```text
Number of antennas Nt = Nr
```

y축은:

```text
Mean capacity bps/Hz
```

그리고 곡선은 SNR별로 여러 개가 된다.

예상되는 모양:

```text
SNR = 20 dB 곡선이 가장 위
SNR = 15 dB
SNR = 10 dB
SNR = 5 dB
SNR = 0 dB 곡선이 가장 아래
```

그리고 모든 SNR에서:

```text
Nt = Nr가 증가할수록 capacity 증가
```

---

## 주의할 점

위 예제는 이해를 위한 ideal channel `H = I` 예제이다.

실제 Task 4에서는 매번 random Rayleigh channel을 만들고 다음 과정을 반복해야 한다.

```text
1. H 생성
2. H Hᴴ 계산
3. eigenvalue 계산
4. capacity 계산
5. 이 과정을 random samples번 반복
6. 평균 capacity 계산
```

즉 실제로 구하는 값은:

```math
\bar{C} = E\{C\}
```

이다.

하지만 개념적으로는 다음만 기억하면 된다.

```text
Nt = Nr가 증가하면 독립적인 spatial path가 늘어나기 때문에 MIMO capacity가 증가한다.
SNR이 클수록 안테나 수 증가에 따른 capacity 증가 폭도 더 커진다.
```

---

# 전체 요약

| Task | 핵심 |
|---|---|
| Task 1 | `Nt × Nr`개의 독립 Rayleigh fading coefficient 생성 |
| Task 2 | Tx channel unknown 상태에서 SNR별 평균 capacity 계산 |
| Task 3 | Tx channel known/unknown 비교. MISO에서 beamforming 이득 발생 |
| Task 4 | `Nt = Nr` 증가에 따른 평균 capacity 증가 확인 |

가장 중요한 직관:

```text
수신 안테나가 늘어나면 combining gain이 생긴다.

송신 안테나가 늘어나도 transmitter가 channel을 모르면 전력을 나누어 쓰므로 이득이 제한된다.

송신 안테나가 여러 개이고 transmitter가 channel을 알면 beamforming 이득이 생긴다.

MIMO에서 송수신 안테나가 함께 늘어나면 독립적인 spatial stream 수가 늘어나 capacity가 크게 증가한다.
```
