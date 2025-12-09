module Hestami.Domain.Violation exposing (..)

import Hestami.Common exposing (..)


type ViolationCategory
    = Parking
    | Landscaping
    | Architectural
    | Noise
    | Trash
    | OtherCategory


type ViolationStage
    = FirstNotice
    | SecondNotice
    | HearingScheduled
    | FineImposed
    | ClosedNoIssue
    | ClosedCompliant


type alias Violation =
    { id : ViolationId
    , associationId : AssociationId
    , unitId : Maybe HousingUnitId
    , propertyId : PropertyId
    , category : ViolationCategory
    , description : String
    , stage : ViolationStage
    , createdAt : Timestamp
    , closedAt : Maybe Timestamp
    }


type alias Evidence =
    { id : Id
    , violationId : ViolationId
    , documentId : DocumentId
    , description : String
    }


type alias ViolationNotice =
    { id : Id
    , violationId : ViolationId
    , stage : ViolationStage
    , sentAt : Timestamp
    , method : String
    }


type alias Hearing =
    { id : Id
    , violationId : ViolationId
    , scheduledAt : Timestamp
    , location : String
    , outcome : Maybe String
    }


type alias Fine =
    { id : Id
    , violationId : ViolationId
    , amount : Money
    , assessmentId : Maybe AssessmentId
    }
