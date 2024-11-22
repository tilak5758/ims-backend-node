import chalk from 'chalk';

export const getLogger = (prefix, color) => (msg) => console.log(color(`[${prefix}] ${msg}`));

export const log = getLogger('API', chalk.blueBright);
