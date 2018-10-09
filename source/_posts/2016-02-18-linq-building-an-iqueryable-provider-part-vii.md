---
layout:     post
title:      "「译」LINQ: Building an IQueryable Provider - Part VII"
subtitle:   "Join and SelectMany"
author:     "刘文俊"
tags:
    - 翻译
    - LINQ
    - C♯
---

> 英文原文是[Matt Warren](https://social.msdn.microsoft.com/profile/matt%20warren%20-%20msft/ "Matt Warren")发表在MSDN Blogs的系列文章之一，英文渣渣，翻译**不供参考**，请直接[看原文](http://blogs.msdn.com/b/mattwar/archive/2007/09/04/linq-building-an-iqueryable-provider-part-vii.aspx)。

从上篇文章到现在，已经有好几个星期没有更新了。希望在这段时间里面你们也有用自己的时间来探索如何构建自己的提供程序。我也一直在关注别人的各种各样的“LINQ to XXX”的项目，感觉都很不错。今天我将向你们介绍如何在我的提供程序中添加连接查询的功能，比起只支持select和where来，支持join将能提供更多有趣的用法。

## Implementing Join

在LINQ中有许多种不同的连接查询的写法。在C♯或者VB中，如果写了多个from子句，将会产生笛卡尔积的结果，但如果把一个子句的键和另一个子句的键匹配起来，所得到的就是一个连接查询。

````cs
	var query = from c in db.Customers
	            from o in db.Orders
	            where c.CustomerID == o.CustomerID
	            select new { c.ContactName, o.OrderDate };
````

当然，也可以使用显式的join子句。

````cs
	var query = from c in db.Customers
	            join o in db.Orders on c.CustomerID equals o.CustomerID
	            select new { c.ContactName, o.OrderDate };
````

这两个查询会得到相同的结果，那么为什么做同一件事会有两种不同的方式呢？

原因有点复杂，但我会尝试解释清楚。显式连接要求我们指定两个匹配的键表达式，用数据库的术语来说，就是等值连接。而嵌套from子句具有更大的灵活性。显式连接具有如此限制的原因是，通过这种限制，使得LINQ to Objects的实现不必去分析和重写查询，进而使执行更加高效。好消息是，在数据库中用到的连接几乎都是等值连接。

并且，因为有了限制，所以显式查询的表达能力会比较低，因此实现起来会更加简单。在这篇文章里，两种连接方式我都会实现，但我会先完成显式连接，因为它的坑比较少。

`Queryable.Join`方法的定义如下：

````cs
	public static IQueryable<TResult> Join<TOuter,TInner,TKey,TResult>(
	    this IQueryable<TOuter> outer, 
	    IEnumerable<TInner> inner, 
	    Expression<Func<TOuter,TKey>> outerKeySelector, 
	    Expression<Func<TInner,TKey>> innerKeySelector, 
	    Expression<Func<TOuter,TInner,TResult>> resultSelector
	)
````

好多参数好多泛型！但是实际上理解起来也不是那么难。inner和outer是两个输入序列（join关键字两边的序列）；每个输入序列都有一个键选择器（on子句中equals关键字两边的表达式）；最后是一个产生连接查询的结果的表达式。最后这个resultSelector可能会使人迷惑，因为在C♯或VB的语法中看起来好像没有这个东西。但实际上是有的，在上面的例子中，它就是select表达式。在其他地方，它也有可能是一个编译器生成的投影，用来将数据传递到下一个查询操作中。

没关系，直接开干吧。实际上，我早已万事俱备，只欠东风了。这个东风就是表示连接的新的节点。

现在在代码中加上这个节点。

````cs
	internal enum DbExpressionType {
	    Table = 1000, // make sure these don't overlap with ExpressionType
	    Column,
	    Select,
	    Projection,
	    Join
	}
````

我在枚举中加上了新的节点类型“Join”，然后实现一个`JoinExpression`类。

````cs
	internal enum JoinType {
	    CrossJoin,
	    InnerJoin,
	    CrossApply,
	}
	
	internal class JoinExpression : Expression {
	    JoinType joinType;
	    Expression left;
	    Expression right;
	    Expression condition;
	    internal JoinExpression(Type type, JoinType joinType, Expression left, Expression right, Expression condition)
	        : base((ExpressionType)DbExpressionType.Join, type) {
	        this.joinType = joinType;
	        this.left = left;
	        this.right = right;
	        this.condition = condition;
	    }
	    internal JoinType Join {
	        get { return this.joinType; }
	    }
	    internal Expression Left {
	        get { return this.left; }
	    }
	    internal Expression Right {
	        get { return this.right; }
	    }
	    internal new Expression Condition {
	        get { return this.condition; }
	    }
	}
````

我还定义了一个`JoinType`的枚举，里面是我待会要用到的连接类型。`CrossApply`是SQL Server中独有的连接类型。现在先忽略它，在实现等值连接的使用用不到它。实际上，现在只需要`InnerJoin`，另外两个在后面才会用到。我说过，显式连接是比较简单的。

那么外连接呢？这个我们会在后面的文章中讨论:-)

