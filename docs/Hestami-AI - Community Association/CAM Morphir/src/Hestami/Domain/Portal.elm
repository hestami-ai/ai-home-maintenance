module Hestami.Domain.Portal exposing (..)

import Hestami.Common exposing (..)


type UserRole
    = OwnerRole
    | TenantRole
    | ManagerRole
    | VendorRole
    | BoardMemberRole
    | AdminRole


type alias PortalUser =
    { id : UserId
    , email : Email
    , name : String
    , role : UserRole
    , associationId : Maybe AssociationId
    , vendorId : Maybe VendorId
    }


type RequestType
    = GeneralRequest
    | Complaint
    | InformationRequest
    | MaintenanceRequest
    | OtherRequestType


type RequestStatus
    = RequestOpen
    | RequestInProgress
    | RequestClosed


type alias PortalRequest =
    { id : Id
    , associationId : AssociationId
    , submittedByUserId : UserId
    , requestType : RequestType
    , subject : String
    , description : String
    , status : RequestStatus
    , createdAt : Timestamp
    , closedAt : Maybe Timestamp
    }


type PaymentPreferenceMethod
    = PrefAch
    | PrefCreditCard
    | PrefMailCheck
    | PrefLockbox
    | PrefOther


type alias PaymentPreference =
    { id : Id
    , userId : UserId
    , associationId : AssociationId
    , method : PaymentPreferenceMethod
    , bankAccountId : Maybe BankAccountId
    , notes : String
    }


type alias AccountLedgerView =
    { associationId : AssociationId
    , unitId : HousingUnitId
    , currentBalance : Money
    , lastStatementDate : Maybe Timestamp
    }
