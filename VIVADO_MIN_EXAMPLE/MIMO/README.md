# SPMIMO Lab2 — Numerical Examples for MIMO Channel Capacity

This document summarizes **Programming Exercise 2: MIMO Channel Capacity** using simple numerical examples for Task 1–4.

> To make equations render reliably in GitHub README.md, all block equations are written using fenced math blocks: ` ```math ... ``` `.

Basic assumptions:

- The channel is known at the receiver.
- In Task 2, the channel is unknown at the transmitter.
- In Task 3, we compare transmitter channel unknown and transmitter channel known cases.
- Most numerical examples use `SNR = 10 dB`.
- The linear SNR for `10 dB` is:

```math
\gamma_0 = 10^{10/10} = 10
```

---

# Task 1 — Rayleigh Flat Fading Channel Generation

Task 1 is to generate `Nt × Nr` independent Rayleigh fading links.

For example:

```text
Tx = 2
Rx = 2
```

Then the MIMO channel matrix is:

```math
H =
\begin{bmatrix}
h_{11} & h_{12} \\
h_{21} & h_{22}
\end{bmatrix}
```

Usually, rows correspond to receive antennas and columns correspond to transmit antennas.

That is:

```math
H =
\begin{bmatrix}
\text{channel from Tx1 to Rx1} & \text{channel from Tx2 to Rx1} \\
\text{channel from Tx1 to Rx2} & \text{channel from Tx2 to Rx2}
\end{bmatrix}
```

Each channel coefficient is generated as:

```math
h = h_i + jh_q
```

```math
h_i = \frac{1}{\sqrt{2}} \cdot real
```

```math
h_q = \frac{1}{\sqrt{2}} \cdot imag
```

Here, `real` and `imag` are independent Gaussian random variables.

---

## Simple Numerical Example

Assume the Gaussian random numbers are generated as follows.

| Link | real | imag |
|---|---:|---:|
| Tx1 → Rx1 | 1.0 | 0.5 |
| Tx2 → Rx1 | -0.2 | 1.2 |
| Tx1 → Rx2 | 0.7 | -0.3 |
| Tx2 → Rx2 | -1.1 | -0.8 |

```math
\frac{1}{\sqrt{2}} \approx 0.7071
```

Therefore:

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

The final channel matrix is:

```math
H =
\begin{bmatrix}
0.7071 + j0.3536 & -0.1414 + j0.8485 \\
0.4950 - j0.2121 & -0.7778 - j0.5657
\end{bmatrix}
```

---

## C Array Indexing Example

If the channel coefficients are stored in one-dimensional arrays, we can write:

```c
hi[0] =  0.7071;   hq[0] =  0.3536;   // Rx1 <- Tx1
hi[1] = -0.1414;   hq[1] =  0.8485;   // Rx1 <- Tx2
hi[2] =  0.4950;   hq[2] = -0.2121;   // Rx2 <- Tx1
hi[3] = -0.7778;   hq[3] = -0.5657;   // Rx2 <- Tx2
```

The indexing rule is:

```c
index = rx * txAntennas + tx;
```

For `Tx = 2`, `Rx = 2`:

```text
rx = 0, tx = 0 -> index = 0 -> h11
rx = 0, tx = 1 -> index = 1 -> h12
rx = 1, tx = 0 -> index = 2 -> h21
rx = 1, tx = 1 -> index = 3 -> h22
```

The core implementation for Task 1 is:

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

In short, **2×2 MIMO means generating four independent Rayleigh fading coefficients**.

---

# Task 2 — Capacity versus SNR

In Task 2, the transmitter does not know the channel, while the receiver knows the channel.

The capacity formula is:

```math
C=\sum_{j=1}^{r}\log_2\left(1+\lambda_j\frac{\gamma_0}{N_t}\right)
```

where:

```text
γ0 = linear SNR
Nt = number of transmit antennas
λj = positive eigenvalues of H Hᴴ
r = channel rank
```

In this example:

```math
SNR = 10 \text{ dB}
```

```math
\gamma_0 = 10
```

---

## 1. SISO `(Nt=1, Nr=1)`

Use the simplest channel:

```math
H = [1]
```

Then:

```math
HH^H = [1]
```

The eigenvalue is:

```math
\lambda_1 = 1
```

