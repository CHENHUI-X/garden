import charm from "astro-charm";

export default charm({
  config: {
    lang: "zh-CN",
    title: "IUHNEHC",
    titleSuffix: " · 随想",
    description: "记录日常的碎碎念、读书感悟和胡思乱想",
    author: "CHENHUI",
    licenseId: "CC-BY-NC-SA-4.0",
    shootingStar: false,
    font: "disabled",
    side: {
      title: "IUHNEHC",
      sub: "",
      bio: "人无法同时拥有青春和对青春的感受",
      navHome: {
        title: "首页",
        link: "/",
      },
      footer: [
        {
          title: "GitHub",
          link: "https://github.com/CHENHUI-X",
          icon: "simple-icons:github",
        },
      ],
    },
    markdown: {
      headingAnchor: "#",
    },
  },
  pages: {
    "/": false,
    "/posts/[...slug]": false,
    "/[...special]": false,
    "/search": false,
    "/tags": false,
    "/tags/[tag]": false,
    "/categories": false,
    "/categories/[category]": false,
  },
  overrides: {
    components: {
      ShootingStar: undefined,
    },
  },
});
