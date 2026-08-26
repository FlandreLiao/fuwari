---
title: PyTorch Distributed all_to_all_single 详解
published: 2026-08-26
description: 从集合通信原理到 MoE 实战,以及理解它的最佳视角——分块矩阵转置
tags: [Pytorch]
category: 深度学习
draft: false
---

:::warning
本文含 AI 生成内容

GLM 5.3 的人机味比较重，但我懒得改了，就这样吧

:::

PyTorch Distributed 里大多数集合通信原语都好理解:`broadcast` 是一对多,`all_reduce` 是全员求和,`all_gather` 是全员收集。唯独 `all_to_all` 系列初看很绕——每个 rank 都要把自己的数据**切开,发给不同的 rank**,同时从所有 rank 各收一块。

这篇拆解 `dist.all_to_all_single`,并给出理解它语义的最佳视角:**分块矩阵转置**。

---

# 1. 为什么需要 all-to-all

先看已有原语解决不了的问题。

假设 4 个 rank 各持有一批 token,但 token 的目的端是乱的:rank 0 手里的 token 有的该去 rank 0,有的该去 rank 3……

```
rank 0: [R0 R3 R0 R1]     ← 本地 token 要去往不同 rank
rank 1: [R2 R0 R3 R0]
rank 2: [R1 R2 R2 R0]
rank 3: [R3 R1 R1 R2]
```

MoE 的 dispatch 阶段就要把每个 rank 的数据按目的端重排。这需要一种新的通信模式:

> 每个 rank 都给**每个 rank(包括自己)**发一段数据,且**发给各家的数据各不相同**。

对比一下常见原语:

| 原语 | 数据流向 | 特点 |
| --- | --- | --- |
| `broadcast` | 1 → all | 全员拿同一份 |
| `all_reduce` | all → all | 全员拿聚合结果(如求和) |
| `all_gather` | all → all | 全员拿所有人的拼接(完整副本) |
| `reduce_scatter` | all → all | 全员拿聚合结果的切片 |
| `all_to_all` | all → all | **发给每家的数据都不同** |

注意 `all_gather` 和 `all_to_all` 的区别:all_gather 之后每个 rank 都有**完整副本**;all_to_all 之后每个 rank 只持有**属于自己的那一列**。数据总量守恒,但被打散重组了。

用矩阵画出来(4 rank 等分切分):

```
发送 \ 接收   rank0   rank1   rank2   rank3
rank0       [  A00     A01     A02     A03  ]   ← rank0 把本地数据切成 4 段
rank1       [  A10     A11     A12     A13  ]
rank2       [  A20     A21     A22     A23  ]
rank3       [  A30     A31     A32     A33  ]

结果: rank i 的输出 = 第 i 列 = [A0i; A1i; A2i; A3i] 拼接
```

眼尖的话已经看出来了:**rank i 发出的是第 i 行,拿到的是第 i 列——这就是转置**。第 4 节展开。

---

# 2. API 签名拆解

```python
torch.distributed.all_to_all_single(
    output,                    # [out] 本 rank 的输出张量
    input,                     # [in]  本 rank 的输入张量
    output_split_sizes=None,   # List[int]: 我从每个 rank 收多大
    input_split_sizes=None,    # List[int]: 我发给每个 rank 多大
    group=None,
)
```

每个 rank 只看得到**自己**的输入输出;全局语义由所有 rank 的参数共同决定。

## input 与 input_split_sizes

`input` 沿第 0 维按 `input_split_sizes` 切成 world_size 段:

```
input  = [ chunk_0 | chunk_1 | ... | chunk_{W-1} ]

chunk_j 发给 rank j
```

`input.shape[0]` 必须等于 `sum(input_split_sizes)`。

## output 与 output_split_sizes

`output` 同样按 `output_split_sizes` 分段:

```
output = [ slot_0 | slot_1 | ... | slot_{W-1} ]

slot_j ← 来自 rank j 的数据
```

`output.shape[0]` 必须等于 `sum(output_split_sizes)`。

## 最大的坑:两个 split_sizes 都是"本 rank 视角"

这是新手最容易搞混的地方:

* `input_split_sizes`(本 rank):我发给 rank 0/1/2/… 各多少
* `output_split_sizes`(本 rank):我从 rank 0/1/2/… 各收多少

**一致性约束**:rank i 的 `input_split_sizes[j]` 必须等于 rank j 的 `output_split_sizes[i]`——我发给你的,必须和你要收的一致,否则 hang 或报错。

```
rank i 的 input_split_sizes[j]  ==  rank j 的 output_split_sizes[i]
        └──────── 这两个数描述同一块数据 Aij ────────┘
```

## 均分时可以偷懒

