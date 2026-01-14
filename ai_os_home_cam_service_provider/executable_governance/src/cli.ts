import { Command } from 'commander';
import { loadConfig } from './config/index.js';
import { verifyBoundaries } from './checks/boundaries.ts';
import { verifyMutations } from './checks/mutations.ts';
import { verifyTypes } from './checks/types.ts';
import { verifyPipelines } from './checks/pipelines.ts';
import { verifyErrors } from './checks/errors.ts';
import { verifyPolicies } from './checks/policies.ts';
import { verifyTimestamps } from './checks/timestamps.ts';
import { verifySecurity } from './checks/security.ts';
import { verifyDeepTrace } from './checks/trace.ts';
import { printReport, type Report, type Violation } from './reporting/index.ts';
import path from 'path';

const program = new Command();

program
    .name('haos-guard')
    .description('Governance CLI for HAOS agents')
    .version('0.1.0');

program
    .command('verify')
    .description('Run governance verification checks')
    .argument('[check]', 'Specific check to run (boundaries, mutations, types, pipelines, rules)', 'rules')
    .option('--json', 'Output report in JSON format', false)
    .option('--config <path>', 'Path to config file', './haos-guard.config.json')
    .action(async (check, options) => {
        try {
            const config = loadConfig(path.resolve(process.cwd(), options.config));
            let violations: Violation[] = [];

            if (check === 'boundaries' || check === 'rules') {
                process.stdout.write('Checking boundaries... ');
                const boundaryViolations = await verifyBoundaries(config);
                violations.push(...boundaryViolations);
                console.log(boundaryViolations.length === 0 ? '✔' : '✖');
            }

            if (check === 'mutations' || check === 'rules') {
                process.stdout.write('Checking mutations... ');
                const mutationViolations = await verifyMutations(config);
                violations.push(...mutationViolations);
                console.log(mutationViolations.length === 0 ? '✔' : '✖');
            }

            if (check === 'types' || check === 'rules') {
                process.stdout.write('Checking types... ');
                const typeViolations = await verifyTypes(config);
                violations.push(...typeViolations);
                console.log(typeViolations.length === 0 ? '✔' : '✖');
            }

            if (check === 'pipelines' || check === 'rules') {
                process.stdout.write('Checking pipelines... ');
                const pipelineViolations = await verifyPipelines(config);
                violations.push(...pipelineViolations);
                console.log(pipelineViolations.length === 0 ? '✔' : '✖');
            }

            if (check === 'errors' || check === 'rules') {
                process.stdout.write('Checking errors (R6)... ');
                const errorViolations = await verifyErrors(config);
                violations.push(...errorViolations);
                console.log(errorViolations.length === 0 ? '✔' : '✖');
            }

            if (check === 'policies' || check === 'rules') {
                process.stdout.write('Checking policies (R10)... ');
                const policyViolations = await verifyPolicies(config);
                violations.push(...policyViolations);
                console.log(policyViolations.length === 0 ? '✔' : '✖');
            }

            if (check === 'timestamps' || check === 'rules') {
                process.stdout.write('Checking timestamps (R9)... ');
                const timestampViolations = await verifyTimestamps(config);
                violations.push(...timestampViolations);
                console.log(timestampViolations.length === 0 ? '✔' : '✖');
            }

            if (check === 'security' || check === 'rules') {
                process.stdout.write('Checking security (R7/R8)... ');
                const securityViolations = await verifySecurity(config);
                violations.push(...securityViolations);
                console.log(securityViolations.length === 0 ? '✔' : '✖');
            }

            if (check === 'trace' || check === 'rules') {
                process.stdout.write('Checking deep semantic trace (R10)... ');
                const traceViolations = await verifyDeepTrace(config);
                violations.push(...traceViolations);
                console.log(traceViolations.length === 0 ? '✔' : '✖');
            }

            // Add more checks here as they are implemented
            if (check !== 'boundaries' && check !== 'mutations' && check !== 'types' && check !== 'pipelines' && check !== 'errors' && check !== 'policies' && check !== 'timestamps' && check !== 'security' && check !== 'trace' && check !== 'rules') {
                console.warn(`Check '${check}' is not yet implemented.`);
            }

            const report: Report = {
                status: violations.length === 0 ? 'pass' : 'fail',
                violations
            };

            printReport(report, options.json);

            if (report.status === 'fail') {
                process.exit(1);
            }
        } catch (error: any) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
    });

program.parse();
