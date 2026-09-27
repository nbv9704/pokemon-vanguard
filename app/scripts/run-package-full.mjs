import {fileURLToPath} from 'node:url';
import {runPython} from './python-executable.mjs';
const args=process.argv.slice(2),normalized=args.length===1&&!args[0].startsWith('-')?['--output',args[0]]:args;
process.exit(runPython(fileURLToPath(new URL('./package-full.py',import.meta.url)),normalized));
