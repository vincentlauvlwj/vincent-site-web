---
layout:     post
title:      "为 Ktorm 框架拓展 PostgreSQL 方言进行 Json 访问"
author:     "天空Blond"
top: true
tags:
    - Kotlin
    - ORM
    - Ktorm
---

> 本文转自 https://skyblond.info/archives/751.html

最近从滴滴辞职，为期 5 天的暑假正式开始了，寻思着做一点有意义的事情提升一下自己。遂决定自己写一套专门用于复杂查询的通联日志管理系统，数据库选用了 PostgreSQL，该数据库可以直接对 Json 类型的数据进行高级查询，然而 Ktorm 框架并不支持此功能，因此本文将记述为该框架进行拓展的过程。

<!-- more -->

## 需求

假设数据库中有一表 `qso_infos` 用于存储通联日志，其中 `qsl_info` 字段表示 QSL 相关事宜的记录，该字段为 `jsonb` 类型，样例如下：

```json
{
    "lotw": {
        "uploaded": true,
        "uploadDate": "2020-06-20",
        "comfirmed": true,
        "comfireDate": "2020-07-21"
    },
    "card": {
        "sent": {
            "sent": false,
            "required": true,
            "sentDate": null,
            "requiredDate": "2020-06-21",
            "via": "bureau"
        },
        "received": {
            "received": false,
            "required": true,
            "receivedDate": null,
            "requiredDate": "2020-06-22",
            "via": "direct"
        }
    },
    "comment": "因为COVID-19推迟寄送QSL卡片"
}
```

现在需要查询所有 LoTW 未上传的记录，应当如何利用 Ktorm 在数据库端完成？

如果需要查询所有 comment 为空的记录，应当如何利用 Ktorm 在数据库端完成？

## 分析

如果直接编写 SQL 的话，应当按如下编写：

```sql
SELECT * FROM qso_infos WHERE qsl_info->'lotw'->>'uploaded' = 'false';
SELECT * FROM qso_infos WHERE qsl_info->>'comment' = '';
```

其中第一句还可以这样写：

```sql
SELECT * FROM qso_infos WHERE (qsl_info->>'lotw')::json->>'uploaded' = 'false';
```

第一种写法用到了两个不同的运算符：`->` 是作为 Json 取出，而 `->>` 则是作为字符串取出。需要注意的是对于 Json Object 这两个运算符是根据输入的字符串作为键去取值，而对于 Json Array 则是按照输入的整形作为从 0 开始的索引去取值。为了最大兼容性的考虑，本文将同时实现每个运算符的两个形式。

对于第二种写法，虽然只需要自定义一个运算符即可，但还需要将转换为 Json 作为一个额外的运算符实现。本文也将实现该运算符。

## 实现

### SQL 类型扩展

为了实现对 Json 的访问，首先应当定义 `json` 和 `jsonb` 两个 SQL 数据类型。这里我没有使用 ktorm 的模块，而是基于 Gson 写了一个：

```kotlin
package info.skyblond.jinn.extension

import com.google.gson.Gson
import org.ktorm.schema.BaseTable
import org.ktorm.schema.Column
import org.ktorm.schema.SqlType
import org.ktorm.schema.TypeReference
import java.lang.reflect.Type
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Types

class JsonbSqlType<T : Any>(private val type: Type) : SqlType<T>(Types.JAVA_OBJECT, typeName = "jsonb") {
    private val gson = Gson()

    override fun doSetParameter(ps: PreparedStatement, index: Int, parameter: T) {
        ps.setString(index, gson.toJson(parameter))
    }

    override fun doGetResult(rs: ResultSet, index: Int): T? {
        val json = rs.getString(index)
        return if (json.isNullOrBlank()) {
            null
        } else {
            gson.fromJson(json, type)
        }
    }
}

fun <C : Any> BaseTable<*>.jsonb(
    name: String,
    typeReference: TypeReference<C>
): Column<C> {
    return registerColumn(name, JsonbSqlType(typeReference.referencedType))
}

internal class JsonSqlType<T : Any>(private val type: Type) : SqlType<T>(Types.JAVA_OBJECT, typeName = "json") {
    private val gson = Gson()

    override fun doSetParameter(ps: PreparedStatement, index: Int, parameter: T) {
        ps.setString(index, gson.toJson(parameter))
    }

    override fun doGetResult(rs: ResultSet, index: Int): T? {
        val json = rs.getString(index)
        return if (json.isNullOrBlank()) {
            null
        } else {
            gson.fromJson(json, type)
        }
    }
}

fun <C : Any> BaseTable<*>.json(
    name: String,
    typeReference: TypeReference<C>
): Column<C> {
    return registerColumn(name, JsonSqlType(typeReference.referencedType))
}
```

