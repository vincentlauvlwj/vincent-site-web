{{ comment }}
	{% include './comments/duoshuo.swig' %}
	{% include './comments/disqus.swig' %}
{{ endcomment }}

{% if page.comments %}
	<script type="text/javascript" src="http://ajax.microsoft.com/ajax/jquery.templates/beta1/jquery.tmpl.min.js" ></script>
	<script type="text/javascript" src="/js/textarea-insert.js" ></script>
	<script type="text/javascript" src="/js/liuwj-comments.js" ></script>
{% endif %}