{% if theme.widget.Categories %}
    <section class="widget-area widget_categories">
        <h3 class="widget-title">Categories</h3>
        {{ list_categories({show_count: true}) }}
    </section>
{% endif %}
