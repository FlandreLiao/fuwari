---
title: BatchNorm 和 LayerNorm
published: 2026-07-26
description: 深度学习的两大归一化方法
tags: [知识储备]
category: 深度学习
draft: false
---

# 概述

深度学习有两大归一化方法，BatchNorm 和 LayerNorm。

BatchNorm 看的是**同一个特征**在**不同样本**间的分布，擅长 CNN 视觉任务。
LayerNorm 看的是**同一个样本**内**不同特征**间的分布，擅长 NLP 序列任务。

# Batch Normalization

##  总体作用

**Batch Normalization（批归一化）** 是一个可微分的**归一化变换**，它将一个小批量（minibatch）数据 ( $ X \in \mathbb{R}^{N \times D} $ ) 的每一维（每个特征通道）独立地归一化为**零均值、单位方差**的分布，然后再通过**可学习的仿射变换**进行缩放和平移。

整体数学表达式为：
$$
\text{BN}(X) = \gamma \odot \frac{X - \mu_{\text{batch}}}{\sqrt{\sigma_{\text{batch}}^2 + \epsilon}} + \beta
$$
其中：

-  N ：批量大小（batch size）
-  D ：特征维度（feature dimension）
- $ \odot $ ：逐元素乘法（Hadamard product）
- $ \gamma \in \mathbb{R}^D $：可学习的**缩放参数**（scale）
- $ \beta \in \mathbb{R}^D $：可学习的**偏移参数**（shift）
- $\mu_{\text{batch}} \in \mathbb{R}^D $：当前批次的**样本均值**
- $\sigma_{\text{batch}}^2 \in \mathbb{R}^D $：当前批次的**样本方差**（无偏修正为 False）
- $\epsilon > 0$ ：小常数，防止除零（数值稳定性）



## 二、训练阶段（`mode == "train"`）的数学流程

### 步骤 1：计算批次统计量

$$
\mu_{\text{batch}} = \frac{1}{N} \sum_{i=1}^{N} x_i \in \mathbb{R}^D
$$

$$
\sigma_{\text{batch}}^2 = \frac{1}{N} \sum_{i=1}^{N} (x_i - \mu_{\text{batch}})^2 \in \mathbb{R}^D
$$

其中 $ x_i \in \mathbb{R}^D $ 表示第 $ i $ 个样本的特征向量。

**注意**：这里使用的是**无偏修正为 False** 的方差（即除以 $ N $ 而不是 $ N-1 $），因为 Batch Norm 的原始论文中使用的是总体方差（population variance）。

---

### 步骤 2：归一化（Normalization）

$$
\hat{x}_i = \frac{x_i - \mu_{\text{batch}}}{\sqrt{\sigma_{\text{batch}}^2 + \epsilon}} \in \mathbb{R}^D, \quad \forall i = 1, ..., N
$$

这保证了：

$$
\mathbb{E}_{i}[\hat{x}_i] = 0, \quad \text{Var}_{i}[\hat{x}_i] = 1
$$

即归一化后的数据在每个特征维度上均值为 0、方差为 1。

---

### 步骤 3：仿射变换（Scale and Shift）

$$
y_i = \gamma \odot \hat{x}_i + \beta \in \mathbb{R}^D, \quad \forall i = 1, ..., N
$$

其中 $ \gamma, \beta $ 是可学习的参数。这一步**恢复网络的表达能力**——如果归一化后的分布对当前任务不是最优的，网络可以学习到合适的均值和方差。

---

### 步骤 4：更新全局运行统计量（Running Statistics）

训练时，我们用指数移动平均（Exponential Moving Average, EMA）来估计**全局**的均值和方差，供测试时使用：

$$
\mu_{\text{running}} \leftarrow \text{momentum} \cdot \mu_{\text{running}} + (1 - \text{momentum}) \cdot \mu_{\text{batch}}
$$

$$
\sigma_{\text{running}}^2 \leftarrow \text{momentum} \cdot \sigma_{\text{running}}^2 + (1 - \text{momentum}) \cdot \sigma_{\text{batch}}^2
$$

其中 $ \text{momentum} \in (0, 1) $ 是一个超参数（通常取 0.9）。这个更新操作在数学上是一个**加权平均**，使得 running statistics 能够平滑地跟踪数据分布的变化。

**关键点**：这一步必须用 `torch.no_grad()` 包裹，因为它**不是反向传播的一部分**——它只是为测试阶段维护统计量，不需要计算梯度。

