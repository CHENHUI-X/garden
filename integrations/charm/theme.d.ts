
			type ThemeName = "charm";

			declare namespace AstroThemeProvider {
					export interface Themes {
							"charm": true;
					}

					export interface ThemeOptions {
							"charm": {
									pages?: { [Pattern in keyof ThemeRoutes]?: string | boolean } & {}
									overrides?: {
											[Module in keyof ThemeExports]?:
													ThemeExports[Module] extends Record<string, any>
															? ThemeExports[Module] extends string[]
																	?	string[]
																	: { [Export in keyof ThemeExports[Module]]?: string }
															: never
									} & {}
									integrations?: keyof ThemeIntegrationsResolved extends never
										? `${ThemeName} is not injecting any integrations`
										: { [Name in keyof ThemeIntegrationsResolved]?: boolean } & {}
							};
					}
			}
		
							interface ThemeExports {
								
							"assets": [],
						
							"components": {

TocSide: typeof import("/home/runner/work/garden/garden/package/src/components/TocSide.astro").default;
TocHeading: typeof import("/home/runner/work/garden/garden/package/src/components/TocHeading.astro").default;
Toc: typeof import("/home/runner/work/garden/garden/package/src/components/Toc.astro").default;
TagMindMap: typeof import("/home/runner/work/garden/garden/package/src/components/TagMindMap.astro").default;
ShootingStar: typeof import("/home/runner/work/garden/garden/package/src/components/ShootingStar.astro").default;
PostList: typeof import("/home/runner/work/garden/garden/package/src/components/PostList.astro").default;
PostHeader: typeof import("/home/runner/work/garden/garden/package/src/components/PostHeader.astro").default;
PostFooter: typeof import("/home/runner/work/garden/garden/package/src/components/PostFooter.astro").default;
Pagination: typeof import("/home/runner/work/garden/garden/package/src/components/Pagination.astro").default;
MobileMenu: typeof import("/home/runner/work/garden/garden/package/src/components/MobileMenu.astro").default;
LicenseDisplay: typeof import("/home/runner/work/garden/garden/package/src/components/LicenseDisplay.astro").default;
IconWrapper: typeof import("/home/runner/work/garden/garden/package/src/components/IconWrapper.astro").default;
IconLightDarkWrapper: typeof import("/home/runner/work/garden/garden/package/src/components/IconLightDarkWrapper.astro").default;
HomeSide: typeof import("/home/runner/work/garden/garden/package/src/components/HomeSide.astro").default;
HomePageHeader: typeof import("/home/runner/work/garden/garden/package/src/components/HomePageHeader.astro").default;
GoogleAnalytics: typeof import("/home/runner/work/garden/garden/package/src/components/GoogleAnalytics.astro").default;
FontLoader: typeof import("/home/runner/work/garden/garden/package/src/components/FontLoader.astro").default;
Empty: typeof import("/home/runner/work/garden/garden/package/src/components/Empty.astro").default;
ContentWrapper: typeof import("/home/runner/work/garden/garden/package/src/components/ContentWrapper.astro").default;
Comments: typeof import("/home/runner/work/garden/garden/package/src/components/Comments.astro").default;
BaseSide: typeof import("/home/runner/work/garden/garden/package/src/components/BaseSide.astro").default;
},
						
							"layouts": {

PostLayout: typeof import("/home/runner/work/garden/garden/package/src/layouts/PostLayout.astro").default;
MainLayout: typeof import("/home/runner/work/garden/garden/package/src/layouts/MainLayout.astro").default;
HomeLayout: typeof import("/home/runner/work/garden/garden/package/src/layouts/HomeLayout.astro").default;
BaseLayout: typeof import("/home/runner/work/garden/garden/package/src/layouts/BaseLayout.astro").default;
},
						
							"styles": ["/home/runner/work/garden/garden/package/src/styles/variable.css","/home/runner/work/garden/garden/package/src/styles/twoslash-style-rich.css","/home/runner/work/garden/garden/package/src/styles/global.css","/home/runner/work/garden/garden/package/src/styles/github-card.css","/home/runner/work/garden/garden/package/src/styles/admonition.css"],
						
							"userCustomStyle": ["/home/runner/work/garden/garden/playground/src/styles/custom-charm.css"],
						
							"custom": {

CustomScriptComponent: typeof import("/home/runner/work/garden/garden/playground/src/components/CustomScriptComponent.astro").default;
CustomPostHeaderTop: typeof import("/home/runner/work/garden/garden/package/src/components/Empty.astro").default;
CustomPostHeaderBottom: typeof import("/home/runner/work/garden/garden/playground/src/components/CustomPostHeaderBottom.astro").default;
CustomPostFooterTop: typeof import("/home/runner/work/garden/garden/package/src/components/Empty.astro").default;
CustomPostFooterBottom: typeof import("/home/runner/work/garden/garden/playground/src/components/WalineComment.astro").default;
},
						
							}
						
							interface ThemeRoutes {
								
"/[...special]": true
"/": true
"/rss.xml": true
"/search": true
"/categories/[category]": true
"/categories": true
"/posts/[...slug]": true
"/tags/[tag]": true
"/tags": true
							}
						
							interface ThemeIntegrations {
								
    "astro-icon-fix": true,
    "pagefind": true,
    "@astrojs/sitemap": true

							}
						
							interface ThemeIntegrationsResolved {
								
    "astro-icon-fix": true,
    "pagefind": true,
    "@astrojs/sitemap": true

							}
						
							declare module "charm:config" {
								
							const config: NonNullable<NonNullable<Parameters<typeof import("/home/runner/work/garden/garden/package/index.ts").default>[0]>["config"]>;
							export default config;
						
							}
						
							declare module "charm:context" {
								
export const integrations: Set<string>
export const pages: Map<"/[...special]" | "/" | "/rss.xml" | "/search" | "/categories/[category]" | "/categories" | "/posts/[...slug]" | "/tags/[tag]" | "/tags", string | false>
							}
						
							declare module "charm:components" {
								
export const TocSide: typeof import("/home/runner/work/garden/garden/package/src/components/TocSide.astro").default;
export const TocHeading: typeof import("/home/runner/work/garden/garden/package/src/components/TocHeading.astro").default;
export const Toc: typeof import("/home/runner/work/garden/garden/package/src/components/Toc.astro").default;
export const TagMindMap: typeof import("/home/runner/work/garden/garden/package/src/components/TagMindMap.astro").default;
export const ShootingStar: typeof import("/home/runner/work/garden/garden/package/src/components/ShootingStar.astro").default;
export const PostList: typeof import("/home/runner/work/garden/garden/package/src/components/PostList.astro").default;
export const PostHeader: typeof import("/home/runner/work/garden/garden/package/src/components/PostHeader.astro").default;
export const PostFooter: typeof import("/home/runner/work/garden/garden/package/src/components/PostFooter.astro").default;
export const Pagination: typeof import("/home/runner/work/garden/garden/package/src/components/Pagination.astro").default;
export const MobileMenu: typeof import("/home/runner/work/garden/garden/package/src/components/MobileMenu.astro").default;
export const LicenseDisplay: typeof import("/home/runner/work/garden/garden/package/src/components/LicenseDisplay.astro").default;
export const IconWrapper: typeof import("/home/runner/work/garden/garden/package/src/components/IconWrapper.astro").default;
export const IconLightDarkWrapper: typeof import("/home/runner/work/garden/garden/package/src/components/IconLightDarkWrapper.astro").default;
export const HomeSide: typeof import("/home/runner/work/garden/garden/package/src/components/HomeSide.astro").default;
export const HomePageHeader: typeof import("/home/runner/work/garden/garden/package/src/components/HomePageHeader.astro").default;
export const GoogleAnalytics: typeof import("/home/runner/work/garden/garden/package/src/components/GoogleAnalytics.astro").default;
export const FontLoader: typeof import("/home/runner/work/garden/garden/package/src/components/FontLoader.astro").default;
export const Empty: typeof import("/home/runner/work/garden/garden/package/src/components/Empty.astro").default;
export const ContentWrapper: typeof import("/home/runner/work/garden/garden/package/src/components/ContentWrapper.astro").default;
export const Comments: typeof import("/home/runner/work/garden/garden/package/src/components/Comments.astro").default;
export const BaseSide: typeof import("/home/runner/work/garden/garden/package/src/components/BaseSide.astro").default;
							}
						
							declare module "charm:layouts" {
								
export const PostLayout: typeof import("/home/runner/work/garden/garden/package/src/layouts/PostLayout.astro").default;
export const MainLayout: typeof import("/home/runner/work/garden/garden/package/src/layouts/MainLayout.astro").default;
export const HomeLayout: typeof import("/home/runner/work/garden/garden/package/src/layouts/HomeLayout.astro").default;
export const BaseLayout: typeof import("/home/runner/work/garden/garden/package/src/layouts/BaseLayout.astro").default;
							}
						
							declare module "charm:custom" {
								
export const CustomScriptComponent: typeof import("/home/runner/work/garden/garden/playground/src/components/CustomScriptComponent.astro").default;
export const CustomPostHeaderTop: typeof import("/home/runner/work/garden/garden/package/src/components/Empty.astro").default;
export const CustomPostHeaderBottom: typeof import("/home/runner/work/garden/garden/playground/src/components/CustomPostHeaderBottom.astro").default;
export const CustomPostFooterTop: typeof import("/home/runner/work/garden/garden/package/src/components/Empty.astro").default;
export const CustomPostFooterBottom: typeof import("/home/runner/work/garden/garden/playground/src/components/WalineComment.astro").default;
							}
						