两个 split 都传 `None` 时,默认**均匀切分**:要求 `input.shape[0]` 能被 world_size 整除,每份 `input.shape[0] // W`。这是最常用的形态。

## 和 `all_to_all` 的区别

| | `all_to_all_single` | `all_to_all` |
| --- | --- | --- |
| 输入形态 | 一个大 tensor | tensor list(发往各 rank 的 list) |
| 输出形态 | 一个大 tensor | tensor list(来自各 rank 的 list) |
| 变长支持 | 通过 split_sizes | 各 rank 的 list 长度可不同 |
| 额外开销 | 无 | list 构建与拆分 |

`all_to_all_single` 省掉了 Python list 的构建开销,是高性能实现(torchtitan、Megatron 等)的首选。

---

# 3. 最小可运行示例

单机多进程 + gloo 后端,CPU 即可跑,不需要 GPU:

```python
# a2a_demo.py
import os
import torch
import torch.distributed as dist
import torch.multiprocessing as mp

WORLD_SIZE = 4

def run(rank, world_size):
    os.environ.setdefault("MASTER_ADDR", "localhost")
    os.environ.setdefault("MASTER_PORT", "29500")
    dist.init_process_group("gloo", rank=rank, world_size=world_size)

    # 本 rank 的输入:全部填 rank 编号,方便追踪数据流向
    inp = torch.full((8,), float(rank))
    out = torch.empty(8)

    # 均分:每 rank 发 2 个、收 2 个
    dist.all_to_all_single(out, inp)

    print(f"rank {rank}: input={inp.tolist()} -> output={out.tolist()}")
    dist.destroy_process_group()

if __name__ == "__main__":
    mp.spawn(run, args=(WORLD_SIZE,), nprocs=WORLD_SIZE, join=True)
```

运行 `python a2a_demo.py`,输出(顺序可能不同):

```
rank 0: input=[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] -> output=[0.0, 0.0, 1.0, 1.0, 2.0, 2.0, 3.0, 3.0]
rank 1: input=[1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] -> output=[0.0, 0.0, 1.0, 1.0, 2.0, 2.0, 3.0, 3.0]
rank 2: input=[2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0] -> output=[0.0, 0.0, 1.0, 1.0, 2.0, 2.0, 3.0, 3.0]
rank 3: input=[3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0] -> output=[0.0, 0.0, 1.0, 1.0, 2.0, 2.0, 3.0, 3.0]
```

追踪一下数据流向:rank 0 的输入是 8 个 `0.0`,均分后前 2 个发给 rank 0 自己,第 3-4 个发给 rank 1……每个 rank 的输出前 2 个来自 rank 0,接着 2 个来自 rank 1,以此类推。

你可能会问:输出是所有人数据的拼接,这和 `all_gather` 结果一样啊?

区别在于**输入是否被切开发往不同目的地**。这个例子里每个 rank 的输入恰好是同质的(全是自己的编号),所以"按目的切开"退化成了"原样均分"。真实场景里输入是**按目的端排好序**的(见第 5 节),发出去的段各不相同,输出就变成"属于我的那段"——这才是 all_to_all 的意义。

---

# 4. 转置视角:all_to_all_single 就是分块矩阵转置

这是理解 `all_to_all_single` 最本质的视角。

## 全局矩阵

把**所有 rank 的输入张量按行堆叠**,想象成一个 W×W 分块矩阵(等分时每块大小相同):

```
            接收方 →   rank0   rank1   rank2   rank3
发送方 ↓
rank0                [ A00     A01     A02     A03 ]
rank1                [ A10     A11     A12     A13 ]
rank2                [ A20     A21     A22     A23 ]
rank3                [ A30     A31     A32     A33 ]

其中 Aij = rank i 的输入中,切出来发给 rank j 的那一段
```

all_to_all_single 执行完后:

```
rank i 的输出 = 矩阵的第 i 列 = [A0i; A1i; A2i; A3i]  (按发送方顺序拼接)
```

即:

```
全局效果:  A ──转置──>  Aᵀ

rank i 持有:  第 i 行 (转置前)  ──>  第 i 列 (转置后)
```

**all_to_all_single 就是把这个分块矩阵按块转置,再把列分发给各 rank。**

## 用第 3 节的例子对照

4 个 rank、每个输入 8 个相同值、均分成 4 段(每块 2 个元素)。全局矩阵:

```
A = [ 00 00 | 00 00 | 00 00 | 00 00 ]     ← rank0 输入,4 段分别发往 rank0..3
    [ 11 11 | 11 11 | 11 11 | 11 11 ]     ← rank1
    [ 22 22 | 22 22 | 22 22 | 22 22 ]     ← rank2
    [ 33 33 | 33 33 | 33 33 | 33 33 ]     ← rank3
```

