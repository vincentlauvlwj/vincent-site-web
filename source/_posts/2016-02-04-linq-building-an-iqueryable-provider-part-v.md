---
layout:     post
title:      "「译」LINQ: Building an IQueryable Provider - Part V"
subtitle:   "Improved Column binding"
author:     "刘文俊"
tags:
    - 翻译
    - LINQ
    - C♯
---

> 英文原文是[Matt Warren](https://social.msdn.microsoft.com/profile/matt%20warren%20-%20msft/ "Matt Warren")发表在MSDN Blogs的系列文章之一，英文渣渣，翻译**不供参考**，请直接[看原文](http://blogs.msdn.com/b/mattwar/archive/2007/08/03/linq-building-an-iqueryable-provider-part-v.aspx)。

在前面四篇文章里面，我构建了一个LINQ IQueryable提供程序，它可将`Queryable.Where`和`Queryable.Select`两个标准查询操作符翻译成SQL，并通过ADO送到数据库中去执行。虽然已经做得很不错，但是这个提供程序还是有一些漏洞，而且我还没有提到其他的查询操作，比如OrderBy和Join等等。如果认为用户写出的查询都像我的demo一样这么理想化的话，你可能就会掉进大坑里去。

## Fixing the Gaping Holes

我确实可以写出一个简单的带有where和select的运行良好的查询，就算这个查询再复杂也没关系。

````cs
	var query = db.Customers.Where(c => c.City == city)
	                        .Select(c => new {
	                            Name = c.ContactName,
	                            Location = c.City 
	                        });
````

然而，只要将Where和Select的顺序换一下就坑爹了。

````cs
	var query = db.Customers.Select(c => new {
	                            Name = c.ContactName,
	                            Location = c.City 
	                        })
	                        .Where(x => x.Location == city);
````

这个风骚的小查询生成了一条错误的SQL。

````sql
	SELECT * FROM (SELECT ContactName, City FROM (SELECT * FROM Customers) AS T) AS T WHERE (Location = 'London')
````

在执行的时候也会抛出异常，“Invalid column name 'Location'”。似乎我之前直接将成员访问当成数据库列引用的太过简单的做法不太行得通。我天真地假设子树里面唯一的成员访问会与Select子句中的列的名字相匹配，然而实际上并不是。所以，现在要么改一改Select子句中的列名，使之与成员的名字一致，要么想个其它的方法来解决这个问题。

我认为两种方法都是可以的，但是，考虑一个复杂一点的情况，不仅仅是将列重命名，如果选择表达式还生成了嵌套的对象，这样的话对成员的引用很可能就是一个“多点”的嵌套操作。

````cs
	var query = db.Customers.Select(c => new {
	                            Name = c.ContactName,
	                            Location = new {
	                                City = c.City,
	                                Country = c.Country
	                            } 
	                        })
	                        .Where(x => x.Location.City == city);
````

现在我要怎么翻译这个查询呢？已有的代码甚至根本就不能理解这个中间对象`Location`是个什么东西。幸运的是我早就知道应该怎么做了，只不过要对代码做出比较大的改动。我们需要重新审视一下提供程序仅仅只是将查询表达式翻译为文本的思路了。我们应该将查询表达式翻译为SQL，而文本只是SQL的一种表现形式，而且它还不方便我们对其施加编程逻辑。当然我们最终需要的还是文本，但如果我们能先把SQL表示为一个抽象，那么就能进行更复杂的翻译。

当然，最方便我们操作的数据结构是SQL语义树。所以，理论上我应该定义一个完整的独立的SQL语义树，将LINQ查询表达式翻译为一颗SQL语义树而不是文本，但是这样做的工作量太大了。幸运的是这个假想的SQL树的定义与LINQ表达式树的定义有很大的交集，所以我们可以偷下懒，简单地将LINQ表达式树当成SQL树来使用。为了这么做，我要添加一些新的表达式节点类型，其他的LINQ API不识别这些类型也没关系，因为这只是给我们自己使用的。

````cs
	internal enum DbExpressionType {
	    Table = 1000, // make sure these don't overlap with ExpressionType
	    Column,
	    Select,
	    Projection
	}
	 
	internal class TableExpression : Expression {
	    string alias;
	    string name;
	    internal TableExpression(Type type, string alias, string name)
	        : base((ExpressionType)DbExpressionType.Table, type) {
	        this.alias = alias;
	        this.name = name;
	    }
	    internal string Alias {
	        get { return this.alias; }
	    }
	    internal string Name {
	        get { return this.name; }
	    }
	}
	 
	internal class ColumnExpression : Expression {
	    string alias;
	    string name;
	    int ordinal;
	    internal ColumnExpression(Type type, string alias, string name, int ordinal)
	        : base((ExpressionType)DbExpressionType.Column, type) {
	        this.alias = alias;
	        this.name = name;
	        this.ordinal = ordinal;
	    }
	    internal string Alias {
	        get { return this.alias; }
	    }
	    internal string Name {
	        get { return this.name; }
	    }
	    internal int Ordinal {
	        get { return this.ordinal; }
	    }
	}
	 
	internal class ColumnDeclaration {
	    string name;
	    Expression expression;
	    internal ColumnDeclaration(string name, Expression expression) {
	        this.name = name;
	        this.expression = expression;
	    }
	    internal string Name {
	        get { return this.name; }
	    }
	    internal Expression Expression {
	        get { return this.expression; }
	    }
	}
	 
	internal class SelectExpression : Expression {
	    string alias;
	    ReadOnlyCollection<ColumnDeclaration> columns;
	    Expression from;
	    Expression where;
	    internal SelectExpression(Type type, string alias, IEnumerable<ColumnDeclaration> columns, Expression from, Expression where)
	        : base((ExpressionType)DbExpressionType.Select, type) {
	        this.alias = alias;
	        this.columns = columns as ReadOnlyCollection<ColumnDeclaration>;
	        if (this.columns == null) {
	            this.columns = new List<ColumnDeclaration>(columns).AsReadOnly();
	        }
	        this.from = from;
	        this.where = where;
	    }
	    internal string Alias {
	        get { return this.alias; }
	    }
	    internal ReadOnlyCollection<ColumnDeclaration> Columns {
	        get { return this.columns; }
	    }
	    internal Expression From {
	        get { return this.from; }
	    }
	    internal Expression Where {
	        get { return this.where; }
	    }
	}
	 
	internal class ProjectionExpression : Expression {
	    SelectExpression source;
	    Expression projector;
	    internal ProjectionExpression(SelectExpression source, Expression projector)
	        : base((ExpressionType)DbExpressionType.Projection, projector.Type) {
	        this.source = source;
	        this.projector = projector;
	    }
	    internal SelectExpression Source {
	        get { return this.source; }
	    }
	    internal Expression Projector {
	        get { return this.projector; }
	    }
	}
````

我只需要在LINQ表达式树中加上SQL Select查询的概念，Select查询产生一列或多列、一个对列的引用、一个对表的引用、和一个将列引用重新组装为对象的投影器。

我继续定义了一个自己的枚举类型`DbExpressionType`，它“扩展”了基本的枚举类型`ExpressionType`，选了一个足够大的起始值以免与其他的定义冲突。如果枚举类型可以继承的话我会直接继承`ExpressionType`的，但是机智如我，就算不能继承也没有关系。

每个新的表达式节点都遵循LINQ表达式的所有模式，比如不可变等等，只不过它们现在表示的是SQL的概念，而不是CLR的概念。注意`SelectExpression`包含了一个列的集合，一个from和一个where表达式，它们对应于一条合法的SQL所具有的各种子句。

`ProjectionExpression`描述了如何从`SelectExpression`的列中构造出结果。仔细想想就知道，它和Part IV里面为`ProjectionReader`构造委托的投影器表达式几乎是一样的。只不过现在它的作用不仅仅是组装此`DataReader`中读出来的数据，它还表示了SQL查询中的投影操作。

有了新的节点类型之后，当然就要有新的访问器。`DbExpressionVisitor`继承了`ExpressionVisitor`，添加了对新的节点类型的基本的访问模式。

````cs
	internal class DbExpressionVisitor : ExpressionVisitor {
	    protected override Expression Visit(Expression exp) {
	        if (exp == null) {
	            return null;
	        }
	        switch ((DbExpressionType)exp.NodeType) {
	            case DbExpressionType.Table:
	                return this.VisitTable((TableExpression)exp);
	            case DbExpressionType.Column:
	                return this.VisitColumn((ColumnExpression)exp);
	            case DbExpressionType.Select:
	                return this.VisitSelect((SelectExpression)exp);
	            case DbExpressionType.Projection:
	                return this.VisitProjection((ProjectionExpression)exp);
	            default:
	                return base.Visit(exp);
	        }
	    }
	    protected virtual Expression VisitTable(TableExpression table) {
	        return table;
	    }
	    protected virtual Expression VisitColumn(ColumnExpression column) {
	        return column;
	    }
	    protected virtual Expression VisitSelect(SelectExpression select) {
	        Expression from = this.VisitSource(select.From);
	        Expression where = this.Visit(select.Where);
	        ReadOnlyCollection<ColumnDeclaration> columns = this.VisitColumnDeclarations(select.Columns);
	        if (from != select.From || where != select.Where || columns != select.Columns) {
	            return new SelectExpression(select.Type, select.Alias, columns, from, where);
	        }
	        return select;
	    }
	    protected virtual Expression VisitSource(Expression source) {
	        return this.Visit(source);
	    }
	    protected virtual Expression VisitProjection(ProjectionExpression proj) {
	        SelectExpression source = (SelectExpression)this.Visit(proj.Source);
	        Expression projector = this.Visit(proj.Projector);
	        if (source != proj.Source || projector != proj.Projector) {
	            return new ProjectionExpression(source, projector);
	        }
	        return proj;
	    }
	    protected ReadOnlyCollection<ColumnDeclaration> VisitColumnDeclarations(ReadOnlyCollection<ColumnDeclaration> columns) {
	        List<ColumnDeclaration> alternate = null;
	        for (int i = 0, n = columns.Count; i < n; i++) {
	            ColumnDeclaration column = columns[i];
	            Expression e = this.Visit(column.Expression);
	            if (alternate == null && e != column.Expression) {
	                alternate = columns.Take(i).ToList();
	            }
	            if (alternate != null) {
	                alternate.Add(new ColumnDeclaration(column.Name, e));
	            }
	        }
	        if (alternate != null) {
	            return alternate.AsReadOnly();
	        }
	        return columns;
	    }
	}
````

我现在真的觉得自己越来越屌了！

下面就是`QueryTranslator`闪亮登场的时候了。不再是整个将表达式树翻译成字符串的翻译器，而是处理不同任务的独立的模块，一个模块解释方法（比如`Queryable.Select`）的含义、绑定表达式树，另一个将得到的树转换为SQL文本。希望通过构造这个LINQ/SQL混合的的树能够解决这个漏洞。

下面是`QueryBinder`类的代码。

````cs
	internal class QueryBinder : ExpressionVisitor {
	    ColumnProjector columnProjector;
	    Dictionary<ParameterExpression, Expression> map;
	    int aliasCount;
	 
	    internal QueryBinder() {
	        this.columnProjector = new ColumnProjector(this.CanBeColumn);
	    }
	 
	    private bool CanBeColumn(Expression expression) {
	        return expression.NodeType == (ExpressionType)DbExpressionType.Column;
	    }
	 
	    internal Expression Bind(Expression expression) {
	        this.map = new Dictionary<ParameterExpression, Expression>();
	        return this.Visit(expression);
	    }
	 
	    private static Expression StripQuotes(Expression e) {
	        while (e.NodeType == ExpressionType.Quote) {
	            e = ((UnaryExpression)e).Operand;
	        }
	        return e;
	    }
	 
	    private string GetNextAlias() {
	        return "t" + (aliasCount++);
	    }
	 
	    private ProjectedColumns ProjectColumns(Expression expression, string newAlias, string existingAlias) {
	        return this.columnProjector.ProjectColumns(expression, newAlias, existingAlias);
	    }
	 
	    protected override Expression VisitMethodCall(MethodCallExpression m) {
	        if (m.Method.DeclaringType == typeof(Queryable) ||
	            m.Method.DeclaringType == typeof(Enumerable)) {
	            switch (m.Method.Name) {
	                case "Where":
	                    return this.BindWhere(m.Type, m.Arguments[0], (LambdaExpression)StripQuotes(m.Arguments[1]));
	                case "Select":
	                    return this.BindSelect(m.Type, m.Arguments[0], (LambdaExpression)StripQuotes(m.Arguments[1]));
	            }
	            throw new NotSupportedException(string.Format("The method '{0}' is not supported", m.Method.Name));
	        }
	        return base.VisitMethodCall(m);
	    }
	 
	    private Expression BindWhere(Type resultType, Expression source, LambdaExpression predicate) {
	        ProjectionExpression projection = (ProjectionExpression)this.Visit(source);
	        this.map[predicate.Parameters[0]] = projection.Projector;
	        Expression where = this.Visit(predicate.Body);
	        string alias = this.GetNextAlias();
	        ProjectedColumns pc = this.ProjectColumns(projection.Projector, alias, GetExistingAlias(projection.Source));
	        return new ProjectionExpression(
	            new SelectExpression(resultType, alias, pc.Columns, projection.Source, where),
	            pc.Projector
	            );
	    }
	 
	    private Expression BindSelect(Type resultType, Expression source, LambdaExpression selector) {
	        ProjectionExpression projection = (ProjectionExpression)this.Visit(source);
	        this.map[selector.Parameters[0]] = projection.Projector;
	        Expression expression = this.Visit(selector.Body);
	        string alias = this.GetNextAlias();
	        ProjectedColumns pc = this.ProjectColumns(expression, alias, GetExistingAlias(projection.Source));
	        return new ProjectionExpression(
	            new SelectExpression(resultType, alias, pc.Columns, projection.Source, null),
	            pc.Projector
	        );
	    }
	 
	    private static string GetExistingAlias(Expression source) {
	        switch ((DbExpressionType)source.NodeType) {
	            case DbExpressionType.Select:
	                return ((SelectExpression)source).Alias;
	            case DbExpressionType.Table:
	                return ((TableExpression)source).Alias;
	            default:
	                throw new InvalidOperationException(string.Format("Invalid source node type '{0}'", source.NodeType));
	        }
	    }
	 
	    private bool IsTable(object value) {
	        IQueryable q = value as IQueryable;
	        return q != null && q.Expression.NodeType == ExpressionType.Constant;
	    }
	 
	    private string GetTableName(object table) {
	        IQueryable tableQuery = (IQueryable)table;
	        Type rowType = tableQuery.ElementType;
	        return rowType.Name;
	    }
	 
	    private string GetColumnName(MemberInfo member) {
	        return member.Name;
	    }
	 
	    private Type GetColumnType(MemberInfo member) {
	        FieldInfo fi = member as FieldInfo;
	        if (fi != null) {
	            return fi.FieldType;
	        }
	        PropertyInfo pi = (PropertyInfo)member;
	        return pi.PropertyType;
	    }
	 
	    private IEnumerable<MemberInfo> GetMappedMembers(Type rowType) {
	        return rowType.GetFields().Cast<MemberInfo>();
	    }
	 
	    private ProjectionExpression GetTableProjection(object value) {
	        IQueryable table = (IQueryable)value;
	        string tableAlias = this.GetNextAlias();
	        string selectAlias = this.GetNextAlias();
	        List<MemberBinding> bindings = new List<MemberBinding>();
	        List<ColumnDeclaration> columns = new List<ColumnDeclaration>();
	        foreach (MemberInfo mi in this.GetMappedMembers(table.ElementType)) {
	            string columnName = this.GetColumnName(mi);
	            Type columnType = this.GetColumnType(mi);
	            int ordinal = columns.Count;
	            bindings.Add(Expression.Bind(mi, new ColumnExpression(columnType, selectAlias, columnName, ordinal)));
	            columns.Add(new ColumnDeclaration(columnName, new ColumnExpression(columnType, tableAlias, columnName, ordinal)));
	        }
	        Expression projector = Expression.MemberInit(Expression.New(table.ElementType), bindings);
	        Type resultType = typeof(IEnumerable<>).MakeGenericType(table.ElementType);
	        return new ProjectionExpression(
	            new SelectExpression(
	                resultType,
	                selectAlias,
	                columns,
	                new TableExpression(resultType, tableAlias, this.GetTableName(table)),
	                null
	            ),
	            projector
	        );
	    }
	 
	    protected override Expression VisitConstant(ConstantExpression c) {
	        if (this.IsTable(c.Value)) {
	            return GetTableProjection(c.Value);
	        }
	        return c;
	    }
	 
	    protected override Expression VisitParameter(ParameterExpression p) {
	        Expression e;
	        if (this.map.TryGetValue(p, out e)) {
	            return e;
	        }
	        return p;
	    }
	 
	    protected override Expression VisitMemberAccess(MemberExpression m) {
	        Expression source = this.Visit(m.Expression);
	        switch (source.NodeType) {
	            case ExpressionType.MemberInit:
	                MemberInitExpression min = (MemberInitExpression)source;
	                for (int i = 0, n = min.Bindings.Count; i < n; i++) {
	                    MemberAssignment assign = min.Bindings[i] as MemberAssignment;
	                    if (assign != null && MembersMatch(assign.Member, m.Member)) {
	                        return assign.Expression;
	                    }
	                }
	                break;
	            case ExpressionType.New:
	                NewExpression nex = (NewExpression)source;
	                if (nex.Members != null) {
	                    for (int i = 0, n = nex.Members.Count; i < n; i++) {
	                        if (MembersMatch(nex.Members[i], m.Member)) {
	                            return nex.Arguments[i];
	                        }
	                    }
	                }
	                break;
	        }
	        if (source == m.Expression) {
	            return m;
	        }
	        return MakeMemberAccess(source, m.Member);
	    }
	 
	    private bool MembersMatch(MemberInfo a, MemberInfo b) {
	        if (a == b) {
	            return true;
	        }
	        if (a is MethodInfo && b is PropertyInfo) {
	            return a == ((PropertyInfo)b).GetGetMethod();
	        }
	        else if (a is PropertyInfo && b is MethodInfo) {
	            return ((PropertyInfo)a).GetGetMethod() == b;
	        }
	        return false;
	    }
	 
	    private Expression MakeMemberAccess(Expression source, MemberInfo mi) {
	        FieldInfo fi = mi as FieldInfo;
	        if (fi != null) {
	            return Expression.Field(source, fi);
	        }
	        PropertyInfo pi = (PropertyInfo)mi;
	        return Expression.Property(source, pi);
	    }
	}
````

要注意这里的代码可比以前的`QueryTranslator`复杂多了。对`Where`和`Select`方法的翻译被分发到了两个独立的方法里面。它们不再产生文本，取而代之的是`ProjectionExpression`和`SelectExpression`的实例。`ColumnProjector`似乎做了一些更复杂的事情，我还没有放出它的代码，但是它也有很大的变化。这里还有些获得表和列的信息的帮助方法，其具体的实现要依靠一个完整的映射系统，留待以后解决，现在简单地使用类名和成员名。

`GetTableProjection`是一个关键的方法，它用`SelectExpression`和`ProjectExpression`组装了一个取出表中所有数据的默认查询。这里不再使用"`SELECT *`"，默认的表投影是为域对象里面的所有成员一一赋值的`MemberInitExpression`。

另一个值得注意的变化是`VisitMemberAccess`方法。我不再只考虑参数节点的简单成员访问，还尝试解析成员访问的含义，返回这个成员翻译出来的子表达式。

这是具体的工作流程。当通过`GetTableProjection`方法将“表”常量翻译为表投影时，结果里包含了一个投影器表达式，它描述了如何通过表中的列来创建对象。当翻译到`Select`或`Where`方法时，往map中添加了一个从`LambdaExpression`的参数表达式到“上一次”查询的投影器的映射。对于第一个`Select`或`Where`的调用，这个投影器就是表投影中的投影器。这样，待会在`VisitParameter`方法中访问这个参数表达式时，就可直接将其替换为上一个投影器表达式。这样是可行的，因为节点是不可变的，因此可以在树上多次包含某棵子树。最后，在翻译成员访问的时候，参数表达式早已被替换成了语义等价的投影器表达式。这个投影器表达式有可能是new或者member-init节点，所以我只需在它上面找出能替换掉此成员访问节点的子表达式即可。通常，都能找到一个在表投影中定义的`ColumnExpression`。但是如果上次Select操作产生了嵌套对象的话，也有可能找到另一个new或者member-init表达式，这样的话，随后的成员访问操作会从这个表达式中查找子表达式，如此反复。

呼，有好多东西要消化，我自己都还没完全理解。下面是与之前完全不同的`ColumnProjector`类，看代码。

````cs
	internal sealed class ProjectedColumns {
	    Expression projector;
	    ReadOnlyCollection<ColumnDeclaration> columns;
	    internal ProjectedColumns(Expression projector, ReadOnlyCollection<ColumnDeclaration> columns) {
	        this.projector = projector;
	        this.columns = columns;
	    }
	    internal Expression Projector {
	        get { return this.projector; }
	    }
	    internal ReadOnlyCollection<ColumnDeclaration> Columns {
	        get { return this.columns; }
	    }
	}
	 
	internal class ColumnProjector : DbExpressionVisitor {
	    Nominator nominator;
	    Dictionary<ColumnExpression, ColumnExpression> map;
	    List<ColumnDeclaration> columns;
	    HashSet<string> columnNames;
	    HashSet<Expression> candidates;
	    string existingAlias;
	    string newAlias;
	    int iColumn;
	 
	    internal ColumnProjector(Func<Expression, bool> fnCanBeColumn) {
	        this.nominator = new Nominator(fnCanBeColumn);
	    }
	 
	    internal ProjectedColumns ProjectColumns(Expression expression, string newAlias, string existingAlias) {
	        this.map = new Dictionary<ColumnExpression, ColumnExpression>();
	        this.columns = new List<ColumnDeclaration>();
	        this.columnNames = new HashSet<string>();
	        this.newAlias = newAlias;
	        this.existingAlias = existingAlias;
	        this.candidates = this.nominator.Nominate(expression);
	        return new ProjectedColumns(this.Visit(expression), this.columns.AsReadOnly());
	    }
	 
	    protected override Expression Visit(Expression expression) {
	        if (this.candidates.Contains(expression)) {
	            if (expression.NodeType == (ExpressionType)DbExpressionType.Column) {
	                ColumnExpression column = (ColumnExpression)expression;
	                ColumnExpression mapped;
	                if (this.map.TryGetValue(column, out mapped)) {
	                    return mapped;
	                }
	                if (this.existingAlias == column.Alias) {
	                    int ordinal = this.columns.Count;
	                    string columnName = this.GetUniqueColumnName(column.Name);
	                    this.columns.Add(new ColumnDeclaration(columnName, column));
	                    mapped = new ColumnExpression(column.Type, this.newAlias, columnName, ordinal);
	                    this.map[column] = mapped;
	                    this.columnNames.Add(columnName);
	                    return mapped;
	                }
	                // must be referring to outer scope
	                return column;
	            }
	            else {
	                string columnName = this.GetNextColumnName();
	                int ordinal = this.columns.Count;
	                this.columns.Add(new ColumnDeclaration(columnName, expression));
	                return new ColumnExpression(expression.Type, this.newAlias, columnName, ordinal);
	            }
	        }
	        else {
	            return base.Visit(expression);
	        }
	    }
	 
	    private bool IsColumnNameInUse(string name) {
	        return this.columnNames.Contains(name);
	    }
	 
	    private string GetUniqueColumnName(string name) {
	        string baseName = name;
	        int suffix = 1;
	        while (this.IsColumnNameInUse(name)) {
	            name = baseName + (suffix++);
	        }
	        return name;
	    }
	 
	    private string GetNextColumnName() {
	        return this.GetUniqueColumnName("c" + (iColumn++));
	    }
	 
	    class Nominator : DbExpressionVisitor {
	        Func<Expression, bool> fnCanBeColumn;
	        bool isBlocked;
	        HashSet<Expression> candidates;
	 
	        internal Nominator(Func<Expression, bool> fnCanBeColumn) {
	            this.fnCanBeColumn = fnCanBeColumn;
	        }
	 
	        internal HashSet<Expression> Nominate(Expression expression) {
	            this.candidates = new HashSet<Expression>();
	            this.isBlocked = false;
	            this.Visit(expression);
	            return this.candidates;
	        }
	 
	        protected override Expression Visit(Expression expression) {
	            if (expression != null) {
	                bool saveIsBlocked = this.isBlocked;
	                this.isBlocked = false;
	                base.Visit(expression);
	                if (!this.isBlocked) {
	                    if (this.fnCanBeColumn(expression)) {
	                        this.candidates.Add(expression);
	                    }
	                    else {
	                        this.isBlocked = true;
	                    }
	                }
	                this.isBlocked |= saveIsBlocked;
	            }
	            return expression;
	        }
	    }
	}
````

`ColumnProjector`类不再拼接Select命令的文本，也不再将选择器表达式转换为从`DataReader`构建对象的函数。但是其实做的事情和以前也差不多。它产生用来创建`SelectExpression`节点的`ColumnDeclaration`的list对象，将选择器表达式转换为引用了list中的这些列的投影器表达式。

那它是如何工作的呢？就现在来看，我对这个类可能有点过度设计，但是在以后这样子会比较方便。在我介绍它的工作原理之前，让我们先想想它需要干什么。

给定选择器表达式，我需要找出里面与SQL Select子句中的列声明直接相关的子表达式。这个很简单，只需要找出绑定之后树上剩余的列引用(`ColumnExpression`)就好了。当然，这意味着表达式“a + b”会被视为两个列引用，一个是“a”，一个是“b”，“+”操作则会留在新创建的投影器表达式里面。这样确实可行，但是能不能将整个“a + ｂ”表达式视为一列呢？这样的话，计算的操作就会在SQL server中执行，而不是在创建结果对象期间由本地执行。如果在这个Select操作后面有一个Where操作引用到了这个表达式的话，计算操作就无论如何都必须在服务器中执行了。现在先忽略还不能翻译“+”操作的问题吧，你可以看到，找出列引用表达式、生成投影器表达式的问题，与找出可预处理的独立子树的问题是相似的。

`Evaluator`使用了两次遍历，第一次遍历找出所有可本地计算的节点，第二次遍历自顶向下选中第一次遍历时找出的节点，然后计算选中的“最大”子树的值。找出表达式中的列引用(`ColumnExpression`)与找出最大子树实际上是一个相同的问题，唯一的不同只是查找条件的差异。不过这次我不是要计算所找出的子树的值，而是要1)将子树放进新的查询的`SelectExpression`的列声明中，2)将子树替换为对新的查询的列的引用，从而创建一个投影器。

