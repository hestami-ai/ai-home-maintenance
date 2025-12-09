module Hestami.Domain.Governance exposing (..)

import Hestami.Common exposing (..)


type BoardRole
    = President
    | VicePresident
    | Treasurer
    | Secretary
    | DirectorAtLarge
    | CommitteeChair
    | OtherBoardRole


type alias Board =
    { id : Id
    , associationId : AssociationId
    , name : String
    , description : String
    }


type alias BoardMember =
    { id : Id
    , boardId : Id
    , partyId : PartyId
    , role : BoardRole
    , startDate : Timestamp
    , endDate : Maybe Timestamp
    }


type MeetingType
    = Annual
    | RegularBoard
    | SpecialBoard
    | CommitteeMeeting
    | OtherMeetingType


type alias Meeting =
    { id : MeetingId
    , associationId : AssociationId
    , meetingType : MeetingType
    , title : String
    , scheduledAt : Timestamp
    , location : String
    }


type alias AgendaItem =
    { id : Id
    , meetingId : MeetingId
    , orderIndex : Int
    , title : String
    , description : String
    }


type alias MeetingMinutes =
    { id : Id
    , meetingId : MeetingId
    , documentId : DocumentId
    }


type alias Resolution =
    { id : Id
    , associationId : AssociationId
    , title : String
    , text : String
    , adoptedAt : Timestamp
    , meetingId : Maybe MeetingId
    }


type PolicyDocumentType
    = CcRs
    | Bylaws
    | RulesAndRegulations
    | ArchitecturalGuidelines
    | OtherPolicy


type alias PolicyDocument =
    { id : Id
    , associationId : AssociationId
    , policyType : PolicyDocumentType
    , name : String
    , documentId : DocumentId
    , effectiveDate : Timestamp
    }
