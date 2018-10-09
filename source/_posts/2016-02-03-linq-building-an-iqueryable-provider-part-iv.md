---
layout:     post
title:      "「译」LINQ: Building an IQueryable Provider - Part IV"
subtitle:   "Select"
author:     "刘文俊"
tags:
    - 翻译
    - LINQ
    - C♯
---

> 英文原文是[Matt Warren](https://social.msdn.microsoft.com/profile/matt%20warren%20-%20msft/ "Matt Warren")发表在MSDN Blogs的系列文章之一，英文渣渣，翻译**不供参考**，请直接[看原文](http://blogs.msdn.com/b/mattwar/archive/2007/08/02/linq-building-an-iqueryable-provider-part-iv.aspx)。

我是个完美主义者，我做了一个仅仅可以将Where方法翻译为SQL的LINQ提供程序，它可以执行查询并且将结果转换为对象，但我觉得还不够完美，相信你们也这么认为。你们也许想知道从一个简单的示例程序演变成一个成熟的ORM系统的所有细节。但是我并不会做到这个程度，即便如此，我还是觉得，我可以通过介绍如何实现Select操作来覆盖到一些通用的知识点，以方便你编写自己的提供程序。

## Implementing Select

与Where操作比起来，翻译Select操作可没那么容易。我现在说的不是那种从十列里面选出五列的SQL操作，而是将数据转换为任何你想要的形式的LINQ Select操作。LINQ Select操作中的选择器函数可以是你能想象到的任何转换表达式，里面可能会有对象构造器、初始化器、条件语句、二元运算符、方法调用等等。这么多东西要如何翻译为SQL，更别说还要从返回的结果里面重新构造出对象的结构？

幸运的是，我并不会真的这样做。为什么呢？因为要写的代码太多吗？实际上是因为本来已经就有代码帮我们处理了大部分的事情，所以我才不需要熬夜奋战。我不用自己写，因为用户在写查询的时候就已经把转换代码写出来了。

选择器函数就是构造结果的代码。在LINQ to Objects中，选择器函数会被真正地调用，从而产生结果，那为何在我的查询提供程序中就要不一样呢？

啊哈，先别急。当然，如果选择器函数是可执行代码而不是表达式树的话，那是最好的，即便它是可执行代码，它也只是个将对象转换为另一个对象的函数罢了。可是我并没有要转换的对象啊。我有一个`DbDataReader`，它带有许多字段数据，可它是拿来生成最终的对象的，我现在还没有要拿来转换的对象啊。

当然，也许你能自己想出一个好的解决方案，将前面的`ObjectReader`与LINQ to Objects版本的Select操作结合起来，取出所有数据，转换成另外一种形式。但是这对时间和空间都是巨大的浪费。我们不应该取出所有的数据，我们只应该取需要拿来产生结果的数据就够了。这真是个进退两难的局面。

幸运的是，问题仍然很简单。只需要将原有的选择器函数转换成我们需要的样子就可以了。我们需要什么样子的呢？我们需要它直接从`DbDataReader`中读取数据。好了，我们可以将这个问题中的`DataReader`抽象出来，提供一个`GetValue`方法让选择器函数获得数据。对，我知道`DataReader`里面已经有了一个这样的方法，但是它有个缺点，就是可能会返回`DbNull`。

````cs
	public abstract class ProjectionRow {
	    public abstract object GetValue(int index);
	}
````

所以，我们有了一个简单的抽象基类，它代表了一行数据。如果我们的选择器表达式是从这里通过调用`GetValue`方法来获得数据，然后接上一个`Expression.Convert`强转操作的话，我真的是做梦都会笑醒。

让我们看看预处理选择器表达式的代码吧。

````cs
	internal class ColumnProjection {
	    internal string Columns;
	    internal Expression Selector;
	}
	 
	internal class ColumnProjector : ExpressionVisitor {
	    StringBuilder sb;
	    int iColumn;
	    ParameterExpression row;
	    static MethodInfo miGetValue;
	 
	    internal ColumnProjector() {
	        if (miGetValue == null) {
	            miGetValue = typeof(ProjectionRow).GetMethod("GetValue");
	        }
	    }
	 
	    internal ColumnProjection ProjectColumns(Expression expression, ParameterExpression row) {
	        this.sb = new StringBuilder();
	        this.row = row;
	        Expression selector = this.Visit(expression);
	        return new ColumnProjection { Columns = this.sb.ToString(), Selector = selector };
	    }
	 
	    protected override Expression VisitMemberAccess(MemberExpression m) {
	        if (m.Expression != null && m.Expression.NodeType == ExpressionType.Parameter) {
	            if (this.sb.Length > 0) {
	                this.sb.Append(", ");
	            }
	            this.sb.Append(m.Member.Name);
	            return Expression.Convert(Expression.Call(this.row, miGetValue, Expression.Constant(iColumn++)), m.Type);
	        }
	        else {
	            return base.VisitMemberAccess(m);
	        }
	    }
	}
````

上面的当然不是所有的代码。`ColumnProjector`是一个表达式访问器，它遍历表达式树，将列引用转换为调用`GetValue`方法获得单个数据的表达式。那`GetValue`方法又是通过什么来调用的呢？通过一个名为“row”的参数表达式，它的类型就是我刚刚定义的抽象类`ProjectionRow`。我不仅重建了一个选择器表达式，我还要把它放在一个以`ProjectionRow`为参数的lambda表达式的body中。这样我就能调用`LambdaExpression.Compile`方法将这个lambda表达式转换为委托。

注意这个表达式访问器还构造了一个SQL的select子句。通过这个类，我既可以将`Query.Select`中的查询表达式转换为处理查询结果的函数，又能得到SQL命令中的select子句。

让我们来看看怎么使用这个类吧，下面是修改后的`QueryTranslator`（仅给出相关内容）。

````cs
	internal class TranslateResult {
	    internal string CommandText;
	    internal LambdaExpression Prsojector;
	}
	
	internal class QueryTranslator : ExpressionVisitor {
	    StringBuilder sb;
	    ParameterExpression row;
	    ColumnProjection projection;
	 
	    internal QueryTranslator() {
	    }
	 
	    internal TranslateResult Translate(Expression expression) {
	        this.sb = new StringBuilder();
	        this.row = Expression.Parameter(typeof(ProjectionRow), "row");
	        this.Visit(expression);
	        return new TranslateResult {
	            CommandText = this.sb.ToString(),
	            Projector = this.projection != null ? Expression.Lambda(this.projection.Selector, this.row) : null
	        };
	    }
	 
	    protected override Expression VisitMethodCall(MethodCallExpression m) {
	        if (m.Method.DeclaringType == typeof(Queryable)) {
	            if (m.Method.Name == "Where") {
	                sb.Append("SELECT * FROM (");
	                this.Visit(m.Arguments[0]);
	                sb.Append(") AS T WHERE ");
	                LambdaExpression lambda = (LambdaExpression)StripQuotes(m.Arguments[1]);
	                this.Visit(lambda.Body);
	                return m;
	            }
	            else if (m.Method.Name == "Select") {
	                LambdaExpression lambda = (LambdaExpression)StripQuotes(m.Arguments[1]);
	                ColumnProjection projection = new ColumnProjector().ProjectColumns(lambda.Body, this.row);
	                sb.Append("SELECT ");
	                sb.Append(projection.Columns);
	                sb.Append(" FROM (");
	                this.Visit(m.Arguments[0]);
	                sb.Append(") AS T ");
	                this.projection = projection;
	                return m;
	            }
	        }
	        throw new NotSupportedException(string.Format("The method '{0}' is not supported", m.Method.Name));
	    }
	
	    . . .
	}
````

如你所见，`QueryTranslator`现在处理了Select方法，它就像Where方法一样构建一条SQL SELECT语句。但是它还保存了最后一个`ColumnProjection`对象（调用`ProjectColumns`方法的结果），在`TranslateResult`对象中以lambda表达式的形式返回新构建的选择器表达式。

现在我们只需要一个`ObjectReader`类，它使用这个lambda表达式来处理数据，而不是像之前那样仅仅只是创建一个对象。

看下面的代码。

````cs
	internal class ProjectionReader<T> : IEnumerable<T>, IEnumerable {
	    Enumerator enumerator;
	 
	    internal ProjectionReader(DbDataReader reader, Func<ProjectionRow, T> projector) {
	        this.enumerator = new Enumerator(reader, projector);
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
	 
	        internal Enumerator(DbDataReader reader, Func<ProjectionRow, T> projector) {
	            this.reader = reader;
	            this.projector = projector;
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
````

`ProjectionReader`类与Part II中的`ObjectReader`类十分相似，只是去除了使用各个字段来创建对象的逻辑，替换成了一个名为`projector`的委托的调用。这就是我们重建的选择器表达式编译出来的委托。

记得吗，我们重建的选择器表达式是以`ProjectionRow`为参数的。现在你可以看到`ProjectionReader`里面的`Enumerator`就实现了`ProjectionRow`。这是件好事，因为它是这里唯一一个直接访问了`DbDataReader`的类，并且我们在调用委托的时候还可以很方便地将this作为参数传进去就好了。

似乎所有组件都已经没问题了，现在让我们把它们组装到`DbQueryProvider`中去。

下面是新的provider的代码：

````cs
	public class DbQueryProvider : QueryProvider {
	    DbConnection connection;
	 
	    public DbQueryProvider(DbConnection connection) {
	        this.connection = connection;
	    }
	 
	    public override string GetQueryText(Expression expression) {
	        return this.Translate(expression).CommandText;
	    }
	 
	    public override object Execute(Expression expression) {
	        TranslateResult result = this.Translate(expression);
	 
	        DbCommand cmd = this.connection.CreateCommand();
	        cmd.CommandText = result.CommandText;
	        DbDataReader reader = cmd.ExecuteReader();
	 
	        Type elementType = TypeSystem.GetElementType(expression.Type);
	        if (result.Projector != null) {
	            Delegate projector = result.Projector.Compile();
	            return Activator.CreateInstance(
	                typeof(ProjectionReader<>).MakeGenericType(elementType),
	                BindingFlags.Instance | BindingFlags.NonPublic, null,
	                new object[] { reader, projector },
	                null
	                );
	        }
	        else {
	            return Activator.CreateInstance(
	                typeof(ObjectReader<>).MakeGenericType(elementType),
	                BindingFlags.Instance | BindingFlags.NonPublic, null,
	                new object[] { reader },
	                null
	                );
	        }
	    }
	 
	    private TranslateResult Translate(Expression expression) {
	        expression = Evaluator.PartialEval(expression);
	        return new QueryTranslator().Translate(expression);
	    }
	}
````

对`Translate`方法的调用返回了我需要的所有东西，我只需要再调用`Compile`方法将lambda表达式转换为委托就可以。注意我仍然需要保留`ObjectReader`类，它会在查询中没有Select操作的时候用到。

现在来试试最后的结果如何吧。

````cs
	string city = "London";
	var query = db.Customers.Where(c => c.City == city)
	              .Select(c => new {Name = c.ContactName, Phone = c.Phone});
	Console.WriteLine("Query:\n{0}\n", query);
	
	var list = query.ToList();
	foreach (var item in list) {
	    Console.WriteLine("{0}", item);
	}
````

执行上面的代码，输出结果如下：

````plain
	Query:
	SELECT ContactName, Phone FROM (SELECT * FROM (SELECT * FROM Customers) AS T WHERE (City = 'London')) AS T
	{ Name = Thomas Hardy, Phone = (171) 555-7788 }
	{ Name = Victoria Ashworth, Phone = (171) 555-1212 }
	{ Name = Elizabeth Brown, Phone = (171) 555-2282 }
	{ Name = Ann Devon, Phone = (171) 555-0297 }
	{ Name = Simon Crowther, Phone = (171) 555-7733 }
	{ Name = Hari Kumar, Phone = (171) 555-1717 }
````

看，我没有再返回所有数据了，这正是我想要的。翻译后的选择器表达式转换成了一个委托，这个委托包含了“new xxx”的匿名类型初始化器，调用了`GetValue`方法从`DataReader`中读取数据保存到返回的对象中，不需要再使用反射对每个字段赋值了。我们的查询提供程序越来越好了，你一定觉得我们应该已经完成了，这个提供程序好屌！还有什么是没做的吗？

我们还有许多的事情要做。即使有了Select，即使它真的能运行良好，这个解决方案还是有一些漏洞，要修补的话还要对代码进行大改。

幸运的是，对我来说，这才是好玩的部分，Part V中再见。

Matt.