For SISO, `Nt = 1`.

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

MISO has two transmit antennas and one receive antenna.

Use the following simple channel:

```math
H =
\begin{bmatrix}
1 & 1
\end{bmatrix}
```

Then:

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

Therefore:

```math
\lambda_1 = 2
```

However, for MISO, `Nt = 2`.

If the transmitter does not know the channel, it splits the transmit power equally across the two antennas. Therefore, the formula contains `SNR / Nt`.

```math
C = \log_2 \left(1 + 2 \cdot \frac{10}{2}\right)
```

```math
C = \log_2(11)
```

```math
C \approx 3.46 \text{ bps/Hz}
```

So in this simple example:

```text
MISO capacity = 3.46 bps/Hz
```

Key point:

```text
MISO has a larger total channel gain, but if the transmitter does not know the channel,
the transmit power must be divided by Nt.
```

---

## 3. SIMO `(Nt=1, Nr=2)`

SIMO has one transmit antenna and two receive antennas.

Use the following simple channel:

```math
H =
\begin{bmatrix}
1 \\
1
\end{bmatrix}
```

Then:

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

The eigenvalues of this matrix are:

```math
\lambda_1 = 2,\quad \lambda_2 = 0
```

Only positive eigenvalues are used, so:

```math
\lambda_1 = 2
```

For SIMO, `Nt = 1`.

```math
C = \log_2 \left(1 + 2 \cdot \frac{10}{1}\right)
```

```math
C = \log_2(21)
```

```math
C \approx 4.39 \text{ bps/Hz}
```

### Direct SIMO Capacity Formula

For SIMO, there is only one transmit antenna. The channel can be written as a vector:

```math
h =
\begin{bmatrix}
h_1 \\
h_2
\end{bmatrix}
```

The effective channel gain is the sum of the received signal energies:

```math
\|h\|^2 = |h_1|^2 + |h_2|^2
```

Therefore, the SIMO capacity can be written as:

```math
C_{\text{SIMO}}
=
\log_2\left(1+\gamma_0 \|h\|^2\right)
```

or:

```math
C_{\text{SIMO}}
=
\log_2\left(1+\gamma_0\left(|h_1|^2+|h_2|^2\right)\right)
```

In this example:

```math
h_1 = 1,\quad h_2 = 1
```

Therefore:

```math
\|h\|^2 = |1|^2 + |1|^2 = 2
```

Thus:

```math
C_{\text{SIMO}}
=
\log_2(1+10\cdot 2)
=
\log_2(21)
\approx 4.39 \text{ bps/Hz}
```

Key point:

```text
SIMO does not divide the transmit power.
The received signal energy is combined across the receive antennas.
```

---

## 4. MIMO `(Nt=2, Nr=2)`

Use the simplest 2×2 MIMO channel: the identity matrix.

```math
H =
\begin{bmatrix}
1 & 0 \\
0 & 1
\end{bmatrix}
```

Then:

```math
HH^H =
\begin{bmatrix}
1 & 0 \\
0 & 1
\end{bmatrix}
```

The eigenvalues are:

```math
\lambda_1 = 1,\quad \lambda_2 = 1
```

The rank is 2.

For MIMO, `Nt = 2`.

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

## Task 2 Summary

| Case | H | Eigenvalue λ | Nt | Capacity |
|---|---|---:|---:|---:|
| SISO `(1,1)` | `[1]` | 1 | 1 | 3.46 bps/Hz |
| MISO `(2,1)` | `[1 1]` | 2 | 2 | 3.46 bps/Hz |
| SIMO `(1,2)` | `[1; 1]` | 2 | 1 | 4.39 bps/Hz |
| MIMO `(2,2)` | `I` | 1, 1 | 2 | 5.17 bps/Hz |

Intuition:

```text
SISO: only one channel path.

MISO: two transmit antennas, but if the transmitter does not know the channel,
the power is split across transmit antennas.

SIMO: two receive antennas, so the received signal energy can be combined.

MIMO: if there are two independent spatial paths, the capacity is approximately
the sum of two SISO-like channels.
```

---

# Task 3 — Transmitter Channel Known versus Unknown

Task 3 compares the case where the transmitter knows the channel with the case where it does not.

The comparison targets are:

```text
SISO  (1,1)
SIMO  (1,2)
MISO  (2,1)
```

Basic condition:

```math
SNR = 10 \text{ dB}
```

```math
\gamma_0 = 10
```

---

## 1. SISO `(Nt=1, Nr=1)`

Channel:

```math
H = [1]
```

Eigenvalue:

```math
\lambda_1 = 1
```

### Transmitter Channel Unknown

```math
C = \log_2(1 + 1 \cdot 10)
```

```math
C = \log_2(11) \approx 3.46
```

### Transmitter Channel Known

SISO has only one transmit antenna. Therefore, even if the transmitter knows the channel, there is nothing to beamform or optimize.

```math
C = \log_2(11) \approx 3.46
```

Summary:

```text
SISO unknown = 3.46 bps/Hz
SISO known   = 3.46 bps/Hz
```

---

## 2. SIMO `(Nt=1, Nr=2)`

Channel:

```math
H =
\begin{bmatrix}
1 \\
1
\end{bmatrix}
```

Eigenvalues:

```math
\lambda_1 = 2,\quad \lambda_2 = 0
```

Only positive eigenvalues are used, so:

```math
\lambda_1 = 2
```

### Transmitter Channel Unknown

SIMO has only one transmit antenna, so `Nt = 1`.

```math
C = \log_2(1 + 2 \cdot 10)
```

```math
C = \log_2(21) \approx 4.39
```

### Transmitter Channel Known

SIMO also has only one transmit antenna.

Therefore, even if the transmitter knows the channel, there is no transmit beamforming or power allocation to perform.

```math
C = \log_2(21) \approx 4.39
```

Summary:

```text
SIMO unknown = 4.39 bps/Hz
SIMO known   = 4.39 bps/Hz
```

---

## 3. MISO `(Nt=2, Nr=1)`

Channel:

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

Eigenvalue:

```math
\lambda_1 = 2
```

---

### Transmitter Channel Unknown

If the transmitter does not know the channel, it splits power equally across the two transmit antennas.

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

### Transmitter Channel Known

If the transmitter knows the channel, it can transmit the two antenna signals so that they arrive at the receiver with the same phase.

This is MISO beamforming.

The known-channel MISO capacity is:

```math
C_{\text{known}}
=
\log_2\left(1 + \gamma_0 \|h\|^2\right)
```

where:

```math
h = [1 \quad 1]
```

```math
\|h\|^2 = |1|^2 + |1|^2 = 2
```

Therefore:

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

Summary:

```text
MISO unknown = 3.46 bps/Hz
MISO known   = 4.39 bps/Hz
```

---

## 4. Simple 2×2 MIMO Water-Filling Example

As an extension of Task 3, if the transmitter knows the MIMO channel, it can allocate different amounts of power to different eigenmodes.

This is called **water-filling**.

Consider a very simple 2×2 diagonal channel:

```math
H =
\begin{bmatrix}
2 & 0 \\
0 & 1
\end{bmatrix}
```

Then:

```math
HH^H =
\begin{bmatrix}
4 & 0 \\
0 & 1
\end{bmatrix}
```

Therefore, the eigenvalues are:

```math
\lambda_1 = 4,\quad \lambda_2 = 1
```

Use the same SNR-like total power:

```math
\gamma_0 = 10
```

Normalize the total transmit power as:

```math
P_{\text{total}} = 10
```

For simplicity, set the noise power to:

```math
N_0 = 1
```

---

### 4-1. Channel Unknown: Equal Power Allocation

If the transmitter does not know the channel, it allocates power equally across the two modes.

```math
P_1 = 5,\quad P_2 = 5
```

The capacity is:

```math
C_{\text{equal}}
=
\log_2(1+\lambda_1 P_1)
+
\log_2(1+\lambda_2 P_2)
```

Substituting the numbers:

```math
C_{\text{equal}}
=
\log_2(1+4\cdot 5)
+
\log_2(1+1\cdot 5)
```

```math
C_{\text{equal}}
=
\log_2(21)+\log_2(6)
```

```math
C_{\text{equal}}
\approx
4.39+2.58
=
6.98 \text{ bps/Hz}
```

---

### 4-2. Channel Known: Water-Filling Power Allocation

Water-filling allocates more power to stronger eigenmodes.

The power allocation has the form:

```math
P_i = \left(\mu - \frac{N_0}{\lambda_i}\right)^+
```

where `μ` is the water level.

Assume both modes are active.

```math
P_1 + P_2 = 10
```

```math
\left(\mu-\frac{1}{4}\right)
+
\left(\mu-\frac{1}{1}\right)
=
10
```

```math
2\mu - 1.25 = 10
```

```math
\mu = 5.625
```

Therefore:

```math
P_1 = 5.625 - 0.25 = 5.375
```

```math
P_2 = 5.625 - 1 = 4.625
```

Check:

```math
P_1 + P_2 = 5.375 + 4.625 = 10
```

The capacity is:

```math
C_{\text{WF}}
=
\log_2(1+\lambda_1 P_1)
+
\log_2(1+\lambda_2 P_2)
```

Substituting the numbers:

```math
C_{\text{WF}}
=
\log_2(1+4\cdot 5.375)
+
\log_2(1+1\cdot 4.625)
```

```math
C_{\text{WF}}
=
\log_2(22.5)+\log_2(5.625)
```

```math
C_{\text{WF}}
\approx
4.49+2.49
=
6.98 \text{ bps/Hz}
```

In this example, the two eigenvalues are not very different and the SNR is sufficiently high, so the water-filling gain is small.

---

### 4-3. Example Where Water-Filling Gain Is More Visible

Now assume the second eigenmode is much weaker.

```math
\lambda_1 = 4,\quad \lambda_2 = 0.1
```

Keep the same total power and noise power:

```math
P_{\text{total}} = 10,\quad N_0 = 1
```

#### Equal Power Allocation

```math
P_1 = 5,\quad P_2 = 5
```

```math
C_{\text{equal}}
=
\log_2(1+4\cdot 5)
+
\log_2(1+0.1\cdot 5)
```

```math
C_{\text{equal}}
=
\log_2(21)+\log_2(1.5)
```

```math
C_{\text{equal}}
\approx
4.39+0.585
=
4.98 \text{ bps/Hz}
```

#### Water-Filling

Water-filling formula:

```math
P_i = \left(\mu - \frac{1}{\lambda_i}\right)^+
```

The inverse gains are:

```math
\frac{1}{\lambda_1}=0.25,\quad
\frac{1}{\lambda_2}=10
```

If both modes are active:

```math
(\mu-0.25)+(\mu-10)=10
```

```math
2\mu = 20.25
```

```math
\mu = 10.125
```

Then:

```math
P_1 = 10.125-0.25=9.875
```

```math
P_2 = 10.125-10=0.125
```

Only a very small amount of power is assigned to the second mode.

The capacity is:

```math
C_{\text{WF}}
=
\log_2(1+4\cdot 9.875)
+
\log_2(1+0.1\cdot 0.125)
```

```math
C_{\text{WF}}
=
\log_2(40.5)+\log_2(1.0125)
```

```math
C_{\text{WF}}
\approx
5.34+0.018
=
5.36 \text{ bps/Hz}
```

Therefore:

| Method | Power Allocation | Capacity |
|---|---:|---:|
| Equal power | `P1 = 5`, `P2 = 5` | 4.98 bps/Hz |
| Water-filling | `P1 = 9.875`, `P2 = 0.125` | 5.36 bps/Hz |

Conclusion:

```text
Water-filling assigns more power to stronger eigenmodes
and less power to weaker eigenmodes.
This increases capacity when the eigenvalues are significantly different.
```

---

## Task 3 Summary

| Case | Transmitter Channel Unknown | Transmitter Channel Known | Benefit? |
|---|---:|---:|---|
| SISO `(1,1)` | 3.46 | 3.46 | No |
| SIMO `(1,2)` | 4.39 | 4.39 | Almost no |
| MISO `(2,1)` | 3.46 | 4.39 | Yes |
| MIMO `(2,2)` | Equal power | Water-filling | Larger gain when eigenvalues differ |

Key conclusion:

```text
SISO has only one transmit antenna, so transmitter channel knowledge does not increase capacity.

SIMO also has only one transmit antenna, so transmitter channel knowledge does not provide an additional transmit-side gain.
The gain comes from receiver combining.

MISO has multiple transmit antennas, so transmitter channel knowledge enables transmit beamforming.

MIMO can use transmitter channel knowledge to allocate power differently across eigenmodes.
This is water-filling, and its gain becomes more visible when the eigenvalues are significantly different.
```

