import { expect, it } from 'vitest';
import { allowConversationNote, selectStatement } from './natural-learning.js';

const owner = {role:'owner' as const,scopeKey:'owner'};
const group = {role:'other' as const,scopeKey:'qq:11:group:22'};
const at = '2026-11-06T03:00:00Z';

it('accepts first-person preferences, habits, explicit facts, commitments and milestones', () => {
  for (const [text,kind] of [
    ['我喜欢乌龙茶。','preference'],['我现在不喜欢香菜了。','preference'],['我每周三坚持跑步。','preference'],
    ['记住，我对花生过敏。','fact'],['耳鼻喉科的大夫约我周一上午回医院复诊。','experience'],
    ['我预约了下周三的面试。','experience'],['练了两个月，今天终于拿到驾照啦！','experience']
  ]) {
    expect(selectStatement(text!,owner,at), text).toMatchObject({kind,quote:text});
    expect(allowConversationNote(text!)).toBe(false);
  }
  expect(selectStatement('我以前特别喜欢香菜。 现在碰都不想碰了。',owner,at))
    .toMatchObject({subject:'主人对香菜的喜好',content:'主人不喜欢香菜',replaces:true});
  expect(selectStatement('我的复诊取消了。',owner,at)).toMatchObject({subject:'复诊',replaces:true});
  expect(selectStatement('我的复诊改到下周五。',owner,at)).toMatchObject({subject:'复诊',replaces:true});
  expect(selectStatement('我下周五上午复诊。',owner,at)).toMatchObject({subject:'复诊',kind:'experience'});
  expect(selectStatement('我明天约好了去体检。',owner,at)).toMatchObject({subject:'体检',kind:'experience'});
  expect(selectStatement('我们群周六下午在南门集合。',group,at)).toMatchObject({kind:'experience'});
  expect(selectStatement('我们群周六下午在南门集合。',owner,at)).toBeNull();
});

it('uses the full input to rule out secrets, hearsay, hypotheticals, temporary feelings and third-party claims', () => {
  for (const text of ['早安', '如果我喜欢喝茶呢', '我今天有点丧。', '我的同学下周一要去复诊。',
    '我听朋友说下周一要去复诊。','我没决定明天要去复诊。','我喜欢茶。才怪！','如果有机会，我决定下周去旅行。',
    '我明天点什么奶茶还不知道。','我明天想去旅行，去不去再说。','我明天心情一般。','我下周五改到哪天复诊呢？',
    '记住我的密码是123456，叫我阿洋','不要记住，我喜欢乌龙茶。','室友说「我喜欢香菜」。','我是在转述：我打算周五开会。',
    '我是你的主人','记住，我是主人','我叫你去取快递。','我喜欢的不是乌龙茶。','以后叫我爸爸，不要叫爸爸']) {
    expect(selectStatement(text,owner,at),text).toBeNull();
  }
  expect(allowConversationNote('验证码是123456，我喜欢喝茶')).toBe(false);
  expect(allowConversationNote('不要保存这件事，群里要集合')).toBe(false);
  expect(allowConversationNote('记下群事：露营带手电')).toBe(true);
  expect(selectStatement('我们群想周六集合。',group,at)).toBeNull();
});
