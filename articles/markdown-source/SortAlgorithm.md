# 注意事项

在接下来的解释中，所有的 `comparer` 都会是

```c++
[](int left, int right)-> bool { return left >= right; }
```

也就是说我们以升序为例



主函数

```c++
int main(int argc, char* argv[])
{
    std::vector<int>* target = utils::construct_vector(50, 30);
    utils::print_vector(target);
    sort::algorithm_to_test(*target, [](int a, int b). bool { return a >= b; });
    utils::print_vector(target);
    return 0;
}
```

`utils` 成员函数

```c++
void utils::print_vector(vector<int>* target)
{
    for_each(target.begin(), target.end(), [](int num)
    {
        cout << num << " ";
    });
    cout << endl;
}

vector<int>* utils::construct_vector(int size, int max_val)
{
    srand(static_cast<unsigned int>(time(nullptr)));
    vector<int>* result = new vector<int>();
    for (int i = 0; i < size; ++i)
        result.push_back(rand() % (max_val - 1));
    return result;
}
```



# 冒泡排序

一种有手就行的排序算法

```c++
template <class T, class Fn>
vector<T>& bubble_sort(vector<T>& target, Fn comparer)
{
    for (int i = 0; i < target.size(); ++i)
    {
        bool flag = false;
        for (int j = 0; j < target.size() - 1; ++j)
        {
            if (comparer(target.at(j), target.at(j + 1)))
            {
                swap(target.at(j), target.at(j + 1));
                flag = true;
            }
        }
        if (!flag)
            break;
    }
    return target;
}
```



复杂度分析

- 时间复杂度 $O(n^2)$

- 空间复杂度 $O(1)$



# 选择排序

```c++
template <class T, class Fn>
static vector<T>& selection_sort(vector<T>& target, Fn comparer)
{
    for (int i = 0; i < target.size(); ++i)
    {
        int k = i;
        for (int j = i + 1; j < target.size(); ++j)
        {
            if (comparer(target.at(k), target.at(j)))
                k = j;
        }
        swap(target.at(i), target.at(k));
    }
    return target;
}
```

定义指针 `i`, `j`, `k`

`i` 作为准备被交换的元素的指针

`j` 作为向前寻找符合 `compareer` 函数的元素（例如小于或大于 $k$ ）的指针

`k` 作为记录当前**最符合** `comparer` 函数的元素（即最小值或最大值）的指针

也就是说在每次指针 `j` 遍历完成后，都会将最大值或最小值与 `i` 交换，实现排序



复杂度分析

- 时间复杂度 $O(n^2)$
- 空间复杂度 $O(1)$



# 插入排序

```c++
template <class T, class Fn>
static vector<T>& insertion_sort(vector<T>& target, Fn comparer)
{
    for (int i = 1; i < target.size(); ++i)
        for (int j = i; j > 0 && comparer(target.at(j - 1), target.at(j)); --j)
            swap(target.at(j - 1), target.at(j));
    return target;
}
```

定义指针 `i`, `j`

`i` 作为准备被交换的元素的指针

`j` 用于序列的前端寻找符合条件的元素对，并交换，实现排序



例：

​       `i`↓

1 5 6 12 7 12 6 10 14 12

​           `j`↑ 符合 `comparer` ，交换

1 5 6 7 12 12 6 10 14 12

逐渐有序



复杂度分析

- 时间复杂度 $O(n^2)$
- 空间复杂度 $O(1)$



# 希尔排序

名字不错，现在是2023/6/14，米哈游新作《星穹铁道》中角色同名

```c++
template <class T, class Fn>
static vector<T>& shell_sort(vector<T>& target, Fn comparer, int step = 8)
{
    while (step > 0)
    {
        for (int i = step; i < target.size(); ++i)
            for (int j = i; j >= step && comparer(target.at(j - step), target.at(j)); j -= step)
                swap(target.at(j - step), target.at(j));
        step /= 2;
    }
    return target;
}
```

与插入排序类似，但是引入了**步长**的概念

插入排序步长为1，而希尔排序更大，并逐步减小为1直到有序

在循环中， `i` 默认为 `step` ，每次检验都会缩小步长，可以更加快速地找到相距较远的符合 `comparer` 的元素



**注意**

- 希尔排序中 `j` 的循环条件之一为 `j >= step` 而不是插入排序中的 `j > step` ，如果更换为 `j > step` ，会导致序列的第一个元素被忽略



复杂度分析

- 时间复杂度 $O(nlog(n))$
- 空间复杂度 $O(1)$



# 快速排序

冒泡排序plus pro max

**快**就对了

主排序函数

```c++
template <class T, class Fn>
static vector<T>& quick_sort(vector<T>& target, Fn comparer)
{
    internal_quick_sort(target, comparer, 0, target.size() - 1);
    return target;
}
```

递归函数

