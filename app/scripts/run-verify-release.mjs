import {fileURLToPath} from 'node:url';
import {runPython} from './python-executable.mjs';
process.exit(runPython(fileURLToPath(new URL('./verify-release.py',import.meta.url))));
