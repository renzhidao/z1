import { Chat, Moment } from './types';

export const MOCK_CHATS: Chat[] = [
  {
    id: 'gemini-bot',
    user: {
      id: 'gemini',
      name: 'Gemini 智能助手',
      avatar: 'https://picsum.photos/seed/gemini/200/200', 
    },
    lastMessage: '你好！我是你的 AI 助手，有什么可以帮你的吗？',
    timestamp: '刚刚',
    unreadCount: 1,
    isMuted: false,
    isAi: true,
    messages: [
      {
        id: 'm1',
        text: '你好！我是由 Google Gemini 驱动的智能助手。你可以问我任何问题，或者只是聊聊天！',
        senderId: 'gemini',
        timestamp: new Date()
      }
    ]
  },
  {
    id: 'top-1',
    user: {
      id: 'file-transfer',
      name: '文件传输助手',
      avatar: 'https://picsum.photos/seed/files/200/200',
    },
    lastMessage: '[图片]',
    timestamp: '13:42',
    unreadCount: 0,
    isMuted: false,
    messages: [
      { id: 'f1', text: 'project_v2_final.pdf', senderId: 'me', timestamp: new Date(Date.now() - 3600000) },
      { id: 'f2', text: '[图片]', senderId: 'me', timestamp: new Date(Date.now() - 1800000) }
    ]
  },
  {
    id: 'subs',
    user: {
      id: 'subscriptions',
      name: '订阅号消息',
      avatar: 'https://picsum.photos/seed/blue/200/200',
    },
    lastMessage: '36氪: 刚刚，苹果发布会定档！iPhone 16 要来了...',
    timestamp: '12:05',
    unreadCount: 8,
    isMuted: false,
    isService: true,
    messages: [
       { id: 's1', text: '36氪: 刚刚，苹果发布会定档！iPhone 16 要来了...', senderId: 'subscriptions', timestamp: new Date() }
    ]
  },
  {
    id: 'services',
    user: {
      id: 'services_folder',
      name: '服务通知',
      avatar: 'https://picsum.photos/seed/orange/200/200',
    },
    lastMessage: '微信支付: 信用卡还款成功通知',
    timestamp: '昨天',
    unreadCount: 0,
    isMuted: false,
    isService: true,
    messages: []
  },
  {
    id: 'group1',
    user: {
      id: 'family_group',
      name: '相亲相爱一家人 ❤️',
      avatar: 'https://picsum.photos/seed/family/200/200',
    },
    lastMessage: '二姑: [动画表情]',
    timestamp: '昨天',
    unreadCount: 0,
    isMuted: true,
    messages: [
      { id: 'g0', text: '这周日大家有空回来吃饭吗？', senderId: 'u3', timestamp: new Date(Date.now() - 86400000 * 2) },
      { id: 'g1', text: '我有空！想吃红烧鱼🐟', senderId: 'me', timestamp: new Date(Date.now() - 86400000 * 2 + 3000) },
      { id: 'g2', text: '[语音] 8"', senderId: 'u4', timestamp: new Date(Date.now() - 86400000) },
      { id: 'g3', text: '好的，那我去买菜。', senderId: 'u3', timestamp: new Date(Date.now() - 86000000) },
      { id: 'g4', text: '二姑: [动画表情]', senderId: 'u5', timestamp: new Date(Date.now() - 80000000) }
    ]
  },
  {
    id: 'pay',
    user: {
      id: 'wechat_pay',
      name: '微信支付',
      avatar: 'https://picsum.photos/seed/pay/200/200',
    },
    lastMessage: '微信支付凭证',
    timestamp: '11月26日',
    unreadCount: 0,
    isMuted: false,
    messages: []
  },
  {
    id: 'friend1',
    user: {
      id: 'friend_1',
      name: '陈总 (设计)',
      avatar: 'https://picsum.photos/seed/sarah/200/200',
    },
    lastMessage: '好的，设计稿稍后发给你确认。',
    timestamp: '11月26日',
    unreadCount: 0,
    isMuted: false,
    messages: [
      { id: 'wd1', text: '陈总，首页的 Banner 图颜色是不是有点太深了？', senderId: 'me', timestamp: new Date(Date.now() - 172800000) },
      { id: 'wd2', text: '我也觉得，稍微调亮一点比较好。', senderId: 'friend_1', timestamp: new Date(Date.now() - 172700000) },
      { id: 'wd3', text: '另外，Logo 的位置往左移 10px。', senderId: 'me', timestamp: new Date(Date.now() - 172600000) },
      { id: 'wd4', text: '收到，我现在改。', senderId: 'friend_1', timestamp: new Date(Date.now() - 172500000) },
      { id: 'wd5', text: '改好了，发你看看。', senderId: 'friend_1', timestamp: new Date(Date.now() - 170000000) },
      { id: 'wd6', text: '好的，设计稿稍后发给你确认。', senderId: 'friend_1', timestamp: new Date(Date.now() - 169000000) }
    ]
  },
  {
    id: 'team',
    user: {
      id: 'team_wechat',
      name: '微信团队',
      avatar: 'https://picsum.photos/seed/team/200/200',
    },
    lastMessage: '登录安全提醒',
    timestamp: '10月26日',
    unreadCount: 0,
    isMuted: false,
    messages: []
  },
  {
    id: 'friend2',
    user: {
      id: 'friend_2',
      name: '奶奶',
      avatar: 'https://picsum.photos/seed/grandma/200/200',
    },
    lastMessage: '[语音] 15"',
    timestamp: '10月26日',
    unreadCount: 0,
    isMuted: false,
    messages: [
      { id: 'gm1', text: '乖孙，最近工作忙不忙呀？', senderId: 'friend_2', timestamp: new Date(Date.now() - 259200000) },
      { id: 'gm2', text: '还可以，奶奶您身体怎么样？', senderId: 'me', timestamp: new Date(Date.now() - 259100000) },
      { id: 'gm3', text: '[语音] 12"', senderId: 'friend_2', timestamp: new Date(Date.now() - 259000000) },
      { id: 'gm4', text: '一定要注意休息，别太累了。', senderId: 'friend_2', timestamp: new Date(Date.now() - 258900000) },
      { id: 'gm5', text: '知道了奶奶，周末回去看您！❤️', senderId: 'me', timestamp: new Date(Date.now() - 258800000) },
      { id: 'gm6', text: '[语音] 15"', senderId: 'friend_2', timestamp: new Date(Date.now() - 258700000) }
    ]
  },
  {
    id: 'friend3',
    user: {
      id: 'friend_3',
      name: '阿杰',
      avatar: 'https://picsum.photos/seed/alex/200/200',
    },
    lastMessage: '今晚开黑吗？我拉你。',
    timestamp: '10月23日',
    unreadCount: 0,
    isMuted: true,
    messages: [
      { id: 'aj1', text: '兄弟，上次那家火锅店真不错。', senderId: 'friend_3', timestamp: new Date(Date.now() - 400000000) },
      { id: 'aj2', text: '是啊，下次再去。', senderId: 'me', timestamp: new Date(Date.now() - 399000000) },
      { id: 'aj3', text: '[语音] 4"', senderId: 'friend_3', timestamp: new Date(Date.now() - 398000000) },
      { id: 'aj4', text: '今晚开黑吗？我拉你。', senderId: 'friend_3', timestamp: new Date(Date.now() - 390000000) }
    ]
  },
   {
    id: 'friend4',
    user: {
      id: 'friend_4',
      name: '小姨',
      avatar: 'https://picsum.photos/seed/aunt/200/200',
    },
    lastMessage: '收到，谢谢！',
    timestamp: '10月21日',
    unreadCount: 0,
    isMuted: false,
    messages: [
      { id: 'au1', text: '给你寄的特产收到了吗？', senderId: 'friend_4', timestamp: new Date(Date.now() - 500000000) },
      { id: 'au2', text: '收到了，太好吃了！', senderId: 'me', timestamp: new Date(Date.now() - 499000000) },
      { id: 'au3', text: '收到，谢谢！', senderId: 'friend_4', timestamp: new Date(Date.now() - 498000000) }
    ]
  },
];

