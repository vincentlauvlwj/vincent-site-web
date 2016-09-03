---
layout:     post
title:      "「译」LINQ: Building an IQueryable Provider - Part VI"
subtitle:   "Nested queries"
author:     "刘文俊"
tags:
    - 翻译
    - LINQ
    - C♯
---

> 英文原文是[Matt Warren](https://social.msdn.microsoft.com/profile/matt%20warren%20-%20msft/ "Matt Warren")发表在MSDN Blogs的系列文章之一，英文渣渣，翻译**不供参考**，请直接[看原文](http://blogs.msdn.com/b/mattwar/archive/2007/08/09/linq-building-an-iqueryable-provider-part-vi.aspx)。

你又以为这个系列已经完成，所以我已经转移到其他阵地上去了吗？因为Select操作工作得非常好，所以你以为前面所讲的就是你构建自己的`IQueryable`提供程序所需要了解的所有内容了吗？哈！还有很多需要学习的呢，而且，Select操作还是有些漏洞。

## Finishing Select

有漏洞？怎么可能？我把你当成从来不会出错的微软大神，但是你却说你给我的是劣质的代码？我把已经把代码复制粘贴到产品里，老板已经说了下周一就启动！你怎么能这么做？（喘气）

放心啦，不是什么严重的漏洞，只是一点小小的缺陷而已。

回想一下，在上篇文章中，我建了四种表达式节点，Table，Column，Select和Projection，它们工作十分良好，不是吗？有漏洞的地方是我没有考虑到所有可以写查询表达式的地方。我考虑到的只是最明显的Projection节点出现在查询表达式树顶的情况。毕竟，因为我只支持`Select`和`Where`，所以最后一个操作必定是这两者之一。我的代码就是这样假设的。

这不是问题所在。

问题是Projection节点也有可能出现在选择器表达式里面，例如，看下面的查询。

	var query = from c in db.Customers
                select new {
                    Name = c.ContactName,
                    Orders = from o in db.Orders
                             where o.CustomerID == c.CustomerID
                             select o
                };

我在选择器表达式里面写了一个嵌套查询，这与我们之前写的表格式的查询非常不一样。现在我希望我们的提供程序创建嵌套的对象，每个对象都有一个名字和一个订单的集合。这样的查询要怎么实现？SQL甚至都做不到这一点。即使我彻底不支持这种写法，万一有人真的这么写又会发生什么呢？

额，抛出了一个异常，然而并不是我预想的那个异常，看来代码中的bug比我预想的要多。因为这个可爱的查询在选择器表达式中有一个`ProjectionExpression`，所以我期望在编译投影器函数的时候会抛出一个异常。我之前说过添加自己的表达式节点是没问题的对吧？理由是只有我们才能看到这些节点，哈，看来是我错了。（实际上抛出来的异常是因为我在构建Projection节点的时候弄错了它们的类型而导致的，这个以后再修复。）

现在假设我已经修复了这个类型异常，我要如何处理这个嵌套的Projection节点呢？我可以捕捉这个异常，然后抛出一个自己的异常，加个道歉声明说不支持嵌套查询。但是这样的话我就不是一个好的LINQ开发者，也享受不到解决这个问题的乐趣了。

所以，让我们继续前进吧。

## Nested Queries

我希望能够将嵌套的`ProjectionExpression`转换为嵌套的查询。SQL实际上也做不到这一点，所以我必须在自己的代码做一些事情以达到这种效果。然而，在这里我并不打算做成一个超级完善的解决方案，我只要能取回数据就够了。

因为投影器函数必须要转换为可执行的代码，所以我得将里面的`ProjectionExpression`节点给替换成从某个地方获取数据以构建Orders集合的代码。数据不可能来自现有的`DataReader`，因为它只能保存表格式的结果，因此应该来自另一个`DataReader`。我真正要做的就是将`ProjectionExpression`转换成执行的时候返回这个集合的一个函数。

我们好像在之前见过类似的东西？

思考中。。。

对，这或多或少就是我们的提供程序所做的事情。呼，事情好像有点难。提供程序早已通过`Execute`方法将表达式树转换成了结果序列。我想我已经完成一半了。

所以我需要在之前的`ProjectionRow`类中添加一个执行嵌套查询的函数，它回调提供程序以执行真正的工作。

下面是`ProjectionRow`和`ProjectionBuilder`的代码。

	public abstract class ProjectionRow {
        public abstract object GetValue(int index);
        public abstract IEnumerable<E> ExecuteSubQuery<E>(LambdaExpression query);
    }

    internal class ProjectionBuilder : DbExpressionVisitor {
        ParameterExpression row;
        string rowAlias;
        static MethodInfo miGetValue;
        static MethodInfo miExecuteSubQuery;
        
        internal ProjectionBuilder() {
            if (miGetValue == null) {
                miGetValue = typeof(ProjectionRow).GetMethod("GetValue");
                miExecuteSubQuery = typeof(ProjectionRow).GetMethod("ExecuteSubQuery");
            }
        }

        internal LambdaExpression Build(Expression expression, string alias) {
            this.row = Expression.Parameter(typeof(ProjectionRow), "row");
            this.rowAlias = alias;
            Expression body = this.Visit(expression);
            return Expression.Lambda(body, this.row);
        }

        protected override Expression VisitColumn(ColumnExpression column) {
            if (column.Alias == this.rowAlias) {
                return Expression.Convert(Expression.Call(this.row, miGetValue, Expression.Constant(column.Ordinal)), column.Type);
            }
            return column;
        }

        protected override Expression VisitProjection(ProjectionExpression proj) {
            LambdaExpression subQuery = Expression.Lambda(base.VisitProjection(proj), this.row);
            Type elementType = TypeSystem.GetElementType(subQuery.Body.Type);
            MethodInfo mi = miExecuteSubQuery.MakeGenericMethod(elementType);
            return Expression.Convert(
                Expression.Call(this.row, mi, Expression.Constant(subQuery)),
                proj.Type
                );
        }
    }

就像在遇到`ColumnExpression`时插入`GetValue`方法调用一样，在遇到`ProjectionExpression`时也要插入`ExecuteSubQuery`方法调用。

在`base.VisitProjection`调用返回之后，投影器表达式中的相应的`ColumnExpression`已经被替换掉了。我决定将投影器表达式和指向`ProjectionRow`的参数绑定在一起，刚好有一个类可以做这件事，`LambdaExpression`，因此我将它作为`ExecuteSubQuery`方法的参数类型。

注意我是将subQuery作为一个`ConstantExpression`传进去的，这是为了骗过`LambdaExpression.Compile`方法，使之注意不到我们自己增加的节点。总之我不想让我们自己增加的节点被编译。

下一个要看的是修改过的`ProjectionReader`类，当然，`Enumerator`现在也实现了`ExecuteSubQuery`方法。

	internal class ProjectionReader<T> : IEnumerable<T>, IEnumerable {
        Enumerator enumerator;

        internal ProjectionReader(DbDataReader reader, Func<ProjectionRow, T> projector, IQueryProvider provider) {
            this.enumerator = new Enumerator(reader, projector, provider);
        }

        public IEnumerator<T> GetEnumerator() {
            Enumerator e = this.enumerator;
            if (e == null) {
                throw new InvalidOperationException("Cannot enumerate more than once");
            }
            this.enumerator = null;
            return e;
        }

        IEnumerator IEnumerable.GetEnumerator() {
            return this.GetEnumerator();
        }

        class Enumerator : ProjectionRow, IEnumerator<T>, IEnumerator, IDisposable {
            DbDataReader reader;
            T current;
            Func<ProjectionRow, T> projector;
            IQueryProvider provider;

            internal Enumerator(DbDataReader reader, Func<ProjectionRow, T> projector, IQueryProvider provider) {
                this.reader = reader;
                this.projector = projector;
                this.provider = provider;
            }

            public override object GetValue(int index) {
                if (index >= 0) {
                    if (this.reader.IsDBNull(index)) {
                        return null;
                    }
                    else {
                        return this.reader.GetValue(index);
                    }
                }
                throw new IndexOutOfRangeException();
            }

            public override IEnumerable<E> ExecuteSubQuery<E>(LambdaExpression query) {
                ProjectionExpression projection = (ProjectionExpression) new Replacer().Replace(query.Body, query.Parameters[0], Expression.Constant(this));
                projection = (ProjectionExpression) Evaluator.PartialEval(projection, CanEvaluateLocally);
                IEnumerable<E> result = (IEnumerable<E>)this.provider.Execute(projection);
                List<E> list = new List<E>(result);
                if (typeof(IQueryable<E>).IsAssignableFrom(query.Body.Type)) {
                    return list.AsQueryable();
                }
                return list;
            }

            private static bool CanEvaluateLocally(Expression expression) {
                if (expression.NodeType == ExpressionType.Parameter ||
                    expression.NodeType.IsDbExpression()) {
                    return false;
                }
                return true;
            }

            public T Current {
                get { return this.current; }
            }

            object IEnumerator.Current {
                get { return this.current; }
            }

            public bool MoveNext() {
                if (this.reader.Read()) {
                    this.current = this.projector(this);
                    return true;
                }
                return false;
            }

            public void Reset() {
            }

            public void Dispose() {
                this.reader.Dispose();
            }
        }
    }

我在创建`ProjectionReader`时将provider的实例传了进去，它在下面的`ExecuteSubQuery`中执行子查询时会用到。

看`ExecuteSubQuery`方法，hey，那个`Replacer.Replace`是个什么鬼？

我还没有告诉你这个类是什么，待会会给出它的代码，我们先来解释一下`ExecuteSubQuery`方法干了什么。我们获得了一个`LambdaExpression`类型的参数，它的body是内查询原始的`ProjectionExpression`，parameter是指向当前`ProjectionRow`的引用。虽然一切都是极好的，但问题是我不能通过回调provider来执行这个表达式，因为所有引用了外层查询（想想Where子句里面的连接条件）的`ColumnExpression`现在都被替换成了`GetValue`表达式。

没错，我在内层查询里面引用了外层查询，我不能让这些`GetValue`继续留在表达式中，因为这样的话子查询在执行的时候会尝试去访问不存在的列，好囧。

思考中。。。

啊哈，想到了！这些`GetValue`方法要获取的数据其实早就可用，并且近在咫尺，这些数据就在`DataReader`当前行里面。所以我想做的就是以某种方式将这些表达式的值马上“计算”出来，强制子表达式调用`GetValue`方法。要是已经有代码来做这件事那就太完美了。

等等，这不正是`Evaluator.PartialEval`方法的工作吗？当然，但是在这里并不管用。为什么？因为这些表达式引用了`ProjectionRow`参数，而`ParameterExpression`又是让`Evaluator`类不对其进行计算的标志。如果我能去掉这些参数引用，将其替换为指向当前`ProjectionRow`实例的常量表达式的话，就可以使用`Evaluator.PartialEval`方法将它们替换为实际的值了。这样一切都好办了。

怎么做呢？我需要一个工具，它查找表达式树中的节点，并将其替换为另一个节点。

下面是`Replacer`类，它简单地遍历一棵树，寻找一个节点的引用，将其替换为另一个不同节点的引用。

	internal class Replacer : DbExpressionVisitor {
        Expression searchFor;
        Expression replaceWith;
        internal Expression Replace(Expression expression, Expression searchFor, Expression replaceWith) {
            this.searchFor = searchFor;
            this.replaceWith = replaceWith;
            return this.Visit(expression);
        }
        protected override Expression Visit(Expression exp) {
            if (exp == this.searchFor) {
                return this.replaceWith;
            }
            return base.Visit(exp);
        }
    }

漂亮，我都被自己的机智吓到了。

好了，现在我已经可以将那些讨厌的`ProjectionRow`参数的引用替换成实际的对象，这就是`ExecuteSubQuery`方法的第一行所做的事情。然而这仅花了几十行英文就解释清楚了:-)

