import { expect, it } from 'vitest';
import { openDatabase } from '../storage/database.js';
import { PlatformScenes } from './platform-scenes.js';

it('recalls an older watched topic across platforms with bounded, attributable evidence', () => {
  const db = openDatabase(':memory:');
  try {
    const put = db.prepare('INSERT INTO activity_records(id,kind,source_id,summary,occurred_at) VALUES(?,?,?,?,?)');
    const bili = (title: string, content: string) =>
      `读取 B站视频《${title}》 https://example.invalid/video；证据：官方字幕、9 帧采样画面。模型总结：${content}`;
    put.run('bilibili:a', 'bilibili.watched', 'a', bili('鲸鱼迁徙', '鲸鱼迁徙会经过冷水海域。'), '2026-01-01');
    put.run('douyin:b', 'douyin.watched', 'b',
      '观看抖音《深海声音》 https://example.invalid/clip；实际3帧采样，其中2帧用于理解。模型总结：' +
      '潮汐。'.repeat(350) + '鲸鱼迁徙时发出的叫声被潜水员录下。', '2026-01-02');
    for (let i = 0; i < 1010; i++) {
      put.run('recent-' + i, 'bilibili.watched', 'bili-' + i, bili('手工木刻', '练习在木头上刻字。'), '2026-08-01');
    }
    put.run('qq:secret', 'qq.received', 'private', '鲸鱼迁徙私聊内容', '2026-10-01');
    put.run('suggested', 'scheduled.decision', 'later', '计划明天看鲸鱼迁徙的课程', '2026-10-02');

    const history = new PlatformScenes(db);
    const retrieved = history.recall('你之前看过哪些关于鲸鱼迁徙的视频？');
    expect(retrieved.map(r => [r.id, r.sourceId, r.platform])).toEqual([
      ['bilibili:a', 'a', 'bilibili'], ['douyin:b', 'b', 'douyin'],
    ]);
    expect(retrieved[1]?.summary).toContain('叫声');
    expect(retrieved.every(r => r.summary.length <= 480)).toBe(true);
    expect(history.recall('鲸鱼', { platform: 'bilibili', excludeSourceId: 'a' })).toEqual([]);
    expect(history.recall('鲸鱼', { platform: 'douyin' })[0]?.occurredAt).toBe('2026-01-02');
    expect(history.recall('官方字幕')).toEqual([]); // Appears only in the sampling template.
    expect(history.recall('最近在抖音看了吗', { platform: 'douyin', recent: true })[0]?.id).toBe('douyin:b');
    expect(history.recall('火星车', { recent: true })).toEqual([]);
    const recent = history.recall('', { recent: true, limit: 200 });
    expect(recent).toHaveLength(4);
    expect(recent.every(r => r.id.startsWith('recent-'))).toBe(true);
    for (const question of ['最近刷到啥了', '最近在 B 站看了些什么', '这几天看了哪些视频', '你上次在 B 站看的是什么呀']) {
      expect(history.recall(question, { recent: true, limit: 1 })[0]?.id).toBe(recent[0]?.id);
    }
    expect(history.recall('最近刷到鲸鱼了吗', { recent: true }).map(row => row.id)).toEqual(['bilibili:a', 'douyin:b']);
    expect(history.recall('')).toEqual([]);
  } finally {
    db.close();
  }
});
