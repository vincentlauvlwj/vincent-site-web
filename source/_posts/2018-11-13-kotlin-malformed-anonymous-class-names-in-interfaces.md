---
layout:     post
title:      "找到编译器的 bug 是种怎样的体验？"
author:     "刘文俊"
top: true
tags:
    - Kotlin
    - Java
---

> 本文来自我的知乎回答：[找到编译器的bug是种怎样的体验？ - 知乎](https://www.zhihu.com/question/267143879/answer/530782765)

emmm...这个问题下面真的是大佬云集，萌新感到好忐忑...

前段时间在使用 Kotlin 开发一个 [ORM 框架（广告慎入，Ktorm：专注于 Kotlin 的 ORM 框架）](https://www.ktorm.org/zh-cn/)，当时我的代码大概是这样的，定义了一个 `Foo` 接口，在这个接口里面写了个默认实现的 `bar()` 方法：

````kotlin
interface Foo {
    fun bar() {
        val obj = object : Any() { }
        println(obj.javaClass.simpleName)
    }
}

fun main(args: Array<String>) {
    val foo = object : Foo { }
    foo.bar()
}
````

怎么样，看起来是不是稳如狗？然而，这段代码在运行的时候，却喷了我一脸异常：

<!-- more -->

````plain
Exception in thread "main" java.lang.InternalError: Malformed class name
	at java.lang.Class.getSimpleBinaryName(Class.java:1450)
	at java.lang.Class.getSimpleName(Class.java:1309)
    ...
Caused by: java.lang.StringIndexOutOfBoundsException: String index out of range: -3
	at java.lang.String.substring(String.java:1931)
	at java.lang.Class.getSimpleBinaryName(Class.java:1448)
	... 4 more
````

风中凌乱...我不就是想输出一下匿名对象的类名吗，这个 `InternalError` 是什么鬼...

惊讶之余，冷静下来好好理了理 Kotlin 生成 class 的规则，终于明白过来。

众所周知，在 Java 中，interface 里面是不能有方法实现的（Java 8 以前），然而，Kotlin 却可以直接在接口里面实现方法。我们知道，Kotlin 最终也是要编译成 Java 字节码，既然 Java 本身都不支持这种操作，Kotlin 是怎么做到的呢？

反编译 Kotlin 生成的字节码就可以看到，在编译出来的 `interface Foo` 中，`bar` 方法仍然是 abstract 的，并没有实现。但是，Kotlin 另外生成了一个 `Foo$DefaultImpls` 类，在这个类里面有一个静态方法，这个方法的签名是：

````java
public static void bar(Foo $this)
````

这个方法里面的字节码，就是我们的 `bar()` 方法的默认实现了。这样，当一个 Kotlin 的类实现了 `Foo` 接口时，编译器就会自动为我们插入一个 `bar()` 方法的实现，这个实现只是简单调用了 `Foo$DefaultImpls` 里面的静态方法：

````java
@Override
public void bar() {
    DefaultImpls.bar(this);
}
````

这就是 Kotlin 中接口默认方法的实现原理。

然而这跟前面的 bug 又有什么关系...

我们回过头来看刚刚出 bug 的代码，可以看到一个 `object : Any() { }`，这应该会生成一个匿名内部类，看下编译结果，可以知道这个匿名内部类的名字是 `Foo$bar$obj$1`，这应该没什么特别的。

然后顺着异常栈去到 JDK 的 Class 类里面，看源码，可以看到报错的地方是这样的：

````java
private String getSimpleBinaryName() {
    Class<?> enclosingClass = getEnclosingClass();
    if (enclosingClass == null) // top level class
        return null;
    // Otherwise, strip the enclosing class' name
    try {
        return getName().substring(enclosingClass.getName().length());
    } catch (IndexOutOfBoundsException ex) {
        throw new InternalError("Malformed class name", ex);
    }
}
````

额，好像找到原因了...

回到前面提到的匿名内部类 `Foo$bar$obj$1`，因为 `bar()` 方法是在 `Foo$DefaultImpls` 中实现的，所以对这个匿名类获取 `enclosingClass` 毫无疑问就是 `Foo$DefaultImpls` 了，然后在 substring 的时候就 GG 了...

最后，根据我粗浅的理解，应该可以得出结论，这个 bug 的根源是 Kotlin 在编译这个匿名内部类的时候生成的名字有误，如果生成的名字是 `Foo$DefaultImpls$bar$obj$1` 的话，bug 就不会发生。带着这个疑惑，我去 Kotlin issue 上面找了找，果然已经有人提出过这个问题，然而这个 issue 至今都是 open 状态，并没有得到解决，难道是这个 bug 会牵扯到其他地方？有兴趣的同学可以去看一看：[Names for anonymous classes in interfaces are malformed : KT-16727](https://youtrack.jetbrains.com/issue/KT-16727)

最终，bug 的原因是找到了，那在 Kotlin 修复这个 bug 之前应该怎么办呢？我们当然只能想办法绕过了，比如避免在接口的默认实现方法中使用匿名内部类，lambda 也不行，因为 Kotlin 的 lambda 也会编译成匿名类...

BTW，说到编译器的 bug，之前在使用 Java 8 的 lambda 的时候也遇到过一个，当时还在知乎吐槽了一下，这里也贴个链接，仅作记录：[此处的lambda为什么不能用方法引用表示 - 知乎](https://www.zhihu.com/question/53173886/answer/319791449)

以上