转置后按列读出:

```
第 0 列 = [00 00; 11 11; 22 22; 33 33] = [0,0,1,1,2,2,3,3]  → rank0 的输出
第 1 列 = 同上                                            → rank1 的输出
...
```

每个 rank 的输出都是 `[0,0,1,1,2,2,3,3]`——和第 3 节的运行结果完全一致。

## 非均匀切分同样成立

变长 split 只是让块大小不一,转置关系不变:

```
发送\接收   rank0     rank1     rank2
rank0     [ A00(3)    A01(2)    A02(1) ]
rank1     [ A10(1)    A11(3)    A12(2) ]
rank2     [ A20(2)    A21(1)    A22(3) ]
```

rank 0 的输出 = 第 0 列 = `[A00; A10; A20]`,大小依次为 3、1、2。**允许某块大小为 0**——MoE 里专家负载不均时这是常态,后文会用到。

## 为什么这个视角有用

1. **验证语义**:写出全局矩阵,按列读出,就是每个 rank 应得的输出。检查分布式代码时不用逐 rank 推演参数
2. **理解约束**:"我发你的 = 你收我的"(`input_split_sizes[j] == output_split_sizes[i]`)正是转置的对称性:块 `Aij` 的大小,从行方向看(发送方视角)和列方向看(接收方视角)必须是同一个数
3. **举一反三**:`all_gather` 相当于"每 rank 复制走所有行",`reduce_scatter` 相当于"先按列聚合再把列发走"——矩阵视角下这些原语的关系一目了然

---

# 5. 变长拆分实战

真实场景几乎不会均分。MoE 里每个专家分到的 token 数天然不等。

## 切分表

先规划一张**发送切分表** `SEND_TABLE[i][j]` = rank i 发给 rank j 的元素数:

```
SEND_TABLE = [ [3, 2, 1],     ← rank 0 发 3/2/1 个给 rank 0/1/2
               [1, 3, 2],     ← rank 1
               [2, 1, 3] ]    ← rank 2
```

每个 rank 的参数从表里读取:

* `input_split_sizes` = 表的**第 rank 行**(我的发送意图)
* `output_split_sizes` = 表的**第 rank 列**(所有人发给我的数量)

转置视角在这里直接落地:`output_split_sizes = Aᵀ 的第 rank 行`。

## 代码

```python
# a2a_variable.py
import os
import torch
import torch.distributed as dist
import torch.multiprocessing as mp

WORLD_SIZE = 3

# SEND_TABLE[i][j]: rank i 发给 rank j 的元素数
SEND_TABLE = [
    [3, 2, 1],
    [1, 3, 2],
    [2, 1, 3],
]

def run(rank, world_size):
    os.environ.setdefault("MASTER_ADDR", "localhost")
    os.environ.setdefault("MASTER_PORT", "29501")
    dist.init_process_group("gloo", rank=rank, world_size=world_size)

    send_sizes = SEND_TABLE[rank]                                  # 第 rank 行
    recv_sizes = [SEND_TABLE[i][rank] for i in range(world_size)]  # 第 rank 列

    # 输入按目的端排好序:前 3 个去 rank0,接着 2 个去 rank1 ...
    # 加 rank*100 偏移,让来源一目了然
    inp = torch.arange(sum(send_sizes), dtype=torch.float32) + rank * 100
    out = torch.empty(sum(recv_sizes))

    dist.all_to_all_single(
        out, inp,
        output_split_sizes=recv_sizes,
        input_split_sizes=send_sizes,
    )

    print(f"rank {rank}: send={send_sizes} recv={recv_sizes} output={out.tolist()}")
    dist.destroy_process_group()

if __name__ == "__main__":
    mp.spawn(run, args=(WORLD_SIZE,), nprocs=WORLD_SIZE, join=True)
```

运行 `python a2a_variable.py`,输出:

```
rank 0: send=[3, 2, 1] recv=[3, 1, 2] output=[0.0, 1.0, 2.0, 100.0, 200.0, 201.0]
rank 1: send=[1, 3, 2] recv=[2, 3, 1] output=[3.0, 4.0, 101.0, 102.0, 103.0, 202.0]
rank 2: send=[2, 1, 3] recv=[1, 2, 3] output=[5.0, 104.0, 105.0, 203.0, 204.0, 205.0]
```

用转置视角核对 rank 2 的输出:第 2 列 = `[A02; A12; A22]`:

* `A02` = rank 0 输入的末 1 个 = `[5]`
* `A12` = rank 1 输入的末 2 个 = `[104, 105]`
* `A22` = rank 2 输入的末 3 个 = `[203, 204, 205]`

