import { profileRouter } from './profile.js';
import { branchRouter } from './branch.js';
import { licenseRouter } from './license.js';
import { insuranceRouter } from './insurance.js';
import { complianceRouter } from './compliance.js';

export const contractorRouter = {
	profile: profileRouter,
	branch: branchRouter,
	license: licenseRouter,
	insurance: insuranceRouter,
	compliance: complianceRouter
};