如我所愿，第二行调用了`Execute.PartialEval`方法。下一行紧接着又调用了provider来执行子查询！撒花！然后我将结果放到了一个List对象中，最后我有可能还要再将它转成`IQueryable`。我知道这很奇怪，但是这个原生查询中`Orders`属性的类型就是`IQueryable<Order>`，这就是`IQueryable`查询操作符的工作方式，所以C♯创造了匿名类型以充当成员类型。如果我尝试直接返回list的话，将结果组合到一起的投影器就会报错。幸运的是，已经有了将`IEnumerable`转换成`IQueryable`的方法，`Queryable.AsQueryable`。

哇！这些组件就好像被精妙设计出来的一样，能够完美地协同工作了。

大揭秘：我小小作了个弊。我改了`Evaluator`类，使它能够识别我自己添加的表达式类型。我知道，我知道，我说过其他人没必要知道它们的存在，但是`Evaluator`也是我自己的代码，所以我觉得这样并没有问题。我在附件的zip文件中附带了这个小小的修改，在这里我只放出有大修改的代码，那点小修改就不放出来了。

我还得写一个新的`CanEvaluateLocally`规则以供`Evaluator`类使用，我得确保它不会将我自己添加的那些节点视为可计算的。

所以让我们来看看`DbQueryProvider`有什么变化吧。

	public class DbQueryProvider : QueryProvider {
        DbConnection connection;
        TextWriter log;

        public DbQueryProvider(DbConnection connection) {
            this.connection = connection;
        }

        public TextWriter Log {
            get { return this.log; }
            set { this.log = value; }
        }

        public override string GetQueryText(Expression expression) {
            return this.Translate(expression).CommandText;
        }

        public override object Execute(Expression expression) {
            return this.Execute(this.Translate(expression));
        }

        private object Execute(TranslateResult query) {
            Delegate projector = query.Projector.Compile();

            if (this.log != null) {
                this.log.WriteLine(query.CommandText);
                this.log.WriteLine();
            }

            DbCommand cmd = this.connection.CreateCommand();
            cmd.CommandText = query.CommandText;
            DbDataReader reader = cmd.ExecuteReader();

            Type elementType = TypeSystem.GetElementType(query.Projector.Body.Type);
            return Activator.CreateInstance(
                typeof(ProjectionReader<>).MakeGenericType(elementType),
                BindingFlags.Instance | BindingFlags.NonPublic, null,
                new object[] { reader, projector, this },
                null
                );
        }

        internal class TranslateResult {
            internal string CommandText;
            internal LambdaExpression Projector;
        }

        private TranslateResult Translate(Expression expression) {
            ProjectionExpression projection = expression as ProjectionExpression;
            if (projection == null) {
                expression = Evaluator.PartialEval(expression);
                projection = (ProjectionExpression)new QueryBinder().Bind(expression);
            }
            string commandText = new QueryFormatter().Format(projection.Source);
            LambdaExpression projector = new ProjectionBuilder().Build(projection.Projector, projection.Source.Alias);
            return new TranslateResult { CommandText = commandText, Projector = projector };
        }
    }

