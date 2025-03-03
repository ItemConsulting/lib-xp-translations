# Enonic XP Translation Library

Enonic XP Library for getting all content translations (from different layers).

[![](https://repo.itemtest.no/api/badge/latest/releases/no/item/lib-xp-translations)](https://repo.itemtest.no/#/releases/no/item/lib-xp-translations)

## Gradle

To install this library you may need to add some new dependencies to your app's build.gradle file.

```groovy
repositories {
  maven { url "https://repo.itemtest.no/releases" }
}

dependencies {
  include "com.enonic.xp:lib-context:${xpVersion}"
  include "com.enonic.xp:lib-portal:${xpVersion}"
  include "com.enonic.xp:lib-project:${xpVersion}"
  include "com.enonic.xp:lib-vhost:${xpVersion}"
  include "no.item:lib-xp-translations:1.6.0"
}
```

### TypeScript

You can add the following changes to your *tsconfig.json* to get TypeScript-support.

```diff
{
  "compilerOptions": {
+   "baseUrl": "./",
+   "paths": {
+     "/lib/xp/*": ["./node_modules/@enonic-types/lib-*"],
+     "/lib/*": [ "./node_modules/@item-enonic-types/lib-*" ,"./src/main/resources/lib/*"],
+   }
  }
}
```
## Usage

This library exposes a function `getTranslations()` that takes a content id, and the request, and returns an
array with urls to all translations of the content on different layers.

It will return an array with objects of this shape:

```typescript
interface Translation {
  url?: string;
  absoluteUrl?: string;
  rootUrl: string;
  languageCode: string;
  current: boolean;
}
```

For pages that doesn't have a translation in a language, it will return `undefined`. But the application developer
can use `rootUrl` instead to link to the root page of that language.

### Example

```typescript
import { getContent } from "/lib/xp/portal";
import { render } from "/lib/thymeleaf";
import { localize } from "/lib/xp/i18n";
import { getTranslations, getPageContributions } from "/lib/translations";
import type { Request, Response } from "@enonic-types/core";

const view = resolve("default.html");

export function get(req: Request): Response {
  const content = getContent()!;
  const translations = getTranslations(content._id, req);
  const translation = translations
    .filter((translation) => !translation.current)
    .map(addName)[0]
  
  return {
    body: render(view, { translation }),
    pageContributions: getPageContributions(translations)
  }
}

function addName(translation: Translation): Translation & { name: string } {
  const name = localize({
    key: `language.${translation.languageCode}`,
    locale: content.language ?? 'en',
  });
  
  return {
    ...translation,
    name
  };
}
```

## Deploying

### Building

To build the project, run the following command

```bash
enonic project build
```

### Deploying locally

To deploy to a local sandbox, run the following command

```bash
enonic project deploy
```

### Deploy to Maven

```bash
./gradlew publish -P com.enonic.xp.app.production=true
```
