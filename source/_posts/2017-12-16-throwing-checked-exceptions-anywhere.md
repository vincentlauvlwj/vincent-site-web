---
layout:     post
title:      "绕过 Java 编译器检查，在任何地方抛出受检异常"
author:     "刘文俊"
date:       2017-12-16
top: true
tags:
    - Java
---

这次我要写的内容也是一个黑科技，就是在实际工作中没卵用的那种。秉着实用主义至上的小伙伴们可以绕道，看了这篇文章也不会对您的工作有任何帮助。但是如果您喜欢抱着娱乐的精神钻研一下这些 tricks，我们就开始吧。

## Java 异常简介

众所周知，Java 的所有异常都派生自 Throwable 类，在继承结构上，从 Throwable 派生出了 Error 和 Exception 两大类。其中，Error 表示系统级别的严重程序错误，一般由 JVM 抛出，我们也不应该捕获这类异常，用户自定义的异常一般都派生自 Exception 类。

从是否被编译器强制检查一点，异常又可分为受检异常(Checked Exception)和未受检异常(Unchecked Exception)。未受检异常派生自 Error 或者 RuntimeException，表示不可恢复的程序错误，典型例子有 AssertionError、NullPointerException 等，编译器不会强制我们捕获这类异常。受检异常则是除了 Error/RuntimeException 之外，派生自 Throwable 或者 Exception 的其他异常，比如 IOException、SQLException 等。如果一个方法声明自己可能抛出受检异常，那么编译器会强制它的调用者必须使用 try-catch 捕获此异常，或者在自己的方法中加上 throws 声明将异常继续传播给外界。

![](/img/in-post/java-exception-hierarchy.jpg)

