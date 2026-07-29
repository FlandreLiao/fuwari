---
title: Pytorch 多维切片
published: 2026-07-26
description: 踩过的坑
tags: [Pytorch]
category: 工具
draft: false


---

:::warning
本文含 AI 生成内容
:::

处理 pytorch 张量，多维切片是最常用的访问方式。链式索引形式与之类似，使用链式索引来访问张量容易出错：

- **多维切片（推荐）**：使用逗号 `,` 分隔不同维度，如 `x[:, :, 0]`。它通常返回的是原数据的**视图（View）**，修改视图会影响原数据。
- **链式索引（不推荐用于赋值）**：使用多个方括号 `[][][]`，如 `x[:][:][0]`。每次索引都是独立的操作，返回的是**副本（Copy）**或中间结果，赋值时容易出错。

---

### 1. 多维切片（Multidimensional Slicing）

这是 NumPy/PyTorch 的标准用法，用逗号 `,` 分隔每个维度的索引。

#### 语法结构

```python
tensor[dim1_start:dim1_end:dim1_step, dim2_start:dim2_end:dim2_step, ...]
```

- 每个维度都可以使用 `start:stop:step` 切片语法。
- `:` 单独使用表示选取该维度的全部。
- 省略号 `...` 表示省略多个连续的全选维度。

#### 操作示例

```python
import torch

x = torch.arange(24).reshape(2, 3, 4)
print(x.shape)  # torch.Size([2, 3, 4])

# 1. 取第0维的第1个样本，第1维全部，第2维的前2个
result = x[1, :, :2]
print(result.shape)  # torch.Size([3, 2])

# 2. 步长切片：第0维隔一个取，第1维全部，第2维倒序
result = x[::2, :, ::-1]
print(result.shape)  # torch.Size([1, 3, 4])

# 3. 使用 ... 表示省略中间维度（与 :: 等价）
result = x[1, ...]  # 等价于 x[1, :, :]
print(result.shape)  # torch.Size([3, 4])
```

#### 底层行为：返回的是视图（View）

**关键点**：多维切片返回的是**原始数据的视图**，即共享内存。修改切片中的元素会直接影响原张量。

```python
x = torch.zeros(2, 3)
slice_view = x[0, :]  # 视图
slice_view[0] = 999
print(x)  # tensor([[999.,   0.,   0.], [  0.,   0.,   0.]])
```

---

### 2. 链式索引（Chained Indexing）

链式索引是先用一个方括号取到中间结果，再在这个结果上继续用方括号索引。

#### 语法结构

```python
tensor[dim1_index][dim2_index][dim3_index]...
```

#### 操作示例

```python
x = torch.arange(24).reshape(2, 3, 4)

# 1. 逐层索引
result = x[1][:][:2]
print(result.shape)  # torch.Size([3, 2])，结果与上面的多维切片相同

# 2. 等效步骤分解：
step1 = x[1]        # shape (3, 4)
step2 = step1[:]    # shape (3, 4) —— 这步完全多余
step3 = step2[:2]   # shape (2, 4) —— 注意！这里实际上只取了第1维的前2行
```

#### 底层行为：返回的是副本（Copy）或中间结果

**关键点**：每一次 `[]` 索引都是一个独立操作，会生成中间张量。它**不一定**保持与原数据的视图关系。

```python
x = torch.zeros(2, 3)
chained = x[0][0]  # 标量，已经是值拷贝
chained = 999       # 这不会修改原 x
print(x)            # tensor([[0., 0., 0.], [0., 0., 0.]]) —— 没变！
```

即使用链式索引做切片，情况也可能很复杂：

```python
x = torch.zeros(2, 3, 4)
x[0][:, :2] = 1  # 这行代码会报错，或者行为不如预期！
```

---

### 6. 高级技巧：整数索引与切片混合

可以混合使用整数索引和切片：

```python
x = torch.arange(24).reshape(2, 3, 4)

# 取第0维的第1个样本，第1维所有，第2维的第0和第2个
result = x[1, :, [0, 2]]
print(result.shape)  # torch.Size([3, 2])

# 取第0维的所有样本，第1维的第0个和第2个，第2维全部
result = x[:, [0, 2], :]
print(result.shape)  # torch.Size([2, 2, 4])
```

**注意**：使用整数列表索引（如 `[0, 2]`）时，返回的**通常不是视图，而是副本**。