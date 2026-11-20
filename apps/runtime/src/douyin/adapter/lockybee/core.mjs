import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const SHARED_PROOFS = globalThis[Symbol.for('dafeiyu.shared-video-frame-proofs.v1')] ||= new WeakMap();
const SHARED_PROOF_ISSUER = 'dafeiyu-shared-video-capture-v1';
const sharedHash = value => createHash('sha256').update(value).digest('hex');
const sharedSignature = value => sharedHash(JSON.stringify({ proof: value.frameProof, observation: value.observation,
  state: { video: value.state?.video && { id: value.state.video.id, time: value.state.video.time, duration: value.state.video.duration, paused: value.state.video.paused, readyState: value.state.video.readyState }, blocked: Boolean(value.state?.loginRequired || value.state?.verificationRequired || value.state?.privateChatVisible || value.state?.unsupportedPage || value.state?.livePreview?.recognized === true || value.state?.videoSelection?.identityConflict) },
  frames: value.frames.map(frame => ({ videoId: frame.videoId, time: frame.time, timeSemantics: frame.timeSemantics, captureMethod: frame.captureMethod, captureSize: frame.captureSize, captureInterval: frame.captureInterval, mimeType: frame.mimeType, imageHash: sharedHash(frame.data) })) }));
function sharedProgress(before, after) {
  if (!before || !after || before.videoId !== after.videoId || before.elementToken !== after.elementToken || before.sourceHash !== after.sourceHash || before.documentTimeOrigin !== after.documentTimeOrigin
    || before.paused !== false || after.paused !== false || before.seeking !== false || after.seeking !== false || before.readyState < 2 || after.readyState < 2
    || !Number.isFinite(before.duration) || before.duration <= 0 || Math.abs(before.duration - after.duration) > 0.05 || before.loop !== after.loop
    || !Number.isFinite(before.playbackRate) || before.playbackRate <= 0 || before.playbackRate > 4 || before.playbackRate !== after.playbackRate) return null;
  const wall = (after.hostTimeMs - before.hostTimeMs) / 1000, pageWall = (after.pageTimeMs - before.pageTimeMs) / 1000;
  if (!Number.isFinite(wall) || wall < 0 || wall > 40 || !Number.isFinite(pageWall) || pageWall < 0 || Math.abs(wall - pageWall) > 0.35) return null;
  const expected = pageWall * before.playbackRate, direct = after.time - before.time;
  if (![before.time, after.time].every(time => Number.isFinite(time) && time >= 0 && time <= before.duration + 0.05)) return null;
  const turns = before.loop ? Math.max(0, Math.round((expected - direct) / before.duration)) : 0;
  const advanced = direct + turns * before.duration;
  return advanced >= -0.04 && Math.abs(advanced - expected) <= Math.max(0.2, expected * 0.15) ? Math.max(0, advanced) : null;
}
export function verifySharedVideoFrameProof(value, videoId) {
  try {
    const registered = value && SHARED_PROOFS.get(value), proof = value?.frameProof, frames = value?.frames;
    const age = registered ? performance.now() - registered.issuedHostMs : NaN;
    if (!registered || !Number.isFinite(age) || age < 0 || age > 60_000 || proof?.issuer !== SHARED_PROOF_ISSUER || proof.version !== 1 || proof.videoId !== videoId || value.state?.video?.id !== videoId || value.observation?.videoId !== videoId
      || value.state.video.paused !== false || value.state.video.readyState < 2 || value.state.loginRequired || value.state.verificationRequired || value.state.privateChatVisible || value.state.unsupportedPage || value.state.livePreview?.recognized === true || value.state.videoSelection?.identityConflict
      || proof.captureId !== registered.captureId || proof.signatureVersion !== 1 || !Array.isArray(frames) || frames.length < 2 || frames.length > 3 || frames.length !== proof.frameCount
      || !Number.isFinite(proof.requestedSeconds) || proof.requestedSeconds < 0.2 || proof.requestedSeconds > 30
      || !Number.isFinite(proof.actualWallSeconds) || proof.actualWallSeconds < 0.1 || proof.actualWallSeconds > Math.max(10,proof.requestedSeconds+7) || value.observation.actualWallSeconds !== proof.actualWallSeconds
      || !Array.isArray(proof.frameHashes) || proof.frameHashes.length !== frames.length || sharedSignature(value) !== registered.signature) return false;
    const first = frames[0].captureInterval?.before, last = frames.at(-1).captureInterval?.after;
    const total = sharedProgress(first, last);
    if (total === null || total <= 0.1 || last.decodedFrames <= first.decodedFrames || Math.abs((last.hostTimeMs - proof.startedHostMs) / 1000 - proof.actualWallSeconds) > 0.001) return false;
    for (let index = 0; index < frames.length; index++) {
      const frame = frames[index], interval = frame.captureInterval, before = interval?.before, after = interval?.after;
      if (frame.videoId !== videoId || frame.mimeType !== 'image/jpeg' || typeof frame.data !== 'string' || frame.time !== before?.time || frame.timeSemantics !== 'capture-before-boundary'
        || !['video-canvas-jpeg-v1', 'cdp-page-screenshot-interval-v1'].includes(frame.captureMethod) || proof.captureMethods?.[index] !== frame.captureMethod
        || frame.captureMethod === 'video-canvas-jpeg-v1' && (!Number.isInteger(frame.captureSize?.width) || !Number.isInteger(frame.captureSize?.height) || frame.captureSize.width < 2 || frame.captureSize.height < 2 || Math.max(frame.captureSize.width, frame.captureSize.height) > 960 || frame.captureSize.width * frame.captureSize.height > 921600)
        || interval.index !== index || before.videoId !== videoId || after.videoId !== videoId || sharedProgress(before, after) === null
        || before.hostTimeMs > interval.screenshotStartedHostMs || interval.screenshotStartedHostMs > interval.screenshotEndedHostMs || interval.screenshotEndedHostMs > after.hostTimeMs
        || before.hostTimeMs < proof.startedHostMs || after.hostTimeMs > proof.endedHostMs || proof.frameHashes[index] !== sharedHash(frame.data)
        || !Number.isSafeInteger(before.decodedFrames) || !Number.isSafeInteger(after.decodedFrames) || after.decodedFrames < before.decodedFrames) return false;
      if (index && sharedProgress(frames[index - 1].captureInterval.after, before) === null) return false;
    }
    return true;
  } catch { return false; }
}

