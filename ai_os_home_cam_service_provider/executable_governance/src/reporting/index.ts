import chalk from 'chalk';

export interface Violation {
    rule: string;
    file: string;
    reason: string;
    suggestion?: string;
    line?: number;
    column?: number;
}

export interface Report {
    status: 'pass' | 'fail';
    violations: Violation[];
}

export function printReport(report: Report, jsonMode: boolean) {
    if (jsonMode) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    if (report.status === 'pass') {
        console.log(chalk.green('✔ All governance checks passed!'));
        return;
    }

    console.log(chalk.red(`✖ Found ${report.violations.length} violations:`));
    console.log('');

    report.violations.forEach((v, i) => {
        console.log(`${chalk.bold(v.rule)}: ${v.file}${v.line ? `:${v.line}` : ''}${v.column ? `:${v.column}` : ''}`);
        console.log(chalk.yellow(`  Reason: ${v.reason}`));
        if (v.suggestion) {
            console.log(chalk.blue(`  Suggestion: ${v.suggestion}`));
        }
        console.log('');
    });
}
