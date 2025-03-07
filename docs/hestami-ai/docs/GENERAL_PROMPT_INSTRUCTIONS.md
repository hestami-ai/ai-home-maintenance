# General Prompt Instructions

## Introduction

Before making changes, show me all related types/interfaces/functions that this code depends on or extends. Compare your proposed changes with the existing codebase and highlight all affected components. Check the official documentation and type definitions for any components we're modifying and list all required elements. Before implementing, verify that your changes maintain all existing functionality. Show your verification process. For each modification you're proposing, explain why it's needed and how it relates to existing code.

When analyzing code changes, ensure the following aspects are covered:

1. **Dependency Analysis**
   - Show all related types, interfaces, and functions
   - Identify code dependencies and extensions

2. **Impact Assessment**
   - Compare proposed changes with existing codebase
   - Highlight all affected components

3. **Documentation Review**
   - Check official documentation in docs/hestami-ai/docs dicrectory
   - Review type definitions
   - List all required elements
   - In addition to checking official documentation, ensure to review the specific documentation for Next.js 14 and Django 5.1 located in docs/nextjs-14.2.18/docs and docs/django-5.1.1/docs directories and subdirectories before recommending and implementing changes. This is ABSOLUTELY NECESSARY AND CRITICAL to ensure compatibility with Next.js 14 and Django 5.1 and to avoid breaking changes hestami-ai application stack.

4. **Verification Process**
   - Verify changes maintain existing functionality
   - Document the verification process
   - Explain each modification's purpose and relationships

## Code Change Workflow Instructions

When making code changes, ALWAYS follow this strict sequence:

1. **Analysis Phase**
   - Show all related dependencies and components
   - Identify potential impacts of the change
   - Reference relevant documentation and requirements
   - DO NOT make any changes during this phase

2. **Proposal Phase**
   - Present the complete proposed solution with code examples
   - Explain each change and its purpose
   - Highlight any potential risks or side effects
   - Wait for explicit approval before proceeding

3. **Implementation Phase**
   - Only proceed after receiving explicit approval
   - Make changes exactly as approved in the proposal
   - If any deviations are needed, return to step 1
   - Show the actual changes made after implementation

4. **Verification Phase**
   - Confirm the changes match the approved proposal
   - Verify the original issue is resolved
   - Document any remaining or new issues discovered

Key Rules:
- NEVER implement changes before receiving explicit approval
- ALWAYS show the complete proposed solution first
- If unsure about approval, ask explicitly
- Return to Analysis Phase if requirements change