function aborted(signal) { signal?.throwIfAborted(); }
async function wait(ms, signal) { await delay(ms, undefined, { signal }); }
export function readPageState() {
  if(location.origin!=='https://www.douyin.com') return {
    url:null,title:null,video:null,searchResults:[],visibleText:'',loginRequired:false,verificationRequired:false,
    unsupportedPage:true,note:'当前专用标签页已离开抖音，没有读取该页面内容。',
  };
  const visible = element => {
    const r = element.getBoundingClientRect(), s = getComputedStyle(element);
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const clean = value => (value ?? '').replace(/\s+/g, ' ').trim();
  const boundedAuthor = value => { const name = clean(value).replace(/^@\s*/, ''); return name && name.length <= 256 && !name.includes('\0') ? name : null; };
  const workId = value => {
    try { const u = new URL(value, location.href); return /\/video\/(\d+)/.exec(u.pathname)?.[1] || u.searchParams.get('modal_id') || u.searchParams.get('aweme_id'); } catch { return null; }
  };
  const privateArea='[data-e2e="im-dialog"],[data-e2e="conversation-item"]';
  const privateChatVisible=[...document.querySelectorAll('[data-e2e="im-dialog"]')].some(visible);
  const videoVisible = element => {
    if(!visible(element))return false;
    for(let node=element;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)===0)return false;
    return true;
  };
  const videoElements = [...document.querySelectorAll('video')].filter(e=>videoVisible(e)&&!e.closest(privateArea)).map(element => {
    const r = element.getBoundingClientRect();
    return { element, area: Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left)) * Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) };
  }).sort((a,b) => b.area - a.area);
  const element = videoElements[0]?.element;
  const text = [...document.querySelectorAll('body *')].filter(e => e.childElementCount === 0 && visible(e) && !e.closest('[data-e2e="im-dialog"],[data-e2e="conversation-item"]')).map(e => clean(e.innerText || e.textContent)).filter(Boolean).join('\n').slice(-9000);
  const loginRequired = /扫码登录|验证码登录|登录后即可|手机扫码登录/.test(text);
  const verificationRequired = [...document.querySelectorAll('#captcha_container,[id^="captcha_container"],[data-e2e="captcha-container"]')].some(visible) || /请完成下方验证|请完成验证|安全验证|拖动滑块/.test(text);
  let video = null, activeContainer = null, videoIdentityConflict = false;
  if (element) {
    let container = element.closest('[data-e2e="feed-active-video"],[data-e2e="video-detail"]');
    activeContainer = container;
    if(!container) {
      container=element.parentElement;
      for(let i=0;container?.parentElement&&i<8;i++) {
        if(container.querySelector('[class*="video-info-detail"]')) break;
        container=container.parentElement;
      }
    }
    const links = [...(container?.querySelectorAll('a[href]') ?? [])].filter(e=>visible(e)&&!e.closest(privateArea));
    const playerId=/(?:^|\s)video_(\d+)(?:\s|$)/.exec(element.closest('[data-e2e="player-container"]')?.className??'')?.[1],activeId=/(?:^|\s)video_(\d+)(?:\s|$)/.exec(activeContainer?.className??'')?.[1];
    videoIdentityConflict=Boolean(playerId&&activeId&&playerId!==activeId);
    const id = videoIdentityConflict?null:playerId || activeId || links.map(e=>workId(e.href)).find(Boolean) || workId(location.href) || null;
    const authorElement = links.find(e => /\/user\//.test(e.href)) || [...(container?.querySelectorAll('span,div')??[])].find(e=>e.childElementCount===0 && /^@/.test(clean(e.textContent)) && visible(e));
    const titleElement = container?.querySelector('[data-e2e="video-desc"],[data-e2e="video-title"],[data-e2e="detail-video-info"],[class*="video-info-detail"]');
    const detailAuthor=container?.querySelector('[data-e2e="related-video"]')?.innerText?.split('\n').map(clean).find(Boolean);
    const captionAuthor=/@([^·\n]+)·/.exec(titleElement?.textContent??'')?.[1]?.trim();
    const r = element.getBoundingClientRect();
    video = { id, url: id ? `https://www.douyin.com/video/${id}` : null,
      author: boundedAuthor(authorElement?.textContent) || boundedAuthor(detailAuthor) || boundedAuthor(captionAuthor),
      title: (clean(titleElement?.getAttribute('data-e2e')==='detail-video-info'?titleElement.innerText.split('\n')[0]:titleElement?.textContent) || clean(links.find(e=>workId(e.href))?.textContent)).slice(0, 1000) || null,
      time: element.currentTime, duration: Number.isFinite(element.duration) ? element.duration : null,
      paused: element.paused, muted: element.muted, readyState: element.readyState, ended:element.ended, loop:element.loop,
      width: element.videoWidth, height: element.videoHeight,
      viewport: { x: Math.max(0,r.left), y: Math.max(0,r.top), width: Math.min(innerWidth,r.right)-Math.max(0,r.left), height: Math.min(innerHeight,r.bottom)-Math.max(0,r.top) } };
  }
  const route = new URL(location.href);
  const recommendFeed = ['/', '/recommend', '/recommend/'].includes(route.pathname) && !workId(route.href);
  const feedCards = [...document.querySelectorAll('[data-e2e="feed-active-video"],[data-e2e="feed-live-card"],[data-e2e="feed-live"]')].filter(e => visible(e) && !e.closest(privateArea));
  if (!activeContainer && feedCards.length === 1) activeContainer = feedCards[0];
  let livePreview = null;
  if (recommendFeed && activeContainer?.matches('[data-e2e="feed-active-video"],[data-e2e="feed-live-card"],[data-e2e="feed-live"]') && !video?.id && !privateChatVisible && !loginRequired && !verificationRequired) {
    const roomIds = [...activeContainer.querySelectorAll('a[href]')].filter(visible).map(link => {
      try { const target = new URL(link.href, location.href); return target.origin === 'https://live.douyin.com' ? /^\/(\d{4,30})\/?$/.exec(target.pathname)?.[1] : null; } catch { return null; }
    }).filter(Boolean);
    const unique = [...new Set(roomIds)];
    if (unique.length === 1) {
      const r = (element || activeContainer).getBoundingClientRect();
      livePreview = { recognized: true, source: 'active-feed-live-link', scope: 'recommend-feed', roomId: unique[0],
        viewport: { x: Math.max(0,r.left), y: Math.max(0,r.top), width: Math.min(innerWidth,r.right)-Math.max(0,r.left), height: Math.min(innerHeight,r.bottom)-Math.max(0,r.top) } };
    }
  }
  const searchResults = [];
  if (location.pathname.startsWith('/search/')) {
    const candidates = [...document.querySelectorAll('.search-result-card,[data-e2e="search-card"],[data-e2e="search-result"],a[href*="/video/"],a[href*="modal_id="]')].filter(visible);
    const used = new Set();
    for (const candidate of candidates) {
      const anchor = candidate.matches('a') ? candidate : candidate.querySelector('a[href*="/video/"],a[href*="modal_id="]');
      const id = workId(anchor?.href) || candidate.getAttribute('data-aweme-id') || /waterfall_item_(\d+)/.exec(candidate.closest('[id^="waterfall_item_"]')?.id??'')?.[1];
      const card = candidate.closest('.search-result-card,[data-e2e="search-card"],[data-e2e="search-result"]') || candidate;
      const leaves = [...card.querySelectorAll('div,span')].filter(e=>!e.childElementCount).map(e=>clean(e.textContent));
      const title = clean(card.querySelector('[data-e2e="video-desc"],[data-e2e="video-title"]')?.textContent) || leaves.sort((a,b)=>b.length-a.length)[0] || clean(card.textContent);
      if (!title || used.has(id || title)) continue;
      used.add(id || title);
      searchResults.push({ index: searchResults.length, id: id || null, url: id ? `https://www.douyin.com/video/${id}` : null,
        title: title.slice(0,1000), author: boundedAuthor(card.querySelector('a[href*="/user/"]')?.textContent) || boundedAuthor(/@([^\n·]+)/.exec(card.innerText)?.[1]) });
    }
  }
  const u = new URL(location.href);
  for (const key of [...u.searchParams.keys()]) if (!['modal_id','aweme_id','recommend'].includes(key)) u.searchParams.delete(key);
  return { url: u.href, title: document.title, video, videoSelection: { candidateCount: videoElements.length, ambiguous: videoElements.length > 1 || videoIdentityConflict, identityConflict: videoIdentityConflict }, pageKind: livePreview ? 'live-preview' : video?.id ? 'video' : location.pathname.startsWith('/search/') ? 'search' : 'unknown', livePreview, searchResults: searchResults.slice(0,20), visibleText: text,
    loginRequired, verificationRequired, privateChatVisible, documentReadyState: document.readyState };
}

