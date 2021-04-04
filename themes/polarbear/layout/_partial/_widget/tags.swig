{% if theme.widget.Tags %}
    <section id="tags" class="widget-area widget_tags">
        <h3 class="widget-title">分类</h3>
        {{ list_tags({show_count: true, amount: 100000, orderby: 'count'}) }}
    </section>
{% endif %}
