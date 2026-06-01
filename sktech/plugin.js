(function () {
    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // var manifest is injected at runtime

    const SKTECH_FIREBASE_API_KEY = '__SKTECH_FIREBASE_API_KEY__';
    const SKTECH_FIREBASE_APP_ID = '__SKTECH_FIREBASE_APP_ID__';
    const SKTECH_FIREBASE_PROJECT_NUMBER = '__SKTECH_FIREBASE_PROJECT_NUMBER__';
    const SKLIVE_V23_KEY = '__SKLIVE_V23_KEY__';
    const SKLIVE_V23_IV = '__SKLIVE_V23_IV__';
    const SKLIVE_KEY = '__SKLIVE_KEY__';
    const SKLIVE_IV = '__SKLIVE_IV__';
    const DEFAULT_WEB_URL = 'https://welalagaa.site';
    const REMOTE_PACKAGE_NAME = 'com.live.sktechtv';

    const HEADERS = {
        "accept": "*/*",
        "Cache-Control": "no-cache, no-store",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0",
    };
    const LOOKUP_TABLE_D = "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000B\u000C\r\u000E\u000F" +
        "\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001A\u001B\u001C\u001D\u001E\u001F" +
        " !\"#$%&'()*+,-./" +
        "0123456789:;<=>?" +
        "@EGMNKABUVCDYHLI" +
        "FPOZQSRWTXJ[\\]^_" +
        "`egmnkabuvcdyhli" +
        "fpozqsrwtxj{|}~\u007F";

    let cachedBaseUrl = null;
    let cachedProviderCatLink = null;

    // ── Tiny helpers ────────────────────────────────────────────────────────────
    function clean(s) { return String(s || '').trim(); }
    function parseJsonSafe(s, fb) { try { return JSON.parse(s); } catch (_) { return fb; } }

    function hexToBytes(hex) {
        const s = clean(hex).replace(/-/g, '').toLowerCase();
        if (!/^[0-9a-f]+$/.test(s) || s.length % 2 !== 0) return null;
        const out = [];
        for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2), 16));
        return out;
    }
    function bytesToRaw(bytes) { return bytes.map(b => String.fromCharCode(b & 255)).join(''); }
    function bytesToB64(bytes) { return btoa(bytesToRaw(bytes)); }
    // Encode a raw UTF-8 string as base64 (for V23 key/iv which are plain strings)
    function strToB64(str) { return btoa(unescape(encodeURIComponent(str))); }

    function base64ToHex(str) {
        if (!str) return null;
        try {
            const s = clean(str).replace(/-/g, '+').replace(/_/g, '/');
            const p = s + '='.repeat((4 - s.length % 4) % 4);
            const raw = atob(p);
            let hex = '';
            for (let i = 0; i < raw.length; i++) {
                const h = raw.charCodeAt(i).toString(16);
                hex += h.length === 2 ? h : '0' + h;
            }
            return hex.toLowerCase();
        } catch (_) { return null; }
    }

    function normalizeDrmHex(v) {
        const s = clean(v);
        if (!s || s.toLowerCase() === 'null') return null;
        const hex = s.replace(/-/g, '');
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) return hex.toLowerCase();
        return base64ToHex(s);
    }

    function hexToBase64Url(hex) {
        if (!hex) return null;
        try {
            let raw = '';
            for (let i = 0; i < hex.length; i += 2)
                raw += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
            return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        } catch (_) { return null; }
    }

    async function decryptV23(encrypted) {
        const key = clean(SKLIVE_V23_KEY);
        const iv = clean(SKLIVE_V23_IV);
        if (!key || !iv) return null;
        try {
            const padded = encrypted.length % 4 ? encrypted + '='.repeat(4 - encrypted.length % 4) : encrypted;
            // Step 1: base64-decode → inner bytes
            const rawInner = atob(padded);
            const inner = [];
            for (let i = 0; i < rawInner.length; i++) inner.push(rawInner.charCodeAt(i) & 255);
            // Step 2: swap adjacent pairs
            for (let i = 0; i < inner.length - 1; i += 2) {
                const t = inner[i]; inner[i] = inner[i + 1]; inner[i + 1] = t;
            }
            // Step 3: reverse byte array
            inner.reverse();
            // Step 4: bytes → ASCII chars → base64-decode those chars → ciphertext bytes
            // inner bytes are now valid base64 ASCII codes; form the base64 string and decode
            const b64str = inner.map(b => String.fromCharCode(b)).join('');
            const cipherRaw = atob(b64str);
            const cipherB64 = btoa(cipherRaw); // re-encode to pass to crypto API
            // Step 5: AES/CBC decrypt — V23 key/iv are raw UTF-8 strings → strToB64
            return await crypto.decryptAES(cipherB64, strToB64(key), strToB64(iv), { mode: 'cbc' }).catch(() => null);
        } catch (_) { return null; }
    }

    async function decryptLegacy(encrypted) {
        const keyHex = clean(SKLIVE_KEY);
        const ivHex = clean(SKLIVE_IV);
        if (!keyHex || !ivHex) return null;
        const keyBytes = hexToBytes(keyHex);
        const ivBytes = hexToBytes(ivHex);
        if (!keyBytes || !ivBytes) return null;
        try {
            // Step 1: custom alphabet → standard base64
            let standard = '';
            for (let i = 0; i < encrypted.length; i++) {
                const code = encrypted.charCodeAt(i);
                standard += code < LOOKUP_TABLE_D.length ? LOOKUP_TABLE_D.charAt(code) : encrypted.charAt(i);
            }
            // Step 2: base64-decode → raw string
            const decoded = atob(standard);
            // Step 3: reverse the raw string
            const reversed = decoded.split('').reverse().join('');
            // Step 4: base64-decode the reversed string → ciphertext
            const cipher = atob(reversed);
            if (cipher.length % 16 !== 0) return null; // must be AES block-aligned
            const cipherB64 = btoa(cipher);
            // Step 5: AES/CBC decrypt
            return await crypto.decryptAES(cipherB64, bytesToB64(keyBytes), bytesToB64(ivBytes), { mode: 'cbc' }).catch(() => null);
        } catch (_) { return null; }
    }

    async function decryptSKLive(content) {
        const text = clean(content);
        if (!text) return '';
        if (text.startsWith('{') || text.startsWith('[') ||
            text.startsWith('#EXTM3U') || text.startsWith('#EXTINF') || text.startsWith('#KODIPROP')) {
            return text;
        }
        // V23 first (newer), then legacy
        const v23 = await decryptV23(text);
        if (typeof v23 === 'string' && v23 &&
            (v23.startsWith('{') || v23.startsWith('[') || v23.includes('#EXTM3U') || v23.includes('#EXTINF'))) {
            return v23;
        }
        const legacy = await decryptLegacy(text);
        if (typeof legacy === 'string' && legacy &&
            (legacy.startsWith('{') || legacy.startsWith('[') || legacy.includes('#EXTM3U') || legacy.includes('#EXTINF'))) {
            return legacy;
        }
        return text;
    }

    // ── Firebase Remote Config ──────────────────────────────────────────────────
    async function fetchRemoteEntries(packageName, apiKey, appId, projectNumber) {
        if (!apiKey || !appId || !projectNumber) return null;
        const url = 'https://firebaseremoteconfig.googleapis.com/v1/projects/' + projectNumber + '/namespaces/firebase:fetch';
        const appInstanceId = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
        const body = JSON.stringify({
            appInstanceId, appInstanceIdToken: '', appId,
            countryCode: 'US', languageCode: 'en-US', platformVersion: '30',
            timeZone: 'UTC', appVersion: '5.0', appBuild: '50',
            packageName, sdkVersion: '22.1.0', analyticsUserProperties: {}
        });
        try {
            const res = await http_post(url, {
                'Content-Type': 'application/json', 'Accept': 'application/json',
                'X-Android-Package': packageName, 'X-Goog-Api-Key': apiKey,
                'X-Google-GFE-Can-Retry': 'yes'
            }, body);
            const parsed = parseJsonSafe(res.body, {});
            return parsed && parsed.entries ? parsed.entries : null;
        } catch (_) { return null; }
    }

    async function getBaseUrl() {
        if (cachedBaseUrl) return cachedBaseUrl;
        const entries = await fetchRemoteEntries(
            REMOTE_PACKAGE_NAME, clean(SKTECH_FIREBASE_API_KEY),
            clean(SKTECH_FIREBASE_APP_ID), clean(SKTECH_FIREBASE_PROJECT_NUMBER)
        );
        const remote = entries && entries.api_url ? clean(entries.api_url).replace(/\/+$/, '') : '';
        cachedBaseUrl = remote || clean(manifest.baseUrl || DEFAULT_WEB_URL).replace(/\/+$/, '') || DEFAULT_WEB_URL;
        return cachedBaseUrl;
    }

    // ── M3U Parser ──────────────────────────────────────────────────────────────
    // Stores DRM keys as hex; hexToBase64Url called at stream-time (piratestv pattern).
    function parseM3U(content) {
        const lines = String(content || '').split(/\r?\n/);
        const channels = [];
        let cur = null;
        let pending = { headers: {}, userAgent: '', cookie: '', keyHex: '', kidHex: '', licenseUrl: '', drmKeys: {} };

        function resetPending() {
            pending = { headers: {}, userAgent: '', cookie: '', keyHex: '', kidHex: '', licenseUrl: '', drmKeys: {} };
        }

        lines.forEach(function (raw) {
            const line = raw.trim(); if (!line) return;

            if (line.startsWith('#EXTINF')) {
                // Use last-comma-outside-quotes for title (piratestv/cricify reference pattern)
                let title = 'Unknown', lastComma = -1, inQ = false;
                for (let i = 0; i < line.length; i++) {
                    if (line[i] === '"') inQ = !inQ;
                    else if (line[i] === ',' && !inQ) lastComma = i;
                }
                // Extract key/kid attributes from EXTINF when providers inline DRM metadata.
                let keyAttr = null, kidAttr = null;
                const attrPart = lastComma !== -1 ? line.substring(0, lastComma) : line;
                const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|([^\s,]+))/g;
                let match;
                while ((match = attrRegex.exec(attrPart)) !== null) {
                    const k = match[1].toLowerCase();
                    const v = match[2] || match[3] || '';
                    if (k === 'key' || k === 'drm-key') keyAttr = v;
                    if (k === 'keyid' || k === 'drm-keyid' || k === 'kid') kidAttr = v;
                }
                if (lastComma !== -1) title = line.substring(lastComma + 1).trim().replace(/^"|"$/g, '');
                const g = line.match(/group-title="([^"]*)"/);
                const l = line.match(/tvg-logo="([^"]*)"/);
                cur = {
                    title, group: g ? g[1] : 'Uncategorized', poster: l ? l[1] : '',
                    headers: Object.assign({}, pending.headers),
                    userAgent: pending.userAgent, cookie: pending.cookie,
                    keyHex: pending.keyHex || (keyAttr ? normalizeDrmHex(keyAttr) : ''),
                    kidHex: pending.kidHex || (kidAttr ? normalizeDrmHex(kidAttr) : ''),
                    licenseUrl: pending.licenseUrl, drmKeys: Object.assign({}, pending.drmKeys)
                };
                resetPending();
                return;
            }

            if (line.startsWith('#EXTHTTP:')) {
                const o = parseJsonSafe(line.replace(/^#EXTHTTP:/i, ''), {});
                const tgt = cur || pending;
                if (o.cookie) tgt.cookie = o.cookie;
                if (o['user-agent']) tgt.userAgent = o['user-agent'];
                return;
            }

            if (line.startsWith('#EXTVLCOPT:')) {
                const ua = line.match(/http-user-agent=(.*)$/i);
                const rf = line.match(/http-referrer=(.*)$/i) || line.match(/http-referer=(.*)$/i);
                const tgt = cur || pending;
                if (ua && ua[1]) tgt.userAgent = ua[1].replace(/"/g, '').trim();
                if (rf && rf[1]) (cur ? cur.headers : pending.headers)['Referer'] = rf[1].replace(/"/g, '').trim();
                return;
            }

            if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                const v = line.replace(/^#KODIPROP:inputstream\.adaptive\.license_key=/i, '').trim();
                const tgt = cur || pending;
                if (/^https?:\/\//i.test(v)) {
                    tgt.licenseUrl = v;
                } else if (v.startsWith('{')) {
                    const j = parseJsonSafe(v, {}), keys = Array.isArray(j.keys) ? j.keys : [];
                    keys.forEach(function (k) {
                        const kidHex = normalizeDrmHex(k && k.kid);
                        const keyHex = normalizeDrmHex(k && k.k);
                        if (kidHex && keyHex) {
                            tgt.drmKeys[kidHex] = keyHex;
                            if (!tgt.kidHex) { tgt.kidHex = kidHex; tgt.keyHex = keyHex; }
                        }
                    });
                } else {
                    const sep = v.includes(':') ? ':' : (v.includes(',') ? ',' : null);
                    if (sep) {
                        const idx = v.indexOf(sep);
                        const kidHex = normalizeDrmHex(v.slice(0, idx).trim());
                        const keyHex = normalizeDrmHex(v.slice(idx + 1).trim());
                        if (kidHex) tgt.kidHex = kidHex;
                        if (keyHex) tgt.keyHex = keyHex;
                    }
                }
                return;
            }

            if (!line.startsWith('#') && cur) {
                let url = line;
                const parts = line.split('|'), headers = Object.assign({}, cur.headers);
                if (parts.length > 1) {
                    url = parts[0];
                    parts.slice(1).join('|').split('&').forEach(function (kv) {
                        const i = kv.indexOf('='); if (i < 0) return;
                        const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim(); if (!k) return;
                        const lk = k.toLowerCase();
                        if (lk === 'referer' || lk === 'referrer') headers['Referer'] = v;
                        else if (lk === 'origin') headers['Origin'] = v;
                        else if (lk === 'user-agent') headers['User-Agent'] = v;
                        else if (lk === 'cookie') headers['Cookie'] = v;
                        else if (lk === 'key') cur.keyHex = normalizeDrmHex(v);
                        else if (lk === 'keyid' || lk === 'kid') cur.kidHex = normalizeDrmHex(v);
                        else if (lk === 'licenseurl') cur.licenseUrl = v;
                        else headers[k] = v;
                    });
                }
                channels.push({
                    title: cur.title, group: cur.group, poster: cur.poster, url,
                    headers, userAgent: cur.userAgent, cookie: cur.cookie,
                    keyHex: cur.keyHex, kidHex: cur.kidHex,
                    licenseUrl: cur.licenseUrl, drmKeys: cur.drmKeys
                });
                cur = null;
            }
        });
        return channels;
    }

    // ── Provider / Event helpers ────────────────────────────────────────────────
    function isLiveEventsProvider() {
        return clean((manifest && manifest.providerId) || '').toUpperCase() === 'LIVE EVENTS';
    }

    async function fetchProviders() {
        const base = await getBaseUrl();
        const res = await http_get(base + '/categories.txt', HEADERS);
        const decrypted = await decryptSKLive(res.body || '');
        const wrappers = parseJsonSafe(decrypted, []);
        if (!Array.isArray(wrappers)) return [];
        const out = [];
        wrappers.forEach(function (w, idx) {
            const cat = parseJsonSafe(w && w.cat ? w.cat : '', null);
            if (!cat || cat.visible === false || !cat.api) return;
            out.push({ id: idx + 1, title: cat.name || 'Playlist ' + (idx + 1), image: cat.logo || '', catLink: cat.api });
        });
        return out;
    }

    async function getProviders(cb) {
        try {
            const provs = await fetchProviders();
            const list = [];
            const seen = {};
            const liveName = (manifest && manifest.name ? manifest.name + ' Live Events' : 'SKTech Live Events');
            list.push({ id: 'LIVE EVENTS', name: liveName });
            seen['live events'] = true;
            provs.forEach(function (p) {
                const name = clean(p && (p.title || p.id) || '');
                if (!name) return;
                const key = name.toLowerCase();
                if (seen[key]) return;
                seen[key] = true;
                list.push({ id: name, name: name });
            });
            return cb({ success: true, data: list });
        } catch (e) {
            return cb({ success: false, errorCode: 'PROVIDERS_ERROR', message: String(e && e.message || e) });
        }
    }

    function parseDateTime(d, t) {
        if (!d || !t) return null;
        const p = String(d).split('/');
        if (p.length !== 3) return null;
        return p[2] + '/' + p[1] + '/' + p[0] + ' ' + t + ' +0000';
    }

    async function fetchLiveEvents() {
        const base = await getBaseUrl();
        const res = await http_get(base + '/events.txt', HEADERS);
        const decrypted = await decryptSKLive(res.body || '');
        const wrappers = parseJsonSafe(decrypted, []);
        if (!Array.isArray(wrappers)) return [];
        const out = [];
        wrappers.forEach(function (w, idx) {
            const e = parseJsonSafe(w && w.event ? w.event : '', null);
            if (!e || e.visible === false) return;
            const links = e.links || '';
            out.push({
                id: idx + 1, title: e.eventName || 'Event', image: e.eventLogo || '',
                slug: links ? String(links).replace(/\.txt$/i, '').replace(/\.m3u8?$/i, '') : ('event-' + (idx + 1)),
                cat: e.category || 'Other',
                eventInfo: {
                    teamA: e.teamAName || '', teamB: e.teamBName || '',
                    teamAFlag: e.teamAFlag || '', teamBFlag: e.teamBFlag || '',
                    eventCat: e.category || 'Other', eventName: e.eventName || '',
                    eventLogo: e.eventLogo || '',
                    startTime: parseDateTime(e.date, e.time),
                    endTime: parseDateTime(e.end_date, e.end_time)
                },
                formats: Array.isArray(e.link_names) ? e.link_names.map(n => ({ title: n, webLink: e.links || '' })) : []
            });
        });
        return out;
    }

    async function resolveProviderCatLink() {
        if (isLiveEventsProvider()) return null;
        if (cachedProviderCatLink) return cachedProviderCatLink;
        const providerId = clean((manifest && manifest.providerId) || '');
        if (!providerId) return null;
        const providers = await fetchProviders();
        const found = providers.find(p => clean(p && p.title || '').toLowerCase() === providerId.toLowerCase());
        if (!found || !found.catLink) return null;
        cachedProviderCatLink = found.catLink;
        return cachedProviderCatLink;
    }

    async function fetchPlaylistChannels(link) {
        const url = String(link || '').trim();
        const res = await http_get(url, HEADERS);
        const raw = clean(res.body || '');
        const dec = await decryptSKLive(raw);
        return parseM3U(dec && dec.length ? dec : raw);
    }

    function parseProviderDateTime(text) {
        const m = clean(text).match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-])(\d{2})(\d{2})$/);
        if (!m) return NaN;
        const sign = m[7] === '-' ? -1 : 1;
        const off = sign * (Number(m[8]) * 60 + Number(m[9]));
        return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - off * 60000;
    }

    function isEventLive(event) {
        const i = event && event.eventInfo; if (!i) return false;
        const now = Date.now(), s = parseProviderDateTime(i.startTime), e = parseProviderDateTime(i.endTime);
        if (!isNaN(e) && now >= e) return false;
        return !isNaN(s) && now >= s;
    }
    function isEventEnded(event) {
        const i = event && event.eventInfo; if (!i) return false;
        const e = parseProviderDateTime(i.endTime);
        return !isNaN(e) && Date.now() >= e;
    }
    function eventStatus(info) {
        try {
            const now = Date.now();
            const s = info && info.startTime ? parseProviderDateTime(info.startTime) : NaN;
            const e = info && info.endTime ? parseProviderDateTime(info.endTime) : NaN;
            if (!isNaN(e) && now >= e) return '[ENDED]';
            if (!isNaN(s) && now >= s) return '[LIVE]';
            if (!isNaN(s) && now < s) return '[UPCOMING]';
        } catch (_) { }
        return '';
    }

    function matchCard(event) {
        const i = event.eventInfo || {};
        let u = 'https://live-card-png.cricify.workers.dev/?title=' + encodeURIComponent(i.eventName || event.title || 'Live Event');
        u += '&teamA=' + encodeURIComponent(i.teamA || 'A');
        u += '&teamB=' + encodeURIComponent(i.teamB || 'B');
        if (i.teamAFlag) u += '&teamAImg=' + encodeURIComponent(i.teamAFlag);
        if (i.teamBFlag) u += '&teamBImg=' + encodeURIComponent(i.teamBFlag);
        if (i.eventLogo) u += '&eventLogo=' + encodeURIComponent(i.eventLogo);
        if (i.startTime) u += '&time=' + encodeURIComponent(i.startTime);
        u += '&isLive=' + String(isEventLive(event));
        u += '&isEnded=' + String(isEventEnded(event));
        return u;
    }

    function resolveChannelUrl(base, slug) {
        const raw = clean(slug); if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        if (/\.txt($|\?)/i.test(raw)) return raw.charAt(0) === '/' ? (base + raw) : (base + '/' + raw);
        return base + '/' + raw + '.txt';
    }

    async function fetchEventStreams(event) {
        const base = await getBaseUrl();
        const slug = clean(event.slug || ''); if (!slug) return [];
        const channelUrl = resolveChannelUrl(base, slug); if (!channelUrl) return [];
        const res = await http_get(channelUrl, HEADERS);
        const dec = await decryptSKLive(res.body || '');
        const parsed = parseJsonSafe(dec, null);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.streamUrls)) return parsed.streamUrls;
        return [];
    }

    async function resolveTokenApi(tokenApiText) {
        const cfg = parseJsonSafe(tokenApiText, null);
        if (!cfg || !cfg.api) return null;
        try {
            const r = await http_get(cfg.api, HEADERS);
            const body = clean(r.body || ''); if (!body) return null;
            if (cfg.link_key) { const j = parseJsonSafe(body, null); if (j && j[cfg.link_key]) return String(j[cfg.link_key]); }
            return body;
        } catch (_) { return null; }
    }

    function parseStreamLink(link) {
        const parts = String(link || '').split('|');
        const url = parts[0] || '', headers = {};
        if (parts.length > 1) {
            parts.slice(1).join('|').split('&').forEach(function (kv) {
                const i = kv.indexOf('='); if (i < 0) return;
                const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim(); if (!k) return;
                const lk = k.toLowerCase();
                if (lk === 'user-agent') headers['User-Agent'] = v;
                else if (lk === 'referer' || lk === 'referrer') headers['Referer'] = v;
                else if (lk === 'origin') headers['Origin'] = v;
                else if (lk === 'cookie') headers['Cookie'] = v;
                else headers[k] = v;
            });
        }
        return { url, headers };
    }

    // ── API handlers ────────────────────────────────────────────────────────────
    async function getHome(cb) {
        try {
            if (manifest && manifest.providerId && !isLiveEventsProvider()) {
                const catLink = await resolveProviderCatLink();
                if (!catLink) return cb({ success: false, errorCode: 'PROVIDER_NOT_FOUND', message: 'Provider "' + manifest.providerId + '" not found' });
                const channels = await fetchPlaylistChannels(catLink);
                const data = {};
                channels.forEach(function (ch) {
                    const group = ch.group || 'Channels';
                    if (!data[group]) data[group] = [];
                    data[group].push(new MultimediaItem({
                        title: ch.title, posterUrl: ch.poster || '', type: 'livestream',
                        url: JSON.stringify({ kind: 'channel', channel: ch, providerTitle: manifest.name || manifest.providerId })
                    }));
                });
                return cb({ success: true, data });
            }

            const events = await fetchLiveEvents(), data = {}, grouped = {};
            events.forEach(function (e) {
                const c = (e.eventInfo && e.eventInfo.eventCat) || e.cat || 'Other';
                if (!grouped[c]) grouped[c] = []; grouped[c].push(e);
            });
            Object.keys(grouped).forEach(function (cat) {
                data['Live ' + cat] = grouped[cat].map(function (e) {
                    const i = e.eventInfo || {};
                    const t = i.teamA && i.teamB && i.teamA !== i.teamB ? (i.teamA + ' vs ' + i.teamB) : e.title;
                    const status = eventStatus(i), card = matchCard(e);
                    return new MultimediaItem({ title: (status ? status + ' ' : '') + t, posterUrl: card, type: 'livestream', url: JSON.stringify({ kind: 'event', event: e, poster: card, title: t }), description: i.eventName || e.title });
                });
            });
            cb({ success: true, data });
        } catch (e) { cb({ success: false, errorCode: 'HOME_ERROR', message: String(e && e.message || e) }); }
    }

    async function search(query, cb) {
        try {
            const q = String(query || '').toLowerCase();
            if (manifest && manifest.providerId && !isLiveEventsProvider()) {
                const catLink = await resolveProviderCatLink();
                if (!catLink) return cb({ success: true, data: [] });
                const channels = await fetchPlaylistChannels(catLink);
                return cb({
                    success: true, data: channels
                        .filter(ch => String(ch.title || '').toLowerCase().includes(q) || String(ch.group || '').toLowerCase().includes(q))
                        .map(ch => new MultimediaItem({
                            title: ch.title, posterUrl: ch.poster || '', type: 'livestream',
                            url: JSON.stringify({ kind: 'channel', channel: ch, providerTitle: manifest.name || manifest.providerId })
                        }))
                });
            }
            const events = await fetchLiveEvents(), out = [];
            events.forEach(function (e) {
                const i = e.eventInfo || {}, t = (i.teamA && i.teamB && i.teamA !== i.teamB) ? (i.teamA + ' vs ' + i.teamB) : e.title;
                const s = (e.title + ' ' + (i.teamA || '') + ' ' + (i.teamB || '') + ' ' + (i.eventName || '')).toLowerCase();
                if (s.includes(q)) out.push(new MultimediaItem({ title: t, posterUrl: matchCard(e), type: 'livestream', url: JSON.stringify({ kind: 'event', event: e, poster: matchCard(e), title: t }) }));
            });
            cb({ success: true, data: out });
        } catch (_) { cb({ success: true, data: [] }); }
    }

    async function load(url, cb) {
        try {
            const payload = parseJsonSafe(url, null);
            if (!payload) return cb({ success: false, errorCode: 'PARSE_ERROR', message: 'Invalid payload' });
            if (payload.kind === 'provider') {
                const prov = payload.provider, channels = await fetchPlaylistChannels(prov.catLink);
                const eps = channels.map((ch, idx) => new Episode({ name: ch.title || 'Channel ' + (idx + 1), season: 1, episode: idx + 1, posterUrl: ch.poster || prov.image || '', url: JSON.stringify({ kind: 'channel', channel: ch, providerTitle: prov.title }) }));
                return cb({ success: true, data: new MultimediaItem({ title: prov.title, url, posterUrl: prov.image || '', description: prov.catLink || '', type: 'livestream', episodes: eps }) });
            }
            if (payload.kind === 'event') {
                const event = payload.event || {}, info = event.eventInfo || {};
                const plot = (info.eventName ? 'Event: ' + info.eventName + '\n' : '') + (info.startTime ? 'Start: ' + info.startTime : '');
                return cb({ success: true, data: new MultimediaItem({ title: payload.title || event.title || 'Live Event', url, posterUrl: payload.poster || event.image || '', description: plot, type: 'livestream', episodes: [new Episode({ name: 'Watch Live', season: 1, episode: 1, url, posterUrl: payload.poster || event.image || '' })] }) });
            }
            if (payload.kind === 'channel') {
                const ch = payload.channel;
                return cb({ success: true, data: new MultimediaItem({ title: ch.title || 'Channel', url, posterUrl: ch.poster || '', description: ch.group || payload.providerTitle || '', type: 'livestream', episodes: [new Episode({ name: 'Watch Live', season: 1, episode: 1, url, posterUrl: ch.poster || '' })] }) });
            }
            cb({ success: false, errorCode: 'PARSE_ERROR', message: 'Unknown payload kind' });
        } catch (e) { cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e && e.message || e) }); }
    }

    async function resolveClearKey(mpdUrl, licenseUrl, mpdHeaders) {
        try {
            const res = await http_get(mpdUrl, mpdHeaders || HEADERS);
            const body = res.body || '';
            const kidMatch = body.match(/cenc:default_KID=["']([^"']+)["']/i);
            if (!kidMatch) return null;
            const kidHex = kidMatch[1].replace(/-/g, '').toLowerCase();
            const kidB64 = hexToBase64Url(kidHex);
            if (!kidB64) return null;
            const lRes = await http_post(
                licenseUrl,
                { 'User-Agent': 'Dalvik/2.1.0', 'Content-Type': 'application/json' },
                JSON.stringify({ kids: [kidB64], type: 'temporary' })
            );
            const lData = parseJsonSafe(lRes.body, {});
            const keys = Array.isArray(lData.keys) ? lData.keys : [];
            if (keys.length > 0 && keys[0].k) {
                const keyHex = base64ToHex(keys[0].k);
                if (!keyHex) return null;
                return { drmKey: keyHex, drmKid: kidHex, licenseUrl: licenseUrl };
            }
        } catch (_) {}
        return null;
    }

    async function loadStreams(url, cb) {
        try {
            const payload = parseJsonSafe(url, null);
            if (!payload) return cb({ success: false, errorCode: 'PARSE_ERROR', message: 'Invalid stream payload' });

            if (payload.kind === 'event') {
                const streams = await fetchEventStreams(payload.event || {});
                const out = [];
                for (let i = 0; i < streams.length; i++) {
                    const s = streams[i] || {};
                    let link = s.link || '';
                    if (!link && s.tokenApi) link = await resolveTokenApi(s.tokenApi);
                    if (!link) continue;
                    const parsed = parseStreamLink(link);
                    if (!parsed.url) continue;
                    const result = new StreamResult({ url: parsed.url, source: s.name || s.title || ('Server ' + (i + 1)), headers: parsed.headers });
                    const ismpd = parsed.url.toLowerCase().includes('.mpd') || String(s.type || '') === '7';
                    if (ismpd && s.api && String(s.api).includes(':')) {
                        const ci = String(s.api).indexOf(':');
                        const kidHex = normalizeDrmHex(String(s.api).slice(0, ci));
                        const keyHex = normalizeDrmHex(String(s.api).slice(ci + 1));
                        if (kidHex && keyHex) {
                            result.drmKid = kidHex;
                            result.drmKey = keyHex;
                        }
                    } else if (ismpd && s.licenseUrl) {
                        const resolved = await resolveClearKey(parsed.url, String(s.licenseUrl), parsed.headers);
                        if (resolved) {
                            result.drmKey = resolved.drmKey;
                            result.drmKid = resolved.drmKid;
                            result.licenseUrl = resolved.licenseUrl;  // set all three together
                        } else {
                            result.licenseUrl = String(s.licenseUrl);
                        }
                    }
                    out.push(result);
                }
                return cb({ success: true, data: out });
            }

            if (payload.kind === 'channel') {
                const ch = payload.channel || {};
                const headers = Object.assign({}, ch.headers || {});
                if (ch.userAgent) headers['User-Agent'] = ch.userAgent;
                if (ch.cookie) headers['Cookie'] = ch.cookie;
                const result = new StreamResult({ url: ch.url, source: payload.providerTitle || 'SKTech', headers });
                if (String(ch.url || '').toLowerCase().includes('.mpd')) {
                    let keyHex = normalizeDrmHex(ch.keyHex);
                    let kidHex = normalizeDrmHex(ch.kidHex);

                    // Match MPD KID first when a DRM key map is available.
                    if (ch.drmKeys && Object.keys(ch.drmKeys).length > 0) {
                        try {
                            const mpdRes = await http_get(ch.url, headers);
                            const mpdBody = mpdRes.body || '';
                            const kidMatch = mpdBody.match(/cenc:default_KID=["']([^"']+)["']/i);
                            if (kidMatch) {
                                const mpdKidHex = kidMatch[1].replace(/-/g, '').toLowerCase();
                                if (ch.drmKeys[mpdKidHex]) {
                                    kidHex = mpdKidHex;
                                    keyHex = normalizeDrmHex(ch.drmKeys[mpdKidHex]);
                                }
                            }
                        } catch (_) {}

                        if (!keyHex) {
                            const firstKid = Object.keys(ch.drmKeys)[0];
                            kidHex = firstKid;
                            keyHex = normalizeDrmHex(ch.drmKeys[firstKid]);
                        }
                    }

                    if (keyHex && kidHex) {
                        result.drmKey = keyHex;
                        result.drmKid = kidHex;
                    } else if (ch.licenseUrl) {
                        const resolved = await resolveClearKey(ch.url, String(ch.licenseUrl), headers);
                        if (resolved) {
                            result.drmKey = resolved.drmKey;
                            result.drmKid = resolved.drmKid;
                            result.licenseUrl = resolved.licenseUrl;  // set all three together
                        } else {
                            result.licenseUrl = String(ch.licenseUrl);
                        }
                    }
                }
                return cb({ success: true, data: [result] });
            }

            cb({ success: false, errorCode: 'PARSE_ERROR', message: 'Unsupported kind for streams' });
        } catch (e) { cb({ success: false, errorCode: 'STREAM_ERROR', message: String(e && e.message || e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
    globalThis.getProviders = getProviders;
})();