export class BrowserController {
  constructor({ page }) { if (!page) throw new Error('BFF_OWNED_PAGE_REQUIRED'); this.page = page; }
  async checkVideoLimits() {} // Runtime owns budget and holds the lease throughout capture.
  async state() { return this.page.evaluate(readPageState); }
  async currentVideo() {
    const index = await this.page.locator('video').evaluateAll(videos=>videos.map((video,index)=>{
      const r=video.getBoundingClientRect(),style=getComputedStyle(video);
      let painted=style.display!=='none'&&style.visibility!=='hidden'&&!video.closest('[data-e2e="im-dialog"],[data-e2e="conversation-item"]');
      for(let node=video;node&&painted;node=node.parentElement)if(Number(getComputedStyle(node).opacity)===0)painted=false;
      return {index,area:painted?Math.max(0,Math.min(innerWidth,r.right)-Math.max(0,r.left))*Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top)):0};
    }).filter(item=>item.area>0).sort((a,b)=>b.area-a.area)[0]?.index);
    if(index===undefined) throw new Error('没有在视口内找到视频。');
    return this.page.locator('video').nth(index);
  }
  async captureSharedFrames(seconds, signal) {
    if (!Number.isFinite(seconds) || seconds < 0.2 || seconds > 30) throw new Error('单批内部分享画面采集须在0.2至30秒之间；整条观看由续看决策决定。');
    const startedHostMs = performance.now(), deadline = startedHostMs + Math.max(10_000,(seconds+7)*1000), captureId = randomUUID(), elementToken = randomUUID();
    let handle, session;
    const bounded = async pending => {
      aborted(signal);
      const remaining = Math.min(4000, deadline - performance.now());
      if (remaining <= 0) throw new Error('分享画面采样超过十秒宿主边界，未采用超时画面。');
      const stepDeadline = performance.now() + remaining; let timer, abort;
      try {
        const value = await Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('分享画面采样单步超时。')), remaining); if (signal) { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }); } })]);
        aborted(signal); if (performance.now() > stepDeadline) throw new Error('分享画面采样回读已超时，未采用迟到画面。'); return value;
      }
      finally { clearTimeout(timer); if (abort) signal.removeEventListener('abort', abort); }
    };
    const resource = async (pending, dispose) => {
      try { return await bounded(pending); }
      catch (error) { void Promise.resolve(pending).then(dispose).catch(() => {}); throw error; }
    };
    const blocked = state => state.loginRequired || state.verificationRequired || state.privateChatVisible || state.unsupportedPage || state.livePreview?.recognized === true || state.videoSelection?.identityConflict;
    try {
      aborted(signal); await this.checkVideoLimits('douyin_observe');
      const initial = await bounded(this.state({ record: false })), videoId = initial.video?.id;
      if (!videoId || blocked(initial)) throw new Error('分享采样没有可核对的公开视频，或页面被登录、验证、私信遮挡。');
      const videoLocator = await bounded(this.currentVideo());
      handle = await resource(videoLocator.elementHandle(), value => value?.dispose());
      if (!handle) throw new Error('分享视频元素已变化，未采样。');
      const read = async () => {
        aborted(signal); await this.checkVideoLimits('douyin_observe');
        const state = await bounded(this.state({ record: false }));
        if (blocked(state) || state.video?.id !== videoId) throw new Error('分享截图前后作品身份或页面遮挡状态改变，未采用画面。');
        const value = await bounded(handle.evaluate(video => {
          const get = key => Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, key)?.get?.call(video);
          const rectangle = Element.prototype.getBoundingClientRect.call(video), quality = HTMLVideoElement.prototype.getVideoPlaybackQuality?.call(video);
          return { connected: video.isConnected && video.ownerDocument === document, time: get('currentTime'), duration: get('duration'), paused: get('paused'), readyState: get('readyState'), loop: get('loop'), playbackRate: get('playbackRate'), seeking: get('seeking'), source: get('currentSrc'),
            decodedFrames: quality?.totalVideoFrames, documentTimeOrigin: performance.timeOrigin, pageTimeMs: performance.now(),
            viewport: { x: Math.max(0, rectangle.x), y: Math.max(0, rectangle.y), width: Math.max(0, Math.min(innerWidth, rectangle.right) - Math.max(0, rectangle.x)), height: Math.max(0, Math.min(innerHeight, rectangle.bottom) - Math.max(0, rectangle.y)) } };
        }));
        if (value.connected !== true || value.paused !== false || value.seeking !== false || !Number.isInteger(value.readyState) || value.readyState < 2 || !Number.isFinite(value.duration) || value.duration <= 0
          || !Number.isFinite(value.time) || !Number.isFinite(value.playbackRate) || value.playbackRate <= 0 || value.playbackRate > 4 || typeof value.loop !== 'boolean' || !Number.isFinite(value.documentTimeOrigin) || !Number.isFinite(value.pageTimeMs)
          || typeof value.source !== 'string' || !value.source || value.source.length > 8192 || !Number.isSafeInteger(value.decodedFrames) || value.decodedFrames < 0) throw new Error('分享视频的播放、解码或采样身份状态无效。');
        const { source, connected, ...metadata } = value;
        return { state, bound: { ...metadata, videoId, elementToken, sourceHash: sharedHash(source), hostTimeMs: performance.now() } };
      };
      const frames = []; let sampledState = initial;
      for (let index = 0; index < 3; index++) {
        const due = startedHostMs + index * seconds * 1000 / 2 - performance.now();
        if (due > 0) await wait(due, signal);
        const before = await read(), viewport = before.bound.viewport;
        if (!viewport || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(viewport[key])) || viewport.width < 2 || viewport.height < 2) throw new Error('分享视频采样区域不可见。');
        if (frames.length && sharedProgress(frames.at(-1).captureInterval.after, before.bound) === null) throw new Error('分享采样间的播放推进与宿主时间不符，可能发生跳转或seek，未采用画面。');
        const screenshotStartedHostMs = performance.now();
        let captured = await bounded(handle.evaluate(function videoCanvasFrame(video) {
          const get = key => Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, key)?.get?.call(video);
          const dimension = key => Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, key)?.get?.call(video);
          if (!video.isConnected || video.ownerDocument !== document || get('paused') !== false || get('seeking') !== false || get('readyState') < 2) throw new Error('分享视频画面采集时元素、播放或seek状态改变。');
          const width = dimension('videoWidth'), height = dimension('videoHeight');
          if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width > 32768 || height > 32768) throw new Error('分享视频没有可靠的原始画面尺寸。');
          const ratio = Math.min(1, 960 / width, 960 / height, Math.sqrt(921600 / (width * height)));
          const canvas = document.createElement('canvas'); canvas.width = Math.max(2, Math.floor(width * ratio)); canvas.height = Math.max(2, Math.floor(height * ratio));
          try {
            const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器没有提供分享画布上下文。');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const encoded = canvas.toDataURL('image/jpeg', 0.65);
            if (!encoded.startsWith('data:image/jpeg;base64,')) throw new Error('分享画布没有生成JPEG视频画面。');
            return { data: encoded.slice('data:image/jpeg;base64,'.length), width: canvas.width, height: canvas.height, method: 'video-canvas-jpeg-v1' };
          } catch (error) { if (error?.name === 'SecurityError') return { corsBlocked: true }; throw error; }
          finally { canvas.width = 0; canvas.height = 0; }
        }));
        if (captured?.corsBlocked === true) {
          if (!session) session = await resource(this.page.context().newCDPSession(this.page), value => value?.detach());
          const fallback = await bounded(session.send('Page.captureScreenshot', { format: 'jpeg', quality: 65, clip: { ...viewport, scale: 1 }, captureBeyondViewport: false, fromSurface: true }));
          captured = { ...fallback, width: viewport.width, height: viewport.height, method: 'cdp-page-screenshot-interval-v1' };
        }
        const screenshotEndedHostMs = performance.now(), after = await read();
        if (sharedProgress(before.bound, after.bound) === null) throw new Error('分享截图期间视频暂停、换源、跳转或播放推进异常，未采用画面。');
        if (typeof captured.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(captured.data) || captured.data.length % 4 || Buffer.byteLength(captured.data, 'base64') < 1 || Buffer.byteLength(captured.data, 'base64') > 2_000_000) throw new Error('分享截图没有生成有界实际画面。');
        frames.push({ mimeType: 'image/jpeg', data: captured.data, videoId, time: before.bound.time, timeSemantics: 'capture-before-boundary', captureMethod: captured.method, captureSize: { width: captured.width, height: captured.height }, captureInterval: { index, before: before.bound, after: after.bound, screenshotStartedHostMs, screenshotEndedHostMs } });
        sampledState = after.state;
      }
      const endedHostMs = frames.at(-1).captureInterval.after.hostTimeMs, actualWallSeconds = (endedHostMs - startedHostMs) / 1000;
      const first = frames[0].captureInterval.before, last = frames.at(-1).captureInterval.after, progressed = sharedProgress(first, last);
    if (progressed === null || progressed <= 0.1 || last.decodedFrames <= first.decodedFrames || actualWallSeconds > Math.max(10,seconds+7)) throw new Error('分享采样未取得可靠的视频推进和解码证据，未把静止画面当视频。');
      const methods = frames.map(frame => frame.captureMethod), captureMethod = new Set(methods).size === 1 ? methods[0] : 'mixed-video-canvas-and-cdp-v1';
      const result = { state: sampledState, frames, observation: { seconds, requestedSeconds: seconds, actualWallSeconds, captureMethod, frameCount: frames.length, videoId, beforeTime: first.time, afterTime: last.time, beforePaused: first.paused, paused: last.paused, playbackProgressSeconds: progressed, note: '分时视频画面采样；时间标记是截图前边界，不是图片精确时点；没有音频，不代表看完整条。' },
        frameProof: { issuer: SHARED_PROOF_ISSUER, version: 1, signatureVersion: 1, captureId, videoId, frameCount: frames.length, captureMethods: methods, frameHashes: frames.map(frame => sharedHash(frame.data)), requestedSeconds: seconds, actualWallSeconds, startedHostMs, endedHostMs } };
      SHARED_PROOFS.set(result, { captureId, issuedHostMs: performance.now(), signature: sharedSignature(result) });
      if (!verifySharedVideoFrameProof(result, videoId)) throw new Error('宿主分享画面proof未通过完整核对，未返回视频画面。');
      return result;
    } finally { try { await session?.detach(); } finally { await handle?.dispose(); } }
  }
  async captureAudio(seconds,signal) {
    await this.checkVideoLimits('douyin_listen');
    const before=await this.state({record:false});
    if(before.loginRequired||before.verificationRequired||before.privateChatVisible||!before.video?.id) throw new Error('当前没有可录取的公开作品，或登录、验证、私信面板遮挡页面。');
    const result=await (await this.currentVideo()).evaluate(async(video,seconds)=>{
      if(typeof video.captureStream!=='function' || typeof MediaRecorder==='undefined') throw new Error('浏览器没有提供当前视频的可用音轨采集接口。');
      const wasPaused=video.paused; await video.play();
      const stream=video.captureStream();
      const tracks=stream.getAudioTracks().map(track=>track.clone());
      if(!tracks.length) {if(wasPaused)video.pause();throw new Error('当前作品没有向浏览器暴露可采集音轨，未录取其他声音。');}
      const audio=new MediaStream(tracks),chunks=[];
      const mimeType=['audio/webm;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
      if(!mimeType) {tracks.forEach(track=>track.stop());if(wasPaused)video.pause();throw new Error('浏览器不支持音轨录取格式。');}
      try {
        const recorder=new MediaRecorder(audio,{mimeType,audioBitsPerSecond:64000});
        await new Promise((resolve,reject)=>{
          let size=0; const timer=setTimeout(()=>recorder.state!=='inactive'&&recorder.stop(),seconds*1000);
          recorder.ondataavailable=event=>{size+=event.data.size;if(size>2_000_000){clearTimeout(timer);recorder.stop();reject(new Error('音轨超过2MB采集预算。'));}else chunks.push(event.data);};
          recorder.onerror=()=>{clearTimeout(timer);reject(new Error('当前视频音轨采集失败。'));};
          recorder.onstop=()=>{clearTimeout(timer);resolve();};recorder.start(250);
        });
        const bytes=new Uint8Array(await new Blob(chunks,{type:mimeType}).arrayBuffer());
        if(!bytes.length) throw new Error('当前音轨没有生成可用数据。');
        let encoded='';for(let offset=0;offset<bytes.length;offset+=32768) encoded+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
        return {data:btoa(encoded),mimeType,bytes:bytes.length};
      }finally{tracks.forEach(track=>track.stop());if(wasPaused)video.pause();}
    },seconds);
    aborted(signal);await this.checkVideoLimits('douyin_listen');
    const after=await this.state({record:false});
    if(after.loginRequired||after.verificationRequired||after.privateChatVisible||after.unsupportedPage||after.video?.id!==before.video.id) throw new Error('录音期间页面或作品身份改变，音轨已丢弃。');
    return {...result,videoId:before.video.id,beforeTime:before.video.time,afterTime:after.video.time,seconds,state:after};
  }
}
