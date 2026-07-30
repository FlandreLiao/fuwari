---
title: RNN
published: 2026-07-30
description: Recurrent Neural Network，处理序列任务
tags: [知识储备]
category: 深度学习
draft: false
---

:::warning
本文含 AI 生成内容
:::

RNN的前向传播、损失计算与反向传播（BPTT）过程。

---

## 1. 符号定义

设序列长度为 $T$：

- **输入序列**：$\mathbf{x}_1, \mathbf{x}_2, \dots, \mathbf{x}_T$，其中 $\mathbf{x}_t \in \mathbb{R}^{d_x}$
- **隐藏状态**：$\mathbf{h}_0, \mathbf{h}_1, \dots, \mathbf{h}_T$，其中 $\mathbf{h}_t \in \mathbb{R}^{d_h}$，初始状态 $\mathbf{h}_0 = \mathbf{0}$（或固定偏置向量）
- **输出序列**：$\mathbf{y}_1, \mathbf{y}_2, \dots, \mathbf{y}_T$，其中 $\mathbf{y}_t \in \mathbb{R}^{d_y}$
- **可训练参数**：
  - 输入权重矩阵：$\mathbf{W}_{xh} \in \mathbb{R}^{d_h \times d_x}$
  - 状态转移矩阵：$\mathbf{W}_{hh} \in \mathbb{R}^{d_h \times d_h}$
  - 输出权重矩阵：$\mathbf{W}_{hy} \in \mathbb{R}^{d_y \times d_h}$
  - 偏置向量：$\mathbf{b}_h \in \mathbb{R}^{d_h}$，$\mathbf{b}_y \in \mathbb{R}^{d_y}$

---

## 2. 前向传播（Forward Pass）

### 2.1 状态更新方程（核心递推式）

RNN的核心是**非线性状态转移**：

$$
\mathbf{h}_t = \phi_h\left( \mathbf{W}_{hh} \mathbf{h}_{t-1} + \mathbf{W}_{xh} \mathbf{x}_t + \mathbf{b}_h \right), \quad t = 1, 2, \dots, T
$$

其中 $\phi_h(\cdot)$ 是激活函数（通常为 $\tanh$ 或 $\text{ReLU}$）。

### 2.2 输出方程

$$
\mathbf{o}_t = \mathbf{W}_{hy} \mathbf{h}_t + \mathbf{b}_y
$$

$$
\hat{\mathbf{y}}_t = \phi_y(\mathbf{o}_t)
$$

其中 $\phi_y(\cdot)$ 根据任务选择：

- **分类任务**（如视频帧分类）：$\phi_y(\mathbf{o}_t) = \text{Softmax}(\mathbf{o}_t)$，即 $\hat{y}_{t,k} = \frac{e^{o_{t,k}}}{\sum_{j=1}^{d_y} e^{o_{t,j}}}$
- **回归任务**：$\phi_y(\mathbf{o}_t) = \mathbf{o}_t$（线性输出）

### 2.3 展开式（Unfolded View）

将递推式完全展开，$\mathbf{h}_t$ 可表示为所有历史输入的复合函数：

$$
\mathbf{h}_t = \phi_h\left( \mathbf{W}_{hh} \phi_h\left( \cdots \phi_h\left( \mathbf{W}_{hh}\mathbf{h}_0 + \mathbf{W}_{xh}\mathbf{x}_1 + \mathbf{b}_h \right) \cdots \right) + \mathbf{W}_{xh}\mathbf{x}_t + \mathbf{b}_h \right)
$$

这表明RNN理论上具有**无限记忆深度**（理论上依赖所有过去时刻）。

---

## 3. 损失函数（Loss Function）

对于**Many-to-Many（同步）**任务，每个时间步都有监督标签 $\mathbf{y}_t$，总损失为各步损失之和：

$$
\mathcal{L}(\Theta) = \sum_{t=1}^{T} \ell\left( \hat{\mathbf{y}}_t, \mathbf{y}_t \right)
$$

其中 $\ell$ 是单步损失函数：

- 分类任务：交叉熵损失 $\ell(\hat{\mathbf{y}}_t, \mathbf{y}_t) = -\sum_{k=1}^{d_y} y_{t,k} \log \hat{y}_{t,k}$
- 回归任务：均方误差 $\ell(\hat{\mathbf{y}}_t, \mathbf{y}_t) = \|\hat{\mathbf{y}}_t - \mathbf{y}_t\|_2^2$