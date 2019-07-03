---
layout:     post
title:      "逆天改命，Java 反射的黑科技"
author:     "刘文俊"
top: true
tags:
    - Java
---

<blockquote class="blockquote-center">一个人的命运啊，当然要靠自我奋斗，但也要考虑到历史的进程。——长者。</blockquote>
众所周知，反射是 Java 的一大利器，它可以做到许多看起来不可思议的事情，但是用得不好也会给我们的系统挖下许多坑。下面就介绍一个反射的黑科技，请充分理解并消化里面的知识<del>，并把这项技术用到实际的项目中去</del>。

在开始之前，我们先来念两句诗，代码如下：

````java
	public static void main(String[] args) {
	    recitePoems(false);
	    recitePoems(true);
	}
	
	private static void recitePoems(Boolean b) {
	    if (b) {
	        System.out.println("苟利国家生死以");
	    } else {
	        System.out.println("岂因祸福避趋之");
	    }
	}
````

<!-- more -->

上面代码的输出是：

````plain
	岂因祸福避趋之
	苟利国家生死以
````

不对呀，反了反了，念诗都念错，姿势水平还是太低。怎么改呢，很简单，把两次 `recitePoems` 方法调用的参数调转过来就可以了？ naïve，本文的目的是介绍黑科技，当然不会用这种寻常的办法解决问题。

不卖关子了，直接上代码吧：

````Java
private static void doSomeMagic() throws Exception {
    Field modifiersField = Field.class.getDeclaredField("modifiers");
    modifiersField.setAccessible(true);

    Field trueField = Boolean.class.getDeclaredField("TRUE");
    modifiersField.set(trueField, trueField.getModifiers() & ~Modifier.FINAL);

    Field falseField = Boolean.class.getDeclaredField("FALSE");
    modifiersField.set(falseField, falseField.getModifiers() & ~Modifier.FINAL);

    Boolean trueValue = true;
    trueField.set(null, false);
    falseField.set(null, trueValue);
}
````

接下来，只需要在 `main` 方法的开头调用这个名为 `doSomeMagic `的<del>膜法</del>方法就好了：

````java
	public static void main(String[] args) throws Exception {
	    doSomeMagic();
	
	    recitePoems(false);
	    recitePoems(true);
	}
````

修改完毕之后，我们得到了期望的输出：

````plain
	苟利国家生死以
	岂因祸福避趋之
````

那么，`doSomeMagic` 方法到底干了什么呢？很简单，它交换了 `Boolean.TRUE` 和 `Boolean.FALSE` 的值。为了能够重写它们的值，我们需要去掉它们的 final 修饰符，这就是 `xxxField.getModifiers() & ~Modifier.FINAL` 的作用。

交换 `Boolean.TRUE` 和 `Boolean.FALSE `的值，为什么能够改变原代码的运行逻辑呢？我们看到，`recitePoems` 方法的形参是 `boolean` 的包装类型 `Boolean`，直接将 `true` 和 `false` 作为实参调用它时，将会发生自动装箱操作。而自动装箱操作是通过调用 `Boolean.valueOf()` 方法完成的，我们看看这个方法的源码：

````java
	/**
	 * Returns a {@code Boolean} instance representing the specified
	 * {@code boolean} value.  If the specified {@code boolean} value
	 * is {@code true}, this method returns {@code Boolean.TRUE};
	 * if it is {@code false}, this method returns {@code Boolean.FALSE}.
	 * If a new {@code Boolean} instance is not required, this method
	 * should generally be used in preference to the constructor
	 * {@link #Boolean(boolean)}, as this method is likely to yield
	 * significantly better space and time performance.
	 *
	 * @param  b a boolean value.
	 * @return a {@code Boolean} instance representing {@code b}.
	 * @since  1.4
	 */
	public static Boolean valueOf(boolean b) {
	    return (b ? TRUE : FALSE);
	}
````

可以看到，`Boolean.valueOf()` 方法直接使用了 `Boolean.TRUE` 和 `Boolean.FALSE` 两个常量。这就是我们能做到如此“是非颠倒”的原因。

所以说，一个程序的命运啊，当然要靠自我的奋斗，但也要考虑历史的进程。你绝对不会知道，好好的一个 `true`，怎么就变成 `false` 了呢。

这篇文章讲了这么久也没别的，大概三件事：一个，去掉 `Boolean.TRUE` 和 `Boolean.FALSE` 的 final 修饰符；第二个，交换了它们的值；第三个，就是基本类型自动装箱的细节；如果说还有一点成绩，那就是在公司每个项目的 `main` 方法上调用了一下 `doSomeMagic` 方法，这对于被炒鱿鱼的命运有很大的关系。

很惭愧，就做了一点微小的工作，谢谢大家。