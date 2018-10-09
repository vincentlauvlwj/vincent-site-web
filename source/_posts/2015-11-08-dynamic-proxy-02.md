---
layout:     post
title:      "Java 动态代理机制分析及扩展，第 2 部分"
author:     "王忠平 何平"
date:       2015-11-08 3:00
top: true
tags:
    - Java
    - 动态代理
---

> [点击查看原文](http://www.ibm.com/developerworks/cn/java/j-lo-proxy2/index.html)
> 相信通过阅读“[Java 动态代理机制分析和扩展，第 1 部分](http://www.liuwenjun.info/2015/11/08/dynamic-proxy-01/)”，读者已经对 Java 动态代理机制有了一定的了解。本文将在上一篇的基础上，针对 Java 动态代理仅支持接口代理这一局限进行扩展，实现对类的代理。

本文希望将 Java 动态代理机制从接口扩展到类，使得类能够享有与接口类似的动态代理支持。

## 设计及特点

新扩展的类名为 ProxyEx，将直接继承于 java.lang.reflect.Proxy，也声明了与原 Proxy 类中同名的 public 静态方法，目的是保持与原代理机制在使用方法上的完全一致。
**图 1. ProxyEx 类继承图**
![](https://www.liuwj.me/files/in-post/dynamic-proxy-03.png)
与原代理机制最大的区别在于，动态生成的代理类将不再从 Proxy 类继承，改而继承需被代理的类。由于 Java 的单继承原则，扩展代理机制所支持的类数目不得多于一个，但它可以声明实现若干接口。包管理的机制与原来相似，不支持一个以上的类和接口同时为非 public；如果仅有一个非 public 的类或接口，假设其包为 PackageA，则动态生成的代理类将位于包 PackageA；否则将位于被代理的类所在的包。生成的代理类也被赋予 final 和 public 访问属性，且其命名规则类似地为“父类名 +ProxyN”（N 也是递增的阿拉伯数字）。最后，在异常处理方面则与原来保持完全一致。
**图 2. 动态生成的代理类的继承图**
![](https://www.liuwj.me/files/in-post/dynamic-proxy-04.png)

## 模板

通过对 Java 动态代理机制的推演，我们已经获得了一个通用的方法模板。可以预期的是，通过模板来定制和引导代理类的代码生成，是比较可行的方法。我们将主要使用两个模板：类模板和方法模板。
**清单 1. 类模板**

````plain
	package &Package;
	final public class &Name &Extends &Implements
	{
	    private java.lang.reflect.InvocationHandler handler = null;
	    &Constructors
	    &Methods
	}
````

类模板定制了代理类的代码框架。其中带“&”前缀的标签位被用来引导相应的代码替换。在此预留了包（&Package）、类名（&ClassName）、类继承（&Extends）、接口实现（&Implements）、构造函数集（&Constructors）及方法集（&Methods）的标签位。类模板还同时声明了一个私有型的调用处理器对象作为类成员。
**清单 2. 方法模板**

````plain
	&Modifiers &ReturnType &MethodName(&Parameters) &Throwables
	{
	    java.lang.reflect.Method method = null;
	    try {
	        method = &Class.getMethod( "& MethodName", &ParameterTypes );
	    }
	    catch(Exception e){
	    }
	    Object r = null;
	    try{
	        r = handler.invoke( this, method, &ParameterValues );
	    }&Exceptions
	    &Return
	}
````

方法模板定制了代理类方法集合中各个方法的代码框架，同样的带“&”前缀的标签位被用来引导相应的代码替换。在此预留了修饰符（&Modifiers）、返回类型（&ReturnType）、方法名（&MethodName）、参数列表（Parameters）、异常列表（&Throwables）、方法的声明类（&Class）、参数类型列表（&ParameterTypes）、调用处理器的参数值列表（&ParameterValues），异常处理（&Exceptions）及返回值（&Return）的标签位。

## 代码生成

有了类模板和方法模板，代码生成过程就变得有章可依。基本过程可分为三步：1）生成代理类的方法集合；2）生成代理类的构造函数；3）最后生成整个代理类。

### 生成代理类的方法集

第一步，通过反射获得被代理类的所有 public 或 protected 且非 static 的 Method 对象列表，这些方法将被涵盖的原因是它们是可以被其他类所访问的。
第二步，遍历 Method 对象列表，对每个 Method 对象，进行相应的代码生成工作。
**清单 3. 对标签位进行代码替换生成方法代码**

````java
	String declTemplate = "&Modifiers &ReturnType &MethodName(&Parameters) &Throwables";
	String bodyTemplate = "&Declaration &Body";
	// 方法声明
	String declare = declTemplate.replaceAll("&Modifiers", getMethodModifiers( method ))
	    .replaceAll("&ReturnType", getMethodReturnType( method ))
	    .replaceAll("&MethodName", method.getName())
	    .replaceAll("&Parameters", getMethodParameters( method ))
	    .replaceAll("&Throwables", getMethodThrowables( method ));
	
	// 方法声明以及实现
	String body = bodyTemplate.replaceAll("&Declaration", declare )
	    .replaceAll("&Body", getMethodEntity( method ));
````

这里涉及了一些 ProxyEx 类的私有的辅助函数如 getMethodModifiers 和 getMethodReturnType 等等，它们都是通过反射获取所需的信息，然后动态地生成各部分代码。函数 getMethodEntity 是比较重要的辅助函数，它又调用了其他的辅助函数来生成代码并替换标签位。
**清单 4. ProxyEx 的静态方法 getMethodEntity()**

````java
	private static String getMethodEntity( Method method )
	{
	    String template =  "\n{"
	        + "\n    java.lang.reflect.Method method = null;"
	        + "\n    try{"
	        + "\n        method = &Class.getMethod( \"&MethodName\", &ParameterTypes );"
	        + "\n    }"
	        + "\n    catch(Exception e){"
	        + "\n    }"
	        + "\n    Object r = null;"
	        + "\n    try{" 
	        + "\n         r = handler.invoke( this, method, &ParameterValues );"
	        + "\n    }&Exceptions"
	        + "\n    &Return"
	        + "\n}";
	    
	    String result = template.replaceAll("&MethodName", method.getName() )
	        .replaceAll("&Class", method.getDeclaringClass().getName() + ".class")
	        .replaceAll("&ParameterTypes",  getMethodParameterTypesHelper(method))
	        .replaceAll("&ParameterValues",  getMethodParameterValuesHelper(method) )
	        .replaceAll("&Exceptions", getMethodParameterThrowablesHelper(method))
	        .replaceAll("&Return", getMethodReturnHelper( method ) );
	    
	    return result;
	}
````

当为 Class 类型对象生成该类型对应的字符代码时，可能涉及数组类型，反推过程会需要按递归方法生成代码，这部分工作由 getTypeHelper 方法提供
**清单 5. ProxyEx 的静态方法 getTypeHelper()**

````java
	private static String getTypeHelper(Class type)
	{
	    if( type.isArray() )
	    {
	        Class c = type.getComponentType();
	        return getTypeHelper(c) + "[]";
	    }
	    else
	    {
	        return type.getName();
	    }
	}
````

第三步，将所生成的方法保存进一个 map 表，该表记录的是键值对（方法声明，方法实现）。由于类的多态性，父类的方法可能被子类所覆盖，这时以上通过遍历所得的方法列表中就会出现重复的方法对象，维护该表可以很自然地达到避免方法重复生成的目的，这就维护该表的原因所在。

### 生成代理类的构造函数

相信读者依然清晰记得代理类是通过其构造函数反射生成的，而构造时传入的唯一参数就是调用处理器对象。为了保持与原代理机制的一致性，新的代理类的构造函数也同样只有一个调用处理器对象作为参数。模板简单如下
**清单 6. 构造函数模板**

````plain
	public &Constructor(java.lang.reflect.InvocationHandler handler) 
	{ 
	    super(&Parameters); 
	    this.handler = handler; 
	}
````

需要特别提一下的是 super 方法的参数值列表 &Parameters 的生成，我们借鉴了 Mock 思想，侧重于追求对象构造的成功，而并未过多地努力分析并寻求最准确最有意义的赋值。对此，相信读者会多少产生一些疑虑，但稍后我们会提及改进的方法，请先继续阅读。

### 生成整个代理类

通过以上步骤，构造函数和所有需被代理的方法的代码已经生成，接下来就是生成整个代理类的时候了。这个过程也很直观，通过获取相关信息并对类模板中各个标签位进行替换，便可以轻松的完成整个代理类的代码生成。

## 被遗忘的角落：类变量

等等，似乎遗忘了什么？从调用者的角度出发，我们希望代理类能够作为被代理类的如实代表呈现在用户面前，包括其内部状态，而这些状态通常是由类变量所体现出来的，于是就涉及到类变量的代理问题。

要解决这个问题，首先需要思考何时两者的类变量可能出现不一致？回答了这个问题，也就找到了解决思路。回顾代理类的构造函数，我们以粗糙的方式构造了代理类实例。它们可能一开始就已经不一致了。还有每次方法调用也可能导致被两者的类变量的不一致。如何解决？直观的想法是：1）构造时需设法进行同步；2）方法调用之前和之后也需设法进行同步。这样，我们就能够有效避免代理类和被代理类的类变量不一致的问题的出现了。

但是，如何获得被代理类的实例呢？从当前的的设计中已经没有办法做到。既然如此，那就继续我们的扩展之旅。只不过这次扩展的对象是调用处理器接口，我们将在扩展后的接口里加入获取被代理类对象的方法，且扩展调用处理器接口将以 static 和 public 的形式被定义在 ProxyEx 类中。
**清单 7. ProxyEx 类内的静态接口 InvocationHandlerEx**

````java
	public static interface InvocationHandlerEx extends InvocationHandler 
	{ 
	    // 返回指定 stubClass 参数所对应的被代理类实体对象
	    Object getStub(Class stubClass); 
	}
````

新的调用处理器接口具备了获取被代理类对象的能力，从而为实现类变量的同步打开了通道。接下来还需要的就是执行类变量同步的 sync 方法，每个动态生成的代理类中都会被悄悄地加入这个私有方法以供调用。每次方法被分派转发到调用处理器执行之前和之后，sync 方法都会被调用，从而保证类变量的双向实时更新。相应的，方法模板也需要更新以支持该新特性。
**清单 8. 更新后的方法模板（部分）**

````plain
	Object r = null;
	try{
	    // 代理类到被代理类方向的变量同步
	    sync(&Class, true);
	    r = handler.invoke( this, method, &ParameterValues );
	    // 被代理类到代理类方向的变量同步
	    sync(&Class, false);
	}&Exceptions
	
	&Return
````

sync 方法还会在构造函数尾部被调用，从而将被代理类对象的变量信息同步到代理类对象，实现类似于拷贝构造的等价效果。相应的，构造函数模板也需要更新以支持该新特性。
**清单 9. 更新后的构造函数模板**

````plain
	public &Name(java.lang.reflect.InvocationHandler handler)
	{
	    super(&Parameters);
	    this.handler = handler;
	    // 被代理类到代理类方向的变量同步
	    sync(null, false);
	}
````

接下来介绍 sync 方法的实现，其思想就是首先获取被代理类的所有 Field 对象的列表，并通过扩展的调用处理器获得方法的声明类说对应的 stub 对象，然后遍历 Field 对象列表并对各个变量进行拷贝同步。
**清单 10. 声明在动态生成的代理类内部的 snyc 函数**

````java
	private synchronized void sync(java.lang.Class clazz, boolean toStub)
	{
	    // 判断是否为扩展调用处理器
	    if( handler instanceof InvocationHandlerEx )
	    {
	        java.lang.Class superClass = this.getClass().getSuperclass();
	        java.lang.Class stubClass = ( clazz != null ? clazz : superClass );
	       
	        // 通过扩展调用处理器获得stub对象
	        Object stub = ((InvocationHandlerEx)handler).getStub(stubClass);
	        if( stub != null )
	        {
	            // 获得所有需同步的类成员列表，遍历并同步
	            java.lang.reflect.Field[] fields = getFields(superClass);
	            for(int i=0; fields!=null&&i<fields.length; i++)
	            {
	                try
	                {
	                    fields[i].setAccessible(true);
	                    // 执行代理类和被代理类的变量同步
	                    if(toStub)
	                    {
	                        fields[i].set(stub, fields[i].get(this));
	                    }
	                    else
	                    {
	                        fields[i].set(this, fields[i].get(stub));
	                    }
	                }
	                catch(Throwable e)
	                {
	                }
	            }
	        }
	    }
	}
````

这里涉及到一个用于获取类的所有 Field 对象列表的静态辅助方法 getFields。为了提高频繁查询时的性能，配合该静态方法的是一个静态的 fieldsMap 对象，用于记录已查询过的类其所包含的 Field 对象列表，使得再次查询时能迅速返回其对应列表。相应的，类模板也需进行更新。
**清单 11. 增加了静态 fieldsMap 变量后的类模板**

````plain
	package &Package;
	final public class &Name &Extends &Implements
	{
	    private static java.util.HashMap fieldsMap = new java.util.HashMap();
	    private java.lang.reflect.InvocationHandler handler = null;
	    &Constructors
	    &Methods
	}
````

**清单 12. 声明在动态生成的代理类内部的静态方法 getFields**

````java
	private static java.lang.reflect.Field[] getFields(java.lang.Class c)
	{
	    if( fieldsMap.containsKey(c) )
	    {
	        return (java.lang.reflect.Field[])fieldsMap.get(c);
	    }
	    
	    java.lang.reflect.Field[] fields = null;
	    if( c == java.lang.Object.class )
	    {
	        fields = c.getDeclaredFields();
	    }
	    else
	    {
	        java.lang.reflect.Field[] fields0 = getFields(c.getSuperclass());
	        java.lang.reflect.Field[] fields1 = c.getDeclaredFields();
	        fields = new java.lang.reflect.Field[fields0.length + fields1.length];
	        System.arraycopy(fields0, 0, fields, 0, fields0.length);
	        System.arraycopy(fields1, 0, fields, fields0.length, fields1.length);
	    }
	    fieldsMap.put(c, fields);
	    return fields;
	}
````

## 动态编译及装载

代码生成以后，需要经过编译生成 JVM 所能识别的字节码，而字节码还需要通过类装载器载入 JVM 才能最终被真正使用，接下来我们将阐述如何动态编译及装载。

首先是动态编译。这部分由 ProxyEx 类的 getProxyClassCodeSource 函数完成。该函数分三步进行：第一步保存源代码到 .java 文件；第二步编译该 .java 文件；第三步从输出的 .class 文件读取字节码。
**清单 13. ProxyEx 的静态方法 getProxyClassCodeSource**

````java
	private static byte[] getProxyClassCodeSource( String pkg, String className, 
	    String declare ) throws Exception
	{
	    // 将类的源代码保存进一个名为类名加“.java”的本地文件
	    File source = new File(className + ".java");
	    FileOutputStream fos = new FileOutputStream( source );
	    fos.write( declare.getBytes() );
	    fos.close();
	    
	    // 调用com.sun.tools.javac.Main类的静态方法compile进行动态编译
	    int status = com.sun.tools.javac.Main.compile( new String[] { 
	        "-d", 
	        ".", 
	        source.getName() } );
	
	    if( status != 0 )
	    {
	        source.delete();
	        throw new Exception("Compiler exit on " + status);
	    }
	    
	    // 编译得到的字节码将被输出到与包结构相同的一个本地目录，文件名为类名加”.class”
	    String output = ".";
	    int curIndex = -1;
	    int lastIndex = 0;
	    while( (curIndex=pkg.indexOf('.', lastIndex)) != -1 )
	    {
	        output = output + File.separator + pkg.substring( lastIndex, curIndex );
	        lastIndex = curIndex + 1;
	    }
	    output = output + File.separator + pkg.substring( lastIndex );
	    output = output + File.separator + className + ".class";
	    
	    // 从输出文件中读取字节码，并存入字节数组
	    File target = new File(output);
	    FileInputStream f = new FileInputStream( target );
	    byte[] codeSource = new byte[(int)target.length()];
	    f.read( codeSource );
	    f.close();
	    
	    // 删除临时文件
	    source.delete();
	    target.delete();
	    
	    return codeSource;
	}
````

得到代理类的字节码，接下来就可以动态装载该类了。这部分由 ProxyEx 类的 defineClassHelper 函数完成。该函数分两步进行：第一步通过反射获取父类 Proxy 的静态私有方法 defineClass0；第二步传入字节码数组及其他相关信息并反射调用该方法以完成类的动态装载。
**清单 14. ProxyEx 的静态方法 defineClassHelper**

````java
	private static Class defineClassHelper( String pkg, String cName, byte[] codeSource ) 
	    throws Exception
	{
	    Method defineClass = Proxy.class.getDeclaredMethod( "defineClass0", 
	        new Class[] { ClassLoader.class, 
	            String.class,
	            byte[].class,
	            int.class,
	            int.class } );
	
	    defineClass.setAccessible(true);
	    return (Class)defineClass.invoke( Proxy.class, 
	        new Object[] { ProxyEx.class.getClassLoader(), 
	        pkg.length()==0 ? cName : pkg+"."+cName,
	        codeSource,
	        new Integer(0),
	        new Integer(codeSource.length) } );
	}
````

## 性能改进

原动态代理机制中对接口数组有一些有趣的特点，其中之一就是接口的顺序差异会在一定程度上导致生成新的代理类，即使其实并无必要。其中的原因就是因为缓存表是以接口名称列表作为关键字，所以不同的顺序就意味着不同的关键字，如果对应的关键字不存在，就会生成新但是作用重复的代理类。在 ProxyEx 类中，我们通过主动排序避免了类似的问题，提高动态生成代理类的效率。而且，如果发现数组中都是接口类型，则直接调用父类 Proxy 的静态方法 getProxyClass 生成代理类，否则才通过扩展动态代理机制生成代理类，这样也一定程度上改进了性能。

## 兼容性问题

接下来需要考虑的是与原代理机制的兼容性问题。曾记否，Proxy 中还有两个静态方法：isProxyClass 和 getInvocationHandler，分别被用于判断 Class 对象是否是动态代理类和从 Object 对象获取对应的调用处理器（如果可能的话）。
**清单 15. Proxy 的静态方法 isProxyClass 和 getInvocationHandler**

````java
	static boolean isProxyClass(Class cl) 
	static InvocationHandler getInvocationHandler(Object proxy)
````

现在的兼容性问题，主要涉及到 ProxyEx 类与父类 Proxy 在关于动态生成的代理类的信息方面所面临的如何保持同步的问题。曾介绍过，在 Proxy 类中有个私有的 Map 对象 proxyClasses 专门负责保存所有动态生成的代理类类型。Proxy 类的静态函数 isProxyClass 就是通过查询该表以确定某 Class 对象是否为动态代理类，我们需要做的就是把由 ProxyEx 生成的代理类类型也保存入该表。这部分工作由 ProxyEx 类的静态方法 addProxyClass 辅助完成。
**清单 16. ProxyEx 的静态方法 addProxyClass**

````java
	private static void addProxyClass( Class proxy ) throws IllegalArgumentException 
	{ 
	    try 
	    { 
	        // 通过反射获取父类的私有 proxyClasses 变量并更新
	        Field proxyClasses = Proxy.class.getDeclaredField("proxyClasses"); 
	        proxyClasses.setAccessible(true); 
	        ((Map)proxyClasses.get(Proxy.class)).put( proxy, null ); 
	    } 
	    catch(Exception e) 
	    { 
	        throw new IllegalArgumentException(e.toString()); 
	    } 
	}
````

相对而言，原来 Proxy 类的静态方法 getInvocationHandler 实现相当简单，先判断是否为代理类，若是则直接类型转换到 Proxy 并返回其调用处理器成员，而扩展后的代理类并不非从 Proxy 类继承，所以在获取调用处理器对象的方法上需要一些调整。这部分由 ProxyEx 类的同名静态方法 getInvocationHandler 完成。
**清单 17. ProxyEx 的静态方法 getInvocationHandler**

````java
	public static InvocationHandler getInvocationHandler(Object proxy) 
	    throws IllegalArgumentException
	{
	    // 如果Proxy实例，直接调父类的方法
	    if( proxy instanceof Proxy )
	    {
	        return Proxy.getInvocationHandler( proxy );
	    }
	    
	    // 如果不是代理类，抛异常
	    if( !Proxy.isProxyClass( proxy.getClass() ))
	    {
	        throw new IllegalArgumentException("Not a proxy instance");
	    }
	        
	    try
	    {
	        // 通过反射获取扩展代理类的调用处理器对象
	        Field invoker = proxy.getClass().getDeclaredField("handler");
	        invoker.setAccessible(true);
	        return (InvocationHandler)invoker.get(proxy);
	    }
	    catch(Exception e)
	    {
	        throw new IllegalArgumentException("Suspect not a proxy instance");
	    }
	}
````

## 坦言：也有局限

受限于 Java 的类继承机制，扩展的动态代理机制也有其局限，它不能支持：
 1. 声明为 final 的类；
 2. 声明为 final 的函数；
 3. 构造函数均为 private 类型的类；

## 实例演示

阐述了这么多，相信读者一定很想看一下扩展动态代理机制是如何工作的。本文最后将以 2010 世博门票售票代理为模型进行演示。
首先，我们定义了一个售票员抽象类 TicketSeller。
**清单 18. TicketSeller**

````java
	public abstract class TicketSeller 
	{
	    protected String theme;
	    protected TicketSeller(String theme)
	    {
	        this.theme = theme;
	    }
	    public String getTicketTheme()
	    {
	        return this.theme;
	    }
	    public void setTicketTheme(String theme)
	    {
	        this.theme = theme;
	    }
	    public abstract int getTicketPrice();
	    public abstract int buy(int ticketNumber, int money) throws Exception;
	}
````

其次，我们会实现一个 2010 世博门票售票代理类 Expo2010TicketSeller。
**清单 19. Expo2010TicketSeller**

````java
	public class Expo2010TicketSeller extends TicketSeller 
	{
	    protected int price;
	    protected int numTicketForSale;
	    public Expo2010TicketSeller()
	    {
	        super("World Expo 2010");
	        this.price = 180;
	        this.numTicketForSale = 200;
	    }
	    public int getTicketPrice()
	    {
	        return price;
	    }
	    public int buy(int ticketNumber, int money) throws Exception
	    {
	        if( ticketNumber > numTicketForSale )
	        {
	            throw new Exception("There is no enough ticket available for sale, only " 
	                + numTicketForSale + " ticket(s) left");
	        }
	        int charge = money - ticketNumber * price;
	        if( charge < 0 )
	        {
	            throw new Exception("Money is not enough. Still needs " 
		        + (-charge) + " RMB.");
	        }
	        numTicketForSale -= ticketNumber;
	        return charge;
	    }
	}
````

接着，我们将通过购票者类 TicketBuyer 来模拟购票以演示扩展动态代理机制。
**清单 20. TicketBuyer**

````java
	public class TicketBuyer 
	{
	    public static void main(String[] args) 
	    {
	        // 创建真正的TickerSeller对象，作为stub实体
	        final TicketSeller stub = new Expo2010TicketSeller();
	
	        // 创建扩展调用处理器对象
	        InvocationHandler handler = new InvocationHandlerEx()
	        {
	            public Object getStub(Class stubClass) 
	            {
	                // 仅对可接受的Class类型返回stub实体
	                if( stubClass.isAssignableFrom(stub.getClass()) )
	                {
	                    return stub;
	                }
	                return null;
	            }
	
	            public Object invoke(Object proxy, Method method, Object[] args) 
	            throws Throwable 
	            {
	                Object o;
	                try
	                {
	                    System.out.println("   >>> Enter method: " 
			        + method.getName() );
	                    o = method.invoke(stub, args);
	                }
	                catch(InvocationTargetException e)
	                {
	                    throw e.getCause();
	                }
	                finally
	                {
	                    System.out.println("   <<< Exit method: " 
			        + method.getName() );
	                }
	                return o;
	            }
	        };
	        
	        // 通过ProxyEx构造动态代理
	        TicketSeller seller = (TicketSeller)ProxyEx.newProxyInstance(
	                TicketBuyer.class.getClassLoader(), 
	                new Class[] {TicketSeller.class}, 
	                handler);
	        
	        // 显示代理类的类型
	        System.out.println("Ticket Seller Class: " + seller.getClass() + "\n");
	        // 直接访问theme变量，验证代理类变量在对象构造时同步的有效性
	        System.out.println("Ticket Theme: " + seller.theme + "\n");
	        // 函数访问price信息
	        System.out.println("Query Ticket Price...");
	        System.out.println("Ticket Price: " + seller.getTicketPrice() + " RMB\n");
	        // 模拟票务交易
	        buyTicket(seller, 1, 200);
	        buyTicket(seller, 1, 160);
	        buyTicket(seller, 250, 30000);
	        // 直接更新theme变量
	        System.out.println("Updating Ticket Theme...\n");
	        seller.theme = "World Expo 2010 in Shanghai";
	        // 函数访问theme信息，验证扩展动态代理机制对变量同步的有效性
	        System.out.println("Query Updated Ticket Theme...");
	        System.out.println("Updated Ticket Theme: " + seller.getTicketTheme() + "\n");    
	    }
	    // 购票函数
	    protected static void buyTicket(TicketSeller seller, int ticketNumber, int money)
	    {
	        try 
	        {
	            System.out.println("Transaction: Order " + ticketNumber + " ticket(s) with " 
	                + money + " RMB");
	            int charge = seller.buy(ticketNumber, money);
	            System.out.println("Transaction: Succeed - Charge is " + charge + " RMB\n");
	        } 
	        catch (Exception e) 
	        {
	            System.out.println("Transaction: Fail - " + e.getMessage() + "\n");
	        }    
	    }
	}
````

最后，见演示程序的执行结果。
**清单 21. 执行输出**

````plain
	Ticket Seller Class: class com.demo.proxy.test.TicketSellerProxy0
	
	Ticket Theme: World Expo 2010
	
	Query Ticket Price...
	   >>> Enter method: getTicketPrice
	   <<< Exit method: getTicketPrice
	Ticket Price: 180 RMB
	
	Transaction: Order 1 ticket(s) with 200 RMB
	   >>> Enter method: buy
	   <<< Exit method: buy
	Transaction: Succeed - Charge is 20 RMB
	
	Transaction: Order 1 ticket(s) with 160 RMB
	   >>> Enter method: buy
	   <<< Exit method: buy
	Transaction: Fail - Money is not enough. Still needs 20 RMB.
	
	Transaction: Order 250 ticket(s) with 30000 RMB
	   >>> Enter method: buy
	   <<< Exit method: buy
	Transaction: Fail - There is no enough ticket available for sale, only 199 ticket(s) left
	
	Updating Ticket Theme...
	
	Query Updated Ticket Theme...
	   >>> Enter method: getTicketTheme
	   <<< Exit method: getTicketTheme
	Updated Ticket Theme: World Expo 2010 in Shanghai
````