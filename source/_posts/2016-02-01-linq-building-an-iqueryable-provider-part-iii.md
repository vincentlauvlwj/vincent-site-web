---
layout:     post
title:      "「译」LINQ: Building an IQueryable Provider - Part III: Local variable references"
author:     "刘文俊"
tags:
    - C♯
---

> 英文原文是[Matt Warren](https://social.msdn.microsoft.com/profile/matt%20warren%20-%20msft/ "Matt Warren")发表在MSDN Blogs的系列文章之一，英文渣渣，翻译**不供参考**，请直接[看原文](http://blogs.msdn.com/b/mattwar/archive/2007/08/01/linq-building-an-iqueryable-provider-part-iii.aspx)。

第三部分？难道上篇文章还没有讲完吗？我不是做了一个可以翻译和执行SQL命令并且返回一个对象序列的提供程序了吗？

确实如此，但是也仅仅如此而已。我写的那个提供程序的功能实在太弱，它只支持一种查询操作符与少量比较运算符。然而，真正的查询提供程序必须要提供更多的查询操作与更复杂的交互方式。我的查询提供程序甚至还不支持将数据投影为其他形式。

## Translating Local Variable References

你知道当查询里面引用了局部变量的时候会发生什么吗？不知道？

````cs
	string city = "London";
	var query = db.Customers.Where(c => c.City == city);
````

去试试翻译上面这句查询的时候会出现什么情况吧，我等着你的结果。

<!-- more -->

靠，抛出了一个异常，“The member 'city' is not supported.”，这是什么意思？我将“成员”City视为表中的一列，这个异常指的是局部变量city。但是为何局部变量也是一个“成员”呢？

让我们再看看对表达式树调用`ToString()`方法的结果。

````cs
	Console.WriteLine(query.Expression.ToString());
````

输出：

````cs
	SELECT * FROM Customers.Where(c => return (c.City = value(Sample.Program+<>c__DisplayClass0).city))
````

啊哈，C♯编译器生成了一个类来保存被lambda表达式引用到的局部变量，这和匿名函数中引用到外部的局部变量的时候的处理是一致的。但是这个你早就知道了对吧？不知道？

算了，我们现在来为之前的提供程序添加支持局部变量引用的功能吧。也许我们能够识别出这些编译器生成的类型中的字段引用，那么要如何确定一个编译器生成的类型呢？通过类名？如果编译器改变了它们的命名怎么办？如果另一种语言里面是另一种模式怎么办？还有，我们关注的点仅仅只有局部变量吗？如果引用了作用域范围中的成员变量呢？它们在表达式树中并不是单纯的值，它们可以是引用了成员变量所指向的实例的一个constant节点，也可以是访问某个对象的成员的MemberAccess节点。你能够仅仅通过反射就识别出constant节点所引用的成员变量并且得到它们的值吗？也许可以，但是万一编译器生成了一个更复杂的类型呢？

好吧，我要给出的是一个通用的解决方案，它转化了编译器生成的表达式树，使之更像我指出这些问题之前的样子，让人容易接受。

我真正想做的是将树上可以计算出值的子树替换成所计算出来的值。如果能做到的话，查询翻译器就只需要处理这些值就好了。谢天谢地，我已经有一个现成的`ExpressionVisitor`类，我可以用它实现一个简单的规则来判断哪些子树可以直接计算出值。

先看看下面的代码，我待会会解释它的工作原理。

````cs
	public static class Evaluator {
	    /// <summary>
	    /// Performs evaluation & replacement of independent sub-trees
	    /// </summary>
	    /// <param name="expression">The root of the expression tree.</param>
	    /// <param name="fnCanBeEvaluated">A function that decides whether a given expression node can be part of the local function.</param>
	    /// <returns>A new tree with sub-trees evaluated and replaced.</returns>
	    public static Expression PartialEval(Expression expression, Func<Expression, bool> fnCanBeEvaluated) {
	        return new SubtreeEvaluator(new Nominator(fnCanBeEvaluated).Nominate(expression)).Eval(expression);
	    }
	 
	    /// <summary>
	    /// Performs evaluation & replacement of independent sub-trees
	    /// </summary>
	    /// <param name="expression">The root of the expression tree.</param>
	    /// <returns>A new tree with sub-trees evaluated and replaced.</returns>
	    public static Expression PartialEval(Expression expression) {
	        return PartialEval(expression, Evaluator.CanBeEvaluatedLocally);
	    }
	 
	    private static bool CanBeEvaluatedLocally(Expression expression) {
	        return expression.NodeType != ExpressionType.Parameter;
	    }
	 
	    /// <summary>
	    /// Evaluates & replaces sub-trees when first candidate is reached (top-down)
	    /// </summary>
	    class SubtreeEvaluator: ExpressionVisitor {
	        HashSet<Expression> candidates;
	 
	        internal SubtreeEvaluator(HashSet<Expression> candidates) {
	            this.candidates = candidates;
	        }
	 
	        internal Expression Eval(Expression exp) {
	            return this.Visit(exp);
	        }
	 
	        protected override Expression Visit(Expression exp) {
	            if (exp == null) {
	                return null;
	            }
	            if (this.candidates.Contains(exp)) {
	                return this.Evaluate(exp);
	            }
	            return base.Visit(exp);
	        }
	 
	        private Expression Evaluate(Expression e) {
	            if (e.NodeType == ExpressionType.Constant) {
	                return e;
	            }
	            LambdaExpression lambda = Expression.Lambda(e);
	            Delegate fn = lambda.Compile();
	            return Expression.Constant(fn.DynamicInvoke(null), e.Type);
	        }
	    }
	 
	    /// <summary>
	    /// Performs bottom-up analysis to determine which nodes can possibly
	    /// be part of an evaluated sub-tree.
	    /// </summary>
	    class Nominator : ExpressionVisitor {
	        Func<Expression, bool> fnCanBeEvaluated;
	        HashSet<Expression> candidates;
	        bool cannotBeEvaluated;
	 
	        internal Nominator(Func<Expression, bool> fnCanBeEvaluated) {
	            this.fnCanBeEvaluated = fnCanBeEvaluated;
	        }
	 
	        internal HashSet<Expression> Nominate(Expression expression) {
	            this.candidates = new HashSet<Expression>();
	            this.Visit(expression);
	            return this.candidates;
	        }
	 
	        protected override Expression Visit(Expression expression) {
	            if (expression != null) {
	                bool saveCannotBeEvaluated = this.cannotBeEvaluated;
	                this.cannotBeEvaluated = false;
	                base.Visit(expression);
	                if (!this.cannotBeEvaluated) {
	                    if (this.fnCanBeEvaluated(expression)) {
	                        this.candidates.Add(expression);
	                    }
	                    else {
	                        this.cannotBeEvaluated = true;
	                    }
	                }
	                this.cannotBeEvaluated |= saveCannotBeEvaluated;
	            }
	            return expression;
	        }
	    }
	}
````

`Evaluator`类暴露了一个静态方法`PartialEval`，你可以调用这个方法来计算你的表达式树中的子树，并将其替换为计算结果的constant节点。上面的代码做的事情大部分是将可以独立计算的最大子树找出来，而真正的计算过程并没有什么特别，因为子树可以通过`LambdaExpression.Compile`方法“编译”成委托然后执行。这些事情都是在`SubtreeVisitor.Evaluate`方法中发生的。

找出最大子树的过程分为两步。首先是在`Nominator`类中对表达式树进行自底向上的遍历，找出所有可以独立计算的子树，然后在`SubtreeEvaluator`类中进行自上而下的遍历，找出代表选中的子树的最高节点。

`Nominator`以一个函数作为参数，你可以随意指定一个方法作为判断指定节点是否可独立计算的条件。默认的判断条件是除了`ExpressionType.Parameter`类型以外的所有节点都可以独立计算。另外，如果子节点不可独立计算那么父节点也不可独立计算。因此，parameter类型的节点的所有上游节点都不可独立计算，它们都会保留在树上，而剩余的其他节点都会被计算出结果并且替换成constant节点。

现在我就可以在任何翻译表达式的操作之前使用上面的类对表达式进行预处理了。幸运的是，我已经把翻译操作分解到了`DbQueryProvider`类的`Translate`方法里面。

````cs
	public class DbQueryProvider : QueryProvider {
	    …
	    private string Translate(Expression expression) {
	        expression = Evaluator.PartialEval(expression);
	        return new QueryTranslator().Translate(expression);
	    }
	}
````

现在我们再试试执行下面的代码就能得到正确的结果了：

````cs
	string city = "London";
	var query = db.Customers.Where(c => c.City == city);
	 
	Console.WriteLine("Query:\n{0}\n", query);
````

输出：

````plain
	Query:
	SELECT * FROM (SELECT * FROM Customers) AS T WHERE (City = 'London')
````

结果正是我们想要的，我们的查询提供程序又向前走了一步！

下篇文章我会实现Select操作。<i class="emoji emoji-smile"></i>