---

## 三、测试阶段（`mode == "test"`）的数学流程

在测试（推理）时，我们不再依赖当前批次的统计量（因为可能只有一个样本，或批次分布不稳定），而是使用训练阶段累积的**全局统计量**：

$$
y_i = \gamma \odot \frac{x_i - \mu_{\text{running}}}{\sqrt{\sigma_{\text{running}}^2 + \epsilon}} + \beta, \quad \forall i
$$

这与训练时的公式结构完全相同，只是将 $ \mu_{\text{batch}}, \sigma_{\text{batch}}^2 $ 替换为 $ \mu_{\text{running}}, \sigma_{\text{running}}^2 $。

# Layer Normalization

## 一、函数总体作用

**Layer Normalization（层归一化）** 是一个独立于批次的归一化变换。它对**每个样本独立地**，在其**特征维度**上进行归一化，使其均值为 0、方差为 1，然后再通过可学习的仿射变换进行缩放和平移。

整体数学表达式为：

$$
\text{LN}(X) = \gamma \odot \frac{X - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta
$$

其中：

- $ X \in \mathbb{R}^{N \times D} $：输入矩阵，$ N $ 为批次大小，$ D $ 为特征维度
- $ \gamma \in \mathbb{R}^D $：可学习的**缩放参数**（scale）
- $ \beta \in \mathbb{R}^D $：可学习的**偏移参数**（shift）
- $\epsilon > 0$：小常数，防止除零
- $ \odot $：逐元素乘法（Hadamard product）

---

## 二、与 BatchNorm 的核心差异

| 归一化类型    | 统计量计算维度  | 均值 $ \mu $ 的形状 | 方差 $ \sigma^2 $ 的形状 | 训练/测试是否一致            |
| :------------ | :-------------- | :-------------------- | :------------------------- | :--------------------------- |
| **BatchNorm** | 跨样本（dim=0） | $ (1, D) $          | $ (1, D) $               | ❌ 不一致（需 running stats） |
| **LayerNorm** | 跨特征（dim=1） | $ (N, 1) $          | $ (N, 1) $               | ✅ 完全一致                   |

**关键洞察**：LayerNorm 的统计量依赖于**当前样本本身**，而不依赖于批次中的其他样本，因此：

- 训练和推理行为完全一致（无 running statistics）
- 对批次大小不敏感（即使 batch_size = 1 也能正常工作）

---

## 三、训练/推理阶段（`layernorm_forward`）的数学流程

### 步骤 1：计算每个样本的均值和方差

对每个样本 $ i \in \{1, ..., N\} $：

$$
\mu_i = \frac{1}{D} \sum_{j=1}^{D} x_{ij} \in \mathbb{R} \quad (\text{标量})
$$

$$
\sigma_i^2 = \frac{1}{D} \sum_{j=1}^{D} (x_{ij} - \mu_i)^2 \in \mathbb{R} \quad (\text{标量})
$$

**向量化形式**（代码实现）：

$$
\mu = \frac{1}{D} \sum_{j=1}^{D} X[:, j] \in \mathbb{R}^{N} \quad \text{reshape to } (N, 1)
$$

$$
\sigma^2 = \frac{1}{D} \sum_{j=1}^{D} (X[:, j] - \mu)^2 \in \mathbb{R}^{N} \quad \text{reshape to } (N, 1)
$$

**关键点**：`keepdim=True` 保证 $ \mu $ 和 $ \sigma^2 $ 的形状为 $ (N, 1) $，以便后续广播（broadcast）与 $ X $ 的 $ (N, D) $ 进行逐元素运算。

---

### 步骤 2：归一化（Normalization）

$$
\hat{X} = \frac{X - \mu}{\sqrt{\sigma^2 + \epsilon}} \in \mathbb{R}^{N \times D}
$$

这保证了对于每个样本 $ i $：

$$
\mathbb{E}_{j}[\hat{x}_{ij}] = 0, \quad \text{Var}_{j}[\hat{x}_{ij}] = 1
$$

即归一化后的数据在每个样本的**特征维度上**均值为 0、方差为 1。

---

### 步骤 3：仿射变换（Scale and Shift）

$$
Y = \gamma \odot \hat{X} + \beta \in \mathbb{R}^{N \times D}
$$

其中 $ \gamma, \beta \in \mathbb{R}^D $ 是可学习参数，通过反向传播更新。