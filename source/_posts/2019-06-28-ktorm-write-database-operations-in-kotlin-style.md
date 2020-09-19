---
layout:     post
title:      "Ktorm - 让你的数据库操作更具 Kotlin 风味"
subtitle:   ""
author:     "刘文俊"
top: true
tags:
    - Kotlin
    - ORM
    - Ktorm
---

在上篇文章中，我们介绍了 Ktorm 的基本使用方法。Ktorm 是一个专注于 Kotlin 的 ORM 框架，它提供的 SQL DSL 和序列 API 可以让我们方便地进行数据库操作。在这篇文章中，我们将学习到更多细节，了解 Ktorm 如何让我们的数据库操作更具 Kotlin 风味。

> 前文地址：[你还在用 MyBatis 吗，Ktorm 了解一下？](https://www.liuwj.me/posts/ktorm-introduction/)
> Ktorm 官网：[https://ktorm.liuwj.me/](https://ktorm.liuwj.me/zh-cn/)

在开始之前，我们先回顾一下上篇文章中的员工-部门表的例子，这次我们的示例也是基于这两个表。下面是使用 Ktorm 定义的这两个表的结构：

```kotlin
object Departments : Table<Nothing>("t_department") {
    val id = int("id").primaryKey()    // Column<Int>
    val name = varchar("name")         // Column<String>
    val location = varchar("location") // Column<String>
}

object Employees : Table<Nothing>("t_employee") {
    val id = int("id").primaryKey()
    val name = varchar("name")
    val job = varchar("job")
    val managerId = int("manager_id")
    val hireDate = date("hire_date")
    val salary = long("salary")
    val departmentId = int("department_id")
}
```

<!-- more -->

在上面的表定义中，我们可以看到，Ktorm 一般使用 Kotlin 中的 object 关键字定义一个继承 `Table` 类的对象来描述表结构。这里的 `Departments` 和 `Employees` 都继承了 `Table`，并且在构造函数中指定了表名。表中的列使用 val 关键字定义为表对象中的成员属性，列的类型通过 `int`、`long`、`varchar`、`date` 等函数定义，它们分别对应了 SQL 中的相应类型。

在 Ktorm 中，`int`、`long`、`varchar`、`date` 这类函数称为列定义函数，它们的功能是在当前表中增加一条指定名称和类型的列。Ktorm 内置了许多列定义函数，它们基本涵盖了关系数据库所支持的大部分数据类型。但是，在某些情况下，我们需要在数据库中保存一些原生 JDBC 所不支持的特殊类型的数据（比如 json），这就要求框架能给我们提供扩展数据类型的方式。

## 使用扩展函数支持更多数据类型

`SqlType` 是 Ktorm 中的一个抽象类，它为 SQL 中的数据类型提供了统一的抽象，要扩展自己的数据类型，我们首先需要提供一个自己的 `SqlType` 实现类。下面的 `JsonSqlType` 使用 Jackson 框架进行 json 与对象之间的转换，提供了 json 数据类型的支持：

```kotlin
class JsonSqlType<T : Any>(
    val objectMapper: ObjectMapper,
    val javaType: JavaType
) : SqlType<T>(Types.VARCHAR, "json") {

    override fun doSetParameter(ps: PreparedStatement, index: Int, parameter: T) {
        ps.setString(index, objectMapper.writeValueAsString(parameter))
    }

    override fun doGetResult(rs: ResultSet, index: Int): T? {
        val json = rs.getString(index)
        if (json.isNullOrBlank()) {
            return null
        } else {
            return objectMapper.readValue(json, javaType)
        }
    }
}
```

有了 `JsonSqlType` 之后，接下来的问题就是如何在表对象中添加一条 json 类型的列。我们已经知道，`int`、`varchar` 等内置列定义函数的功能正是在**当前表对象**中注册一条相应类型的列，那么我们能不能自己写一个列定义函数呢？

如果我们用的是 Java，这时恐怕只能遗憾地放弃了，但是 Kotlin 不一样，它支持扩展函数！Kotlin 的扩展函数可以让我们方便地扩展一个已经存在的类，为它添加额外的函数。

```kotlin
inline fun <reified C : Any> BaseTable<*>.json(
    name: String,
    mapper: ObjectMapper = sharedObjectMapper
): Column<C> {
    return registerColumn(name, JsonSqlType(mapper, mapper.constructType(typeOf<C>())))
}
```

使用上面这个扩展函数，我们可以很方便地在当前表对象中添加一条 json 类型的列，它的用法和 Ktorm 内置的列定义函数没有任何区别。

```kotlin
object Employees : Table<Nothing>("t_employee") {
    val hobbies = json<List<String>>("hobbies")
}
```

扩展函数是 Kotlin 的一项重要特性，可以让我们在不修改一个类的情况下，为它添加额外的属性和函数，这极大地提高了我们编程的灵活性。Ktorm 对扩展函数有许多的应用，它的绝大部分 API 都是通过扩展函数的方式来提供的。实际上，前面提到的 `int`、`varchar` 等内置列定义函数也都是通过扩展函数实现的。

## 使用 DSL 编写 SQL

DSL（Domain Specific Language，领域特定语言）是专为解决某一特定问题而设计的语言。与通用编程语言相比，DSL 更趋向于声明式，能够更加简洁地表达特定领域的操作。Kotlin 为我们提供了构建内部 DSL 的强大能力，所谓内部 DSL，即**使用 Kotlin 语言开发的，解决特定领域问题，具备独特代码结构的 API**。

在代码中拼接 SQL 字符串一直是各位程序员心中的痛，Ktorm 提供了强类型的 DSL，让我们可以使用更安全和简便的方式编写 SQL。下面是一个使用 DSL 的例子，它查询每个部门的员工数量，并把部门按人数从高到低排序：

```kotlin
database
    .from(Departments)
    .innerJoin(Employees, on = Departments.id eq Employees.departmentId)
    .select(Departments.name, count(Employees.id))
    .groupBy(Departments.name)
    .orderBy(count(Employees.id).desc())
    .forEach { row ->
        println("Dept Name: ${row.getString(1)}, Emp Count: ${row.getInt(2)}")
    }
```

当你运行这段代码，Ktorm 会自动执行一条 SQL，生成的 SQL 如下：

```sql
select t_department.name as t_department_name, count(t_employee.id) 
from t_department 
inner join t_employee on t_department.id = t_employee.department_id 
group by t_department.name 
order by count(t_employee.id) desc 
```

这就是 Kotlin 的魔法，使用 Ktorm 写查询十分地简单和自然，所生成的 SQL 几乎和 Kotlin 代码一一对应。并且，Ktorm 是强类型的，编译器会在你的代码运行之前对它进行检查，IDE 也能对你的代码进行智能提示和自动补全。

除了查询以外，Ktorm 的 DSL 还支持插入和修改数据，比如向表中插入一名新员工：

```kotlin
database.insert(Employees) {
    set(it.name, "marry")
    set(it.job, "trainee")
    set(it.managerId, 1)
    set(it.hireDate, LocalDate.now())
    set(it.salary, 50)
    set(it.departmentId, 1)
}
```

生成 SQL：

```sql
insert into t_employee (name, job, manager_id, hire_date, salary, department_id) 
values (?, ?, ?, ?, ?, ?) 
```

给名为 vince 的员工加一个小目标的薪水<i class="emoji emoji-yum"></i>：

```kotlin
database.update(Employees) {
    set(it.salary, it.salary + 100000000)
    where {
        it.name eq "vince"
    }
}
```

生成 SQL：

```sql
update t_employee set salary = salary + ? where name = ? 
```

## 运算符重载

在前面给 vince 加薪的过程中，细心的同学可能会发现我们很自然地使用了一个加号：`it.salary + 100000000`。然而，`Employees.salary` 的类型是 `Column<Long>`，我们怎么能把它和一个数字相加呢。这是因为 Kotlin 允许我们对运算符进行重载，使用 operator 关键字修饰的名为 `plus` 的函数定义了一个加号运算符。当我们对一个 `Column` 使用加号时，Kotlin 实际上调用了 Ktorm 中的这个 `plus` 函数：

```kotlin
operator fun <T : Number> Column<T>.plus(argument: T): BinaryExpression<T> {
    return BinaryExpression(
        type = BinaryExpressionType.PLUS, 
        left = this.asExpression(), 
        right = this.wrapArgument(argument), 
        sqlType = this.sqlType
    )
}
```

上面的函数重载了加号运算符，但它并没有真正执行加法运算，它只是返回了一个 SQL 表达式，这个表达式最终会被 `SqlFormatter` 翻译为 SQL 中的加号。通过这种方式，Ktorm 得以将 Kotlin 中的四则运算符翻译为 SQL 中的相应符号。

除了加号以外，Ktorm 还重载了许多常用的运算符，它们包括加号、减号、一元加号、一元减号、乘号、除号、取余、取反等。下面的例子使用取余符号 % 查询数据库中 ID 为奇数的员工：

```kotlin
val query = database.from(Employees).select().where { Employees.id % 2 eq 1 }
```

生成 SQL：

```sql
select * from t_employee where (t_employee.id % ?) = ? 
```

## 通过 infix 定义自己的运算符

通过运算符重载，Ktorm 能够将 Kotlin 中四则运算符翻译为 SQL 中的相应符号。但是 Kotlin 的运算符重载还有许多的限制，比如：

- 判等运算符（`equals` 方法）的返回值类型必须是 `Boolean`。然而，为了将 Kotlin 中的运算符翻译到 SQL，Ktorm 要求运算符函数必须返回一个 `SqlExpression`，以记录我们的表达式的语法结构（比如上文中的 `plus` 函数）。
- 支持的运算符有限，无法支持 SQL 中的特殊运算符，比如 `like`。

天无绝人之路，Kotlin 提供了 infix 修饰符，使用 infix 修饰的函数，在调用时可以省略点和括号，这为我们开启了另一个思路。比如，使用 infix 关键字修饰 `eq` 函数，用来支持判等操作，这个 `eq` 函数我们再前面已经用过许多次：

```kotlin
infix fun <T : Any> Column<T>.eq(expr: Column<T>): BinaryExpression<Boolean> {
    return BinaryExpression(
        type = BinaryExpressionType.EQUAL, 
        left = this.asExpression(), 
        right = expr.asExpression(), 
        sqlType = BooleanSqlType
    )
}
```

除了 `eq` 函数外，Ktorm 还提供了许多常用的运算符函数，它们包括 `and`、`or`、`greater`、`less`、`greaterEq`、`lessEq` 等。不仅如此，我们还能通过 infix 关键字定义自己特殊的运算符，比如 PostgreSQL 中的 `ilike` 运算符就可以定义为这样的一个 infix 函数：

```kotlin
infix fun Column<*>.ilike(argument: String): ILikeExpression {
    return ILikeExpression(asExpression(), ArgumentExpression(argument, VarcharSqlType)
}
```

有了这个 `ilike` 函数，接下来就只需要在 `SqlFormatter` 中把这个 `ILikeExpression` 翻译为合适的 SQL 就可以了，Ktorm 给我们提供了足够的灵活性，具体可以参考[自定义运算符](https://ktorm.liuwj.me/zh-cn/operators.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E8%BF%90%E7%AE%97%E7%AC%A6)相关的文档。

## Sequence API 像集合一样操作数据库

除了 SQL DSL 以外，Ktorm 还提供了一套名为“实体序列”的 API，用来从数据库中获取实体对象。正如其名字所示，它的风格和使用方式与 Kotlin 标准库中的序列 API 及其类似，它提供了许多同名的扩展函数，比如 `filter`、`map`、`reduce` 等。

要使用实体序列 API，我们首先要定义实体类，并把表对象与实体类进行绑定：

```kotlin
interface Employee : Entity<Employee> {
    val id: Int?
    var name: String
    var job: String
    var manager: Employee?
    var hireDate: LocalDate
    var salary: Long
    var department: Department
}

object Employees : Table<Employee>("t_employee") {
    val id = int("id").primaryKey().bindTo { it.id }
    val name = varchar("name").bindTo { it.name }
    val job = varchar("job").bindTo { it.job }
    val managerId = int("manager_id").bindTo { it.manager.id }
    val hireDate = date("hire_date").bindTo { it.hireDate }
    val salary = long("salary").bindTo { it.salary }
    val departmentId = int("department_id").references(Departments) { it.department }
}

val Database.employees get() = this.sequenceOf(Employees)
```

完成 ORM 绑定后，我们就可以使用实体序列的各种方便的扩展函数。比如获取部门 1 中工资超过一千的所有员工对象：

```kotlin
val employees = database.employees
    .filter { it.departmentId eq 1 }
    .filter { it.salary greater 1000 }
    .toList()
```

可以看到，实体序列的用法几乎与 `kotlin.sequences.Sequence` 完全一样，不同的仅仅是在 lambda 表达式中的等号 `==` 和大于号 `>` 被这里的 `eq` 和 `greater` 函数代替了而已。

我们还能使用 `mapColumns` 函数筛选需要的列，而不必把所有的列都查询出来，以及使用 `sortedBy` 函数把记录按指定的列进行排序。下面的代码获取部门 1 中工资超过一千的所有员工的名字，并按其工资的高低从大到小排序：

```kotlin
val names = database.employees
    .filter { it.departmentId eq 1 }
    .filter { it.salary greater 1000L }
    .sortedBy { it.salary }
    .mapColumns { it.name }
```

生成的 SQL 正如我们所料：

```sql
select t_employee.name 
from t_employee 
left join t_department _ref0 on t_employee.department_id = _ref0.id 
where (t_employee.department_id = ?) and (t_employee.salary > ?) 
order by t_employee.salary 
```

不仅如此，我们还能使用聚合功能，获取每个部门的平均工资：

```kotlin
val averageSalaries = database.employees
    .groupingBy { it.departmentId }
    .eachAverageBy { it.salary }
```

生成 SQL：

```sql
select t_employee.department_id, avg(t_employee.salary) 
from t_employee 
group by t_employee.department_id 
```

使用 Ktorm 的实体序列 API，可以让我们的数据库操作看起来就像在使用 Kotlin 中的集合一样。值得注意的是，实体序列 API 并没有真正实现 Kotlin 中的 `Sequence` 接口，Ktorm 只不过是设计了一套与其命名相似函数，以降低用户学习的成本，同时提供与 Kotlin 集合操作体验一致的编码风格。

## 小结

在本文中，我们结合 Kotlin 的一些语法特性，探索了 Ktorm 框架中的许多设计细节。我们学习了如何使用扩展函数为 Ktorm 增加更多数据类型的支持、如何使用强类型的 DSL 编写 SQL、如何使用运算符重载和 infix 关键字为 Ktorm 扩展更多的运算符、以及如何使用实体序列 API 像集合一样操作数据库等。通过对这些细节的探讨，我们看到了 Ktorm 是如何充分利用 Kotlin 的优秀语法特性，帮助我们写出更优雅的、更具 Kotlin 风味的数据库操作代码。

Enjoy Ktorm, enjoy Kotlin!