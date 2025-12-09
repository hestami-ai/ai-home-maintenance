module Hestami.Domain.Document exposing (..)

import Hestami.Common exposing (..)


type DocumentType
    = GoverningDocument
    | PolicyResolution
    | FinancialReport
    | ReserveStudyDoc
    | InsuranceCertificate
    | VendorContractDoc
    | ArcPlan
    | InspectionReportDoc
    | MeetingMinutesDoc
    | OtherDocumentType


type alias Document =
    { id : DocumentId
    , associationId : Maybe AssociationId
    , documentType : DocumentType
    , name : String
    , storageUrl : Url
    , uploadedAt : Timestamp
    , uploadedByUserId : UserId
    }


type alias DocumentTag =
    { id : Id
    , documentId : DocumentId
    , tag : String
    }


type alias DocumentLink =
    { id : Id
    , fromDocumentId : DocumentId
    , toDocumentId : DocumentId
    , relationship : String
    }
