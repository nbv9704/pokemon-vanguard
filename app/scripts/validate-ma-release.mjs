import {auditMaRelease,writeMaReleaseReport} from '../release/ma-release-gate.mjs';
const report=await auditMaRelease();
if(process.argv.includes('--write'))await writeMaReleaseReport(report);
console.log(`M-A release gate — ${report.status}; ${report.scope.totalSelectable}/272 selectable, ${report.presentation.timelines}/490 timelines, ${report.assets.fallbackSafe}/272 fallback-safe assets, bespoke complete ${report.assets.bespokeComplete}/272`);
for(const warning of report.warnings)console.log(`warning: ${warning}`);
if(report.problems.length){for(const problem of report.problems)console.error(`release blocker: ${problem}`);process.exitCode=1;}
