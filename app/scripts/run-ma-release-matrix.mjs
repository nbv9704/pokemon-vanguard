import {runMaReleaseMatrix} from '../release/ma-release-matrix.mjs';
const result=runMaReleaseMatrix();
console.log(`M-A release matrix OK — Single ${result.single.speciesSpawned}/213, Double ${result.double.speciesSpawned}/213, Mega ${result.mega.forms}/59, FX ${result.moveFx.moves}/490`);
console.log(JSON.stringify(result,null,2));
