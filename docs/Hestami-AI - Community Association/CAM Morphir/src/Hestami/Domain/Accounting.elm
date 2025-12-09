module Hestami.Domain.Accounting exposing (..)

import Hestami.Common exposing (..)


type AccountType
    = Asset
    | Liability
    | Equity
    | Revenue
    | Expense


type alias ChartOfAccounts =
    { id : Id
    , associationId : AssociationId
    , name : String
    , accounts : List Account
    }


type alias Account =
    { id : AccountId
    , associationId : AssociationId
    , code : String
    , name : String
    , accountType : AccountType
    , isActive : Bool
    }


type alias LedgerEntry =
    { id : Id
    , associationId : AssociationId
    , timestamp : Timestamp
    , description : String
    , debitAccountId : AccountId
    , creditAccountId : AccountId
    , amount : Money
    , workOrderId : Maybe WorkOrderId
    , violationId : Maybe ViolationId
    , arcRequestId : Maybe ArcRequestId
    }


type alias Budget =
    { id : BudgetId
    , associationId : AssociationId
    , fiscalYear : Int
    , totalPlannedIncome : Money
    , totalPlannedExpense : Money
    }


type alias BudgetLine =
    { id : Id
    , budgetId : BudgetId
    , accountId : AccountId
    , description : String
    , plannedAmount : Money
    }


type AssessmentFrequency
    = Monthly
    | Quarterly
    | Annually
    | CustomFrequency


type alias AssessmentSchedule =
    { id : Id
    , associationId : AssociationId
    , name : String
    , frequency : AssessmentFrequency
    , amountPerUnit : Money
    }


type alias AssessmentCharge =
    { id : AssessmentId
    , associationId : AssociationId
    , unitId : HousingUnitId
    , scheduleId : Id
    , dueDate : Timestamp
    , amount : Money
    , isSpecialAssessment : Bool
    }


type PaymentMethod
    = Check
    | Lockbox
    | Ach
    | CreditCard
    | Cash
    | OtherMethod


type alias AssessmentPayment =
    { id : Id
    , associationId : AssociationId
    , assessmentId : AssessmentId
    , amount : Money
    , paymentMethod : PaymentMethod
    , receivedAt : Timestamp
    , bankAccountId : BankAccountId
    }


type alias BankAccount =
    { id : BankAccountId
    , associationId : AssociationId
    , name : String
    , bankName : String
    , accountNumberMasked : String
    , routingNumberMasked : String
    , isOperating : Bool
    , isReserve : Bool
    }


type alias VendorTaxProfile =
    { id : Id
    , vendorId : VendorId
    , taxId : String
    , w9ReceivedAt : Maybe Timestamp
    , is1099Eligible : Bool
    }