export const MOCK_MOMENTS: Moment[] = [
  {
    id: 'm1',
    user: {
      id: 'friend_1',
      name: '陈总 (设计)',
      avatar: 'https://picsum.photos/seed/sarah/200/200',
    },
    content: '新项目终于上线了，感谢团队的努力！🚀 加班的日子结束了，今晚好好睡一觉。',
    images: [
      'https://picsum.photos/seed/work1/400/300',
      'https://picsum.photos/seed/work2/400/300',
      'https://picsum.photos/seed/work3/400/300',
    ],
    time: '2小时前',
    likes: [{ user: { id: 'u1', name: '大白', avatar: '' } }, { user: { id: 'u2', name: '阿杰', avatar: '' } }],
    comments: [
      { id: 'c1', user: { id: 'u1', name: '大白', avatar: '' }, text: '辛苦了！界面做得真不错。' }
    ]
  },
  {
    id: 'm2',
    user: {
      id: 'friend_3',
      name: '阿杰',
      avatar: 'https://picsum.photos/seed/alex/200/200',
    },
    content: '周末去爬山，风景真的太美了！空气清新，心情舒畅。推荐大家多出去走走。⛰️',
    images: [
      'https://picsum.photos/seed/mountain/400/500',
    ],
    time: '4小时前',
    likes: [{ user: { id: 'u3', name: '陈总 (设计)', avatar: '' } }],
    comments: []
  },
  {
    id: 'm3',
    user: {
      id: 'family_group',
      name: '二姑',
      avatar: 'https://picsum.photos/seed/family/200/200',
    },
    content: '只要心态好，每天都是晴天。早安，家人们！🌹🌹🌹 [太阳][太阳]',
    time: '昨天',
    likes: [{ user: { id: 'me', name: '我', avatar: '' } }],
    comments: []
  },
  {
    id: 'm4',
    user: {
      id: 'friend_4',
      name: '小姨',
      avatar: 'https://picsum.photos/seed/aunt/200/200',
    },
    content: '今天做的红烧肉，味道不错，下次回来做给你们吃。',
    images: [
      'https://picsum.photos/seed/food1/300/300',
      'https://picsum.photos/seed/food2/300/300',
      'https://picsum.photos/seed/food3/300/300',
      'https://picsum.photos/seed/food4/300/300',
    ],
    time: '昨天',
    likes: [{ user: { id: 'me', name: '我', avatar: '' } }, { user: { id: 'u5', name: '妈妈', avatar: '' } }],
    comments: [
      { id: 'c2', user: { id: 'me', name: '我', avatar: '' }, text: '看着就香！流口水了🤤' }
    ]
  }
];