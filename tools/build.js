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
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'xianxia.html');
fs.writeFileSync(out, html);
console.log(`已生成 ${path.relative(root, out)} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
