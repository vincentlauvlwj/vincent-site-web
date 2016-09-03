---
layout:     post
title:      "「译」LINQ: Building an IQueryable Provider - Part I"
subtitle:   "Reusable IQueryable base classes"
author:     "刘文俊"
tags:
    - 翻译
    - LINQ
    - C♯
---

> 英文原文是[Matt Warren](https://social.msdn.microsoft.com/profile/matt%20warren%20-%20msft/ "Matt Warren")发表在MSDN Blogs的系列文章之一，英文渣渣，翻译**不供参考**，请直接[看原文](http://blogs.msdn.com/b/mattwar/archive/2007/07/30/linq-building-an-iqueryable-provider-part-i.aspx)。

这段时间我一直打算写一个系列的文章来介绍如何使用`IQueryable`构建LINQ提供程序。也一直有人通过微软内部邮件、论坛提问或者直接给我发邮件的方式来给我这方面的建议。当然，通常我都会回复“我正在做一个详尽的Sample来给你们展示这一切”，告诉他们很快所有内容都会发布。但是，相比仅仅发布一个完整的Sample，我觉得一步一步循序渐进地阐述才是一个明智的选择，这样我才能深挖里面的所有细节，而不是仅仅把东西扔给你们，让你们自生自灭。

我要说的第一件事是，在Beta 2版本里面，`IQueryable`不再只是一个接口，它被分成了两个：`IQueryable`和`IQueryProvider`。在实现这两个接口之前，我们先过一遍它们的内容。
使用Visual Studio的“go to definition”功能，你可以看到下面的代码

	public interface IQueryable : IEnumerable {       
        Type ElementType { get; }
        Expression Expression { get; }
        IQueryProvider Provider { get; }
    }
    public interface IQueryable<T> : IEnumerable<T>, IQueryable, IEnumerable {
    }

当然，`IQueryable`现在已经没什么好看的，有趣的内容都被放到了新接口`IQueryProvider`那里。如你所见，`IQueryable`只有三个只读的属性。第一个属性返回元素的类型（或者`IQueryable<T>`里面的`T`）。注意，所有实现`IQueryable`的类都必须同时实现`IQueryable<T>`，反之亦然。泛型的`IQueryable<T>`是在方法签名里面使用得最频繁的。非泛型的`IQueryable`的存在主要是为了提供一个弱类型的入口，该入口主要应用在动态构建query的场景之中。

第二个属性返回这个`IQueryable`对象对应的`Expression`，这正是`IQueryable`的精髓所在。在`IQueryable`封装之下的真正的“查询”是一个表达式树，它将query对象表示为一个由LINQ查询方法/操作符组成的树形结构，这是构建一个LINQ提供程序必须理解的原理。仔细看你就会发现，整个`IQueryable`的结构体系（包括LING标准查询操作符的`System.Linq.Queryable`版本）只是自动为你创建了表达式树。当你使用`Queryable.Where`方法来过滤`IQueryable`中的数据的时候，它只是简单地创建了一个新的`IQueryable`对象，并在原有的表达式树顶上创建一个`MethodCallExpression`类型的节点，该节点表示一次`Queryable.Where`方法的调用。不信？你自己试试看就知道了。

现在就只剩最后一个属性，这个属性返回新接口`IQueryProvider`的实例。我们把所有构造`IQueryable`实例和执行查询的方法都分离到了这个新接口中，这样能更加清晰地表示出查询提供程序的概念。

	public interface IQueryProvider {
        IQueryable CreateQuery(Expression expression);
        IQueryable<TElement> CreateQuery<TElement>(Expression expression);
        object Execute(Expression expression);
        TResult Execute<TResult>(Expression expression);
    }

看到这个`IQueryProvider`接口，你可能会疑惑为什么有这么多方法。实际上这里只有两个操作，`CreateQuery`和`Execute`，只不过每个操作都有一个泛型的版本和一个非泛型的版本。当你直接在代码里面写查询的时候，一般都是调用泛型的版本。使用泛型的版本可以避免使用反射创建实例，因此性能更佳。

正如其名，`CreateQuery`方法的作用是根据指定的表达式树创建一个新的`IQueryable`对象。当这个方法被调用时，你的提供程序应该返回一个`IQueryable`对象，这个对象被枚举的时候会调用你的提供程序来处理这个指定的表达式。`Queryable`的标准查询操作符就是调用这个方法来创建与你的提供程序保持关联的`IQueryable`对象。注意，调用者可能会传给你的这个API一个任意的表达式树，对你的提供程序而言，传入的表达式树甚至可能是非法的，但是可以保证的是它一定会符合`IQueryable`对象的类型要求。`IQueryable`对象包含了一个表达式，这个表达式是一个代码的片段，当它转换为真正的代码并且执行的时候就会重新构造一个等价的`IQueryable`对象。

`Execute`方法是你的提供程序真正执行查询表达式的入口。应提供一个明确的`Execute`方法而不要仅仅依赖于`IEnumerable.GetEnumerator()`，以支持那些不必返回一个序列的查询。比如，这个查询“`myquery.Count()`”返回一个整数，该查询的表达式树是对返回整数的`Count`方法的调用。`Queryable.Count`方法（以及其他类似的聚合方法）就是调用`Execute`来“立即”执行查询。

讲到这里，是不是看起来就没那么难了？你自己也可以很轻松地实现所有的方法对吧？但是何必这么麻烦呢，我在下面就会给出代码。当然`Execute`方法除外，这个我会在以后的文章中给出。

让我们先从`IQueryable`开始。因为这个接口已经被划分成了两个，所以现在可以只用实现一次`IQueryable`，然后把它用在任意一个`IQueryProvider`中。下面给出一个`Query<T>`类，它实现了`IQueryable<T>`以及其他一系列的接口。

	public class Query<T> : IQueryable<T>, IQueryable, IEnumerable<T>, IEnumerable, IOrderedQueryable<T>, IOrderedQueryable {
        QueryProvider provider;
        Expression expression;
 
        public Query(QueryProvider provider) {
            if (provider == null) {
                throw new ArgumentNullException("provider");
            }
            this.provider = provider;
            this.expression = Expression.Constant(this);
        }
 
        public Query(QueryProvider provider, Expression expression) {
            if (provider == null) {
                throw new ArgumentNullException("provider");
            }
            if (expression == null) {
                throw new ArgumentNullException("expression");
            }
            if (!typeof(IQueryable<T>).IsAssignableFrom(expression.Type)) {
                throw new ArgumentOutOfRangeException("expression");
            }
            this.provider = provider;
            this.expression = expression;
        }
 
        Expression IQueryable.Expression {
            get { return this.expression; }
        }
 
        Type IQueryable.ElementType {
            get { return typeof(T); }
        }
 
        IQueryProvider IQueryable.Provider {
            get { return this.provider; }
        }
 
        public IEnumerator<T> GetEnumerator() {
            return ((IEnumerable<T>)this.provider.Execute(this.expression)).GetEnumerator();
        }
 
        IEnumerator IEnumerable.GetEnumerator() {
            return ((IEnumerable)this.provider.Execute(this.expression)).GetEnumerator();
        }
 
        public override string ToString() {
            return this.provider.GetQueryText(this.expression);
        }
    }

你看，`IQueryable`的实现十分简单。这个小对象所做的事情仅仅是保持一颗表达式树和一个查询提供者的实例，而查询提供者才是真正有趣的地方。

好了，下面把`Query<T>`类中引用到的`QueryProvider`给出，它是一个抽象类。一个真正的提供程序只需继承这个类，实现里面的`Execute`抽象方法。

	public abstract class QueryProvider : IQueryProvider {
        protected QueryProvider() {
        }
 
        IQueryable<S> IQueryProvider.CreateQuery<S>(Expression expression) {
            return new Query<S>(this, expression);
        }
 
        IQueryable IQueryProvider.CreateQuery(Expression expression) {
            Type elementType = TypeSystem.GetElementType(expression.Type);
            try {
                return (IQueryable)Activator.CreateInstance(typeof(Query<>).MakeGenericType(elementType), new object[] { this, expression });
            }
            catch (TargetInvocationException tie) {
                throw tie.InnerException;
            }
        }
 
        S IQueryProvider.Execute<S>(Expression expression) {
            return (S)this.Execute(expression);
        }
 
        object IQueryProvider.Execute(Expression expression) {
            return this.Execute(expression);
        }
 
        public abstract string GetQueryText(Expression expression);
        public abstract object Execute(Expression expression);
    }

这个抽象类实现了`IQueryProvider`接口。两个`CreateQuery`方法负责创建`Query<T>`的实例，两个`Execute`方法将执行操作交给了尚未实现的`Execute`抽象方法。

我认为你可以把这个当成构建LINQ `IQueryable`提供程序的样板代码。真正的执行操作放在`Execute`方法中，在这里，你的提供程序可以通过检查表达式树来理解查询的具体含义，而这就是我接下来要讲的内容。

更新：
我好像忘了定义在代码里面用到的helper类，下面给出。

	internal static class TypeSystem {
        internal static Type GetElementType(Type seqType) {
            Type ienum = FindIEnumerable(seqType);
            if (ienum == null) return seqType;
            return ienum.GetGenericArguments()[0];
        }
        private static Type FindIEnumerable(Type seqType) {
            if (seqType == null || seqType == typeof(string))
                return null;
            if (seqType.IsArray)
                return typeof(IEnumerable<>).MakeGenericType(seqType.GetElementType());
            if (seqType.IsGenericType) {
                foreach (Type arg in seqType.GetGenericArguments()) {
                    Type ienum = typeof(IEnumerable<>).MakeGenericType(arg);
                    if (ienum.IsAssignableFrom(seqType)) {
                        return ienum;
                    }
                }
            }
            Type[] ifaces = seqType.GetInterfaces();
            if (ifaces != null && ifaces.Length > 0) {
                foreach (Type iface in ifaces) {
                    Type ienum = FindIEnumerable(iface);
                    if (ienum != null) return ienum;
                }
            }
            if (seqType.BaseType != null && seqType.BaseType != typeof(object)) {
                return FindIEnumerable(seqType.BaseType);
            }
            return null;
        }
    }

好吧，我知道这个helper类的代码比其他地方的都多。
Sigh. <i class="emoji emoji-smile"></i>