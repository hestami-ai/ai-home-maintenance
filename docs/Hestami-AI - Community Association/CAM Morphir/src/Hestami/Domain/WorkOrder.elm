module Hestami.Domain.WorkOrder exposing (..)

import Hestami.Common exposing (..)


type WorkOrderType
    = Maintenance
    | Repair
    | Inspection
    | Emergency
    | CapitalProject
    | OtherType


type WorkOrderPriority
    = Low
    | Normal
    | High
    | EmergencyPriority


type WorkOrderStatus
    = WoDraft
    | WoRequested
    | WoApproved
    | WoScheduled
    | WoInProgress
    | WoCompleted
    | WoClosed
    | WoCancelled


type alias Asset =
    { id : Id
    , associationId : AssociationId
    , propertyId : PropertyId
    , name : String
    , description : String
    , locationDescription : String
    }


type alias Vendor =
    { id : VendorId
    , name : String
    , address : Address
    , phone : PhoneNumber
    , email : Email
    , website : Maybe Url
    }


type alias BidProposal =
    { id : Id
    , workOrderId : WorkOrderId
    , vendorId : VendorId
    , submittedAt : Timestamp
    , amount : Money
    , summary : String
    }


type alias ServiceContract =
    { id : Id
    , associationId : AssociationId
    , vendorId : VendorId
    , name : String
    , effectiveDate : Timestamp
    , endDate : Maybe Timestamp
    , termsSummary : String
    }


type alias WorkOrder =
    { id : WorkOrderId
    , associationId : AssociationId
    , propertyId : PropertyId
    , unitId : Maybe HousingUnitId
    , commonAreaId : Maybe CommonAreaId
    , assetId : Maybe Id
    , workOrderType : WorkOrderType
    , priority : WorkOrderPriority
    , status : WorkOrderStatus
    , title : String
    , description : String
    , requestedByPartyId : PartyId
    , requestedAt : Timestamp
    , assignedVendorId : Maybe VendorId
    , scheduledStartAt : Maybe Timestamp
    , scheduledEndAt : Maybe Timestamp
    , actualStartAt : Maybe Timestamp
    , actualCompletedAt : Maybe Timestamp
    , estimatedCost : Maybe Money
    , finalCost : Maybe Money
    , relatedContractId : Maybe Id
    }
