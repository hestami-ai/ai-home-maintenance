module Hestami.Domain.Compliance exposing (..)

import Hestami.Common exposing (..)


type JurisdictionLevel
    = StateLevel
    | CountyLevel
    | CityLevel
    | OtherJurisdiction


type alias NoticeRequirement =
    { id : ComplianceRuleId
    , associationId : AssociationId
    , name : String
    , description : String
    , jurisdiction : JurisdictionLevel
    , minimumDaysBeforeMeeting : Int
    }


type alias VotingRequirement =
    { id : ComplianceRuleId
    , associationId : AssociationId
    , name : String
    , description : String
    , jurisdiction : JurisdictionLevel
    , requiredQuorumPercent : Float
    , requiredApprovalPercent : Float
    }


type alias DocumentDeliveryDeadline =
    { id : ComplianceRuleId
    , associationId : AssociationId
    , name : String
    , description : String
    , jurisdiction : JurisdictionLevel
    , documentType : String
    , daysToDeliver : Int
    }


type alias ElectionRule =
    { id : ComplianceRuleId
    , associationId : AssociationId
    , name : String
    , description : String
    , jurisdiction : JurisdictionLevel
    }


type alias AuditRequirement =
    { id : ComplianceRuleId
    , associationId : AssociationId
    , name : String
    , description : String
    , jurisdiction : JurisdictionLevel
    , frequencyYears : Int
    }


type alias LienPolicy =
    { id : ComplianceRuleId
    , associationId : AssociationId
    , name : String
    , description : String
    , jurisdiction : JurisdictionLevel
    , minimumDelinquentDays : Int
    }


type alias LateFeeRule =
    { id : ComplianceRuleId
    , associationId : AssociationId
    , name : String
    , description : String
    , jurisdiction : JurisdictionLevel
    , feeAmount : Money
    }


type alias DisclosurePacketRule =
    { id : ComplianceRuleId
    , associationId : AssociationId
    , name : String
    , description : String
    , jurisdiction : JurisdictionLevel
    , daysToProduce : Int
    }
