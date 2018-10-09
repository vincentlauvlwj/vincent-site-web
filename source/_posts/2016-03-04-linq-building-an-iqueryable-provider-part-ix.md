---
layout:     post
title:      "「译」LINQ: Building an IQueryable Provider - Part IX"
subtitle:   "Removing redundant subqueries"
author:     "刘文俊"
tags:
    - 翻译
    - LINQ
    - C♯
---

> 英文原文是[Matt Warren](https://social.msdn.microsoft.com/profile/matt%20warren%20-%20msft/ "Matt Warren")发表在MSDN Blogs的系列文章之一，英文渣渣，翻译**不供参考**，请直接[看原文](http://blogs.msdn.com/b/mattwar/archive/2008/01/16/linq-building-an-iqueryable-provider-part-ix.aspx)。

现在写一篇新的文章的时间变得越来越长，似乎已经成了一个趋势了。要怪就怪电视编剧罢工吧，嗯。

## Cleaning up the Mess

我之前说过要把我们的查询翻译器不断累积下来的不必要的嵌套select表达式给清理掉。对于人类的大脑来说，简化一条SQL是一件很简单的事情。但是，对于计算机程序而言，保留这些无用的嵌套查询却更加容易，毕竟它们的语义是一样的。再者，我们希望少写一点代码的心情也无可厚非。

我们很容易就能从一条带有where子句的简单的查询中看出问题所在。

````cs
    from c in db.Customers
    where c.Country == "UK"
    select c;
````

<!-- more -->

这条普通的查询将翻译为下面的SQL：

````sql
	SELECT t1.Country, t1.CustomerID, t1.ContactName, t1.Phone, t1.City
	FROM (
	  SELECT t0.Country, t0.CustomerID, t0.ContactName, t0.Phone, t0.City
	  FROM Customers AS t0
	) AS t1
	WHERE (t1.Country = 'UK')
````

为什么会有一个多余的SELECT？如果你理解了我们的翻译器的工作方式，并且知道这条LINQ查询的本质是什么的话，很容易就能知道答案。

这条LINQ查询的方法调用语法如下：

````cs
    db.Customers.Where(c => c.Country == "UK").Select(c => c);
````

这里面有两个LINQ查询操作符，`Where()`和`Select()`。我们在`QueryBinder`类中的翻译引擎将这两个方法调用翻译为两个独立的`SelectExpression`。

理想情况下，SQL查询应该如下所示：

````sql
	SELECT t0.Country, t0.CustomerID, t0.ContactName, t0.Phone, t0.City
	FROM Customers AS t0
	WHERE (t0.Country = 'UK')
````

然而，这只是很简单的情况，随着操作符的增加，所生成的SQL会越来越槽糕。你觉得翻译器能够聪明到将多个where子句合并到一起吗？我确实没有添加任何代码。如果语言编译器能够帮我们完成这个工作就再好不过了，但是如果额外的where子句是在原查询已经创建完成之后添加到其中的又会如何呢？

````cs
	var query = 
	    from c in db.Customers
	    where c.Country == "UK"
	    select c;
	// ...
	query = from c in query
	        where c.Phone == "555-5555"
	        select c;
````

这样翻译出来的SQL就变成了一个三层的庞然大物，可它又不能吃，要那么大干嘛。

````sql
	SELECT t2.CustomerID, t2.ContactName, t2.Phone, t2.City, t2.Country
	FROM (
	  SELECT t1.CustomerID, t1.ContactName, t1.Phone, t1.City, t1.Country
	  FROM (
	    SELECT t0.CustomerID, t0.ContactName, t0.Phone, t0.City, t0.Country
	    FROM Customers AS t0
	  ) AS t1
	  WHERE (t1.Country = 'UK')
	) AS t2
	WHERE (t2.Phone = '555-5555')
````

不仅如此，我只是添加了一个小小的投影，翻译器都会额外创建一个嵌套查询。

````cs
	var query = 
	    from c in db.Customers
	    where c.Country == "UK"
	    select c.CustomerID;
````

翻译出来的SQL如下：

````sql
	SELECT t2.CustomerID
	FROM (
	  SELECT t1.CustomerID, t1.ContactName, t1.Phone, t1.City, t1.Country
	  FROM (
	    SELECT t0.CustomerID, t0.ContactName, t0.Phone, t0.City, t0.Country
	    FROM Customers AS t0
	  ) AS t1
	  WHERE (t1.Country = 'UK')
	) AS t2
````

为什么内层的查询要把外层从来没有用到过的数据给select出来？但愿数据库的优化做得够好，不要传输那些用不上或者没有必要返回到客户端的数据。但是，如果我们的查询翻译器能够自己消除这些重复的嵌套，将其转换为像一个真正的人类写出来的简单的形式的话，不是更好吗？这样，我们就可以写像下面一样复杂的查询了：

````cs
	var query = from c in db.Customers
	            join o in db.Orders on c.CustomerID equals o.CustomerID
	            let m = c.Phone
	            orderby c.City
	            where c.Country == "UK"
	            where m != "555-5555"
	            select new { c.City, c.ContactName } into x
	            where x.City == "London"
	            select x;
````

我都不敢给你看这条查询会生成什么样的SQL了，因为我担心它会吓得你把电脑都关了。

接下来我就要告诉你我是如何挽起袖子写了些代码来拯救你的。其实也不是特别难。我原以为我们的代码会因为表达式树的不可变的特性而变得越来越复杂，因为order-by重写器似乎会很复杂，需要对表达式树进行的转换也越来越有趣。然而，我很惊喜地发现，我们清理多余的嵌套查询的逻辑实现起来却特别的简洁。