现在多了个`JoinExpression`，所以`DbExpressionVisitor`得改一改。

````cs
	internal class DbExpressionVisitor : ExpressionVisitor {
	    protected override Expression Visit(Expression exp) {
	        ...
	        switch ((DbExpressionType)exp.NodeType) {
	            ...
	            case DbExpressionType.Join:
	                return this.VisitJoin((JoinExpression)exp);
	            ...
	        }
	    }
	    ...
	    protected virtual Expression VisitJoin(JoinExpression join) {
	        Expression left = this.Visit(join.Left);
	        Expression right = this.Visit(join.Right);
	        Expression condition = this.Visit(join.Condition);
	        if (left != join.Left || right != join.Right || condition != join.Condition) {
	            return new JoinExpression(join.Type, join.Join, left, right, condition);
	        }
	        return join;
	    }
	}
````

还挺不错的。现在是改改`QueryFormatter`，以支持新添加的节点。

````cs
	internal class QueryFormatter : DbExpressionVisitor {
	    ...
	    protected override Expression VisitSource(Expression source) {
	        switch ((DbExpressionType)source.NodeType) {
	            ...
	            case DbExpressionType.Join:
	                this.VisitJoin((JoinExpression)source);
	                break;
	            ...
	        }
	        ...
	    }
	
	    protected override Expression VisitJoin(JoinExpression join) {
	        this.VisitSource(join.Left);
	        this.AppendNewLine(Indentation.Same);
	        switch (join.Join) {
	            case JoinType.CrossJoin:
	                sb.Append("CROSS JOIN ");
	                break;
	            case JoinType.InnerJoin:
	                sb.Append("INNER JOIN ");
	                break;
	            case JoinType.CrossApply:
	                sb.Append("CROSS APPLY ");
	                break;
	        }
	        this.VisitSource(join.Right);
	        if (join.Condition != null) {
	            this.AppendNewLine(Indentation.Inner);
	            sb.Append("ON ");
	            this.Visit(join.Condition);
	            this.AppendNewLine(Indentation.Outer);
	        }
	        return join;
	    }
	}
````

现在的想法是，`JoinExpression`与其他查询源表达式（比如`SelectExpression`和`TableExpression`）在表达式树中是处于同一级别的，能出现它们的地方就能出现`JoinExpression`。因此我修改了`VisitSource`方法以使它支持连接，还增加了一个新的方法`VisitJoin`。

当然，如果不能将调用了`Queryable.Join`方法的表达式节点转换为我的`JoinExpression`的话，前面的工作就等于白费了。我需要在`QueryBinder`中添加一个方法，就像`BindSelect`和`BindWhere`方法一样。这就是实现显式连接的主要代码，因为有了之前实现其他操作符的时候写的代码的支持，所以实现显式连接显得特别简单。

