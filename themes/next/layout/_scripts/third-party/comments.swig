{{ comment }}
	{% include './comments/duoshuo.swig' %}
	{% include './comments/disqus.swig' %}
{{ endcomment }}

{% if page.comments %}
	<script type="text/javascript" src="/js/js.cookie.js" ></script>
	<script type="text/javascript" src="/js/jquery.tmpl.min.js" ></script>
	<script type="text/javascript" src="/js/jquery.textarea-insert.js" ></script>
	<script async type="text/javascript" src="/js/liuwj-comments.js" ></script>
{% endif %}