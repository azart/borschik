var INHERIT = require('inherit'),
    base = require('../tech.js'),

    stringRe = "(?:(?:'[^'\\r\\n]*')|(?:\"[^\"\\r\\n]*\"))",
    urlRe = "(?:(?:url\\(\\s*" + stringRe + "\\s*\\))|(?:url\\(\\s*[^\\s\\r\\n'\"]*\\s*\\)))",
    commentRe = '(?:/\\*[^*]*\\*+(?:[^/][^*]*\\*+)*/)',
    importRe = '(?:\\@import\\s+(' + urlRe + '|' + stringRe + '))',
    allRe = new RegExp(commentRe + '|' + importRe + '|' + urlRe, 'g'),
    urlStringRx = new RegExp('^' + urlRe + '$');

exports.Tech = INHERIT(base.Tech, {

    File: INHERIT(base.File, {

        parseInclude: function(content) {
            var m, found = [];

            if (Buffer.isBuffer(content)) content = content.toString('utf8');

            while (m = allRe.exec(content)) {
                if (m[0].lastIndexOf('/*', 0) === 0) {
                    // skip comment
                } else if (m[0].charAt(0) === '@') {
                    // @import
                    var url = parseUrl(m[1]);
                    if (isRelative(url)) found.push({ type: 'include', url: url, range: [ m.index, allRe.lastIndex ] });
                } else if (urlStringRx.test(m[0])) {
                    // url(...)
                    var url = parseUrl(m[0]);
                    if (isRelative(url)) found.push({ type: 'link', url: url, range: [ m.index, allRe.lastIndex-1 ] });
                } else {
                    throw new Error('Failed to match: ' + m[0]);
                }
            }

            return makeParsed(found, content);
        },

        processInclude: function(path, content) {
            var parsed = content || this.content;

            for(var i = 0; i < parsed.length; i++) {
                var item = parsed[i];

                if (typeof item === 'string') continue;

                if (item.type === 'include') {
                    parsed[i] = '/* ' + item.url + ' begin */\n' +
                        this.child('include', item.url).process(path) +
                        '\n/* ' + item.url + ' end */\n';

                    continue;
                }

                parsed[i] = this.child('link', item.url).process(path);
            }

            return parsed.join('');
        },

        processLink: function(path) {
            return 'url(' + this.pathFrom(path) + ')';
        }

    })
});

function parseUrl(url) {
    if (url.lastIndexOf('url(', 0) === 0) url = url.replace(/^url\(\s*/, '').replace(/\s*\)$/, '');

    if (url.charAt(0) === '\'' || url.charAt(0) === '"') url = url.substr(1, url.length - 2);

    return url;
}

function isRelative(url) {
    return !((url.lastIndexOf('/', 0) === 0) || /^\w+:/.test(url));
}

function makeParsed(items, content) {
    var result = [],
        lastInd = 0;

    items.forEach(function(item) {
        if (lastInd > item.range[0]) throw 'index out of range';

        if (lastInd < item.range[0]) result.push(content.substring(lastInd, item.range[0]));

        result.push(item);
        lastInd = item.range[1] + 1;
    });

    if (lastInd < content.length) result.push(content.substring(lastInd));

    return result;
}
