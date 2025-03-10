import { list as listProjects, type Project } from "/lib/xp/project";
import { run } from "/lib/xp/context";
import { pageUrl, type PageUrlParams } from "/lib/xp/portal";
import { list as listVhosts, type VirtualHost } from "/lib/xp/vhost";
import type { Request } from "@enonic-types/core";

export interface Translation {
  url?: string;
  absoluteUrl?: string | undefined;
  rootUrl: string;
  languageCode: string;
  current: boolean;
}

export function getTranslations(contentId: string, req: Request): Array<Translation>;
export function getTranslations(contentId: string, currentRepositoryId: string): Array<Translation>;
export function getTranslations(contentId: string, reqOrCurrentRepositoryId: string | Request): Array<Translation> {
  const vhosts = listVhosts().vhosts;
  const projects = run(
    {
      principals: ["role:system.admin"],
    },
    () => listProjects(),
  );
  const currentProjectId = getCurrentProjectId(reqOrCurrentRepositoryId);
  const currentProject = projects.filter((project) => project.id === currentProjectId)[0];

  return projects
    .filter((project) => isLayerInCurrentProject(project, currentProject))
    .map((project) => createTranslation(project, vhosts, contentId, reqOrCurrentRepositoryId))
    .filter<Translation>(notNullOrUndefined)
    .sort((a, b) => a.languageCode.localeCompare(b.languageCode));
}

function isLayerInCurrentProject(project: Project, currentProject: Project): boolean {
  return project.id === currentProject.parent || project.parent === currentProject.id;
}

export function getLanguageLinksForHead(translations: Array<Translation>): string[] {
  return translations
    .filter((translation) => translation.absoluteUrl !== undefined)
    .map(
      (translation) =>
        `<link rel="alternate" hreflang="${translation.languageCode}" href="${translation.absoluteUrl}" />`,
    );
}

function getCurrentProjectId(reqOrCurrentRepositoryId: string | Request): string | undefined {
  const currentRepositoryId =
    typeof reqOrCurrentRepositoryId === "string" ? reqOrCurrentRepositoryId : reqOrCurrentRepositoryId.repositoryId;
  return currentRepositoryId ? getProjectIdByRepositoryId(currentRepositoryId) : undefined;
}

function getProjectIdByRepositoryId(repositoryId: string): string {
  return substringAfterLast(substringAfterLast(repositoryId, "/"), ".");
}

function substringAfterLast(str: string, search: string): string {
  return str.substring(str.lastIndexOf(search) + 1);
}

function createTranslation(
  project: Project,
  vhosts: VirtualHost[],
  contentId: string,
  reqOrCurrentRepositoryId: string | Request,
): Translation | undefined {
  const rootUrl = getVhostSourceByProject(project.id, vhosts)?.source;
  const currentProjectId = getCurrentProjectId(reqOrCurrentRepositoryId);
  const params = typeof reqOrCurrentRepositoryId !== "string" ? reqOrCurrentRepositoryId.params : {};

  return project.language && currentProjectId
    ? {
        languageCode: sanitizeLanguageCode(project.language),
        current: project.id === currentProjectId,
        rootUrl: rootUrl ?? "/",
        url: getTranslatedUrl(project.id, contentId, currentProjectId, vhosts, params) ?? undefined,
        absoluteUrl: getTranslatedUrl(project.id, contentId, currentProjectId, vhosts, params, "absolute") ?? undefined,
      }
    : undefined;
}

function getVhostSourceByProject(projectId: string, vhosts: VirtualHost[]): VirtualHost | undefined {
  return findVhost(vhosts, (vhost) => startsWith(vhost.target, `/site/${projectId}/`));
}

function startsWith(str: string, search: string): boolean {
  return str.slice(0, search.length) === search;
}

function sanitizeLanguageCode(language: string): string {
  return language.replace("_", "-");
}

function getTranslatedUrl(
  projectId: string,
  contentId: string,
  currentProjectId: string,
  vhosts: VirtualHost[],
  params: Request["params"],
  type: PageUrlParams["type"] = undefined,
): string | undefined {
  const currentVhost = getVhostSourceByProject(currentProjectId, vhosts);
  const projectVhost = getVhostSourceByProject(projectId, vhosts);
  const urlOnWrongVhost = run(
    {
      repository: `com.enonic.cms.${projectId}`,
    },
    () =>
      pageUrl({
        id: contentId,
        type,
        params,
      }),
  );

  if (urlIs404(urlOnWrongVhost)) {
    return;
  } else if (isInAdminSite(urlOnWrongVhost, vhosts)) {
    return urlOnWrongVhost.replace(`/${currentProjectId}/draft/`, `/${projectId}/draft/`);
  } else if (urlOnWrongVhost === currentVhost?.source && projectVhost) {
    // is top level of translated page
    return urlOnWrongVhost.replace(currentVhost.source, projectVhost.source);
  } else if (currentVhost && projectVhost) {
    return urlOnWrongVhost.replace(appendSlash(currentVhost.source), appendSlash(projectVhost.source));
  }
}

function urlIs404(url: string): boolean {
  return url.indexOf("/_/error/404") !== -1;
}

function isInAdminSite(url: string, vhosts: VirtualHost[]): boolean {
  const adminSource = findVhost(vhosts, (vhost) => vhost.target === "/admin")?.source ?? "/admin";
  return url.indexOf(`${adminSource}/site/`) !== -1;
}

function findVhost(vhosts: VirtualHost[], f: (vhost: VirtualHost) => unknown): VirtualHost | undefined {
  return vhosts.filter(f)[0];
}

function appendSlash(path: string): string {
  return path === "/" ? path : `${path}/`;
}

function notNullOrUndefined<T>(val: T | null | undefined): val is T {
  return val !== null && val !== undefined;
}
