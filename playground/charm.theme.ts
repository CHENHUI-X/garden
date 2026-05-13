import charm from "astro-charm";

export default charm({
  config: {
    lang: "zh-CN",
    title: "IUHNEHC",
    titleSuffix: " · 随想",
    description: "记录日常的碎碎念、读书感悟和胡思乱想",
    author: "CHENHUI",
    licenseId: "CC-BY-NC-SA-4.0",
    shootingStar: true,
    font: "auto",
    side: {
      title: "IUHNEHC",
      sub: "",
      bio: "人无法同时拥有青春和对青春的感受",
      navHome: {
        title: "首页",
        link: "/",
        icon: {
          default: "solar:home-smile-broken",
          hover: "solar:home-smile-outline",
          active: "solar:home-smile-bold-duotone",
        },
      },
      footer: [
        {
          title: "GitHub",
          link: "https://github.com/CHENHUI-X",
          icon: "simple-icons:github",
        },
        {
          title: "Bilibili",
          link: "https://space.bilibili.com/294132471",
          icon: "simple-icons:bilibili",
        },
        {
          title: "Email",
          link: "mailto:chenhui2422.xu@gmail.com",
          icon: "simple-icons:gmail",
        },
        {
          title: "TechBlog",
          link: "https://xuchenhui.cc/",
          icon: "simple-icons:developmentcontainers",
        },
      ],
      navStyle: "default",
      footerStyle: "default",
      toc: {
        enabled: true,
        title: "目录",
        minLength: 2,
      },
    },
    markdown: {
      headingAnchor: "#",
    },
  },
  pages: {
    "/": false,
    "/posts/[...slug]": false,
  },
  overrides: {
    components: {
      ShootingStar: undefined,
    },
    custom: {
      CustomScriptComponent: "./src/components/CustomScriptComponent.astro",
      CustomPostHeaderBottom: "./src/components/CustomPostHeaderBottom.astro",
      CustomPostFooterBottom: "./src/components/WalineComment.astro",
    },
  },
});
