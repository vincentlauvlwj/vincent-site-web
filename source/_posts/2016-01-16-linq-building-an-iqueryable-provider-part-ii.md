---
layout:     post
title:      "「译」LINQ: Building an IQueryable Provider - Part II"
subtitle:   "Where and reusable Expression tree visitor"
author:     "刘文俊"
tags:
    - 翻译
    - LINQ
    - C♯
---

> 英文原文是[Matt Warren](https://social.msdn.microsoft.com/profile/matt%20warren%20-%20msft/ "Matt Warren")发表在MSDN Blogs的系列文章之一，英文渣渣，翻译**不供参考**，请直接[看原文](http://blogs.msdn.com/b/mattwar/archive/2007/07/31/linq-building-an-iqueryable-provider-part-ii.aspx)。

在上篇文章中，我们已经打好了基础，定义了可重用的`IQueryable`和`IQueryProvider`，它们分别是`Query<T>`类和`QueryProvider`类，现在我们来构建一个真正有用的提供程序。我之前说过，一个查询提供程序所做的事就是执行一些“代码”，这些“代码”使用表达式树而不是真正的IL语言来定义。当然，这并不一定是传统意义上的执行。比如说，LINQ to SQL就是将查询表达式翻译为SQL然后送到服务器中去执行的。

我下面给出的示例与LINQ to SQL有点类似，都是针对一个DAO provider对查询进行翻译和执行。但是，我要做个免责声明，在任何意义上，我给出的示例都不是一个完整的提供程序。我只会翻译`Where`操作，并且只支持在谓词中使用一个字段引用和一些简单的运算符，除此之外没有任何复杂的东西。以后我可能会扩展这个提供程序，但现在仅用于说明的目的。所以不要以为复制粘贴就能得到高质量的代码。

这个提供程序主要做两件事：

1. 将查询翻译为SQL命令
2. 将执行命令得到的结果转换为对象

<!-- more -->

## The Query Translator

`QueryTranslator`简单地访问查询表达式树中的每个节点，然后用`StringBuilder`将支持的操作转换成文本。为了代码的清晰，我们假设有一个叫`ExpressionVisitor`的类，它定义了访问表达式节点的基本模式（我会在文章的结尾附上这个类的代码的，现在暂且将就一下）。

````cs
	internal class QueryTranslator : ExpressionVisitor {
	    StringBuilder sb;
	 
	    internal QueryTranslator() {
	    }
	 
	    internal string Translate(Expression expression) {
	        this.sb = new StringBuilder();
	        this.Visit(expression);
	        return this.sb.ToString();
	    }
	 
	    private static Expression StripQuotes(Expression e) {
	        while (e.NodeType == ExpressionType.Quote) {
	            e = ((UnaryExpression)e).Operand;
	        }
	        return e;
	    }
	 
	    protected override Expression VisitMethodCall(MethodCallExpression m) {
	        if (m.Method.DeclaringType == typeof(Queryable) && m.Method.Name == "Where") {
	            sb.Append("SELECT * FROM (");
	            this.Visit(m.Arguments[0]);
	            sb.Append(") AS T WHERE ");
	            LambdaExpression lambda = (LambdaExpression)StripQuotes(m.Arguments[1]);
	            this.Visit(lambda.Body);
	            return m;
	        }
	        throw new NotSupportedException(string.Format("The method '{0}' is not supported", m.Method.Name));
	    }
	 
	    protected override Expression VisitUnary(UnaryExpression u) {
	        switch (u.NodeType) {
	            case ExpressionType.Not:
	                sb.Append(" NOT ");
	                this.Visit(u.Operand);
	                break;
	            default:
	                throw new NotSupportedException(string.Format("The unary operator '{0}' is not supported", u.NodeType));
	        }
	        return u;
	    }
	 
	    protected override Expression VisitBinary(BinaryExpression b) {
	        sb.Append("(");
	        this.Visit(b.Left);
	        switch (b.NodeType) {
	            case ExpressionType.And:
	                sb.Append(" AND ");
	                break;
	            case ExpressionType.Or:
	                sb.Append(" OR");
	                break;
	            case ExpressionType.Equal:
	                sb.Append(" = ");
	                break;
	            case ExpressionType.NotEqual:
	                sb.Append(" <> ");
	                break;
	            case ExpressionType.LessThan:
	                sb.Append(" < ");
	                break;
	            case ExpressionType.LessThanOrEqual:
	                sb.Append(" <= ");
	                break;
	            case ExpressionType.GreaterThan:
	                sb.Append(" > ");
	                break;
	            case ExpressionType.GreaterThanOrEqual:
	                sb.Append(" >= ");
	                break;
	            default:
	                throw new NotSupportedException(string.Format("The binary operator '{0}' is not supported", b.NodeType));
	        }
	        this.Visit(b.Right);
	        sb.Append(")");
	        return b;
	    }
	 
	    protected override Expression VisitConstant(ConstantExpression c) {
	        IQueryable q = c.Value as IQueryable;
	        if (q != null) {
	            // assume constant nodes w/ IQueryables are table references
	            sb.Append("SELECT * FROM ");
	            sb.Append(q.ElementType.Name);
	        }
	        else if (c.Value == null) {
	            sb.Append("NULL");
	        }
	        else {
	            switch (Type.GetTypeCode(c.Value.GetType())) {
	                case TypeCode.Boolean:
	                    sb.Append(((bool)c.Value) ? 1 : 0);
	                    break;
	                case TypeCode.String:
	                    sb.Append("'");
	                    sb.Append(c.Value);
	                    sb.Append("'");
	                    break;
	                case TypeCode.Object:
	                    throw new NotSupportedException(string.Format("The constant for '{0}' is not supported", c.Value));
	                default:
	                    sb.Append(c.Value);
	                    break;
	            }
	        }
	        return c;
	    }
	 
	    protected override Expression VisitMemberAccess(MemberExpression m) {
	        if (m.Expression != null && m.Expression.NodeType == ExpressionType.Parameter) {
	            sb.Append(m.Member.Name);
	            return m;
	        }
	        throw new NotSupportedException(string.Format("The member '{0}' is not supported", m.Member.Name));
	    }
	}
````

你看，这里虽然没有多少东西，但是也相当复杂。我所支持的表达式树充其量就是具有两个参数的方法调用节点，这两个参数一个是调用源（argument 0），一个是谓词（argument 1）。看上面的`VisitMethodCall`方法，我显式处理了`Queryable.Where`方法，生成`SELECT * FROM (`，递归访问调用源然后拼接上`) AS T WHERE `，最后再访问谓词，这样就可以在调用源中以嵌套子查询的方式支持其他查询操作。我没有处理其他的查询操作，但是通过这种方式，也能优雅地处理多个连续的`Where`方法调用。表的别名可以随便起（我用了“T”），因为我没有生成任何对别名的引用。一个完备的提供程序当然会提供这个。

这里有个叫`StripQuotes`的帮助方法，它的作用是去除所给参数的所有`ExpressionType.Quotes`节点，以取得原本的lambda表达式。

`VisitUnary`和`VisitBinary`方法比较直截了当，它们简单地插入所支持的一元或二元操作所对应的正确的SQL文本。有趣的是`VisitConstant`方法，在这个示例中，只有处于表达式树的根处的`IQueryable`对象才与实际的数据表有关联。我假设`Query<T>`类的实例的constant节点代表了递归到最后的实际的数据表，于是我将`SELECT * FROM`和表名拼接了上去，这里的表名只是简单地以`ElementType`的返回类型的名称来充当。其他类型的constant节点只是被处理为实际的常量，这些常量将被作为直接量拼接到SQL命令中，并没有任何防止SQL注入攻击的手段，而这是一个真正的提供程序必须做的事。

最后，`VisitMemberAccess`方法假定所有对字段或属性的访问都代表着SQL命令中对数据列的引用，假定字段名或属性名就是数据库中的列名。并没有任何的检查来确保这个一致性。给定一个类`Customers`，它的字段与Northwind示例数据库中的列完全匹配，查询翻译器生成SQL的方式如下。

对于查询：

````cs
	Query<Customers> customers = ...;
	IQueryable<Customers> q = customers.Where(c => c.City == "London");
````

生成如下SQL:

````sql
	SELECT * FROM (SELECT * FROM Customers) AS T WHERE (City = ‘London’)
````

## The Object Reader

对象读取器的作用是将SQL查询返回的结果转换为对象。我写了一个简单的类，它的构造方法以`DbDataReader`为参数，具有类型参数`T`，还实现了`IEnumerable<T>`接口。这里面也没有什么花哨的东西，只是使用反射来为类的字段赋值罢了。字段的名字必须与`DbDataReader`中的列名匹配，并且字段的类型也要与之兼容。

````cs
	internal class ObjectReader<T> : IEnumerable<T>, IEnumerable where T : class, new() {
	    Enumerator enumerator;
	 
	    internal ObjectReader(DbDataReader reader) {
	        this.enumerator = new Enumerator(reader);
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
	 
	    class Enumerator : IEnumerator<T>, IEnumerator, IDisposable {
	        DbDataReader reader;
	        FieldInfo[] fields;
	        int[] fieldLookup;
	        T current;
	 
	        internal Enumerator(DbDataReader reader) {
	            this.reader = reader;
	            this.fields = typeof(T).GetFields();
	        }
	 
	        public T Current {
	            get { return this.current; }
	        }
	 
	        object IEnumerator.Current {
	            get { return this.current; }
	        }
	 
	        public bool MoveNext() {
	            if (this.reader.Read()) {
	                if (this.fieldLookup == null) {
	                    this.InitFieldLookup();
	                }
	                T instance = new T();
	                for (int i = 0, n = this.fields.Length; i < n; i++) {
	                    int index = this.fieldLookup[i];
	                    if (index >= 0) {
	                        FieldInfo fi = this.fields[i];
	                        if (this.reader.IsDBNull(index)) {
	                            fi.SetValue(instance, null);
	                        }
	                        else {
	                            fi.SetValue(instance, this.reader.GetValue(index));
	                        }
	                    }
	                }
	                this.current = instance;
	                return true;
	            }
	            return false;
	        }
	 
	        public void Reset() {
	        }
	 
	        public void Dispose() {
	            this.reader.Dispose();
	        }
	 
	        private void InitFieldLookup() {
	            Dictionary<string, int> map = new Dictionary<string, int>(StringComparer.InvariantCultureIgnoreCase);
	            for (int i = 0, n = this.reader.FieldCount; i < n; i++) {
	                map.Add(this.reader.GetName(i), i);
	            }
	            this.fieldLookup = new int[this.fields.Length];
	            for (int i = 0, n = this.fields.Length; i < n; i++) {
	                int index;
	                if (map.TryGetValue(this.fields[i].Name, out index)) {
	                    this.fieldLookup[i] = index;
	                }
	                else {
	                    this.fieldLookup[i] = -1;
	                }
	            }
	        }
	    }
	}
````

`ObjectReader`类为从`DbDataReader`中读取出来的每一行数据创建一个`T`类型的对象，使用反射API`FieldInfo.SetValue`来给对象中的每一个字段赋值。`ObjectReader`对象被创建的时候会实例化一个内部类`Enumerator`的对象，`GetEnumerator`方法被调用的时候会返回这个枚举器。因为`DbDataReader`不能重置和再次运行，所以这个枚举器也只能被使用一次，第二次调用`GetEnumerator`会抛出一个异常。

`ObjectReader`对字段并没有严格的排序，这是因为`QueryTranslator`使用`SELECT *`来拼接SQL，这是不可避免的，因为程序没有办法知道结果中的列的顺序。注意，一般来说不建议在生产代码中使用`SELECT *`，这里只是出于说明的目的。为了支持返回结果中不同的列顺序，准确的序列会在运行时从`DbDataReader`中读取到第一条数据时生成。`InitFieldLookup`函数会创建一个从列名到列序数的一个映射，然后构建一个从对象的字段到列序数的查找表`fieldLookup`。

## The Provider

有了上面的两个类和上篇文章中定义的类，现在已经可以很容易就把它们结合起来，写出一个真正的`IQueryable`LINQ提供程序。

````cs
	public class DbQueryProvider : QueryProvider {
	    DbConnection connection;
	 
	    public DbQueryProvider(DbConnection connection) {
	        this.connection = connection;
	    }
	 
	    public override string GetQueryText(Expression expression) {
	        return this.Translate(expression);
	    }
	 
	    public override object Execute(Expression expression) {
	        DbCommand cmd = this.connection.CreateCommand();
	        cmd.CommandText = this.Translate(expression);
	        DbDataReader reader = cmd.ExecuteReader();
	        Type elementType = TypeSystem.GetElementType(expression.Type);
	        return Activator.CreateInstance(
	            typeof(ObjectReader<>).MakeGenericType(elementType),
	            BindingFlags.Instance | BindingFlags.NonPublic, null,
	            new object[] { reader },
	            null);
	    }
	 
	    private string Translate(Expression expression) {
	        return new QueryTranslator().Translate(expression);
	    }
	}
````

`GetQueryText`方法使用`QueryTranslator`来产生SQL命令，`Execute`方法使用`QueryTranslator`和`ObjectReader`来创建`DbCommand`对象、执行命令、返回`IEnumerable`类型的结果。

## Trying it Out

现在，我们已经有了一个提供程序，让我们来写个demo试试看。仿照LINQ to SQL的模式，我定义了一个对应于Customers表的类，一个保存了查询对象（根查询）的“Context”，和一个使用了它们的小程序。

````cs
	public class Customers {
	    public string CustomerID;
	    public string ContactName;
	    public string Phone;
	    public string City;
	    public string Country;
	}
	 
	public class Orders {
	    public int OrderID;
	    public string CustomerID;
	    public DateTime OrderDate;
	}
	 
	public class Northwind {
	    public Query<Customers> Customers;
	    public Query<Orders> Orders;
	 
	    public Northwind(DbConnection connection) {
	        QueryProvider provider = new DbQueryProvider(connection);
	        this.Customers = new Query<Customers>(provider);
	        this.Orders = new Query<Orders>(provider);
	    }
	}
	
	class Program {
	    static void Main(string[] args) {
	        string constr = @"…";
	        using (SqlConnection con = new SqlConnection(constr)) {
	            con.Open();
	            Northwind db = new Northwind(con);
	 
	            IQueryable<Customers> query = 
	                 db.Customers.Where(c => c.City == "London");
	 
	            Console.WriteLine("Query:\n{0}\n", query);
	 
	            var list = query.ToList();
	            foreach (var item in list) {
	                Console.WriteLine("Name: {0}", item.ContactName);
	            }
	 
	            Console.ReadLine();
	        }
	    }
	}
````

运行这个程序，会得到下面的输出（注意必须将上面的数据库连接串替换成你自己的）：

````plain
	Query:
	SELECT * FROM (SELECT * FROM Customers) AS T WHERE (City = 'London')
	
	Name: Thomas Hardy
	Name: Victoria Ashworth
	Name: Elizabeth Brown
	Name: Ann Devon
	Name: Simon Crowther
	Name: Hari Kumar
````

Excellent，正是我们想要的，计划实现了，心里有点小激动呢。<i class="emoji emoji-smile"></i>

就是你了皮卡丘，这就是一个LINQ`IQueryable`提供程序，起码算是一个粗糙的原型。当然你还可以在里面做更多的事情，处理各种各样的情况。

别急，还有更精彩的。[查看Part III](http://www.liuwenjun.info/2016/02/01/linq-building-an-iqueryable-provider-part-iii/)。

## APPENDIX – The Expression Visitor

吊了这么久胃口，我感觉向我要`ExpressionVisitor`类的代码的人可能会比问我如何构建查询提供程序的人还要多。`System.Linq.Expressions`里面就有一个`ExpressionVisitor`类，但是它是internal的，所以尽管你很想直接用，但是并不能。如果你强烈要求的话说不定我们会在下个版本里面把它改成public。

我写的这个`ExpressionVisitor`使用了经典访问者模式。这里只有一个访问者类，用来将`Visit`方法的调用分派到与不同节点类型匹配的特定的`VisitXXX`方法。注意每个节点类型都会对应一个方法，比如二元运算节点就会被分派到`VisitBinary`方法。节点本身并不直接参与访问操作，它们仅仅被视为数据。这是因为访问者的数量是不限的，你也可以写一个自己的访问者类，这样可以让访问语义集中在访问者类中，避免其耦合到不同的节点类中去。对节点`XXX`的默认访问行为定义在基类的`VisitXXX`方法中。

每个`VisitXXX`方法都会返回一个节点。表达式树是不可变的，想改变表达式树就必须构建一颗全新的树。默认的`VisitXXX`方法在子树发生了变化的时候会创建一个新的节点，否则返回原来的节点。这样，如果你在树的深处（通过创建一个新节点）改变了一个节点，剩余的整棵树都会自动重新创建。

下面是源码，Enjoy。<i class="emoji emoji-smile"></i>

````cs
	public abstract class ExpressionVisitor {
	    protected ExpressionVisitor() {
	    }
	 
	    protected virtual Expression Visit(Expression exp) {
	        if (exp == null)
	            return exp;
	        switch (exp.NodeType) {
	            case ExpressionType.Negate:
	            case ExpressionType.NegateChecked:
	            case ExpressionType.Not:
	            case ExpressionType.Convert:
	            case ExpressionType.ConvertChecked:
	            case ExpressionType.ArrayLength:
	            case ExpressionType.Quote:
	            case ExpressionType.TypeAs:
	                return this.VisitUnary((UnaryExpression)exp);
	            case ExpressionType.Add:
	            case ExpressionType.AddChecked:
	            case ExpressionType.Subtract:
	            case ExpressionType.SubtractChecked:
	            case ExpressionType.Multiply:
	            case ExpressionType.MultiplyChecked:
	            case ExpressionType.Divide:
	            case ExpressionType.Modulo:
	            case ExpressionType.And:
	            case ExpressionType.AndAlso:
	            case ExpressionType.Or:
	            case ExpressionType.OrElse:
	            case ExpressionType.LessThan:
	            case ExpressionType.LessThanOrEqual:
	            case ExpressionType.GreaterThan:
	            case ExpressionType.GreaterThanOrEqual:
	            case ExpressionType.Equal:
	            case ExpressionType.NotEqual:
	            case ExpressionType.Coalesce:
	            case ExpressionType.ArrayIndex:
	            case ExpressionType.RightShift:
	            case ExpressionType.LeftShift:
	            case ExpressionType.ExclusiveOr:
	                return this.VisitBinary((BinaryExpression)exp);
	            case ExpressionType.TypeIs:
	                return this.VisitTypeIs((TypeBinaryExpression)exp);
	            case ExpressionType.Conditional:
	                return this.VisitConditional((ConditionalExpression)exp);
	            case ExpressionType.Constant:
	                return this.VisitConstant((ConstantExpression)exp);
	            case ExpressionType.Parameter:
	                return this.VisitParameter((ParameterExpression)exp);
	            case ExpressionType.MemberAccess:
	                return this.VisitMemberAccess((MemberExpression)exp);
	            case ExpressionType.Call:
	                return this.VisitMethodCall((MethodCallExpression)exp);
	            case ExpressionType.Lambda:
	                return this.VisitLambda((LambdaExpression)exp);
	            case ExpressionType.New:
	                return this.VisitNew((NewExpression)exp);
	            case ExpressionType.NewArrayInit:
	            case ExpressionType.NewArrayBounds:
	                return this.VisitNewArray((NewArrayExpression)exp);
	            case ExpressionType.Invoke:
	                return this.VisitInvocation((InvocationExpression)exp);
	            case ExpressionType.MemberInit:
	                return this.VisitMemberInit((MemberInitExpression)exp);
	            case ExpressionType.ListInit:
	                return this.VisitListInit((ListInitExpression)exp);
	            default:
	                throw new Exception(string.Format("Unhandled expression type: '{0}'", exp.NodeType));
	        }
	    }
	 
	    protected virtual MemberBinding VisitBinding(MemberBinding binding) {
	        switch (binding.BindingType) {
	            case MemberBindingType.Assignment:
	                return this.VisitMemberAssignment((MemberAssignment)binding);
	            case MemberBindingType.MemberBinding:
	                return this.VisitMemberMemberBinding((MemberMemberBinding)binding);
	            case MemberBindingType.ListBinding:
	                return this.VisitMemberListBinding((MemberListBinding)binding);
	            default:
	                throw new Exception(string.Format("Unhandled binding type '{0}'", binding.BindingType));
	        }
	    }
	 
	    protected virtual ElementInit VisitElementInitializer(ElementInit initializer) {
	        ReadOnlyCollection<Expression> arguments = this.VisitExpressionList(initializer.Arguments);
	        if (arguments != initializer.Arguments) {
	            return Expression.ElementInit(initializer.AddMethod, arguments);
	        }
	        return initializer;
	    }
	 
	    protected virtual Expression VisitUnary(UnaryExpression u) {
	        Expression operand = this.Visit(u.Operand);
	        if (operand != u.Operand) {
	            return Expression.MakeUnary(u.NodeType, operand, u.Type, u.Method);
	        }
	        return u;
	    }
	 
	    protected virtual Expression VisitBinary(BinaryExpression b) {
	        Expression left = this.Visit(b.Left);
	        Expression right = this.Visit(b.Right);
	        Expression conversion = this.Visit(b.Conversion);
	        if (left != b.Left || right != b.Right || conversion != b.Conversion) {
	            if (b.NodeType == ExpressionType.Coalesce && b.Conversion != null)
	                return Expression.Coalesce(left, right, conversion as LambdaExpression);
	            else
	                return Expression.MakeBinary(b.NodeType, left, right, b.IsLiftedToNull, b.Method);
	        }
	        return b;
	    }
	 
	    protected virtual Expression VisitTypeIs(TypeBinaryExpression b) {
	        Expression expr = this.Visit(b.Expression);
	        if (expr != b.Expression) {
	            return Expression.TypeIs(expr, b.TypeOperand);
	        }
	        return b;
	    }
	 
	    protected virtual Expression VisitConstant(ConstantExpression c) {
	        return c;
	    }
	 
	    protected virtual Expression VisitConditional(ConditionalExpression c) {
	        Expression test = this.Visit(c.Test);
	        Expression ifTrue = this.Visit(c.IfTrue);
	        Expression ifFalse = this.Visit(c.IfFalse);
	        if (test != c.Test || ifTrue != c.IfTrue || ifFalse != c.IfFalse) {
	            return Expression.Condition(test, ifTrue, ifFalse);
	        }
	        return c;
	    }
	 
	    protected virtual Expression VisitParameter(ParameterExpression p) {
	        return p;
	    }
	 
	    protected virtual Expression VisitMemberAccess(MemberExpression m) {
	        Expression exp = this.Visit(m.Expression);
	        if (exp != m.Expression) {
	            return Expression.MakeMemberAccess(exp, m.Member);
	        }
	        return m;
	    }
	 
	    protected virtual Expression VisitMethodCall(MethodCallExpression m) {
	        Expression obj = this.Visit(m.Object);
	        IEnumerable<Expression> args = this.VisitExpressionList(m.Arguments);
	        if (obj != m.Object || args != m.Arguments) {
	            return Expression.Call(obj, m.Method, args);
	        }
	        return m;
	    }
	 
	    protected virtual ReadOnlyCollection<Expression> VisitExpressionList(ReadOnlyCollection<Expression> original) {
	        List<Expression> list = null;
	        for (int i = 0, n = original.Count; i < n; i++) {
	            Expression p = this.Visit(original[i]);
	            if (list != null) {
	                list.Add(p);
	            }
	            else if (p != original[i]) {
	                list = new List<Expression>(n);
	                for (int j = 0; j < i; j++) {
	                    list.Add(original[j]);
	                }
	                list.Add(p);
	            }
	        }
	        if (list != null) {
	            return list.AsReadOnly();
	        }
	        return original;
	    }
	 
	    protected virtual MemberAssignment VisitMemberAssignment(MemberAssignment assignment) {
	        Expression e = this.Visit(assignment.Expression);
	        if (e != assignment.Expression) {
	            return Expression.Bind(assignment.Member, e);
	        }
	        return assignment;
	    }
	 
	    protected virtual MemberMemberBinding VisitMemberMemberBinding(MemberMemberBinding binding) {
	        IEnumerable<MemberBinding> bindings = this.VisitBindingList(binding.Bindings);
	        if (bindings != binding.Bindings) {
	            return Expression.MemberBind(binding.Member, bindings);
	        }
	        return binding;
	    }
	 
	    protected virtual MemberListBinding VisitMemberListBinding(MemberListBinding binding) {
	        IEnumerable<ElementInit> initializers = this.VisitElementInitializerList(binding.Initializers);
	        if (initializers != binding.Initializers) {
	            return Expression.ListBind(binding.Member, initializers);
	        }
	        return binding;
	    }
	 
	    protected virtual IEnumerable<MemberBinding> VisitBindingList(ReadOnlyCollection<MemberBinding> original) {
	        List<MemberBinding> list = null;
	        for (int i = 0, n = original.Count; i < n; i++) {
	            MemberBinding b = this.VisitBinding(original[i]);
	            if (list != null) {
	                list.Add(b);
	            }
	            else if (b != original[i]) {
	                list = new List<MemberBinding>(n);
	                for (int j = 0; j < i; j++) {
	                    list.Add(original[j]);
	                }
	                list.Add(b);
	            }
	        }
	        if (list != null)
	            return list;
	        return original;
	    }
	 
	    protected virtual IEnumerable<ElementInit> VisitElementInitializerList(ReadOnlyCollection<ElementInit> original) {
	        List<ElementInit> list = null;
	        for (int i = 0, n = original.Count; i < n; i++) {
	            ElementInit init = this.VisitElementInitializer(original[i]);
	            if (list != null) {
	                list.Add(init);
	            }
	            else if (init != original[i]) {
	                list = new List<ElementInit>(n);
	                for (int j = 0; j < i; j++) {
	                    list.Add(original[j]);
	                }
	                list.Add(init);
	            }
	        }
	        if (list != null)
	            return list;
	        return original;
	    }
	 
	    protected virtual Expression VisitLambda(LambdaExpression lambda) {
	        Expression body = this.Visit(lambda.Body);
	        if (body != lambda.Body) {
	            return Expression.Lambda(lambda.Type, body, lambda.Parameters);
	        }
	        return lambda;
	    }
	 
	    protected virtual NewExpression VisitNew(NewExpression nex) {
	        IEnumerable<Expression> args = this.VisitExpressionList(nex.Arguments);
	        if (args != nex.Arguments) {
	            if (nex.Members != null)
	                return Expression.New(nex.Constructor, args, nex.Members);
	            else
	                return Expression.New(nex.Constructor, args);
	        }
	        return nex;
	    }
	 
	    protected virtual Expression VisitMemberInit(MemberInitExpression init) {
	        NewExpression n = this.VisitNew(init.NewExpression);
	        IEnumerable<MemberBinding> bindings = this.VisitBindingList(init.Bindings);
	        if (n != init.NewExpression || bindings != init.Bindings) {
	            return Expression.MemberInit(n, bindings);
	        }
	        return init;
	    }
	 
	    protected virtual Expression VisitListInit(ListInitExpression init) {
	        NewExpression n = this.VisitNew(init.NewExpression);
	        IEnumerable<ElementInit> initializers = this.VisitElementInitializerList(init.Initializers);
	        if (n != init.NewExpression || initializers != init.Initializers) {
	            return Expression.ListInit(n, initializers);
	        }
	        return init;
	    }
	 
	    protected virtual Expression VisitNewArray(NewArrayExpression na) {
	        IEnumerable<Expression> exprs = this.VisitExpressionList(na.Expressions);
	        if (exprs != na.Expressions) {
	            if (na.NodeType == ExpressionType.NewArrayInit) {
	                return Expression.NewArrayInit(na.Type.GetElementType(), exprs);
	            }
	            else {
	                return Expression.NewArrayBounds(na.Type.GetElementType(), exprs);
	            }
	        }
	        return na;
	    }
	 
	    protected virtual Expression VisitInvocation(InvocationExpression iv) {
	        IEnumerable<Expression> args = this.VisitExpressionList(iv.Arguments);
	        Expression expr = this.Visit(iv.Expression);
	        if (args != iv.Arguments || expr != iv.Expression) {
	            return Expression.Invoke(expr, args);
	        }
	        return iv;
	    }
	}
````