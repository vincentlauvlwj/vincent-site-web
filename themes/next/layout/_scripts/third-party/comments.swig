{{ comment }}
	{% include './comments/duoshuo.swig' %}
	{% include './comments/disqus.swig' %}
{{ endcomment }}

{% if page.comments %}
	<script type="text/javascript" src="/js/liuwj-comments.js" ></script>
{% endif %}