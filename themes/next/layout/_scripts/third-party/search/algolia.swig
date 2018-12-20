{% if theme.algolia_search.enable %}

  {# S: Include Algolia instantsearch.js library #}
  {% set algolia_instant_css = url_for('vendors/algolia-instant-search/instantsearch.min.css') %}
  {% if theme.vendors.algolia_instant_css %}
    {% set algolia_instant_css = theme.vendors.algolia_instant_css %}
  {% endif %}
  <link rel="stylesheet" href="{{ algolia_instant_css }}">

  {% set algolia_instant_js = url_for('vendors/algolia-instant-search/instantsearch.min.js') %}
  {% if theme.vendors.algolia_instant_js %}
    {% set algolia_instant_js = theme.vendors.algolia_instant_js %}
  {% endif %}
  <script defer src="{{ algolia_instant_js }}"></script>
  {# E: Include Algolia instantsearch.js library #}

  <script async src="{{ url_for(theme.js) }}/algolia-search.js?v={{ theme.version }}"></script>
{% endif %}