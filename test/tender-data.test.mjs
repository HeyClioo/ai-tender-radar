import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanTenderSummary,
  dedupeTenderRows,
} from '../public/tender-data.js';

test('重复公告合并为字段更完整、正文更丰富的一条记录', () => {
  const shared = {
    title: '某高校AI助教智能体采购项目',
    region: '广东省-广州市',
    buyer: '某高校',
    projectNo: 'AI-2026-001',
    budgetText: '预算19万元',
    winnerAmountText: '',
    publishText: '2小时前',
  };
  const rows = dedupeTenderRows('2026-08-03', [
    {
      ...shared,
      visibleSummary: '点击查看公告内容：某高校AI助教智能体采购项目.pdf',
      noticeType: '',
      agency: '',
      categories: ['服务'],
    },
    {
      ...shared,
      visibleSummary: '某高校AI助教智能体采购项目某高校AI助教智能体采购项目采购AI助教、知识库问答与课程资源生成服务，并形成完整采购范围。',
      noticeType: '招标公告',
      agency: '某代理机构',
      categories: ['教育', '服务'],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].noticeType, '招标公告');
  assert.equal(rows[0].agency, '某代理机构');
  assert.equal(rows[0].visibleSummary, '采购AI助教、知识库问答与课程资源生成服务，并形成完整采购范围。');
  assert.deepEqual(rows[0].categories, ['服务', '教育']);
});

test('正文开头重复出现的公告标题会被清理', () => {
  assert.equal(
    cleanTenderSummary('AI项目询比公告', 'AI项目询比公告AI项目询比公告采购范围如下。'),
    '采购范围如下。',
  );
});

test('只有附件名称时保留可见信息而不是生成空正文', () => {
  assert.equal(
    cleanTenderSummary('AI项目询比公告', '点击查看公告内容：AI项目询比公告.pdf'),
    'AI项目询比公告.pdf',
  );
});