```c++
static void internal_quick_sort(vector<T>& target, Fn comparer, int left, int right)
{
    if (left >= right) return;
    int i = left;
    int j = right;
    int pivot = target.at(i);
    
    while (i < j)
    {
        while (i < j && comparer(target.at(j), pivot))
            --j;
        target.at(i) = target.at(j);
        
        while (i < j && comparer(pivot, target.at(i)))
            ++i;
        target.at(j) = target.at(i);
    }
    
    target.at(i) = pivot;
    internal_quick_sort(target, comparer, left, i - 1);
    internal_quick_sort(target, comparer, i + 1, right);
}
```

在冒泡排序的基础上引入了**轴(pivot)**的概念

因为是升序排序，我们希望这个轴的**左边**全都**小于**轴，轴的**右边**全都**大于**轴



递归退出的条件为 `left > right` ，即范围 `[i, j]` 内只有一个元素时，直接退出

定义左指针 `i` 和右指针 `j` 分别默认指向第 `left` 和第 `right` 个元素

我们先用变量 `pivot` 记录轴的值



当 `i < j` 时，

我们需要用 `j` 在右边寻找第一个小于轴的值，也就是使序列无序的值，找到后，将其移动到轴的位置

还需要用 `i` 在左边寻找第一个大于轴的值，找到后，将其移动到轴的位置

当 `i = j` 时，

就将 `i` （或者说 `j` ）的位置用 `pivot` 的值覆盖

这样就做到了轴的左边都小于轴，轴的右边都大于轴



递归调用，再次处理轴左边的和右边的两半

那么左边的左边界就是 `left` 右边界为 `i - 1` （或 `j - 1` ），因为右边界是不包括轴自身的

同理，右边的左边界是 `i + 1` （或 `j + 1` ），右边界是 `right`

当递归结束后，序列就会变得有序



**注意**

- 每次寻找都只能找第一个不符合 `comparer` （即导致序列无序）的值，若一次性寻找多个则会反复覆盖，破坏序列



复杂度分析

- 时间复杂度 $O(nlog(n))$
- 空间复杂度 $O(log(n))$



# 归并排序

**归**到一个数组里合**并**起来

思路复杂度 $O(2^n)$

```c++
template <class T, class Fn>
static vector<T>& merge_sort(vector<T>& target, Fn comparer)
{
    vector<T>* result = new vector<T>(target.size());
    internal_merge(target, comparer, 0, target.size() - 1, *result);
    return target;
}
```

```c++
template <class T, class Fn>
static void internal_merge(vector<T>& target, Fn comparer, int left, int right, vector<T>& result)
{
    if (left == right)
        return;
    int mid = left + (right - left) / 2;
    internal_merge(target, comparer, left, mid, result);
    internal_merge(target, comparer, mid + 1, right, result);
    internal_merge_sort(target, comparer, left, mid, right, result);
}
```

```c++
template <class T, class Fn>
static void internal_merge_sort(vector<T>& target, Fn comparer, int left, int mid, int right, vector<T>& result)
{
    int i = left, j = mid + 1, k = left;
    while (i <= mid && j <= right)
        result[k++] = comparer(target[i], target[j]) ? target[j++] : target[i++];
    
    while (i <= mid)
        result[k++] = target[i++];
    while (j <= right)
        result[k++] = target[j++];
    
    for (int i = 0; i <= right; ++i)
        target[i] = result[i];
}
```

归并排序一共用到了三个函数

第一个函数 `merge_sort` 自然是外部调用的接口



我们先看第三个函数 `internal_merge_sort`

作为主力的递归调用函数，它会把 `target` 的 `[left, right]` 范围内的元素进行排序

归并排序其实要求的是两个各自有序的序列，然而我们这里只传入了一个序列的一段范围

但是我们通过 `left`，`mid` 和 `right` 切分了这段范围，使其看起来像是两个各自有序的序列

然后就是归并，哪个符合能够使序列趋向有序的（在这里是升序，即哪个小就取哪个）就把它添加到 `result` 的 `[left, right]` 内的对应位置

在将这段范围内的排好序之后，再放回到原序列 `target` 中

至于 `result` 序列的作用，在第二和第三个 `while` 循环中可以看出，如果没有这个序列，原序列是无法只用自身就将元素迁移的，有可能会造成覆盖丢失的问题



再看第二个函数 `internal_merge`

相较于第三个函数的名字，它少了 `sort` 的功能

（但是好像最难理解）

它是用来将无序的序列切分成若干序列的

不难看出，在一开始它会将整个序列的左半边一直递归到只剩一个元素，然后在返回的的过程中切分各自的右半段，并且切分完右半段之后进行排序

原理是什么呢？

首先，在上文所说，归并排序其实是要求两个序列各自有序的，但是我们的原始序列其实更趋向于杂乱无章

那么这个时候，就要从单个元素排起，一点一点将有序的元素聚集起来，因此在递归的时候是先递归到底然后一点点返回的



复杂度分析

- 时间复杂度 $O(nlog(n))$
- 空间复杂度 $O(n)$