检查代码你会发现这里有个`Evaluator`类中没有的复杂性。如果列声明真的是基于更复杂的子表达式的话，我就应该给它们生成一个列别名。

好了，现在我已经创建了混合表达式树，并且已经很好地生成了投影器表达式，但我还是要生成SQL文本，否则前面的东西都白做了。所以我将`QueryTranslator`中生成文本的代码提了出来，创建了一个新的类`QueryFormatter`，它全权负责将一颗表达式树转换为文本。

````cs
	internal class QueryFormatter : DbExpressionVisitor {
	    StringBuilder sb;
	    int indent = 2;
	    int depth;
	 
	    internal QueryFormatter() {
	    }
	 
	    internal string Format(Expression expression) {
	        this.sb = new StringBuilder();
	        this.Visit(expression);
	        return this.sb.ToString();
	    }
	 
	    protected enum Identation {
	        Same,
	        Inner,
	        Outer
	    }
	 
	    internal int IdentationWidth {
	        get { return this.indent; }
	        set { this.indent = value; }
	    }
	 
	    private void AppendNewLine(Identation style) {
	        sb.AppendLine();
	        if (style == Identation.Inner) {
	            this.depth++;
	        }
	        else if (style == Identation.Outer) {
	            this.depth--;
	            System.Diagnostics.Debug.Assert(this.depth >= 0);
	        }
	        for (int i = 0, n = this.depth * this.indent; i < n; i++) {
	            sb.Append(" ");
	        }
	    }
	 
	    protected override Expression VisitMethodCall(MethodCallExpression m) {
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
	        if (c.Value == null) {
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
	 
	    protected override Expression VisitColumn(ColumnExpression column) {
	        if (!string.IsNullOrEmpty(column.Alias)) {
	            sb.Append(column.Alias);
	            sb.Append(".");
	        }
	        sb.Append(column.Name);
	        return column;
	    }
	 
	    protected override Expression VisitSelect(SelectExpression select) {
	        sb.Append("SELECT ");
	        for (int i = 0, n = select.Columns.Count; i < n; i++) {
	            ColumnDeclaration column = select.Columns[i];
	            if (i > 0) {
	                sb.Append(", ");
	            }
	            ColumnExpression c = this.Visit(column.Expression) as ColumnExpression;
	            if (c == null || c.Name != select.Columns[i].Name) {
	                sb.Append(" AS ");
	                sb.Append(column.Name);
	            }
	        }
	        if (select.From != null) {
	            this.AppendNewLine(Identation.Same);
	            sb.Append("FROM ");
	            this.VisitSource(select.From);
	        }
	        if (select.Where != null) {
	            this.AppendNewLine(Identation.Same);
	            sb.Append("WHERE ");
	            this.Visit(select.Where);
	        }
	        return select;
	    }
	 
	    protected override Expression VisitSource(Expression source) {
	        switch ((DbExpressionType)source.NodeType) {
	            case DbExpressionType.Table:
	                TableExpression table = (TableExpression)source;
	                sb.Append(table.Name);
	                sb.Append(" AS ");
	                sb.Append(table.Alias);
	                break;
	            case DbExpressionType.Select:
	                SelectExpression select = (SelectExpression)source;
	                sb.Append("(");
	                this.AppendNewLine(Identation.Inner);
	                this.Visit(select);
	                this.AppendNewLine(Identation.Outer);
	                sb.Append(")");
	                sb.Append(" AS ");
	                sb.Append(select.Alias);
	                break;
	            default:
	                throw new InvalidOperationException("Select source is not valid type");
	        }
	        return source;
	    }
	}
````

除了添加了输出新的`SelectExpression`节点的逻辑之外，我还添加了格式化的逻辑，以支持换行和缩进。现在是不是比较特别了？

当然，最后还是要以一个构造结果对象的`LambdaExpression`结束。我们之前是通过`ColumnProjector`类来获得这个lambda表达式的，但现在它的工作是生成SQL语义投影器，而不是生成创建结果对象的投影器。所以我们需要进一步的转换，我建了一个新的类`ProjectionBuilder`来做这件事。

````cs
	internal class ProjectionBuilder : DbExpressionVisitor {
	    ParameterExpression row;
	    private static MethodInfo miGetValue;
	 
	    internal ProjectionBuilder() {
	        if (miGetValue == null) {
	            miGetValue = typeof(ProjectionRow).GetMethod("GetValue");
	        }
	    }
	 
	    internal LambdaExpression Build(Expression expression) {
	        this.row = Expression.Parameter(typeof(ProjectionRow), "row");
	        Expression body = this.Visit(expression);
	        return Expression.Lambda(body, this.row);
	    }
	 
	    protected override Expression VisitColumn(ColumnExpression column) {
	        return Expression.Convert(Expression.Call(this.row, miGetValue, Expression.Constant(column.Ordinal)), column.Type);
	    }
	}
````

这个类简单地做了`ColumnProjector`之前的工作，不过得益于`QueryBinder`中的更好的绑定逻辑，它现在直接就知道应该将哪些节点替换为数据读取表达式。

很幸运，我们不用重写`ProjectionReader`，它还是像以前那样工作。我要做的是摆脱`ObjectReader`，因为我们现在始终都会有一个投影器表达式，在`QueryBinder`中每次翻译到“表”常量时都会创建一个。

现在就是将前面讲的东西都用上的最后一步了。下面是重写的`DbQueryProvider`的代码。

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
	        Delegate projector = result.Projector.Compile();
	 
	        DbCommand cmd = this.connection.CreateCommand();
	        cmd.CommandText = result.CommandText;
	        DbDataReader reader = cmd.ExecuteReader();
	 
	        Type elementType = TypeSystem.GetElementType(expression.Type);
	        return Activator.CreateInstance(
	            typeof(ProjectionReader<>).MakeGenericType(elementType),
	            BindingFlags.Instance | BindingFlags.NonPublic, null,
	            new object[] { reader, projector },
	            null
	            );
	    }
	 
	    internal class TranslateResult {
	        internal string CommandText;
	        internal LambdaExpression Projector;
	    }
	 
	    private TranslateResult Translate(Expression expression) {
	        expression = Evaluator.PartialEval(expression);
	        ProjectionExpression proj = (ProjectionExpression)new QueryBinder().Bind(expression);
	        string commandText = new QueryFormatter().Format(proj.Source);
	        LambdaExpression projector = new ProjectionBuilder().Build(proj.Projector);
	        return new TranslateResult { CommandText = commandText, Projector = projector };
	    }
	}
