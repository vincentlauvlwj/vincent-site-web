{% include "_comments/duoshou.swig" %}
{% include "_comments/disqus.swig" %}

{% if page.comments and not is_home() %}
	<script type="text/javascript" src="/lib/jquery/jquery.tmpl.min.js" ></script>
	<script type="text/javascript" src="/lib/jquery/jquery.textarea-insert.js" ></script>
	<script type="text/javascript" src="/js/src/liuwj-comments.js" ></script>
{% endif %}