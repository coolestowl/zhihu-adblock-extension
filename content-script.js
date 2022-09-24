(function () {
    // load zhihu ad filter
    const loadScript = function(name) {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(name);
        s.onload = function() {
            s.parentNode.removeChild(s);
        };
        (document.head || document.documentElement).appendChild(s);
    }

    if (document.URL.includes('http://www.zhihu.com') || document.URL.includes('https://www.zhihu.com')) {
        loadScript('zhihu_filter.js');
    }
})();
