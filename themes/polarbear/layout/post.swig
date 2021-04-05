{% extends "_layout.swig" %}
{% import '_macro/post.swig' as post_template %}

{% block title %} {{ page.title }} - {{ config.title }} {% endblock %}

{% block content %}
    <div id="primary">
        {{ post_template.render(page) }}
        {% include "./_partial/comments.swig" %}
    </div>
{% endblock %}
