/* global instantsearch: true */
/*jshint camelcase: false */

$(document).ready(function () {
  var algoliaSettings = CONFIG.algolia;
  var isAlgoliaSettingsValid = algoliaSettings.appId && algoliaSettings.apiKey && algoliaSettings.indexName;

  if (!isAlgoliaSettingsValid) {
    window.console.error('Algolia Settings are invalid.');
    return;
  }

  var search = instantsearch({
    appId: algoliaSettings.appId,
    apiKey: algoliaSettings.apiKey,
    indexName: algoliaSettings.indexName,
    searchFunction: function (helper) {
      var searchInput = $('#algolia-search-input').find('input');

      if (searchInput.val()) {
        helper.search();
      }
    }
  });

  // Registering Widgets
  [
    instantsearch.widgets.searchBox({
      container: '#algolia-search-input',
      placeholder: algoliaSettings.labels.input_placeholder
    }),

    instantsearch.widgets.hits({
      container: '#algolia-hits',
      hitsPerPage: algoliaSettings.hits.per_page || 10,
      templates: {
        item: function (data) {
          var link = CONFIG.root + data.path;
          var title = data._highlightResult.title
          var subtitle = data._highlightResult.subtitle
          if (subtitle) {
            return (
              '<a href="' + link + '" class="algolia-hit-item-link">' +
                title.value + ' - ' + subtitle.value +
              '</a>'
            );
          } else {
            return (
              '<a href="' + link + '" class="algolia-hit-item-link">' +
                title.value +
              '</a>'
            );
          }
        },
        empty: function (data) {
          return (
            '<div id="algolia-hits-empty">' +
              algoliaSettings.labels.hits_empty.replace(/\$\{query}/, data.query) +
            '</div>'
          );
        }
      },
      cssClasses: {
        item: 'algolia-hit-item'
      }
    }),

    instantsearch.widgets.stats({
      container: '#algolia-stats',
      templates: {
        body: function (data) {
          var stats = algoliaSettings.labels.hits_stats
                        .replace(/\$\{hits}/, data.nbHits)
                        .replace(/\$\{time}/, data.processingTimeMS);
          return (
            stats +
            '<span class="algolia-powered">' +
            '  <img src="' + CONFIG.root + 'images/algolia_logo.svg" alt="Algolia" />' +
            '</span>' +
            '<hr />'
          );
        }
      }
    }),

    instantsearch.widgets.pagination({
      container: '#algolia-pagination',
      scrollTo: false,
      showFirstLast: false,
      labels: {
        first: '<i class="fa fa-angle-double-left"></i>',
        last: '<i class="fa fa-angle-double-right"></i>',
        previous: '<i class="fa fa-angle-left"></i>',
        next: '<i class="fa fa-angle-right"></i>'
      },
      cssClasses: {
        root: 'pagination',
        item: 'pagination-item',
        link: 'page-number',
        active: 'current',
        disabled: 'disabled-item'
      }
    })
  ].forEach(search.addWidget, search);

  search.start();

  function togglePopup() {
    var $popup = $('.popup');
    if ($popup.is(':hidden')) {
      $popup.show();

      var overlay = $('<div class="search-popup-overlay algolia-pop-overlay"></div>');
      overlay.click(togglePopup);

      $('body').append(overlay).css('overflow', 'hidden');
      $('#algolia-search-input').find('input').focus();

    } else {
      $popup.hide();

      $('.algolia-pop-overlay').remove();
      $('body').css('overflow', '');
    }
  }

  $('.popup-trigger').on('click', function(e) {
    e.stopPropagation();
    togglePopup();
  });

  $('.popup-btn-close').click(togglePopup);
});