````

它和以前有很大的不同。`Translate`方法包含了很多步骤，它调用新增的各种访问器，以及`Execute`方法也不再创建`ObjectReader`对象，因为现在始终都有一个投影器。

现在，给出下面的查询：

````cs
	var query = db.Customers.Select(c => new {
	                            Name = c.ContactName,
	                            Location = new {
	                                City = c.City,
	                                Country = c.Country
	                            } 
	                        })
	                        .Where(x => x.Location.City == city);
````

执行成功，产生如下输出：

````plain
	Query:
	SELECT t2.ContactName, t2.City, t2.Country
	FROM (
	  SELECT t1.ContactName, t1.City, t1.Country
	  FROM (
	    SELECT t0.ContactName, t0.City, t0.Country, t0.CustomerID, t0.Phone
	    FROM Customers AS t0
	  ) AS t1
	) AS t2
	WHERE (t2.City = 'London')
	 
	{ Name = Thomas Hardy, Location = { City = London, Country = UK } }
	{ Name = Victoria Ashworth, Location = { City = London, Country = UK } }
	{ Name = Elizabeth Brown, Location = { City = London, Country = UK } }
	{ Name = Ann Devon, Location = { City = London, Country = UK } }
	{ Name = Simon Crowther, Location = { City = London, Country = UK } }
	{ Name = Hari Kumar, Location = { City = London, Country = UK } }
````

更好看的查询，更好看的结果，而且现在无论有多少个`Select`或者`Where`方法，无论里面的投影有多复杂它都能运行良好。

在我指出下一个漏洞之前，至少应该让你们好好消化一下。<i class="emoji emoji-smile"></i>

下次见！

[Query5.zip](https://msdnshared.blob.core.windows.net/media/MSDNBlogsFS/prod.evol.blogs.msdn.com/CommunityServer.Components.PostAttachments/00/04/21/35/21/Query5.zip)