拼接 = `[5, 104, 105, 203, 204, 205]`,与实际输出一致。✓

---

# 6. 实战场景

## 6.1 MoE 的 dispatch / combine

MoE 层的核心通信就是两次 all_to_all:

```
token → 按 gate 选出专家 → 按专家所在 rank 排序 (dispatch 前)
        ↓
    all_to_all_single ①  dispatch:各 rank 的 token 发往专家所在 rank
        ↓
    专家计算 (each rank 只算本地专家)
        ↓
    all_to_all_single ②  combine:结果原路发回
        ↓
    按原顺序还原 (scatter_add / index_add)
```

dispatch 的输入按目的 rank 排序后,`input_split_sizes` 就是排序时的 bucket 大小(`torch.bincount(perm // W)` 一类操作可得),`output_split_sizes` 需要一次 `all_to_all` 交换或提前算好。这正是第 5 节切分表的来源。

简化代码:

```python
# token: 本 rank 的所有 token;expert_id: 每个 token 的目标专家
# 假设专家 e 放在 rank e % world_size 上
target_rank = expert_id % world_size

# 1. 按目标 rank 稳定排序
sort_key = target_rank * LARGE + torch.arange(len(token))
perm = torch.argsort(sort_key)
send_sizes = torch.bincount(target_rank, minlength=world_size)

# 2. 交换接收意图(每家都要知道别人发来多少)
recv_sizes = torch.empty(world_size, dtype=torch.long)
dist.all_to_all_single(recv_sizes, send_sizes)

# 3. dispatch
inp = token[perm].contiguous()
buf = torch.empty(int(recv_sizes.sum()), *token.shape[1:], dtype=token.dtype)
dist.all_to_all_single(
    buf, inp,
    output_split_sizes=recv_sizes.tolist(),
    input_split_sizes=send_sizes.tolist(),
)

# ... 本地专家计算 ...

# 4. combine:反向再做一次,split 参数互换即可原路发回
```

注意 `all_to_all_single` 也能用来交换元信息(接收意图)本身——split 表也是数据。

## 6.2 序列并行(DeepSpeed Ulysses)

长序列训练里把序列切到各 rank,attention 的 head 维度各 rank 各持一部分。Ulysses 在计算 QKV 前后用 all_to_all 在"序列维切分"和"head 维切分"之间切换:

```
[seq 切分] --all_to_all--> [head 切分] → 本地做完整 attention → --all_to_all--> [seq 切分]
```

这里通常是均分,split 参数都不用传。PyTorch 官方 blog *Scaling PyTorch on H100s with TPUs in the Cloud* 与 DeepSpeed Ulysses 的实现细节是很好的延伸阅读。

## 6.3 其他

* **Tensor 并行下的激活重排**:MLP/Attention 列切分输出后重排回行切分
* **数据并行的 batch 重排**:序列维样本跨卡交换
* 任何"数据按 key 归属重分布"的问题——本质都是分块转置

---

# 7. 常见坑

## split 尺寸不匹配

`input.shape[0] != sum(input_split_sizes)` 直接报错;更隐蔽的是 rank 间不一致(`Aij` 从行列两个方向读出来的数不同),gloo 下常见表现是**hang 死**而不是报错,排查极痛苦。用转置视角先自查切分表。

## 输入必须连续

`all_to_all_single` 要求输入在内存中 contiguous(前面 dispatch 代码里 `token[perm]` 后接 `.contiguous()` 的原因)。高级索引、`narrow` 之后的不连续视图会报错,先 `.contiguous()` 或用能返回连续结果的索引。

## dtype / device 一致

输出张量的 dtype、device 必须和输入一致,且 `output` 要预先分配好正确大小。NCCL 下还要求 tensor 在当前 device 上。

## in-place 不支持

`output` 和 `input` 必须是两个不同的 tensor,不能原地完成。

---

# 8. 总结

| | 说明 |
| --- | --- |
| 语义 | 每 rank 沿 dim0 按目的端切分输入,发给各 rank;输出 = 收到的段按发送方顺序拼接 |
| 本质视角 | **W×W 分块矩阵转置**:行 = 发送前持有,列 = 接收后持有 |
| `input_split_sizes` | 第 rank 行:我发给各家多少 |
| `output_split_sizes` | 第 rank 列:各家发给我多少 |
| 一致性约束 | `input_split_sizes[i][j] == output_split_sizes[j][i]`(转置对称) |
| 均分捷径 | 两个 split 传 `None`,自动均匀切分 |
| 典型应用 | MoE dispatch/combine、序列并行、激活重排 |

一句话:**all_to_all_single 是一次跨 rank 的分块矩阵转置——写代码时按行填表,验证结果时按列读出。**