多年以来，Java 中受检异常的设计一直颇受争议，反对者认为，受检异常容易破坏方法声明的兼容性，会使代码的可读性降低，还增加开发的工作量等等。当然也有一些支持者，他们认为受检异常可以强迫程序员去思考，有助于他们写出更健壮的代码，可以参考王垠的文章「[Kotlin 和 Checked Exception](http://www.yinwang.org/blog-cn/2017/05/23/kotlin)」。

在这里，我不想继续讨论受检异常到底是好还是坏，我只想以这个为切入点，随便讨论一点关于 Java 的八卦。

## Checked/unchecked, who cares?

上面讲过，如果一个方法可能抛出受检异常，就必须在方法上加上 throws 声明，也就是说，如果方法上没有 throws 声明，这个方法就不可能抛出受检异常吗？按照 Java 的语言规范，这当然不可能，否则受检异常不就名不符实了吗？

当然说话也不能这么绝对，作为一个程序员，我们在自认为不可能的地方找到的 bug 还少吗？Test first，我们先来看一段测试代码。

	interface SneakyThrows {
	
	    /**
	     * Throws an IOException sneakily.
	     */
	    void sneakyThrow() /* throws IOException */;
	}
	
	static void testSneakyThrows(SneakyThrows sneaky) {
	    try {
	        sneaky.sneakyThrow();
	    } catch (Throwable e) {
	        if (e instanceof IOException) {
	            System.out.println(sneaky.getClass().getSimpleName() + " success!");
	        } else {
	            throw new AssertionError(
					sneaky.getClass().getSimpleName() + " failed!", e);
	        }
	    }
	}

这是一个接口和一个测试方法。这个 SneakyThrows 接口自称它会抛出一个 IOException，然而它的方法上却没有 throws 声明。测试方法接受一个实现了 SneakyThrows 接口的对象，调用接口上的 sneakyThrow 方法，如果接口方法真的抛出了 IOException，则输出 success 字样，否则会抛出异常，测试失败。那么，聪明的你，有没有办法实现这样一个接口，使测试能够成功呢？

当然有，而且还不止一种方法！

## 万能的 Unsafe

在 Java 里，说到黑科技，大家总是会首先想到 sun.misc.Unsafe，这个类大量出现在 JDK 源码以及各种第三方类库的源码中，用于实现一些奇奇怪怪的功能。那么它能不能用来抛出一个受检异常呢？当然能，Unsafe 中刚好有一个 throwException 方法可以实现这个功能。可惜的是，获取 Unsafe 对象只有一个 Unsafe.getUnsafe() 方法，而这个方法中加了对调用者的检查，只有 jdk 中的类才能调用这个方法，否则将抛出 SecurityException。

但是我们还有反射，只要 Unsafe 对象是保存在一个 Java 的字段中，反射就可以直接拿到这个对象，无视访问权限以及安全检查。下面这段代码，首先通过反射得到了 Unsafe 对象，然后调用它的 throwException 方法，成功抛出了一个受检异常。

	class UnsafeSneakyThrows implements SneakyThrows {
	
	    @Override
	    public void sneakyThrow() {
	        getUnsafe().throwException(new IOException());
	    }
	
	    Unsafe getUnsafe() {
	        try {
	            Field field = Unsafe.class.getDeclaredField("theUnsafe");
	            field.setAccessible(true);
	            return (Unsafe) field.get(null);
	        } catch (NoSuchFieldException | IllegalAccessException e) {
	            throw new IllegalStateException(e);
	        }
	    }
	}

小伙伴们可以运行一下，这段代码完全做到我们之前认为不可能的事情，在一个没有 throws 声明的方法里抛出受检异常！这时，有心的小伙伴应该就能明白过来，所谓的受检不受检，其实只是一个编译器的魔法，JVM 是完全不关心的。这也是为什么基于 JVM 的其他语言，比如 Scala、Groovy 之类，完全抛弃了受检异常的设计，却能运行在 JVM 上，并且能和 Java 很好地兼容。另外，学过 C++ 的同学应该也知道，在 C++ 里面，异常并不像 Java 一样有一个共同的基类，C++ 的 throw 语句可以抛出任何东西，甚至直接抛出一个 int 之类的值类型，当然这是题外话。

通过 Unsafe，我们能玩的黑魔法还有很多，比如分配一段非托管的直接内存、绕过 Java 的类初始化机制直接创建一个未初始化的对象、通过偏移量直接修改任何对象内的字段、以及硬件级别的原子操作 CAS 等。正因如此，它的身影也在 JDK 源码和各种第三方类库中频繁出现。比如 concurrent 包中使用它实现了各种线程同步相关的工具类以及 AtomicXxx 系的各种无锁的原子操作；nio 使用它获得了直接操作裸内存的能力；netty 也因为它得以直接操作堆外内存，大大地提升了性能；各类序列化库也使用它绕过类初始化机制、以方便地实现反序列化。

然而，这种大杀器一般都会有很大的副作用，比如分配的非托管内存，如果不注意释放，很容易就造成内存泄露，其他的操作也往往是高危操作，正如其 Unsafe 的名字。有消息称，在 JDK9 中，随着新的模块系统的推出，真正杜绝了应用直接使用 Unsafe 类，到时这个黑魔法就不管用咯，可以看看 R 大在知乎的回答：「[为什么JUC中大量使用了sun.misc.Unsafe 这个类，但官方却不建议开发者使用？ - RednaxelaFX的回答 - 知乎](https://www.zhihu.com/question/29266773/answer/43757304)」。

## 坑爹的泛型

泛型也是那些黑 Java 的人的主要喷点之一。在 Java 中，泛型也只是编译器的语法糖，JVM 中并不保留泛型的类型信息，其名曰「类型擦除」。JDK5 推出时，Java 已在各行各业广泛使用，采用类型擦除的泛型设计也是出于兼容性考虑，否则就要像 C# 一样，同时存在 System.Collections 和 System.Collections.Generic 两套集合框架。关于泛型的更多细节，也可以看看 R 大的文章「[Reifiable generics与Type erasure generics各有怎样的优点与缺点？ - RednaxelaFX的回答 - 知乎](https://www.zhihu.com/question/34621277/answer/59440954)」。

然而，采用类型擦除除了大家都说烂了的那些坏处之外，还有一些不为人知的坑，比如下面这段代码就是。

	class GenericSneakyThrows implements SneakyThrows {
	
	    @Override
	    public void sneakyThrow() {
	        this.<RuntimeException>sneakyThrow0(new IOException());
	    }
	
	    <X extends Throwable> void sneakyThrow0(Throwable e) throws X {
	        throw (X) e;
	    }
	}

这里定义了一个泛型声明为 `<X extends Throwable>` 方法，在内部将传入的 Throwable 强转为 X 之后再抛出，X 的具体类型取决于调用这个方法时指定的类型参数。在这里，只要将类型参数指定为 RuntimeException，然后不管传入一个什么异常，都可以直接抛出去，而不用 throws 声明。什么，你说为什么 IOException 可以强转成 RuntimeException？当然是因为类型擦除啊，由于类型擦除的存在，sneakyThrow0 在被调用的时候，X 在运行时实际上是擦除为 Throwable 类型，从 IOException 转成 Throwable 一点问题都不会有。

所以说，基于类型擦除的泛型，和受检异常的设计实际上是冲突的，如果说上面提到的 Unsafe 是内部 API，可以不允许外界调用，那么，在类型擦除和受检异常共存的 Java 里，永远也不可能解决这个问题。

顺便一提，在 JDK8 中，由于 lambda 的引入，改变了类型推断算法，上面代码中的类型参数其实是可以省略的，直接 `this.sneakyThrow0(new IOException())` 即可。

## Evil Class.newInstance()

在很多文章里面，都推荐大家在使用反射的时候，用 Constructor.newInstance() 代替 Class.newInstance() 创建对象，这是为什么呢？我们先看看下面这段代码。

	class ConstructorSneakyThrows implements SneakyThrows {
	
	    @Override
	    public void sneakyThrow() {
	        try {
	            ConstructorThrowable.class.newInstance();
	        } catch (InstantiationException | IllegalAccessException e) {
	            throw new IllegalStateException(e);
	        }
	    }
	}
	
	class ConstructorThrowable {
	
	    ConstructorThrowable() throws IOException {
	        throw new IOException();
	    }
	}

和上面两个例子一样，上面这段代码也可以抛出一个受检异常。我们首先写了一个 ConstructorThrowable 类，这个类有一个无参构造方法，在构造方法里面我们抛出了一个 IOException，因此在调用 Class.newInstance() 的时候就把这个异常传播了出去，从而绕过了编译器的检查。

那么，为什么 Constructor.newInstance() 就不会有这个问题呢？对比这两者的签名就可以发现，它的 throws 列表中多了一个 InvocationTargetException，在构造方法的执行过程中如果发生了异常，这个异常会被包装为 InvocationTargetException 再次抛出。

这两个方法明明有相同的作用，但是在异常方面却有微妙的差别。查看 JDK 源码我们可以看到，Class.newInstance() 底层其实就是先获取到 Constructor 对象，然后再把实际的操作代理给 Constructor.newInstance()。然而，在这个过程中，它捕获了 InvocationTargetException，然后使用 Unsafe 将其包装的 targetException 直接抛出。

为什么 Class.newInstance() 要多次一举呢？这其实是历史原因导致的。Java 的反射 API 是在 1.2 版本引入的，而 Class 类在之前就有了，如果在 Class.newInstance() 方法的 throws 声明中也加上 InvocationTargetException 的话，由于这个异常是受检异常，就会导致基于旧版 JDK 写的代码都不能通过编译。所以为了兼容性考虑，只能使用 Unsafe 来传播构造方法中产生的异常。这也是一个证明受检异常是设计失误的例子，即容易破坏兼容性、妨碍 API 的演化。

具体的细节，在 Class.newInstance() 的 Javadoc 中已经有介绍，Stack Overflow 上也有相关的讨论，「[java - Why is Class.newInstance() "evil"? - Stack Overflow](https://stackoverflow.com/questions/195321/why-is-class-newinstance-evil/)」。

## 废弃的 Thread.stop()

在 JDK5 里面，Thread 类一口气废弃了好几个方法，它们就是 suspend/resume/stop 系列。当然，废弃归废弃，只要我们有充分的理由，也不是不能用它们。


	class ThreadStopSneakyThrows implements SneakyThrows {
	
	    @Override
	    public void sneakyThrow() {
	        Thread.currentThread().stop(new IOException());
	    }
	}

如你所见，接收一个 Throwable 参数的 Thread.stop() 方法也可以用来实现 SneakyThrows，抛出一个受检异常。stop() 方法的作用是使指定线程产生一个异常，从而强行终止该线程的执行。在这里，我们使当前线程产生一个 IOException，以达到我们的目的。那么它为什么被废弃了呢？JDK 文档里面有详细的解释。

> This method is inherently unsafe. Stopping a thread with Thread.stop causes it to unlock all of the monitors that it has locked (as a natural consequence of the unchecked `ThreadDeath` exception propagating up the stack). If any of the objects previously protected by these monitors were in an inconsistent state, the damaged objects become visible to other threads, potentially resulting in arbitrary behavior. Many uses of `stop` should be replaced by code that simply modifies some variable to indicate that the target thread should stop running.  The target thread should check this variable regularly, and return from its run method in an orderly fashion if the variable indicates that it is to stop running. If the target thread waits for long periods (on a condition variable, for example), the `interrupt` method should be used to interrupt the wait.

简单来说，如果一个线程已经获得了某个锁，正在执行某些互斥操作，stop() 方法会强行使这个线程失去锁，而此时，它的操作可能还没有执行完成，这就可能使变量处于不一致的状态，造成线程安全问题。

嘛，反正这个方法已经废弃了，再多说也没什么意义。值得一提的是，在 JDK8 里，带 Throwable 参数的 Thread.stop() 方法已经改成直接抛出 UnsupportedOperationException，完全不能使用了，只有无参数的重载版本还仍可使用（无参版本默认抛出 ThreadDeath）。所以上面那段代码，只有在 JDK7 及以下才有效，在 JDK8 中并不能通过测试。

## The End

好了，扯淡结束。本文简单介绍了 Java 中的受检异常和未受检异常的区别，指出受检异常只是编译器的魔法、JVM 底层并不关心，并给出了四种绕过编译器检查，在任何地方都可抛出受检异常的方法。在介绍这四种方法的时候，随便讲了一些与之相关的八卦。

我的观点是，学习一门编程语言，了解一下这门语言的八卦还是很有必要的。当你知道它都有那些缺点，你就会思考，为什么当初要这样设计，你就会明白，所有的缺点，其实都是工程上的妥协。

程序员啊，还是要保持这一颗八卦的心。

荆轲刺秦王。


