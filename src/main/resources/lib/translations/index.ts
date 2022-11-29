import { list as listProjects, type Project } from "/lib/xp/project";
import { run } from "/lib/xp/context";
import { pageUrl } from "/lib/xp/portal";
import { list as listVhosts, type VirtualHost } from "/lib/xp/vhost";
import { Request } from "@item-enonic-types/global/controller";

export interface Translation {
  url: string;
  languageCode: string;
  current: boolean;
}

export function getTranslations(contentId: string, req: Request): Array<Translation>;
export function getTranslations(contentId: string, currentRepositoryId: string): Array<Translation>;
export function getTranslations(contentId: string, reqOrCurrentRepositoryId: string | Request): Array<Translation> {
  const currentProjectId = getCurrentProjectId(reqOrCurrentRepositoryId);
  const vhosts = listVhosts().vhosts;

  return listProjects()
    .map((project) => createTranslation(project, vhosts, contentId, currentProjectId))
    .filter<Translation>(notNullOrUndefined)
    .sort((a, b) => a.languageCode.localeCompare(b.languageCode));
}

function getCurrentProjectId(reqOrCurrentRepositoryId: string | Request): string {
  const currentRepositoryId =
    typeof reqOrCurrentRepositoryId === "string" ? reqOrCurrentRepositoryId : reqOrCurrentRepositoryId.repositoryId;
  return getProjectIdByRepositoryId(currentRepositoryId);
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
  currentProjectId: string
): Translation | undefined {
  const rootUrl = getVhostSourceByProject(project.id, vhosts)?.source;
  const url = getTranslatedUrl(project.id, contentId, currentProjectId, vhosts) ?? rootUrl;

  return project.language && url
    ? {
        languageCode: project.language,
        current: project.id === currentProjectId,
        url,
      }
    : undefined;
}

function getVhostSourceByProject(projectId: string, vhosts: VirtualHost[]): VirtualHost | undefined {
  return findVhost(vhosts, (vhost) => startsWith(vhost.target, `/site/${projectId}/`));
}

function startsWith(str: string, search: string): boolean {
  return str.slice(0, search.length) === search;
}

function getTranslatedUrl(
  projectId: string,
  contentId: string,
  currentProjectId: string,
  vhosts: VirtualHost[]
): string | void {
  const currentVhost = getVhostSourceByProject(currentProjectId, vhosts);
  const projectVhost = getVhostSourceByProject(projectId, vhosts);
  const urlOnWrongVhost = run(
    {
      repository: `com.enonic.cms.${projectId}`,
    },
    () =>
      pageUrl({
        id: contentId,
      })
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
  return startsWith(url, adminSource);
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
