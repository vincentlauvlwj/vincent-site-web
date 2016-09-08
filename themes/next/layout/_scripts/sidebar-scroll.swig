{% if not page.disable_sidebar_scroll %}
	<script type="text/javascript" src="{{ url_for(theme.js) }}/scrollspy.js?v={{ theme.version }}"></script>
	<script type="text/javascript" src="{{ url_for(theme.js) }}/sidebar-scroll.js?v={{ theme.version }}"></script>
{% endif %}