````cs
	internal class QueryBinder : ExpressionVisitor {
	    ...
	    protected override Expression VisitMethodCall(MethodCallExpression m) {
	        if (m.Method.DeclaringType == typeof(Queryable) ||
	            m.Method.DeclaringType == typeof(Enumerable)) {
	            switch (m.Method.Name) {
	                ...
	                case "Join":
	                    return this.BindJoin(
	                        m.Type, m.Arguments[0], m.Arguments[1],
	                        (LambdaExpression)StripQuotes(m.Arguments[2]),
	                        (LambdaExpression)StripQuotes(m.Arguments[3]),
	                        (LambdaExpression)StripQuotes(m.Arguments[4])
	                    );
	            }
	        }
	        ...
	    }
	    ...
	    protected virtual Expression BindJoin(Type resultType, Expression outerSource, Expression innerSource, LambdaExpression outerKey, LambdaExpression innerKey, LambdaExpression resultSelector) {
	        ProjectionExpression outerProjection = (ProjectionExpression)this.Visit(outerSource);
	        ProjectionExpression innerProjection = (ProjectionExpression)this.Visit(innerSource);
	        this.map[outerKey.Parameters[0]] = outerProjection.Projector;
	        Expression outerKeyExpr = this.Visit(outerKey.Body);
	        this.map[innerKey.Parameters[0]] = innerProjection.Projector;
	        Expression innerKeyExpr = this.Visit(innerKey.Body);
	        this.map[resultSelector.Parameters[0]] = outerProjection.Projector;
	        this.map[resultSelector.Parameters[1]] = innerProjection.Projector;
	        Expression resultExpr = this.Visit(resultSelector.Body);
	        JoinExpression join = new JoinExpression(resultType, JoinType.InnerJoin, outerProjection.Source, innerProjection.Source, Expression.Equal(outerKeyExpr, innerKeyExpr));
	        string alias = this.GetNextAlias();
	        ProjectedColumns pc = this.ProjectColumns(resultExpr, alias, outerProjection.Source.Alias, innerProjection.Source.Alias);
	        return new ProjectionExpression(
	            new SelectExpression(resultType, alias, pc.Columns, join, null),
	            pc.Projector
	        );
	    }
	}
````

一眼看过去，`BindJoin`方法里面的实现与其他两个操作符的实现几乎是一样的。我首先将传入的两个源转换为两个不同的源的投影。我将这两个源的投影的投影器保存在全局的map对象中，在待会翻译两个键表达式的时候用来替换掉参数引用。最后在对结果表达式作同样的操作，不同的是结果表达式可以同时访问到两个源投影，而不仅仅是一个。

当所有的输入表达式都翻译完成之后，我就拥有了表示这个连接查询的足够的信息，因此已经可以创建`JoinExpression`了。然后再创建一个`SelectExpression`，将其包装起来，这里就需要调用`ProjectColumns`方法以产生一个数据列的列表以供`SelectExpression`使用。注意，现在`ProjectColumns`方法有一点小变化，它现在允许指定多个已存在的表别名。这点很重要，因为在连接操作里面，结果表达式很有可能会引用两个表别名。

搞定，所有东西都做完了。应该可以支持显式连接了。

试一试吧。

````cs
	var query = from c in db.Customers
	            where c.CustomerID == "ALFKI"
	            join o in db.Orders on c.CustomerID equals o.CustomerID
	            select new { c.ContactName, o.OrderDate };
	
	Console.WriteLine(query);
	
	foreach (var item in query) {
	    Console.WriteLine(item);
	}
````

执行上面的代码，产生如下输出：

````plain
	SELECT t2.ContactName, t4.OrderDate
	FROM (
	  SELECT t1.CustomerID, t1.ContactName, t1.Phone, t1.City, t1.Country
	  FROM (
	    SELECT t0.CustomerID, t0.ContactName, t0.Phone, t0.City, t0.Country
	    FROM Customers AS t0
	  ) AS t1
	  WHERE (t1.CustomerID = 'ALFKI')
	) AS t2
	INNER JOIN (
	  SELECT t3.OrderID, t3.CustomerID, t3.OrderDate
	  FROM Orders AS t3
	) AS t4
	  ON (t2.CustomerID = t4.CustomerID)
	{ ContactName = Maria Anders, OrderDate = 8/25/1997 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 10/3/1997 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 10/13/1997 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 1/15/1998 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 3/16/1998 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 4/9/1998 12:00:00 AM }
