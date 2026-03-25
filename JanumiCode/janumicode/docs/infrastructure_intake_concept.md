# Concept Framework: INFRASTRUCTURE_GUIDED Intake Mode

## 1. Overview
The **INFRASTRUCTURE_GUIDED** Intake Mode is a specialized sub-phase within the Intake orchestrator designed specifically for Platform Engineering and Infrastructure as Code (IaC) tasks. 

Unlike the traditional `product_or_feature` intake which focuses on business domains, personas, and user journeys, this mode focuses on constraints, topologies, boundaries, and operational characteristics to systematically define an implementation plan for technical infrastructure.

## 2. Request Category & Mode Classification
- **Category:** `infrastructure_task` or `platform_engineering`
- **Intake Mode:** `INFRASTRUCTURE_GUIDED` (parallel to `DOMAIN_GUIDED`)

When the system classifies an input prompt as infrastructure-related (e.g., "Set up a new EKS cluster with Datadog monitoring and cross-account IAM roles"), the Intake workflow automatically routes to this specialized mode.

## 3. The Infrastructure Proposer-Validator Flow

The Proposer-Validator flow ensures the user is securely guided through architectural abstractions, from high-level topology down to low-level implementation logic.

### Round 1: `PROPOSING_TOPOLOGY_ENVIRONMENTS`
- **Objective:** Establish the high-level physical and logical boundaries of the infrastructure.
- **Proposed Artifacts:**
  - `EnvironmentProposal`: Defines targets (e.g., dev, staging, prod, DR).
  - `NetworkBoundaryProposal`: Defines VPCs, Subnets, Transit Gateways, Ingress/Egress policies.
- **User Validation:** Engineer validates if the proposed isolation levels and deployment regions meet compliance and blast-radius requirements.

### Round 2: `PROPOSING_COMPUTE_STORAGE`
- **Objective:** Define the core workloads and state-bearing resources.
- **Proposed Artifacts:**
  - `ComputeResourceProposal`: e.g., EKS clusters, Fargate profiles, Lambda functions.
  - `StorageResourceProposal`: e.g., RDS instances, DynamoDB tables, S3 buckets.
- **User Validation:** Engineer validates capacity planning, statefulness (ephemeral vs. persistent), and technology choices.

### Round 3: `PROPOSING_SECURITY_IAM`
- **Objective:** Define the Principle of Least Privilege and access controls.
- **Proposed Artifacts:**
  - `IAMRoleProposal`: Execution roles, cross-account trust policies.
  - `SecurityGroupProposal`: Firewall rules and internal network access.
- **User Validation:** Engineer verifies that no overly permissive access is granted and compliance standards (e.g., SOC2, PCI) are maintained.

### Round 4: `PROPOSING_OPERATIONS_DELIVERY`
- **Objective:** Establish CI/CD, observability, and day-2 operations.
- **Proposed Artifacts:**
  - `DeliveryPipelineProposal`: Deployment mechanisms (e.g., Terraform Cloud, GitHub Actions, Atlantis).
  - `ObservabilityProposal`: Monitoring metrics, SLIs/SLOs, logging strategies.
- **User Validation:** Engineer confirms the deployment safety mechanisms (e.g., Blue/Green, Canary) and alerting thresholds.

## 4. Proposed Type Additions ([intake.ts](file:///e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/types/intake.ts))

To support this mode, new structured entities should be introduced to [IntakePlanDocument](file:///e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/types/intake.ts#324-388):

```typescript
// Additions to IntakePlanDocument

/** The environments this infrastructure targets */
environments?: EnvironmentDefinition[];

/** Logical network and security boundaries */
networkBoundaries?: NetworkBoundaryProposal[];

/** Specific cloud resources to be provisioned */
provisionedResources?: ResourceProposal[];

/** Access control policies and IAM schemas */
securityPolicies?: SecurityPolicyProposal[];

/** How changes merge, deploy, and rollback */
deploymentPipelines?: PipelineProposal[];

/** SLIs, SLOs, and alerting configuration */
observabilityDefinitions?: ObservabilityProposal[];
```

## 5. Technical Expert Behavior Shifts

During this mode, the Technical Expert actively shifts its questioning and constraint-solving strategies away from user-experience towards non-functional requirements:

| Focus Area | Typical Investigation |
| :--- | :--- |
| **Scale & Throughput** | "What are the expected peak requests per second? Do we need to plan for IP exhaustion in the subnets?" |
| **State & Persistence** | "Is this cache ephemeral? What is the RPO/RTO for this datastore?" |
| **Blast Radius & Compliance** | "Does this infrastructure process PII/PCI data? Do we need encrypted-at-rest volumes with customer-managed KMS keys?" |
| **Idempotency & State Management** | "Will the Terraform state be managed centrally? Should we use dynamic remote state locking?" |

## 6. Integration with Engineering Domains

The system will leverage the existing `EngineeringDomain` definitions, but dynamically shift feature weights:
- **De-prioritized Domains:** `WORKFLOWS_USE_CASES`, `DATA_INFORMATION`, `STAKEHOLDERS`.
- **Primary Domains:** `ENVIRONMENT_OPERATIONS`, `SECURITY_COMPLIANCE`, `ARCHITECTURE`, `QUALITY_ATTRIBUTES`, `VERIFICATION_DELIVERY`.

## 7. Next Steps for Implementation
1. **Extend Types:** Add the new proposals to [src/lib/types/intake.ts](file:///e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/types/intake.ts).
2. **Update Prompts:** Create an `InfraProposer` prompt set that drives the LLM to output the new artifacts.
3. **UI Updates:** Create UI panels to render `EnvironmentProposal` and `NetworkBoundaryProposal` cards similarly to how [UserJourney](file:///e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/types/intake.ts#265-285) cards are currently rendered.
4. **Classifier Update:** Train or adjust the intake classifier to route to `platform_engineering` tasks accurately.
