module Hestami.Common exposing (..)

{-| Shared types across the Hestami CDM.
-}

type alias Id =
    String


type alias Timestamp =
    String
    -- ISO 8601 string


type alias Money =
    { amount : Float
    , currency : String
    }


type alias Address =
    { line1 : String
    , line2 : Maybe String
    , city : String
    , stateOrProvince : String
    , postalCode : String
    , country : String
    }


type alias Email =
    String


type alias PhoneNumber =
    String


type alias Url =
    String


-- Common IDs (aliases on top of Id)

type alias AssociationId =
    Id


type alias PropertyId =
    Id


type alias HousingUnitId =
    Id


type alias CommonAreaId =
    Id


type alias ManagementCompanyId =
    Id


type alias PortfolioManagerId =
    Id


type alias PartyId =
    Id


type alias UserId =
    Id


type alias VendorId =
    Id


type alias DocumentId =
    Id


type alias WorkOrderId =
    Id


type alias ViolationId =
    Id


type alias ArcRequestId =
    Id


type alias AssessmentId =
    Id


type alias BankAccountId =
    Id


type alias AccountId =
    Id


type alias BudgetId =
    Id


type alias TaskId =
    Id


type alias MeetingId =
    Id


type alias CalendarEventId =
    Id


type alias ReserveComponentId =
    Id


type alias ReserveStudyId =
    Id


type alias ComplianceRuleId =
    Id
