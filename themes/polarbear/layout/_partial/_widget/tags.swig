{% if theme.widget.Tags %}
    <section class="widget-area widget_tags">
        <h3 class="widget-title">分类</h3>
        {{ list_tags({show_count: true, amount: 100000, orderby: 'count'}) }}
    </section>
    <section class="widget-area widget_tags">
        <h3 class="widget-title">链接</h3>
        <ul class="tag-list">
        	<li class="tag-list-item">
        		<a class="tag-list-link" href="mailto:me@liuwj.me" title="me@liuwj.me"><i class="iconfont icon-email"></i> Email</a>
        	</li>
        	<li class="tag-list-item">
        		<a class="tag-list-link" href="https://github.com/vincentlauvlwj"><i class="iconfont icon-github"></i> GitHub</a>
        	</li>
        	<li class="tag-list-item">
        		<a class="tag-list-link" href="https://www.zhihu.com/people/liu-wen-jun-57-18"><i class="iconfont icon-zhihu"></i> Zhihu</a>
        	</li>
        	<li class="tag-list-item">
        		<a class="tag-list-link" href="https://www.ktorm.org"><i class="iconfont icon-link"></i> Ktorm</a>
        	</li>
        </ul>
    </section>
    <section class="widget-area">
        <h3 class="widget-title">版权</h3>
    	<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" title="本站作品采用「知识共享署名-非商业性使用-相同方式共享 4.0 国际许可协议 (CC BY-NC-SA 4.0)」进行许可">
    		<img src="/files/cc-by-nc-sa-88x31.png" alt="Creative Commons">
    	</a>
    </section>
    <section class="widget-area widget_feed">
        <h3 class="widget-title">订阅</h3>
    	<a href="/atom.xml">
    		<i class="iconfont icon-rss"></i> RSS
    	</a>
    </section>
{% endif %}