唯一有变化的是`Translate`方法。当传进来的参数是`ProjectionExpression`时，就不再进行将表达式转换成`ProjectionExpression`的操作，而是直接跳到构建SQL命令和投影器的步骤。

差点忘记，我还添加了类似LINQ to SQL的日志的特性，它能帮助我们看清背后的执行过程。我的上下文类里面也加了`Log`属性。

	public class Northwind {
        public Query<Customers> Customers;
        public Query<Orders> Orders;

        private DbQueryProvider provider;
        public Northwind(DbConnection connection) {
            this.provider = new DbQueryProvider(connection);
            this.Customers = new Query<Customers>(this.provider);
            this.Orders = new Query<Orders>(this.provider);
        }

        public TextWriter Log {
            get { return this.provider.Log; }
            set { this.provider.Log = value; }
        }
    }

## Taking it for a Spin

现在，让我们试试这个新的魔法般的特性把。

	string city = "London";
    var query = from c in db.Customers
                where c.City == city
                select new {
                    Name = c.ContactName,
                    Orders = from o in db.Orders
                             where o.CustomerID == c.CustomerID
                             select o
                };


    foreach (var item in query) {
        Console.WriteLine("{0}", item.Name);
        foreach (var ord in item.Orders) {
            Console.WriteLine("\tOrder: {0}", ord.OrderID);
        }
    }

