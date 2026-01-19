import chalk from 'chalk';

export type ViolationSeverity = 'error' | 'warning' | 'info';

export interface Violation {
    rule: string;
    file: string;
    reason: string;
    suggestion?: string;
    line?: number;
    column?: number;
    severity?: ViolationSeverity; // Defaults to 'error' if not specified
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

    const errors = report.violations.filter(v => !v.severity || v.severity === 'error');
    const warnings = report.violations.filter(v => v.severity === 'warning');
    const infos = report.violations.filter(v => v.severity === 'info');

    // Print summary line
    if (report.status === 'pass') {
        console.log(chalk.green('✔ All governance checks passed!'));
        if (warnings.length > 0 || infos.length > 0) {
            console.log(chalk.gray(`  (${warnings.length} warnings, ${infos.length} info)`));
        }
    } else {
        console.log(chalk.red(`✖ Found ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info:`));
    }

    // If no violations to print, return early
    if (errors.length === 0 && warnings.length === 0 && infos.length === 0) {
        return;
    }

    console.log('');

    // Print errors first
    errors.forEach((v) => {
        console.log(`${chalk.red('ERROR')} ${chalk.bold(v.rule)}: ${v.file}${v.line ? `:${v.line}` : ''}${v.column ? `:${v.column}` : ''}`);
        console.log(chalk.yellow(`  Reason: ${v.reason}`));
        if (v.suggestion) {
            console.log(chalk.blue(`  Suggestion: ${v.suggestion}`));
        }
        console.log('');
    });

    // Print warnings
    warnings.forEach((v) => {
        console.log(`${chalk.yellow('WARN')} ${chalk.bold(v.rule)}: ${v.file}${v.line ? `:${v.line}` : ''}${v.column ? `:${v.column}` : ''}`);
        console.log(chalk.gray(`  Reason: ${v.reason}`));
        if (v.suggestion) {
            console.log(chalk.blue(`  Suggestion: ${v.suggestion}`));
        }
        console.log('');
    });

    // Print info
    infos.forEach((v) => {
        console.log(`${chalk.cyan('INFO')} ${chalk.bold(v.rule)}: ${v.file}${v.line ? `:${v.line}` : ''}${v.column ? `:${v.column}` : ''}`);
        console.log(chalk.gray(`  Reason: ${v.reason}`));
        if (v.suggestion) {
            console.log(chalk.blue(`  Suggestion: ${v.suggestion}`));
        }
        console.log('');
    });
}
