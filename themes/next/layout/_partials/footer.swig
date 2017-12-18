
{% set cc = {'by': 1, 'by-nc': 1, 'by-nc-nd': 1, 'by-nc-sa': 1, 'by-nd': 1, 'by-sa': 1, 'zero': 1} %}
{% if theme.creative_commons in cc %}
<div class="cc-license">
  <a href="http://creativecommons.org/licenses/{{ theme.creative_commons }}/4.0" class="cc-opacity" target="_blank" 
  		title="本站所有文章除特别声明外，均采用 cc {{ theme.creative_commons }} 4.0 许可协议">
    <img src="{{ url_for(theme.images) }}/cc-{{ theme.creative_commons }}.svg" alt="Creative Commons" />
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