````

接下来就是难啃的骨头了:-)

## Implementing SelectMany

如果你写过SQL的话，你可能会感到很不解，为什么我说嵌套“from”子句实现起来会比较困难。毕竟在SQL里面它与显式连接仅仅是CROSS JOIN和INNER JOIN的区别而已。在LINQ这种倾向于非SQL的语言来说，CROSS JOIN其实并不是连接，而是交叉乘积。为了将它变成连接，需要在where子句中放一个连接条件来进行真正的连接操作。所以，在SQL的层面上，唯一的区别就是，CROSS JOIN将连接条件放在WHERE子句中，而INNER JOIN将连接条件放在ON子句中。好像也没什么问题。

不，还有很多问题。问题不在SQL上，大部分都在SQL以外的地方。如你所见，LINQ中的嵌套from与CROSS JOIN并不一样。有时候是一样的，但不全是。

在这个时候问题才会出现。一个连接使用连接条件将两个完全独立的子查询连接起来，这时只有连接条件才能够同时访问到两个子查询中的列。但是LINQ中的嵌套from就很不一样了，在LINQ中，内层的源表达式是可以访问到外层的源的。将它们想象为一个嵌套的foreach循环，内层循环可以访问到外层循环中的变量。

问题就在于要如何合适地翻译这种内层from子句中引用了外层的变量的查询。

如果你的查询是这样写的，那么没有问题：

````cs
	var query = from c in db.Customers
	            from o in db.Orders
	            where c.CustomerID == o.CustomerID
	            select new { c.ContactName, o.OrderDate };
````

将其转换为等价的方法调用的形式如下：

````cs
	var query = db.Customers
	              .SelectMany(c => db.Orders, (c, o) => new { c, o })
	              .Where(x => x.c.CustomerID == x.o.CustomerID)
	              .Select(x => new { x.c.ContactName, x.o.OrderDate });
````

这个`SelectMany`方法中的集合表达式`db.Orders`没有任何对“c”的引用。这样翻译成SQL是很容易的，因为我们可以简单地把`db.Customers`和`db.Orders`放在连接的两端。

然而，稍微换个写法的话，就像这样：

````cs
	var query = from c in db.Customers
	            from o in db.Orders.Where(o => o.CustomerID == c.CustomerID)
	            select new { c.ContactName, o.OrderDate };
````

现在可遇到大麻烦了。将上面的查询转换为等价的方法调用的形式如下：

````cs
	var query = db.Customers
	              .SelectMany(
	                  c => db.Orders.Where(o => c.CustomerID == o.CustomerID),
	                  (c, o) => new { c.ContactName, o.OrderDate }
	              );
````

现在，连接条件是作为`SelectMany`的集合表达式的一部分存在的，因此它引用了“c”。现在，翻译就再也不能简单地把两个源表达式放在SQL的连接两边了，无论是交叉连接还是内连接。

那么我要如何解决这个问题呢？我没有解决，真的，我用的是一种简单粗暴的方式。我打算利用一下微软的SQL。Microsoft SQL2005提供了一个新的连接操作符，`CROSS APPLY`，它正好与现在的这个情况具有相同的语义，这实在是一个让人高兴的巧合。`CROSS APPLY`右侧的表达式可以引用左侧表达式中的列。这就是我为什么要在定义`JoinType`枚举的时候加入`CrossApply`的原因。

大部分的LINQ to SQL引擎都会尽可能地将`CROSS APPLY`转换成`CROSS JOIN`。如果不这样做的话，LINQ to SQL在SQL2000里面可能就不能正常执行。当然，即使这样，还是有一些查询是无法转换成`CROSS JOIN`的。为了在这个示例提供程序里面添加这个特性，我还要做许多工作。虽然并不是很情愿，但是我也没有那么绝情，所以还是做了一点，算是抛砖引玉吧。我会处理一些简单的情况，将其转换成`CROSS JOIN`。

