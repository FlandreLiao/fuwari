---
title: Dropout
published: 2026-07-26
description: Vanilla Dropout 和 Inverted Dropout，增强神经网络泛化性
tags: [知识储备]
category: 深度学习
draft: false
---

:::warning
本文含 AI 生成内容
:::

# Dropout (Inverted) - 训练时缩放 1/p

## 一、函数总体作用

**Dropout（随机失活）** 是一种用于神经网络的正则化技术。它在训练阶段以概率 $ p $ 随机“丢弃”（置零）神经元，并对其余神经元进行缩放，以防止过拟合和神经元之间的协同适应（co-adaptation）。

整体数学表达式为：

**训练阶段**：
$$
\text{Dropout}(X) = M \odot X \cdot \frac{1}{p}
$$

其中：

- $ X \in \mathbb{R}^{d_1 \times d_2 \times \cdots \times d_k} $：输入张量（任意形状）

- $ M \in \{0, 1\}^{d_1 \times d_2 \times \cdots \times d_k} $：**掩码矩阵**，每个元素独立地从伯努利分布采样：
  $$
  M_{i} \sim \text{Bernoulli}(p) = 
  \begin{cases}
  1 & \text{概率为 } p \\
  0 & \text{概率为 } 1-p
  \end{cases}
  $$

- $ p \in (0, 1] $：**保留概率**（keep probability）

- $ \odot $：逐元素乘法（Hadamard product）

- $ \frac{1}{p} $：**缩放因子**，用于保持期望值不变（inverted dropout）

**测试阶段**：
$$
\text{Dropout}_{\text{test}}(X) = X
$$

即输入原样返回，不做任何修改。

---

## 二、训练阶段的数学流程（`mode == "train"`）

### 步骤 1：生成掩码矩阵 $ M $

对输入张量 $ X $ 的每一个元素独立采样：

$$
M_i \sim \text{Bernoulli}(p) = 
\begin{cases}
1 & \text{概率为 } p \\
0 & \text{概率为 } 1-p
\end{cases}
$$

在代码中通过 `torch.rand_like(x) < p` 实现，即从均匀分布 $ U(0,1) $ 采样，若小于 $ p $ 则保留（$ M_i=1 $），否则丢弃（$ M_i=0 $）。

### 步骤 2：应用掩码并缩放（Inverted Dropout）

$$
Y = M \odot X \cdot \frac{1}{p}
$$

**为什么需要缩放 $ 1/p $**？

为了在训练和测试时保持输出的期望值一致。在测试阶段，我们不丢弃任何神经元，即 $ Y_{\text{test}} = X $。为了让训练阶段的期望输出等于测试阶段，需要：

$$
\mathbb{E}[Y_{\text{train}}] = \mathbb{E}\left[M \odot X \cdot \frac{1}{p}\right] = \frac{1}{p} \cdot \mathbb{E}[M] \odot X = \frac{1}{p} \cdot p \cdot X = X
$$

因此，经过缩放后，训练时每个神经元的期望输出与测试时完全相同，保证了模型在推理时的行为一致。

---

## 三、测试阶段的数学流程（`mode == "test"`）

在测试（推理）阶段，Dropout 被关闭：

$$
Y = X
$$

这符合“测试时模型应使用全部能力”的原则——不再随机丢弃神经元，而是利用训练阶段学到的所有参数的完整集成效果。

# Dropout (Vanilla) - 训练时不缩放

为什么不在训练时只做 $ M \odot X $，然后在测试时缩放 $ p \cdot X $？

**两种做法在数学上等价**：

- 方法 A（Inverted Dropout）：训练时缩放 $ 1/p $，测试时不缩放
- 方法 B（Vanilla Dropout）：训练时不缩放，测试时缩放 $ p $

但 **Inverted Dropout** 成为标准做法，因为它：

- 将缩放操作集中在训练阶段，使测试阶段的代码更简洁高效（不需要额外运算）
- 确保测试阶段模型的行为完全确定，不受 $ p $ 值影响