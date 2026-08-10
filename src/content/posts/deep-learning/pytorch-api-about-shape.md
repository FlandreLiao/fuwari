---
title: Pytorch 有关 shape 和 memory layout 的 API
published: 2026-08-10
description: shape 即 stride
tags: [Pytorch]
category: 深度学习
draft: false
---

:::warning
本文含 AI 生成内容
:::

PyTorch 中这几个 API 都和 **Tensor 的形状（shape）与内存布局（memory layout）** 有关。核心区别：

* `view`：**只改变视图，不搬数据**（要求连续内存）
* `reshape`：**尽量不搬数据，必要时复制**
* `contiguous`：**把 Tensor 变成连续内存**
* `transpose`：**交换两个维度**
* `permute`：**任意重排维度**

理解它们需要先理解 **stride（步长）**。

---

## 1. Tensor 的 shape 和 stride

一个 Tensor 不仅有：

```python
x.shape
```

还有：

```python
x.stride()
```

stride 表示每个维度移动一个单位，需要跳过多少个内存元素。

例如：

```python
x = torch.arange(12).reshape(3,4)
```

内存：

```
0 1 2 3
4 5 6 7
8 9 10 11
```

shape:

```
(3,4)
```

stride:

```
(4,1)
```

含义：

* 行方向移动：跳 4 个元素
* 列方向移动：跳 1 个元素

访问：

```
x[i,j]

地址 = i*4 + j*1
```

---

# 2. view()

## 作用

改变 Tensor 的 shape，但是：

> 不改变底层数据，不复制内存

例如：

```python
x = torch.arange(12)

y = x.view(3,4)
```

原始：

```
[0 1 2 3 4 5 6 7 8 9 10 11]
```

view 后：

```
[
 [0 1 2 3],
 [4 5 6 7],
 [8 9 10 11]
]
```

数据没有移动。

---

## 要求

`view()` 要求 Tensor 是 contiguous：

```python
x.is_contiguous()
```

必须：

```
True
```

否则：

```python
x = torch.arange(12).reshape(3,4)

y = x.transpose(0,1)

y.view(-1)
```

报错：

```
RuntimeError:
view size is not compatible with input tensor's size and stride
```

原因：

transpose 改变了 stride。

---

# 3. reshape()

## 作用

和 view 类似：

```python
x.reshape(new_shape)
```

但是更智能。

规则：

```
reshape
 |
 |-- 如果可以 view
 |        ↓
 |      返回 view
 |
 |-- 如果不能 view
          ↓
        自动 copy
```

例如：

```python
x = torch.arange(12).reshape(3,4)

y = x.transpose(0,1)

z = y.reshape(-1)
```

不会报错。

因为：

```
transpose 后不是 contiguous
```

reshape 会：

```
copy 数据
↓
创建连续 Tensor
↓
改变 shape
```

---

## view vs reshape 总结

|              | view  | reshape |
| ------------ | ----- | ------- |
| 改变shape      | √     | √       |
| 复制数据         | ❌     | 可能      |
| 要求contiguous | √     | ❌       |
| 速度           | 更快    | 可能稍慢    |
| 推荐           | 确定连续时 | 一般使用    |

通常：

```python
x.reshape(...)
```

比：

```python
x.contiguous().view(...)
```

更安全。

---

# 4. contiguous()

## 作用

生成一个连续内存 Tensor。

例如：

```python
x = torch.arange(12).reshape(3,4)

y = x.transpose(0,1)

print(y.is_contiguous())
```

输出：

```
False
```

因为 transpose 只是修改：

```
shape
stride
```

没有搬数据。

调用：

```python
z = y.contiguous()
```

现在：

```
z.is_contiguous()
```

输出：

```
True
```

内存重新排列：

原：

```
0 1 2 3
4 5 6 7
8 9 10 11
```

transpose 后逻辑：

```
0 4 8
1 5 9
2 6 10
3 7 11
```

contiguous 会真正复制成：

```
0 4 8
1 5 9
2 6 10
3 7 11
```

---

# 5. transpose()

## 作用

交换两个维度。

例如：

```python
x.shape
```

```
(2,3,4)
```

执行：

```python
y=x.transpose(0,2)
```

得到：

```
(4,3,2)
```

只交换：

```
dim0 <-> dim2
```

---

注意：

transpose **不会移动数据**。

只是改变：

```
shape
stride
```

所以：

```python
y.is_contiguous()
```

通常：

```
False
```

---

# 6. permute()

## 作用

任意维度重排。

例如：

```python
x.shape=(2,3,4)
```

执行：

```python
y=x.permute(2,0,1)
```

得到：

```
(4,2,3)
```

表示：

```
new_dim0 = old_dim2
new_dim1 = old_dim0
new_dim2 = old_dim1
```

---

## transpose 是 permute 的特殊情况

例如：

```python
x.transpose(0,1)
```

等价于：

```python
x.permute(1,0,2)
```

对于三维 Tensor：

```
transpose:
交换两个轴

permute:
任意排列轴
```

---

# 7. 常见组合

## 情况1：Transformer 中

例如：

输入：

```
(batch, seq, hidden)
```

Attention 要：

```
(batch, head, seq, dim)
```

通常：

```python
x = x.reshape(batch, seq, head, dim)

x = x.permute(0,2,1,3)
```

此时：

```
(batch, seq, head, dim)

↓

(batch, head, seq, dim)
```

但是：

```python
x.is_contiguous()
```

可能：

```
False
```

如果后面需要 view：

```python
x = x.contiguous().view(...)
```

---

## 情况2：矩阵转置后 flatten

错误：

```python
x = x.transpose(0,1)

x.view(-1)
```

因为：

```
non-contiguous
```

正确：

```python
x = x.transpose(0,1).contiguous().view(-1)
```

或者：

```python
x.reshape(-1)
```

---

# 8. 一张表总结

| 操作         | 改变shape | 改变stride | 移动数据 | 需要contiguous |
| ---------- | ------- | -------- | ---- | ------------ |
| view       | √       | ❌        | ❌    | √            |
| reshape    | √       | 可能       | 可能   | ❌            |
| transpose  | √       | √        | ❌    | ❌            |
| permute    | √       | √        | ❌    | ❌            |
| contiguous | ❌       | √        | √    | ❌            |

---