所以让我们看看代码吧。

````cs
	internal class QueryBinder : ExpressionVisitor {
	    protected override Expression VisitMethodCall(MethodCallExpression m) {
	        if (m.Method.DeclaringType == typeof(Queryable) ||
	            m.Method.DeclaringType == typeof(Enumerable)) {
	            switch (m.Method.Name) {
	                ...
	                case "SelectMany":
	                    if (m.Arguments.Count == 2) {
	                        return this.BindSelectMany(
	                            m.Type, m.Arguments[0], 
	                            (LambdaExpression)StripQuotes(m.Arguments[1]),
	                            null
	                        );
	                    }
	                    else if (m.Arguments.Count == 3) {
	                        return this.BindSelectMany(
	                            m.Type, m.Arguments[0], 
	                            (LambdaExpression)StripQuotes(m.Arguments[1]), 
	                            (LambdaExpression)StripQuotes(m.Arguments[2])
	                        );
	                    }
	                    break;
	                ...
	            }
	        }
	        ...
	    }
	
	    protected virtual Expression BindSelectMany(Type resultType, Expression source, LambdaExpression collectionSelector, LambdaExpression resultSelector) {
	        ProjectionExpression projection = (ProjectionExpression)this.Visit(source);
	        this.map[collectionSelector.Parameters[0]] = projection.Projector;
	        ProjectionExpression collectionProjection = (ProjectionExpression)this.Visit(collectionSelector.Body);
	        JoinType joinType = IsTable(collectionSelector.Body) ? JoinType.CrossJoin : JoinType.CrossApply;
	        JoinExpression join = new JoinExpression(resultType, joinType, projection.Source, collectionProjection.Source, null);
	        string alias = this.GetNextAlias();
	        ProjectedColumns pc;
	        if (resultSelector == null) {
	            pc = this.ProjectColumns(collectionProjection.Projector, alias, projection.Source.Alias, collectionProjection.Source.Alias);
	        }
	        else {
	            this.map[resultSelector.Parameters[0]] = projection.Projector;
	            this.map[resultSelector.Parameters[1]] = collectionProjection.Projector;
	            Expression result = this.Visit(resultSelector.Body);
	            pc = this.ProjectColumns(result, alias, projection.Source.Alias, collectionProjection.Source.Alias);
	        }
	        return new ProjectionExpression(
	            new SelectExpression(resultType, alias, pc.Columns, join, null),
	            pc.Projector
	        );
	    }
	
	    private bool IsTable(Expression expression) {
	        ConstantExpression c = expression as ConstantExpression;
	        return c != null && IsTable(c.Value);
	    }
	    ...
	}
````

第一件值得注意的事情是，`SelectMany`方法有两种不同的形式。第一种形式以一个`source`表达式和一个`collectionSelector`表达式为参数。`collectionSelector`产生一系列具有相同成员类型的序列，`SelectMany`方法仅仅是将这些序列合并成一个大的序列。第二种形式多了一个`resultSelector`，它允许你从连接的两个序列中投影出自己的结果。我实现的`BindSelectMany`方法可以指定`resultSelector`参数，也可以不指定。

注意，在这个函数的第四行，我判断了应该使用哪种连接类型来表示这个`SelectMany`调用。如果我能确定`collectionSelector`只是一个简单的表查询的话，我就能够得知它没有引用任何外层查询变量（`collectionSelector` lambda表达式的参数）。这样我就可以安全地选择`CROSS JOIN`而不是`CROSS APPLY`。如果想做得更复杂一点的话可以写一个访问器来判断`collectionSelector`中到底有没有引用。也许下次我会写的，我有种预感，可能到时候我会因为其他原因而不得不这么做。但是这里只是一个简单的示例。

总而言之，这里的代码和`BindJoin`方法或其他方法里面的很不一样。我必须要处理`resultSelector`没有指定的情况。在这种情况下，我简单地重用`collectionProjection`来充当最终的投影。

让我们测试一下新的代码吧。

