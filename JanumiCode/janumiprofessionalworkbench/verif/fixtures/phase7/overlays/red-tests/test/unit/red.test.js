// ⛔ A BROKEN FIXTURE (`verif/phase7-seeded-faults.test.ts`): a unit test that is false of a correct product — it expects
// the default N to be 5. As the only unit test file of its copy, it makes the suite red BEFORE any mutation, so the tool must
// judge no mutant: every "caught" would be the suite failing for its own reason.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TOP } from '../../src/options.js';

test('the default N is 5', () => {
	assert.equal(DEFAULT_TOP, 5);
});
