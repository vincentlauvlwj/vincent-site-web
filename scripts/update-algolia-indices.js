'use strict';

hexo.extend.console.register("update-algolia-indices", "Update Algolia Indices", function(args, callback) {
    var each = require('p-each-series');
    var algoliasearch = require('algoliasearch');
    var crypto = require('crypto');
    var striptags = require('striptags');

    var INDEXED_PROPERTIES = [
        'title',
        'subtitle',
        'date',
        'updated',
        'slug',
        'excerpt',
        'permalink',
        'layout'
    ];

    function computeSha1(text) {
        return crypto.createHash('sha1').update(text, 'utf8').digest('hex');
    }

    function pick(object, properties) {
        return properties.reduce(function(filteredObj, prop) {
            filteredObj[prop] = object[prop];
            return filteredObj;
        }, {});
    }

    function chunk(array, chunkSize) {
        var batches = [];

        while (array.length > 0) {
            batches.push(array.splice(0, chunkSize));
        }

        return batches;
    }

    var hexo = this;
    var client;
    var index;

    Promise.resolve(hexo.config.algolia.apiKey)
        .then(function() {
            if (!hexo.config.algolia.apiKey) {
                hexo.log.error('[hexo-algolia] Please provide an Algolia api key in your hexo _config.yml file.');
                process.exit(1);
            }

            if (!hexo.config.algolia.indexName) {
                hexo.log.error('[hexo-algolia] Please provide an Algolia index name in your hexo _config.yml file.');
                process.exit(1);
            }

            client = algoliasearch(hexo.config.algolia.applicationID, hexo.config.algolia.apiKey);
            index = client.initIndex(hexo.config.algolia.indexName);
        })
        .then(function() {
            hexo.log.info('[hexo-algolia] Testing permissions.');

            return client.getApiKey(hexo.config.algolia.apiKey)
                .catch(function(err) {
                    hexo.log.error('[hexo-algolia] %s', err.message);
                    hexo.log.error('>> You might have used an Admin Key or an invalid Key.');
                    hexo.log.error('>> Read %s for more informations.', 'https://npmjs.com/hexo-algolia#security-concerns');
                    process.exit(1);
                });
        })
        .then(function() {
            return hexo.load();
        })
        .then(function() {
            var posts = hexo.database.model('Post').find({ published: true });
            return posts.toArray();
        })
        // .then(function(publishedPosts) {
        //   var pages = hexo.database.model('Page').find({
        //     layout: {
        //       '$in': ['page']
        //     }
        //   });

        //   return publishedPosts.concat(pages.toArray());
        // })
        .then(function(publishedPagesAndPosts) {
            return publishedPagesAndPosts.map(function(data) {
                var storedPost = pick(data, INDEXED_PROPERTIES);

                storedPost.content = striptags(data.content).substring(0, 2000);
                storedPost.objectID = computeSha1(data.path);
                storedPost.date_as_int = Date.parse(data.date) / 1000;
                storedPost.updated_as_int = Date.parse(data.updated) / 1000;

                if (data.categories) {
                    storedPost.categories = data.categories.map(function(item) {
                        return pick(item, ['name', 'path']);
                    });
                }

                if (data.tags) {
                    storedPost.tags = data.tags.map(function(item) {
                        return pick(item, ['name', 'path']);
                    });
                }

                storedPost.author = data.author || config.author;
                return storedPost;
            });
        })
        .then(function(publishedPagesAndPosts) {
            hexo.log.info('[hexo-algolia] %d pages and posts to index.', publishedPagesAndPosts.length);

            return publishedPagesAndPosts.map(function(post) {
                return {
                    action: 'updateObject',
                    indexName: hexo.config.algolia.indexName,
                    body: post
                };
            });
        })
        .then(function(actions) {
            return Promise.resolve()
                .then(function() {
                    hexo.log.info('[hexo-algolia] Clearing index...');
                    return index.clearIndex();
                })
                .then(function() {
                    var chunks = chunk(actions, 50);

                    return each(chunks, function(chunk, i) {
                        hexo.log.info('[hexo-algolia] Indexing chunk %d of %d (%d items each)', i + 1, chunks.length, 50);

                        return client
                            .batch(chunk)
                            .catch(function(err) {
                                hexo.log.error('[hexo-algolia] %s', err.message);
                            });
                    });
                })
                .then(function() {
                    hexo.log.info('[hexo-algolia] Indexing done.');
                });
        })
        .catch(callback);
});