````cs
	var query = from c in db.Customers
	            where c.CustomerID == "ALFKI"
	            from o in db.Orders
	            where c.CustomerID == o.CustomerID
	            select new { c.ContactName, o.OrderDate };
	
	Console.WriteLine(query);
	
	foreach (var item in query) {
	    Console.WriteLine(item);
	}
````

执行上面的代码，产生如下结果：

````plain
	SELECT t6.ContactName, t6.OrderDate
	FROM (
	  SELECT t5.CustomerID, t5.ContactName, t5.Phone, t5.City, t5.Country, t5.OrderID, t5.CustomerID1, t5.OrderDate
	  FROM (
	    SELECT t2.CustomerID, t2.ContactName, t2.Phone, t2.City, t2.Country, t4.OrderID, t4.CustomerID AS CustomerID1, t4.OrderDate
	    FROM (
	      SELECT t1.CustomerID, t1.ContactName, t1.Phone, t1.City, t1.Country
	      FROM (
	        SELECT t0.CustomerID, t0.ContactName, t0.Phone, t0.City, t0.Country
	        FROM Customers AS t0
	      ) AS t1
	      WHERE (t1.CustomerID = 'ALFKI')
	    ) AS t2
	    CROSS JOIN (
	      SELECT t3.OrderID, t3.CustomerID, t3.OrderDate
	      FROM Orders AS t3
	    ) AS t4
	  ) AS t5
	  WHERE (t5.CustomerID = t5.CustomerID1)
	) AS t6
	
	{ ContactName = Maria Anders, OrderDate = 8/25/1997 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 10/3/1997 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 10/13/1997 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 1/15/1998 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 3/16/1998 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 4/9/1998 12:00:00 AM }
````

哎呀，这个查询执行起来好像太慢了。我猜这是因为我盲目地添加新的嵌套查询而导致的。也许以后我会找个方法来去掉里面不必要的子查询:-)

当然，如果将这个查询的写法改成这种无法通过简单检查的形式的话，得到的结果就是`CROSS APPLY`。

````cs
	var query = db.Customers
	              .Where(c => c.CustomerID == "ALFKI")
	              .SelectMany(
	                  c => db.Orders.Where(o => c.CustomerID == o.CustomerID),
	                  (c, o) => new { c.ContactName, o.OrderDate }
	              );
	
	Console.WriteLine(query);
	
	foreach (var item in query) {
	    Console.WriteLine(item);
	}
````

上面的代码产生如下结果：

````plain
	SELECT t2.ContactName, t5.OrderDate
	FROM (
	  SELECT t1.CustomerID, t1.ContactName, t1.Phone, t1.City, t1.Country
	  FROM (
	    SELECT t0.CustomerID, t0.ContactName, t0.Phone, t0.City, t0.Country
	    FROM Customers AS t0
	  ) AS t1
	  WHERE (t1.CustomerID = 'ALFKI')
	) AS t2
	CROSS APPLY (
	  SELECT t4.OrderID, t4.CustomerID, t4.OrderDate
	  FROM (
	    SELECT t3.OrderID, t3.CustomerID, t3.OrderDate
	    FROM Orders AS t3
	  ) AS t4
	  WHERE (t2.CustomerID = t4.CustomerID)
	) AS t5
	
	{ ContactName = Maria Anders, OrderDate = 8/25/1997 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 10/3/1997 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 10/13/1997 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 1/15/1998 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 3/16/1998 12:00:00 AM }
	{ ContactName = Maria Anders, OrderDate = 4/9/1998 12:00:00 AM }
````

正如我所料！

现在我的提供程序已经支持`Join`和`SelectMany`调用了，我仿佛听到了你们的欢呼声。这个提供程序的功能已经很多了，但是还是有一些明显的坑没有填，还是有一些操作符没有实现，应该给我发工资才对得起我的辛勤付出啊。

[Query7.zip](https://msdnshared.blob.core.windows.net/media/MSDNBlogsFS/prod.evol.blogs.msdn.com/CommunityServer.Components.PostAttachments/00/04/75/11/61/Query7.zip)