Expected graph relationship:

```text
SISO unknown = SISO known

SIMO unknown = SIMO known

MISO known > MISO unknown

MIMO water-filling >= MIMO equal power
```

---

# Task 4 — Capacity versus Number of Antennas with `Nt = Nr`

Task 4 studies mean capacity as the number of antennas increases with `Nt = Nr`.

Task 2:

```text
Change SNR and observe capacity.
```

Task 4:

```text
Change the number of antennas Nt = Nr and observe capacity.
```

---

## Simple Numerical Example

Instead of a random channel, use the ideal channel:

```math
H = I_N
```

That is:

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

In this case, all eigenvalues are 1.

```math
\lambda_1 = \lambda_2 = ... = \lambda_N = 1
```

The capacity formula is:

```math
C = \sum_{j=1}^{N} \log_2\left(1+\lambda_j \frac{\gamma_0}{N_t}\right)
```

Since `Nt = N` and `λj = 1`:

```math
C = N \log_2\left(1+\frac{\gamma_0}{N}\right)
```

---

## Example with SNR = 10 dB

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

## Summary for SNR = 10 dB

| Nt = Nr | Capacity |
|---:|---:|
| 1 | 3.46 bps/Hz |
| 2 | 5.17 bps/Hz |
| 4 | 7.23 bps/Hz |
| 6 | 8.49 bps/Hz |

Thus, capacity increases as the number of antennas increases.

---

## Examples for Several SNR Values

| Nt = Nr | SNR 0 dB | SNR 10 dB | SNR 20 dB |
|---:|---:|---:|---:|
| 1 | 1.00 | 3.46 | 6.66 |
| 2 | 1.17 | 5.17 | 11.34 |
| 4 | 1.29 | 7.23 | 18.80 |
| 6 | 1.34 | 8.49 | 24.72 |

Linear SNR values:

```text
0 dB  -> γ0 = 1
10 dB -> γ0 = 10
20 dB -> γ0 = 100
```

---

## Interpretation of Task 4

The graph should use:

```text
x-axis: Number of antennas Nt = Nr
```

```text
y-axis: Mean capacity in bps/Hz
```

There should be one curve for each SNR value.

Expected shape:

```text
SNR = 20 dB curve is the highest.
SNR = 15 dB
SNR = 10 dB
SNR = 5 dB
SNR = 0 dB curve is the lowest.
```

For all SNR values:

```text
Capacity increases as Nt = Nr increases.
```

---

## Important Note

The example above uses the ideal channel `H = I` only for intuition.

In the real Task 4 simulation, we must repeatedly generate random Rayleigh channels and calculate the average capacity.

The actual procedure is:

```text
1. Generate H.
2. Compute H Hᴴ.
3. Compute eigenvalues.
4. Compute capacity.
5. Repeat for many random channel samples.
6. Compute the mean capacity.
```

The target value is:

```math
\bar{C} = E\{C\}
```

The key idea is:

```text
As Nt = Nr increases, the number of independent spatial paths increases,
so the MIMO capacity increases.

The higher the SNR, the larger the capacity gain from adding more antennas.
```

---

# Overall Summary

| Task | Key Point |
|---|---|
| Task 1 | Generate `Nt × Nr` independent Rayleigh fading coefficients |
| Task 2 | Compute mean capacity versus SNR when the transmitter does not know the channel |
| Task 3 | Compare transmitter channel known and unknown cases; MISO benefits from transmit beamforming |
| Task 3 Extension | Use 2×2 MIMO water-filling to allocate power across eigenmodes |
| Task 4 | Observe that mean capacity increases as `Nt = Nr` increases |

Most important intuition:

```text
More receive antennas provide combining gain.

More transmit antennas provide limited gain if the transmitter does not know the channel,
because power is divided across transmit antennas.

If the transmitter has multiple antennas and knows the channel,
transmit beamforming becomes possible.

If a MIMO transmitter knows the channel, water-filling can assign more power
to stronger eigenmodes.

When both transmit and receive antenna numbers increase,
the number of independent spatial streams increases,
so capacity increases significantly.
```
