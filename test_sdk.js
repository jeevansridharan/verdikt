import * as sdk from 'casper-js-sdk';
import fs from 'fs';
fs.writeFileSync('sdk_keys.txt', Object.keys(sdk).join('\n'));
