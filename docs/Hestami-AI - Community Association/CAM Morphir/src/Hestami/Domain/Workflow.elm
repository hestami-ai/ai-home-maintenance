module Hestami.Domain.Workflow exposing (..)

import Hestami.Common exposing (..)


type WorkflowEntityType
    = EntityWorkOrder
    | EntityViolation
    | EntityArcRequest
    | EntityInvoice
    | EntityAssessment
    | EntityGeneric


type alias WorkflowDefinition =
    { id : Id
    , associationId : Maybe AssociationId
    , name : String
    , entityType : WorkflowEntityType
    , description : String
    }


type alias WorkflowStep =
    { id : Id
    , definitionId : Id
    , name : String
    , orderIndex : Int
    , requiresApproval : Bool
    }


type WorkflowStatus
    = WorkflowPending
    | WorkflowInProgress
    | WorkflowCompleted
    | WorkflowCancelled


type alias WorkflowInstance =
    { id : Id
    , definitionId : Id
    , entityType : WorkflowEntityType
    , entityId : Id
    , status : WorkflowStatus
    , startedAt : Timestamp
    , completedAt : Maybe Timestamp
    }


type alias Task =
    { id : TaskId
    , workflowInstanceId : Id
    , stepId : Id
    , name : String
    , assignedToUserId : Maybe UserId
    , assignedToRole : Maybe String
    , dueAt : Maybe Timestamp
    , completedAt : Maybe Timestamp
    }


type TriggerType
    = TriggerAssessmentDue
    | TriggerViolationCreated
    | TriggerArcSubmitted
    | TriggerInvoiceReceived
    | TriggerWorkOrderCreated
    | TriggerCustom String


type alias Trigger =
    { id : Id
    , workflowDefinitionId : Id
    , triggerType : TriggerType
    , conditionExpression : String
    }


type NotificationChannel
    = EmailChannel
    | SmsChannel
    | PortalChannel


type alias SlaTimer =
    { id : Id
    , workflowDefinitionId : Id
    , name : String
    , thresholdMinutes : Int
    , appliesToStepId : Maybe Id
    }


type alias NotificationTemplate =
    { id : Id
    , workflowDefinitionId : Id
    , name : String
    , channel : NotificationChannel
    , subjectTemplate : String
    , bodyTemplate : String
    }
