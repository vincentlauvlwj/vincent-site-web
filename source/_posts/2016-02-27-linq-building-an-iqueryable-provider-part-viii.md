---
layout:     post
title:      "「译」LINQ: Building an IQueryable Provider - Part VIII: OrderBy"
author:     "刘文俊"
tags:
    - 翻译
    - LINQ
    - C♯
---

> 英文原文是[Matt Warren](https://social.msdn.microsoft.com/profile/matt%20warren%20-%20msft/ "Matt Warren")发表在MSDN Blogs的系列文章之一，英文渣渣，翻译**不供参考**，请直接[看原文](http://blogs.msdn.com/b/mattwar/archive/2007/10/09/linq-building-an-iqueryable-provider-part-viii.aspx)。

距离上篇文章，又已经过了几个星期。我感觉大家可能已经迫不及待想要看到下篇文章了。你们的提供程序本来应该已经完成，可以拿到外面去惊艳众人，但是现在却放在角落里吃灰。

## Implementing OrderBy

今天的话题是翻译order-by子句。幸运的是，进行排序操作的方式只有一种，那就是LINQ的排序操作符。但坏消息是，有四种不同的操作符。

使用查询的语法来写一条排序的查询是很简单的，只需一个子句就好。

````cs
    var query = from c in db.Customers
                orderby c.Country, c.City
                select c;
````

但是，将上面的查询转换为方法调用的形式的话，所涉及到的就不止是一个LINQ操作符了。

<!-- more -->

````cs
	var query = db.Customers.OrderBy(c => c.Country).ThenBy(c => c.City);
````

事实上，对于每个特定的排序表达式，都有它对应的排序操作符。因此LINQ提供程序在翻译SQL的时候，就需要将这些独立的操作符转换到一个单独的子句中。翻译这个的代码会比翻译之前的那些操作符的代码复杂一点，主要是因为需要先将这些独立的操作符全部找出来，才能对它们进行操作。之前的那些操作符可以简单地在前一个查询的外面套一个新的select，它们要考虑的只是当前操作符的那些参数。而排序不是，它还要考虑到其他的操作符。

首先，我们需要一种用来表示order-by子句的方式。最简单的方式是在已有的`SelectExpression`中加上一个描述排序的属性。但是，因为每个排序表达式都有一个排序方向，升序或降序，所以我需要把这些方向也保存下来。

所以，我添加了下面的新的定义：

````cs
	internal enum OrderType {
	    Ascending,
	    Descending
	}
	
	internal class OrderExpression {
	    OrderType orderType;
	    Expression expression;
	    internal OrderExpression(OrderType orderType, Expression expression) {
	        this.orderType = orderType;
	        this.expression = expression;
	    }
	    internal OrderType OrderType {
	        get { return this.orderType; }
	    }
	    internal Expression Expression {
	        get { return this.expression; }
	    }
	}
````

这个新的类型`OrderExpression`并不是一个真的`Expression`节点，因为我并不打算把它用在表达式树的任何位置，它只作为`SelectExpression`定义的一部分出现。因此`SelectExpression`也有一点小变化。

````cs
	internal class SelectExpression : Expression {
	    ...
	    ReadOnlyCollection<OrderExpression> orderBy;
	
	    internal SelectExpression(
	        Type type, string alias, IEnumerable<ColumnDeclaration> columns, 
	        Expression from, Expression where, IEnumerable<OrderExpression> orderBy)
	        : base((ExpressionType)DbExpressionType.Select, type) {
	        ...
	        this.orderBy = orderBy as ReadOnlyCollection<OrderExpression>;
	        if (this.orderBy == null && orderBy != null) {
	            this.orderBy = new List<OrderExpression>(orderBy).AsReadOnly();
	        }
	    }
	    ...
	    internal ReadOnlyCollection<OrderExpression> OrderBy {
	        get { return this.orderBy; }
	    }
	}
````

当然，`DbExpressionVisitor`也需要一点小变化，以支持排序的功能。

````cs
	internal class DbExpressionVisitor : ExpressionVisitor {
	    ...
	    protected virtual Expression VisitSelect(SelectExpression select) {
	        Expression from = this.VisitSource(select.From);
	        Expression where = this.Visit(select.Where);
	        ReadOnlyCollection<ColumnDeclaration> columns = this.VisitColumnDeclarations(select.Columns);
	        ReadOnlyCollection<OrderExpression> orderBy = this.VisitOrderBy(select.OrderBy);
	        if (from != select.From || where != select.Where || columns != select.Columns || orderBy != select.OrderBy) {
	            return new SelectExpression(select.Type, select.Alias, columns, from, where, orderBy);
	        }
	        return select;
	    }
	    ...
	    protected ReadOnlyCollection<OrderExpression> VisitOrderBy(ReadOnlyCollection<OrderExpression> expressions) {
	        if (expressions != null) {
	            List<OrderExpression> alternate = null;
	            for (int i = 0, n = expressions.Count; i < n; i++) {
	                OrderExpression expr = expressions[i];
	                Expression e = this.Visit(expr.Expression);
	                if (alternate == null && e != expr.Expression) {
	                    alternate = expressions.Take(i).ToList();
	                }
	                if (alternate != null) {
	                    alternate.Add(new OrderExpression(expr.OrderType, e));
	                }
	            }
	            if (alternate != null) {
	                return alternate.AsReadOnly();
	            }
	        }
	        return expressions;
	    }
	}
````

另外，我们还必须修改一下所有创建`SelectExpression`的地方，但这相对比较容易。

将order-by子句转换为文本也不是那么难。

````cs
	internal class QueryFormatter : DbExpressionVisitor {
	    ...
	    protected override Expression VisitSelect(SelectExpression select) {
	        ...
	        if (select.OrderBy != null && select.OrderBy.Count > 0) {
	            this.AppendNewLine(Indentation.Same);
	            sb.Append("ORDER BY ");
	            for (int i = 0, n = select.OrderBy.Count; i < n; i++) {
	                OrderExpression exp = select.OrderBy[i];
	                if (i > 0) {
	                    sb.Append(", ");
	                }
	                this.Visit(exp.Expression);
	                if (exp.OrderType != OrderType.Ascending) {
	                    sb.Append(" DESC");
	                }
	            }
	        }
	        ...
	    }
	    ...
	}
````

麻烦的地方是`QueryBinder`，我们需要从这些方法调用表达式中读取需要的信息创建一个排序子句。我决定构造一个排序表达式的列表，然后把它们全部放到同一个`SelectExpression`中。因为`ThenBy`和`ThenByDescending`操作符必须跟在其他排序操作符后面，因此可以很容易自上而下遍历表达式树，将每个排序表达式添加到一个集合里面，直到访问到最后一个order-by子句（一个`OrderBy`或`OrderByDescending`操作符）为止。

````cs
	internal class QueryBinder : ExpressionVisitor {
	    ...
	    protected override Expression VisitMethodCall(MethodCallExpression m) {
	        if (m.Method.DeclaringType == typeof(Queryable) ||
	            m.Method.DeclaringType == typeof(Enumerable)) {
	            ...
	            switch (m.Method.Name) {
	                case "OrderBy":
	                    return this.BindOrderBy(m.Type, m.Arguments[0], (LambdaExpression)StripQuotes(m.Arguments[1]), OrderType.Ascending);
	                case "OrderByDescending":
	                    return this.BindOrderBy(m.Type, m.Arguments[0], (LambdaExpression)StripQuotes(m.Arguments[1]), OrderType.Descending);
	                case "ThenBy":
	                    return this.BindThenBy(m.Arguments[0], (LambdaExpression)StripQuotes(m.Arguments[1]), OrderType.Ascending);
	                case "ThenByDescending":
	                    return this.BindThenBy(m.Arguments[0], (LambdaExpression)StripQuotes(m.Arguments[1]), OrderType.Descending);
	            }
	        }
	        ...
	    }
	
	    List<OrderExpression> thenBys;
	
	    protected virtual Expression BindOrderBy(Type resultType, Expression source, LambdaExpression orderSelector, OrderType orderType) {
	        List<OrderExpression> myThenBys = this.thenBys;
	        this.thenBys = null;
	        ProjectionExpression projection = (ProjectionExpression)this.Visit(source);
	
	        this.map[orderSelector.Parameters[0]] = projection.Projector;
	        List<OrderExpression> orderings = new List<OrderExpression>();
	        orderings.Add(new OrderExpression(orderType, this.Visit(orderSelector.Body)));
	
	        if (myThenBys != null) {
	            for (int i = myThenBys.Count - 1; i >= 0; i--) {
	                OrderExpression tb = myThenBys[i];
	                LambdaExpression lambda = (LambdaExpression)tb.Expression;
	                this.map[lambda.Parameters[0]] = projection.Projector;
	                orderings.Add(new OrderExpression(tb.OrderType, this.Visit(lambda.Body)));
	            }
	        }
	
	        string alias = this.GetNextAlias();
	        ProjectedColumns pc = this.ProjectColumns(projection.Projector, alias, projection.Source.Alias);
	        return new ProjectionExpression(
	            new SelectExpression(resultType, alias, pc.Columns, projection.Source, null, orderings.AsReadOnly()),
	            pc.Projector
	            );
	    }
	
	    protected virtual Expression BindThenBy(Expression source, LambdaExpression orderSelector, OrderType orderType) {
	        if (this.thenBys == null) {
	            this.thenBys = new List<OrderExpression>();
	        }
	        this.thenBys.Add(new OrderExpression(orderType, orderSelector));
	        return this.Visit(source);
	    }
	    ...
	}
````

当`BindThenBy`方法（处理`ThenBy`和`ThenByDescending`）被调用时，我仅仅将此调用的参数追加的一个保存了then-by信息的列表中。我复用了`OrderExpression`类，用它来保存then-by信息，因为它们的结构是一样的。然后，当`BindOrderBy`方法被调用时，我们就得到了所有的排序表达式，构建一个单独的`SelectExpression`。注意，在我绑定then-by的时候，我逆序遍历了这个集合，因为then-by信息是从后往前添加进集合里的。

现在，一切都准备就绪了。

用下面这个查询测试一下吧：

````cs
    var query = from c in db.Customers
                orderby c.Country, c.City
                select c;
````

它会被翻译为如下的SQL：

````sql
    SELECT t1.CustomerID, t1.ContactName, t1.Phone, t1.City, t1.Country
    FROM (
      SELECT t0.CustomerID, t0.ContactName, t0.Phone, t0.City, t0.Country
      FROM Customers AS t0
    ) AS t1
    ORDER BY t1.Country, t1.City
````

哈哈，正如我所料。

不幸的是，事情还没有完。也许你知道我接下来要说什么，也许你会想，这家伙可能只是沉浸在其中不能自拔吧，这篇文章还有那么长。他不可能还没有完成，一定是搞错了，他一定是想骗我。搞得好像这是一个大难题一样，啊！我讨厌难题。

没错，上面的解决方案确实有问题。在这个例子中，排序似乎没有什么问题，翻译器翻译这个查询，服务器接收并运行它，返回一个排序好的结果。问题在其他潜在的地方。事实上，LINQ与SQL比起来，其排序的语法更为灵活自由。目前的情况是，只要稍微改一改上面的查询，翻译器就会生成一条无法在数据库上运行的非法的SQL。

LINQ允许你在任何你喜欢的地方放置排序表达式，而SQL的限制却比较严格。虽然会有一些特例，但是大部分情况下，我们都只能在最外层的select查询中写唯一的一个order-by子句。就比如我上面的例子，假如我将order-by子句的位置换到前面会怎么样？假如我在排序之后还使用了其他LINQ操作符的话会怎么样？

就好比下面这个查询。

````cs
    var query = from c in db.Customers
                orderby c.City
                where c.Country == "UK"
                select c;
````

它和之前的查询十分相似，只不过在orderby后面多了一个where子句。在SQL里面是不能这么写的。就算能这么写，我们的提供程序又会生成什么样的SQL呢？

````sql
    SELECT t2.City, t2.Country, t2.CustomerID, t2.ContactName, t2.Phone
    FROM (
      SELECT t1.City, t1.Country, t1.CustomerID, t1.ContactName, t1.Phone
      FROM (
        SELECT t0.City, t0.Country, t0.CustomerID, t0.ContactName, t0.Phone
        FROM Customers AS t0
      ) AS t1
      ORDER BY t1.City
    ) AS t2
    WHERE (t2.Country = 'UK')
````

啊，这绝对是运行不了的。且不说这条SQL的文本长度可能会超出限制，单说order-by子句，它属于嵌套的子查询，这样子排序是不会发生的。至少，我们要做到，当用户这样子写的时候，不能抛出一个异常吧。

现在甚至在查询里面加一个简单的投影操作都会引发异常。

````cs
    var query = from c in db.Customers
                orderby c.City
                select new { c.Country, c.City, c.ContactName };
````

翻译上面的查询会出现同样的问题。

````sql
    SELECT t2.Country, t2.City, t2.ContactName
    FROM (
      SELECT t1.City, t1.Country, t1.ContactName, t1.CustomerID, t1.Phone
      FROM (
        SELECT t0.City, t0.Country, t0.ContactName, t0.CustomerID, t0.Phone
        FROM Customers AS t0
      ) AS t1
      ORDER BY t1.City
    ) AS t2
````

很明显，还有做一些额外的工作才能避免异常。问题是，什么工作？

（此处应有沉默）

当然，我早已有了你们期待的解决方案。我必须重建一下这颗查询树，使其遵守SQL排序的语法规则。这意味着将排序表达式从它们不该存在的地方提出来，放到它们应该在的地方去。

这件事做起来并不是那么容易。基于LINQ表达式节点的查询树是不可变的，这意味着我们不能修改它。但这并不是最难的地方，因为我们的访问器能够自动识别变化并且为我们创建一颗新的不可变的树。最难的地方是确保所有的表别名都能够正确匹配，并且处理好order-by子句引用到已经不存在的列的情况。

似乎重头戏现在也还没开始。

## Reordering for SQL's sake

那么要如何实现呢？我另外写了一个访问器类，它负责移动树中的order-by子句。虽然我已经尽可能地简化它的代码，但是最终还是很复杂。其实我可以将这些重建树的逻辑集成到`QueryBinder`类中去的，但是这样会给已有的代码徒增许多复杂度。因此将这些逻辑提取出来会更好，这样就不会对其他代码造成影响。

看看代码吧。

````cs
	/// <summary>
	/// Move order-bys to the outermost select
	/// </summary>
	internal class OrderByRewriter : DbExpressionVisitor {
	    IEnumerable<OrderExpression> gatheredOrderings;
	    bool isOuterMostSelect;
	
	    public OrderByRewriter() {
	    }
	
	    public Expression Rewrite(Expression expression) {
	        this.isOuterMostSelect = true;
	        return this.Visit(expression);
	    }
	
	    protected override Expression VisitSelect(SelectExpression select) {
	        bool saveIsOuterMostSelect = this.isOuterMostSelect;
	        try {
	            this.isOuterMostSelect = false;
	            select = (SelectExpression)base.VisitSelect(select);
	            bool hasOrderBy = select.OrderBy != null && select.OrderBy.Count > 0;
	            if (hasOrderBy) {
	                this.PrependOrderings(select.OrderBy);
	            }
	            bool canHaveOrderBy = saveIsOuterMostSelect;
	            bool canPassOnOrderings = !saveIsOuterMostSelect;
	            IEnumerable<OrderExpression> orderings = (canHaveOrderBy) ? this.gatheredOrderings : null;
	            ReadOnlyCollection<ColumnDeclaration> columns = select.Columns;
	            if (this.gatheredOrderings != null) {
	                if (canPassOnOrderings) {
	                    HashSet<string> producedAliases = new AliasesProduced().Gather(select.From);
	                    // reproject order expressions using this select's alias so the outer select will have properly formed expressions
	                    BindResult project = this.RebindOrderings(this.gatheredOrderings, select.Alias, producedAliases, select.Columns);
	                    this.gatheredOrderings = project.Orderings;
	                    columns = project.Columns;
	                }
	                else {
	                    this.gatheredOrderings = null;
	                }
	            }
	            if (orderings != select.OrderBy || columns != select.Columns) {
	                select = new SelectExpression(select.Type, select.Alias, columns, select.From, select.Where, orderings);
	            }
	            return select;
	        }
	        finally {
	            this.isOuterMostSelect = saveIsOuterMostSelect;
	        }
	    }
	
	    protected override Expression VisitJoin(JoinExpression join) {
	        // make sure order by expressions lifted up from the left side are not lost
	        // when visiting the right side
	        Expression left = this.VisitSource(join.Left);
	        IEnumerable<OrderExpression> leftOrders = this.gatheredOrderings;
	        this.gatheredOrderings = null; // start on the right with a clean slate
	        Expression right = this.VisitSource(join.Right);
	        this.PrependOrderings(leftOrders);
	        Expression condition = this.Visit(join.Condition);
	        if (left != join.Left || right != join.Right || condition != join.Condition) {
	            return new JoinExpression(join.Type, join.Join, left, right, condition);
	        }
	        return join;
	    }
	
	    /// <summary>
	    /// Add a sequence of order expressions to an accumulated list, prepending so as
	    /// to give precedence to the new expressions over any previous expressions
	    /// </summary>
	    /// <param name="newOrderings"></param>
	    protected void PrependOrderings(IEnumerable<OrderExpression> newOrderings) {
	        if (newOrderings != null) {
	            if (this.gatheredOrderings == null) {
	                this.gatheredOrderings = newOrderings;
	            }
	            else {
	                List<OrderExpression> list = this.gatheredOrderings as List<OrderExpression>;
	                if (list == null) {
	                    this.gatheredOrderings = list = new List<OrderExpression>(this.gatheredOrderings);
	                }
	                list.InsertRange(0, newOrderings);
	            }
	        }
	    }
	
	    protected class BindResult {
	        ReadOnlyCollection<ColumnDeclaration> columns;
	        ReadOnlyCollection<OrderExpression> orderings;
	        public BindResult(IEnumerable<ColumnDeclaration> columns, IEnumerable<OrderExpression> orderings) {
	            this.columns = columns as ReadOnlyCollection<ColumnDeclaration>;
	            if (this.columns == null) {
	                this.columns = new List<ColumnDeclaration>(columns).AsReadOnly();
	            }
	            this.orderings = orderings as ReadOnlyCollection<OrderExpression>;
	            if (this.orderings == null) {
	                this.orderings = new List<OrderExpression>(orderings).AsReadOnly();
	            }
	        }
	        public ReadOnlyCollection<ColumnDeclaration> Columns {
	            get { return this.columns; }
	        }
	        public ReadOnlyCollection<OrderExpression> Orderings {
	            get { return this.orderings; }
	        }
	    }
	
	    /// <summary>
	    /// Rebind order expressions to reference a new alias and add to column declarations if necessary
	    /// </summary>
	    protected virtual BindResult RebindOrderings(IEnumerable<OrderExpression> orderings, string alias, HashSet<string> existingAliases, IEnumerable<ColumnDeclaration> existingColumns) {
	        List<ColumnDeclaration> newColumns = null;
	        List<OrderExpression> newOrderings = new List<OrderExpression>();
	        foreach (OrderExpression ordering in orderings) {
	            Expression expr = ordering.Expression;
	            ColumnExpression column = expr as ColumnExpression;
	            if (column == null || (existingAliases != null && existingAliases.Contains(column.Alias))) {
	                // check to see if a declared column already contains a similar expression
	                int iOrdinal = 0;
	                foreach (ColumnDeclaration decl in existingColumns) {
	                    ColumnExpression declColumn = decl.Expression as ColumnExpression;
	                    if (decl.Expression == ordering.Expression || 
	                        (column != null && declColumn != null && column.Alias == declColumn.Alias && column.Name == declColumn.Name)) {
	                        // found it, so make a reference to this column
	                        expr = new ColumnExpression(column.Type, alias, decl.Name, iOrdinal);
	                        break;
	                    }
	                    iOrdinal++;
	                }
	                // if not already projected, add a new column declaration for it
	                if (expr == ordering.Expression) {
	                    if (newColumns == null) {
	                        newColumns = new List<ColumnDeclaration>(existingColumns);
	                        existingColumns = newColumns;
	                    }
	                    string colName = column != null ? column.Name : "c" + iOrdinal;
	                    newColumns.Add(new ColumnDeclaration(colName, ordering.Expression));
	                    expr = new ColumnExpression(expr.Type, alias, colName, iOrdinal);
	                }
	                newOrderings.Add(new OrderExpression(ordering.OrderType, expr));
	            }
	        }
	        return new BindResult(existingColumns, newOrderings);
	    }
	}
````

代码好多:-) 

