'use client';

import { useEffect } from 'react';

function appendSnippet(target: HTMLElement, code: string, scope: string) {
  const fragment = document.createRange().createContextualFragment(code);
  for (const script of Array.from(fragment.querySelectorAll('script'))) {
    const executable = document.createElement('script');
    for (const attribute of Array.from(script.attributes)) executable.setAttribute(attribute.name, attribute.value);
    executable.textContent = script.textContent;
    script.replaceWith(executable);
  }
  const marker = document.createComment(`site-snippet:${scope}`);
  const nodes: Node[] = [marker, ...Array.from(fragment.childNodes)];
  target.append(marker, fragment);
  return nodes;
}

export function CustomCodeInjector({ headCode, bodyEndCode, version }: { headCode: string | null; bodyEndCode: string | null; version: number }) {
  useEffect(() => {
    const nodes: Node[] = [];
    if (headCode?.trim()) nodes.push(...appendSnippet(document.head, headCode, `head-${version}`));
    if (bodyEndCode?.trim()) nodes.push(...appendSnippet(document.body, bodyEndCode, `body-${version}`));
    return () => nodes.forEach((node) => node.parentNode?.removeChild(node));
  }, [bodyEndCode, headCode, version]);
  return null;
}
