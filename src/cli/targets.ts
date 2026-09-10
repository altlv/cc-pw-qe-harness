import '../env.js';
import { formatTargets, validateTargets } from '../../apps/targets.js';

console.log(formatTargets());

// Exit non-zero on a problem so this is usable as a check, not only as a report.
process.exit(validateTargets().length > 0 ? 1 : 0);
