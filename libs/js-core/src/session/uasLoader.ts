import fs from 'fs';
import path from 'path';

export const uas = (() => {
    const uasPath = path.resolve(path.dirname(__dirname), 'uas.json');
    return JSON.parse(fs.readFileSync(uasPath, 'utf8'));
})();