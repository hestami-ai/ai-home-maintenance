module Hestami.Domain.Association exposing (..)

import Hestami.Common exposing (..)


type AssociationType
    = Hoa
    | Condo
    | Coop
    | Poa
    | MasterAssociation
    | OtherAssociation


type alias Association =
    { id : AssociationId
    , name : String
    , associationType : AssociationType
    , legalEntityName : String
    , taxId : Maybe String
    , primaryAddress : Address
    , managementCompanyId : Maybe ManagementCompanyId
    }


type alias Property =
    { id : PropertyId
    , associationId : AssociationId
    , name : String
    , address : Address
    , description : String
    }


type alias HousingUnit =
    { id : HousingUnitId
    , associationId : AssociationId
    , propertyId : PropertyId
    , unitNumber : String
    , legalDescription : String
    , ownerPartyId : PartyId
    }


type alias CommonArea =
    { id : CommonAreaId
    , associationId : AssociationId
    , propertyId : PropertyId
    , name : String
    , description : String
    }


type alias Amenity =
    { id : Id
    , associationId : AssociationId
    , propertyId : PropertyId
    , name : String
    , description : String
    , commonAreaId : Maybe CommonAreaId
    }


type alias OwnerUnitRelationship =
    { id : Id
    , ownerPartyId : PartyId
    , unitId : HousingUnitId
    , ownershipShare : Float
    , isPrimaryOwner : Bool
    , startDate : Timestamp
    , endDate : Maybe Timestamp
    }


type alias ManagementCompany =
    { id : ManagementCompanyId
    , name : String
    , address : Address
    , phone : PhoneNumber
    , email : Email
    , website : Maybe Url
    }


type alias ManagementContract =
    { id : Id
    , associationId : AssociationId
    , managementCompanyId : ManagementCompanyId
    , effectiveDate : Timestamp
    , endDate : Maybe Timestamp
    , feeStructure : String
    }


type alias PortfolioManager =
    { id : PortfolioManagerId
    , managementCompanyId : ManagementCompanyId
    , userId : UserId
    , name : String
    , email : Email
    }
