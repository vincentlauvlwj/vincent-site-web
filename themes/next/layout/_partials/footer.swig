
{% set cc = {'by': 1, 'by-nc': 1, 'by-nc-nd': 1, 'by-nc-sa': 1, 'by-nd': 1, 'by-sa': 1, 'zero': 1} %}
{% if theme.creative_commons.license in cc %}
<div class="cc-license">
  <a href="http://creativecommons.org/licenses/{{ theme.creative_commons.license }}/4.0" class="cc-opacity" target="_blank" 
  		title="{{ theme.creative_commons.notice_text }}">
    <img src="{{ url_for(theme.images) }}/cc-{{ theme.creative_commons.license }}.svg" alt="Creative Commons" />
  </a>
</div>
{% endif %}

<div class="copyright" >
  {% set current = date(Date.now(), "YYYY") %}
  &copy; {% if theme.since and theme.since != current %} {{ theme.since }} - {% endif %}
  <span itemprop="copyrightYear">{{ current }}</span>
  <span class="author" itemprop="copyrightHolder">{{ config.author }}</span>
  <span><a href="http://www.miitbeian.gov.cn/" target="_blank">粤ICP备17040353号</a></span>
</div>

<div>
  Hosted by <a href="https://pages.coding.me" target="_blank" style="font-weight: bold">Coding Pages</a>
</div>

{% block footer %}{% endblock %}
