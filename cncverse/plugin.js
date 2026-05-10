(function () {
    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // var manifest is injected at runtime

    const BASE_URL = 'https://net52.cc';
    const PLAY_URL = 'https://net52.cc';

    const COMMON_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const MOBILE_COMMON_HEADERS = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Android WebView";v="144"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Android"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 5 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/144.0.7559.132 Safari/537.36 /OS.Gatu v3.0',
        'X-Requested-With': 'XMLHttpRequest'
    };

    const NEW_TV_BASE_HEADERS = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Requested-With': 'NetmirrorNewTV v1.0',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0 /OS.GatuNewTV v1.0',
        'Accept': 'application/json, text/plain, */*'
    };

    const NEW_TV_DOMAINS = [
        'aHR0cHM6Ly9tb2JpbGVkZXRlY3RzLmNvbQ==',
        'aHR0cHM6Ly9tb2JpbGVkZXRlY3QuYXBw',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LmFydA==',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LmNj',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LmNsaWNr',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0Lmluaw==',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LmxpdmU=',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LnBybw==',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LnNob3A=',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LnNpdGU=',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LnNwYWNl',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LnN0b3Jl',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0LnZpcA==',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0Lndpa2k=',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0Lnh5eg==',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0cy5hcnQ=',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0cy5jYw==',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0cy5pbmZv',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0cy5pbms=',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0cy5saXZl',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0cy5wcm8=',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0cy5zdG9yZQ==',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0cy50b3A=',
        'aHR0cHM6Ly9tb2JpZGV0ZWN0cy54eXo='
    ];

    const PROVIDERS = {
        'NETFLIX': {
            id: 'NETFLIX',
            ott: 'nf',
            baseUrl: BASE_URL,
            playUrl: PLAY_URL,
            homePath: '/mobile/home?app=1',
            searchPath: '/search.php',
            postPath: '/post.php',
            episodesPath: '/episodes.php',
            playlistPath: '/playlist.php',
            usePlayHandshake: true,
            includeUserToken: true,
            poster: function (id) { return 'https://imgcdn.kim/poster/v/' + id + '.jpg'; },
            background: function (id) { return 'https://imgcdn.kim/poster/h/' + id + '.jpg'; },
            episodePoster: function (id) { return 'https://imgcdn.kim/epimg/150/' + id + '.jpg'; }
        },
        'PRIME VIDEO': {
            id: 'PRIME VIDEO',
            ott: 'pv',
            baseUrl: PLAY_URL,
            playUrl: PLAY_URL,
            homePath: '/pv/homepage.php',
            searchPath: '/pv/search.php',
            postPath: '/pv/post.php',
            episodesPath: '/pv/episodes.php',
            playlistPath: '/pv/playlist.php',
            usePlayHandshake: true,
            includeUserToken: true,
            poster: function (id) { return 'https://imgcdn.kim/pv/v/' + id + '.jpg'; },
            background: function (id) { return 'https://imgcdn.kim/pv/h/' + id + '.jpg'; },
            episodePoster: function (id) { return 'https://imgcdn.kim/pvepimg/150/' + id + '.jpg'; }
        },
        'HOTSTAR': {
            id: 'HOTSTAR',
            ott: 'hs',
            baseUrl: PLAY_URL,
            playUrl: PLAY_URL,
            homePath: '/mobile/home?app=1',
            searchPath: '/mobile/hs/search.php',
            postPath: '/mobile/hs/post.php',
            episodesPath: '/mobile/hs/episodes.php',
            playlistPath: '/mobile/hs/playlist.php',
            usePlayHandshake: true,
            includeUserToken: true,
            poster: function (id) { return 'https://imgcdn.kim/hs/v/' + id + '.jpg'; },
            background: function (id) { return 'https://imgcdn.kim/hs/h/' + id + '.jpg'; },
            episodePoster: function (id) { return 'https://imgcdn.kim/hsepimg/150/' + id + '.jpg'; }
        },
        'DISNEY PLUS': {
            id: 'DISNEY PLUS',
            ott: 'dp',
            baseUrl: PLAY_URL,
            playUrl: PLAY_URL,
            homePath: '/mobile/home?app=1',
            searchPath: '/mobile/hs/search.php',
            postPath: '/mobile/hs/post.php',
            episodesPath: '/mobile/hs/episodes.php',
            playlistPath: '/mobile/hs/playlist.php',
            usePlayHandshake: true,
            includeUserToken: true,
            poster: function (id) { return 'https://imgcdn.kim/hs/v/' + id + '.jpg'; },
            background: function (id) { return 'https://imgcdn.kim/hs/h/' + id + '.jpg'; },
            episodePoster: function (id) { return 'https://imgcdn.kim/hsepimg/150/' + id + '.jpg'; }
        }
    };

    let cachedCookie = '';
    let lastBypassTime = 0;
    let resolvedNewTvApiUrl = '';

    function clean(v) { return String(v || '').trim(); }
    function parseJsonSafe(text, fb) { try { return JSON.parse(text); } catch (_) { return fb; } }
    function unixTs() { return Math.floor(Date.now() / 1000); }

    function cfg() {
        const pid = clean((manifest && manifest.providerId) || '').toUpperCase();
        return PROVIDERS[pid] || PROVIDERS['NETFLIX'];
    }

    function providerHeaders(provider) {
        const pid = clean(provider && provider.id).toUpperCase();
        return (pid === 'HOTSTAR' || pid === 'DISNEY PLUS' || pid === 'NETFLIX') ? MOBILE_COMMON_HEADERS : COMMON_HEADERS;
    }

    function proxiedImage(url) {
        if (!url) return '';
        return 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=500';
    }

    function parseSetCookie(raw) {
        let txt = raw;
        if (Array.isArray(txt)) txt = txt.join('; ');
        txt = clean(txt);
        if (!txt) return '';
        const m = txt.match(/t_hash_t=([^;]+)/i);
        return m && m[1] ? decodeURIComponent(m[1]) : '';
    }

    function decodeBase64(value) {
        if (typeof atob === 'function') return atob(value);
        if (typeof Buffer !== 'undefined') return Buffer.from(value, 'base64').toString('utf-8');
        return '';
    }

    function buildNewTvHeaders(ott, extra) {
        const headers = Object.assign({}, NEW_TV_BASE_HEADERS, { Ott: ott });
        if (extra) {
            Object.keys(extra).forEach(function (key) {
                headers[key] = extra[key];
            });
        }
        return headers;
    }

    async function resolveNewTvApiUrl() {
        if (resolvedNewTvApiUrl) return resolvedNewTvApiUrl;
        for (let i = 0; i < NEW_TV_DOMAINS.length; i++) {
            const base = decodeBase64(NEW_TV_DOMAINS[i]).replace(/\/+$/, '');
            if (!base) continue;
            try {
                const res = await http_get(base + '/checknewtv.php', NEW_TV_BASE_HEADERS);
                const data = parseJsonSafe(res.body, {});
                const tokenHash = clean(data.token_hash);
                if (tokenHash) {
                    resolvedNewTvApiUrl = decodeBase64(tokenHash).replace(/\/+$/, '');
                    if (resolvedNewTvApiUrl) return resolvedNewTvApiUrl;
                }
            } catch (_) {
                // Try next domain.
            }
        }
        throw new Error('Failed to resolve NewTV API base URL');
    }

    function randomUuid() {
        if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async function bypass(provider) {
        if (cachedCookie && Date.now() - lastBypassTime < 54 * 60 * 60 * 1000) return cachedCookie;
        try {
            const headers = {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'max-age=0',
                'Connection': 'keep-alive',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': BASE_URL,
                'Referer': BASE_URL + '/verify2',
                'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
            };
            const body = 'g-recaptcha-response=' + encodeURIComponent(randomUuid());
            const res = await http_post(BASE_URL + '/verify.php', Object.assign({ redirect: 'manual' }, headers), body);
            const hash = parseSetCookie((res && res.headers && (res.headers['set-cookie'] || res.headers['Set-Cookie'])) || '');
            if (!hash) throw new Error('Failed to bypass authentication');
            cachedCookie = hash;
            lastBypassTime = Date.now();
            return cachedCookie;
        } catch (e) {
            cachedCookie = '';
            lastBypassTime = 0;
            throw e;
        }
    }

    async function cookieString(provider) {
        const hash = await bypass(provider);
        const parts = ['t_hash_t=' + hash, 'ott=' + provider.ott, 'hd=on'];
        if (provider.includeUserToken) parts.push('user_token=233123f803cf02184bf6c67e149cdd50');
        return parts.join('; ');
    }

    function parseNetflixRows(html, provider) {
        const sections = {};
        const rowRegex = /<div[^>]*class="[^"]*lolomoRow[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*lolomoRow[^"]*"[^>]*>|$)/g;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(html)) !== null) {
            const rowHtml = rowMatch[1];
            let title = 'Trending';
            const titleMatch = rowHtml.match(/<div class="row-header-title">([\s\S]*?)<\/div>/) || rowHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
            if (titleMatch) title = clean(titleMatch[1].replace(/<[^>]*>/g, '')) || 'Trending';

            const items = [];
            const seen = {};
            const imgRegex = /<img[^>]*class="[^"]*lazy[^"]*"[^>]*data-src="([^"]+)"/g;
            let imgMatch;
            while ((imgMatch = imgRegex.exec(rowHtml)) !== null) {
                const imgSrc = imgMatch[1];
                const id = clean(imgSrc).split('/').pop().split('.')[0];
                if (!id || seen[id]) continue;
                seen[id] = true;
                items.push(new MultimediaItem({
                    title: ' ',
                    url: JSON.stringify({ provider: provider.id, id: id }),
                    posterUrl: proxiedImage(provider.poster(id)),
                    type: 'movie'
                }));
            }
            if (items.length > 0) sections[title] = items;
        }
        return sections;
    }

    function parseTrayRows(html, provider) {
        const sections = {};
        const globalRegex = /<(h2|span|div|p)[^>]*class="[^"]*(tray-title|mobile-tray-title|title|tray-title-container)[^"]*"[^>]*>([\s\S]*?)<\/\1>|data-post="([^"]+)"/ig;

        let currentTitle = 'Trending';
        let gMatch;
        while ((gMatch = globalRegex.exec(html)) !== null) {
            if (gMatch[3]) {
                const titleText = clean(gMatch[3].replace(/<[^>]*>/g, ''));
                if (titleText && titleText.length > 2 && titleText.length < 50 && titleText.indexOf('{') === -1) {
                    currentTitle = titleText;
                }
            } else if (gMatch[4]) {
                const id = clean(gMatch[4]);
                if (!id || id.indexOf("'") >= 0 || id.indexOf('+') >= 0) continue;
                if (!sections[currentTitle]) sections[currentTitle] = [];
                if (!sections[currentTitle].some(function (it) {
                    const parsed = parseJsonSafe(it.url, {});
                    return parsed && parsed.id === id;
                })) {
                    sections[currentTitle].push(new MultimediaItem({
                        title: ' ',
                        url: JSON.stringify({ provider: provider.id, id: id }),
                        posterUrl: proxiedImage(provider.poster(id)),
                        type: 'movie'
                    }));
                }
            }
        }
        return sections;
    }

    async function fetchPagedEpisodes(provider, seriesId, seasonId, page, episodes, cookieStr) {
        let pg = page;
        while (true) {
            try {
                const epUrl = provider.baseUrl + provider.episodesPath + '?s=' + encodeURIComponent(seasonId) + '&series=' + encodeURIComponent(seriesId) + '&t=' + unixTs() + '&page=' + pg;
                const res = await http_get(epUrl, Object.assign({}, providerHeaders(provider), { Cookie: cookieStr }));
                const data = parseJsonSafe(res.body, {});
                (Array.isArray(data.episodes) ? data.episodes : []).forEach(function (ep) {
                    episodes.push(new Episode({
                        name: clean(ep.t) || 'Episode',
                        season: parseInt(String(ep.s || '').replace('S', ''), 10) || 1,
                        episode: parseInt(String(ep.ep || '').replace('E', ''), 10) || 1,
                        url: JSON.stringify({ provider: provider.id, kind: 'play', id: clean(ep.id), title: clean(ep.t) || 'Episode' }),
                        posterUrl: proxiedImage(provider.episodePoster(clean(ep.id)))
                    }));
                });
                if (Number(data.nextPageShow || 0) === 0) break;
                pg++;
            } catch (_) {
                break;
            }
        }
    }

    async function getHome(cb) {
        try {
            const provider = cfg();
            const cookieStr = await cookieString(provider);
            const headers = Object.assign({}, providerHeaders(provider), {
                Referer: (provider.baseUrl + '/mobile/home?app=1'),
                Cookie: cookieStr,
                'X-Requested-With': 'XMLHttpRequest'
            });

            if (provider.id === 'PRIME VIDEO') {
                const primeHeaders = Object.assign({}, headers, { Referer: BASE_URL + '/home' });
                const res = await http_get(provider.baseUrl + provider.homePath, primeHeaders);
                const root = parseJsonSafe(res.body, {});
                const out = {};
                (Array.isArray(root.post) ? root.post : []).forEach(function (group) {
                    const name = clean(group.cate) || 'Trending';
                    const ids = clean(group.ids).split(',').map(clean).filter(Boolean);
                    if (!ids.length) return;
                    out[name] = ids.map(function (id) {
                        return new MultimediaItem({
                            title: ' ',
                            url: JSON.stringify({ provider: provider.id, id: id }),
                            posterUrl: provider.poster(id),
                            type: 'movie'
                        });
                    });
                });
                return cb({ success: true, data: out });
            }

            const res = await http_get(provider.baseUrl + provider.homePath, headers);
            const html = String(res.body || '');
            const data = parseTrayRows(html, provider);
            cb({ success: true, data: data });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: String(e && e.message || e) });
        }
    }

    async function search(query, cb) {
        try {
            const provider = cfg();
            const cookieStr = await cookieString(provider);
            const url = provider.baseUrl + provider.searchPath + '?s=' + encodeURIComponent(query) + '&t=' + unixTs();
            const referer = provider.id === 'NETFLIX' ? provider.baseUrl + '/tv/home' : BASE_URL + '/home';
            const res = await http_get(url, Object.assign({}, providerHeaders(provider), { Referer: referer, Cookie: cookieStr }));
            const data = parseJsonSafe(res.body, {});
            const list = (data.searchResult || []).map(function (item) {
                return new MultimediaItem({
                    title: clean(item.t) || 'Title',
                    url: JSON.stringify({ provider: provider.id, id: clean(item.id) }),
                    posterUrl: proxiedImage(provider.poster(clean(item.id))),
                    type: 'movie'
                });
            });
            cb({ success: true, data: list });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: String(e && e.message || e) });
        }
    }

    async function load(urlData, cb) {
        try {
            const payload = parseJsonSafe(urlData, null);
            if (!payload || !payload.id) return cb({ success: false, errorCode: 'PARSE_ERROR', message: 'Invalid payload' });

            const provider = PROVIDERS[clean(payload.provider).toUpperCase()] || cfg();
            const cookieStr = await cookieString(provider);
            const postUrl = provider.baseUrl + provider.postPath + '?id=' + encodeURIComponent(payload.id) + '&t=' + unixTs();
            const referer = BASE_URL + '/tv/home';
            const res = await http_get(postUrl, Object.assign({}, providerHeaders(provider), { Referer: referer, Cookie: cookieStr }));
            const data = parseJsonSafe(res.body, {});

            const episodes = [];
            if (Array.isArray(data.episodes) && data.episodes.length > 0 && data.episodes[0]) {
                data.episodes.forEach(function (ep) {
                    episodes.push(new Episode({
                        name: clean(ep.t) || 'Episode',
                        season: parseInt(String(ep.s || '').replace('S', ''), 10) || 1,
                        episode: parseInt(String(ep.ep || '').replace('E', ''), 10) || 1,
                        url: JSON.stringify({ provider: provider.id, kind: 'play', id: clean(ep.id), title: clean(ep.t) || clean(data.title) || 'Title' }),
                        posterUrl: proxiedImage(provider.episodePoster(clean(ep.id)))
                    }));
                });
                if (Number(data.nextPageShow || 0) === 1 && data.nextPageSeason) {
                    await fetchPagedEpisodes(provider, payload.id, data.nextPageSeason, 2, episodes, cookieStr);
                }
                if (Array.isArray(data.season) && data.season.length > 1) {
                    for (let i = 0; i < data.season.length - 1; i++) {
                        if (data.season[i] && data.season[i].id) {
                            await fetchPagedEpisodes(provider, payload.id, data.season[i].id, 1, episodes, cookieStr);
                        }
                    }
                }
            } else {
                episodes.push(new Episode({
                    name: clean(data.title) || 'Watch',
                    season: 1,
                    episode: 1,
                    url: JSON.stringify({ provider: provider.id, kind: 'play', id: payload.id, title: clean(data.title) || 'Watch' }),
                    posterUrl: proxiedImage(provider.poster(payload.id))
                }));
            }

            cb({
                success: true,
                data: new MultimediaItem({
                    title: clean(data.title) || 'Title',
                    url: JSON.stringify({ provider: provider.id, id: payload.id }),
                    posterUrl: proxiedImage(provider.poster(payload.id)),
                    backgroundPosterUrl: proxiedImage(provider.background(payload.id)),
                    description: clean(data.desc),
                    type: episodes.length > 1 ? 'tvseries' : 'movie',
                    year: parseInt(data.year, 10) || undefined,
                    episodes: episodes
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e && e.message || e) });
        }
    }

    async function loadPrimeStreams(provider, payload) {
        const cookieStr = await cookieString(provider);
        const playlistUrl = provider.baseUrl + provider.playlistPath + '?id=' + encodeURIComponent(payload.id) + '&t=' + encodeURIComponent(payload.title || '') + '&tm=' + unixTs();
        const res = await http_get(playlistUrl, Object.assign({}, COMMON_HEADERS, { Referer: provider.baseUrl + '/home', Cookie: cookieStr, 'X-Requested-With': 'XMLHttpRequest' }));
        const playlist = parseJsonSafe(res.body, []);
        const out = [];
        (Array.isArray(playlist) ? playlist : []).forEach(function (item) {
            (Array.isArray(item.sources) ? item.sources : []).forEach(function (src, i) {
                let fullUrl = String(src.file || '').replace('/tv/', '/');
                if (!/^https?:\/\//i.test(fullUrl)) {
                    if (!fullUrl.startsWith('/')) fullUrl = '/' + fullUrl;
                    fullUrl = provider.playUrl + fullUrl;
                }
                out.push(new StreamResult({
                    url: fullUrl,
                    source: 'PrimeVideo [' + (clean(src.label) || ('S' + (i + 1))) + ']',
                    type: 'hls',
                    headers: {
                        Referer: provider.playUrl + '/',
                        Cookie: cookieStr,
                        'User-Agent': COMMON_HEADERS['User-Agent']
                    }
                }));
            });
        });
        return out;
    }

    async function loadMobilePlaylistStreams(provider, payload, playlistPath, ottOverride) {
        const hash = await bypass(provider);
        const ott = ottOverride || provider.ott;
        const cookieStr = 't_hash_t=' + hash + '; ott=' + ott + '; hd=on';
        const baseUrl = provider.playUrl;
        const playlistUrl = baseUrl + playlistPath + '?id=' + encodeURIComponent(payload.id) + '&t=' + encodeURIComponent(payload.title || '') + '&tm=' + unixTs();
        const res = await http_get(playlistUrl, Object.assign({}, providerHeaders(provider), {
            Referer: baseUrl + '/home',
            Cookie: cookieStr
        }));
        const playlist = parseJsonSafe(res.body, []);
        const out = [];

        (Array.isArray(playlist) ? playlist : []).forEach(function (item) {
            (Array.isArray(item.sources) ? item.sources : []).forEach(function (src, i) {
                const rawFile = clean(src.file);
                if (!rawFile) return;
                const finalUrl = baseUrl + '/' + rawFile.replace(/^\/+/, '');
                out.push(new StreamResult({
                    url: finalUrl,
                    source: clean(src.label) || ('Server ' + (i + 1)),
                    type: 'hls',
                    headers: {
                        Referer: baseUrl + '/home',
                        Cookie: cookieStr,
                        'User-Agent': (providerHeaders(provider) || {})['User-Agent'] || COMMON_HEADERS['User-Agent']
                    }
                }));
            });
        });

        return out;
    }

    async function loadUnifiedTvStream(provider, payload) {
        const apiBase = await resolveNewTvApiUrl();
        const ott = (provider.id === 'HOTSTAR' || provider.id === 'DISNEY PLUS') ? 'hs' : provider.ott;
        const apiHeaders = buildNewTvHeaders(ott, { Usertoken: '' });
        const res = await http_get(apiBase + '/newtv/player.php?id=' + payload.id, apiHeaders);
        const data = parseJsonSafe(res.body, {});
        if (!data.video_link) return [];

        // Streaming headers must be minimal — the API headers above include
        // Accept: application/json and Cache-Control: no-cache, which break
        // HLS segment fetches. We also wrap the CDN URL in MAGIC_PROXY_v2 so
        // the local proxy injects these headers on every segment request and
        // can normalize the CDN's broken Range-with-gzip responses.
        const streamHeaders = {
            'User-Agent': NEW_TV_BASE_HEADERS['User-Agent'],
            'Ott': ott
        };
        const proxyConfig = JSON.stringify({ url: data.video_link, headers: streamHeaders });
        const proxyUrl = 'MAGIC_PROXY_v2' + btoa(proxyConfig);

        return [new StreamResult({
            url: proxyUrl,
            source: provider.id + ' [NetMirror]',
            type: 'hls',
            headers: streamHeaders
        })];
    }

    async function loadStreams(dataStr, cb) {
        try {
            const payload = parseJsonSafe(dataStr, null);
            if (!payload || !payload.id) return cb({ success: false, errorCode: 'PARSE_ERROR', message: 'Invalid stream payload' });
            const provider = PROVIDERS[clean(payload.provider).toUpperCase()] || cfg();

            let results = [];
            try {
                results = await loadUnifiedTvStream(provider, payload);
            } catch (_) {
                results = [];
            }

            if (!results.length) {
                if (provider.id === 'HOTSTAR' || provider.id === 'DISNEY PLUS') {
                    results = await loadMobilePlaylistStreams(provider, payload, '/mobile/hs/playlist.php', 'hs');
                } else if (provider.id === 'NETFLIX') {
                    results = await loadMobilePlaylistStreams(provider, payload, '/mobile/playlist.php');
                } else {
                    results = await loadPrimeStreams(provider, payload);
                }
            }
            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: 'STREAM_ERROR', message: String(e && e.message || e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
