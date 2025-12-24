module Hestami.Domain.Arc exposing (..)

import Hestami.Common exposing (..)


type ArcStatus
    = ArcDraft
    | ArcSubmitted
    | ArcUnderReview
    | ArcApproved
    | ArcApprovedWithConditions
    | ArcDenied
    | ArcClosed


type alias ArcRequest =
    { id : ArcRequestId
    , associationId : AssociationId
    , unitId : HousingUnitId
    , title : String
    , description : String
    , status : ArcStatus
    , requestedAt : Timestamp
    , decidedAt : Maybe Timestamp
    }


type alias ArcPlanDocument =
    { id : Id
    , arcRequestId : ArcRequestId
    , documentId : DocumentId
    , description : String
    }


type alias ArcCommittee =
    { id : Id
    , associationId : AssociationId
    , name : String
    , description : String
    }


type alias ArcReviewAction =
    { id : Id
    , arcRequestId : ArcRequestId
    , reviewerUserId : UserId
    , action : String
    , comment : String
    , createdAt : Timestamp
    }


type alias ArcConditionOfApproval =
    { id : Id
    , arcRequestId : ArcRequestId
    , description : String
    }


type alias ArcPermitRequirement =
    { id : Id
    , arcRequestId : ArcRequestId
    , description : String
    , externalPermitSystem : Maybe String
    , externalPermitId : Maybe String
    }
