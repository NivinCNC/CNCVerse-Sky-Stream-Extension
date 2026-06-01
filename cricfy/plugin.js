(function () {
    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // var manifest is injected at runtime

    const CRICFY_FIREBASE_API_KEY = '__CRICFY_FIREBASE_API_KEY__';
    const CRICFY_FIREBASE_APP_ID = '__CRICFY_FIREBASE_APP_ID__';
    const CRICFY_FIREBASE_PROJECT_NUMBER = '__CRICFY_FIREBASE_PROJECT_NUMBER__';
    const CRICIFY_PROVIDER_SECRET1 = '__CRICIFY_PROVIDER_SECRET1__';
    const CRICIFY_PROVIDER_SECRET2 = '__CRICIFY_PROVIDER_SECRET2__';
    const REMOTE_PACKAGE_NAME = 'com.cricfy.tv';

    const HEADERS = {
        "accept": "*/*",
        "Cache-Control": "no-cache, no-store",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0",
    };

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
    function bytesArrToRaw(bytes) { return bytes.map(b => String.fromCharCode(b & 255)).join(''); }
    function bytesArrToB64(bytes) { return btoa(bytesArrToRaw(bytes)); }

    // Decode base64/base64url → hex string
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

    // Normalize any DRM identifier (hex with dashes, pure hex, or base64url) → lowercase hex
    function normalizeDrmHex(v) {
        const s = clean(v);
        if (!s || s.toLowerCase() === 'null') return null;
        const hex = s.replace(/-/g, '');
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) return hex.toLowerCase();
        return base64ToHex(s);
    }

    // Convert hex → base64url (what the SkyStream player expects for drmKey/drmKid)
    function hexToBase64Url(hex) {
        if (!hex) return null;
        try {
            let raw = '';
            for (let i = 0; i < hex.length; i += 2)
                raw += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
            return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        } catch (_) { return null; }
    }

    // ── Decryption ──────────────────────────────────────────────────────────────
    async function decryptCricfy(content) {
        const text = clean(content);
        if (!text) return '';
        if (text.startsWith('{') || text.startsWith('[') ||
            text.startsWith('#EXTM3U') || text.startsWith('#EXTINF') || text.startsWith('#KODIPROP')) {
            return text;
        }

        const trimmed = text.replace(/\s+/g, '');

        for (const secret of [CRICIFY_PROVIDER_SECRET1, CRICIFY_PROVIDER_SECRET2]) {
            const parts = clean(secret).split(':');
            if (parts.length !== 2) continue;
            const keyBytes = hexToBytes(parts[0]);
            const ivBytes = hexToBytes(parts[1]);
            if (!keyBytes || !ivBytes) continue;
            const dec = await crypto.decryptAES(trimmed, bytesArrToB64(keyBytes), bytesArrToB64(ivBytes), { mode: 'cbc' }).catch(() => null);
            if (!dec) continue;
            const d = clean(dec);
            if (d.startsWith('{') || d.startsWith('[') || d.includes('#EXTM3U') || d.includes('http')) return dec;
        }

        if (trimmed.length >= 79) {
            const iv = trimmed.substring(10, 34);
            const key = trimmed.substring(trimmed.length - 54, trimmed.length - 10);
            const enc = trimmed.substring(0, 10)
                + trimmed.substring(34, trimmed.length - 54)
                + trimmed.substring(trimmed.length - 10);
            const dec = await crypto.decryptAES(enc, key, iv, { mode: 'cbc' }).catch(() => null);
            if (dec) {
                const d = clean(dec);
                if (d.startsWith('{') || d.startsWith('[') || d.includes('#EXTM3U') || d.includes('http')) return dec;
            }
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
            REMOTE_PACKAGE_NAME, clean(CRICFY_FIREBASE_API_KEY),
            clean(CRICFY_FIREBASE_APP_ID), clean(CRICFY_FIREBASE_PROJECT_NUMBER)
        );
        const remote = entries ? (entries.cric_api2 || entries.cric_api1 || '') : '';
        cachedBaseUrl = clean(remote || manifest.baseUrl).replace(/\/+$/, '');
        return cachedBaseUrl;
    }

    // ── M3U Parser ──────────────────────────────────────────────────────────────
    function parseM3U(content) {
        const lines = String(content || '').split(/\r?\n/);
        const channels = [];
        let cur = null;
        let pending = { headers: {}, userAgent: '', cookie: '', keyHex: '', kidHex: '', licenseUrl: '', drmKeys: {} };

        function resetPending() {
            pending = { headers: {}, userAgent: '', cookie: '', keyHex: '', kidHex: '', licenseUrl: '', drmKeys: {} };
        }

        lines.forEach(function (raw) {
            const line = raw.trim();
            if (!line) return;

            if (line.startsWith('#EXTINF')) {
                const t = line.match(/,(.*)$/);
                const g = line.match(/group-title="([^"]*)"/);
                const l = line.match(/tvg-logo="([^"]*)"/);
                
                let title = 'Unknown';
                let lastComma = -1, inQ = false;
                for (let i = 0; i < line.length; i++) {
                    if (line[i] === '"') inQ = !inQ;
                    else if (line[i] === ',' && !inQ) lastComma = i;
                }
                
                // Extract attributes like key and kidid from #EXTINF
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
                else if (t) title = t[1].trim();

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
                    const j = parseJsonSafe(v, {});
                    const keys = Array.isArray(j.keys) ? j.keys : [];
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
                const parts = line.split('|');
                const headers = Object.assign({}, cur.headers);
                
                if (parts.length > 1) {
                    url = parts[0];
                    parts.slice(1).join('|').split('&').forEach(function (kv) {
                        const i = kv.indexOf('='); if (i < 0) return;
                        const k = kv.slice(0, i).trim();
                        const v = kv.slice(i + 1).trim();
                        if (!k) return;
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

    async function getProviders(cb) {
        try {
            const providers = await fetchProviders();
            const list = [];
            const seen = {};
            const liveName = (manifest && manifest.name ? manifest.name + ' Live Events' : 'Cricfy Live Events');
            list.push({ id: 'LIVE EVENTS', name: liveName });
            seen['live events'] = true;
            providers.forEach(function (p) {
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

    // ── Provider / Playlist helpers ─────────────────────────────────────────────
    async function fetchProviders() {
        const base = await getBaseUrl();
        const res = await http_get(base + '/cats.txt', HEADERS);
        const decrypted = await decryptCricfy(res.body || '');
        const list = parseJsonSafe(decrypted, []);
        if (!Array.isArray(list)) return [];
        return list.filter(function (p) {
            const lnk = String(p && p.catLink || '').trim().toLowerCase();
            return lnk && lnk !== 'null' && lnk !== 'ok';
        }).map(function (p) { return { id: p.id, title: p.title || 'Provider', image: p.image || '', catLink: p.catLink }; });
    }

    async function fetchLiveEvents() {
        const base = await getBaseUrl();
        const res = await http_get(base + '/categories/live-events.txt', HEADERS);
        const decrypted = await decryptCricfy(res.body || '');
        const list = parseJsonSafe(decrypted, []);
        if (!Array.isArray(list)) return [];
        return list.filter(function (e) { return Number(e.publish || 0) === 1; });
    }

    async function resolveProviderCatLink() {
        if (isLiveEventsProvider()) return null;
        if (cachedProviderCatLink) return cachedProviderCatLink;
        const providerId = clean((manifest && manifest.providerId) || '');
        if (!providerId) return null;
        const providers = await fetchProviders();
        const found = providers.find(function (p) {
            return clean(p && p.title || '').toLowerCase() === providerId.toLowerCase();
        });
        if (!found || !found.catLink) return null;
        cachedProviderCatLink = found.catLink;
        return cachedProviderCatLink;
    }

    async function fetchPlaylistChannels(link) {
        const url = String(link || '').trim();
        const res = await http_get(url, HEADERS);
        const raw = clean(res.body || '');
        const dec = await decryptCricfy(raw);
        return parseM3U(dec && dec.length ? dec : raw);
    }

    // ── Live Events helpers ─────────────────────────────────────────────────────
    function isLiveEventsProvider() {
        return clean((manifest && manifest.providerId) || '').toUpperCase() === 'LIVE EVENTS';
    }

    function parseProviderDateTime(text) {
        const m = clean(text).match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-])(\d{2})(\d{2})$/);
        if (!m) return NaN;
        const sign = m[7] === '-' ? -1 : 1;
        const off = sign * (Number(m[8]) * 60 + Number(m[9]));
        return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - off * 60000;
    }

    function isEventLive(event) {
        const i = event && event.eventInfo;
        if (!i) return false;
        const now = Date.now(), s = parseProviderDateTime(i.startTime), e = parseProviderDateTime(i.endTime);
        if (!isNaN(e) && now >= e) return false;
        return !isNaN(s) && now >= s;
    }
    function isEventEnded(event) {
        const i = event && event.eventInfo;
        if (!i) return false;
        const e = parseProviderDateTime(i.endTime);
        return !isNaN(e) && Date.now() >= e;
    }
    function eventStatus(event) {
        const i = event && event.eventInfo;
        if (!i) return '';
        const now = Date.now(), s = parseProviderDateTime(i.startTime), e = parseProviderDateTime(i.endTime);
        if (!isNaN(e) && now >= e) return '[ENDED]';
        if (!isNaN(s) && now >= s) return '[LIVE]';
        if (!isNaN(s) && now < s) return '[UPCOMING]';
        return '';
    }
    function createDisplayTitle(event) {
        const i = event && event.eventInfo || {};
        return (i.teamA && i.teamB && i.teamA !== i.teamB)
            ? i.teamA + ' vs ' + i.teamB
            : (event && event.title || 'Live Event');
    }
    function formatMatchTime(text) {
        const ts = parseProviderDateTime(text);
        if (isNaN(ts)) return '';
        try {
            return new Date(ts).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (_) { return ''; }
    }
    function matchCard(event) {
        const i = event.eventInfo || {};
        let u = 'https://live-card-png.cricify.workers.dev/?title=' + encodeURIComponent(i.eventName || event.title || 'Live Event');
        u += '&teamA=' + encodeURIComponent(i.teamA || 'Team A');
        u += '&teamB=' + encodeURIComponent(i.teamB || 'Team B');
        if (i.teamAFlag) u += '&teamAImg=' + encodeURIComponent(i.teamAFlag);
        if (i.teamBFlag) u += '&teamBImg=' + encodeURIComponent(i.teamBFlag);
        if (i.eventLogo) u += '&eventLogo=' + encodeURIComponent(i.eventLogo);
        const ft = formatMatchTime(i.startTime); if (ft) u += '&time=' + encodeURIComponent(ft);
        u += '&isLive=' + String(isEventLive(event));
        u += '&isEnded=' + String(isEventEnded(event));
        return u;
    }

    async function fetchEventStreams(event) {
        const base = await getBaseUrl();
        const slug = clean(event.slug || '').toLowerCase();
        if (!slug) return [];
        const res = await http_get(base + '/channels/' + slug + '.txt', HEADERS);
        const dec = await decryptCricfy(res.body || '');
        const obj = parseJsonSafe(dec, null);
        if (Array.isArray(obj)) return obj;
        if (obj && Array.isArray(obj.streamUrls)) return obj.streamUrls;
        return [];
    }

    function parseStreamLink(link) {
        const parts = String(link || '').split('|');
        const url = parts[0] || '';
        const headers = {};
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

            const events = await fetchLiveEvents();
            const data = {}, grouped = {};
            events.forEach(function (e) {
                const cat = (e.eventInfo && e.eventInfo.eventCat) || e.cat || 'Other';
                if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(e);
            });
            Object.keys(grouped).forEach(function (cat) {
                const sorted = grouped[cat].slice().sort((a, b) => Number(isEventLive(b)) - Number(isEventLive(a)));
                data['Live ' + cat] = sorted.map(function (e) {
                    const t = createDisplayTitle(e), status = eventStatus(e), poster = matchCard(e);
                    return new MultimediaItem({
                        title: (status ? status + ' ' : '') + t, posterUrl: poster, type: 'livestream',
                        url: JSON.stringify({ kind: 'event', event: e, title: t, poster }),
                        description: (e.eventInfo && e.eventInfo.eventName) || e.title
                    });
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
                const i = e.eventInfo || {}, t = createDisplayTitle(e);
                const s = (e.title + ' ' + (i.teamA || '') + ' ' + (i.teamB || '') + ' ' + (i.eventName || '') + ' ' + (i.eventType || '')).toLowerCase();
                if (s.includes(q)) {
                    const status = eventStatus(e);
                    out.push(new MultimediaItem({ title: (status ? status + ' ' : '') + t, posterUrl: matchCard(e), type: 'livestream', url: JSON.stringify({ kind: 'event', event: e, title: t, poster: matchCard(e) }) }));
                }
            });
            cb({ success: true, data: out });
        } catch (_) { cb({ success: true, data: [] }); }
    }

    async function load(url, cb) {
        try {
            const payload = parseJsonSafe(url, null);
            if (!payload) return cb({ success: false, errorCode: 'PARSE_ERROR', message: 'Invalid payload' });

            if (payload.kind === 'provider') {
                const prov = payload.provider;
                const channels = await fetchPlaylistChannels(prov.catLink);
                const eps = channels.map((ch, idx) => new Episode({ name: ch.title || 'Channel ' + (idx + 1), season: 1, episode: idx + 1, posterUrl: ch.poster || prov.image || '', url: JSON.stringify({ kind: 'channel', channel: ch, providerTitle: prov.title }) }));
                return cb({ success: true, data: new MultimediaItem({ title: prov.title, url, posterUrl: prov.image || '', description: prov.catLink || '', type: 'livestream', episodes: eps }) });
            }
            if (payload.kind === 'event') {
                const e = payload.event || {}, i = e.eventInfo || {};
                let plot = '';
                if (i.eventType) plot += 'Type: ' + i.eventType + '\n';
                if (i.eventName) plot += 'Event: ' + i.eventName + '\n';
                if (i.startTime) plot += 'Start: ' + i.startTime + '\n';
                plot += '\nAvailable Servers: ' + (Array.isArray(e.formats) ? e.formats.length : 0);
                return cb({ success: true, data: new MultimediaItem({ title: payload.title || e.title || 'Live Event', url, posterUrl: payload.poster || e.image || '', description: plot, type: 'livestream', episodes: [new Episode({ name: 'Watch Live', season: 1, episode: 1, url, posterUrl: payload.poster || e.image || '' })] }) });
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
            
            // Extract the KID and ensure it's in Hex
            const kidHex = kidMatch[1].replace(/-/g, '').toLowerCase();
            
            // The license server API expects the request in Base64URL
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
                // IMPORTANT: The server returns Base64. We MUST convert it back to Hex for the player.
                const keyHex = base64ToHex(keys[0].k);
                
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
                for (let idx = 0; idx < streams.length; idx++) {
                    const s = streams[idx];
                    const parsed = parseStreamLink(s.link || '');
                    if (!parsed.url) continue;
                    const r = new StreamResult({ url: parsed.url, source: s.title || s.name || ('Server ' + (idx + 1)), headers: parsed.headers });
                    const ismpd = parsed.url.toLowerCase().includes('.mpd') || String(s.type || '') === '7';
                    if (ismpd && s.api && String(s.api).includes(':')) {
                        const ci = String(s.api).indexOf(':');
                        const kidHex = normalizeDrmHex(String(s.api).slice(0, ci));
                        const keyHex = normalizeDrmHex(String(s.api).slice(ci + 1));
                        if (kidHex && keyHex) {
                            r.drmKid = kidHex;
                            r.drmKey = keyHex;
                        }
                    } else if (ismpd && s.licenseUrl) {
                        const resolved = await resolveClearKey(parsed.url, String(s.licenseUrl), parsed.headers);
                        if (resolved) {
                            r.drmKey = resolved.drmKey;
                            r.drmKid = resolved.drmKid;
                            r.licenseUrl = resolved.licenseUrl;
                        } else {
                            r.licenseUrl = String(s.licenseUrl);
                        }
                    }
                    out.push(r);
                }
                return cb({ success: true, data: out });
            }

            if (payload.kind === 'channel') {
                const ch = payload.channel || {};
                const headers = Object.assign({}, ch.headers || {});
                if (ch.userAgent) headers['User-Agent'] = ch.userAgent;
                if (ch.cookie) headers['Cookie'] = ch.cookie;

                const r = new StreamResult({ url: ch.url, source: payload.providerTitle || 'Cricfy', headers });

                if (String(ch.url || '').toLowerCase().includes('.mpd')) {
                    let keyHex = normalizeDrmHex(ch.keyHex);
                    let kidHex = normalizeDrmHex(ch.kidHex);
                    
                    // Match KID from MPD to correctly pick key from a DRM Map (matches Kotlin implementation)
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

                        // Fallback to first if MPD parse failed or no match found
                        if (!keyHex) {
                            const firstKid = Object.keys(ch.drmKeys)[0];
                            kidHex = firstKid; 
                            keyHex = normalizeDrmHex(ch.drmKeys[firstKid]);
                        }
                    }
                    
                    if (keyHex && kidHex) {
                        r.drmKey = keyHex;
                        r.drmKid = kidHex;
                    } else if (ch.licenseUrl) {
                        const resolved = await resolveClearKey(ch.url, String(ch.licenseUrl), headers);
                        if (resolved) {
                            r.drmKey = resolved.drmKey;
                            r.drmKid = resolved.drmKid;
                            r.licenseUrl = resolved.licenseUrl;
                        } else {
                            r.licenseUrl = String(ch.licenseUrl);
                        }
                    }
                }
                return cb({ success: true, data: [r] });
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