主要的访问算法的工作方式如下。访问器自底向上遍历表达式树，它维护了一个增长的order-by表达式的集合。它与`QueryBinder`类刚好是相反的，`QueryBinder`自顶向下遍历表达式树，将then-by表达式添加到集合中。如果外层查询和内层查询都有order-by表达式的话，它们两个的表达式都不会丢失。外层查询的order-by表达式会放在内层查询的order-by表达式的前面。`VisitSelect`方法中调用了`PrependOrdering`方法，将当前order-by表达式添加到增长的列表的头部。

接下来我判断当前select节点是不是最外层的select节点，如果是，则它可以拥有order-by表达式，如果不是则不能拥有。如果我支持了TSQL的TOP子句的话，这个判断就有意思了。另外，我还要判断这个select节点是否可以向外层传递排序信息，如果它是内层节点的话，则可以。当然，如果我支持DISTINCT关键字的话，这里还会有更多的工作要做，原因在待会介绍`RebindOrdering`方法的时候就会明了。

当确定某个节点必须将它的order-by表达式传递到其外层节点时，这些order-by表达式必须要修改，以使其引用当前select节点的表别名，因为这些表达式原本引用的是内层查询的表别名。另外，如果order-by表达式中引用到了一些不存在于当前select节点的列投影中的列的话，我们还需要将这些列添加到投影中去，以便在外层查询中还能访问到它们。这整个过程称为重新绑定，这些逻辑都已经封装在`RebindOrdering`方法中。

