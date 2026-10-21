import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('public/vendor/fonts',{recursive:true});
await mkdir('licenses',{recursive:true});
const files=[
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf','public/vendor/fonts/NotoSansThai.ttf'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifthai/NotoSerifThai%5Bwdth,wght%5D.ttf','public/vendor/fonts/NotoSerifThai.ttf'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/OFL.txt','licenses/NotoSansThai-OFL.txt'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifthai/OFL.txt','licenses/NotoSerifThai-OFL.txt'],
  ['https://raw.githubusercontent.com/swisseph-js/swisseph/main/LICENSE','licenses/swisseph-js-LICENSE.txt'],
  ['https://raw.githubusercontent.com/aloistr/swisseph/master/LICENSE','licenses/Swiss-Ephemeris-LICENSE.txt'],
];
for(const [url,path] of files){const response=await fetch(url);if(!response.ok)throw Error(`${response.status}: ${url}`);await writeFile(path,Buffer.from(await response.arrayBuffer()));console.log(`Saved ${path}`);}
