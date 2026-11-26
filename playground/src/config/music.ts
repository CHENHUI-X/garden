/**
 * CHENHUI 网易云音乐歌单与个人主页配置
 * 替换你自己的歌单非常方便：
 * 1. 打开网易云音乐歌单 -> 分享 -> 复制链接，取 `playlist?id=数字` 中的数字填到 playlistId；
 * 2. 打开你的网易云个人主页 -> 复制链接，填到 neteaseProfileUrl（用于「去网易云关注我」导流）。
 */
export const MUSIC_CONFIG = {
  /** 网易云歌单 ID（CHENHUI 的日常歌单，可随时替换成其他公开歌单 ID） */
  playlistId: "2362187252",
  /** 歌单展示标题 */
  playlistTitle: "CHENHUI · 日常留声",
  /** 歌单副标题 */
  playlistSubtitle: "骑车吹风、深夜读书、发呆时循环的歌",
  /** 网易云个人主页链接（用于「去网易云关注 CHENHUI」导流） */
  neteaseProfileUrl: "https://music.163.com/#/user/home?id=530882324",
  /** 展示的网易云昵称 */
  neteaseNickname: "CHENHUI",
  /** 公开 Meting API 镜像节点（按顺序自动容错切换，也支持替换为你自建的 Meting-API） */
  apiMirrors: [
    "https://api.injahow.cn/meting/?server=netease&type=playlist&id={id}",
    "https://api.qijieya.cn/meting/?server=netease&type=playlist&id={id}",
    "https://api.i-meto.com/meting/api?server=netease&type=playlist&id={id}",
  ],
} as const;
