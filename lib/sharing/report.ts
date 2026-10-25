import DOMPurify from 'dompurify';
import {
  buildBundle,
  type BuildBundleInput,
  type ExportFile,
} from '@/lib/export/bundle';
import { buildMarkdownHtml } from '@/lib/export/report-html';

export async function buildHostedReport(
  input: BuildBundleInput,
): Promise<ExportFile[]> {
  const files = await buildBundle(input);
  const report = files.find((f) => f.path === 'report.md')!.text!;
  const links = files.map((f) => `- [${f.path}](${f.path})`).join('\n');
  const media = files
    .filter((f) => /^(video|audio)\/.+\.webm$/.test(f.path))
    .map((f) => {
      const tag = f.path.startsWith('video/') ? 'video' : 'audio';
      return `<p>${f.path}</p><${tag} controls preload="none" src="${f.path}" style="max-width:100%"></${tag}>`;
    })
    .join('\n');
  const html = buildMarkdownHtml(
    input.session.name,
    `${report}\n\n## Recordings\n${media || 'No media files at this detail level.'}\n\n## Download evidence\n${links}`,
    (raw) =>
      DOMPurify.sanitize(raw, {
        ADD_TAGS: ['video', 'audio'],
        ADD_ATTR: ['controls', 'preload'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style'],
        // Only relative evidence paths can load; captured external links are plain text.
        ALLOWED_URI_REGEXP: /^(?![a-z][a-z0-9+.-]*:|\/\/)[a-zA-Z0-9_./#-]+$/i,
      }),
  );
  return [...files, { path: 'index.html', text: html }];
}
