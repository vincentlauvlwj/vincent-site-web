---
layout:     post
title:      "逆天改命，Java反射的黑科技"
author:     "刘文俊"
date:       2016-09-03
tags:
    - Java
    - 随便写写
---

> 一个人的命运啊，当然要靠自我奋斗，但也要考虑到历史的进程。

众所周知，反射是Java的一大利器，它可以做到许多看起来不可思议的事情，但是用的不好也会给我们的系统挖下许多坑。下面就介绍一个反射的黑科技，请充分理解并消化里面的知识<del>，并把这项技术用到实际的项目中去</del>。

在开始之前，我们先来念两句诗，代码如下：

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

上面代码的输出是：

	岂因祸福避趋之
	苟利国家生死以

不对呀，反了反了。念诗都念错，看来还是需要好好学习一个。怎么改呢，很简单，把两次recitePoems方法调用的参数调转过来就可以了？ naïve，本文的目的是介绍黑科技，当然不会用这种寻常的办法解决问题。

不卖关子了，直接上代码吧：

	private static void doSomeMagic() throws Exception {
        Field modifiersField = Field.class.getDeclaredField("modifiers");
        modifiersField.setAccessible(true);

        Field trueField = Boolean.class.getDeclaredField("TRUE");
        modifiersField.set(trueField, trueField.getModifiers() & ~Modifier.FINAL);

        Field falseField = Boolean.class.getDeclaredField("FALSE");
        modifiersField.set(falseField, falseField.getModifiers() & ~Modifier.FINAL);

        Object trueValue = trueField.get(null);
        trueField.set(null, false);
        falseField.set(null, trueValue);
    }

接下来，只需要在main方法的开头调用这个名为doSomeMagic的<del>膜法</del>方法就好了：

	public static void main(String[] args) throws Exception {
        doSomeMagic();

        recitePoems(false);
        recitePoems(true);
    }

修改完毕之后，我们得到了期望的输出：

	苟利国家生死以
	岂因祸福避趋之