现在回到之前说的那个问题，如果一个select节点使用了DISTINCT关键字，那么往投影中添加order-by表达式中引用到的列就会出错了。这些新添加的列会影响到distinct操作的结果。现在倒是不用担心这个问题，因为我们根本就不支持distinct，但是我们以后会支持，所以最好要提前考虑到这点。这就是LINQ to SQL在distinct或union操作中不支持排序的真正原因。

把前面提到的所有东西都加到代码里来，我们只需要修改一下`DBQueryProvider`类，让它调用新添加的访问器即可。

````cs
    public class DbQueryProvider : QueryProvider {
        ...
        private TranslateResult Translate(Expression expression) {
            ProjectionExpression projection = expression as ProjectionExpression;
            if (projection == null) {
                expression = Evaluator.PartialEval(expression, CanBeEvaluatedLocally);
                expression = new QueryBinder(this).Bind(expression);
                expression = new OrderByRewriter().Rewrite(expression);
                projection = (ProjectionExpression)expression;
            }
            string commandText = new QueryFormatter().Format(projection.Source);
            LambdaExpression projector = new ProjectionBuilder().Build(projection.Projector, projection.Source.Alias);
            return new TranslateResult { CommandText = commandText, Projector = projector };
        }
        ...
    } 
````

现在，执行下面这个不算太复杂的查询。

