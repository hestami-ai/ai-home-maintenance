module Hestami.Domain.Communication exposing (..)

import Hestami.Common exposing (..)


type MessageChannel
    = ChannelEmail
    | ChannelSms
    | ChannelPortal
    | ChannelLetter


type alias Announcement =
    { id : Id
    , associationId : AssociationId
    , title : String
    , body : String
    , createdAt : Timestamp
    , createdByUserId : UserId
    , publishFrom : Timestamp
    , publishTo : Maybe Timestamp
    }


type alias MassMessage =
    { id : Id
    , associationId : AssociationId
    , subject : String
    , bodyTemplate : String
    , channel : MessageChannel
    , sentAt : Maybe Timestamp
    }


type alias MailMergeTemplate =
    { id : Id
    , associationId : AssociationId
    , name : String
    , description : String
    , bodyTemplate : String
    }


type alias CalendarEvent =
    { id : CalendarEventId
    , associationId : AssociationId
    , title : String
    , description : String
    , startsAt : Timestamp
    , endsAt : Maybe Timestamp
    , location : String
    }


type alias MeetingNotice =
    { id : Id
    , associationId : AssociationId
    , meetingId : MeetingId
    , noticeSentAt : Timestamp
    , channel : MessageChannel
    , documentId : Maybe DocumentId
    }
