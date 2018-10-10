---
layout:     post
title:      "使用GitHub Pages搭建独立博客（三）"
subtitle:   "添加一些扩展功能"
author:     "刘文俊"
date:       2015-09-27
tags:
    - GitHub Pages
    - 独立博客
---

> 更多特性，参见 [GitHub Pages Features - User Documentation](https://help.github.com/categories/github-pages-features/)

## 添加评论功能
之前说过，GitHub Pages 只能托管静态网页，是不能有数据库的。在这种限制下，我们要增加评论功能就不能自己造轮子了，只能使用别人造好的轮子。Disqus 是一个比较好用的第三方评论插件，它支持使用各种社区账号登录，比如 Twitter，Google+ 等等。然而，由于一些奇奇怪怪的原因，国人并没有几个人拥有这些社区的账号，再加上 Disqus 是国外的网站，访问速度也是个硬伤，于是，造就了 Disqus 很不愉快的使用体验。所以我用了多说，这是一个和 Disqus 几乎一模一样的东西，但是它不仅有访问速度，还能使用国内的主流社交账号登录，如微博，QQ 等，缺点就是界面比 Disqus 丑 <i class="emoji emoji-laughing"></i>

<!-- more -->

要使用多说评论，首先要在[http://duoshuo.com/](http://duoshuo.com/)注册一个多说账号，然后添加一个站点，输入你的网站的域名和其他信息，最后在要添加评论的页面添加如下代码即可，其他第三方评论插件的使用方法也大同小异。

````html
	<!-- 多说评论框 start -->
	<div class="ds-thread" data-thread-key="请将此处替换成文章在你的站点中的ID" data-title="请替换成文章的标题" data-url="请替换成文章的网址"></div>
	<!-- 多说评论框 end -->
	<!-- 多说公共JS代码 start (一个网页只需插入一次) -->
	<script type="text/javascript">
	var duoshuoQuery = {short_name:"vincentlauvlwj"};
	(function() {
		var ds = document.createElement('script');
		ds.type = 'text/javascript';
		ds.async = true;
		ds.src = (document.location.protocol == 'https:' ? 'https:' : 'http:') + '//static.duoshuo.com/embed.js';
		ds.charset = 'UTF-8';
		(document.getElementsByTagName('head')[0] 
			 || document.getElementsByTagName('body')[0]).appendChild(ds);
	})();
	</script>
	<!-- 多说公共JS代码 end -->
````

## 添加流量统计
如果你希望知道你的网站的访问量以及更详细的流量信息的话，可以尝试使用第三方的流量统计功能，这里以百度统计为例。
首先注册一个百度站长账号，在注册时会让你输入你的网站域名等信息。注册成功后在你需要进行流量统计的页面的`head`标签内加入如下代码。然后百度就可以统计到你的网站的访问情况了。

````html
	<script>
	var _hmt = _hmt || [];
	(function() {
	  var hm = document.createElement("script");
	  hm.src = "//hm.baidu.com/hm.js?【这里是百度分配给你的一串唯一代码】";
	  var s = document.getElementsByTagName("script")[0]; 
	  s.parentNode.insertBefore(hm, s);
	})();
	</script>
````

## emoji
要在文章中使用emoji表情也特别简单<i class="emoji emoji-grimacing"></i><i class="emoji emoji-grimacing"></i><i class="emoji emoji-grimacing"></i>
首先，在配置文件`_config.yml`中添加 emoji 支持，如下

````yml
	gems:
	  - jemoji
````

然后，在你的CSS文件中添加如下代码，控制emoji表情在文章中显示的样式（`具体的属性也可以根据自己的需要进行设置`）。其中最重要的是display属性一定要设置为inline，这样才能使表情嵌在文字中。因为很多模板中都会出现类似`article img { display: block; }`的代码，如果没有`.emoji { display: inline; }`的话会发生什么不说你也知道。

````css
	.emoji {
	  display: inline;
	  margin-left: auto;
	  margin-right: auto;
	  max-width: 100%;
	}
````

现在，配置已经完成了，那么要如何在文章中输入emoji表情呢？我们只需要在希望插入emoji表情的地方输入那个表情对应的代码就可以了。一般来说，emoji表情的代码是由两个冒号包围的，如蠢汪<i class="emoji emoji-dog"></i>这个表情的代码就是<code><i>:</i>dog<i>:</i></code>。每个emoji表情对应的代码可以在[Emoji cheat sheet for GitHub, Basecamp and other services](http://www.emoji-cheat-sheet.com/)获得，虽然这个网站的访问速度贼慢<i class="emoji emoji-broken-heart"></i>，下面放一张常用表情代码的截图以供参考![](https://www.liuwj.me/files/in-post/independent-blog-page-emoji-cheat-sheet.png)
需要注意的是，在本地使用Jekyll预览你的文章时，须使用`bundle exec jekyll serve`命令，切不可使用`jekyll serve --watch`。只有使用`bundle`命令，才可以使本地预览到的效果和最终提交到GitHub上显示的效果完全一致。而且你还可以使用`bundle update`命令使你本地的Jekyll版本保持最新。正是因为这个原因，所以在上篇文章中我只介绍了`bundle`命令，而没有介绍直接使用`jekyll`命令的方法。

## 自定义404页面

未完待续。。。