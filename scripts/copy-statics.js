
hexo.extend.filter.register('after_generate', function() {
	hexo.log.info('Copying static files...');
	var fs = require('hexo-fs');
	fs.copyDir('statics', 'public');
});