---
layout:     post
title:      "使用GitHub Pages搭建独立博客（二）"
subtitle:   "使用Jekyll生成静态网站"
author:     "刘文俊"
date:       2015-09-21
tags:
    - GitHub Pages
    - 独立博客
---

> Jekyll的详细文档，参见 [Jekyll • Simple, blog-aware, static sites](http://jekyllrb.com/)

## 开始使用Jekyll
Jekyll是一个简单而又强大的静态博客生成器，它可以使用你设定的模板生成一个完整的HTML站点，而你只需要专注于博文的写作，不需要因为新增一篇博文而到处修改你的HTML文件。另外，GitHub Pages也支持Jekyll，每一个GitHub Page站点都是运行在Jekyll之上的，你只需要向GitHub推送你的Jekyll模板代码，GitHub就会帮你生成一个静态网站。

### 安装Jekyll
强烈建议你在自己的电脑上安装Jekyll，这样你就可以先在本地预览好你的博客效果，再推送到GitHub。
下面的安装过程以Windows系统为例，使用Jekyll之前，你可能需要先安装下面这些东西：

1. **Ruby** - Jekyll是使用Ruby语言编写的，所以它的运行要依赖于Ruby环境。对于Windows系统，可以从[这里](http://rubyinstaller.org/downloads/)下载Ruby的安装包。
2. **DevKit** - 在Ruby的下载页面也有DevKit的下载链接，下载对应的版本，下载下来是一个sfx的文件。安装Ruby后，把下载下来的sfx解压到任意目录，然后在那个目录下打开命令行，先后执行`ruby dk.rb init`和`ruby dk.rb install`两句命令即可完成安装。安装完成后可以删除这个解压出来的目录。
3. **Bundler** - 安装好Ruby和DevKit后，执行`gem install bundler`即可安装Bundler。
4. **RailsInstaller** - 安装Ruby，DevKit和Bundler的过程还是有点烦的，而且还可能会出错，作为一个懒人的我，也实在不能忍。所以包含了各种工具的[RailsInstaller](http://railsinstaller.org/en)简直就成了懒人的福音<i class="emoji emoji-relieved"></i>。下载安装后，前面三步都可以跳过（什么？你问我既然这样为什么还要讲前三步？我就是凑字数，你吹呀<i class="emoji emoji-laughing"></i>）。
5. **Jekyll** - 首先在仓库的根目录下创建一个名为`Gemfile`的文件，内容为

	````Gemfile
		source 'https://rubygems.org'
		gem 'github-pages'
	````

   然而，由于一些不能描写的原因，[https://rubygems.org](https://rubygems.org) 这个网址在我国大陆是不能访问的，因此我们使用它的镜像站[http://ruby.taobao.org/](http://ruby.taobao.org/) 代替，所以`Gemfile`文件的内容实际是

	````Gemfile
		source 'http://ruby.taobao.org/'
		gem 'github-pages'
	````

   创建好文件后，在此目录下打开命令行，输入命令`bundle install`即可完成Jekyll的安装

### 运行Jekyll
当你写完一个Jekyll的模板之后，运行`bundle exec jekyll serve`即可启动Jekyll。该命令的作用是，先用你写的模板生成一个静态网站，然后启动HTTP服务器。在浏览器地址栏输入`http://localhost:4000`即可预览生成的网站。

### 更新Jekyll
Jekyll是一个很活跃的开源项目，因此版本更新的速度比较快，使用`bundle update`命令可以使你的Jekyll更新到最新版本。

## Hello, Jekyll
现在，让我们自己来写一个`Hello, Jekyll`网站（`就像各种编程语言的Hello, World程序一样`），以增加我们对Jekyll的感性认识。

### 建立一个`_config.yml`文件
这是Jekyll网站的配置文件，我们可以在这里设置一些Jekyll的参数，也可以自己添加一些参数。这个文件里设置的参数都可以在Jekyll页面中以`{% raw %}{{site.param}}{% endraw %}`的形式进行访问

````yml
	# Site settings
	title: Vincent's Site
````

### 创建一个`_includes`文件夹
这个文件夹中存放的是每个页面的公共部分（如导航条，版权声明等），这样，在其他页面中就不用重复写这些代码，只需要用Jekyll的`include`命令就可以把这些文件包含进去，如`{% raw %}{% include head.html %}{% endraw %}`。在这个文件夹里，我们添加三个文件，它们分别是：
head.html

````html
	<head>
	    <title>{% if page.title %}{{ page.title }} - {{ site.title }}{% else %}{{ site.title }}{% endif %}</title>
	</head>
````

在`head.html`中，我们可以看出，在Jekyll中，程序指令使用`{% raw %}{% %}{% endraw %}`语法包含起来，读取变量使用的是`{% raw %}{{ }}{% endraw %}`语法

nav.html

````html
	<h1>{{site.title}}</h1>
	<hr/>
````

footer.html

````html
	<hr/>
	<p>Copyright &copy; 2015 Vincent Lau. All rights reserved.</p>
````

### 创建一个`_layouts`文件夹
一个网站都会有许许多多的页面，但是一般来说，这些页面有很多都是基于相同的布局。比如，一个博客里面有100篇博文，就会有100个HTML页面，但是这些页面的布局方式都是一样的，这样，我们就可以把布局的HTML代码单独抽出来，放在`_layouts`文件夹下。我们现在创建两个布局文件，他们分别是：
default.html

````html
	<!DOCTYPE html>
	<html>
	{% include head.html %}
	<body>
	    {% include nav.html %}
	    {{ content }}
	    {% include footer.html %}
	</body>
	</html>
````

这个默认的布局文件使用`include`指令包含了三个html文件，并且用`{% raw %}{{ content }}{% endraw %}`把内容至于其中。使用了这个布局的页面，就会用它的内容来替换掉布局文件中的`{% raw %}{{ content }}{% endraw %}`。

post.html

````html
	---
	layout: default
	---
	
	<h2>{{page.title}}</h2>
	<font color="gray" ><i>Author: {{page.author}}</i></font><br/>
	{{content}}
````

这个布局文件是博文所使用的布局，在这个布局中，把文章的标题和作者显示了出来，然后在其下显示文章的内容。特别地，我们注意到，在这个文件最上方用两条三横杠括起来的区域，这是Jekyll的YAML前置数据。这些前置数据必须存在于文件首部，并且格式要符合规范。你可以在这里设置一些预定义的变量或者你自己定义的变量。这些变量可以在Jekyll页面中通过形如`{% raw %}{{ page.param }}{% endraw %}`的格式获得。我们这里使用的`layout`变量指示了这个文件所使用的布局文件为`default`（也就是我们上面添加的`default.html`）。
 注意(`尤其是Windows用户`)，当你使用`UTF-8`来编码你的文件的时候，请确保没有`BOM`的头部字符在你的文件中，否则会导致Jekyll奔溃

### 添加`index.html`文件
这是我们博客的主页，它使用`default`布局文件，并且用一个循环把我们的博文列表显示了出来：

````html
	---
	layout: default
	---
	
	<ul>
	{ % for post in site.posts % }
		<li>
			<h2><a href="{{ post.url }}">{{post.title}}</a></h2>
		</li>
	{ % endfor % }
	</ul>
````

### 添加自己的博文
先创建一个`_posts`文件夹，然后在里面添加。博文的文件名一定要符合`yyyy-MM-dd-<filename>.<extension>`的格式。我们先来添加两篇
2015-09-22-post-01.md

````md
	---
	layout: post
	title: "Hello, Jekyll"
	author: "Vincent Lau"
	---
	
	This is my FIRST Jekyll article.
````

2015-09-22-post-02.md

````md
	---
	layout: post
	title: "Hello, Jekyll - 02"
	author: "Vincent Lau"
	---
	
	This is my SECOND Jekyll article.
````

### 然后添加`Gemfile`
这是`bundle exec jekyll serve`文件需要用到的。

````Gemfile
	source 'http://ruby.taobao.org/'
	gem 'github-pages'
````

### 完成
到现在为止，所有文件都创建完毕，我们已经完成了一个最简单的Jekyll模板。现在的文件目录结构为：

````plain
	|--_includes
	|  |--footer.html
	|  |--head.html
	|  |--nav.html
	|
	|--_layouts
	|  |--default.html
	|  |--post.html
	|
	|--_posts
	|  |--2015-09-22-post-01.md
	|  |--2015-09-22-post-02.md
	|
	|--_config.yml
	|--Gemfile
	|--index.html
````

执行`bundle exec jekyll serve`命令，生成网站，然后启动本地HTML服务器预览效果。Jekyll所生成的所有文件都会存放在`_site`文件夹下。若要在线查看`HelloJekyll`的效果，可前往[http://www.liuwenjun.info/HelloJekyll/](http://www.liuwenjun.info/HelloJekyll/)，要查看`HelloJekyll`的代码，可前往[我的GitHub](https://github.com/vincentlauvlwj/HelloJekyll)。

## 使用更好看的Jekyll模板
真正的博客当然不可能真的像`HelloJekyll`那样简陋，网上可以下载到大神们做好的各种Jekyll模板，我们可以把它用到自己的博客里来，加以修改。在这里给大家推荐一个网站[Jekyll Themes](http://jekyllthemes.org/)。当然，网上找的模板不一定适合自己，你可以发挥自己的创造力和动手能力，做出一个独一无二的个人博客，这就需要一定的审美以及HTML和CSS的功底了。
关于Jekyll的内容就讲到这里，当然这些只是冰山一角，但是基本的原理你已经掌握，更多的命令可以通过查阅文档获得，参见[Jekyll • Simple, blog-aware, static sites](http://jekyllrb.com/)。
