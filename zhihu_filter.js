(function () {
    console.log("load zhihu.com ad filter !");

    const originalFetch = window.fetch.bind(window);
    let myParser = {
        enable: false,
    };
    if (window.DOMParser && window.XMLSerializer) {
        myParser.parser = new window.DOMParser();
        myParser.serializer = new window.XMLSerializer();
        myParser.enable = true;
    }

    const wrapNewResponse = function(originalResponse, newBodyData) {
        return new Response(newBodyData, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers: originalResponse.headers,
        });
    }

    const answerContentMCNCardFilter = function(answerItem) {
        let contentDom = myParser.parser.parseFromString(answerItem.content, 'text/html');
        let nodes = contentDom.getElementsByTagName('a');
        [...nodes].forEach(item => {
            if (item.getAttribute('data-mcn-id') || item.getAttribute('data-ad-id')) {
                item.parentNode.removeChild(item);
                console.log("remove card", item.getAttribute('data-mcn-id') || item.getAttribute('data-ad-id'));
            }
            if (item.getAttribute('data-draft-type') === "link-card") {
                item.parentNode.removeChild(item);
            }
        });
        answerItem.content = myParser.serializer.serializeToString(contentDom);
    }

    const answerAttachmentFilter = function(answerItem) {
        if (answerItem.attachment) {
            answerItem.attachment = {};
        }
    }

    const myFetch = async function(...args) {
        let response = await originalFetch(...args);

        // moments api
        if (response.url.includes('api/v3/moments')) {
            const jsonBody = await response.json();

            if (jsonBody.data) {
                let filterdData = jsonBody.data.filter(item => item.type != 'feed_advert');
                jsonBody.data = filterdData;
            }
            
            return wrapNewResponse(response, JSON.stringify(jsonBody));
        }

        // recommend api
        if (response.url.includes('api/v3/feed/topstory/recommend')) {
            const jsonBody = await response.json();

            const unlikeTypes = {
                'zvideo': 'video',
                'article': 'article',
                'question_ask': 'question',
            };

            const filter = item => {
                let isUnlike = item.target.type in unlikeTypes;
                // video is special, answers might contains videos
                if ('zvideo' in unlikeTypes && item.target.play_count > 0) {
                    isUnlike = true;
                }

                if (isUnlike) {
                    console.log('remove', unlikeTypes[item.target.type], item.target.title);
                }
                return !isUnlike;
            }

            let filterd = jsonBody.data.filter(filter);
            //filterd.forEach(item => answerContentMCNCardFilter(item.target));
            jsonBody.data = filterd;

            return wrapNewResponse(response, JSON.stringify(jsonBody));
        }

        // extra ad card api
        if (response.url.includes('api/v4/creators/extra_card')) {
            const jsonBody = await response.json();

            jsonBody.activities = [];
            jsonBody.learning = [];
            jsonBody.new_questions = [];

            return wrapNewResponse(response, JSON.stringify(jsonBody));
        }

        // sku api
        if (response.url.includes('api.zhihu.com/sku/km_resource')) {
            const jsonBody = await response.json();

            jsonBody.data = {};

            return wrapNewResponse(response, JSON.stringify(jsonBody));
        }

        // qa related api
        if (response.url.includes('api/v4/market/rhea') && response.url.includes('qa_related')) {
            const jsonBody = await response.json();

            jsonBody.data = [];
            jsonBody.paging.is_end = true;

            return wrapNewResponse(response, JSON.stringify(jsonBody));
        }

        // answers api
        if (myParser.enable && response.url.includes('api/v4/questions') && response.url.includes('answers')) {
            const jsonBody = await response.json();

            jsonBody.data.forEach(answerContentMCNCardFilter);
            jsonBody.data.forEach(answerAttachmentFilter);

            return wrapNewResponse(response, JSON.stringify(jsonBody));
        }

        // search api
        if (myParser.enable && response.url.includes('api/v4/search_v3')) {
            const jsonBody = await response.json();

            jsonBody.data = jsonBody.data.filter(item => item.type !== "video_box");
            jsonBody.data.filter(item => item.type === "hot_timing").forEach(item => {
                if (item.object && item.object.content_items) {
                    item.object.content_items.forEach(contentItem => {
                        if (contentItem && contentItem.sub_contents) {
                            contentItem.sub_contents.forEach(sub => answerContentMCNCardFilter(sub.object));
                        }
                    });
                }
            });
            jsonBody.data.filter(item => item.type === "search_result").forEach(item => answerContentMCNCardFilter(item.object));

            return wrapNewResponse(response, JSON.stringify(jsonBody));
        }

        // commercial api
        ad_uris = [
            'commercial_api/banners_v3/home_up',
            'commercial_api/banners_v3/pc_top_banner',
            'commercial_api/banners_v3/pc_right_banner',
            'commercial_api/banners_v3/home_bottom',
            'commercial_api/banners_v3/question_up',
            'commercial_api/banners_v3/question_down_sticky',
            'commercial_api/banners_v3/answer_up',
            'commercial_api/banners_v3/answer_down_sticky',
        ]
        for (let i = 0; i < ad_uris.length; i++) {
            if (response.url.includes(ad_uris[i])) {
                return wrapNewResponse(response, JSON.stringify({
                    banner: '',
                }));
            }
        }

        if (response.url.includes('moments/recommend_follow_people')) {
            return wrapNewResponse(response, JSON.stringify({
                data: [],
            }));
        }

        return response;
    }

    window.fetch = myFetch;
    console.log('hook window.fetch done !');
})();
