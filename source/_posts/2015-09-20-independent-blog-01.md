---
layout:     post
title:      "使用GitHub Pages搭建独立博客（一） - 开始使用GitHub Pages"
author:     "刘文俊"
date:       2015-09-20
tags:
    - GitHub Pages
    - 教程
---

> 这篇文章很多内容都是从GitHub官网翻译而来，详情可访问 [GitHub Pages Basics - User Documentation](https://help.github.com/categories/github-pages-basics/)

## 前言
GitHub Pages是托管在GitHub服务器上的公共页面，我们可以在上面托管自己的静态页面（`只能是静态页面，不支持JSP，ASP等`），这些静态页面是由我们自己任意设计的，也就是说，我们可以把它做成一个信息发布网站，个人网站，OR博客。这个系列的文章简单介绍了如何使用GitHub Pages和Jekyll搭建自己的独立博客，其中有很多内容可以从GitHub官网获得，也可以从搜索引擎搜到，我写这个也只是总结一下自己的经验而已，如若有误，欢迎在评论区指正。

这些文章假设读者已经会使用Git，GitHub和Markdown，故不赘述。欲学习Git，可访问[Git教程 - 廖雪峰的官方网站](http://www.liaoxuefeng.com/wiki/0013739516305929606dd18361248578c67b8067c8c017b000)；了解GitHub中Markdown的使用，可访问[Writing on GitHub - User Documentation](https://help.github.com/categories/writing-on-github/)。

<!-- more -->

## 注意
使用GitHub Pages前，应注意以下两点：

 - GitHub Pages使用HTTP协议，而不是HTTPS，请不要使用它传输敏感信息，比如密码或者银行账号。
 - 即使你的仓库是私有的，GitHub Pages也是公开在互联网中的，所以，如果您的仓库中具有敏感数据，请在发布前移除之。

## 用户，组织和项目页面
GitHub Pages具有两种基本的类型：用户/组织页面(User/Organization Pages)和项目页面(Project Pages)。它们的用法几乎是完全一样的，但是还是有一些重要的区别。

### 用户/组织页面
用户/组织页面使用一个专门的仓库存放文件，这个仓库必须以你的用户名命名，规则如下：

 - 仓库名称必须符合`<username>.github.io`的模式。
 - 该仓库`master`分支的内容才会用来构建你的GitHub Pages。

你只能使用自己的用户名来建立用户/组织页面的仓库，形如`joe/bob.github.io`这样的仓库是不行的。
当用户页面建好之后，可以使用`http(s)://<username>.github.io`来访问。

### 项目页面
与用户/组织页面不同，项目页面是保存在原项目的仓库中的。个人账户与组织都可以创建项目页面，个人账号的项目页面URL是`http(s)://<username>.github.io/<projectname>`，组织的项目页面URL是`http(s)://<orgname>.github.io/<projectname>`。他们的创建步骤都是一样的。
项目页面与用户/组织页面的不同之处主要是：

 - 项目页面使用的分支是`gh-pages`，而不是`master`分支。

## 使用自动生成器生成GitHub Pages
此处以项目页面为例，步骤如下：

1. 登录你的GitHub，打开要生成GitHub Pages的仓库的首页。
2. 点击右侧工具栏的**Setting**。![](https://www.liuwj.me/files/in-post/independent-blog-repo-actions-settings.png)
3. 点击**Automatic Page Generator**按钮。![](https://www.liuwj.me/files/in-post/independent-blog-pages-automatic-page-generator.png)
4. 在编辑框中输入你的内容，当然也可以使用README中的内容。
5. 编辑完毕后点击**Continue To Layouts**按钮。
6. 选择你喜欢的主题后，点击右上角的**Publish page**。![](https://www.liuwj.me/files/in-post/independent-blog-page-generator-picker.png)

用户/组织页面的生成步骤也是类似的，在此不做赘述。
自动生成完成后，你可以获得所生成的HTML代码。如果你生成的是一个项目页面，执行如下命令

````plain
	$ cd repository
	$ git fetch origin
	remote: Counting objects: 92, done.
	remote: Compressing objects: 100% (63/63), done.
	remote: Total 68 (delta 41), reused 0 (delta 0)
	Unpacking objects: 100% (68/68), done.
	From https://github.com/user/repo.git
	 * [new branch]      gh-pages     -> origin/gh-pages
	
	$ git checkout gh-pages
	Branch gh-pages set up to track remote branch gh-pages from origin.
	Switched to a new branch 'gh-pages'
````

如果你生成的是一个用户/组织页面，HTML代码是在`master`分支而不是`gh-pages`分支中，故执行如下命令

````plain
	$ cd repository
	$ git checkout master
	Switched to branch 'master'
	$ git pull origin master
	remote: Counting objects: 92, done.
	remote: Compressing objects: 100% (63/63), done.
	remote: Total 68 (delta 41), reused 0 (delta 0)
	Receiving objects: 100% (424/424), 329.32 KiB | 178 KiB/s, done.
	Resolving deltas: 100% (68/68), done.
	From https://github.com/user/repo.git
	 * branch      master     -> FETCH_HEAD
	Updating abc1234..def5678
	Fast-forward
	index.html                                     |  265 ++++
	...
	98 files changed, 18123 insertions(+), 1 deletion(-)
	create mode 100644 index.html
	...
````

## 手工创建GitHub Pages
如果你对Git命令行比较熟悉的话，可以手工创建一个GitHub Pages，此处以项目页面为例（用户/组织页面的操作类似，不同之处就在于它们是在`master`分支而不是`gh-pages`分支下进行操作），步骤如下：

### 克隆一个全新的仓库
要为项目创建一个GitHub Pages站点，你需要先在仓库中创建一个`orphan`分支（与其他分支没有关联，不共享任何信息的分支），保险起见，你可以先克隆一个全新的仓库，然后在其中进行操作。

````plain
	$ git clone github.com/user/repository.git
	# Clone our repository
	Cloning into 'repository'...
	remote: Counting objects: 2791, done.
	remote: Compressing objects: 100% (1225/1225), done.
	remote: Total 2791 (delta 1722), reused 2513 (delta 1493)
	Receiving objects: 100% (2791/2791), 3.77 MiB | 969 KiB/s, done.
	Resolving deltas: 100% (1722/1722), done.
````

### 创建`gh-pages`分支
克隆了一个全新的仓库以后，就要创建一个名为`gh-pages`的分支，并清空工作目录。

````plain
	$ cd repository
	
	$ git checkout --orphan gh-pages
	# Creates our branch, without any parents (it's an orphan!)
	Switched to a new branch 'gh-pages'
	
	$ git rm -rf .
	# Remove all files from the old working tree
	rm '.gitignore'
````

### 添加内容后推送到GitHub
现在你可以在目录中放入自定义的HTML页面，然后推送到GitHub，比如：

````plain
	$ echo "My Page" > index.html
	$ git add index.html
	$ git commit -a -m "First pages commit"
	$ git push origin gh-pages
````

现在GitHub Pages应该已经创建成功了，可以通过`http(s)://<username>.github.io/<projectname>`访问。如果出现错误的话，会收到来自GitHub的邮件通知。
现在，你已经了解了GitHub Pages的基本工作原理，你可以暂时把它理解为一个静态HTML服务器，你可以把你的HTML和CSS代码放在上面，构建好它们之间的链接关系，这样，一个静态网站就做好了。