执行上面的代码，产生如下输出：

	Thomas Hardy
	        Order: 10355
	        Order: 10383
	        Order: 10453
	        Order: 10558
	        Order: 10707
	        Order: 10741
	        Order: 10743
	        Order: 10768
	        Order: 10793
	        Order: 10864
	        Order: 10920
	        Order: 10953
	        Order: 11016
	Victoria Ashworth
	        Order: 10289
	        Order: 10471
	        Order: 10484
	        Order: 10538
	        Order: 10539
	        Order: 10578
	        Order: 10599
	        Order: 10943
	        Order: 10947
	        Order: 11023
	Elizabeth Brown
	        Order: 10435
	        Order: 10462
	        Order: 10848
	Ann Devon
	        Order: 10364
	        Order: 10400
	        Order: 10532
	        Order: 10726
	        Order: 10987
	        Order: 11024
	        Order: 11047
	        Order: 11056
	Simon Crowther
	        Order: 10517
	        Order: 10752
	        Order: 11057
	Hari Kumar
	        Order: 10359
	        Order: 10377
	        Order: 10388
	        Order: 10472
	        Order: 10523
	        Order: 10547
	        Order: 10800
	        Order: 10804
	        Order: 10869

下面是查询的执行过程（我用了新的`Log`属性捕捉到的）：

	SELECT t2.ContactName, t2.CustomerID
	FROM (
	  SELECT t1.CustomerID, t1.ContactName, t1.Phone, t1.City, t1.Country
	  FROM (
	    SELECT t0.CustomerID, t0.ContactName, t0.Phone, t0.City, t0.Country
	    FROM Customers AS t0
	  ) AS t1
	  WHERE (t1.City = 'London')
	) AS t2
	
	SELECT t4.OrderID, t4.CustomerID, t4.OrderDate
	FROM (
	  SELECT t3.OrderID, t3.CustomerID, t3.OrderDate
	  FROM Orders AS t3
	) AS t4
	WHERE (t4.CustomerID = 'AROUT')
	
	SELECT t4.OrderID, t4.CustomerID, t4.OrderDate
	FROM (
	  SELECT t3.OrderID, t3.CustomerID, t3.OrderDate
	  FROM Orders AS t3
	) AS t4
	WHERE (t4.CustomerID = 'BSBEV')
	
	SELECT t4.OrderID, t4.CustomerID, t4.OrderDate
	FROM (
	  SELECT t3.OrderID, t3.CustomerID, t3.OrderDate
	  FROM Orders AS t3
	) AS t4
	WHERE (t4.CustomerID = 'CONSH')
	
	SELECT t4.OrderID, t4.CustomerID, t4.OrderDate
	FROM (
	  SELECT t3.OrderID, t3.CustomerID, t3.OrderDate
	  FROM Orders AS t3
	) AS t4
	WHERE (t4.CustomerID = 'EASTC')
	
	SELECT t4.OrderID, t4.CustomerID, t4.OrderDate
	FROM (
	  SELECT t3.OrderID, t3.CustomerID, t3.OrderDate
	  FROM Orders AS t3
	) AS t4
	WHERE (t4.CustomerID = 'NORTS')
	
	SELECT t4.OrderID, t4.CustomerID, t4.OrderDate
	FROM (
	  SELECT t3.OrderID, t3.CustomerID, t3.OrderDate
	  FROM Orders AS t3
	) AS t4
	WHERE (t4.CustomerID = 'SEVES')

虽然让内层查询执行许多次不是很理想，但是总比直接抛出一个异常要好。

现在，Select操作已经最终完成了，它现在已经可以支持任意的投影了。也许吧:-)

<img src="http://blogs.msdn.com/utility/filethumbnails/zip.gif" style="display: inline !important;"/>[Query6.zip](http://blogs.msdn.com/cfs-file.ashx/__key/communityserver-components-postattachments/00-04-31-53-48/Query6.zip)