import fs from 'fs-extra';
import path from 'path';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as terserMinify } from 'terser';
import CleanCSS from 'clean-css';

const srcDir = path.resolve('src');
const distDir = path.resolve('dist');

async function minifyAndCopy() {
    // Walk literal filenames: no glob parser or pattern dependency is needed.
    const entries = await fs.readdir(srcDir, { recursive: true, withFileTypes: true });
    const files = entries.filter(entry => entry.isFile())
        .map(entry => path.relative(srcDir, path.join(entry.parentPath, entry.name)))
        .filter(file => file !== path.join('favorite', 'package.json'))
        .sort();
    await fs.emptyDir(distDir);

    for (const file of files) {
        const srcPath = path.join(srcDir, file);
        const distPath = path.join(distDir, file);
        await fs.ensureDir(path.dirname(distPath));

        if (file.endsWith('.html')) {
            const content = await fs.readFile(srcPath, 'utf8');
            const minified = await minifyHtml(content, {
                collapseWhitespace: true,
                removeComments: true,
                minifyJS: true,
                minifyCSS: true,
            });
            await fs.writeFile(distPath, minified, 'utf8');
        } else if (file.endsWith('.js')) {
            const content = await fs.readFile(srcPath, 'utf8');
            const minified = await terserMinify(content);
            await fs.writeFile(distPath, minified.code, 'utf8');
        } else if (file.endsWith('.css')) {
            const content = await fs.readFile(srcPath, 'utf8');
            const minified = new CleanCSS().minify(content);
            if (minified.errors.length) throw new Error(`${file}: ${minified.errors.join('; ')}`);
            await fs.writeFile(distPath, minified.styles, 'utf8');
        } else {
            await fs.copy(srcPath, distPath);
        }
    }
}

minifyAndCopy()
    .then(() => console.log('构建完成，已输出到 dist 文件夹'))
    .catch(err => {
        console.error('构建失败:', err);
        process.exitCode = 1;
    });
