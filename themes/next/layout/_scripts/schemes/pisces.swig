{%
  set scripts = [
    'affix.js',
    'schemes/pisces.js'
  ]
%}

{% for script in scripts %}
  <script type="text/javascript" src="{{ url_for(theme.js) }}/{{ script }}?v={{ theme.version }}"></script>
{% endfor %}
