module Hestami.Domain.Reserve exposing (..)

import Hestami.Common exposing (..)


type alias ReserveComponent =
    { id : ReserveComponentId
    , associationId : AssociationId
    , name : String
    , description : String
    , locationDescription : String
    , usefulLifeYears : Int
    , remainingLifeYears : Int
    , currentReplacementCost : Money
    }


type alias ReserveStudy =
    { id : ReserveStudyId
    , associationId : AssociationId
    , studyDate : Timestamp
    , preparedBy : String
    , documentId : Maybe DocumentId
    }


type alias ReserveFundingPlan =
    { id : Id
    , reserveStudyId : ReserveStudyId
    , description : String
    , targetYear : Int
    , annualContribution : Money
    }


type alias PreventiveMaintenancePlan =
    { id : Id
    , associationId : AssociationId
    , name : String
    , description : String
    , reserveComponentId : Maybe ReserveComponentId
    }


type alias CapitalProjectForecast =
    { id : Id
    , associationId : AssociationId
    , reserveComponentId : ReserveComponentId
    , plannedYear : Int
    , estimatedCost : Money
    , workOrderId : Maybe WorkOrderId
    }