关于代码就不多说了，具体可以参考 [Ktorm 文档 - 定义表结构 - 扩展更多的类型](https://www.ktorm.org/zh-cn/schema-definition.html#扩展更多的类型)。这里最重要的一点就是要使用限制比较宽松的框架进行 Json 转换，一开始我试图使用 kotlinx 的 serialization 进行，于是进行 Json 转换的时候就需要一个 `KSerializer` 对象才能工作，而该对象的获取渠道是 `SomeClass.serializer()`，其中 `SomeClass` 需要被 `@kotlinx.serialization.Serializable` 注解。之后进行 Json 操作时为了最大的兼容性，通常都是认为操作的结果是 `Any` 而非特定一个类，那么问题就来了：`Any` 类似 Java 的 `Object`，是万物之父，而所有被 `@Serializable` 注解的类，可没有一个统一的父类。因此这样的架构在后续实现运算符的时候就会非常难受。最起码也是要实现了 Java 的 `Serializable` 接口（或其他框架的统一的接口）。

现在有了 Json 数据类型，接下来我们就可以实现运算符了。

### 自定义运算符

关于自定义运算符，这里同样不多赘述，详细指导可以参考 [Ktorm 文档 - 运算符 - 自定义运算符](https://www.ktorm.org/zh-cn/operators.html#自定义运算符)。拓展的代码如下：

```kotlin
package info.skyblond.jinn.extension

import org.ktorm.expression.ArgumentExpression
import org.ktorm.expression.ScalarExpression
import org.ktorm.schema.ColumnDeclaring
import org.ktorm.schema.IntSqlType
import org.ktorm.schema.SqlType
import org.ktorm.schema.VarcharSqlType

data class AsJsonExpression(
    val left: ScalarExpression<*>,
    override val sqlType: SqlType<Any> = JsonSqlType(Any::class.java),
    override val isLeafNode: Boolean = false,
    override val extraProperties: Map<String, Any> = mapOf(),
    val alreadyJson: Boolean = false
) : ScalarExpression<Any>()

/**
 * This function make a AsJsonExpression.
 * When alreadyJson is true, the expression does nothing, just to make compiler happy.
 */
fun ColumnDeclaring<*>.asJson(alreadyJson: Boolean = false): AsJsonExpression {
    return AsJsonExpression(asExpression(), alreadyJson = alreadyJson)
}

// Get as Json

data class JsonAccessExpression<T : Any>(
    val left: AsJsonExpression,
    val right: ArgumentExpression<T>,
    override val sqlType: SqlType<Any> = JsonSqlType(Any::class.java),
    override val isLeafNode: Boolean = false,
    override val extraProperties: Map<String, Any> = mapOf()
) : ScalarExpression<Any>()

operator fun AsJsonExpression.get(param: String): AsJsonExpression {
    return JsonAccessExpression(this, ArgumentExpression(param, VarcharSqlType)).asJson(true)
}

operator fun AsJsonExpression.get(param: Int): AsJsonExpression {
    return JsonAccessExpression(this, ArgumentExpression(param, IntSqlType)).asJson(true)
}

// Get as Text

data class JsonAccessAsTextExpression<T : Any>(
    val left: AsJsonExpression,
    val right: ArgumentExpression<T>,
    override val sqlType: SqlType<String> = VarcharSqlType,
    override val isLeafNode: Boolean = false,
    override val extraProperties: Map<String, Any> = mapOf()
) : ScalarExpression<String>()

fun AsJsonExpression.getAsString(param: String): JsonAccessAsTextExpression<String> {
    return JsonAccessAsTextExpression(this, ArgumentExpression(param, VarcharSqlType))
}

fun AsJsonExpression.getAsString(param: Int): JsonAccessAsTextExpression<Int> {
    return JsonAccessAsTextExpression(this, ArgumentExpression(param, IntSqlType))
}
```

在这里我们实现了 `AsJsonExpression`，该表达式将前面的语句转换成 Json 类型；`JsonAccessExpression`，该表达式将对 Json 类型的数据进行 `->` 运算；`JsonAccessAsTextExpression`，该表达式将对 Json 类型的数据进行 `->>` 运算。

在 Ktorm 中对于数据的面向对象式筛选，实际上是基于面向对象的写法产生一个表达式树。该树中的每一个 `Expression` 表示一个运算或参数，最终将被解析为一条 SQL 语句。

值得注意的是在 `AsJsonExpression` 的实现中只有 `left`，原本是打算将其作为 `AsDataTypeExpression`，然后 `right` 作为一个 `SqlType` 来实现更通用的功能的，但是这样一来后面的实现将无法保证只对 Json 类型的语句进行访问：`JsonSqlType` 要能够适配所有情况，其类型必定是 `SqlType`，这样一来将无法区分哪些表达式是 Json，哪些不是。当然你也可以额外在加一个类型：`AsDataTypeExpression`，T 作为 `SqlType`，而 U 直接存储 `JsonSqlType`，但是就本文而言，还是单独搞一个 `AsJsonExpression` 来的最实在。

关于 `asJson()` 函数，设置 `alreadyJson` 的目的就是后面对于 `->` 运算符，其运算结果本身就是 Json，而对于编译器来说则是 `JsonAccessExpression` 类型，不能应用 `AsJsonExpression` 的访问操作。因此这里只是单纯的为了让编译器开心，当进行 `->` 访问时，除了产生一个访问表达式之外，还在外面报一个 `AsJsonExpression`，这样对于编译器来说就是合法的 Json 类型了，而在生成 SQL 语句时通过判断 `alreadyJson` 字段可以跳过本次类型转换。

最后为了写起来更舒爽，对于作为 Json Object 取出的 `->` 运算，我重载了 kotlin 内置的 get 方法，这样就可以通过 `asJson()[keyName]` 的形式进行访问了。

而只进行到此还是不够全面，目前 ktorm 还不能正确翻译这些表达式。下一步将进行方言扩展。

### 扩展方言

既然说扩展方言，就是说我们并不像替代原有的 PostgreSQL 方言，而 Ktorm 的作者也贴心的将方言实现类加了 open 关键字，这样我们就可以自由的进行扩展了。根据 [Ktorm 文档 - 运算符 - 自定义运算符](https://www.ktorm.org/zh-cn/operators.html#自定义运算符)，扩展的方言应当覆盖对未知表达式的处理：

```kotlin
package info.skyblond.jinn.extension

import org.ktorm.database.Database
import org.ktorm.expression.SqlExpression
import org.ktorm.expression.SqlFormatter
import org.ktorm.support.postgresql.PostgreSqlDialect
import org.ktorm.support.postgresql.PostgreSqlFormatter

open class MyPostgreSqlDialect : PostgreSqlDialect() {

    override fun createSqlFormatter(database: Database, beautifySql: Boolean, indentSize: Int): SqlFormatter {
        return MyPostgreSqlFormatter(database, beautifySql, indentSize)
    }
}

class MyPostgreSqlFormatter(database: Database, beautifySql: Boolean, indentSize: Int)
    : PostgreSqlFormatter(database, beautifySql, indentSize) {

    override fun visitUnknown(expr: SqlExpression): SqlExpression {
        return when (expr) {
            is AsJsonExpression -> {
                if (expr.left.removeBrackets) {
                    visit(expr.left)
                } else {
                    write("(")
                    visit(expr.left)
                    removeLastBlank()
                    write(") ")
                }

                // if already json, then do nothing, just make compiler happy
                if (!expr.alreadyJson) {
                    removeLastBlank()
                    write("::json ")
                }
                expr
            }
            is JsonAccessAsTextExpression<*> -> {
                // Json only, no need to add brackets
                visit(expr.left)

                write("->> ")

                visit(expr.right)

                expr
            }
            is JsonAccessExpression<*> -> {
                // Json only, no need to add brackets
                visit(expr.left)

                write("-> ")

                visit(expr.right)

                expr
            }
            else -> {
                super.visitUnknown(expr)
            }
        }
    }
}
```

在遇到没有见过的表达式时，将回调父类的处理函数，而这个函数的默认行为就是抛异常。这里在产生 SQL 语句的时候有一些细节要注意。

对于转换为 Json 的语句，需要时应当增加括号来保证运算优先级的正确性。而对于 Json 的访问，其左值一定是 Json，而右值则一定是数字或字符串类型的参数，因此左右皆无需增加括号。

最后我们需要在连接数据库的时候指定该方言。

### 结果

首先连接数据库：

```kotlin
val pgDataSource = PGDataSource()
pgDataSource.serverName = "localhost"
pgDataSource.portNumber = 5432
pgDataSource.user = "logbook"
pgDataSource.password = "***"
pgDataSource.databaseName = "logbook"

val config = HikariConfig()
config.driverClassName = "com.impossibl.postgres.jdbc.PGDataSource"
config.dataSource = pgDataSource
config.addDataSourceProperty("cachePrepStmts", "true")
config.addDataSourceProperty("prepStmtCacheSize", "250")
config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048")

val hikariDataSource = HikariDataSource(config)

val database = Database.connect(hikariDataSource, dialect = MyPostgreSqlDialect())
```

注意最后在连接数据库的时候指定了我们自己实现的方言。之后在定义完表和实体类之后进行查询：

```kotlin
database.sequenceOf(QsoInfos).filter {
    it.qslInfo.asJson(true)["lotw"].getAsString("uploaded") eq "true"
}.forEach {
    println(it)
}

database.sequenceOf(QsoInfos).filter {
    it.qslInfo.asJson(true)["card"]["sent"].getAsString("sent") eq "false"
}.forEach {
    println(it)
}

database.sequenceOf(QsoInfos).filter {
    it.qslInfo.asJson(true).getAsString("comment") notEq ""
}.forEach {
    println(it)
}

database.sequenceOf(QsoInfos).filter {
    it.qslInfo.asJson(true).getAsString("card").asJson().getAsString("sent").asJson().getAsString("sent") notEq "true"
}.forEach {
    println(it)
}
```

对应的分别产生了如下 SQL：

```plain
DEBUG org.ktorm.database - SQL: select ... from qso_infos where ((qso_infos.qsl_info -> ?) ->> ?) = ? 
DEBUG org.ktorm.database - Parameters: [lotw(varchar), uploaded(varchar), true(varchar)]

DEBUG org.ktorm.database - SQL: select ... from qso_infos where (((qso_infos.qsl_info -> ?) -> ?) ->> ?) = ? 
DEBUG org.ktorm.database - Parameters: [card(varchar), sent(varchar), sent(varchar), false(varchar)]

DEBUG org.ktorm.database - SQL: select ... from qso_infos where (qso_infos.qsl_info ->> ?) <> ? 
DEBUG org.ktorm.database - Parameters: [comment(varchar), (varchar)]

DEBUG org.ktorm.database - SQL: select ... from qso_infos where (((qso_infos.qsl_info ->> ?)::json ->> ?)::json ->> ?) <> ? 
DEBUG org.ktorm.database - Parameters: [card(varchar), sent(varchar), sent(varchar), true(varchar)]
```

看起来符合预期，程序也没有报错。至此可以算是完美决绝问题。

\- 全文完 -