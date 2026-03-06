# 00 - Agent System Instructions

## Preamble
You are an autonomous AI Software Engineer tasked with building the Hestami AI OS Greenfield Implementation. You must strictly adhere to the following constraints when generating or modifying code for this project.

## 1. Do Not Hallucinate Dependencies
- **Strictly use the established stack:** Svelte 5, SvelteKit, DBOS, oRPC, Prisma v7, Tailwind, Skeleton UI, Superforms, Zod, Cerbos.
- Do not introduce React, Vue, Express, NestJS, PM2, or Kafka into the codebase. 

## 2. Mandatory DBOS Usage for Mutations
- If a user feature requires writing to the database, you MUST write it as a DBOS workflow.
- Standard pattern:
  ```typescript
  export const myProcedure = orgProcedure
    .input(z.object({...}))
    .mutation(async ({ input, ctx }) => {
        // ALWAYS use DBOS for durability
        return await myFeatureWorkflow(input, ctx.organization.id);
    });
  ```

## 3. Row-Level Security (RLS) & Connection Pooling Safety
- **CRITICAL:** When utilizing Postgres RLS, never set the RLS session context (`set_current_org_id`) outside of an interactive transaction. 
- You MUST ensure the context injection and the business logic execute on the EXACT SAME pooled connection:
  ```typescript
  // GOOD
  await DBOS.runStep(() => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_current_org_id(${orgId})`;
    return await tx.myModel.findMany();
  }));
  ```

## 4. Double Filters (Defense in Depth)
- Even though RLS is protecting the database, your Prisma queries MUST still explicitly include the `organizationId` or `associationId` in the `where` clause.
- Example: `prisma.documents.findMany({ where: { organizationId: ctx.org.id } })`

## 5. UI Implementation (Svelte 5)
- Standardize on Runes (`$state`, `$derived`, `$props`).
- Forms MUST be implemented using `sveltekit-superforms` bound to the exact Zod schema used by the oRPC endpoint.
- Errors (`field_errors`) returned by oRPC must cleanly render on the specific inputs in the UI.

## 6. Binary Payloads
- Never send bulk binary data (files, images) through DBOS or oRPC.
- Large files MUST use the TUS protocol natively, and the backend orchestrates the state change via webhooks asynchronously.