````cs
    var query = from c in db.Customers
                orderby c.City
                where c.Country == "UK"
                select new { c.City, c.ContactName };
````

翻译后得到如下SQL：

````sql
    SELECT t3.City, t3.ContactName
    FROM (
      SELECT t2.City, t2.Country, t2.ContactName, t2.CustomerID, t2.Phone
      FROM (
        SELECT t1.City, t1.Country, t1.ContactName, t1.CustomerID, t1.Phone
        FROM (
          SELECT t0.City, t0.Country, t0.ContactName, t0.CustomerID, t0.Phone
          FROM Customers AS t0
        ) AS t1
      ) AS t2
      WHERE (t2.Country = 'UK')
    ) AS t3
    ORDER BY t3.City
````

这可比之前生成的SQL好多了。

执行完成后，得到如下输出：

````plain
	{ City = Cowes, ContactName = Helen Bennett }
	{ City = London, ContactName = Simon Crowther }
	{ City = London, ContactName = Hari Kumar }
	{ City = London, ContactName = Thomas Hardy }
	{ City = London, ContactName = Victoria Ashworth }
	{ City = London, ContactName = Elizabeth Brown }
	{ City = London, ContactName = Ann Devon }
````

好了，这就是排序的实现，至少也算是一个好的开始。

当然，如果我们能将那些不必要的子查询去掉的话就更好了。也许下次吧:-)

[Query8.zip](https://msdnshared.blob.core.windows.net/media/MSDNBlogsFS/prod.evol.blogs.msdn.com/CommunityServer.Components.PostAttachments/00/05/38/61/88/Query8.zip)