import type { MemoryKind } from './types.js';

type Speaker = { role: 'owner' | 'other'; scopeKey: string };
export interface Statement {
  kind: MemoryKind;
  subject: string;
  content: string;
  quote: string;
  replaces: boolean;
}

const secret = /密码|口令|验证码|密钥|令牌|身份证|银行卡|手机号|电话号码|家庭住址|收货地址|私钥|凭据|\b(?:token|password|secret|api[ _-]?key|bearer|credential)\b|\bsk-[\w-]{8,}|\b1[3-9]\d{9}\b|\b\d{15,19}[\dXx]?\b/iu;
const optOut = /别记|别保存|不要记|不用记|不要保存|不许记|别告诉别人|忘掉|忘了它|不要存|别存|do not (save|remember)|don't (save|remember)/iu;
const uncertain = /如果|假[如设装]|要是|打个比方|比[如方]|举个?例|例如|可能|也许|大概|好像|似乎|不确定|才怪|开个?玩笑|角色扮演|台词|字幕|歌词|小说|转述|听说|据说|我(?:听.{0,8}说|猜|以为|觉得可能|怀疑|替.{0,5}说)|(?:他|她|别人|有人|朋友|同事|同学|爸妈|妈妈|爸爸|老[师板])(?:跟我|对我)?(?:说|讲|告诉我)|[“”「」『』"《》?？]|[吗么][。！!]?$/u;

// These boundaries can govern later sentences. Splitting before checking them could turn
// quoted dialogue, a retraction, or a request for privacy into a first-person assertion.
export function unsafeMemoryTurn(text: string) {
  return secret.test(text) || optOut.test(text)
    || /[“”「」『』"《》]|才怪|开个?玩笑|角色扮演|台词|字幕|歌词|小说|转述|代.{0,4}发言|以下.{0,8}(?:原文|对话)|(?:他说|她说|朋友说|同事说|别人说|听说|据说)[:：]|(?:说|写道|问道|原文|举例|例如)[:：]/u.test(text);
}

export function shouldSkipMemory(text: string) {
  return !text.trim() || secret.test(text) || optOut.test(text) || uncertain.test(text);
}

const time = /今天|明天|后天|昨天|星期[一二三四五六天日]|(?:上|这|下)?(?:周|礼拜)[一二三四五六天日末]|[上下本这](?:个?月|周)|(?:今晚|明早|明晚)|\d{1,2}[月号日点]|\d{4}-\d{1,2}-\d{1,2}/u;
const tentativePlan = /还没|尚未|不再|不打算|取消|不去了|去不了|没(?:有)?(?:决定|定下|想好)|未定|待定|待确认|不(?:知道|一定|确定)|再说|再决定|看情况|考虑|犹豫|纠结|有空就|的话|希望|想(?:要|去|在|回|约|聚餐|开会|集合|[上下本]?周|明天)|打算|要不要|能不能|去不去|会不会|想不想|是否|能否|什么|怎么|哪[个天家里儿]|[吧呢]$/u;
const name = /^[\p{Script=Han}A-Za-z]{1,12}$/u;
const unsafeValue = /我|你|自己|别人|(?:他|她)(?:的|们)|如果|其实|不过|因为|所以|或者|不要|别叫|记住|忽略|指令|现在|下次|今天|明天|一下|不是|才怪|说|[吗呢吧呀啦哦]/u;
function possibleName(value: string) {
  return name.test(value) && !unsafeValue.test(value)
    && !/^(?:去|帮|做|给|取|买|起床|过来|外卖|快递|出租车|他|她)/u.test(value);
}
const direct = /^(?:请|帮我)?(?:记住|记一下|记下来|记得)[，,:：、\s]*/u;
const dateOf = (at: string) => {
  const d = new Date(at);
  return Number.isFinite(+d) ? d.toLocaleDateString('sv-SE') : '';
};

// A compact self-introduction can attest several fields with one source. Require
// the entire assertion to parse so a relative's age or a hypothetical never leaks in.
export function demographicStatements(raw: string, speaker: Speaker): Statement[] {
  if (raw.length > 240 || shouldSkipMemory(raw)) return [];
  const text = raw.trim().replace(/[。！!.；;]+$/u,'').replace(direct,'')
    .replace(/^(?:(?:上次|刚刚|刚才)?说错了|更正一下|纠正一下|不对)[，,:：、\s]*/u,'')
    .replace(/^(?:我的(?:个人)?资料|自我介绍)[：:，,]\s*/u,'');
  const parts = text.split(/\s*[,，、；;]\s*/u);
  if (speaker.scopeKey.includes(':group:') && !parts.some(part => /^我/u.test(part))) return [];
  const who = speaker.role === 'owner' ? '主人' : '对方';
  const result: Statement[] = [];
  for (const part of parts) {
    const gender = /^(?:我(?:的性别)?(?:其实|现在)?(?:是|为)?|性别[：:为是]?)?([男女])(?:生|性|孩|的)?$/u.exec(part);
    const age = /^(?:我(?:的年龄)?(?:其实|现在|已经|刚满|刚过|是|为)?|年龄[：:为是]?)?(?:今年|现在|已满|刚满)?\s*(\d{1,3})\s*(?:周)?岁(?:了)?$/u.exec(part);
    const field = gender ? '性别' : '年龄';
    const value = gender?.[1] ?? (age && Number(age[1]) <= 125 ? Number(age[1])+'岁' : null);
    if (!value || result.some(s => s.subject===who+'的'+field)) return [];
    result.push({kind:'fact',subject:who+'的'+field,content:who+'的'+field+'：'+value,quote:raw.trim(),replaces:true});
  }
  return result;
}

export function selectStatement(raw: string, speaker: Speaker, at: string): Statement | null {
  const quote = raw.trim();
  if (quote.length > 480 || shouldSkipMemory(quote)) return null;
  // Examine the entire assertion. Never save just the positive half of a negation or correction.
  const line = quote.replace(/[。！!.]+$/u, '');
  const reversal = /^我(?:以前|原先|曾经)(?:特别|很)?喜欢(.{1,20}?)[。！!，,]\s*(?:但|不过)?(?:我)?现在(?:已经)?(?:不喜欢|不再喜欢|碰都不想碰)(?:了)?$/u.exec(line);
  const explicit = direct.test(line);
  const text = (reversal && !unsafeValue.test(reversal[1]!)
    ? '我不喜欢'+reversal[1]
    : line.replace(direct,'').replace(/^(?:(?:上次|刚才)?说错了[，,]\s*|其实(?=我))/u,'')).trim();
  if (!text || /[。！!\n]/u.test(text)) return null;
  const who = speaker.role === 'owner' ? '主人' : '对方';
  const entry = (kind: MemoryKind, subject: string, content: string, replaces = false): Statement =>
    ({ kind, subject, content, quote, replaces });
  const clauses = text.split(/\s*[,，]\s*/u);
  const alias = /^(?:以后|今后|从现在起)?(?:请)?(?:改叫我|叫我|称呼我)([\p{Script=Han}A-Za-z]+)$/u;
  const addressed = clauses.find(clause => alias.test(clause));
  if (addressed) {
    const value = alias.exec(addressed)![1]!;
    if (clauses.length > 2 || !possibleName(value)) return null;
    if (clauses.length === 2) {
      const other = clauses.find(c => c !== addressed) || '';
      const old = /^(?:不要|别)(?:再)?(?:叫|称呼)(?:我)?([\p{Script=Han}A-Za-z]+?)了?$/u.exec(other);
      if (!old || old[1] === value) return null;
    }
    return entry('preference', who+'的称呼', who+'希望被称为'+value, true);
  }
  const named = /^(?:我的名字是|我叫)([\p{Script=Han}A-Za-z]+)$/u.exec(text);
  if (named && possibleName(named[1]!))
    return entry('fact', who+'的名字', who+'的名字是'+named[1], true);

  const preference = /^我(?:一直|平时|现在|向来|特别|很|最)?(不再喜欢|不喜欢|喜欢|讨厌)([\p{L}\p{N}· ]{1,28}?)(?:了)?$/u.exec(text);
  if (preference && !unsafeValue.test(preference[2]!) && !/^(?:的是|的不是|的人|我的|这次|那个|的话)/u.test(preference[2]!)) {
    const item = preference[2]!.trim();
    const direction = preference[1] === '不再喜欢' ? '不喜欢' : preference[1];
    return entry('preference', who+'对'+item+'的喜好', who+direction+item, true);
  }
  if (/^(?:我(?:一直|平时|通常|习惯|总是|一般|每[天周年月])|每(?:天|周|年|个周末|个星期).{0,8}我)/u.test(text)
      && !/[，,]/u.test(text) && !/临时|这一次|这次|心情|有点|想要|以为/u.test(text))
    return entry('preference', text.slice(0,45), quote);

  const inGroup = speaker.scopeKey.includes(':group:');
  const groupPlan = /^(?:我们群|咱们群|本群|群里|全群|大家|我们|咱们)/u.test(text);
  const cancelled = /^(?:我的|我(?:已经|刚刚)?取消了)(复诊|体检|手术|面试|考试|聚餐|出差|旅行)(?:预约|安排)?(?:取消了|已取消)?$/u.exec(text);
  if (cancelled && text.includes('取消'))
    return entry('experience',cancelled[1]!,quote,true);
  const correction = /改[到为成]|改期|推迟到|提前到/u.test(text);
  const commitment = /(?:决定|约好|约了|定好|订好|预约|预订|报名|约我|定在|定于)|(?:要|得|会)(?:去|回|参加)|(?:去|回|参加).{0,10}(?:复诊|面试|考试|旅行|开会)|(?:[天日末一二三四五六点]|上午|中午|下午|晚上)(?:复诊|体检|面试|考试|出差)|(?:集合|聚餐|开会)$/u.test(text);
  const mine = /^(?:我(?:已经|确定|决定|定了|订了|预约|约了|打算|计划|会|得|要去|要回|的(?:复诊|体检|手术|面试|考试|出差|行程)|下周|这周|本周|周[一二三四五六天日末]|星期|明天|后天|今天|下个?月|[0-9]{1,2}[月号日])|(?:下周|这周|明天|周[一二三四五六日天末]|星期).{0,8}(?:我要|我会|我得|要去|得去))|(?:约|预约)(?:了)?我/u.test(text);
  if (tentativePlan.test(text)) return null;
  const episode = /复诊|体检|手术|面试|考试|开会|聚餐|集合|搬家|出差|旅行/u.exec(text)?.[0];
  const namedEvent = /^我的(.+?)(?:的)?(?:日期|时间|安排|预约)?(?:改[到为成]|改期|推迟到|提前到)/u.exec(text);
  const ownReschedule = !!namedEvent && namedEvent[1] === episode;
  if (time.test(text) && (commitment || correction) && (mine || ownReschedule || (inGroup && groupPlan))) {
    const date = dateOf(at);
    return entry('experience', episode ?? text.slice(0,45), (date ? '（'+date+'的留言）' : '') + quote, correction);
  }
  // A completed reservation has an identifiable object even when no date was mentioned.
  // Keep individual bookings distinct from the schedule of the whole trip or event.
  const booking = /^我(?:已经|刚刚|刚)?(?:(?:给|为)(?:这|那|本)(?:个|次|场|趟|项|届)[\p{L}\p{N}· -]{1,28}?)?(?:预订好|订好)了([\p{L}\p{N}· -]{1,40})$/u.exec(text);
  if (booking && !/没|不|取消|退订|退款|以为|听说|本来|似乎/u.test(text))
    return entry('experience',booking[1]!,quote);
  if (/^(?:我(?:今天|昨天|刚刚|终于|已经|成功|顺利)*|练了.{1,8}[，,](?:今天)?终于)(?:拿到|考过|通过|毕业|入职|领证|搬进)/u.test(text))
    return entry('experience', text.slice(0,45), (dateOf(at) ? '（'+dateOf(at)+'的留言）' : '')+quote);

  // Explicit requests can retain additional first-person facts. An instruction directed to
  // the assistant, another person's profile, or a temporary mood does not enter this lane.
  if (explicit && /^(?:我的|我是|我有|我养|我住|我对|我在|我每)/u.test(text)
    && !/主人|管理员|权限|账号|今天.{0,4}(?:想|喜欢|心情)|(?:我有点|我在想)|我对(?:你|他|她)说|我(?:的)?(?:朋友|同事|同学|室友|邻居|爸|妈).{0,6}(?:喜欢|讨厌|计划)/u.test(text))
    return entry('fact', text.slice(0,45), text);
  return null;
}

export function isConversationRequest(text: string) {
  return /^(?:(?:那|现在|下面|接下来|下一步|然后|咱们|我们|先|再)\s*)*(?:来聊|聊聊|谈谈|说说|换个(?:话题|问题)|说一下|问一下)|(?:^|[，,：:、])\s*(?:请|麻烦)?你(?:先|再|来|可以|能不能|帮我|要不要)?(?:问我|问问|说说|聊聊|介绍一下)/u.test(text.trim());
}

export function allowConversationNote(text: string) {
  const speaker = {role:'other',scopeKey:'private'} as const;
  return !shouldSkipMemory(text) && !isConversationRequest(text) && !text.split(/[。！？!?.；;\n]/u).some(clause => demographicStatements(clause,speaker).length > 0)
    && !selectStatement(text, {role:'other',scopeKey:'qq:group:note'}, '');
}
