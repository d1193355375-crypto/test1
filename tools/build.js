/* 把 index.html 引用的样式与脚本内联，生成可独立分发的单文件 dist/xianxia.html */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${read(href)}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = read(src);
  if (/<\/script/i.test(code)) throw new Error(`${src} 含有 </script>，无法内联`);
  return `<script>\n${code}\n</script>`;
});
// --artifact=<输出路径>：生成不含 <html>/<head>/<body> 的片段版本，供 Artifact 平台包裹发布
const art = process.argv.find((a) => a.startsWith('--artifact='));
if (art) {
  const title = (html.match(/<title>[^<]*<\/title>/) || ['<title>问道长生</title>'])[0];
  const style = html.match(/<style>[\s\S]*?<\/style>/g).join('\n');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1].trim();
  const outA = path.resolve(art.slice('--artifact='.length));
  fs.writeFileSync(outA, `${title}\n${style}\n${body}\n`);
  console.log(`已生成 Artifact 片段 ${outA}`);
}
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'xianxia.html');
fs.writeFileSync(out, html);
console.log(`已生成 ${path.relative(root, out)} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
